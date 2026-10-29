export function parseCampaignConfig(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const config = JSON.parse(value);
    return config && typeof config === "object" ? config : null;
  } catch {
    return null;
  }
}

export function isCampaignActive(config, now = Date.now()) {
  if (!config?.enabled || !config.startAt || !config.endAt) return false;

  const start = Date.parse(config.startAt);
  const end = Date.parse(config.endAt);
  return (
    Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end
  );
}

export function isFrenchLanguage(languageCode) {
  return String(languageCode ?? "").toLowerCase().split("-")[0] === "fr";
}

export function renderThankYouMessage(template, totalTickets) {
  return String(template ?? "")
    .replaceAll("{tickets-num}", String(totalTickets))
    .replaceAll("{tickets}", String(totalTickets));
}

export function getTicketCountFromTotal(amount) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) && numericAmount > 0
    ? Math.floor(numericAmount)
    : 0;
}
