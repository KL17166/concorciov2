// usePendingContract — "log" da seleção guest até o pós-cadastro.
//
// Guest escolhe produto + parcela no detalhe → salva aqui + vai pro
// cadastro com ?redirect=/checkout?... Se ele fechar a aba, logar depois
// com conta existente ou o redirect se perder, o pending (localStorage,
// TTL 7 dias) garante a volta ao checkout do item certo.

export interface PendingContract {
  productId: string
  planId: string
  insurance: boolean
  savedAt: number
}

const STORAGE_KEY = 'kat_pending_contract'
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function savePendingContract(productId: string, planId: string, insurance = true): void {
  try {
    const payload: PendingContract = { productId, planId, insurance, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // storage indisponível (modo privado): o ?redirect= da URL cobre
  }
}

export function readPendingContract(): PendingContract | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingContract
    if (!parsed.productId || !parsed.planId || !parsed.savedAt) return null
    if (Date.now() - parsed.savedAt > PENDING_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // Pendings antigos (sem flag) assumem o padrão ativo.
    if (typeof parsed.insurance !== 'boolean') parsed.insurance = true
    return parsed
  } catch {
    return null
  }
}

export function clearPendingContract(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

/** Destino pós-auth quando há pending e nenhum redirect explícito. */
export function pendingCheckoutTarget(): string | null {
  const pending = readPendingContract()
  if (!pending) return null
  return `/checkout?productId=${encodeURIComponent(pending.productId)}&planId=${encodeURIComponent(pending.planId)}`
}
