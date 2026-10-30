import type { ActionFunctionArgs } from "react-router";

import { orderFromWebhook, persistGiveawayOrder } from "../services/giveaway-order.server";
import { processKlaviyoOutbox } from "../services/klaviyo.server";
import { preservesExistingGiveawayTickets } from "../services/order-lifecycle";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  if (preservesExistingGiveawayTickets(topic)) {
    console.log(`Preserved existing giveaway tickets for ${topic} on ${shop}.`);
    return new Response();
  }

  const financialStatus = (payload as { financial_status?: string }).financial_status;

  if (financialStatus && financialStatus !== "paid") {
    console.log(`Ignored unpaid ${topic} order for ${shop}.`);
    return new Response();
  }

  const order = orderFromWebhook(payload);

  if (!order) {
    console.error(`Ignored invalid ${topic} payload for ${shop}.`);
    return new Response();
  }

  const result = await persistGiveawayOrder(shop, order, {
    queueKlaviyoEvent: true,
  });
  if (result.status !== "ineligible" && result.klaviyoEventUniqueId) {
    const klaviyo = await processKlaviyoOutbox({
      uniqueId: result.klaviyoEventUniqueId,
    });
    if (!klaviyo.configured) {
      console.warn("Klaviyo event queued; replace the dummy private API key to send it.");
    } else if (klaviyo.failed > 0) {
      console.error("Klaviyo event delivery failed.", {
        failed: klaviyo.failed,
        error: klaviyo.errors[0] ?? "unknown-error",
      });
    }
  }
  console.log(
    `Processed ${topic} for ${shop}, order ${order.number}: ${result.status}`,
  );

  return new Response();
};
