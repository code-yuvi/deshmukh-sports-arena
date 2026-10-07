document.documentElement.classList.add("js");

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
const hoursField = document.querySelector("#booking-hours");
const advanceField = document.querySelector("#booking-advance");
const payNote = document.querySelector("#pay-note");

const { todayStart, dateKey, parseKey, formatClock, daySlots, rangeLabel } = ArenaBookings;
let viewMonth = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
const ADVANCE = { 1: 200, 2: 400, 3: 600 };
const UPI_ID = "9730803751@ybl";
const UPI_NAME = "Deshmukh Sports Arena";
const payButton = document.querySelector("#pay-advance");
const payDialog = document.querySelector("#pay-dialog");
let selectedDate = null;
let selectedSlots = [];
let preferredHours = null;

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
        selectedSlots = [];
        preferredHours = null;
        renderCalendar();
        renderSlots();
      });
    }
    calGrid.append(button);
  });
}

function selectedHours() {
  return selectedSlots.map((id) => Number(id.slice(0, 2))).sort((left, right) => left - right);
}

function openBlock(startHour, count) {
  const slots = daySlots(parseKey(selectedDate));
  const block = [];
  for (let hour = startHour; hour < startHour + count; hour += 1) {
    const slot = slots.find((item) => Number(item.id.slice(0, 2)) === hour);
    if (!slot || !slot.open) break;
    block.push(slot.id);
  }
  return block;
}

function syncSelection(note) {
  const hours = selectedHours();
  const count = hours.length;
  document.querySelectorAll(".pay-card").forEach((card) => {
    const active = Number(card.dataset.hours) === count;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", String(active));
  });

  if (!selectedDate || count === 0) {
    dateField.value = "";
    timeField.value = "";
    hoursField.value = "";
    advanceField.value = "";
    pickedSummary.textContent = selectedDate
      ? `${slotHeading.textContent} · choose 1, 2 or 3 open hours`
      : "No timing selected yet.";
    payNote.textContent = note || "Select 1, 2 or 3 back-to-back hours. Advance is ₹200 per hour.";
    payButton.textContent = "Pay advance";
    return;
  }

  const range = rangeLabel(selectedSlots);
  const advance = ADVANCE[count];
  dateField.value = selectedDate;
  timeField.value = range;
  hoursField.value = `${count} hour${count > 1 ? "s" : ""}`;
  advanceField.value = `₹${advance}`;
  pickedSummary.textContent = `${slotHeading.textContent} · ${range} · Advance ₹${advance}`;
  payNote.textContent = note || `${hoursField.value} selected. Pay ₹${advance} now with UPI, or send an inquiry and pay later.`;
  payButton.innerHTML = `Pay ₹${advance} advance <span>→</span>`;
}

function upiLink(scheme, amount, note) {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `${scheme}?${params.toString()}`;
}

function openAdvancePayment() {
  const successMessage = bookingForm.querySelector(".form-success");
  if (!dateField.value || !timeField.value) {
    successMessage.textContent = "Choose an open date and timing before paying the advance.";
    successMessage.classList.add("show", "is-error");
    return;
  }
  if (!bookingForm.reportValidity()) return;

  const amount = ADVANCE[selectedSlots.length];
  const note = `Turf advance ${dateField.value} ${timeField.value}`;
  const genericLink = upiLink("upi://pay", amount, note);
  document.querySelector("#pay-amount").textContent = `₹${amount}`;
  document.querySelector("#pay-detail").textContent = `${slotHeading.textContent} · ${timeField.value}`;
  document.querySelector("#pay-upi-id").textContent = UPI_ID;
  document.querySelector("#pay-qr").src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(genericLink)}`;
  document.querySelector("#pay-gpay").href = upiLink("tez://upi/pay", amount, note);
  document.querySelector("#pay-phonepe").href = upiLink("phonepe://pay", amount, note);
  document.querySelector("#pay-paytm").href = upiLink("paytmmp://pay", amount, note);
  document.querySelector("#pay-any").href = genericLink;
  successMessage.classList.remove("show", "is-error");
  payDialog.showModal();
}

function toggleSlot(hour) {
  const hours = selectedHours();
  let note = "";

  if (!hours.length) {
    const count = preferredHours || 1;
    const block = openBlock(hour, count);
    selectedSlots = block;
    if (block.length < count) {
      note = block.length
        ? `Only ${block.length} open hour${block.length > 1 ? "s" : ""} from this start time.`
        : "That hour is not open.";
    }
  } else if (hours.includes(hour)) {
    if (hours.length === 1 || hour === hours[0] || hour === hours[hours.length - 1]) {
      selectedSlots = selectedSlots.filter((id) => Number(id.slice(0, 2)) !== hour);
    } else {
      selectedSlots = selectedSlots.filter((id) => Number(id.slice(0, 2)) <= hour);
    }
  } else if (hour === hours[0] - 1 || hour === hours[hours.length - 1] + 1) {
    if (hours.length >= 3) {
      note = "Advance booking covers up to 3 hours in one request.";
    } else {
      selectedSlots = openBlock(Math.min(hours[0], hour), hours.length + 1);
    }
  } else {
    selectedSlots = openBlock(hour, preferredHours || 1);
  }

  preferredHours = selectedSlots.length || preferredHours;
  renderSlots(note);
}

function applyDuration(count) {
  preferredHours = count;
  if (!selectedDate) {
    payNote.textContent = "Choose a date first, then pick a starting hour.";
    return;
  }
  if (!selectedSlots.length) {
    payNote.textContent = `₹${ADVANCE[count]} advance selected. Now tap the hour you want to start.`;
    document.querySelectorAll(".pay-card").forEach((card) => {
      const active = Number(card.dataset.hours) === count;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });
    return;
  }

  const block = openBlock(selectedHours()[0], count);
  selectedSlots = block;
  const note = block.length < count
    ? `Only ${block.length} open hour${block.length === 1 ? "" : "s"} are free from this start time.`
    : "";
  renderSlots(note);
}

function renderSlots(note) {
  slotGroups.innerHTML = "";
  if (!selectedDate) {
    slotHeading.textContent = "Select a date";
    slotEmpty.hidden = false;
    syncSelection(note);
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
      const picked = selectedSlots.includes(slot.id);
      if (picked) button.classList.add("picked");
      button.setAttribute("aria-pressed", String(picked));
      const status = slot.past ? "Passed" : slot.booked ? "Booked" : slot.price;
      button.innerHTML = `<strong>${slot.label}</strong><small>${status}</small>`;
      if (slot.open) {
        button.addEventListener("click", () => toggleSlot(Number(slot.id.slice(0, 2))));
      }
      row.append(button);
    });

    group.append(row);
    slotGroups.append(group);
  });

  syncSelection(note);
}

document.querySelectorAll(".pay-card").forEach((card) => {
  card.addEventListener("click", () => applyDuration(Number(card.dataset.hours)));
});

document.querySelectorAll(".cal-nav").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.dir;
    viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + (direction === "next" ? 1 : -1), 1);
    renderCalendar(direction);
  });
});

ArenaBookings.ready.then(() => {
  renderCalendar();
  renderSlots();
});

payButton.addEventListener("click", openAdvancePayment);
document.querySelector("#pay-close").addEventListener("click", () => payDialog.close());
document.querySelector("#pay-done").addEventListener("click", () => {
  payDialog.close();
  sendBooking(true);
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendBooking(false);
});

async function sendBooking(paid) {

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
  const saved = await ArenaBookings.add({
    date: dateField.value,
    slots: [...selectedSlots],
    timeLabel: timeField.value,
    sport: formData.get("sport"),
    name,
    phone: formData.get("phone"),
    players: formData.get("players"),
    message: formData.get("message") || "",
    advance: advanceField.value,
    payment: paid ? "paid" : "unpaid",
    status: "inquiry",
    source: "website",
  });
  if (!saved.ok) {
    successMessage.textContent = saved.error;
    successMessage.classList.add("show", "is-error");
    successMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const submitButton = bookingForm.querySelector('button[type="submit"]');
  const whatsappNumber = "919730803751";
  const emailAddress = "yuvrajd568@gmail.com";
  const message = [
    "New booking inquiry - Deshmukh Sports Arena",
    "",
    `Order: ${saved.order.code}`,
    `Name: ${name}`,
    `Phone: ${formData.get("phone")}`,
    `Preferred date: ${formData.get("date")}`,
    `Preferred time: ${formData.get("time")}`,
    `Duration: ${formData.get("hours")}`,
    `Advance payment: ${formData.get("advance")}`,
    `Payment status: ${paid ? "Customer marked the UPI advance as paid" : "Not paid yet"}`,
    `Sport: ${formData.get("sport")}`,
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

    successMessage.textContent = paid
      ? `Thanks, ${name}! ${saved.order.code} is held. Your ${advanceField.value} advance is marked paid, and the booking was sent on WhatsApp and email.`
      : `Thanks, ${name}! ${saved.order.code} is held for ${hoursField.value}. You can still pay the advance before the slot is confirmed.`;
    clearBookingForm();
  } catch (error) {
    const emailSubject = encodeURIComponent(`New turf booking inquiry from ${name}`);
    const emailBody = encodeURIComponent(message);
    successMessage.innerHTML = `${saved.order.code} is saved. WhatsApp has opened, but automatic email could not be confirmed. <a href="mailto:${emailAddress}?subject=${emailSubject}&body=${emailBody}">Send the email manually</a>.`;
    clearBookingForm();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send inquiry without payment";
    successMessage.classList.add("show");
    successMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function clearBookingForm() {
  selectedDate = null;
  selectedSlots = [];
  preferredHours = null;
  bookingForm.reset();
  renderCalendar();
  renderSlots();
}

ArenaBookings.subscribe(() => {
  if (selectedDate) {
    const stillOpen = selectedSlots.every((id) => !ArenaBookings.isSlotTaken(`${selectedDate}|${id}`));
    if (!stillOpen) selectedSlots = [];
  }
  renderCalendar();
  renderSlots();
});

document.querySelector("#year").textContent = new Date().getFullYear();

const revealGroups = [
  [".intro-grid > *", "reveal-target"],
  [".section-heading > *", "reveal-target"],
  [".arena-photo", "reveal-target"],
  [".arena-list li", "reveal-target"],
  [".pricing-top > *", "reveal-target"],
  [".price-card", "reveal-target"],
  [".booking-copy", "reveal-target reveal-left"],
  [".booking-form", "reveal-target reveal-right"],
  [".contact-strip > div", "reveal-target"],
];

const revealElements = [];
revealGroups.forEach(([selector, classNames]) => {
  document.querySelectorAll(selector).forEach((element, index) => {
    element.classList.add(...classNames.split(" "));
    element.style.setProperty("--reveal-delay", `${Math.min(index * 110, 330)}ms`);
    revealElements.push(element);
  });
});

function animateCounter(element) {
  if (element.dataset.counted) return;
  element.dataset.counted = "true";
  const original = element.textContent.trim();
  const target = Number.parseInt(original, 10);
  const suffix = original.replace(String(target), "");
  const startedAt = performance.now();
  const duration = 1100;

  element.classList.add("counting");
  function tick(time) {
    const progress = Math.min((time - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${Math.round(target * eased)}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = original;
      element.classList.remove("counting");
    }
  }
  requestAnimationFrame(tick);
}

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        entry.target.querySelectorAll(".stats strong").forEach(animateCounter);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -45px" },
  );
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}
