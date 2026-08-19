/**
 * Currency Formatting Utility (BRL - Real Brasileiro)
 */

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'R$ 0,00'
  }
  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericValue)
}

export function parseCurrencyToNumber(currencyStr: string): number {
  if (!currencyStr) return 0
  const clean = currencyStr.replace(/[^\d,-]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}
