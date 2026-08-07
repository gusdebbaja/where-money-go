# Smart Categorization Feature

## ✅ Implemented Features

### 1. Smart Categorization Button in Transactions
**Location**: Transactions page, next to the filter input
**Button**: Purple "Smart Categorization" button with brain icon

### 2. Dynamic Payee Normalization
**What it does**:
- Strips digits and transaction IDs from payee names
- Removes dates and reference numbers
- Applies user's existing renaming rules first
- Examples:
  - "UBER A 12930123" → "UBER"
  - "Large Retail/21 12930" → "Large Retail"
  - "JOES GRILL &/25-11-17" → "JOES GRILL"

### 3. Multi-Method Category Suggestion
**4 Different Methods** (in priority order):

1. **User Rules** (Highest Priority)
   - Custom category rules created by user
   - Supports regex patterns
   - Confidence set by user

2. **Keyword Matching**
   - Built-in keywords for common merchants
   - High confidence for known brands (Netflix, Spotify, etc.)
   - Covers: Food, Transportation, Shopping, Bills, Healthcare, etc.

3. **Pattern Recognition**
   - Analyzes payee names for category indicators
   - Examples: "restaurant", "market", "gas station", "pharmacy"
   - Medium confidence

4. **Similarity Matching**
   - Compares to existing categorized transactions
   - Uses string similarity algorithms
   - Lower confidence but catches edge cases

### 4. Smart Suggestions Dialog
**Features**:
- Shows all uncategorized transactions with suggestions
- Displays confidence levels (color-coded)
- Shows method used for each suggestion
- Checkbox selection for bulk application
- Preview of normalized payee names

**Information Displayed**:
- Original payee → Normalized payee
- Suggested category with confidence %
- Number of transactions affected
- Total amount involved
- Method used (user_rule, keyword, pattern, similarity)

### 5. Automatic Rule Creation
**When you apply suggestions**:
1. **Renaming Rule**: Cleans up payee name for future transactions
2. **Category Rule**: Automatically categorizes future similar transactions
3. **Immediate Application**: Categorizes existing uncategorized transactions

## How to Use

### Step 1: Click Smart Categorization
1. Go to Transactions page
2. Click the purple "Smart Categorization" button
3. System analyzes all uncategorized transactions

### Step 2: Review Suggestions
- Green confidence (80%+): Very reliable
- Yellow confidence (60-79%): Good
- Red confidence (60%-): Use caution
- Check the method used for each suggestion

### Step 3: Select & Apply
1. Check boxes for suggestions you want to apply
2. Use "Select All" or choose individually
3. Click "Apply Selected" button
4. System creates rules and categorizes transactions

### Step 4: Future Automation
- New transactions matching patterns are automatically:
  - Cleaned up (payee names normalized)
  - Categorized based on created rules

## Examples

### Example 1: Uber Transactions
**Before**: "UBER A 12930123", "UBER B 45678901", "UBER C 78901234"
**After Smart Categorization**:
- All normalized to "UBER"
- All categorized as "Uber"
- Future Uber transactions automatically handled

### Example 2: Grocery Stores
**Before**: "ICA SUPERMARKET 123", "ICA STORE 456", "ICA MAXI 789"
**After Smart Categorization**:
- All normalized to "ICA"
- All categorized as "Groceries"
- Rule created for future ICA transactions

### Example 3: Unknown Restaurant
**Before**: "JOES GRILL &/25-11-17"
**Smart Analysis**:
- Normalized to "JOES GRILL"
- Pattern recognition detects "GRILL" → suggests "Restaurant"
- Medium confidence (70%)
- User can accept or modify

## User Customization

### Creating Custom Category Rules
1. Go to Settings → Smart Category Rules
2. Add patterns for specific merchants
3. Set confidence levels
4. Use regex for advanced patterns

### Example Custom Rules:
```
Pattern: ^UBER.*
Category: Uber
Confidence: 95%
Type: Regex

Pattern: JOES GRILL
Category: My Favorite Restaurant
Confidence: 90%
Type: Text
```

## Benefits

### For Users
1. **Time Saving**: Categorize hundreds of transactions in seconds
2. **Consistency**: Standardized payee names and categories
3. **Automation**: Future transactions handled automatically
4. **Accuracy**: Multiple methods ensure good suggestions

### For Data Quality
1. **Clean Payee Names**: Removes transaction IDs and dates
2. **Consistent Categories**: Reduces duplicate/similar categories
3. **Better Analytics**: Cleaner data = better insights
4. **Reduced Manual Work**: Less time spent on categorization

## Technical Details

### Confidence Scoring
- **90%+**: Exact keyword matches (Netflix, Spotify)
- **80-89%**: Strong pattern matches (gas stations, banks)
- **70-79%**: Pattern recognition (words like "restaurant")
- **60-69%**: Similarity to existing transactions
- **<60%**: Not shown (too uncertain)

### Rule Priority
1. User-defined category rules (highest)
2. Built-in keyword matching
3. Pattern recognition
4. Similarity matching (lowest)

### Performance
- Processes thousands of transactions in seconds
- Uses efficient string matching algorithms
- Caches results for better performance

## Future Enhancements

### Short Term
1. **Machine Learning**: Learn from user corrections
2. **Merchant Database**: Expand built-in merchant recognition
3. **Category Suggestions**: Suggest new categories based on patterns

### Long Term
1. **AI Integration**: Use LLM for better categorization
2. **Community Rules**: Share category rules between users
3. **Smart Insights**: Detect spending pattern changes

## Tips for Best Results

1. **Review Suggestions**: Don't blindly accept all suggestions
2. **Start Small**: Apply a few suggestions first, then more
3. **Create Custom Rules**: Add rules for your specific merchants
4. **Regular Cleanup**: Run smart categorization monthly
5. **Check Confidence**: Higher confidence = more reliable

## Troubleshooting

### No Suggestions Found
- All transactions already categorized
- Confidence too low (increase threshold in settings)
- No recognizable patterns in payee names

### Wrong Suggestions
- Create custom category rules for specific merchants
- Adjust confidence levels
- Use regex patterns for complex matching

### Rules Not Working
- Check if rules are enabled
- Verify regex syntax
- Ensure confidence levels are appropriate