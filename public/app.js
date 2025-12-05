// **************************************
// CONFIG
// **************************************
// SET THIS TO YOUR APPS SCRIPT DEPLOYMENT URL:
const BACKEND_URL = "YOUR_WEB_APP_URL_HERE";

let MENU = [];

// **************************************
// LOAD MENU FROM GOOGLE SHEETS
// **************************************
document.addEventListener("DOMContentLoaded", loadMenu);

async function loadMenu() {
  try {
    const res = await fetch(BACKEND_URL);
    const data = await res.json();
    MENU = data.menu;
    renderMenu();
  } catch (err) {
    console.error("Error loading menu:", err);
  }
}

// **************************************
// RENDER MENU
// **************************************
function renderMenu() {
  const area = document.getElementById("menu-area");
  area.innerHTML = "";

  MENU.forEach((item, index) => {
    let card = document.createElement("div");
    card.className = "meal-card";

    let html = `
      <div class="meal-title">${item.name}</div>
      <div class="price">$${item.price}</div>
    `;

    // =====================================
    // 🔽 DESCRIPTION DROPDOWN (NEW FEATURE)
    // =====================================
    if (item.description && item.description.trim() !== "") {
      html += `
        <div class="desc-toggle" onclick="toggleDesc(${index})">
          More info ▼
        </div>
        <div id="desc-${index}" class="desc-content">
          ${item.description}
        </div>
      `;
    }

    // =====================================
    // QUANTITY BOX
    // =====================================
    html += `
      <div class="qty-box">
        <button class="qty-btn" onclick="changeQty(${index}, -1)">−</button>
        <input id="qty-${index}" class="qty-input" type="number" min="0" value="0">
        <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
      </div>
    `;

    // =====================================
    // OPTIONS (PILL SELECTORS)
    // =====================================
    if (item.options) {
      const groups = item.options.split("|");

      groups.forEach((g, optIndex) => {
        html += `
          <div class="pill-row" id="opt-${index}-${optIndex}">
            ${g
              .split("/")
              .map(
                o =>
                  `<div class="pill" onclick="selectPill(${index}, ${optIndex}, this)">${o.trim()}</div>`
              )
              .join("")}
          </div>
        `;
      });
    }

    card.innerHTML = html;
    area.appendChild(card);
  });
}

// **************************************
// QUANTITY LOGIC
// **************************************
function changeQty(index, delta) {
  const input = document.getElementById(`qty-${index}`);
  let value = parseInt(input.value) || 0;
  value = Math.max(0, value + delta);
  input.value = value;
  updateSubtotal();
}

// **************************************
// PILL OPTION SELECTOR
// **************************************
function selectPill(mealIndex, optIndex, pillEl) {
  const row = document.getElementById(`opt-${mealIndex}-${optIndex}`);
  [...row.children].forEach(p => p.classList.remove("selected"));
  pillEl.classList.add("selected");
}

// **************************************
// DESCRIPTION DROPDOWN TOGGLE
// **************************************
function toggleDesc(i) {
  const el = document.getElementById(`desc-${i}`);
  if (!el) return;

  // simple toggle (default)
  if (el.style.display === "block") {
    el.style.display = "none";
  } else {
    el.style.display = "block";
  }

  // OPTIONAL: if you want animation using CSS .open class instead:
  // el.classList.toggle("open");
}

// **************************************
// SUBTOTAL CALCULATION
// **************************************
function updateSubtotal() {
  let total = 0;

  MENU.forEach((item, i) => {
    const qty = parseInt(document.getElementById(`qty-${i}`).value) || 0;
    total += qty * item.price;
  });

  document.getElementById("subtotal").innerText = `$${total}`;
}

// **************************************
// BUILD ORDER DATA FOR SUBMISSION
// **************************************
function collectItems() {
  let output = [];

  MENU.forEach((item, i) => {
    const qty = parseInt(document.getElementById(`qty-${i}`).value) || 0;
    if (qty === 0) return;

    let selectedOptions = [];

    if (item.options) {
      const groups = item.options.split("|");
      groups.forEach((_, optIndex) => {
        const row = document.getElementById(`opt-${i}-${optIndex}`);
        const selected = [...row.children].find(p =>
          p.classList.contains("selected")
        );
        selectedOptions.push(selected ? selected.innerText : null);
      });
    }

    output.push({
      name: item.name,
      qty,
      price: item.price,
      selectedOptions,
    });
  });

  return output;
}

// **************************************
// SUBMIT ORDER (POST to Google Sheets)
// **************************************
function submitOrder() {
  const payload = {
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    delivery: document.getElementById("delivery").value,
    email: document.getElementById("email").value,
    buddy: document.getElementById("buddy").value,
    comments: document.getElementById("comments").value,
    items: collectItems(),
  };

  fetch(BACKEND_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  })
    .then(() => alert("Order submitted!"))
    .catch(err => alert("Error submitting order. Check console."));
}

