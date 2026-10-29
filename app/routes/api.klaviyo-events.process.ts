import { timingSafeEqual } from "node:crypto";

import type { ActionFunctionArgs } from "react-router";

import { processKlaviyoOutbox } from "../services/klaviyo.server";

function configuredCronSecret() {
  const value = process.env.KLAVIYO_CRON_SECRET?.trim() ?? "";
  if (!value || /dummy|replace|your[_-]?secret/i.test(value)) return null;
  return value;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: Request) {
  const configuredSecret = configuredCronSecret();
  if (!configuredSecret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const bearerSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const headerSecret = request.headers.get("x-klaviyo-cron-secret")?.trim() ?? "";
  const suppliedSecret = bearerSecret || headerSecret;
  return Boolean(suppliedSecret) && safeEqual(suppliedSecret, configuredSecret);
}

export const loader = async () =>
  Response.json({ error: "Method not allowed." }, { status: 405 });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }
  if (!configuredCronSecret()) {
    return Response.json({ error: "Klaviyo processor is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return Response.json(await processKlaviyoOutbox({ limit: 25 }));
};
