export const KLAVIYO_CAMPAIGN_ORDER_PAID_METRIC = "Campaign Order Paid";

export type CampaignOrderPaidPayload = {
  email: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  orderDate: string;
  campaignName: string;
  ticketsEarned: number;
  totalTickets: number;
  ticketNumbers: string[];
  firstTicket: string;
  lastTicket: string;
  ticketRange: string;
  luckyDrawDate: string;
  isTest?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCampaignOrderPaidPayload(
  value: unknown,
): CampaignOrderPaidPayload | null {
  if (!isRecord(value)) return null;
  const requiredStrings = [
    "email",
    "customerName",
    "orderNumber",
    "orderId",
    "orderDate",
    "campaignName",
    "firstTicket",
    "lastTicket",
    "ticketRange",
    "luckyDrawDate",
  ] as const;
  if (requiredStrings.some((key) => typeof value[key] !== "string")) return null;
  if (
    typeof value.ticketsEarned !== "number" ||
    typeof value.totalTickets !== "number" ||
    !Array.isArray(value.ticketNumbers) ||
    value.ticketNumbers.some((ticket) => typeof ticket !== "string")
  ) return null;
  return value as CampaignOrderPaidPayload;
}

export function buildKlaviyoEventBody(
  metricName: string,
  uniqueId: string,
  payload: CampaignOrderPaidPayload,
) {
  return {
    data: {
      type: "event",
      attributes: {
        properties: {
          customer_email: payload.email,
          order_number: payload.orderNumber,
          order_id: payload.orderId,
          campaign_name: payload.campaignName,
          customer_name: payload.customerName,
          tickets_earned: payload.ticketsEarned,
          ticket_count: payload.ticketNumbers.length,
          total_tickets: payload.totalTickets,
          ticket_numbers: payload.ticketNumbers.join(", "),
          first_ticket: payload.firstTicket,
          last_ticket: payload.lastTicket,
          ticket_range: payload.ticketRange,
          lucky_draw_date: payload.luckyDrawDate,
          is_test: payload.isTest === true,
        },
        time: payload.orderDate,
        unique_id: uniqueId,
        metric: {
          data: {
            type: "metric",
            attributes: { name: metricName },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: { email: payload.email },
          },
        },
      },
    },
  };
}

function redactSensitive(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/Klaviyo-API-Key\s+[^\s"']+/gi, "Klaviyo-API-Key [redacted]")
    .replace(/pk_[A-Za-z0-9_-]+/g, "[redacted-key]");
}

export function safeKlaviyoApiError(status: number, responseText: string) {
  let diagnostic = "";
  try {
    const body = JSON.parse(responseText) as {
      errors?: Array<{ code?: unknown; title?: unknown }>;
    };
    diagnostic = (body.errors ?? [])
      .slice(0, 3)
      .map(({ code, title }) =>
        [typeof code === "string" ? code : "", typeof title === "string" ? title : ""]
          .filter(Boolean)
          .join(":"),
      )
      .filter(Boolean)
      .join(", ");
  } catch {
    diagnostic = "unparseable-response";
  }
  return redactSensitive(
    `Klaviyo API returned HTTP ${status}${diagnostic ? ` (${diagnostic})` : ""}`,
  ).slice(0, 500);
}
