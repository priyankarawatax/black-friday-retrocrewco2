(() => {
  const blocks = document.querySelectorAll("[data-black-friday-cart]");

  function messageSet(config, locale) {
    const english = config?.messages?.en || {};
    const french = config?.messages?.fr || {};
    if (!String(locale).toLowerCase().startsWith("fr")) return english;
    return {
      entry: french.entry || english.entry,
      tickets: french.tickets || english.tickets,
      motivation: french.motivation || english.motivation,
    };
  }

  function active(config) {
    if (!config?.enabled || !config.startAt || !config.endAt) return false;
    const now = Date.now();
    const start = Date.parse(config.startAt);
    const end = Date.parse(config.endAt);
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
  }

  function render(block, cart) {
    const configElement = block.querySelector("[data-black-friday-config]");
    let config = null;
    try {
      config = JSON.parse(configElement?.textContent || "null");
    } catch {
      config = null;
    }

    if (!active(config)) {
      block.hidden = true;
      return;
    }

    const messages = messageSet(config, block.dataset.locale);
    const tickets = Math.max(
      0,
      Math.floor(Number(cart?.items_subtotal_price || 0) / 100),
    );
    const ticketTemplate = messages.tickets || block.dataset.fallbackTickets || "";
    const ticketMessage = ticketTemplate
      .replaceAll("{tickets}", String(tickets))
      .replaceAll("{total-tickets}", String(tickets))
      .replaceAll("{ticket}", String(tickets));

    block.querySelector("[data-black-friday-entry]").textContent =
      messages.entry || block.dataset.fallbackEntry || "";
    block.querySelector("[data-black-friday-tickets]").textContent = ticketMessage;
    block.querySelector("[data-black-friday-motivation]").textContent =
      messages.motivation || block.dataset.fallbackMotivation || "";
    block.hidden = false;
  }

  async function refresh() {
    try {
      const response = await fetch(`${window.Shopify.routes.root}cart.js`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const cart = await response.json();
      blocks.forEach((block) => render(block, cart));
    } catch {
      blocks.forEach((block) => {
        block.hidden = true;
      });
    }
  }

  if (blocks.length) {
    refresh();
    document.addEventListener("cart:refresh", refresh);
    document.addEventListener("cart:updated", refresh);
  }
})();
