import { Category } from '../types';
import yaml from 'js-yaml';

interface YamlCategory {
  name: string;
  color?: string;
  isSubscription?: boolean;
  children?: YamlCategory[];
}

interface YamlStructure {
  categories: YamlCategory[];
}

// Flatten the hierarchical YAML structure into our flat category list with parent references
function flattenCategories(
  yamlCategories: YamlCategory[],
  parentName?: string,
  parentColor?: string,
  parentIsSubscription?: boolean,
  level: number = 0
): Category[] {
  const result: Category[] = [];

  for (const cat of yamlCategories) {
    const color = cat.color || parentColor || '#6b7280';
    const isSubscription = cat.isSubscription ?? parentIsSubscription ?? false;

    // Add the current category
    result.push({
      name: cat.name,
      color,
      parent: parentName,
      isSubscription,
    });

    // Recursively add children (up to 4 levels)
    if (cat.children && level < 3) {
      const childCategories = flattenCategories(
        cat.children,
        cat.name,
        color,
        isSubscription,
        level + 1
      );
      result.push(...childCategories);
    }
  }

  return result;
}

// Load categories from YAML file
export async function loadCategoriesFromYaml(): Promise<Category[]> {
  try {
    const response = await fetch('/categories.yaml');
    const yamlText = await response.text();
    const data = yaml.load(yamlText) as YamlStructure;
    
    return flattenCategories(data.categories);
  } catch (error) {
    console.error('Failed to load categories from YAML:', error);
    // Return default categories as fallback
    return getDefaultCategories();
  }
}

// Default categories as fallback
function getDefaultCategories(): Category[] {
  return [
    { name: 'Income', color: '#10b981' },
    { name: 'Food & Dining', color: '#ef4444' },
    { name: 'Restaurant', color: '#ef4444', parent: 'Food & Dining' },
    { name: 'Fast Food', color: '#ef4444', parent: 'Food & Dining' },
    { name: 'Groceries', color: '#ef4444', parent: 'Food & Dining' },
    { name: 'Transportation', color: '#f97316' },
    { name: 'Gas', color: '#f97316', parent: 'Transportation' },
    { name: 'Public Transit', color: '#f97316', parent: 'Transportation' },
    { name: 'Shopping', color: '#eab308' },
    { name: 'Entertainment', color: '#22c55e' },
    { name: 'Bills & Utilities', color: '#3b82f6' },
    { name: 'Healthcare', color: '#8b5cf6' },
    { name: 'Subscriptions', color: '#a855f7', isSubscription: true },
    { name: 'Streaming', color: '#a855f7', parent: 'Subscriptions', isSubscription: true },
    { name: 'Software', color: '#a855f7', parent: 'Subscriptions', isSubscription: true },
    { name: 'Gym', color: '#a855f7', parent: 'Subscriptions', isSubscription: true },
    { name: 'Other', color: '#6b7280' },
  ];
}

// Get category hierarchy for a given category (useful for breadcrumbs and drilldown)
export function getCategoryHierarchy(categoryName: string, allCategories: Category[]): string[] {
  const hierarchy: string[] = [categoryName];
  let current = allCategories.find(c => c.name === categoryName);

  while (current?.parent) {
    hierarchy.unshift(current.parent);
    current = allCategories.find(c => c.name === current!.parent);
  }

  return hierarchy;
}

// Get all children of a category (useful for analytics aggregation)
export function getCategoryChildren(categoryName: string, allCategories: Category[]): Category[] {
  const children: Category[] = [];
  const directChildren = allCategories.filter(c => c.parent === categoryName);
  
  children.push(...directChildren);
  
  // Recursively get children of children
  for (const child of directChildren) {
    children.push(...getCategoryChildren(child.name, allCategories));
  }
  
  return children;
}

// Get category level (0 = root, 1 = first level child, etc.)
export function getCategoryLevel(categoryName: string, allCategories: Category[]): number {
  return getCategoryHierarchy(categoryName, allCategories).length - 1;
}

// Get root category for any category
export function getRootCategory(categoryName: string, allCategories: Category[]): string {
  const hierarchy = getCategoryHierarchy(categoryName, allCategories);
  return hierarchy[0];
}
