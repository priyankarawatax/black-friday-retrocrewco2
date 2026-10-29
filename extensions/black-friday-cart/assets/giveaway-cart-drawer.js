(() => {
  let refreshTimer = null;
  let refreshing = false;

  function root() {
    return document.querySelector("[data-black-friday-drawer-root]");
  }

  function configFor(element) {
    try {
      return JSON.parse(element?.dataset.config || "null");
    } catch {
      return null;
    }
  }

  function active(config) {
    if (!config?.enabled || !config.startAt || !config.endAt) return false;
    const now = Date.now();
    const start = Date.parse(config.startAt);
    const end = Date.parse(config.endAt);
    return Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
  }

  function messagesFor(config, locale) {
    const english = config?.messages?.en || {};
    const french = config?.messages?.fr || {};
    if (!String(locale).toLowerCase().startsWith("fr")) return english;
    return {
      entry: french.entry || english.entry,
      tickets: french.tickets || english.tickets,
      motivation: french.motivation || english.motivation,
    };
  }

  function paragraph(className, text) {
    const element = document.createElement("p");
    element.className = className;
    element.textContent = text;
    return element;
  }

  function removeWidget() {
    document.querySelector("[data-black-friday-drawer-widget]")?.remove();
  }

  function render(cart) {
    const settings = root();
    const config = configFor(settings);
    const footer = document.querySelector("#CartDrawer > .drawer__inner > .drawer__footer");

    if (!settings || !footer || !active(config) || Number(cart?.item_count || 0) < 1) {
      removeWidget();
      return;
    }

    const messages = messagesFor(config, settings.dataset.locale);
    const tickets = Math.max(
      0,
      Math.floor(Number(cart?.items_subtotal_price || 0) / 100),
    );
    const ticketTemplate = messages.tickets || settings.dataset.fallbackTickets || "";
    const ticketMessage = ticketTemplate
      .replaceAll("{tickets}", String(tickets))
      .replaceAll("{total-tickets}", String(tickets))
      .replaceAll("{ticket}", String(tickets));
    const widget = document.createElement("div");
    widget.className = "black-friday-cart-drawer";
    widget.dataset.blackFridayDrawerWidget = "";
    widget.setAttribute("role", "status");
    widget.setAttribute("aria-live", "polite");

    ["--bf-drawer-background", "--bf-drawer-text", "--bf-drawer-accent", "--bf-drawer-radius"].forEach(
      (property) => widget.style.setProperty(property, settings.style.getPropertyValue(property)),
    );

    widget.append(
      paragraph(
        "black-friday-cart-drawer__entry",
        messages.entry || settings.dataset.fallbackEntry || "",
      ),
      paragraph("black-friday-cart-drawer__tickets", ticketMessage),
      paragraph(
        "black-friday-cart-drawer__motivation",
        messages.motivation || settings.dataset.fallbackMotivation || "",
      ),
    );

    removeWidget();
    const subtotal = footer.querySelector(":scope > .cart-drawer__footer");
    footer.insertBefore(widget, subtotal || footer.firstChild);
  }

  async function refresh() {
    if (refreshing || !root()) return;
    refreshing = true;
    try {
      const response = await fetch(`${window.Shopify.routes.root}cart.js`, {
        headers: { Accept: "application/json" },
      });
      if (response.ok) render(await response.json());
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh(delay = 50) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  const observer = new MutationObserver(() => {
    const footer = document.querySelector("#CartDrawer > .drawer__inner > .drawer__footer");
    const widget = document.querySelector("[data-black-friday-drawer-widget]");
    if (footer && !widget) scheduleRefresh();
  });

  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleRefresh(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
