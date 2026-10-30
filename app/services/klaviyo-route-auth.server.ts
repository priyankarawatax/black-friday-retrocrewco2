import { timingSafeEqual } from "node:crypto";

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

export function isKlaviyoRouteConfigured() {
  return Boolean(configuredCronSecret());
}

export function isAuthorizedKlaviyoRequest(request: Request) {
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
