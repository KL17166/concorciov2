import { Router, Request, Response } from 'express';
import {
  getPipwaveConfig,
  getPipwavePaymentMethodDetails,
  submitPipwavePayment,
  prepaymentCheck,
} from '../g2g';

/**
 * ROTA CARTÃO — fisicamente separada da rota PIX (ver src/routes/pix.ts).
 *
 * Mesmo esqueleto Pipwave do Pix (FLUXO.md §1 passos 8b–9c), mas com o
 * método de cartão do cardápio get-config (cat_1 Credit & Debit Card):
 *   891 airwallex.visa_mor       (Visa)
 *   892 airwallex.mastercard_mor (Mastercard)
 *
 * Diferença de comportamento vs Pix:
 *   - prepayment-check volta com `challenge` PREENCHIDO (objeto 3DS —
 *     Cardinal/ACS), não null. O desafio 3DS exige browser (redirect +
 *     interação), então este fluxo PARA após o prepayment-check e devolve
 *     o challenge + redirectUrl para o chamador concluir no browser.
 *   - Captura do 3DS: python3 capture_3ds.py / capture_3ds_chrome.py
 *     (ver FLUXO.md §3 e §4.8).
 */

export const CARD_METHOD_CODES = {
  visa: 'airwallex.visa_mor',
  mastercard: 'airwallex.mastercard_mor',
} as const;

export type CardBrand = keyof typeof CARD_METHOD_CODES;

export interface CardPayInput {
  pipwaveToken: string;
  pipwaveApiKey: string;
  orderId: string;
  /** 'visa' | 'mastercard' (default 'mastercard'). */
  brand?: CardBrand;
  total?: string;
  currency?: string;
}

export interface CardPayResult {
  method: 'card';
  brand: CardBrand;
  methodCode: string;
  payableAmount?: string;
  surcharge?: number;
  totalComTaxa?: string | number;
  currency?: string;
  redirectUrl: string;
  /** Objeto 3DS (Cardinal/ACS). null inesperado aqui = rever captura. */
  challenge: any;
  pmId?: number;
  next: string;
}

function normalizeBrand(brand?: string): CardBrand {
  const b = String(brand || 'mastercard').trim().toLowerCase();
  if (b === 'visa') return 'visa';
  return 'mastercard';
}

export async function runCardFlow(
  input: CardPayInput,
  onStep?: (step: string, data: any) => void,
): Promise<CardPayResult> {
  const { pipwaveToken, pipwaveApiKey, orderId } = input;
  const brand = normalizeBrand(input.brand);
  const methodCode = CARD_METHOD_CODES[brand];
  if (!pipwaveToken || !pipwaveApiKey || !orderId) {
    throw new Error('runCardFlow: pipwaveToken, pipwaveApiKey e orderId são obrigatórios.');
  }

  const config = await getPipwaveConfig(pipwaveToken, pipwaveApiKey, orderId);
  onStep?.('8b-pipwave-config', { payableAmount: config.payableAmount });

  const details = await getPipwavePaymentMethodDetails(
    pipwaveToken,
    pipwaveApiKey,
    methodCode,
  );
  onStep?.('9-payment-details', { total: details.amount?.total });

  const submit = await submitPipwavePayment(pipwaveToken, pipwaveApiKey, methodCode);
  const check = await prepaymentCheck(pipwaveToken, pipwaveApiKey);
  onStep?.('9b-prepayment-check', {
    challenge: check.challenge ? 'presente (3DS)' : 'null (inesperado p/ cartão)',
    pmId: check.pmId,
  });

  const redirectUrl = submit.redirectUrl || check.redirectUrl || '';

  return {
    method: 'card',
    brand,
    methodCode,
    payableAmount: config.payableAmount,
    surcharge: details.amount?.surcharge,
    totalComTaxa: details.amount?.final_total ?? details.amount?.total,
    currency: details.amount?.currency,
    redirectUrl,
    challenge: check.challenge,
    pmId: check.pmId,
    next: check.challenge
      ? 'Abrir redirectUrl no browser e concluir o desafio 3DS (Cardinal/ACS).'
      : 'Challenge veio null — comportamento de Pix. Conferir se o método clicado foi o do cartão (ids 891/892).',
  };
}

/**
 * POST /api/pay/card
 * Body: { pipwaveToken, pipwaveApiKey, orderId, brand?: 'visa'|'mastercard', total?, currency? }
 * Avança até o prepayment-check e devolve challenge 3DS + redirectUrl.
 */
export const cardRouter = Router();

cardRouter.post('/pay/card', async (req: Request, res: Response) => {
  try {
    const result = await runCardFlow((req.body || {}) as CardPayInput);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('❌ [CARD] falhou:', err.message);
    return res.status(500).json({ success: false, method: 'card', error: err.message });
  }
});
