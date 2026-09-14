/**
 * Icashpay.ts — Cliente MTProto via GramJS (TypeScript)
 *
 * Substitui totalmente o Playwright. Sem browser, sem DOM, sem parsing de HTML.
 * Comunica com o @Icashpay_bot diretamente pelo protocolo do Telegram.
 *
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS (.env):
 *   TELEGRAM_API_ID      — obtido em https://my.telegram.org (campo "App api_id")
 *   TELEGRAM_API_HASH    — obtido em https://my.telegram.org (campo "App api_hash")
 *   TELEGRAM_SESSION     — preenchido automaticamente após a primeira execução
 */

import fs from 'node:fs';
import path from 'node:path';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { logger } from '../../config/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const input = require('input');

// ─── INTERFACES & TIPOS ────────────────────────────────────────────────────────

export interface CreatePixChargeOptions {
    amount: number | string;
}

export interface PixChargeResponse {
    pixCode: string;
    transactionId: string;
    pixGeneratedAt: string;
    ok: true;
}

export type PaymentConfirmationStatus = 'approved' | 'pending';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const BOT_USERNAME = 'Icashpay_bot';
const BOT_REPLY_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;

function getTelegramCredentials() {
    const apiIdStr = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const apiId = apiIdStr ? parseInt(apiIdStr, 10) : 0;

    if (!apiId || !apiHash) {
        logger.warn(
            '[icashpay] TELEGRAM_API_ID e TELEGRAM_API_HASH não configurados no .env. ' +
            'Obtenha em: https://my.telegram.org'
        );
    }

    return { apiId, apiHash };
}

// ─── CLIENTE (singleton) ──────────────────────────────────────────────────────

let client: TelegramClient | null = null;

/**
 * MUTEX DE CONCORRÊNCIA
 * Requests simultâneos são enfileirados. Só uma operação por vez no bot.
 */
let operationQueue: Promise<any> = Promise.resolve();

const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = operationQueue.then(fn, fn);
    operationQueue = next;
    return next;
};

export async function getClient(): Promise<TelegramClient> {
    if (client?.connected) return client;

    const { apiId, apiHash } = getTelegramCredentials();
    if (!apiId || !apiHash) {
        throw new Error(
            'TELEGRAM_API_ID e TELEGRAM_API_HASH são obrigatórios no .env.\n' +
            'Obtenha em: https://my.telegram.org → "API development tools"'
        );
    }

    const sessionString = process.env.TELEGRAM_SESSION || '';
    const session = new StringSession(sessionString);

    client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => {
            // Só é chamado se não houver sessão salva
            logger.info('[icashpay] Nenhuma sessão encontrada. Iniciando autenticação...');
            return input.text('Número de telefone (ex: +5511999999999): ');
        },
        password: async () => input.text('Senha 2FA (se habilitada): '),
        phoneCode: async () => input.text('Código SMS recebido: '),
        onError: (err: Error) => {
            logger.error('[icashpay] Erro de auth:', err);
        },
    });

    // Salva a sessão no .env para não pedir login na próxima vez
    const newSession = client.session.save() as unknown as string;
    if (newSession && newSession !== sessionString) {
        _persistSession(newSession);
    }

    logger.info('[icashpay] Cliente Telegram conectado ✓');
    return client;
}

/** Escreve TELEGRAM_SESSION no .env sem apagar as outras variáveis */
function _persistSession(sessionString: string): void {
    const envPath = path.resolve(process.cwd(), '.env');
    try {
        let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (/^TELEGRAM_SESSION=/m.test(content)) {
            content = content.replace(/^TELEGRAM_SESSION=.*$/m, `TELEGRAM_SESSION=${sessionString}`);
        } else {
            content += `\nTELEGRAM_SESSION=${sessionString}\n`;
        }
        fs.writeFileSync(envPath, content);
        process.env.TELEGRAM_SESSION = sessionString;
        logger.info('[icashpay] Sessão salva em .env');
    } catch (err: any) {
        // Não fatal — só loga. Em produção (Docker, etc.) a sessão fica apenas em memória.
        logger.warn(`[icashpay] Não foi possível salvar sessão em .env: ${err.message}`);
        logger.warn(`[icashpay] Defina manualmente TELEGRAM_SESSION=${sessionString}`);
    }
}

// ─── HELPER: detecta se o bot já está no estado "aguardando valor" ──────────

// Regex único, reaproveitado em todos os pontos que precisam reconhecer
// a mensagem de prompt de valor (evita duplicar/discordar entre trechos).
const VALUE_PROMPT_REGEX = /envie\s+o\s+valor|informe\s+o\s+valor|digite\s+o\s+valor|valor\s+do\s+dep[oó]sito|quantia/i;

/**
 * Verifica se o bot já está esperando o valor do depósito
 */
export async function isBotAwaitingValue(tg: TelegramClient): Promise<boolean> {
    try {
        const messages = await tg.getMessages(BOT_USERNAME, { limit: 3 });
        const last = messages?.[0];
        if (!last) return false;
        const text = (last as any).message || (last as any).text || '';
        return VALUE_PROMPT_REGEX.test(text);
    } catch (err: any) {
        logger.warn(`[icashpay] Não foi possível checar estado do bot: ${err.message}`);
        return false;
    }
}

// ─── HELPER: aguarda resposta do bot ─────────────────────────────────────────

/**
 * Aguarda a próxima mensagem do bot que satisfaça matchFn.
 */
export function waitForBotReply(
    tg: TelegramClient,
    matchFn: (text: string) => boolean,
    timeout: number = BOT_REPLY_TIMEOUT_MS
): Promise<Api.Message> {
    return new Promise((resolve, reject) => {
        const event = new NewMessage({ fromUsers: [BOT_USERNAME] });

        const timer = setTimeout(() => {
            tg.removeEventHandler(handler, event);
            reject(new Error(`Timeout (${timeout}ms) aguardando resposta do bot.`));
        }, timeout);

        const handler = async (update: any) => {
            const text = update.message?.message || update.message?.text || '';
            if (matchFn(text)) {
                clearTimeout(timer);
                tg.removeEventHandler(handler, event);
                resolve(update.message);
            }
        };

        tg.addEventHandler(handler, event);
    });
}

// ─── EXTRAÇÃO DO CÓDIGO PIX ───────────────────────────────────────────────────

/**
 * Extrai o código PIX EMV do texto puro da mensagem do bot.
 */
export function extractAndValidatePix(rawText: string): string {
    const startIdx = rawText.indexOf('000201');
    if (startIdx === -1) {
        throw new Error('Código EMV (000201) não encontrado. Texto: "' + rawText.slice(0, 120) + '"');
    }

    // Remove quebras de linha/tabs mas preserva espaços (campos EMV têm espaços internos)
    const candidate = rawText.slice(startIdx).replace(/[\r\n\t]/g, '');

    // Regex greedy — captura até o ÚLTIMO 6304 + 4 hex (campo CRC obrigatório do EMV)
    const match = candidate.match(/^(000201[\w\W]*6304)([0-9A-Fa-f]{4})/);
    if (!match) {
        throw new Error(
            'CRC (6304XXXX) não encontrado. Código incompleto. ' +
            'Trecho: "' + candidate.slice(0, 150) + '"'
        );
    }

    const payload = match[1];
    const embeddedCRCRaw = match[2]; // exatamente como veio, sem alterar caixa
    const calculatedCRC = calcCRC16(payload);

    if (calculatedCRC !== embeddedCRCRaw.toUpperCase()) {
        throw new Error(
            `CRC inválido: calculado=${calculatedCRC}, no código=${embeddedCRCRaw}. ` +
            `Provável truncamento. Payload len=${payload.length}`
        );
    }

    const finalCode = payload + embeddedCRCRaw;
    logger.info(`[icashpay] CRC ✓ (${embeddedCRCRaw}) — comprimento: ${finalCode.length}`);
    return finalCode;
}

/** CRC-16/CCITT-FALSE — algoritmo oficial Banco Central para EMV PIX */
export function calcCRC16(str: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// ─── API PÚBLICA ──────────────────────────────────────────────────────────────

/**
 * Cria cobrança PIX via @Icashpay_bot usando MTProto (sem browser).
 */
export async function createPixCharge(options: CreatePixChargeOptions): Promise<PixChargeResponse> {
    return enqueue(() => _createPixChargeImpl(options));
}

async function _createPixChargeImpl({ amount }: CreatePixChargeOptions): Promise<PixChargeResponse> {
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const tg = await getClient();

            const alreadyAwaitingValue = await isBotAwaitingValue(tg);

            if (alreadyAwaitingValue) {
                logger.info('[icashpay] Bot já está aguardando o valor — pulando /cancel, menu e clique.');
            } else {
                // 1. Reseta estado do bot
                await tg.sendMessage(BOT_USERNAME, { message: '/cancel' });
                await new Promise(r => setTimeout(r, 600));
                await tg.sendMessage(BOT_USERNAME, { message: '/start' });

                // 2. Aguarda o bot mostrar o menu com o botão "Depositar"
                const menuMsg = await waitForBotReply(
                    tg,
                    (t) => t.toLowerCase().includes('depositar') || t.toLowerCase().includes('menu') || t.toLowerCase().includes('bem-vindo'),
                    20_000
                );

                // 3. Clica no botão "Depositar" via API nativa
                const buttons = (menuMsg as any).replyMarkup?.rows ?? [];
                let depositButton: any = null;

                for (const row of buttons) {
                    for (const btn of (row.buttons ?? [])) {
                        const label = btn.text || '';
                        if (/depositar/i.test(label)) {
                            depositButton = btn;
                            break;
                        }
                    }
                    if (depositButton) break;
                }

                if (!depositButton) {
                    throw new Error('Botão "Depositar" não encontrado no markup do bot.');
                }

                tg.invoke(
                    new Api.messages.GetBotCallbackAnswer({
                        peer: BOT_USERNAME,
                        msgId: menuMsg.id,
                        data: depositButton.data,
                    })
                ).catch(cbErr => {
                    if (!String(cbErr.message || '').includes('BOT_RESPONSE_TIMEOUT')) {
                        logger.error('[icashpay] Erro inesperado ao clicar no botão inline:', cbErr);
                    }
                });

                // 4. Aguarda o bot pedir o valor
                await waitForBotReply(
                    tg,
                    (t) => VALUE_PROMPT_REGEX.test(t) || /valor|quantia|informe|digite/i.test(t),
                    20_000
                ).catch(() => {
                    throw new Error('Timeout aguardando o bot pedir o valor. Reiniciando fluxo.');
                });
            }

            // 5. Envia o valor e registra o timestamp de envio
            const sentAt = new Date();
            const amountFormatted = Number(amount).toFixed(2);
            await tg.sendMessage(BOT_USERNAME, { message: amountFormatted });

            // 6. Aguarda a resposta com o código PIX
            const pixMsg = await waitForBotReply(
                tg,
                (t) => t.includes('000201') || /copia\s*e\s*cola/i.test(t),
                BOT_REPLY_TIMEOUT_MS
            );

            // 7. Extrai e valida o CRC
            const rawText = (pixMsg as any).message || (pixMsg as any).text || '';
            const pixCode = extractAndValidatePix(rawText);

            const pixGeneratedAt = (pixMsg as any).date
                ? new Date((pixMsg as any).date * 1000).toISOString()
                : sentAt.toISOString();

            logger.info(
                `[icashpay] ✓ PIX R$${amount} | tentativa ${attempt} | ` +
                `${pixCode.slice(0, 50)}... | len=${pixCode.length} | ts=${pixGeneratedAt}`
            );

            return {
                pixCode,
                transactionId: `tx_${Date.now()}`,
                pixGeneratedAt,
                ok: true,
            };

        } catch (err: any) {
            lastError = err;
            logger.error(`[icashpay] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}`);

            if (attempt < MAX_RETRIES) {
                const backoff = 2000 * (2 ** (attempt - 1));
                logger.info(`[icashpay] Back-off ${backoff}ms...`);
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    throw new Error(`createPixCharge falhou após ${MAX_RETRIES} tentativas: ${lastError?.message}`);
}

/**
 * Verifica se o pagamento foi confirmado.
 */
export async function checkPaymentStatus(txId: string, pixGeneratedAt?: string): Promise<PaymentConfirmationStatus> {
    return enqueue(() => _checkStatusImpl(txId, pixGeneratedAt));
}

async function _checkStatusImpl(txId: string, pixGeneratedAt?: string): Promise<PaymentConfirmationStatus> {
    try {
        const tg = await getClient();

        const anchor = pixGeneratedAt
            ? new Date(pixGeneratedAt)
            : new Date(parseInt(txId.replace('tx_', ''), 10) || 0);

        const messages = await tg.getMessages(BOT_USERNAME, { limit: 20 });

        for (const msg of messages) {
            const text = (msg as any).message || (msg as any).text || '';
            if (!text.includes('Pagamento confirmado!')) continue;

            const msgTime = (msg as any).date ? new Date((msg as any).date * 1000) : null;

            if (msgTime) {
                if (msgTime <= anchor) {
                    logger.warn(
                        `[icashpay] Confirmação ignorada (anterior ao PIX): ` +
                        `msg=${msgTime.toISOString()} anchor=${anchor.toISOString()}`
                    );
                    continue;
                }
            } else {
                logger.warn('[icashpay] Timestamp da mensagem não disponível — aceitando.');
            }

            logger.info(`[icashpay] ✓ Pagamento ${txId} APROVADO.`);
            return 'approved';
        }

        return 'pending';

    } catch (err: any) {
        logger.error(`[icashpay] checkPaymentStatus erro: ${err.message}`);
        return 'pending';
    }
}

/**
 * Cancela a operação ativa no bot enviando /cancel.
 */
export async function cancelPixCharge(): Promise<boolean> {
    return enqueue(async () => {
        try {
            const tg = await getClient();
            logger.info('[icashpay] Enviando /cancel para resetar o estado do bot por expiração...');
            await tg.sendMessage(BOT_USERNAME, { message: '/cancel' });
            logger.info('[icashpay] /cancel enviado com sucesso ✓');
            return true;
        } catch (err: any) {
            logger.warn(`[icashpay] Aviso ao enviar /cancel no Telegram: ${err.message}`);
            return false;
        }
    });
}

// ─── CLASSE DE SERVIÇO (padrão com outros gateways) ──────────────────────────

export class IcashPayService {
    static async createPixCharge(options: CreatePixChargeOptions): Promise<PixChargeResponse> {
        return createPixCharge(options);
    }

    static async checkPaymentStatus(txId: string, pixGeneratedAt?: string): Promise<PaymentConfirmationStatus> {
        return checkPaymentStatus(txId, pixGeneratedAt);
    }

    static async cancelPixCharge(): Promise<boolean> {
        return cancelPixCharge();
    }
}
