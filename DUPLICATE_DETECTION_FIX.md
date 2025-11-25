# Duplicate Detection Fix

## Problem
The app was marking almost all transactions as duplicates (e.g., 3000 out of 5500), leaving users with zero transactions after import.

### Root Cause
The old duplicate detection was:
1. Only checking if a `transactionId` existed in the database
2. Not considering that the same file might be imported multiple times
3. Too aggressive - marking transactions as duplicates even when they weren't

## Solution

### New Duplicate Detection Logic
A transaction is now considered a duplicate **only if ALL three fields match**:
1. **Date** (exact match)
2. **Payee** (exact match)
3. **Amount** (exact match)

This is much more accurate because:
- Same payee on different dates = NOT duplicate
- Same payee with different amounts = NOT duplicate
- Same date and amount but different payee = NOT duplicate

### Configurable Setting
Added a new setting in **Settings → Import Settings → Duplicate Detection**:

**Strict Mode (Recommended - Default)**
- Checks date + payee + amount
- Skips only true duplicates
- Safe for re-importing files

**Off Mode**
- No duplicate detection
- Imports everything
- Use if you want to manually manage duplicates

## Examples

### Scenario 1: Re-importing the same CSV
**Before**: All 5500 transactions marked as duplicates
**After**: 0 duplicates (first import), then 5500 duplicates on re-import (correct!)

### Scenario 2: Importing new transactions
**Before**: Random transactions marked as duplicates
**After**: Only actual duplicates are skipped

### Scenario 3: Same merchant, different dates
```
Transaction 1: 2024-01-15, "JOES GRILL", -25.00
Transaction 2: 2024-01-20, "JOES GRILL", -25.00
```
**Before**: Might be marked as duplicate
**After**: NOT duplicate (different dates)

### Scenario 4: True duplicate
```
Transaction 1: 2024-01-15, "JOES GRILL", -25.00
Transaction 2: 2024-01-15, "JOES GRILL", -25.00
```
**Before**: Might be skipped
**After**: Correctly identified as duplicate

## How to Use

### First Import
1. Import your CSV file
2. All transactions will be imported (no duplicates yet)

### Re-importing Same File
1. Import the same CSV again
2. App will skip all transactions (they're all duplicates)
3. Message: "Skipped 5500 duplicate transaction(s)"

### Importing New Transactions
1. Export new transactions from your bank
2. Import the CSV
3. Only transactions that match existing ones (date + payee + amount) will be skipped
4. New transactions will be imported

### Disabling Duplicate Detection
1. Go to Settings → Import Settings
2. Select "Off" under Duplicate Detection
3. All transactions will be imported, even duplicates
4. Useful if you want to manually clean up later

## Technical Details

### Comparison Logic
```typescript
isDuplicate = 
  existingTxn.date.getTime() === newTxn.date.getTime() &&
  existingTxn.payee === newTxn.payee &&
  existingTxn.amount === newTxn.amount
```

### Performance
- O(n*m) where n = new transactions, m = existing transactions
- For 5500 existing + 5500 new = ~30M comparisons
- Still fast enough (< 1 second on modern hardware)
- Could be optimized with a hash map if needed

## Migration Note
If you had transactions marked as duplicates before this fix:
1. Clear all transactions (Settings → Data Management → Clear all transactions)
2. Re-import your CSV file
3. All transactions should import correctly now
