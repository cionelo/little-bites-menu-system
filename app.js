/**
 * Little Bites Menu System - Frontend JavaScript
 *
 * PURPOSE:
 * Handles all client-side functionality for the online menu ordering system.
 * Fetches menu from Google Sheets backend, renders interactive menu cards,
 * manages item quantities and options, validates selections, and submits orders.
 *
 * CORE FUNCTIONALITY:
 * 1. Menu Loading & Rendering
 *    - Fetches menu data from backend on page load
 *    - Dynamically generates menu cards with prices, descriptions, and options
 *
 * 2. Quantity Management
 *    - +/- buttons to adjust item quantities
 *    - Automatically generates option selectors per instance
 *    - Real-time subtotal calculation
 *
 * 3. Options System (Per-Instance)
 *    - Each ordered item gets individual option selectors (Item #1, Item #2, etc.)
 *    - Pill-style selectors for each option group
 *    - Example: 3 breakfast sandwiches = 3 sets of option selectors
 *
 * 4. Validation
 *    - Ensures ALL options are selected before submission
 *    - Displays helpful error: "Please pick an option for {item} (Item #{n})"
 *
 * 5. Order Submission
 *    - Collects all items with their instance-specific options
 *    - POSTs to backend with structured payload
 *    - Visual feedback with button animations (pulse, press effects)
 *
 * DATA STRUCTURE:
 * Menu items are sent with instances array:
 * {
 *   name: "breakfast sandwich",
 *   qty: 3,
 *   instances: [
 *     { options: ["egg", "croissant"] },
 *     { options: ["egg", "croissant"] },
 *     { options: ["no egg", "muffin"] }
 *   ]
 * }
 *
 * RECENT UPDATES:
 * - Added comprehensive validation to prevent submission without option selections
 * - Enhanced UI with button press animations and hover effects
 * - Added pulsing animation during order submission
 *
 * @version 2.0
 * @date 2025-12-15
 */

// **************************************
// CONFIG
// **************************************
// SET THIS TO YOUR APPS SCRIPT DEPLOYMENT URL:
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbySs_eTXk7SeLBT-Q8suDoRO2F1V7GJBEwGZLnCbEqspGQ_CPAJj1XMF5Pa_LPBE_Xv/exec";

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
    // OPTIONS (PILL SELECTORS) - CONTAINER
    // =====================================
    if (item.options) {
      html += `<div id="options-container-${index}"></div>`;
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

  // Rebuild option selectors based on new quantity
  renderOptionsForItem(index, value);

  updateSubtotal();
}

// **************************************
// RENDER OPTIONS FOR SPECIFIC ITEM BASED ON QTY
// **************************************
function renderOptionsForItem(itemIndex, qty) {
  const item = MENU[itemIndex];
  const container = document.getElementById(`options-container-${itemIndex}`);

  if (!container || !item.options) return;

  container.innerHTML = "";

  if (qty === 0) return; // No options needed if qty is 0

  const groups = item.options.split("|");

  // Create option selectors for each instance
  for (let instance = 0; instance < qty; instance++) {
    const instanceDiv = document.createElement("div");
    instanceDiv.className = "instance-options";
    instanceDiv.innerHTML = `<div class="instance-label">Item #${instance + 1}</div>`;

    groups.forEach((g, optIndex) => {
      const pillRow = document.createElement("div");
      pillRow.className = "pill-row";
      pillRow.id = `opt-${itemIndex}-${instance}-${optIndex}`;

      g.split("/").forEach(option => {
        const pill = document.createElement("div");
        pill.className = "pill";
        pill.innerText = option.trim();
        pill.onclick = function() {
          selectPill(itemIndex, instance, optIndex, this);
        };
        pillRow.appendChild(pill);
      });

      instanceDiv.appendChild(pillRow);
    });

    container.appendChild(instanceDiv);
  }
}

// **************************************
// PILL OPTION SELECTOR
// **************************************
function selectPill(mealIndex, instance, optIndex, pillEl) {
  const row = document.getElementById(`opt-${mealIndex}-${instance}-${optIndex}`);
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
// VALIDATE ALL OPTIONS ARE SELECTED
// **************************************
function validateOrderOptions() {
  for (let i = 0; i < MENU.length; i++) {
    const item = MENU[i];
    const qty = parseInt(document.getElementById(`qty-${i}`).value) || 0;

    if (qty === 0) continue; // Skip items not ordered

    if (item.options) {
      const groups = item.options.split("|");

      // Check each instance for missing selections
      for (let instance = 0; instance < qty; instance++) {
        for (let optIndex = 0; optIndex < groups.length; optIndex++) {
          const row = document.getElementById(`opt-${i}-${instance}-${optIndex}`);
          if (row) {
            const selected = [...row.children].find(p =>
              p.classList.contains("selected")
            );
            if (!selected) {
              return `Please pick an option for ${item.name} (Item #${instance + 1}) to submit your order.`;
            }
          }
        }
      }
    }
  }

  return null; // No validation errors
}

// **************************************
// BUILD ORDER DATA FOR SUBMISSION
// **************************************
function collectItems() {
  let output = [];

  MENU.forEach((item, i) => {
    const qty = parseInt(document.getElementById(`qty-${i}`).value) || 0;
    if (qty === 0) return;

    let instances = [];

    if (item.options) {
      const groups = item.options.split("|");

      // Collect options for each instance
      for (let instance = 0; instance < qty; instance++) {
        let instanceOptions = [];

        groups.forEach((_, optIndex) => {
          const row = document.getElementById(`opt-${i}-${instance}-${optIndex}`);
          if (row) {
            const selected = [...row.children].find(p =>
              p.classList.contains("selected")
            );
            instanceOptions.push(selected ? selected.innerText : null);
          }
        });

        instances.push({ options: instanceOptions });
      }
    } else {
      // No options - just create empty instances
      for (let instance = 0; instance < qty; instance++) {
        instances.push({ options: [] });
      }
    }

    output.push({
      name: item.name,
      qty,
      price: item.price,
      instances,
    });
  });

  return output;
}

// **************************************
// SUBMIT ORDER (POST to Google Sheets)
// **************************************
function submitOrder() {
  const btn = document.querySelector(".submit-btn");

  if (btn.disabled) return; // safety guard

  // Validate all options are selected before submitting
  const validationError = validateOrderOptions();
  if (validationError) {
    alert(validationError);
    return;
  }

  btn.disabled = true;
  btn.classList.add("submitting");
  btn.innerText = "Submitting order…";

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
    .then(res => {
      if (!res.ok) throw new Error("Submit failed");
      handleSuccessfulSubmit();
    })
    .catch(err => {
      console.error(err);
      btn.disabled = false;
      btn.classList.remove("submitting");
      btn.innerText = "Submit Order";
      alert("There was an issue submitting your order. Please try again.");
    });
    function handleSuccessfulSubmit() {
  // Clear text fields
  ["name", "phone", "delivery", "email", "buddy", "comments"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset quantities and options
  MENU.forEach((_, i) => {
    const qty = document.getElementById(`qty-${i}`);
    if (qty) qty.value = 0;

    // Clear options container
    const optionsContainer = document.getElementById(`options-container-${i}`);
    if (optionsContainer) optionsContainer.innerHTML = "";

    // Collapse descriptions if open
    const desc = document.getElementById(`desc-${i}`);
    if (desc) desc.style.display = "none";
  });

  // Reset subtotal
  document.getElementById("subtotal").innerText = "$0";

  // Hide the sticky footer (submit button)
  const footer = document.querySelector(".sticky-footer");
  if (footer) footer.style.display = "none";

  // Redirect / confirmation state
  document.querySelector(".container").innerHTML = `
    <div class="card" style="text-align:center;">
      <h2 style="color:#006dab;">Order submitted successfully</h2>
      <p>Thank you! Your order has been received.</p>
    </div>
  `;
}

}

