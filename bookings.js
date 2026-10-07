const ArenaBookings = (() => {
  const SLOT_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const STAFF_EMAIL = "yuvrajd568@gmail.com";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const taken = new Set();
  const listeners = new Set();

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

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function mapOrder(row) {
    return {
      id: row.id,
      code: row.order_code,
      createdAt: row.created_at,
      date: String(row.booking_date).slice(0, 10),
      slots: row.slots,
      timeLabel: row.time_label,
      hours: row.hours,
      sport: row.sport,
      name: row.customer_name,
      phone: row.phone,
      players: row.players,
      message: row.message,
      advance: row.advance,
      payment: row.payment,
      status: row.status,
      source: row.source,
    };
  }

  function errorMessage(error) {
    const message = error?.message || "The booking could not be saved.";
    return message.replace(/^.*Exception:\s*/i, "");
  }

  async function refreshTaken() {
    const from = dateKey(todayStart);
    const until = new Date(todayStart);
    until.setDate(until.getDate() + 95);
    const { data, error } = await client.rpc("taken_slots", {
      from_date: from,
      to_date: dateKey(until),
    });
    if (error) return;
    taken.clear();
    (data || []).forEach((row) => {
      taken.add(`${String(row.booking_date).slice(0, 10)}|${row.slot_id}`);
    });
  }

  function isSlotTaken(token) {
    return taken.has(token);
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

  async function add(draft) {
    const slots = [...draft.slots].sort();
    const { data, error } = await client.rpc("create_booking", {
      p_date: draft.date,
      p_slots: slots,
      p_time_label: draft.timeLabel || rangeLabel(slots),
      p_sport: draft.sport,
      p_name: draft.name,
      p_phone: draft.phone,
      p_players: draft.players || "",
      p_message: draft.message || "",
      p_advance: draft.advance || `₹${slots.length * 200}`,
      p_payment: draft.payment || "unpaid",
      p_status: draft.status || "inquiry",
      p_source: draft.source || "website",
    });
    if (error) return { ok: false, error: errorMessage(error) };
    const row = Array.isArray(data) ? data[0] : data;
    await refreshTaken();
    notify();
    return { ok: true, order: mapOrder(row) };
  }

  async function update(id, patch) {
    const { data, error } = await client.rpc("update_booking", {
      p_id: id,
      p_status: patch.status || null,
      p_payment: patch.payment || null,
    });
    if (error) return { ok: false, error: errorMessage(error) };
    const row = Array.isArray(data) ? data[0] : data;
    await refreshTaken();
    notify();
    return { ok: true, order: mapOrder(row) };
  }

  async function list() {
    const { data, error } = await client.rpc("admin_bookings");
    if (error) return [];
    return (data || []).map(mapOrder);
  }

  const ready = refreshTaken();
  setInterval(() => {
    refreshTaken().then(notify);
  }, 15000);

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
    list,
    add,
    update,
    ready,
    subscribe(listener) {
      listeners.add(listener);
    },
    async login(password) {
      const { error } = await client.auth.signInWithPassword({
        email: STAFF_EMAIL,
        password: String(password),
      });
      return !error;
    },
    async logout() {
      await client.auth.signOut();
    },
    async isAuthed() {
      const { data } = await client.auth.getSession();
      return Boolean(data.session);
    },
  };
})();
