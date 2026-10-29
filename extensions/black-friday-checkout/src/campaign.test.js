import assert from "node:assert/strict";
import test from "node:test";

import {
  getTicketCountFromTotal,
  isCampaignActive,
  parseCampaignConfig,
  renderThankYouMessage,
} from "./campaign.js";

const activeConfig = {
  enabled: true,
  startAt: "2026-10-01T00:00:00.000Z",
  endAt: "2026-10-31T23:59:59.999Z",
};
const now = Date.parse("2026-10-21T12:00:00.000Z");

test("active campaign is visible", () => {
  assert.equal(isCampaignActive(activeConfig, now), true);
});

test("disabled campaign is hidden", () => {
  assert.equal(
    isCampaignActive({ ...activeConfig, enabled: false }, now),
    false,
  );
});

test("future campaign is hidden", () => {
  assert.equal(
    isCampaignActive(
      { ...activeConfig, startAt: "2026-11-01T00:00:00.000Z" },
      now,
    ),
    false,
  );
});

test("expired campaign is hidden", () => {
  assert.equal(
    isCampaignActive(
      { ...activeConfig, endAt: "2026-10-20T23:59:59.999Z" },
      now,
    ),
    false,
  );
});

test("thank-you ticket placeholder maps to the Shopify cart total", () => {
  assert.equal(
    renderThankYouMessage("You earn total {tickets-num} tickets.", 47),
    "You earn total 47 tickets.",
  );
  assert.equal(
    renderThankYouMessage("Legacy total: {tickets}.", 47),
    "Legacy total: 47.",
  );
});

test("missing or malformed settings are handled safely", () => {
  assert.equal(parseCampaignConfig("not-json"), null);
  assert.equal(isCampaignActive(parseCampaignConfig("not-json"), now), false);
});

test("order total determines the whole ticket count", () => {
  assert.equal(getTicketCountFromTotal(200), 200);
  assert.equal(getTicketCountFromTotal("200.75"), 200);
  assert.equal(getTicketCountFromTotal(0), 0);
  assert.equal(getTicketCountFromTotal(-10), 0);
  assert.equal(getTicketCountFromTotal(undefined), 0);
});
