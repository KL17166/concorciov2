/**
 * CPF Validation and Formatting Utilities
 */

export function unmaskCpf(value: string): string {
  if (!value) return ''
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value: string): string {
  const clean = unmaskCpf(value)
  if (!clean) return ''
  
  if (clean.length <= 3) return clean
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`
}

export function isValidCpf(cpfRaw: string): boolean {
  const cpf = unmaskCpf(cpfRaw)

  // Must have 11 digits
  if (cpf.length !== 11) return false

  // Reject all identical digits
  if (/^(\d)\1{10}$/.test(cpf)) return false

  // Validate 1st check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(9), 10)) return false

  // Validate 2nd check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(10), 10)) return false

  return true
}
