import { PayeeRenamingRule } from '../types';

export function applyRenamingRules(payee: string, rules: PayeeRenamingRule[]): string {
  let result = payee;
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    try {
      if (rule.isRegex) {
        const regex = new RegExp(rule.pattern, 'gi');
        result = result.replace(regex, rule.replacement);
      } else {
        // Plain text replacement (case insensitive)
        const regex = new RegExp(escapeRegex(rule.pattern), 'gi');
        result = result.replace(regex, rule.replacement);
      }
    } catch (error) {
      console.error('Error applying renaming rule:', rule, error);
    }
  }
  
  return result.trim();
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractPayeePattern(payee: string): string {
  // Try to extract the base payee name by removing common patterns
  // Remove dates like &/25-11-17, 25-11-17, 2023-11-25, etc.
  let pattern = payee
    .replace(/\s*[&\/]\d{2}-\d{2}-\d{2,4}\s*$/gi, '')
    .replace(/\s*\d{2}-\d{2}-\d{2,4}\s*$/gi, '')
    .replace(/\s*\d{4}-\d{2}-\d{2}\s*$/gi, '')
    .replace(/\s*\d{2}\/\d{2}\/\d{2,4}\s*$/gi, '')
    .trim();
  
  return pattern;
}

export function getRenamingRules(): PayeeRenamingRule[] {
  const saved = localStorage.getItem('payee-renaming-rules');
  return saved ? JSON.parse(saved) : [];
}

export function saveRenamingRules(rules: PayeeRenamingRule[]): void {
  localStorage.setItem('payee-renaming-rules', JSON.stringify(rules));
}

export function addRenamingRule(rule: Omit<PayeeRenamingRule, 'id'>): PayeeRenamingRule {
  const rules = getRenamingRules();
  const newRule: PayeeRenamingRule = {
    ...rule,
    id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  rules.push(newRule);
  saveRenamingRules(rules);
  return newRule;
}
