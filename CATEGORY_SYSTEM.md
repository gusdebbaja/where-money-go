# YAML-Based Category System

## Overview
The app now uses a flexible YAML-based category system that supports up to 4 levels of hierarchy. This makes it easy to customize categories and enables powerful drilldown analytics.

## File Location
`categories.yaml` in the project root

## Structure

### Basic Format
```yaml
categories:
  - name: Category Name
    color: "#hexcolor"
    isSubscription: true/false (optional)
    children: (optional)
      - name: Subcategory Name
        children: (optional)
          - name: Sub-subcategory Name
            children: (optional)
              - name: Sub-sub-subcategory Name
```

### Hierarchy Levels
1. **Level 0**: Root categories (e.g., "Food & Dining", "Transportation")
2. **Level 1**: Subcategories (e.g., "Restaurants", "Fast Food")
3. **Level 2**: Sub-subcategories (e.g., "Fine Dining", "Casual Dining")
4. **Level 3**: Sub-sub-subcategories (e.g., "Italian", "French")

## Features

### Color Inheritance
- If a child doesn't specify a color, it inherits from its parent
- Root categories should always specify a color

### Subscription Marking
- Set `isSubscription: true` on any category
- Children inherit this property unless overridden
- Used for subscription analytics

### Example Categories

#### Simple Category
```yaml
- name: Income
  color: "#10b981"
```

#### Category with Children
```yaml
- name: Food & Dining
  color: "#ef4444"
  children:
    - name: Groceries
    - name: Restaurants
    - name: Fast Food
```

#### Deep Hierarchy (4 levels)
```yaml
- name: Subscriptions
  color: "#a855f7"
  isSubscription: true
  children:
    - name: Streaming Services
      children:
        - name: Video Streaming
          children:
            - name: Netflix
            - name: Disney+
            - name: HBO Max
```

## Utility Functions

### `loadCategoriesFromYaml()`
Loads and flattens the YAML hierarchy into the app's category structure.

```typescript
const categories = await loadCategoriesFromYaml();
```

### `getCategoryHierarchy(categoryName, allCategories)`
Returns the full path from root to the specified category.

```typescript
getCategoryHierarchy("Netflix", categories)
// Returns: ["Subscriptions", "Streaming Services", "Video Streaming", "Netflix"]
```

### `getCategoryChildren(categoryName, allCategories)`
Returns all descendants of a category (children, grandchildren, etc.).

```typescript
getCategoryChildren("Food & Dining", categories)
// Returns: [Groceries, Restaurants, Fast Food, Fine Dining, ...]
```

### `getCategoryLevel(categoryName, allCategories)`
Returns the depth level (0 = root, 1 = first child, etc.).

```typescript
getCategoryLevel("Netflix", categories)
// Returns: 3
```

### `getRootCategory(categoryName, allCategories)`
Returns the root category for any category.

```typescript
getRootCategory("Netflix", categories)
// Returns: "Subscriptions"
```

## Use Cases for Analytics

### 1. Drilldown Analysis
Start with root categories, then drill down into subcategories:
```
Food & Dining ($2,500)
  ├─ Restaurants ($1,200)
  │   ├─ Fine Dining ($400)
  │   ├─ Casual Dining ($600)
  │   └─ Fast Casual ($200)
  ├─ Groceries ($800)
  └─ Fast Food ($500)
```

### 2. Aggregation
Sum all spending in a category and its children:
```typescript
const foodSpending = transactions
  .filter(t => {
    const root = getRootCategory(t.category, categories);
    return root === "Food & Dining";
  })
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);
```

### 3. Subscription Tracking
Find all subscription spending across categories:
```typescript
const subscriptionSpending = transactions
  .filter(t => {
    const cat = categories.find(c => c.name === t.category);
    return cat?.isSubscription;
  })
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);
```

### 4. Breadcrumb Navigation
Show category path in UI:
```typescript
const breadcrumbs = getCategoryHierarchy(transaction.category, categories);
// Display: Subscriptions > Streaming Services > Video Streaming > Netflix
```

## Customization

### Adding New Categories
1. Open `categories.yaml`
2. Add your category under the appropriate parent:
```yaml
- name: Transportation
  color: "#f97316"
  children:
    - name: Electric Vehicle
      children:
        - name: Charging
        - name: Maintenance
```

### Modifying Colors
Change the hex color code:
```yaml
- name: Food & Dining
  color: "#ff6b6b"  # Changed from #ef4444
```

### Reorganizing Hierarchy
Move categories by changing their parent:
```yaml
# Before: Gym under Entertainment
- name: Entertainment
  children:
    - name: Gym Membership

# After: Gym under Subscriptions
- name: Subscriptions
  children:
    - name: Fitness & Wellness
      children:
        - name: Gym Membership
```

## Default Categories Included

- **Income** (Salary, Freelance, Investments)
- **Food & Dining** (Groceries, Restaurants, Fast Food, Cafes)
- **Transportation** (Public Transit, Fuel, Parking, Rideshare, Maintenance)
- **Shopping** (Clothing, Electronics, Home & Garden, Personal Care)
- **Entertainment** (Movies, Concerts, Sports, Gaming, Travel)
- **Bills & Utilities** (Rent, Electricity, Water, Internet, Phone)
- **Subscriptions** (Streaming, Software, News, Fitness)
- **Healthcare** (Doctor Visits, Prescriptions, Insurance, Mental Health)
- **Education** (Tuition, Books, Online Courses)
- **Financial** (Bank Fees, Loans, Taxes, Insurance)
- **Family & Children** (Childcare, School, Toys)
- **Pets** (Food, Veterinary, Supplies)
- **Charity & Donations**
- **Other**

## Future Analytics Features

With this hierarchical system, you can build:

1. **Treemap Visualizations** - Show spending proportions at each level
2. **Sunburst Charts** - Interactive circular hierarchy
3. **Drill-down Tables** - Click to expand/collapse categories
4. **Comparison Reports** - Compare spending across hierarchy levels
5. **Budget Tracking** - Set budgets at any level, track children
6. **Trend Analysis** - See how subcategory spending changes over time
7. **Smart Insights** - "Your Fast Food spending increased 20% this month"

## Technical Notes

- Categories are loaded once on app startup
- Changes to `categories.yaml` require app reload
- The YAML file must be valid (use a YAML validator if needed)
- Maximum 4 levels of nesting (root + 3 child levels)
- Category names must be unique across all levels
- Colors use hex format (#RRGGBB)
