// Smart categorization utilities for payee normalization and auto-categorization

import { getRenamingRules } from './payeeRules';

export interface SmartCategory {
  normalizedPayee: string;
  suggestedCategory: string;
  confidence: number; // 0-1
  keywords: string[];
  method: 'keyword' | 'pattern' | 'similarity' | 'user_rule';
  tags?: string[];
}

export interface CategoryRule {
  id: string;
  pattern: string; // Can be plain text or regex
  category: string;
  isRegex: boolean;
  enabled: boolean;
  confidence: number;
  createdAt: Date;
  tags?: string[];
}

// Get category rules from localStorage
export function getCategoryRules(): CategoryRule[] {
  const saved = localStorage.getItem('category-rules');
  return saved ? JSON.parse(saved).map((rule: any) => ({
    ...rule,
    createdAt: new Date(rule.createdAt)
  })) : [];
}

// Save category rules to localStorage
export function saveCategoryRules(rules: CategoryRule[]): void {
  localStorage.setItem('category-rules', JSON.stringify(rules));
}

// Update an existing category rule
export function updateCategoryRule(updatedRule: CategoryRule): void {
  const rules = getCategoryRules();
  const index = rules.findIndex(r => r.id === updatedRule.id);
  if (index !== -1) {
    rules[index] = updatedRule;
    saveCategoryRules(rules);
  }
}

// Add a new category rule
export function addCategoryRule(rule: Omit<CategoryRule, 'id' | 'createdAt'>): CategoryRule {
  const rules = getCategoryRules();
  
  // Check for duplicate pattern (case-insensitive)
  const existingIndex = rules.findIndex(r => 
    r.pattern.toLowerCase() === rule.pattern.toLowerCase() && 
    r.isRegex === rule.isRegex
  );

  if (existingIndex !== -1) {
    // Update existing rule instead of creating a duplicate
    const existingRule = rules[existingIndex];
    const updatedRule = {
      ...existingRule,
      ...rule,
      // Preserve original ID and createdAt
    };
    rules[existingIndex] = updatedRule;
    saveCategoryRules(rules);
    return updatedRule;
  }

  const newRule: CategoryRule = {
    ...rule,
    id: `cat-rule-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    createdAt: new Date(),
  };
  rules.push(newRule);
  saveCategoryRules(rules);
  return newRule;
}

export function batchAddCategoryRules(newRules: Array<Omit<CategoryRule, 'id' | 'createdAt'>>): CategoryRule[] {
  if (newRules.length === 0) return [];

  const rules = getCategoryRules();
  const addedRules = newRules.map(rule => ({
    ...rule,
    id: `cat-rule-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    createdAt: new Date(),
  }));
  
  rules.push(...addedRules);
  saveCategoryRules(rules);
  return addedRules;
}

// Extract meaningful words from payee name by removing digits, special chars, and common suffixes
export function normalizePayeeName(payee: string): string {
  if (!payee) return 'Unknown';
  
  // First apply user's renaming rules
  const renamingRules = getRenamingRules();
  let normalized = payee;
  
  for (const rule of renamingRules) {
    if (!rule.enabled) continue;
    
    try {
      if (rule.isRegex) {
        const regex = new RegExp(rule.pattern, 'gi');
        normalized = normalized.replace(regex, rule.replacement);
      } else {
        const regex = new RegExp(escapeRegex(rule.pattern), 'gi');
        normalized = normalized.replace(regex, rule.replacement);
      }
    } catch (error) {
      console.error('Error applying renaming rule:', rule, error);
    }
  }
  
  // Then apply standard normalization
  normalized = normalized
    // Remove common patterns
    .replace(/\s*[&\/]\d{2}-\d{2}-\d{2,4}\s*$/gi, '') // Remove dates like &/25-11-17
    .replace(/\s*\d{2}-\d{2}-\d{2,4}\s*$/gi, '')      // Remove dates like 25-11-17
    .replace(/\s*\d{4}-\d{2}-\d{2}\s*$/gi, '')        // Remove dates like 2024-01-15
    .replace(/\s*\d{2}\/\d{2}\/\d{2,4}\s*$/gi, '')    // Remove dates like 01/15/24
    // Remove transaction IDs and reference numbers
    .replace(/\s+[A-Z]\s*\d+$/gi, '')                 // Remove "A 12930123"
    .replace(/\/\d+\s*\d*$/gi, '')                    // Remove "/21 12930"
    .replace(/\s+\d{4,}$/gi, '')                      // Remove long numbers at end
    .replace(/\s+\d+\s*$/, '')                        // Remove numbers at end
    // Remove common banking prefixes/suffixes
    .replace(/^(PURCHASE|DEBIT CARD|POS|VISA|MASTERCARD|CHECKCARD)\s+/gi, '')
    .replace(/\s+(PURCHASE|DEBIT CARD|POS|VISA|MASTERCARD|CHECKCARD)$/gi, '')
    // Remove common suffixes
    .replace(/\s+(INC|LLC|LTD|CORP|CO|AB|AS)\.?$/gi, '')
    .replace(/\s+(STORE|SHOP|MARKET|CENTER|CENTRE)$/gi, '')
    // Clean up
    .replace(/[^\w\s-]/g, ' ')                        // Replace special chars with space
    .replace(/\s+/g, ' ')                             // Normalize whitespace
    .trim();

  // Take first 1-2 meaningful words
  const words = normalized.split(' ').filter(word => 
    word.length > 2 && 
    !/^\d+$/.test(word) && 
    !['THE', 'AND', 'FOR', 'WITH'].includes(word.toUpperCase())
  );
  
  return words.slice(0, 2).join(' ') || payee.split(' ')[0] || payee;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Smart categorization based on payee keywords and user rules
export function suggestCategory(payee: string, existingTransactions: any[] = []): SmartCategory {
  const normalized = normalizePayeeName(payee);
  const payeeLower = payee.toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  
  // First check user-defined category rules
  const categoryRules = getCategoryRules();
  for (const rule of categoryRules) {
    if (!rule.enabled) continue;
    
    try {
      let matches = false;
      if (rule.isRegex) {
        const regex = new RegExp(rule.pattern, 'i');
        matches = regex.test(payee) || regex.test(normalized);
      } else {
        matches = payeeLower.includes(rule.pattern.toLowerCase()) || 
                 normalizedLower.includes(rule.pattern.toLowerCase());
      }
      
      if (matches) {
        return {
          normalizedPayee: normalized,
          suggestedCategory: rule.category,
          confidence: rule.confidence,
          keywords: [rule.pattern],
          method: 'user_rule',
          tags: rule.tags
        };
      }
    } catch (error) {
      console.error('Error applying category rule:', rule, error);
    }
  }
  
  // Then check hardcoded keyword mappings (as fallback)
  const keywordResult = suggestCategoryByKeywords(payee, normalized);
  if (keywordResult.confidence > 0) {
    return keywordResult;
  }
  
  // Try pattern-based suggestions for unknown payees
  const patternResult = suggestCategoryByPattern(payee, normalized);
  if (patternResult.confidence > 0) {
    return patternResult;
  }
  
  // Try similarity-based suggestions
  const similarityResult = suggestCategoryBySimilarity(payee, normalized, existingTransactions);
  if (similarityResult.confidence > 0) {
    return similarityResult;
  }
  
  return {
    normalizedPayee: normalized,
    suggestedCategory: 'Other',
    confidence: 0,
    keywords: [],
    method: 'keyword'
  };
}

// Keyword-based categorization (existing logic)
function suggestCategoryByKeywords(payee: string, normalized: string): SmartCategory {
  const payeeLower = payee.toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  
  // Category mapping with keywords and confidence scores
  const categoryMappings = [
    // Food & Dining
    {
      category: 'Groceries',
      keywords: ['ica', 'coop', 'willys', 'hemkop', 'lidl', 'walmart', 'target', 'kroger', 'safeway', 'whole foods', 'trader joe', 'costco', 'sam club', 'grocery', 'market', 'supermarket', 'city gross', 'mathem', 'mat.se'],
      confidence: 0.9
    },
    {
      category: 'Restaurant',
      keywords: ['restaurant', 'bistro', 'cafe', 'pizza', 'burger', 'grill', 'kitchen', 'bar', 'pub', 'diner', 'eatery', 'food truck', 'krog', 'pizzeria', 'thaikök', 'sushi'],
      confidence: 0.85
    },
    {
      category: 'Fast Food',
      keywords: ['mcdonalds', 'burger king', 'kfc', 'subway', 'dominos', 'pizza hut', 'taco bell', 'wendys', 'max', 'sibylla', 'clock', 'foodora', 'wolt', 'uber eats'],
      confidence: 0.95
    },
    {
      category: 'Cafes & Coffee',
      keywords: ['starbucks', 'costa', 'espresso house', 'wayne', 'coffee', 'cafe', 'barista', 'joe & the juice'],
      confidence: 0.9
    },
    
    // Transportation
    {
      category: 'Fuel & Gas',
      keywords: ['shell', 'bp', 'esso', 'statoil', 'circle k', 'preem', 'ok', 'gas', 'fuel', 'petrol', 'bensin', 'ingo', 'st1'],
      confidence: 0.95
    },
    {
      category: 'Public Transit',
      keywords: ['sl', 'sj', 'metro', 'bus', 'train', 'transit', 'transport', 'kollektiv', 'pendeltag', 'arlanda express', 'flygbussarna', 'skånetrafiken', 'västtrafik'],
      confidence: 0.9
    },
    {
      category: 'Taxi',
      keywords: ['uber', 'bolt', 'taxi', 'cab', 'lyft', 'freenow', 'taxijakt', 'sverigetaxi'],
      confidence: 0.95
    },
    {
      category: 'Transportation',
      keywords: ['voi', 'tier', 'lime', 'bird', 'ryde', 'parking', 'parkering', 'easypark', 'aimo', 'q-park'],
      confidence: 0.85
    },
    
    // Shopping
    {
      category: 'Clothing',
      keywords: ['h&m', 'zara', 'uniqlo', 'nike', 'adidas', 'fashion', 'clothing', 'apparel', 'kläder'],
      confidence: 0.8
    },
    {
      category: 'Electronics',
      keywords: ['apple', 'samsung', 'sony', 'microsoft', 'amazon', 'best buy', 'media markt', 'elgiganten', 'webhallen'],
      confidence: 0.85
    },
    {
      category: 'Home & Garden',
      keywords: ['ikea', 'home depot', 'bauhaus', 'hornbach', 'jysk', 'furniture', 'garden', 'hem', 'trädgård'],
      confidence: 0.8
    },
    
    // Bills & Utilities
    {
      category: 'Electricity',
      keywords: ['vattenfall', 'eon', 'fortum', 'electric', 'power', 'el', 'kraft'],
      confidence: 0.95
    },
    {
      category: 'Internet',
      keywords: ['telia', 'telenor', 'tre', 'comhem', 'bahnhof', 'internet', 'broadband', 'fiber'],
      confidence: 0.9
    },
    {
      category: 'Phone',
      keywords: ['mobile', 'phone', 'cellular', 'mobil', 'telefon'],
      confidence: 0.85
    },
    
    // Subscriptions
    {
      category: 'Netflix',
      keywords: ['netflix'],
      confidence: 0.98
    },
    {
      category: 'Spotify',
      keywords: ['spotify'],
      confidence: 0.98
    },
    {
      category: 'Disney+',
      keywords: ['disney'],
      confidence: 0.95
    },
    {
      category: 'Gym Membership',
      keywords: ['gym', 'fitness', 'sats', 'nordic wellness', 'fresh fitness'],
      confidence: 0.9
    },
    
    // Healthcare
    {
      category: 'Pharmacy',
      keywords: ['apotek', 'pharmacy', 'apoteket', 'kronans'],
      confidence: 0.95
    },
    {
      category: 'Doctor Visits',
      keywords: ['vårdcentral', 'clinic', 'hospital', 'doctor', 'läkare'],
      confidence: 0.85
    },
    
    // Entertainment
    {
      category: 'Movies & Cinema',
      keywords: ['cinema', 'movie', 'film', 'bio', 'sf', 'filmstaden'],
      confidence: 0.9
    },
    
    // Financial
    {
      category: 'Bank Fees',
      keywords: ['swedbank', 'handelsbanken', 'seb', 'nordea', 'bank', 'fee', 'avgift'],
      confidence: 0.9
    }
  ];
  
  // Find best matching category
  for (const mapping of categoryMappings) {
    for (const keyword of mapping.keywords) {
      if (payeeLower.includes(keyword) || normalizedLower.includes(keyword)) {
        return {
          normalizedPayee: normalized,
          suggestedCategory: mapping.category,
          confidence: mapping.confidence,
          keywords: [keyword],
          method: 'keyword'
        };
      }
    }
  }
  
  return {
    normalizedPayee: normalized,
    suggestedCategory: 'Other',
    confidence: 0,
    keywords: [],
    method: 'keyword'
  };
}

// Pattern-based categorization for unknown payees
function suggestCategoryByPattern(payee: string, normalized: string): SmartCategory {
  // Look for patterns in payee names that might indicate category
  
  // Common patterns that suggest categories
  const patterns = [
    { pattern: /\b(restaurant|resto|bistro|grill|kitchen)\b/i, category: 'Restaurant', confidence: 0.7 },
    { pattern: /\b(market|mart|store|shop)\b/i, category: 'Shopping', confidence: 0.6 },
    { pattern: /\b(gas|fuel|station)\b/i, category: 'Fuel & Gas', confidence: 0.8 },
    { pattern: /\b(hotel|motel|inn)\b/i, category: 'Travel & Vacation', confidence: 0.8 },
    { pattern: /\b(pharmacy|apotek|drug)\b/i, category: 'Pharmacy', confidence: 0.9 },
    { pattern: /\b(bank|atm|fee)\b/i, category: 'Bank Fees', confidence: 0.8 },
    { pattern: /\b(parking|garage)\b/i, category: 'Parking', confidence: 0.8 },
    { pattern: /\b(cinema|movie|film)\b/i, category: 'Movies & Cinema', confidence: 0.8 },
  ];
  
  for (const { pattern, category, confidence } of patterns) {
    if (pattern.test(payee) || pattern.test(normalized)) {
      return {
        normalizedPayee: normalized,
        suggestedCategory: category,
        confidence,
        keywords: [pattern.source],
        method: 'pattern'
      };
    }
  }
  
  return {
    normalizedPayee: normalized,
    suggestedCategory: 'Other',
    confidence: 0,
    keywords: [],
    method: 'pattern'
  };
}

// Similarity-based categorization using existing transactions
function suggestCategoryBySimilarity(payee: string, normalized: string, existingTransactions: any[]): SmartCategory {
  if (!existingTransactions.length) {
    return {
      normalizedPayee: normalized,
      suggestedCategory: 'Other',
      confidence: 0,
      keywords: [],
      method: 'similarity'
    };
  }
  
  // Find similar payees that already have categories
  const categorizedTransactions = existingTransactions.filter(t => t.category && t.payee !== payee);
  
  let bestMatch = {
    category: 'Other',
    confidence: 0,
    similarity: 0
  };
  
  for (const txn of categorizedTransactions) {
    const txnNormalized = normalizePayeeName(txn.payee);
    const similarity = calculateStringSimilarity(normalized, txnNormalized);
    
    if (similarity > 0.6 && similarity > bestMatch.similarity) {
      bestMatch = {
        category: txn.category,
        confidence: similarity * 0.7, // Lower confidence for similarity-based
        similarity
      };
    }
  }
  
  return {
    normalizedPayee: normalized,
    suggestedCategory: bestMatch.category,
    confidence: bestMatch.confidence,
    keywords: [`similar to existing payees`],
    method: 'similarity'
  };
}

// Calculate string similarity (Levenshtein distance based)
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Batch process transactions for smart categorization with chunking for performance
export function batchSmartCategorize(transactions: any[]): Map<string, SmartCategory> {
  const results = new Map<string, SmartCategory>();
  
  transactions.forEach(t => {
    if (t.payee && !results.has(t.payee)) {
      results.set(t.payee, suggestCategory(t.payee, transactions));
    }
  });
  
  return results;
}

// Chunked processing for large datasets
export async function batchSmartCategorizeChunked(
  transactions: any[], 
  chunkSize: number = 50,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, SmartCategory>> {
  const results = new Map<string, SmartCategory>();
  const uniquePayees = [...new Set(transactions.map(t => t.payee))].filter(Boolean);
  
  for (let i = 0; i < uniquePayees.length; i += chunkSize) {
    const chunk = uniquePayees.slice(i, i + chunkSize);
    
    // Process chunk
    for (const payee of chunk) {
      if (!results.has(payee)) {
        results.set(payee, suggestCategory(payee, transactions));
      }
    }
    
    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + chunkSize, uniquePayees.length), uniquePayees.length);
    }
    
    // Yield control back to browser to prevent hanging
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
}

// Optimized version that groups transactions first to reduce processing
export async function batchSmartCategorizeOptimized(
  transactions: any[],
  onProgress?: (processed: number, total: number, currentPayee?: string) => void
): Promise<Array<{
  payee: string;
  normalizedPayee: string;
  suggestedCategory: string;
  confidence: number;
  method: string;
  tags?: string[];
  transactionCount: number;
  totalAmount: number;
}>> {
  // Group transactions by payee first
  const payeeGroups = new Map<string, any[]>();
  
  transactions.forEach(t => {
    if (t.payee && !t.category && t.amount < 0) { // Only uncategorized spending
      if (!payeeGroups.has(t.payee)) {
        payeeGroups.set(t.payee, []);
      }
      payeeGroups.get(t.payee)!.push(t);
    }
  });
  
  const payees = Array.from(payeeGroups.keys());
  const results: Array<{
    payee: string;
    normalizedPayee: string;
    suggestedCategory: string;
    confidence: number;
    method: string;
    tags?: string[];
    transactionCount: number;
    totalAmount: number;
  }> = [];
  
  const chunkSize = 25; // Smaller chunks for better responsiveness
  
  for (let i = 0; i < payees.length; i += chunkSize) {
    const chunk = payees.slice(i, i + chunkSize);
    
    // Process chunk
    for (const payee of chunk) {
      const suggestion = suggestCategory(payee, transactions);
      
      // Only include suggestions with decent confidence
      if (suggestion.confidence > 0.6) {
        const payeeTransactions = payeeGroups.get(payee)!;
        results.push({
          payee,
          normalizedPayee: suggestion.normalizedPayee,
          suggestedCategory: suggestion.suggestedCategory,
          confidence: suggestion.confidence,
          method: suggestion.method,
          tags: suggestion.tags,
          transactionCount: payeeTransactions.length,
          totalAmount: payeeTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
        });
      }
      
      // Report progress with current payee
      if (onProgress) {
        const processed = Math.min(i + chunk.indexOf(payee) + 1, payees.length);
        onProgress(processed, payees.length, payee);
      }
    }
    
    // Yield control to prevent hanging
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  
  // Sort by total amount (highest first)
  return results.sort((a, b) => b.totalAmount - a.totalAmount);
}

// Group transactions by normalized payee
export function groupByNormalizedPayee(transactions: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  
  transactions.forEach(t => {
    const normalized = normalizePayeeName(t.payee);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(t);
  });
  
  return groups;
}

// Get spending statistics by normalized payee
export function getPayeeSpendingStats(transactions: any[]) {
  const groups = groupByNormalizedPayee(transactions.filter(t => t.amount < 0));
  
  return Array.from(groups.entries()).map(([normalizedPayee, txns]) => {
    const totalSpent = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransaction = totalSpent / txns.length;
    const frequency = txns.length;
    const lastTransaction = txns.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    
    return {
      normalizedPayee,
      originalPayees: [...new Set(txns.map(t => t.payee))],
      totalSpent,
      avgTransaction,
      frequency,
      lastTransaction: lastTransaction.date,
      transactions: txns
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent);
}