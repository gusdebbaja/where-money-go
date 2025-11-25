// Detect user's local currency based on their locale
export function detectLocalCurrency(): string {
  try {
    const locale = navigator.language || 'en-US';
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD', // fallback
    });
    
    // Try to extract currency from resolved options
    const options = formatter.resolvedOptions();
    return options.currency || 'USD';
  } catch {
    return 'USD';
  }
}

// Format currency with proper symbol
export function formatCurrency(amount: number, currency?: string): string {
  const curr = currency || detectLocalCurrency();
  try {
    return new Intl.NumberFormat(navigator.language || 'en-US', {
      style: 'currency',
      currency: curr,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toFixed(2)}`;
  }
}

// Common currencies for dropdown
export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
];

// Format date in European format (dd/mm/yyyy)
export function formatDateEuropean(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
