import { logger } from '../../config/logger';

export interface ExternalGatewayLimitConfig {
    /** Máximo de cobranças iniciadas por minuto (janela deslizante). */
    maxPerMin: number;
    /** Valor mínimo por cobrança (R$). */
    minAmount: number;
    /** Valor máximo por cobrança (R$). */
    maxAmount: number;
    /** Teto somado de cobranças bem-sucedidas por dia (R$). */
    dailyCap: number;
    /** Máximo de gerações concorrentes (serviços locais são single-thread). */
    maxConcurrent: number;
}

function num(envVal: string | undefined, fallback: number): number {
    const n = Number(envVal);
    return envVal !== undefined && envVal !== '' && !isNaN(n) ? n : fallback;
}

/**
 * Lê os limites de uma gateway externa a partir do env.
 * Prefixo ex: "ELDORADO" -> ELDORADO_MAX_PER_MIN, ELDORADO_MIN_AMOUNT, ...
 */
export function loadLimitConfig(prefix: string): ExternalGatewayLimitConfig {
    return {
        maxPerMin: num(process.env[`${prefix}_MAX_PER_MIN`], 2),
        minAmount: num(process.env[`${prefix}_MIN_AMOUNT`], 10),
        maxAmount: num(process.env[`${prefix}_MAX_AMOUNT`], 5000),
        dailyCap: num(process.env[`${prefix}_DAILY_CAP`], 20000),
        maxConcurrent: num(process.env[`${prefix}_MAX_CONCURRENT`], 1)
    };
}

interface GatewayState {
    attempts: number[];      // timestamps (ms) das tentativas na janela
    running: number;         // gerações em andamento agora
    queue: Array<() => void>;
    day: string;             // YYYY-MM-DD do acumulado
    dayTotal: number;        // soma R$ das cobranças geradas no dia
}

const states = new Map<string, GatewayState>();

function stateOf(name: string): GatewayState {
    let s = states.get(name);
    if (!s) {
        s = { attempts: [], running: 0, queue: [], day: '', dayTotal: 0 };
        states.set(name, s);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (s.day !== today) {
        s.day = today;
        s.dayTotal = 0;
    }
    return s;
}

function fail(message: string, statusCode: number, code: string): never {
    throw Object.assign(new Error(message), { statusCode, code });
}

/**
 * Valida limites de valor + taxa antes de chamar a gateway externa.
 * Erros 429/400 caem no failover (tentam a próxima gateway ativa).
 */
export function checkLimits(name: string, amount: number, cfg: ExternalGatewayLimitConfig): void {
    if (!isFinite(amount) || amount < cfg.minAmount) {
        fail(
            `Valor R$ ${amount.toFixed(2)} abaixo do mínimo da gateway ${name} (R$ ${cfg.minAmount.toFixed(2)}).`,
            400, 'GATEWAY_AMOUNT_TOO_LOW'
        );
    }
    if (amount > cfg.maxAmount) {
        fail(
            `Valor R$ ${amount.toFixed(2)} acima do máximo da gateway ${name} (R$ ${cfg.maxAmount.toFixed(2)}).`,
            400, 'GATEWAY_AMOUNT_TOO_HIGH'
        );
    }

    const s = stateOf(name);
    const now = Date.now();
    s.attempts = s.attempts.filter(t => now - t < 60_000);
    if (s.attempts.length >= cfg.maxPerMin) {
        fail(
            `Gateway ${name} em limite de uso (${cfg.maxPerMin}/min). Tente novamente em instantes.`,
            429, 'GATEWAY_RATE_LIMITED'
        );
    }
    if (s.dayTotal + amount > cfg.dailyCap) {
        logger.warn(`[GatewayLimits] ${name} estourou teto diário (R$ ${s.dayTotal.toFixed(2)} + R$ ${amount.toFixed(2)} > R$ ${cfg.dailyCap.toFixed(2)})`);
        fail(
            `Gateway ${name} atingiu o teto diário. Tente novamente amanhã ou use outra forma de pagamento.`,
            429, 'GATEWAY_DAILY_CAP'
        );
    }
    s.attempts.push(now);
}

/** Soma o valor ao teto diário após cobrança gerada com sucesso. */
export function recordSuccess(name: string, amount: number): void {
    const s = stateOf(name);
    s.dayTotal += amount;
}

/**
 * Executa fn com no máximo `maxConcurrent` execuções simultâneas por gateway.
 * Quem chega quando está cheio espera na fila (até `acquireTimeoutMs`).
 */
export async function withSlot<T>(
    name: string,
    cfg: ExternalGatewayLimitConfig,
    fn: () => Promise<T>,
    acquireTimeoutMs = 240_000
): Promise<T> {
    const s = stateOf(name);

    if (s.running >= cfg.maxConcurrent) {
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                const i = s.queue.indexOf(release);
                if (i >= 0) s.queue.splice(i, 1);
                reject(Object.assign(
                    new Error(`Gateway ${name} ocupada. Tente novamente em instantes.`),
                    { statusCode: 429, code: 'GATEWAY_BUSY' }
                ));
            }, acquireTimeoutMs);
            const release = () => {
                clearTimeout(timer);
                resolve();
            };
            s.queue.push(release);
        });
    }
    s.running++;

    try {
        return await fn();
    } finally {
        s.running--;
        const next = s.queue.shift();
        if (next) next();
    }
}
