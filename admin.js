const loginForm = document.querySelector("#admin-login");
const adminApp = document.querySelector("#admin-app");
const logoutButton = document.querySelector("#admin-logout");
const loginError = document.querySelector("#admin-error");
const directForm = document.querySelector("#direct-book");
const directError = document.querySelector("#direct-error");
const adminCalTitle = document.querySelector("#admin-cal-title");
const adminCalGrid = document.querySelector("#admin-cal-grid");
const adminSlots = document.querySelector("#admin-slots");
const adminSummary = document.querySelector("#admin-summary");
const orderList = document.querySelector("#order-list");
const statsRow = document.querySelector("#admin-stats");

const {
  todayStart,
  dateKey,
  parseKey,
  formatClock,
  daySlots,
  rangeLabel,
  list,
  add,
  update,
} = ArenaBookings;

let viewMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
let selectedDate = null;
let selectedSlots = [];
let filter = "active";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showDesk(isOpen) {
  loginForm.hidden = isOpen;
  adminApp.hidden = !isOpen;
  logoutButton.hidden = !isOpen;
  if (isOpen) {
    renderCalendar();
    renderSlots();
    renderOrders();
  }
}

function selectedHours() {
  return selectedSlots.map((id) => Number(id.slice(0, 2))).sort((left, right) => left - right);
}

function renderCalendar() {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxMonth = new Date(todayStart.getFullYear(), todayStart.getMonth() + 2, 1);

  adminCalTitle.textContent = viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  document.querySelector('#admin-calendar [data-dir="prev"]').disabled = viewMonth <= new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  document.querySelector('#admin-calendar [data-dir="next"]').disabled = viewMonth >= maxMonth;
  adminCalGrid.innerHTML = "";

  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ date: new Date(year, month, index - firstWeekday + 1), outside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), outside: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, cells.length - (firstWeekday + daysInMonth) + 1), outside: true });
  }

  cells.forEach(({ date, outside }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cal-day";
    const key = dateKey(date);
    const past = date < todayStart;
    const slots = outside || past ? [] : daySlots(date);
    const openCount = slots.filter((slot) => slot.open).length;
    if (outside) button.classList.add("outside");
    if (past || outside) button.disabled = true;
    if (!outside && !past && openCount === 0) button.classList.add("full");
    if (!outside && !past && openCount > 0 && openCount <= 4) button.classList.add("few");
    if (selectedDate === key) button.classList.add("selected");
    button.innerHTML = `<strong>${date.getDate()}</strong>${outside || past ? "" : `<small>${openCount === 0 ? "Full" : `${openCount} open`}</small>`}`;
    if (!button.disabled) {
      button.addEventListener("click", () => {
        selectedDate = key;
        selectedSlots = [];
        renderCalendar();
        renderSlots();
      });
    }
    adminCalGrid.append(button);
  });
}

function renderSlots() {
  adminSlots.innerHTML = "";
  if (!selectedDate) {
    adminSummary.textContent = "No hour selected yet.";
    return;
  }

  const date = parseKey(selectedDate);
  const slots = daySlots(date);
  const heading = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  ["Morning", "Afternoon", "Evening"].forEach((period) => {
    const group = document.createElement("div");
    group.className = "slot-group";
    group.innerHTML = `<p>${period}</p>`;
    const row = document.createElement("div");
    row.className = "slot-row";
    slots.filter((slot) => slot.period === period).forEach((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-btn";
      button.disabled = !slot.open;
      if (selectedSlots.includes(slot.id)) button.classList.add("picked");
      const status = slot.past ? "Passed" : slot.booked ? "Booked" : "Open";
      button.innerHTML = `<strong>${slot.label}</strong><small>${status}</small>`;
      if (slot.open) {
        button.addEventListener("click", () => toggleSlot(Number(slot.id.slice(0, 2))));
      }
      row.append(button);
    });
    group.append(row);
    adminSlots.append(group);
  });

  const hours = selectedHours();
  adminSummary.textContent = hours.length
    ? `${heading} · ${rangeLabel(selectedSlots)} · ${hours.length} hour${hours.length > 1 ? "s" : ""}`
    : `${heading} · tap the exact open hour`;
}

function toggleSlot(hour) {
  const hours = selectedHours();
  const id = `${String(hour).padStart(2, "0")}:00`;
  if (hours.length === 1 && hours[0] === hour) {
    selectedSlots = [];
  } else if (!hours.length) {
    selectedSlots = [id];
  } else if (hours.includes(hour)) {
    const remaining = hours.filter((item) => item !== hour && (hour === hours[0] || hour === hours[hours.length - 1] || item <= hour));
    selectedSlots = remaining.map((item) => `${String(item).padStart(2, "0")}:00`);
  } else if ((hour === hours[0] - 1 || hour === hours[hours.length - 1] + 1) && hours.length < 3) {
    selectedSlots = [...selectedSlots, id];
  } else {
    selectedSlots = [id];
  }
  renderSlots();
}

function renderStats(orders) {
  const active = orders.filter((order) => order.status !== "cancelled");
  const todayKey = dateKey(todayStart);
  const cards = [
    ["Active", active.length],
    ["Inquiries", orders.filter((order) => order.status === "inquiry").length],
    ["Confirmed", orders.filter((order) => order.status === "confirmed").length],
    ["Today", active.filter((order) => order.date === todayKey).length],
  ];
  statsRow.innerHTML = cards.map(([label, count]) => `<div><strong>${count}</strong><span>${label}</span></div>`).join("");
}

function renderOrders() {
  const orders = list().slice().sort((left, right) => {
    if (left.date === right.date) return right.createdAt.localeCompare(left.createdAt);
    return right.date.localeCompare(left.date);
  });
  renderStats(orders);
  const visible = orders.filter((order) => {
    if (filter === "active") return order.status !== "cancelled";
    return order.status === filter;
  });

  if (!visible.length) {
    orderList.innerHTML = `<p class="order-empty">No ${filter === "active" ? "active orders" : filter} yet.</p>`;
    return;
  }

  orderList.innerHTML = visible.map((order) => {
    const when = parseKey(order.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const actions = [];
    if (order.status === "inquiry") {
      actions.push(`<button type="button" data-action="confirm" data-id="${order.id}">Confirm</button>`);
    }
    if (order.status !== "cancelled") {
      actions.push(`<button type="button" data-action="cancel" data-id="${order.id}">Cancel slot</button>`);
      actions.push(`<button type="button" data-action="pay" data-id="${order.id}">${order.payment === "paid" ? "Mark unpaid" : "Mark advance paid"}</button>`);
    }
    if (order.status === "cancelled") {
      actions.push(`<button type="button" data-action="restore" data-id="${order.id}">Restore</button>`);
    }
    return `
      <article class="order-card">
        <div class="order-top">
          <strong>${escapeHtml(order.id)}</strong>
          <span class="order-status is-${order.status}">${order.status}</span>
        </div>
        <h3>${escapeHtml(when)} · ${escapeHtml(order.timeLabel)}</h3>
        <p>${escapeHtml(order.name)} · ${escapeHtml(order.phone || "No phone")} · ${escapeHtml(order.sport)}</p>
        <p class="order-meta">${order.hours} hour${order.hours > 1 ? "s" : ""} · ${escapeHtml(order.advance)} · ${order.payment === "paid" ? "Advance paid" : "Advance pending"} · ${order.source === "admin" ? "Staff booking" : "Website inquiry"}</p>
        ${order.message ? `<p class="order-note">${escapeHtml(order.message)}</p>` : ""}
        <div class="order-actions">${actions.join("")}</div>
      </article>
    `;
  }).join("");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const pin = document.querySelector("#admin-pin").value;
  if (!ArenaBookings.login(pin)) {
    loginError.textContent = "That PIN is not recognised.";
    return;
  }
  loginError.textContent = "";
  loginForm.reset();
  showDesk(true);
});

logoutButton.addEventListener("click", () => {
  ArenaBookings.logout();
  showDesk(false);
});

document.querySelectorAll("#admin-calendar .cal-nav").forEach((button) => {
  button.addEventListener("click", () => {
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + (button.dataset.dir === "next" ? 1 : -1), 1);
    renderCalendar();
  });
});

document.querySelector("#admin-filters").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  filter = button.dataset.filter;
  document.querySelectorAll("#admin-filters button").forEach((item) => {
    item.classList.toggle("is-active", item === button);
  });
  renderOrders();
});

orderList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { action, id } = button.dataset;
  let result = { ok: true };
  if (action === "confirm") result = update(id, { status: "confirmed" });
  if (action === "cancel") result = update(id, { status: "cancelled" });
  if (action === "restore") result = update(id, { status: "confirmed" });
  if (action === "pay") {
    const order = list().find((item) => item.id === id);
    result = update(id, { payment: order.payment === "paid" ? "unpaid" : "paid" });
  }
  directError.textContent = result.ok ? "" : result.error;
  directError.classList.toggle("is-error", !result.ok);
  renderCalendar();
  renderSlots();
  renderOrders();
});

directForm.addEventListener("submit", (event) => {
  event.preventDefault();
  directError.classList.remove("is-error");
  if (!selectedDate || !selectedSlots.length) {
    directError.textContent = "Choose the exact open hour first.";
    directError.classList.add("is-error");
    return;
  }
  const data = new FormData(directForm);
  const hours = selectedSlots.length;
  const result = add({
    date: selectedDate,
    slots: selectedSlots,
    timeLabel: rangeLabel(selectedSlots),
    sport: data.get("sport"),
    name: data.get("name"),
    phone: data.get("phone"),
    players: data.get("players"),
    message: "Booked by staff for this exact slot.",
    advance: `₹${hours * 200}`,
    payment: data.get("paid") ? "paid" : "unpaid",
    status: "confirmed",
    source: "admin",
  });
  if (!result.ok) {
    directError.textContent = result.error;
    directError.classList.add("is-error");
    return;
  }
  directError.textContent = `${result.order.id} confirmed for ${result.order.timeLabel}.`;
  selectedSlots = [];
  directForm.reset();
  renderCalendar();
  renderSlots();
  renderOrders();
});

window.addEventListener("storage", () => {
  if (!ArenaBookings.isAuthed()) return;
  renderCalendar();
  renderSlots();
  renderOrders();
});

showDesk(ArenaBookings.isAuthed());
