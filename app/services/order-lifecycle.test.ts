import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's test runner resolves the TypeScript source directly.
import { preservesExistingGiveawayTickets } from "./order-lifecycle.ts";

test("cancel, refund, and return topics preserve existing tickets", () => {
  assert.equal(preservesExistingGiveawayTickets("ORDERS_CANCELLED"), true);
  assert.equal(preservesExistingGiveawayTickets("orders/cancelled"), true);
  assert.equal(preservesExistingGiveawayTickets("REFUNDS_CREATE"), true);
  assert.equal(preservesExistingGiveawayTickets("refunds/create"), true);
  assert.equal(preservesExistingGiveawayTickets("RETURNS_UPDATE"), true);
  assert.equal(preservesExistingGiveawayTickets("returns/close"), true);
});

test("paid and fulfilled topics continue through ticket processing", () => {
  assert.equal(preservesExistingGiveawayTickets("ORDERS_PAID"), false);
  assert.equal(preservesExistingGiveawayTickets("orders/fulfilled"), false);
});
