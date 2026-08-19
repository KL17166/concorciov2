import type { UserProfile } from './user'

export interface LoginCredentials {
  cpf: string
  password: string
}

export interface LoginResponse {
  token: string
  user: UserProfile
  signingSecret?: string
  payloadSecret?: string
  message?: string
}

export interface RegisterData {
  name: string
  email: string
  cpf: string
  password: string
  birthDate?: string // YYYY-MM-DD
  phone?: string
}

export interface AuthState {
  user: UserProfile | null
  token: string | null
  signingSecret: string | null
  payloadSecret: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
