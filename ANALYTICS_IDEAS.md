# Analytics Enhancement Ideas

## Current State
The Analytics tab currently shows:
- Total Income, Spending, Net
- Subscription spending
- Savings progress
- Spending by category (pie/bar/line charts)
- Top merchants
- Income vs Spending over time

## Future Enhancements Using Category Hierarchy

### 1. Drilldown Category View
**Interactive hierarchy exploration**

```typescript
// Example implementation
import { getCategoryChildren, getCategoryHierarchy } from '../utils/categoryLoader';

function CategoryDrilldown({ transactions, categories }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const categorySpending = useMemo(() => {
    // Group by root categories
    const spending = new Map<string, number>();
    
    transactions.forEach(t => {
      if (t.amount < 0 && t.category) {
        const root = getRootCategory(t.category, categories);
        spending.set(root, (spending.get(root) || 0) + Math.abs(t.amount));
      }
    });
    
    return spending;
  }, [transactions, categories]);
  
  // When user clicks a category, show its children
  const drillDown = (categoryName: string) => {
    const children = getCategoryChildren(categoryName, categories);
    // Show spending breakdown for children
  };
}
```

**Visual**: Treemap or Sunburst chart showing hierarchy

### 2. Budget Tracking by Category
**Set budgets at any hierarchy level**

```typescript
interface Budget {
  category: string;
  amount: number;
  period: 'week' | 'month' | 'year';
  includeChildren: boolean; // Include subcategories in budget
}

function BudgetTracker({ transactions, categories, budgets }) {
  const getBudgetProgress = (budget: Budget) => {
    let relevantTransactions = transactions;
    
    if (budget.includeChildren) {
      // Include all children in budget calculation
      const children = getCategoryChildren(budget.category, categories);
      const categoryNames = [budget.category, ...children.map(c => c.name)];
      relevantTransactions = transactions.filter(t => 
        t.category && categoryNames.includes(t.category)
      );
    } else {
      relevantTransactions = transactions.filter(t => 
        t.category === budget.category
      );
    }
    
    const spent = relevantTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return {
      spent,
      remaining: budget.amount - spent,
      percentage: (spent / budget.amount) * 100
    };
  };
}
```

**Visual**: Progress bars with color coding (green/yellow/red)

### 3. Spending Trends by Hierarchy Level
**Compare spending across different granularity levels**

```typescript
function SpendingTrends({ transactions, categories }) {
  const [viewLevel, setViewLevel] = useState<0 | 1 | 2 | 3>(0);
  
  const spendingByLevel = useMemo(() => {
    const spending = new Map<string, number[]>(); // category -> [month1, month2, ...]
    
    transactions.forEach(t => {
      if (t.amount < 0 && t.category) {
        const hierarchy = getCategoryHierarchy(t.category, categories);
        const categoryAtLevel = hierarchy[viewLevel] || hierarchy[hierarchy.length - 1];
        
        // Add to spending for this category
        // ... group by month
      }
    });
    
    return spending;
  }, [transactions, categories, viewLevel]);
}
```

**Visual**: Line chart with toggle for hierarchy level

### 4. Category Comparison Matrix
**Compare spending across multiple categories and time periods**

```typescript
function CategoryComparison({ transactions, categories }) {
  const matrix = useMemo(() => {
    // Create matrix: categories x months
    const rootCategories = categories.filter(c => !c.parent);
    const months = getMonthsFromTransactions(transactions);
    
    return rootCategories.map(cat => ({
      category: cat.name,
      color: cat.color,
      monthlySpending: months.map(month => {
        const children = getCategoryChildren(cat.name, categories);
        const categoryNames = [cat.name, ...children.map(c => c.name)];
        
        return transactions
          .filter(t => 
            t.amount < 0 &&
            t.category &&
            categoryNames.includes(t.category) &&
            isSameMonth(t.date, month)
          )
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      })
    }));
  }, [transactions, categories]);
}
```

**Visual**: Heatmap showing spending intensity

### 5. Smart Insights
**AI-like insights based on category hierarchy**

```typescript
function SmartInsights({ transactions, categories }) {
  const insights = useMemo(() => {
    const insights: string[] = [];
    
    // Compare current month to previous month at each level
    const rootCategories = categories.filter(c => !c.parent);
    
    rootCategories.forEach(root => {
      const children = getCategoryChildren(root.name, categories);
      const categoryNames = [root.name, ...children.map(c => c.name)];
      
      const currentMonth = getCurrentMonthSpending(transactions, categoryNames);
      const previousMonth = getPreviousMonthSpending(transactions, categoryNames);
      
      const change = ((currentMonth - previousMonth) / previousMonth) * 100;
      
      if (Math.abs(change) > 20) {
        insights.push(
          `Your ${root.name} spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(0)}% this month`
        );
        
        // Drill down to find which subcategory caused the change
        children.forEach(child => {
          const childCurrent = getCurrentMonthSpending(transactions, [child.name]);
          const childPrevious = getPreviousMonthSpending(transactions, [child.name]);
          const childChange = ((childCurrent - childPrevious) / childPrevious) * 100;
          
          if (Math.abs(childChange) > 30) {
            insights.push(
              `  └─ Mainly due to ${child.name}: ${childChange > 0 ? '+' : ''}${childChange.toFixed(0)}%`
            );
          }
        });
      }
    });
    
    return insights;
  }, [transactions, categories]);
}
```

**Visual**: Card-based insights with icons and colors

### 6. Subscription Dashboard
**Dedicated view for all subscriptions**

```typescript
function SubscriptionDashboard({ transactions, categories }) {
  const subscriptions = useMemo(() => {
    const subCategories = categories.filter(c => c.isSubscription);
    
    return subCategories.map(cat => {
      const hierarchy = getCategoryHierarchy(cat.name, categories);
      const txns = transactions.filter(t => t.category === cat.name);
      
      // Detect recurring pattern
      const amounts = txns.map(t => Math.abs(t.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      
      // Estimate monthly cost
      const monthlyEstimate = estimateMonthlyRecurring(txns);
      
      return {
        name: cat.name,
        hierarchy: hierarchy.join(' > '),
        monthlyEstimate,
        lastCharge: txns[0]?.date,
        totalSpent: amounts.reduce((a, b) => a + b, 0),
        transactionCount: txns.length
      };
    });
  }, [transactions, categories]);
  
  const totalMonthlySubscriptions = subscriptions.reduce(
    (sum, sub) => sum + sub.monthlyEstimate, 
    0
  );
}
```

**Visual**: Table with subscription details + total monthly cost

### 7. Category Performance Score
**Rate how well you're managing each category**

```typescript
function CategoryPerformance({ transactions, categories, budgets }) {
  const scores = useMemo(() => {
    return categories.filter(c => !c.parent).map(cat => {
      const children = getCategoryChildren(cat.name, categories);
      const categoryNames = [cat.name, ...children.map(c => c.name)];
      
      // Calculate various metrics
      const spending = getSpendingForCategory(transactions, categoryNames);
      const trend = getSpendingTrend(transactions, categoryNames);
      const budget = budgets.find(b => b.category === cat.name);
      
      let score = 100;
      
      // Deduct points for overspending
      if (budget && spending > budget.amount) {
        score -= 30;
      }
      
      // Deduct points for increasing trend
      if (trend > 10) {
        score -= 20;
      }
      
      // Add points for decreasing trend
      if (trend < -10) {
        score += 10;
      }
      
      return {
        category: cat.name,
        score: Math.max(0, Math.min(100, score)),
        spending,
        trend,
        status: score > 80 ? 'good' : score > 60 ? 'ok' : 'needs attention'
      };
    });
  }, [transactions, categories, budgets]);
}
```

**Visual**: Score cards with color coding

### 8. Spending Forecast
**Predict future spending based on historical patterns**

```typescript
function SpendingForecast({ transactions, categories }) {
  const forecast = useMemo(() => {
    const rootCategories = categories.filter(c => !c.parent);
    
    return rootCategories.map(cat => {
      const children = getCategoryChildren(cat.name, categories);
      const categoryNames = [cat.name, ...children.map(c => c.name)];
      
      // Get last 6 months of spending
      const monthlySpending = getLast6MonthsSpending(transactions, categoryNames);
      
      // Simple linear regression for forecast
      const trend = calculateTrend(monthlySpending);
      const nextMonthForecast = monthlySpending[monthlySpending.length - 1] + trend;
      
      return {
        category: cat.name,
        historical: monthlySpending,
        forecast: nextMonthForecast,
        confidence: calculateConfidence(monthlySpending)
      };
    });
  }, [transactions, categories]);
}
```

**Visual**: Line chart with historical data + forecast line

## Implementation Priority

1. **High Priority** (Most useful):
   - Drilldown Category View
   - Budget Tracking by Category
   - Smart Insights
   - Subscription Dashboard

2. **Medium Priority**:
   - Spending Trends by Hierarchy Level
   - Category Comparison Matrix
   - Category Performance Score

3. **Low Priority** (Nice to have):
   - Spending Forecast

## Data Visualization Libraries

Consider adding:
- **Recharts** (already included) - Good for basic charts
- **D3.js** - For advanced custom visualizations (treemap, sunburst)
- **Nivo** - React wrapper for D3 with beautiful defaults
- **Victory** - Another React charting library

## Next Steps

1. Choose 2-3 features to implement first
2. Design the UI/UX for each feature
3. Implement using the category hierarchy utilities
4. Test with real transaction data
5. Iterate based on user feedback
