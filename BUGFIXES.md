# Bug Fixes

## ✅ Fixed Issues

### 1. Theme Reverting to Light
**Problem**: When applying renaming rules or categorization, the app would reload and theme settings would revert to light mode.

**Solution**: 
- Removed `window.location.reload()` calls
- Implemented state-based re-rendering using filter state trick
- Theme now persists correctly across all operations

### 2. Categorization Not Applying
**Problem**: When prompted to categorize all matching transactions, the categorization would not actually apply.

**Solution**:
- Fixed the `applyPatternRule` function to properly call `onBulkUpdate`
- Ensured category is applied to all transactions matching the pattern
- Added state refresh to show changes immediately

### 3. Duplicate Renaming Prompts
**Problem**: App would prompt to create renaming rules for payees that already have rules.

**Solution**:
- Added check to see if a renaming rule already exists before showing dialog
- If rule exists, only shows "Apply category to all" option
- If no rule exists, shows both "Create rule + categorize" and "Just categorize" options
- Prevents duplicate rules and unnecessary prompts

### 4. Transaction Ordering
**Problem**: Transactions were not sorted, making it hard to find recent transactions.

**Solution**:
- Added sorting by Date, Payee, and Amount
- Default sort: Date (newest first)
- Click column headers to sort
- Click again to reverse sort direction
- Visual indicators (arrows) show current sort field and direction

## How It Works Now

### Categorization Flow
1. User selects category for a transaction (e.g., "JOES GRILL &/25-11-17" → "Restaurant")
2. App extracts pattern: "JOES GRILL"
3. App checks if renaming rule exists for this pattern
4. Shows appropriate dialog:
   - **If no rule exists**: Offers "Create rule + categorize" or "Just categorize"
   - **If rule exists**: Only offers "Apply category to all"
5. User chooses option
6. All matching transactions are categorized immediately
7. If rule was created, payee names are cleaned up on next render

### Sorting
- Click "Date" header: Sort by date (newest first by default)
- Click "Payee" header: Sort alphabetically (A-Z by default)
- Click "Amount" header: Sort by amount (lowest first by default)
- Click same header again: Reverse sort direction
- Arrow indicators show current sort state

## Testing Checklist

- [x] Theme persists after creating renaming rules
- [x] Theme persists after bulk categorization
- [x] Categorization applies to all matching transactions
- [x] No duplicate prompts for already-renamed payees
- [x] Transactions sort by date (newest first) by default
- [x] Can sort by payee and amount
- [x] Sort direction toggles on repeated clicks
- [x] Visual feedback for current sort state
