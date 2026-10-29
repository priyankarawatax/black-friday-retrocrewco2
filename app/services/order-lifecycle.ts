const TICKET_PRESERVING_TOPIC_PREFIXES = ["REFUNDS_", "RETURNS_"];

export function preservesExistingGiveawayTickets(topic: string) {
  const normalized = topic.trim().toUpperCase().replaceAll("/", "_");
  return (
    normalized === "ORDERS_CANCELLED" ||
    TICKET_PRESERVING_TOPIC_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    )
  );
}
