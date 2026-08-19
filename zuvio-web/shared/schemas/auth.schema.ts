import type { LoginCredentials, RegisterData } from '../types/auth'
import { isValidCpf, unmaskCpf } from '../utils/cpf'

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

export function validateLoginSchema(data: LoginCredentials): ValidationResult {
  const errors: Record<string, string> = {}
  const cleanCpf = unmaskCpf(data.cpf)

  if (!cleanCpf) {
    errors.cpf = 'O CPF é obrigatório'
  } else if (cleanCpf.length !== 11) {
    errors.cpf = 'O CPF deve conter exatamente 11 dígitos'
  } else if (!isValidCpf(cleanCpf)) {
    errors.cpf = 'CPF inválido'
  }

  if (!data.password) {
    errors.password = 'A senha é obrigatória'
  } else if (data.password.length < 6) {
    errors.password = 'A senha deve ter no mínimo 6 caracteres'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

export function validateRegisterSchema(data: RegisterData): ValidationResult {
  const errors: Record<string, string> = {}
  const cleanCpf = unmaskCpf(data.cpf)

  if (!data.name || data.name.trim().length < 3) {
    errors.name = 'Nome completo é obrigatório (mínimo 3 caracteres)'
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'E-mail inválido'
  }

  if (!cleanCpf || !isValidCpf(cleanCpf)) {
    errors.cpf = 'CPF inválido'
  }

  if (!data.password || data.password.length < 6) {
    errors.password = 'A senha deve ter no mínimo 6 caracteres'
  }

  if (!data.birthDate) {
    errors.birthDate = 'Data de nascimento é obrigatória'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
