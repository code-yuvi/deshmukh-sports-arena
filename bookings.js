const ArenaBookings = (() => {
  const ORDERS_KEY = "dsa-orders";
  const HELD_KEY = "dsa-held-slots";
  const AUTH_KEY = "dsa-admin-auth";
  const PIN = "arena3751";
  const SLOT_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function dateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function parseKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatClock(hour) {
    const suffix = hour >= 12 && hour < 24 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:00 ${suffix}`;
  }

  function slotMeta(hour) {
    const next = hour + 1;
    const period = hour < 12 ? "Morning" : hour < 16 ? "Afternoon" : "Evening";
    const price = hour < 12 ? "₹799" : hour < 16 ? "₹899" : "₹1,199";
    return {
      id: `${String(hour).padStart(2, "0")}:00`,
      label: `${formatClock(hour)} – ${formatClock(next)}`,
      period,
      price,
    };
  }

  function rangeLabel(slots) {
    const hours = slots.map((id) => Number(id.slice(0, 2))).sort((left, right) => left - right);
    if (!hours.length) return "";
    return `${formatClock(hours[0])} – ${formatClock(hours[hours.length - 1] + 1)}`;
  }

  function load() {
    try {
      const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      return Array.isArray(orders) ? orders : [];
    } catch (error) {
      return [];
    }
  }

  function save(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }

  function isSlotTaken(token, ignoreId) {
    const [date, slotId] = token.split("|");
    return load().some((order) => {
      if (order.status === "cancelled") return false;
      if (ignoreId && order.id === ignoreId) return false;
      return order.date === date && order.slots.includes(slotId);
    });
  }

  function isPastSlot(date, hour) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0) <= now;
  }

  function daySlots(date) {
    const key = dateKey(date);
    return SLOT_HOURS.map((hour) => {
      const meta = slotMeta(hour);
      const past = isPastSlot(date, hour);
      const booked = !past && isSlotTaken(`${key}|${meta.id}`);
      return { ...meta, past, booked, open: !past && !booked };
    });
  }

  function migrateHeldSlots() {
    if (localStorage.getItem("dsa-held-migrated")) return;
    const orders = load();
    let held = [];
    try {
      held = JSON.parse(localStorage.getItem(HELD_KEY) || "[]");
    } catch (error) {
      held = [];
    }
    const grouped = new Map();
    held.forEach((token) => {
      const [date, slotId] = String(token).split("|");
      if (!date || !slotId) return;
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(slotId);
    });
    grouped.forEach((slots, date) => {
      const unique = [...new Set(slots)].sort();
      const taken = unique.some((slotId) => isSlotTaken(`${date}|${slotId}`));
      if (taken) return;
      orders.push({
        id: `DSA-H${date.split("-").join("")}${unique[0].slice(0, 2)}`,
        number: 0,
        createdAt: new Date().toISOString(),
        date,
        slots: unique,
        timeLabel: rangeLabel(unique),
        hours: unique.length,
        sport: "Cricket",
        name: "Earlier inquiry",
        phone: "",
        players: "",
        message: "Imported from a previous booking on this browser.",
        advance: `₹${unique.length * 200}`,
        payment: "unpaid",
        status: "inquiry",
        source: "website",
      });
    });
    save(orders);
    localStorage.setItem("dsa-held-migrated", "1");
  }

  function add(draft) {
    const orders = load();
    const slots = [...draft.slots].sort();
    const clash = slots.find((slotId) => isSlotTaken(`${draft.date}|${slotId}`));
    if (clash) {
      return { ok: false, error: `${formatClock(Number(clash.slice(0, 2)))} is already booked.` };
    }
    const number = orders.reduce((max, order) => Math.max(max, order.number || 0), 1000) + 1;
    const order = {
      id: `DSA-${number}`,
      number,
      createdAt: new Date().toISOString(),
      date: draft.date,
      slots,
      timeLabel: draft.timeLabel || rangeLabel(slots),
      hours: slots.length,
      sport: draft.sport,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      players: draft.players || "",
      message: (draft.message || "").trim(),
      advance: draft.advance || `₹${slots.length * 200}`,
      payment: draft.payment || "unpaid",
      status: draft.status || "inquiry",
      source: draft.source || "website",
    };
    orders.push(order);
    save(orders);
    return { ok: true, order };
  }

  function update(id, patch) {
    const orders = load();
    const order = orders.find((item) => item.id === id);
    if (!order) return { ok: false, error: "Order not found." };
    if (patch.status && patch.status !== "cancelled") {
      const clash = order.slots.find((slotId) => isSlotTaken(`${order.date}|${slotId}`, id));
      if (clash) return { ok: false, error: "That time is already taken by another order." };
    }
    Object.assign(order, patch);
    save(orders);
    return { ok: true, order };
  }

  migrateHeldSlots();

  return {
    SLOT_HOURS,
    todayStart,
    dateKey,
    parseKey,
    formatClock,
    slotMeta,
    rangeLabel,
    daySlots,
    isSlotTaken,
    list: load,
    add,
    update,
    login(pin) {
      if (String(pin).trim() !== PIN) return false;
      localStorage.setItem(AUTH_KEY, "1");
      return true;
    },
    logout() {
      localStorage.removeItem(AUTH_KEY);
    },
    isAuthed() {
      return localStorage.getItem(AUTH_KEY) === "1";
    },
  };
})();
