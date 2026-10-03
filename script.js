const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");
const bookingForm = document.querySelector("#booking-form");
const calTitle = document.querySelector("#cal-title");
const calGrid = document.querySelector("#cal-grid");
const slotHeading = document.querySelector("#slot-heading");
const slotEmpty = document.querySelector("#slot-empty");
const slotGroups = document.querySelector("#slot-groups");
const pickedSummary = document.querySelector("#picked-summary");
const dateField = document.querySelector("#booking-date");
const timeField = document.querySelector("#booking-time");

const SLOT_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const HELD_KEY = "dsa-held-slots";
const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
let viewMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
let selectedDate = null;
let selectedSlot = null;

menuButton.addEventListener("click", () => {
  const isOpen = navigation.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

navigation.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

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

function heldSlots() {
  try {
    return new Set(JSON.parse(localStorage.getItem(HELD_KEY) || "[]"));
  } catch (error) {
    return new Set();
  }
}

function isPastSlot(date, hour) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0) <= now;
}

function isBooked(key, slotId) {
  if (heldSlots().has(`${key}|${slotId}`)) return true;
  let hash = 0;
  const seed = `${key}|${slotId}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  const date = parseKey(key);
  const hour = Number(slotId.slice(0, 2));
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const evening = hour >= 16;
  const chance = evening ? (weekend ? 48 : 30) : weekend ? 22 : 12;
  return hash % 100 < chance;
}

function daySlots(date) {
  const key = dateKey(date);
  return SLOT_HOURS.map((hour) => {
    const meta = slotMeta(hour);
    const past = isPastSlot(date, hour);
    const booked = !past && isBooked(key, meta.id);
    return { ...meta, past, booked, open: !past && !booked };
  });
}

function renderCalendar(direction) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const maxMonth = new Date(todayStart.getFullYear(), todayStart.getMonth() + 2, 1);

  calTitle.textContent = viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  document.querySelector('[data-dir="prev"]').disabled = viewMonth <= new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  document.querySelector('[data-dir="next"]').disabled = viewMonth >= maxMonth;

  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    const date = new Date(year, month, index - firstWeekday + 1);
    cells.push({ date, outside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, cells.length - (firstWeekday + daysInMonth) + 1);
    cells.push({ date, outside: true });
  }

  calGrid.innerHTML = "";
  calGrid.classList.remove("slide-next", "slide-prev");
  if (direction) {
    void calGrid.offsetWidth;
    calGrid.classList.add(direction === "next" ? "slide-next" : "slide-prev");
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
    if (!outside && date.getTime() === todayStart.getTime()) button.classList.add("today");
    if (!outside && !past && openCount === 0) button.classList.add("full");
    if (!outside && !past && openCount > 0 && openCount <= 4) button.classList.add("few");
    if (selectedDate === key) button.classList.add("selected");
    button.setAttribute("aria-pressed", String(selectedDate === key));
    button.innerHTML = `<strong>${date.getDate()}</strong>${outside || past ? "" : `<small>${openCount === 0 ? "Full" : `${openCount} open`}</small>`}`;

    if (!button.disabled) {
      button.addEventListener("click", () => {
        selectedDate = key;
        selectedSlot = null;
        dateField.value = "";
        timeField.value = "";
        renderCalendar();
        renderSlots();
      });
    }
    calGrid.append(button);
  });
}

function renderSlots() {
  slotGroups.innerHTML = "";
  if (!selectedDate) {
    slotHeading.textContent = "Select a date";
    slotEmpty.hidden = false;
    pickedSummary.textContent = "No timing selected yet.";
    return;
  }

  const date = parseKey(selectedDate);
  const slots = daySlots(date);
  slotHeading.textContent = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  slotEmpty.hidden = true;

  ["Morning", "Afternoon", "Evening"].forEach((period) => {
    const groupSlots = slots.filter((slot) => slot.period === period);
    const group = document.createElement("div");
    group.className = "slot-group";
    group.innerHTML = `<p>${period}</p>`;
    const row = document.createElement("div");
    row.className = "slot-row";

    groupSlots.forEach((slot, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-btn";
      button.style.animationDelay = `${index * 35}ms`;
      button.disabled = !slot.open;
      if (selectedSlot === slot.id) button.classList.add("picked");
      const status = slot.past ? "Passed" : slot.booked ? "Booked" : slot.price;
      button.innerHTML = `<strong>${slot.label}</strong><small>${status}</small>`;
      if (slot.open) {
        button.addEventListener("click", () => {
          selectedSlot = slot.id;
          dateField.value = selectedDate;
          timeField.value = `${slot.label} (${slot.period}, ${slot.price}/hour)`;
          renderSlots();
        });
      }
      row.append(button);
    });

    group.append(row);
    slotGroups.append(group);
  });

  pickedSummary.textContent = timeField.value
    ? `${slotHeading.textContent} · ${timeField.value}`
    : `${slotHeading.textContent} · choose an open timing`;
}

document.querySelectorAll(".cal-nav").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.dir;
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + (direction === "next" ? 1 : -1), 1);
    renderCalendar(direction);
  });
});

renderCalendar();
renderSlots();

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const successMessage = bookingForm.querySelector(".form-success");
  if (!dateField.value || !timeField.value) {
    successMessage.textContent = "Choose an open date and timing on the calendar first.";
    successMessage.classList.add("show", "is-error");
    successMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  successMessage.classList.remove("is-error");

  const formData = new FormData(bookingForm);
  const name = formData.get("name");
  const submitButton = bookingForm.querySelector('button[type="submit"]');
  const whatsappNumber = "919730803751";
  const emailAddress = "yuvrajd568@gmail.com";
  const message = [
    "New booking inquiry - Deshmukh Sports Arena",
    "",
    `Name: ${name}`,
    `Phone: ${formData.get("phone")}`,
    `Preferred date: ${formData.get("date")}`,
    `Preferred time: ${formData.get("time")}`,
    `Players: ${formData.get("players")}`,
    `Message: ${formData.get("message") || "None"}`,
  ].join("\n");

  // Open WhatsApp directly from the user's click to avoid popup blocking.
  window.open(
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );

  submitButton.disabled = true;
  submitButton.textContent = "Sending email...";
  successMessage.classList.remove("show");

  const emailData = Object.fromEntries(formData.entries());
  emailData._subject = `New turf booking inquiry from ${name}`;
  emailData._template = "table";
  emailData._captcha = "false";

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${emailAddress}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      throw new Error("Email service did not accept the request.");
    }

    successMessage.textContent = `Thanks, ${name}! WhatsApp has opened and your inquiry was emailed successfully.`;
    const held = heldSlots();
    held.add(`${dateField.value}|${selectedSlot}`);
    localStorage.setItem(HELD_KEY, JSON.stringify([...held]));
    selectedDate = null;
    selectedSlot = null;
    bookingForm.reset();
    renderCalendar();
    renderSlots();
  } catch (error) {
    const emailSubject = encodeURIComponent(`New turf booking inquiry from ${name}`);
    const emailBody = encodeURIComponent(message);
    successMessage.innerHTML = `WhatsApp has opened, but automatic email could not be confirmed. <a href="mailto:${emailAddress}?subject=${emailSubject}&body=${emailBody}">Send the email manually</a>.`;
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = "Send booking inquiry <span>→</span>";
    successMessage.classList.add("show");
    successMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
