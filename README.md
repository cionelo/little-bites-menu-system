# Little Bites Menu System

A complete online menu ordering system that replaces Google Forms with a polished, user-friendly interface. Built with vanilla JavaScript and Google Apps Script backend.

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [File Structure](#file-structure)
- [Setup Instructions](#setup-instructions)
- [How It Works](#how-it-works)
- [Menu Sheet Format](#menu-sheet-format)
- [Orders Kitchen Format](#orders-kitchen-format)
- [Recent Updates](#recent-updates)
- [Future Enhancements](#future-enhancements)

---

## Overview

The Little Bites Menu System provides a seamless ordering experience for weekly menu items. Customers can:
- View menu items with prices and descriptions
- Select quantities and customize options per item instance
- Submit orders that automatically populate Google Sheets for kitchen prep

**Key Benefits:**
- ✅ **Kitchen-friendly**: Orders sheet shows exactly what to prepare in easy-to-read format
- ✅ **Per-instance options**: Each item gets individual customization (e.g., 3 sandwiches can have different toppings)
- ✅ **Validation**: Prevents incomplete orders with helpful error messages
- ✅ **Dynamic**: Menu updates automatically from Google Sheets
- ✅ **Polished UX**: Animated buttons, pill selectors, and responsive design

---

## System Architecture

```
┌─────────────────┐
│   Frontend      │
│  (HTML/CSS/JS)  │
│                 │
│  - index.html   │
│  - styles.css   │
│  - app.js       │
└────────┬────────┘
         │
         │ GET /doGet (fetch menu)
         │ POST /doPost (submit order)
         │
         ▼
┌─────────────────┐
│  Google Apps    │
│     Script      │
│                 │
│ AppsScript.gs   │
└────────┬────────┘
         │
         │ Read/Write
         │
         ▼
┌─────────────────┐
│ Google Sheets   │
│                 │
│  - Menu         │
│  - orders_json  │
│  - Orders       │
└─────────────────┘
```

---

## File Structure

```
little-bites-menu-system/
│
├── index.html          # Main HTML structure (form, sections, sticky footer)
├── styles.css          # Complete styling with animations
├── app.js              # Frontend logic (menu rendering, validation, submission)
├── AppsScript.gs       # Backend (Google Sheets integration)
└── README.md           # This file
```

### File Descriptions

| File | Purpose | Key Features |
|------|---------|--------------|
| **index.html** | Page structure | Customer info form, dynamic menu area, sticky footer |
| **styles.css** | Visual styling | Blue theme, card layout, button/pill animations |
| **app.js** | Client logic | Menu rendering, option management, validation, submission |
| **AppsScript.gs** | Backend API | Menu fetch, order processing, Orders formatting |

---

## Setup Instructions

### 1. Google Sheets Setup

Create a new Google Sheet with these tabs:

#### **Menu Tab**
Columns: `category`, `name`, `price`, `options`, `description`

Example:
```
category   | name                | price | options                        | description
-----------|---------------------|-------|--------------------------------|-----------------------------
Breakfast  | breakfast sandwich  | 8.50  | egg/no egg|croissant/muffin    | Fresh egg on your choice...
Beverages  | coffee              | 3.00  | hot/iced|small/medium/large    | Freshly brewed coffee
```

**Options Format:**
- Use `/` to separate choices within an option group
- Use `|` to separate different option groups
- Example: `egg/no egg|croissant/muffin` = 2 groups (egg choice + bread choice)

#### **orders_json Tab**
Auto-generated columns (no setup needed):
- Date, Name, Phone, Delivery, Email, Items (JSON), Readable Summary, Buddy, Comments
- **Note**: This tab can be hidden from view as it's primarily for data backup

#### **Orders Tab**
Auto-generated based on Menu (kitchen prep format)

### 2. Apps Script Deployment

1. Open your Google Sheet
2. Go to **Extensions** → **Apps Script**
3. Delete any default code
4. Copy the entire contents of `AppsScript.gs` into the editor
5. Click **Deploy** → **New deployment**
6. Select type: **Web app**
7. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** and copy the deployment URL

### 3. Frontend Configuration

1. Open `app.js`
2. Update line 58 with your deployment URL:
   ```javascript
   const BACKEND_URL = "YOUR_DEPLOYMENT_URL_HERE";
   ```
3. Host `index.html`, `styles.css`, and `app.js` on your web server

### 4. Squarespace Embedding (Optional)

If embedding in Squarespace:
1. Create a page for your menu
2. Add a **Code Block**
3. Insert:
   ```html
   <div id="meal-app"></div>
   <link rel="stylesheet" href="https://your-domain.com/styles.css">
   <script src="https://your-domain.com/app.js"></script>
   ```

---

## How It Works

### Customer Journey

1. **Load Menu**
   - Page loads → `app.js` fetches menu from Google Sheets via `doGet()`
   - Menu items render as cards with prices, descriptions

2. **Build Order**
   - Customer adjusts quantities with +/- buttons
   - For each quantity, option selectors appear (Item #1, Item #2, etc.)
   - Customer selects options from pill buttons
   - Subtotal updates in real-time

3. **Submit Order**
   - Customer fills in contact info and clicks "Submit Order"
   - **Validation runs**: Ensures all options selected
   - If valid → Order POSTs to `doPost()`
   - Success → Confirmation screen

4. **Backend Processing**
   - Order written to **orders_json** tab (raw JSON + readable summary)
   - Order written to **Orders** tab (kitchen prep format)
   - Totals row updated

### Data Flow Example

**Customer orders:**
- 3x breakfast sandwich
  - Item #1: egg, croissant
  - Item #2: egg, croissant
  - Item #3: no egg, muffin

**Payload sent to backend:**
```json
{
  "name": "John Doe",
  "items": [
    {
      "name": "breakfast sandwich",
      "qty": 3,
      "instances": [
        { "options": ["egg", "croissant"] },
        { "options": ["egg", "croissant"] },
        { "options": ["no egg", "muffin"] }
      ]
    }
  ]
}
```

**Orders tab output:**
```
breakfast sandwich | breakfast sandwich - options
3                  | (egg, croissant), (egg, croissant), (no egg, muffin)
```

---

## Menu Sheet Format

### Column Definitions

| Column | Required | Format | Example |
|--------|----------|--------|---------|
| **category** | Optional | Text | `Breakfast`, `Beverages`, `Salads` |
| **name** | Yes | Text | `breakfast sandwich` |
| **price** | Yes | Number | `8.50` |
| **options** | Optional | `choice1/choice2\|group2choice1/group2choice2` | `egg/no egg\|croissant/muffin` |
| **description** | Optional | Text | `Fresh egg on your choice of bread` |

### Options Syntax

**Single option group:**
```
small/medium/large
```

**Multiple option groups:**
```
hot/iced|small/medium/large|sugar/no sugar
```

This creates 3 separate pill rows:
1. hot / iced
2. small / medium / large
3. sugar / no sugar

---

## Orders Kitchen Format

### Purpose
The Orders sheet is optimized for kitchen staff to quickly see what needs to be prepared.

### Format

**Before (v1.0 - hard to read):**
```
breakfast sandwich | bf_egg | bf_no egg | bf_croissant | bf_muffin
3                  | 2       | 1         | 2            | 1
```
❌ Kitchen has to mentally piece together which options go together

**After (v2.0 - easy to read):**
```
breakfast sandwich | breakfast sandwich - options
3                  | (egg, croissant), (egg, croissant), (no egg, muffin)
```
✅ Kitchen instantly sees:
- 3 total breakfast sandwiches
- 2 with egg & croissant
- 1 with no egg & muffin

### Column Generation

- **Items without options**: Single column with count
- **Items with options**: Two columns
  1. Item name (count)
  2. `{item name} - options` (formatted option tuples)

### Totals Row
Auto-calculated totals appear at the bottom, updated after each order.

---

## Recent Updates

### Version 2.1 (2026-01-09)

#### 🔧 **Multi-Option Item State Preservation**
- **Fixed**: When adding multiple quantities of items with options, previous selections are now preserved
- **How it works**: Adding item #2 keeps item #1's options intact, with item #2 showing unselected options
- **Benefit**: Customers can customize each item instance without losing previous selections

#### 🍪 **Cookie Favicon**
- Added cookie emoji (🍪) as site favicon for better brand recognition in browser tabs

#### 📱 **Mobile-First Improvements**
- **Subtotal Layout**: Changed from right-aligned to left-justified with "Tax not included" note
- **Phone Input**: Added `type="tel"` with `inputmode="tel"` to trigger native phone keypad on mobile
- **Submit Button**: Fixed overflow issues - now fits perfectly on all screen sizes (mobile & desktop)
- **Sticky Footer**: Improved responsive behavior with proper box-sizing

#### ✨ **Enhanced Customer Info Validation**
- Name, phone, delivery, and email fields now validate on submit
- Visual feedback with red borders and error messages
- Phone validation ensures minimum 10 digits
- Email validation checks for proper format

### Version 2.0 (2025-12-15)

#### 🔄 **Orders Formatting Overhaul**
- **Changed from**: Multiple columns per option choice (e.g., `item_egg`, `item_no egg`)
- **Changed to**: Single options column with tuple format: `(opt1, opt2), (opt1, opt2)`
- **Benefit**: Drastically improved kitchen readability

#### ✅ **Frontend Validation**
- Added comprehensive validation before submission
- Error messages: `"Please pick an option for {item} (Item #{n}) to submit your order"`
- Prevents incomplete orders from reaching the kitchen

#### 🎨 **Enhanced UI/UX**
- **Submit button animations**:
  - Hover: Lifts with enhanced shadow
  - Active: Presses down with scale effect
  - Submitting: Pulsing animation
  - Disabled: Grayed out with cursor change

- **Quantity button animations**:
  - Hover: Inverts to blue background
  - Active: Scale down press effect

- **Pill selector animations**:
  - Hover: Lighter blue + border + lift
  - Active: Scale down
  - Selected: Blue background + shadow

#### 🛠️ **Backend Improvements**
- Refactored `writeToOrders()` to group instances by item
- Options formatting logic: `(opt1, opt2), (opt1, opt2), ...`
- Updated `initializeOrdersHeaders()` for new column structure

---

## Google Sheets Tools

The system includes built-in menu tools accessible from the Google Sheets interface:

### 📋 Little Bites Tools Menu

#### 🔄 Archive & Clear Orders
- Creates timestamped archives of Menu, orders_json, and Orders sheets
- Clears orders_json and Orders (keeps headers)
- Recommended: Run at end of each day/week

#### 🛠️ Rebuild Orders Headers
- Regenerates Orders columns based on current Menu
- Use when you add/remove menu items or change options
- Ensures column headers match available menu items

#### 🔢 Refresh Totals
- Recalculates the TOTALS row in the Orders sheet
- Use after manually deleting test orders or editing data
- Removes old TOTALS rows and generates fresh calculations
- Ensures totals stay in sync with actual order data

#### 👨‍🍳 Generate Kitchen Prep Summary
- Creates simplified "Kitchen Prep Summary" sheet from Orders totals
- Uses abbreviated options for faster kitchen reading
- Example: "5x(E,CR)" instead of "5x(egg, croissant)"
- Can be regenerated anytime from current data

#### ❓ Get Help
- Opens the HOWTO.md documentation in a new browser tab
- Quick access to setup guide and troubleshooting
- Direct link to GitHub repository documentation

---

## Future Enhancements

### Potential Features
- [ ] Email confirmations to customers
- [ ] Admin dashboard for order management
- [ ] Real-time order notifications (Slack/Discord integration)
- [ ] Order history and analytics
- [ ] Dietary restrictions/allergen filters
- [ ] Multiple pickup time slots
- [ ] Payment integration (Stripe, Square)
- [ ] Customer accounts with saved preferences

### Technical Improvements
- [ ] TypeScript migration
- [ ] Unit tests for validation logic
- [ ] E2E testing with Playwright
- [ ] Progressive Web App (PWA) support
- [ ] Offline mode with local storage

---

## Troubleshooting

### Common Issues

**Menu not loading**
- Check `BACKEND_URL` in `app.js` matches your deployment URL
- Verify Apps Script deployment is set to "Anyone" access
- Check browser console for CORS or network errors

**Options not appearing**
- Verify Menu sheet has proper `options` syntax (use `/` and `|`)
- Check for extra spaces or special characters
- Rebuild Orders headers from Google Sheets menu

**Orders formatting wrong**
- Run "🛠️ Rebuild Orders Headers" from Sheets menu
- Verify you're using the latest version of `AppsScript.gs`
- Check that menu items have consistent naming

**Validation errors**
- Ensure all option groups have selections
- Check that quantity > 0 before validation
- Verify DOM IDs match expected format

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **2.1** | 2026-01-09 | Multi-option state preservation, cookie favicon, mobile improvements, enhanced validation |
| **2.0** | 2025-12-15 | Orders format overhaul, validation, animations |
| **1.5** | 2025-12-14 | Per-instance options system |
| **1.0** | 2025-12-02 | Initial release |

---

## Support

For issues, questions, or feature requests, please open an issue in the repository.

---

**Built with ❤️ for Little Bites**

*Last updated: January 9, 2026*
