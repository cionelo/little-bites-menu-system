/**
 * Little Bites Menu System - Backend (Google Apps Script)
 *
 * PURPOSE:
 * This Apps Script serves as the backend for the Little Bites online menu ordering system.
 * It connects to a Google Spreadsheet with two main tabs: "Menu" and "Orders-2".
 *
 * SPREADSHEET STRUCTURE:
 * - Menu Sheet: Contains menu items with columns: name, price, description, options
 *   - Options format: "choice1/choice2|choice3/choice4" (pipe separates option groups, slash separates choices)
 *   - Example: "egg/no egg|croissant/muffin" = two option groups (egg choice and bread choice)
 *
 * - Orders Sheet: Stores raw order data with readable summary
 * - Orders-2 Sheet: Kitchen prep format with item counts and formatted options
 *   - Format: item columns + "{item name} - options" columns
 *   - Options display: "(opt1, opt2), (opt1, opt2)" for easy kitchen reading
 *
 * KEY FEATURES:
 * - GET endpoint: Returns menu data as JSON
 * - POST endpoint: Receives orders and writes to both Orders and Orders-2 sheets
 * - Dynamic header generation: Orders-2 headers auto-update based on Menu sheet
 * - Options formatting: Groups instance options as "(option1, option2), (option1, option2)"
 * - Archive & clear functionality: Built-in menu tool for end-of-day operations
 *
 * RECENT UPDATES:
 * - Changed Orders-2 from multiple option columns to single options column per item
 * - Options now formatted as comma-separated tuples for kitchen readability
 * - Frontend validation ensures all options are selected before submission
 *
 * @version 2.0
 * @date 2025-12-15
 */

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

  return ContentService
    .createTextOutput(JSON.stringify({ menu: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

// **************************************
// ORDER SUBMISSION (POST REQUEST)
// **************************************
function doPost(e) {
  const ss = SpreadsheetApp.getActive();
  const ordersSheet = ss.getSheetByName("Orders");
  const orders2Sheet = getOrCreateOrders2Sheet();

  const payload = JSON.parse(e.postData.contents);

  // Build readable order summary for "Orders" tab
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

  // Write to "Orders" tab (original format)
  ordersSheet.appendRow([
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

  // Write to "Orders-2" tab (kitchen prep format)
  writeToOrders2(orders2Sheet, payload);

  return ContentService.createTextOutput("OK");
}

// **************************************
// GET OR CREATE ORDERS-2 SHEET
// **************************************
function getOrCreateOrders2Sheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("Orders-2");

  if (!sheet) {
    sheet = ss.insertSheet("Orders-2");
    initializeOrders2Headers(sheet);
  }

  return sheet;
}

// **************************************
// INITIALIZE ORDERS-2 HEADERS
// **************************************
function initializeOrders2Headers(sheet) {
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
// WRITE ORDER TO ORDERS-2 (KITCHEN PREP)
// **************************************
function writeToOrders2(sheet, payload) {
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

  // Build totals formulas
  const totalsData = headers.map((header, idx) => {
    const colLetter = columnToLetter(idx + 1);

    // Skip formula for text columns
    if (idx < 5) {
      return idx === 0 ? "TOTALS" : "";
    }

    // SUM formula for item/option columns (skip header row, exclude totals row)
    return `=SUM(${colLetter}2:${colLetter}${currentLastRow})`;
  });

  // Write totals row at the very bottom
  sheet.appendRow(totalsData);
  sheet.getRange(totalsRow, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#f3f3f3");
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

  // Archive Orders
  const ordersSheet = ss.getSheetByName("Orders");
  if (ordersSheet) {
    const ordersArchive = ordersSheet.copyTo(ss);
    ordersArchive.setName(`Orders_Archive_${timestamp}`);

    // Clear Orders (keep headers)
    const lastRow = ordersSheet.getLastRow();
    if (lastRow > 1) {
      ordersSheet.deleteRows(2, lastRow - 1);
    }
  }

  // Archive and clear Orders-2
  const orders2Sheet = ss.getSheetByName("Orders-2");
  if (orders2Sheet) {
    const orders2Archive = orders2Sheet.copyTo(ss);
    orders2Archive.setName(`Orders-2_Archive_${timestamp}`);

    // Clear Orders-2 (keep headers, remove totals)
    const lastRow = orders2Sheet.getLastRow();
    if (lastRow > 1) {
      orders2Sheet.deleteRows(2, lastRow - 1);
    }
  }

  SpreadsheetApp.getUi().alert(`✅ Archive created: ${timestamp}\n\nOrders and Orders-2 have been cleared.`);
}

// **************************************
// CUSTOM MENU (RUNS ON OPEN)
// **************************************
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 Little Bites Tools')
    .addItem('🔄 Archive & Clear Orders', 'archiveAndClear')
    .addItem('🛠️ Rebuild Orders-2 Headers', 'rebuildOrders2Headers')
    .addToUi();
}

// **************************************
// REBUILD ORDERS-2 HEADERS (MANUAL TOOL)
// **************************************
function rebuildOrders2Headers() {
  const sheet = getOrCreateOrders2Sheet();
  initializeOrders2Headers(sheet);
  SpreadsheetApp.getUi().alert("✅ Orders-2 headers have been rebuilt based on current Menu.");
}
