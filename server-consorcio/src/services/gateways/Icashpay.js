/**
 * icashpay.js — Cliente MTProto via GramJS
 *
 * Substitui totalmente o Playwright. Sem browser, sem DOM, sem parsing de HTML.
 * Comunica com o @Icashpay_bot diretamente pelo protocolo do Telegram.
 *
 * INSTALAÇÃO:
 *   npm install telegram
 *
 * PRIMEIRA EXECUÇÃO (gera a sessão):
 *   node -e "import('./server/icashpay.js').then(m => m.createPixCharge({ amount: 1 }))"
 *   → Pedirá seu número de telefone e o código SMS uma única vez.
 *   → A string de sessão é salva em TELEGRAM_SESSION no .env automaticamente.
 *
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS (.env):
 *   TELEGRAM_API_ID      — obtido em https://my.telegram.org (campo "App api_id")
 *   TELEGRAM_API_HASH    — obtido em https://my.telegram.org (campo "App api_hash")
 *   TELEGRAM_SESSION     — preenchido automaticamente após a primeira execução
 */

import fs from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import input from 'input';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const API_ID    = parseInt(process.env.TELEGRAM_API_ID,  10);
const API_HASH  = process.env.TELEGRAM_API_HASH;
const BOT_USERNAME = 'Icashpay_bot';

const BOT_REPLY_TIMEOUT_MS = 45_000;
const MAX_RETRIES          = 3;

if (!API_ID || !API_HASH) {
  throw new Error(
    'TELEGRAM_API_ID e TELEGRAM_API_HASH são obrigatórios no .env.\n' +
    'Obtenha em: https://my.telegram.org → "API development tools"'
  );
}

// ─── CLIENTE (singleton) ──────────────────────────────────────────────────────

let client = null;

/**
 * MUTEX DE CONCORRÊNCIA
 * Requests simultâneos são enfileirados. Só uma operação por vez no bot.
 */
let operationQueue = Promise.resolve();
const enqueue = (fn) => {
  operationQueue = operationQueue.then(fn).catch(err => { throw err; });
  return operationQueue;
};

async function getClient() {
  if (client?.connected) return client;

  const sessionString = process.env.TELEGRAM_SESSION || '';
  const session       = new StringSession(sessionString);

  client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      // Só é chamado se não houver sessão salva
      console.log('\n[icashpay] Nenhuma sessão encontrada. Iniciando autenticação...');
      return input.text('Número de telefone (ex: +5511999999999): ');
    },
    password: async () => input.text('Senha 2FA (se habilitada): '),
    phoneCode: async () => input.text('Código SMS recebido: '),
    onError: (err) => console.error('[icashpay] Erro de auth:', err),
  });

  // Salva a sessão no .env para não pedir login na próxima vez
  const newSession = client.session.save();
  if (newSession && newSession !== sessionString) {
    _persistSession(newSession);
  }

  console.log('[icashpay] Cliente Telegram conectado ✓');
  return client;
}

/** Escreve TELEGRAM_SESSION no .env sem apagar as outras variáveis */
function _persistSession(sessionString) {
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
    console.log('[icashpay] Sessão salva em .env');
  } catch (err) {
    // Não fatal — só loga. Em produção (Docker, etc.) a sessão fica apenas em memória.
    console.warn('[icashpay] Não foi possível salvar sessão em .env:', err.message);
    console.warn('[icashpay] Defina manualmente TELEGRAM_SESSION=' + sessionString);
  }
}

// ─── HELPER: detecta se o bot já está no estado "aguardando valor" ──────────

// Regex único, reaproveitado em todos os pontos que precisam reconhecer
// a mensagem de prompt de valor (evita duplicar/discordar entre trechos).
const VALUE_PROMPT_REGEX = /envie\s+o\s+valor|informe\s+o\s+valor|digite\s+o\s+valor|valor\s+do\s+dep[oó]sito|quantia/i;

/**
 * Verifica, olhando a última mensagem do bot, se ele já está esperando
 * o valor do depósito (ou seja, se /cancel + clique no botão já foram
 * feitos com sucesso em uma tentativa anterior — mesmo que o ack do
 * clique (GetBotCallbackAnswer) tenha estourado por timeout).
 *
 * Isso evita reenviar /cancel, reabrir o menu e clicar de novo no botão
 * "Depositar" a cada retry, o que confundia o estado do bot.
 *
 * @param {TelegramClient} tg
 * @returns {Promise<boolean>}
 */
async function isBotAwaitingValue(tg) {
  try {
    const messages = await tg.getMessages(BOT_USERNAME, { limit: 3 });
    const last = messages?.[0];
    if (!last) return false;
    const text = last.message || last.text || '';
    return VALUE_PROMPT_REGEX.test(text);
  } catch (err) {
    console.warn('[icashpay] Não foi possível checar estado do bot:', err.message);
    return false;
  }
}

// ─── HELPER: aguarda resposta do bot ─────────────────────────────────────────

/**
 * Aguarda a próxima mensagem do bot que satisfaça matchFn.
 *
 * Usa o sistema de eventos do GramJS (NewMessage) — sem polling,
 * sem setTimeout arbitrário, sem parsing de DOM.
 *
 * @param {TelegramClient} tg
 * @param {(text: string) => boolean} matchFn
 * @param {number} [timeout]
 * @returns {Promise<import('telegram').Api.Message>}
 */
function waitForBotReply(tg, matchFn, timeout = BOT_REPLY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      tg.removeEventHandler(handler, event);
      reject(new Error(`Timeout (${timeout}ms) aguardando resposta do bot.`));
    }, timeout);

    const event   = new NewMessage({ fromUsers: [BOT_USERNAME] });
    const handler = async (update) => {
      // IMPORTANTE: .message é o texto CRU da mensagem. .text reconstrói o
      // texto a partir das entities (markdown) — se o Telegram detectar uma
      // URL dentro do código PIX (comum, já que o payload EMV pode conter
      // "br.gov.bcb.pix...com.br/v1/...") e o bot usar um hyperlink oculto
      // ali, .text vira "[texto](url)" e quebra o payload. Sempre priorizar
      // .message.
      const text = update.message.message || update.message.text || '';
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
 *
 * Via GramJS recebemos o texto puro da mensagem — sem HTML, sem nós partidos.
 * O formato é:
 *   "💰 PIX GERADO\nValor: R$ 2.00\n📋 Copia e cola:\n000201...PAGAMENTS SEGUROS BRASIL...6304BAED"
 *
 * Estratégia:
 *   1. Localiza "000201" no texto.
 *   2. Extrai tudo até o ÚLTIMO "6304" + 4 hex (campo CRC do EMV).
 *   3. Remove apenas \r\n\t (preserva espaços internos dos campos EMV).
 *   4. Valida CRC-16/CCITT-FALSE.
 */
function extractAndValidatePix(rawText) {
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

  const payload         = match[1];
  const embeddedCRCRaw  = match[2]; // exatamente como veio, sem alterar caixa
  const calculatedCRC   = calcCRC16(payload);

  // Comparação de hex é naturalmente case-insensitive (7fb7 === 7FB7),
  // então normalizamos só para ESTA comparação — embeddedCRCRaw (o que
  // vai pro código final) permanece intocado.
  if (calculatedCRC !== embeddedCRCRaw.toUpperCase()) {
    throw new Error(
      `CRC inválido: calculado=${calculatedCRC}, no código=${embeddedCRCRaw}. ` +
      `Provável truncamento. Payload len=${payload.length}`
    );
  }

  // Nenhuma alteração de caixa em lugar nenhum — o código final sai
  // caractere por caractere igual ao que o bot enviou (.message, texto
  // cru). Qualquer .toUpperCase()/.toLowerCase() aqui quebraria o CRC
  // e invalidaria o código PIX no app do banco.
  const finalCode = payload + embeddedCRCRaw;
  console.log(`[icashpay] CRC ✓ (${embeddedCRCRaw}) — comprimento: ${finalCode.length}`);
  return finalCode;
}

/** CRC-16/CCITT-FALSE — algoritmo oficial Banco Central para EMV PIX */
function calcCRC16(str) {
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
 *
 * @param {{ amount: number }} options
 * @returns {{ pixCode: string, transactionId: string, pixGeneratedAt: string, ok: true }}
 */
export async function createPixCharge({ amount }) {
  return enqueue(() => _createPixChargeImpl({ amount }));
}

async function _createPixChargeImpl({ amount }) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tg = await getClient();

      // 0. Verifica se o bot JÁ está esperando o valor do depósito
      //    (ex.: tentativa anterior clicou no botão, mas o ack do clique
      //    estourou em BOT_RESPONSE_TIMEOUT — o clique valeu, só a
      //    confirmação síncrona que não chegou a tempo).
      //    Se já estiver nesse estado, pulamos reset + clique e vamos
      //    direto para o envio do valor, evitando confundir o bot.
      const alreadyAwaitingValue = await isBotAwaitingValue(tg);

      if (alreadyAwaitingValue) {
        console.log('[icashpay] Bot já está aguardando o valor — pulando /cancel, menu e clique.');
      } else {
        // 1. Reseta estado do bot
        await tg.sendMessage(BOT_USERNAME, { message: '/cancel' });
        await new Promise(r => setTimeout(r, 600));
        await tg.sendMessage(BOT_USERNAME, { message: '/start' });

        // 2. Aguarda o bot mostrar o menu com o botão "Depositar"
        //    Via MTProto, botões inline chegam como ReplyInlineMarkup na mensagem.
        //    Aguardamos qualquer mensagem de boas-vindas/menu do bot.
        const menuMsg = await waitForBotReply(
          tg,
          (t) => t.toLowerCase().includes('depositar') || t.toLowerCase().includes('menu') || t.toLowerCase().includes('bem-vindo'),
          20_000
        );

        // 3. Clica no botão "Depositar" via API nativa (sem DOM!)
        //    GetBotCallbackAnswer simula o clique no botão inline.
        const buttons = menuMsg.replyMarkup?.rows ?? [];
        let depositButton = null;

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

        // Clique nativo no botão inline — a forma correta via MTProto
        // Disparamos o clique sem o 'await' para não ficar preso no BOT_RESPONSE_TIMEOUT,
        // já que o bot processa o comando e avança sem enviar o ACK síncrono.
        tg.invoke(
          new Api.messages.GetBotCallbackAnswer({
            peer:    BOT_USERNAME,
            msgId:   menuMsg.id,
            data:    depositButton.data,
          })
        ).catch(cbErr => {
          if (!String(cbErr.message || '').includes('BOT_RESPONSE_TIMEOUT')) {
            console.error('[icashpay] Erro inesperado ao clicar no botão inline:', cbErr);
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
      const amountFormatted = Number(amount).toFixed(2); // e.g. 1500 → "1500.00", uses period (bot requirement)
      await tg.sendMessage(BOT_USERNAME, { message: amountFormatted });

      // 6. Aguarda a resposta com o código PIX
      //    Identifica pela presença de "000201" ou "Copia e cola" no texto puro
      const pixMsg = await waitForBotReply(
        tg,
        (t) => t.includes('000201') || /copia\s*e\s*cola/i.test(t),
        BOT_REPLY_TIMEOUT_MS
      );

      // 7. Extrai e valida o CRC — texto puro, sem parsing de DOM
      //    CRÍTICO: usar .message (texto cru), NÃO .text.
      //    .text reconstrói a mensagem a partir das entities aplicando
      //    markdown — e como o payload EMV do PIX contém um trecho que
      //    parece uma URL (br.gov.bcb.pix...com.br/v1/...), o Telegram cria
      //    uma entity de hyperlink ali. Se o bot usa link oculto (text_url),
      //    .text produz "[CÓDIGO](url)" em vez do payload puro, quebrando o
      //    CRC. .message nunca sofre esse processamento.
      const rawText = pixMsg.message || pixMsg.text || '';
      const pixCode = extractAndValidatePix(rawText);

      // Timestamp da mensagem do bot (epoch em segundos na API do Telegram)
      const pixGeneratedAt = pixMsg.date
        ? new Date(pixMsg.date * 1000).toISOString()
        : sentAt.toISOString();

      console.log(
        `[icashpay] ✓ PIX R$${amount} | tentativa ${attempt} | ` +
        `${pixCode.slice(0, 50)}... | len=${pixCode.length} | ts=${pixGeneratedAt}`
      );

      return {
        pixCode,
        transactionId:  `tx_${Date.now()}`,
        pixGeneratedAt,
        ok: true,
      };

    } catch (err) {
      lastError = err;
      console.error(`[icashpay] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        const backoff = 2000 * (2 ** (attempt - 1)); // 2s → 4s → 8s
        console.log(`[icashpay] Back-off ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }

  throw new Error(`createPixCharge falhou após ${MAX_RETRIES} tentativas: ${lastError?.message}`);
}

/**
 * Verifica se o pagamento foi confirmado.
 *
 * Busca nas últimas 20 mensagens do bot por "Pagamento confirmado!"
 * com timestamp posterior a pixGeneratedAt.
 *
 * @param {string} txId
 * @param {string} [pixGeneratedAt] — ISO string do momento de geração do PIX
 * @returns {'approved' | 'pending'}
 */
export async function checkPaymentStatus(txId, pixGeneratedAt) {
  return enqueue(() => _checkStatusImpl(txId, pixGeneratedAt));
}

async function _checkStatusImpl(txId, pixGeneratedAt) {
  try {
    const tg = await getClient();

    const anchor = pixGeneratedAt
      ? new Date(pixGeneratedAt)
      : new Date(parseInt(txId.replace('tx_', ''), 10) || 0);

    // Busca histórico de mensagens do bot diretamente via MTProto
    const messages = await tg.getMessages(BOT_USERNAME, { limit: 20 });

    for (const msg of messages) {
      const text = msg.message || msg.text || '';
      if (!text.includes('Pagamento confirmado!')) continue;

      // Telegram retorna date em epoch segundos
      const msgTime = msg.date ? new Date(msg.date * 1000) : null;

      if (msgTime) {
        if (msgTime <= anchor) {
          console.warn(
            `[icashpay] Confirmação ignorada (anterior ao PIX): ` +
            `msg=${msgTime.toISOString()} anchor=${anchor.toISOString()}`
          );
          continue;
        }
      } else {
        console.warn('[icashpay] Timestamp da mensagem não disponível — aceitando.');
      }

      console.log(`[icashpay] ✓ Pagamento ${txId} APROVADO.`);
      return 'approved';
    }

    return 'pending';

  } catch (err) {
    console.error('[icashpay] checkPaymentStatus erro:', err.message);
    return 'pending';
  }
}

/**
 * Cancela a operação ativa no bot enviando /cancel.
 * Chamado automaticamente quando a cobrança expira (após 15 minutos) ou quando o usuário cancela o checkout.
 *
 * @returns {Promise<boolean>}
 */
export async function cancelPixCharge() {
  return enqueue(async () => {
    try {
      const tg = await getClient();
      console.log('[icashpay] Enviando /cancel para resetar o estado do bot por expiração...');
      await tg.sendMessage(BOT_USERNAME, { message: '/cancel' });
      console.log('[icashpay] /cancel enviado com sucesso ✓');
      return true;
    } catch (err) {
      console.warn('[icashpay] Aviso ao enviar /cancel no Telegram:', err.message);
      return false;
    }
  });
}