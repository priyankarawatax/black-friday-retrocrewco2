import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's test runner resolves the TypeScript source directly.
import { buildKlaviyoEventBody, KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC, parseCampaignOrderPaidPayload, safeKlaviyoApiError } from "./klaviyo-event.ts";

const payload = {
  email: "qa@retrocrewco.testmail.dev",
  customerName: "Integration Test",
  orderNumber: "TEST-1",
  orderId: "test-order-1",
  orderDate: "2026-10-30T10:00:00.000Z",
  campaignName: "Black Friday",
  ticketsEarned: 2,
  totalTickets: 2,
  ticketNumbers: ["UVT-100000", "UVT-100001"],
  firstTicket: "UVT-100000",
  lastTicket: "UVT-100001",
  ticketRange: "UVT-100000 - UVT-100001",
  luckyDrawDate: "December 1, 2026",
  isTest: true,
};

test("Campaign Order Paid event contains the required customer, order, ticket, and draw data", () => {
  const body = buildKlaviyoEventBody(
    KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC,
    "campaign-order-paid:test-order-1",
    payload,
  );
  const attributes = body.data.attributes;

  assert.equal(attributes.metric.data.attributes.name, "Campaign Order Paid");
  assert.equal(attributes.profile.data.attributes.email, payload.email);
  assert.equal(attributes.properties.customer_email, payload.email);
  assert.equal(attributes.properties.order_id, payload.orderId);
  assert.equal(attributes.properties.ticket_numbers, payload.ticketNumbers.join(", "));
  assert.equal(attributes.properties.ticket_count, 2);
  assert.equal(attributes.properties.lucky_draw_date, payload.luckyDrawDate);
  assert.equal(attributes.unique_id, "campaign-order-paid:test-order-1");
});

test("payload validation requires explicit ticket numbers", () => {
  assert.deepEqual(parseCampaignOrderPaidPayload(payload), payload);
  assert.equal(parseCampaignOrderPaidPayload({ ...payload, ticketNumbers: undefined }), null);
});

test("Klaviyo diagnostics redact API keys and customer email", () => {
  const error = safeKlaviyoApiError(
    400,
    JSON.stringify({
      errors: [{ code: "invalid", title: "Invalid qa@retrocrewco.com pk_secret123" }],
    }),
  );

  assert.equal(error.includes("qa@retrocrewco.com"), false);
  assert.equal(error.includes("pk_secret123"), false);
  assert.match(error, /HTTP 400/);
});
