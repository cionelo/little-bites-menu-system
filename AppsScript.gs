/**
 * Little Bites Menu System - Backend (Google Apps Script)
 *
 * PURPOSE:
 * This Apps Script serves as the backend for the Little Bites online menu ordering system.
 * It connects to a Google Spreadsheet with multiple tabs for menu, orders, and kitchen prep.
 *
 * SPREADSHEET STRUCTURE:
 * - Menu Sheet: Contains menu items with columns: category, name, price, options, description
 *   - category (optional): Used to group menu items (e.g., "Breakfast", "Beverages", "Salads")
 *   - Options format: "choice1/choice2|choice3/choice4" (pipe separates option groups, slash separates choices)
 *   - Example: "egg/no egg|croissant/muffin" = two option groups (egg choice and bread choice)
 *
 * - orders_json Sheet: Stores raw order data with readable summary (hidden from user view)
 * - Orders Sheet: Kitchen prep format with item counts and formatted options
 *   - Format: item columns + "{item name} - options" columns
 *   - Options display: "(opt1, opt2), (opt1, opt2)" for easy kitchen reading
 *   - Totals row: Item counts (SUM formulas) + aggregated option counts
 *     Example: "4x(Wrap), 1x(Salad)" - sorted by count, descending
 *
 * - Kitchen Prep Summary Sheet: Simplified view with abbreviated options for quick kitchen reference
 *   - Auto-generated from Orders totals row
 *   - Format: ITEM | QUANTITY | OPTIONS BREAKDOWN
 *   - Abbreviates options: "5x(E,CR), 3x(NE,MF)" instead of "5x(egg, croissant), 3x(no egg, muffin)"
 *
 * KEY FEATURES:
 * - GET endpoint: Returns menu data as JSON (includes menu status: published/paused)
 * - POST endpoint: Receives orders and writes to both orders_json and Orders sheets
 * - Menu Pause/Publish: Toggle menu availability while updating weekly items
 * - Dynamic header generation: Orders headers auto-update based on Menu sheet
 * - Options formatting: Groups instance options as "(option1, option2), (option1, option2)"
 * - Totals aggregation: Counts option tuples across all orders for kitchen prep
 * - Kitchen shorthand: Auto-abbreviates options for faster kitchen reading
 * - Archive & clear functionality: Built-in menu tool for end-of-day operations
 * - Refresh totals: Manual recalculation of TOTALS row after editing data
 * - Rebuild Orders from JSON: Repopulates Orders sheet from orders_json source of truth
 *
 * BUILT-IN TOOLS (📋 Little Bites Tools Menu):
 * - ⏸️/▶️ Pause/Publish Menu: Toggle menu availability for weekly updates
 * - 🔄 Archive & Clear Orders: Creates timestamped backups and clears order data
 * - 🛠️ Rebuild Orders Headers: Regenerates column headers based on current Menu
 * - 📝 Rebuild Orders from JSON: Repopulates Orders sheet from orders_json data
 * - 🔢 Refresh Totals: Recalculates TOTALS row after manual edits or deletions
 * - 👨‍🍳 Generate Kitchen Prep Summary: Creates abbreviated kitchen-friendly summary
 * - ❓ Get Help: Opens documentation in browser
 *
 * RECENT UPDATES (v2.3):
 * - Added "Rebuild Orders from JSON" tool to repopulate Orders from orders_json
 *   Uses orders_json as source of truth, replays all orders in kitchen prep format
 *
 * PREVIOUS UPDATES (v2.2):
 * - Added Menu Pause/Publish toggle for weekly menu updates
 * - Frontend displays overlay modal when menu is paused
 * - Menu status stored in Script Properties
 * - Added Refresh Totals tool for manual totals recalculation
 * - Changed Orders from multiple option columns to single options column per item
 * - Options now formatted as comma-separated tuples for kitchen readability
 * - Frontend validation ensures all options are selected before submission
 * - Added totals row aggregation for option counts (e.g., "4x(Wrap), 1x(Salad)")
 * - Added Kitchen Prep Summary generator with abbreviated options (e.g., "5x(E,CR)")
 *
 * @version 2.3
 * @date 2026-02-16
 */

// **************************************
// MENU STATUS MANAGEMENT
// **************************************
/**
 * Gets the current menu status (published or paused).
 *
 * PURPOSE:
 * Checks Script Properties to determine if menu is available for ordering.
 *
 * RETURNS:
 * - "published" (default): Menu is live, orders can be placed
 * - "paused": Menu is being updated, orders blocked
 *
 * STORAGE:
 * Uses Script Properties (invisible to user, persists across sessions)
 */
function getMenuStatus() {
  const props = PropertiesService.getScriptProperties();
  const status = props.getProperty("menuStatus");
  return status || "published"; // Default to published if not set
}

/**
 * Sets the menu status.
 *
 * @param {string} status - Either "published" or "paused"
 */
function setMenuStatus(status) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("menuStatus", status);
}

/**
 * Toggles the menu between paused and published states.
 *
 * PURPOSE:
 * Allows kitchen owner to pause the menu while updating weekly items,
 * then publish when ready for customers to order.
 *
 * WORKFLOW:
 * 1. Owner clicks "⏸️ Pause Menu" before updating
 * 2. Frontend shows "Menu updating..." overlay
 * 3. Owner updates menu items in Google Sheets
 * 4. Owner clicks "▶️ Publish Menu" when ready
 * 5. Frontend shows updated menu, orders can be placed
 *
 * TRIGGERED BY:
 * User clicking "📋 Little Bites Tools" → "⏸️ Pause Menu" or "▶️ Publish Menu"
 */
function toggleMenuStatus() {
  const currentStatus = getMenuStatus();
  const newStatus = currentStatus === "published" ? "paused" : "published";
  setMenuStatus(newStatus);

  const statusEmoji = newStatus === "published" ? "▶️" : "⏸️";
  const statusText = newStatus === "published" ? "PUBLISHED" : "PAUSED";
  const actionText = newStatus === "published"
    ? "Customers can now place orders."
    : "Customers will see 'Menu updating...' message.";

  SpreadsheetApp.getUi().alert(
    `${statusEmoji} Menu is now ${statusText}\n\n${actionText}`
  );
}

// **************************************
// MENU FETCH (GET REQUEST)
// **************************************
function doGet(e) {
  const ss = SpreadsheetApp.getActive();
  const menuSheet = ss.getSheetByName("Menu");
  const rows = menuSheet.getDataRange().getValues();

  const headers = rows.shift();

  const data = rows.map(r => {
    let o = {};
    headers.forEach((h, i) => o[h] = r[i]);
    return o;
  });

  // Include menu status in response
  const status = getMenuStatus();

  return ContentService
    .createTextOutput(JSON.stringify({ menu: data, status: status }))
    .setMimeType(ContentService.MimeType.JSON);
}

// **************************************
// ORDER SUBMISSION (POST REQUEST)
// **************************************
function doPost(e) {
  // Check if menu is paused - reject orders if so
  const status = getMenuStatus();
  if (status === "paused") {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: "Menu is currently being updated. Please try again later."
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActive();
  const ordersJsonSheet = ss.getSheetByName("orders_json");
  const ordersSheet = getOrCreateOrdersSheet();

  const payload = JSON.parse(e.postData.contents);

  // Build readable order summary for "orders_json" tab
  const readableItems = payload.items.map(item => {
    // Handle both old format (single options) and new format (instances)
    if (item.instances && item.instances.length > 0) {
      // New format: multiple instances with individual options
      return item.instances.map((inst, idx) => {
        const opts = inst.options.filter(Boolean).join(", ");
        return `${item.name}${opts ? " (" + opts + ")" : ""}`;
      }).join(" | ");
    } else {
      // Old format fallback
      const opts = item.selectedOptions
        .filter(Boolean)
        .join(", ");
      return `${item.qty}x ${item.name}${opts ? " (" + opts + ")" : ""}`;
    }
  }).join(" | ");

  // Write to "orders_json" tab (raw data storage)
  ordersJsonSheet.appendRow([
    new Date(),
    payload.name,
    payload.phone,
    payload.delivery,
    payload.email,
    JSON.stringify(payload.items),   // raw JSON (keep)
    readableItems,                   // human-readable
    payload.buddy,
    payload.comments
  ]);

  // Write to "Orders" tab (kitchen prep format)
  writeToOrders(ordersSheet, payload);

  return ContentService.createTextOutput("OK");
}

// **************************************
// GET OR CREATE ORDERS SHEET
// **************************************
function getOrCreateOrdersSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("Orders");

  if (!sheet) {
    sheet = ss.insertSheet("Orders");
    initializeOrdersHeaders(sheet);
  }

  return sheet;
}

// **************************************
// INITIALIZE ORDERS HEADERS
// **************************************
function initializeOrdersHeaders(sheet) {
  const ss = SpreadsheetApp.getActive();
  const menuSheet = ss.getSheetByName("Menu");
  const menuData = menuSheet.getDataRange().getValues();
  const headers = menuData.shift();

  // Base columns
  const baseHeaders = ["Date", "Name", "Phone", "Delivery", "Email"];
  const itemHeaders = [];

  // Build item + single options column from menu
  menuData.forEach(row => {
    let item = {};
    headers.forEach((h, i) => item[h] = row[i]);

    if (!item.name) return; // Skip empty rows

    // Add main item column
    itemHeaders.push(item.name);

    // Add single options column if options exist
    if (item.options && item.options.trim() !== "") {
      itemHeaders.push(`${item.name} - options`);
    }
  });

  const allHeaders = [...baseHeaders, ...itemHeaders];
  sheet.clear();
  sheet.appendRow(allHeaders);

  // Format header row
  sheet.getRange(1, 1, 1, allHeaders.length)
    .setFontWeight("bold")
    .setBackground("#4a86e8")
    .setFontColor("#ffffff");
}

// **************************************
// WRITE ORDER TO ORDERS (KITCHEN PREP)
// **************************************
function writeToOrders(sheet, payload) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = new Array(headers.length).fill("");

  // Fill base info
  rowData[0] = new Date();  // Date
  rowData[1] = payload.name;
  rowData[2] = payload.phone;
  rowData[3] = payload.delivery;
  rowData[4] = payload.email;

  // Process items - group by item name to collect all instances
  const itemOptionsMap = {}; // { itemName: [optionsArray] }

  payload.items.forEach(item => {
    if (!itemOptionsMap[item.name]) {
      itemOptionsMap[item.name] = [];
    }

    if (item.instances && item.instances.length > 0) {
      // New format: instances with individual options
      item.instances.forEach(instance => {
        // Collect options for this instance
        const instanceOptions = instance.options.filter(Boolean);
        itemOptionsMap[item.name].push(instanceOptions);
      });
    } else {
      // Old format fallback (qty-based)
      const qty = item.qty || 0;
      const instanceOptions = item.selectedOptions ? item.selectedOptions.filter(Boolean) : [];

      // Add same options for each quantity
      for (let i = 0; i < qty; i++) {
        itemOptionsMap[item.name].push(instanceOptions);
      }
    }
  });

  // Now write to rowData
  Object.keys(itemOptionsMap).forEach(itemName => {
    const instances = itemOptionsMap[itemName];

    // Find main item column and set count
    const itemColIndex = headers.indexOf(itemName);
    if (itemColIndex !== -1) {
      rowData[itemColIndex] = instances.length;
    }

    // Find options column and format options string
    const optionsColName = `${itemName} - options`;
    const optionsColIndex = headers.indexOf(optionsColName);

    if (optionsColIndex !== -1) {
      // Format: (opt1, opt2), (opt1, opt2), ...
      const optionsString = instances.map(opts => {
        return opts.length > 0 ? `(${opts.join(", ")})` : "";
      }).filter(Boolean).join(", ");

      rowData[optionsColIndex] = optionsString;
    }
  });

  sheet.appendRow(rowData);

  // Update totals row
  updateTotalsRow(sheet);
}

// **************************************
// UPDATE TOTALS ROW AT BOTTOM
// **************************************
function updateTotalsRow(sheet) {
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Find and remove any existing TOTALS rows
  for (let i = lastRow; i >= 2; i--) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === "TOTALS") {
      sheet.deleteRow(i);
    }
  }

  // Recalculate last row after deletions
  const currentLastRow = sheet.getLastRow();
  const totalsRow = currentLastRow + 1;

  // Get all data rows for aggregating options
  const dataRange = currentLastRow > 1 ? sheet.getRange(2, 1, currentLastRow - 1, headers.length).getValues() : [];

  // Build totals data
  const totalsData = headers.map((header, idx) => {
    // Skip formula for text columns
    if (idx < 5) {
      return idx === 0 ? "TOTALS" : "";
    }

    // Check if this is an options column
    if (header.includes(" - options")) {
      // Aggregate option counts across all orders
      return aggregateOptions(dataRange, idx);
    } else {
      // Standard numeric sum for item count columns
      const colLetter = columnToLetter(idx + 1);
      return `=SUM(${colLetter}2:${colLetter}${currentLastRow})`;
    }
  });

  // Write totals row at the very bottom
  sheet.appendRow(totalsData);
  sheet.getRange(totalsRow, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#f3f3f3");
}

// **************************************
// AGGREGATE OPTIONS FOR TOTALS ROW
// **************************************
function aggregateOptions(dataRows, columnIndex) {
  const optionCounts = {}; // { "(Wrap)": 4, "(Salad)": 1 }

  // Iterate through all data rows
  dataRows.forEach(row => {
    const optionsCell = row[columnIndex];

    if (!optionsCell || optionsCell === "") return; // Skip empty cells

    // Split by "), (" pattern to correctly separate complete tuples
    // Example: "(egg, croissant), (no egg, muffin)" -> ["(egg, croissant)", "(no egg, muffin)"]
    const optionString = optionsCell.toString().trim();

    // Split using regex that matches "), (" as the separator
    // We need to add back the parentheses that get consumed by the split
    const optionTuples = optionString.split(/\),\s*\(/);

    optionTuples.forEach((tuple, index) => {
      let trimmed = tuple.trim();
      if (trimmed === "") return; // Skip empty strings

      // Add back the opening parenthesis (except for first element)
      if (index > 0 && !trimmed.startsWith("(")) {
        trimmed = "(" + trimmed;
      }

      // Add back the closing parenthesis (except for last element)
      if (index < optionTuples.length - 1 && !trimmed.endsWith(")")) {
        trimmed = trimmed + ")";
      }

      // Ensure both parentheses are present (for single-element arrays)
      if (!trimmed.startsWith("(")) trimmed = "(" + trimmed;
      if (!trimmed.endsWith(")")) trimmed = trimmed + ")";

      // Count this tuple
      optionCounts[trimmed] = (optionCounts[trimmed] || 0) + 1;
    });
  });

  // Convert to array and sort by count (descending)
  const sortedOptions = Object.entries(optionCounts)
    .sort((a, b) => b[1] - a[1]) // Sort by count, highest first
    .map(([tuple, count]) => `${count}x${tuple}`)
    .join(", ");

  return sortedOptions || ""; // Return empty string if no options
}


// **************************************
// HELPER: COLUMN NUMBER TO LETTER
// **************************************
function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

// **************************************
// ARCHIVE & CLEAR FUNCTION
// **************************************
function archiveAndClear() {
  const ss = SpreadsheetApp.getActive();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  // Archive Menu
  const menuSheet = ss.getSheetByName("Menu");
  if (menuSheet) {
    const menuArchive = menuSheet.copyTo(ss);
    menuArchive.setName(`Menu_Archive_${timestamp}`);
  }

  // Archive orders_json (raw data)
  const ordersJsonSheet = ss.getSheetByName("orders_json");
  if (ordersJsonSheet) {
    const ordersJsonArchive = ordersJsonSheet.copyTo(ss);
    ordersJsonArchive.setName(`orders_json_Archive_${timestamp}`);

    // Clear orders_json (keep headers)
    const lastRow = ordersJsonSheet.getLastRow();
    if (lastRow > 1) {
      ordersJsonSheet.deleteRows(2, lastRow - 1);
    }
  }

  // Archive and clear Orders (kitchen prep)
  const ordersSheet = ss.getSheetByName("Orders");
  if (ordersSheet) {
    const ordersArchive = ordersSheet.copyTo(ss);
    ordersArchive.setName(`Orders_Archive_${timestamp}`);

    // Clear Orders (keep headers, remove totals)
    const lastRow = ordersSheet.getLastRow();
    if (lastRow > 1) {
      ordersSheet.deleteRows(2, lastRow - 1);
    }
  }

  SpreadsheetApp.getUi().alert(`✅ Archive created: ${timestamp}\n\norders_json and Orders have been cleared.`);
}

// **************************************
// CUSTOM MENU (RUNS ON OPEN)
// **************************************
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const currentStatus = getMenuStatus();
  const toggleLabel = currentStatus === "published"
    ? "⏸️ Pause Menu (Currently: LIVE)"
    : "▶️ Publish Menu (Currently: PAUSED)";

  ui.createMenu('📋 Little Bites Tools')
    .addItem(toggleLabel, 'toggleMenuStatus')
    .addSeparator()
    .addItem('🔄 Archive & Clear Orders', 'archiveAndClear')
    .addItem('🛠️ Rebuild Orders Headers', 'rebuildOrdersHeaders')
    .addItem('📝 Rebuild Orders from JSON', 'buildOrdersFromJson')
    .addItem('🔢 Refresh Totals', 'refreshTotals')
    .addItem('👨‍🍳 Generate Kitchen Prep Summary', 'generateKitchenSummary')
    .addSeparator()
    .addItem('❓ Get Help', 'getHelp')
    .addToUi();
}

// **************************************
// REBUILD ORDERS HEADERS (MANUAL TOOL)
// **************************************
function rebuildOrdersHeaders() {
  const sheet = getOrCreateOrdersSheet();
  initializeOrdersHeaders(sheet);
  SpreadsheetApp.getUi().alert("✅ Orders headers have been rebuilt based on current Menu.");
}

// **************************************
// REFRESH TOTALS (MANUAL TOOL)
// **************************************
/**
 * Manually refreshes the totals row in the Orders sheet.
 *
 * PURPOSE:
 * Allows users to recalculate totals after manually editing or deleting rows
 * in the Orders sheet without submitting a new order.
 *
 * USE CASES:
 * - After deleting test orders
 * - After manually modifying order data
 * - When totals appear out of sync with actual data
 *
 * PROCESS:
 * Simply calls updateTotalsRow() which:
 * 1. Removes existing TOTALS rows
 * 2. Recalculates totals based on current data
 * 3. Adds new TOTALS row at bottom
 *
 * TRIGGERED BY:
 * User clicking "📋 Little Bites Tools" → "🔢 Refresh Totals"
 */
function refreshTotals() {
  const ss = SpreadsheetApp.getActive();
  const ordersSheet = ss.getSheetByName("Orders");

  if (!ordersSheet) {
    SpreadsheetApp.getUi().alert("⚠️ Orders sheet not found.");
    return;
  }

  const lastRow = ordersSheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("⚠️ No data found in Orders sheet.");
    return;
  }

  updateTotalsRow(ordersSheet);
  SpreadsheetApp.getUi().alert("✅ Totals have been refreshed successfully!");
}

// **************************************
// GET HELP - OPENS DOCUMENTATION
// **************************************
/**
 * Opens the HOWTO.md documentation in a new browser tab.
 *
 * PURPOSE:
 * Provides quick access to setup guide and troubleshooting documentation
 * directly from the Google Sheets interface.
 *
 * LOCATION:
 * GitHub repository: https://github.com/cionelo/little-bites-menu-system
 *
 * TRIGGERED BY:
 * User clicking "📋 Little Bites Tools" → "❓ Get Help"
 */
function getHelp() {
  const url = "https://github.com/cionelo/little-bites-menu-system/blob/master/HOWTO.md";
  const html = `<script>window.open('${url}', '_blank');google.script.host.close();</script>`;
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(1)
    .setHeight(1);
  SpreadsheetApp.getUi().showModalDialog(ui, 'Opening Help Documentation...');
}

// **************************************
// GENERATE KITCHEN PREP SUMMARY
// **************************************
/**
 * Creates a simplified "Kitchen Prep Summary" sheet from Orders totals row.
 *
 * PURPOSE:
 * Provides kitchen staff with an easy-to-read summary using abbreviated options
 * for faster prep and reduced reading time during busy service.
 *
 * PROCESS:
 * 1. Reads TOTALS row from Orders sheet
 * 2. Extracts item counts and options strings
 * 3. Abbreviates options using formatKitchenShorthand()
 * 4. Generates clean 3-column table: ITEM | QUANTITY | OPTIONS BREAKDOWN
 *
 * OUTPUT FORMAT:
 * - Items with options: "5x(E,CR), 3x(NE,MF)"
 * - Items without options: "—"
 *
 * REGENERATION:
 * - Can be regenerated at any time from current Orders data
 * - Not included in archive logic (always generate fresh as needed)
 * - Automatically clears and recreates sheet on each run
 *
 * TRIGGERED BY:
 * User clicking "📋 Little Bites Tools" → "👨‍🍳 Generate Kitchen Prep Summary"
 */
function generateKitchenSummary() {
  const ss = SpreadsheetApp.getActive();
  const ordersSheet = ss.getSheetByName("Orders");

  if (!ordersSheet) {
    SpreadsheetApp.getUi().alert("⚠️ Orders sheet not found. Please submit at least one order first.");
    return;
  }

  // Get or create Kitchen Prep Summary sheet
  let summarySheet = ss.getSheetByName("Kitchen Prep Summary");
  if (summarySheet) {
    summarySheet.clear(); // Clear existing data
  } else {
    summarySheet = ss.insertSheet("Kitchen Prep Summary");
  }

  // Get Orders data
  const lastRow = ordersSheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("⚠️ No orders found in Orders sheet.");
    return;
  }

  const headers = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getValues()[0];

  // Find TOTALS row
  let totalsRowIndex = -1;
  for (let i = lastRow; i >= 2; i--) {
    const cellValue = ordersSheet.getRange(i, 1).getValue();
    if (cellValue === "TOTALS") {
      totalsRowIndex = i;
      break;
    }
  }

  if (totalsRowIndex === -1) {
    SpreadsheetApp.getUi().alert("⚠️ TOTALS row not found in Orders sheet.");
    return;
  }

  // Get totals row data
  const totalsData = ordersSheet.getRange(totalsRowIndex, 1, 1, headers.length).getValues()[0];

  // Build kitchen-friendly summary
  const summaryData = [];
  summaryData.push(["ITEM", "QUANTITY", "OPTIONS BREAKDOWN"]); // Headers

  for (let i = 5; i < headers.length; i++) { // Start after base columns (Date, Name, Phone, Delivery, Email)
    const header = headers[i];
    const value = totalsData[i];

    // Skip if no value
    if (!value || value === "" || value === 0) continue;

    // Check if this is an options column
    if (header.includes(" - options")) {
      // This is an options column - format it with shorthand
      const itemName = header.replace(" - options", "");
      const shorthand = formatKitchenShorthand(value);

      // Find the corresponding item count
      const itemIndex = headers.indexOf(itemName);
      const itemCount = itemIndex !== -1 ? totalsData[itemIndex] : "";

      summaryData.push([itemName, itemCount, shorthand]);
    } else {
      // This is a regular item without options
      // Check if there's a corresponding options column
      const optionsColName = `${header} - options`;
      const hasOptionsCol = headers.includes(optionsColName);

      if (!hasOptionsCol) {
        // Item without options
        summaryData.push([header, value, "—"]);
      }
      // If it has options column, it will be handled in the options block above
    }
  }

  // Write to summary sheet
  if (summaryData.length > 1) { // More than just headers
    summarySheet.getRange(1, 1, summaryData.length, 3).setValues(summaryData);

    // Format header row
    summarySheet.getRange(1, 1, 1, 3)
      .setFontWeight("bold")
      .setBackground("#4a86e8")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");

    // Format data rows
    summarySheet.getRange(2, 1, summaryData.length - 1, 3)
      .setVerticalAlignment("top");

    // Set column widths
    summarySheet.setColumnWidth(1, 200); // Item name
    summarySheet.setColumnWidth(2, 100); // Quantity
    summarySheet.setColumnWidth(3, 400); // Options breakdown

    // Add borders
    summarySheet.getRange(1, 1, summaryData.length, 3)
      .setBorder(true, true, true, true, true, true);

    SpreadsheetApp.getUi().alert("✅ Kitchen Prep Summary generated successfully!\n\nCheck the 'Kitchen Prep Summary' tab.");
  } else {
    SpreadsheetApp.getUi().alert("⚠️ No items found to summarize.");
  }
}

// **************************************
// FORMAT KITCHEN SHORTHAND
// **************************************
/**
 * Converts full option strings into abbreviated kitchen shorthand.
 *
 * INPUT EXAMPLE:
 * "5x(egg, croissant), 3x(no egg, muffin), 1x(egg, bagel)"
 *
 * OUTPUT EXAMPLE:
 * "5x(E,CR), 3x(NE,MF), 1x(E,BG)"
 *
 * ALGORITHM:
 * 1. Splits input by ", " to get individual count+tuple pairs
 * 2. Uses regex to extract count and options list
 * 3. Calls abbreviate() on each option within tuple
 * 4. Rejoins with commas (no spaces between options in tuple)
 * 5. Returns final abbreviated string
 *
 * @param {string} optionsString - Aggregated options from Orders totals
 * @return {string} Abbreviated shorthand for kitchen
 */
function formatKitchenShorthand(optionsString) {
  if (!optionsString || optionsString === "") return "—";

  // Input: "5x(egg, croissant), 3x(no egg, muffin), 1x(egg, bagel)"
  // Output: "5x(E,CR), 3x(NE,MF), 1x(E,BG)"

  // Split by ", " to get individual count+tuple pairs
  const parts = optionsString.toString().split(", ");

  const shorthandParts = parts.map(part => {
    // Match pattern: "5x(egg, croissant)"
    const match = part.match(/^(\d+)x\((.+)\)$/);
    if (!match) return part; // Return as-is if doesn't match

    const count = match[1];
    const optionsList = match[2];

    // Abbreviate each option
    const abbreviatedOptions = optionsList.split(", ").map(opt => abbreviate(opt)).join(",");

    return `${count}x(${abbreviatedOptions})`;
  });

  return shorthandParts.join(", ");
}

// **************************************
// ABBREVIATE OPTION TEXT
// **************************************
/**
 * Abbreviates individual option text into 2-3 letter codes.
 *
 * ABBREVIATION STRATEGY:
 * 1. Checks predefined abbreviations dictionary first (case-insensitive)
 * 2. Falls back to first 2 uppercase letters for unknown options
 *
 * COMMON ABBREVIATIONS:
 * - egg → E, no egg → NE
 * - croissant → CR, muffin → MF, bagel → BG
 * - wrap → W, salad → S, salad bowl → SB
 * - chicken → CH, no chicken → NCH
 * - dressing → D, no dressing → ND
 * - hot → H, iced → I
 * - small → SM, medium → MD, large → LG
 * - sugar → SU, no sugar → NS
 *
 * EXTENSIBILITY:
 * Add new abbreviations to the abbreviations object as menu grows.
 *
 * @param {string} text - Full option text (e.g., "croissant")
 * @return {string} Abbreviated code (e.g., "CR")
 */
function abbreviate(text) {
  if (!text) return "";

  const trimmed = text.trim();

  // Common abbreviations
  const abbreviations = {
    "egg": "E",
    "no egg": "NE",
    "croissant": "CR",
    "muffin": "MF",
    "bagel": "BG",
    "wrap": "W",
    "salad": "S",
    "salad bowl": "SB",
    "chicken": "CH",
    "no chicken": "NCH",
    "dressing": "D",
    "no dressing": "ND",
    "hot": "H",
    "iced": "I",
    "small": "SM",
    "medium": "MD",
    "large": "LG",
    "sugar": "SU",
    "no sugar": "NS"
  };

  // Check if exact match exists
  const lowerText = trimmed.toLowerCase();
  if (abbreviations[lowerText]) {
    return abbreviations[lowerText];
  }

  // Fallback: Take first 2-3 letters and uppercase
  if (trimmed.length <= 3) {
    return trimmed.toUpperCase();
  } else {
    return trimmed.substring(0, 2).toUpperCase();
  }
}

// **************************************
// REBUILD ORDERS FROM ORDERS_JSON (MANUAL TOOL)
// **************************************
/**
 * Rebuilds the Orders sheet (kitchen prep format) from orders_json raw data.
 *
 * PURPOSE:
 * Recovery/maintenance tool that repopulates the Orders sheet using orders_json
 * as the source of truth. Use when the Orders sheet gets corrupted, manually
 * edited incorrectly, or needs to be regenerated from scratch.
 *
 * PROCESS:
 * 1. Reads Orders headers (must exist — run "Rebuild Orders Headers" first if needed)
 * 2. Reads all rows from orders_json (raw JSON in column F, customer info in A-E, H-I)
 * 3. Clears Orders data rows (keeps headers)
 * 4. Replays each order using the same writeToOrders logic:
 *    - Item count in the item column
 *    - Option tuples "(opt1, opt2), (opt1, opt2)" in the options column
 * 6. Rebuilds TOTALS row at the end
 *
 * ORDERS_JSON COLUMN LAYOUT:
 * A: Date | B: Name | C: Phone | D: Delivery | E: Email
 * F: Items JSON (raw) | G: Readable Summary | H: Buddy | I: Comments
 *
 * TRIGGERED BY:
 * User clicking "📋 Little Bites Tools" → "📝 Rebuild Orders from JSON"
 */
function buildOrdersFromJson() {
  const ss = SpreadsheetApp.getActive();
  const ordersJsonSheet = ss.getSheetByName("orders_json");
  const ordersSheet = ss.getSheetByName("Orders");

  if (!ordersJsonSheet) {
    SpreadsheetApp.getUi().alert("⚠️ orders_json sheet not found.");
    return;
  }
  if (!ordersSheet) {
    SpreadsheetApp.getUi().alert(
      "⚠️ Orders sheet not found.\n\n" +
      "Run '🛠️ Rebuild Orders Headers' first to create the Orders sheet, then try again."
    );
    return;
  }

  // Get Orders headers (must already exist)
  const ordersHeaders = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getValues()[0];
  if (ordersHeaders.length < 6) {
    SpreadsheetApp.getUi().alert(
      "⚠️ Orders sheet has too few columns.\n\n" +
      "Run '🛠️ Rebuild Orders Headers' first to set up columns, then try again."
    );
    return;
  }

  // Determine data range in orders_json
  const lastRow = ordersJsonSheet.getLastRow();
  const lastCol = ordersJsonSheet.getLastColumn();
  if (lastRow < 1 || lastCol < 6) {
    SpreadsheetApp.getUi().alert("⚠️ orders_json sheet has no data or is missing columns.");
    return;
  }

  // Detect if row 1 is a header row
  const firstCell = ordersJsonSheet.getRange(1, 1).getValue();
  const hasHeaders = (typeof firstCell === "string" && firstCell.toLowerCase() === "date");
  const dataStartRow = hasHeaders ? 2 : 1;

  if (dataStartRow > lastRow) {
    SpreadsheetApp.getUi().alert("⚠️ No data rows found in orders_json.");
    return;
  }

  // Read all data rows from orders_json
  const numDataRows = lastRow - dataStartRow + 1;
  const dataRows = ordersJsonSheet.getRange(dataStartRow, 1, numDataRows, lastCol).getValues();

  // Column indices in orders_json (0-based)
  const JSON_COL = 5; // Column F: raw JSON items

  // --- Clear Orders data and replay from orders_json ---

  // Clear existing data rows in Orders (keep header row)
  const ordersLastRow = ordersSheet.getLastRow();
  if (ordersLastRow > 1) {
    ordersSheet.deleteRows(2, ordersLastRow - 1);
  }

  // Replay each order using the same logic as writeToOrders
  let replayedCount = 0;

  dataRows.forEach((row, i) => {
    const jsonStr = row[JSON_COL];
    if (!jsonStr || jsonStr.toString().trim() === "") return;

    try {
      const items = JSON.parse(jsonStr);

      // Build a payload object matching what writeToOrders expects
      const payload = {
        name: row[1],      // Column B
        phone: row[2],     // Column C
        delivery: row[3],  // Column D
        email: row[4],     // Column E
        items: items
      };

      // Use the original date from orders_json instead of new Date()
      const originalDate = row[0];

      // --- Replicate writeToOrders logic exactly ---
      const headers = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getValues()[0];
      const rowData = new Array(headers.length).fill("");

      // Fill base info (use original date)
      rowData[0] = originalDate;
      rowData[1] = payload.name;
      rowData[2] = payload.phone;
      rowData[3] = payload.delivery;
      rowData[4] = payload.email;

      // Process items - group by item name to collect all instances
      const itemOptionsMap = {};

      payload.items.forEach(item => {
        if (!itemOptionsMap[item.name]) {
          itemOptionsMap[item.name] = [];
        }

        if (item.instances && item.instances.length > 0) {
          item.instances.forEach(instance => {
            const instanceOptions = instance.options.filter(Boolean);
            itemOptionsMap[item.name].push(instanceOptions);
          });
        } else {
          const qty = item.qty || 0;
          const instanceOptions = item.selectedOptions ? item.selectedOptions.filter(Boolean) : [];
          for (let q = 0; q < qty; q++) {
            itemOptionsMap[item.name].push(instanceOptions);
          }
        }
      });

      // Write item counts and option tuples
      Object.keys(itemOptionsMap).forEach(itemName => {
        const instances = itemOptionsMap[itemName];

        const itemColIndex = headers.indexOf(itemName);
        if (itemColIndex !== -1) {
          rowData[itemColIndex] = instances.length;
        }

        const optionsColName = `${itemName} - options`;
        const optionsColIndex = headers.indexOf(optionsColName);

        if (optionsColIndex !== -1) {
          const optionsString = instances.map(opts => {
            return opts.length > 0 ? `(${opts.join(", ")})` : "";
          }).filter(Boolean).join(", ");

          rowData[optionsColIndex] = optionsString;
        }
      });

      ordersSheet.appendRow(rowData);
      replayedCount++;
    } catch (e) {
      // Skip rows with unparseable JSON
    }
  });

  // Rebuild totals row at the end (once, after all rows)
  if (replayedCount > 0) {
    updateTotalsRow(ordersSheet);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Orders sheet rebuilt from orders_json.\n\n` +
    `${replayedCount} order(s) replayed with totals recalculated.`
  );
}
