import { randomUUID } from "node:crypto";

import type { GiveawayEmailOutbox } from "@prisma/client";

import prisma from "../db.server";
import {
  buildKlaviyoEventBody,
  KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC,
  parseCampaignOrderPaidPayload,
  safeKlaviyoApiError,
  type CampaignOrderPaidPayload,
} from "./klaviyo-event";

const KLAVIYO_EVENTS_ENDPOINT = "https://a.klaviyo.com/api/events";
const DEFAULT_REVISION = "2026-10-15";
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1_000;

type ProcessOptions = {
  limit?: number;
  uniqueId?: string;
};

export type KlaviyoProcessResult = {
  configured: boolean;
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
};

type SendEventResult =
  | { ok: true; status: 202 }
  | { ok: false; retryable: boolean; error: string; retryAfterMs?: number };

function privateApiKey() {
  const value = process.env.KLAVIYO_PRIVATE_API_KEY?.trim() ?? "";
  if (!value || /dummy|replace|your[_-]?key/i.test(value)) return null;
  return value;
}

function retryDelayMs(attempt: number) {
  return Math.min(60 * 60 * 1_000, 30_000 * 2 ** Math.min(attempt, 7));
}

async function postEvent(
  metricName: string,
  uniqueId: string,
  payload: CampaignOrderPaidPayload,
): Promise<SendEventResult> {
  const apiKey = privateApiKey();
  if (!apiKey) throw new Error("Klaviyo is not configured.");

  try {
    const response = await fetch(KLAVIYO_EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        "Content-Type": "application/vnd.api+json",
        Revision: process.env.KLAVIYO_API_REVISION?.trim() || DEFAULT_REVISION,
      },
      body: JSON.stringify(buildKlaviyoEventBody(metricName, uniqueId, payload)),
      signal: AbortSignal.timeout(8_000),
    });

    if (response.status === 202) return { ok: true, status: 202 };

    const responseText = (await response.text()).slice(0, 10_000);
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    return {
      ok: false,
      retryable: response.status === 429 || response.status >= 500,
      error: safeKlaviyoApiError(response.status, responseText),
      ...(response.status === 429 && Number.isFinite(retryAfterSeconds)
        ? { retryAfterMs: Math.max(1_000, retryAfterSeconds * 1_000) }
        : {}),
    };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: error instanceof Error
        ? `Klaviyo request failed: ${error.name}`
        : "Klaviyo request failed: unknown-error",
    };
  }
}

async function sendEvent(event: GiveawayEmailOutbox): Promise<SendEventResult> {
  const payload = parseCampaignOrderPaidPayload(event.payload);
  if (!payload) {
    return { ok: false, retryable: false, error: "Invalid Klaviyo event payload." };
  }
  return postEvent(event.metricName, event.uniqueId, payload);
}

function configuredTestEmail() {
  const email = process.env.KLAVIYO_TEST_EMAIL?.trim() ?? "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /@(example|test)\.(com|org|net)$/i.test(email) ||
    /\.invalid$/i.test(email) ||
    /replace/i.test(email)
  ) return null;
  return email;
}

export async function sendKlaviyoTestEvent() {
  if (!privateApiKey()) {
    return { accepted: false, status: null, error: "Klaviyo private API key is not configured." };
  }
  const email = configuredTestEmail();
  if (!email) {
    return {
      accepted: false,
      status: null,
      error: "KLAVIYO_TEST_EMAIL must be a real dedicated test mailbox.",
    };
  }

  const testId = randomUUID();
  const result = await postEvent(
    KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC,
    `campaign-order-paid:test:${testId}`,
    {
      email,
      customerName: "Klaviyo Integration Test",
      orderNumber: "TEST-ORDER",
      orderId: `test-order:${testId}`,
      orderDate: new Date().toISOString(),
      campaignName: "Black Friday Integration Test",
      ticketsEarned: 2,
      totalTickets: 2,
      ticketNumbers: ["TEST-TICKET-0001", "TEST-TICKET-0002"],
      firstTicket: "TEST-TICKET-0001",
      lastTicket: "TEST-TICKET-0002",
      ticketRange: "TEST-TICKET-0001 - TEST-TICKET-0002",
      luckyDrawDate: "December 1, 2026",
      isTest: true,
    },
  );

  return result.ok
    ? { accepted: true, status: result.status, metricName: KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC }
    : { accepted: false, status: null, error: result.error };
}

export async function processKlaviyoOutbox(
  options: ProcessOptions = {},
): Promise<KlaviyoProcessResult> {
  if (!privateApiKey()) {
    return { configured: false, processed: 0, sent: 0, failed: 0, errors: [] };
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const candidates = await prisma.giveawayEmailOutbox.findMany({
    where: {
      metricName: KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC,
      ...(options.uniqueId ? { uniqueId: options.uniqueId } : {}),
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextAttemptAt: { lte: now } },
        { status: "PROCESSING", updatedAt: { lte: staleBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const candidate of candidates) {
    const claimed = await prisma.giveawayEmailOutbox.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        updatedAt: candidate.updatedAt,
      },
      data: { status: "PROCESSING", lastError: null },
    });
    if (claimed.count !== 1) continue;

    processed += 1;
    const result = await sendEvent(candidate);
    if (result.ok) {
      sent += 1;
      await prisma.giveawayEmailOutbox.update({
        where: { id: candidate.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          nextAttemptAt: null,
          lastError: null,
        },
      });
      continue;
    }

    failed += 1;
    errors.push(result.error);
    await prisma.giveawayEmailOutbox.update({
      where: { id: candidate.id },
      data: {
        status: result.retryable ? "FAILED" : "DEAD",
        attempts: { increment: 1 },
        nextAttemptAt: result.retryable
          ? new Date(Date.now() + (result.retryAfterMs ?? retryDelayMs(candidate.attempts)))
          : null,
        lastError: result.error,
      },
    });
  }

  return { configured: true, processed, sent, failed, errors };
}
