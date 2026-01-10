# Little Bites Menu System - Quick Setup Guide

## Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "Little Bites Orders"
3. Create **three tabs** with these exact names:
   - `Menu`
   - `orders_json`
   - `Orders`
4. **Optional**: Right-click the `orders_json` tab and select "Hide sheet" (this tab stores backup data)

## Step 2: Set Up Your Menu Tab

In the **Menu** tab, create these column headers in row 1:

| category | name | price | options | description |
|----------|------|-------|---------|-------------|

**Example menu items:**

| category | name | price | options | description |
|----------|------|-------|---------|-------------|
| Breakfast | breakfast sandwich | 8.50 | egg/no egg\|croissant/muffin/bagel | Fresh egg on your choice of bread |
| Beverages | coffee | 3.00 | hot/iced\|small/medium/large | Freshly brewed coffee |
| Salads | salad | 7.00 | chicken/no chicken\|dressing/no dressing | Fresh garden salad |

**Options format:**
- Use `/` to separate choices: `egg/no egg`
- Use `|` to separate option groups: `egg/no egg|croissant/muffin`
- Leave blank if item has no options

## Step 3: Install the Backend Code

1. In your Google Sheet, go to **Extensions** → **Apps Script**
2. Delete any default code in the editor
3. Copy **all the code** from `AppsScript.gs`
4. Paste it into the Apps Script editor
5. Click the **Save** icon (💾)
6. Click **Deploy** → **New deployment**
7. Click the gear icon ⚙️ next to "Select type"
8. Choose **Web app**
9. Configure settings:
   - **Execute as:** Me
   - **Who has access:** Anyone
10. Click **Deploy**
11. Click **Authorize access** (approve the permissions)
12. **Copy the Web app URL** (you'll need this in Step 4)

## Step 4: Configure Your Website Files

1. Open the `app.js` file
2. Find line 58 (near the top)
3. Replace the URL with your deployment URL from Step 3:
   ```javascript
   const BACKEND_URL = "YOUR_DEPLOYMENT_URL_HERE";
   ```
4. Save the file

## Step 5: Upload to Your Web Server

Upload these three files to your web hosting:
- `index.html`
- `styles.css`
- `app.js`

## Step 6: Test It!

1. Visit your website where you uploaded the files
2. Try placing a test order:
   - Fill in your name, phone, delivery preference, and email (all required)
   - Add items and select options
   - Click "Submit Order"
3. Check your Google Sheet:
   - **orders_json** tab: Raw order data (can be hidden)
   - **Orders** tab: Kitchen-friendly format

---

## Daily Usage

### Viewing Orders

- **Orders tab:** Kitchen prep view with item counts and options
- **orders_json tab:** Raw customer details and complete order info (typically hidden)
- Look at the **TOTALS** row at the bottom of Orders tab for daily summary

### Kitchen Prep Summary (Optional)

For an even simpler kitchen view:
1. Click **📋 Little Bites Tools** menu in Google Sheets
2. Select **👨‍🍳 Generate Kitchen Prep Summary**
3. View the new "Kitchen Prep Summary" tab

### End of Day Cleanup

1. Click **📋 Little Bites Tools** menu
2. Select **🔄 Archive & Clear Orders**
3. This will:
   - Create timestamped backups of your data
   - Clear orders_json and Orders tabs (keeps headers)
   - Keep your Menu intact

### Updating Menu Items

1. Edit the **Menu** tab (add/remove/change items)
2. Click **📋 Little Bites Tools** menu
3. Select **🛠️ Rebuild Orders Headers**
4. This updates the Orders tab to match your new menu

---

## Troubleshooting

**Menu not loading on website:**
- Check that `BACKEND_URL` in `app.js` matches your deployment URL
- Verify Apps Script deployment has "Who has access: Anyone"

**Orders not appearing in sheet:**
- Make sure tab names are exactly: `Menu`, `orders_json`, `Orders`
- Check browser console for errors (press F12)

**Need to redeploy after code changes:**
1. In Apps Script, click **Deploy** → **Manage deployments**
2. Click **Edit** (pencil icon)
3. Change version to **New version**
4. Click **Deploy**

---

## Customer Validation

The system automatically prevents incomplete orders:

✅ **Required fields:**
- Name (first & last)
- Phone number (minimum 10 digits)
- Pickup or Office Delivery
- Email (valid format required)

✅ **Optional fields:**
- Bite Buddy
- Comments

Customers cannot submit until all required info is filled in and all menu options are selected.

---

**Questions?** Check the full README.md for detailed documentation.
