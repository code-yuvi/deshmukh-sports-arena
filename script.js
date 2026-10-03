const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");
const bookingForm = document.querySelector("#booking-form");
const dateInput = document.querySelector('input[name="date"]');

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

const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
dateInput.min = today.toISOString().split("T")[0];

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(bookingForm);
  const name = formData.get("name");
  const successMessage = bookingForm.querySelector(".form-success");
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
    bookingForm.reset();
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
