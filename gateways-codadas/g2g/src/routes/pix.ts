import { Router, Request, Response } from 'express';
import {
  getPipwaveConfig,
  getPipwavePaymentMethodDetails,
  submitPipwavePayment,
  prepaymentCheck,
  getTazapayCheckoutUrl,
  getTazapayPix,
} from '../g2g';

/**
 * ROTA PIX — fisicamente separada da rota Cartão (ver src/routes/card.ts).
 *
 * Fluxo reproduzido do tráfego real (FLUXO.md §1 passos 8b–11):
 *   8b. POST api.pipwave.com/payment/sdk/{token}/get-config            (cardápio)
 *   9a. POST .../get-payment-method-details (tazapay.PIX-QR)
 *   9b. POST .../submit-payment
 *   9c. POST .../prepayment-check (challenge: null = Pix direto)
 *   10. GET  secure.pipwave.com/load?token= -> checkout.tazapay.com (tela CPF)
 *   11. GET  service.tazapay.com/v3/payin/session/{token} -> payin_id
 *       POST service.tazapay.com/v3/payin/attempt (CPF) -> qr_code Base64
 *       base64_decode(qr_code) -> BR Code copia-e-cola
 */

export const PIX_METHOD_CODE = 'tazapay.PIX-QR';
export const PIX_METHOD_ID = 856;

export interface PixPayInput {
  pipwaveToken: string;
  pipwaveApiKey: string;
  orderId: string;
  /** Total de referência (vem do summary); o valor cobrado vem do gateway. */
  total?: string;
  currency?: string;
  /** CPF só com dígitos (default de homologação mantido no server). */
  cpf?: string;
}

export interface PixPayResult {
  method: 'pix';
  methodCode: typeof PIX_METHOD_CODE;
  payableAmount?: string;
  surcharge?: number;
  totalComTaxa?: string | number;
  currency?: string;
  checkoutUrl: string;
  brCode: string;
  pixExpiryDate: string;
  paymentAttemptId: string;
  pspReferenceId: string;
  challenge: any;
  pmId?: number;
}

const mask = (s: string) =>
  s && s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s;

export async function runPixFlow(
  input: PixPayInput,
  onStep?: (step: string, data: any) => void,
): Promise<PixPayResult> {
  const { pipwaveToken, pipwaveApiKey, orderId, cpf = '21275117783' } = input;
  if (!pipwaveToken || !pipwaveApiKey || !orderId) {
    throw new Error('runPixFlow: pipwaveToken, pipwaveApiKey e orderId são obrigatórios.');
  }

  const config = await getPipwaveConfig(pipwaveToken, pipwaveApiKey, orderId);
  onStep?.('8b-pipwave-config', { payableAmount: config.payableAmount });

  const details = await getPipwavePaymentMethodDetails(
    pipwaveToken,
    pipwaveApiKey,
    PIX_METHOD_CODE,
  );
  onStep?.('9-payment-details', { total: details.amount?.total });

  const submit = await submitPipwavePayment(
    pipwaveToken,
    pipwaveApiKey,
    PIX_METHOD_CODE,
  );
  const check = await prepaymentCheck(pipwaveToken, pipwaveApiKey);
  onStep?.('9b-prepayment-check', {
    redirectUrl: mask(submit.redirectUrl || check.redirectUrl),
    challenge: check.challenge,
    pmId: check.pmId,
  });

  let checkoutUrl = await getTazapayCheckoutUrl(pipwaveToken);
  if (submit.redirectUrl && !checkoutUrl.includes('checkout.tazapay.com')) {
    checkoutUrl = submit.redirectUrl;
  }
  if (check.redirectUrl && !checkoutUrl.includes('checkout.tazapay.com')) {
    checkoutUrl = check.redirectUrl;
  }
  onStep?.('10-tazapay-checkout', { checkoutUrl });

  let brCode = '';
  let pixExpiryDate = '';
  let paymentAttemptId = '';
  let pspReferenceId = '';
  if (checkoutUrl.includes('checkout.tazapay.com')) {
    const pix = await getTazapayPix(checkoutUrl, cpf);
    brCode = pix.brCode;
    pixExpiryDate = pix.expiryDate;
    paymentAttemptId = pix.paymentAttemptId;
    pspReferenceId = pix.pspReferenceId;
    onStep?.('11-pix-brcode', {
      expiryDate: pix.expiryDate,
      paymentAttemptId: pix.paymentAttemptId,
    });
  }

  return {
    method: 'pix',
    methodCode: PIX_METHOD_CODE,
    payableAmount: config.payableAmount,
    surcharge: details.amount?.surcharge,
    totalComTaxa: details.amount?.final_total ?? details.amount?.total,
    currency: details.amount?.currency,
    checkoutUrl,
    brCode,
    pixExpiryDate,
    paymentAttemptId,
    pspReferenceId,
    challenge: check.challenge,
    pmId: check.pmId,
  };
}

/**
 * POST /api/pay/pix
 * Body: { pipwaveToken, pipwaveApiKey, orderId, total?, currency?, cpf? }
 * Executa passos 8b–11 e devolve checkoutUrl + BR Code copia-e-cola.
 */
export const pixRouter = Router();

pixRouter.post('/pay/pix', async (req: Request, res: Response) => {
  try {
    const result = await runPixFlow((req.body || {}) as PixPayInput);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('❌ [PIX] falhou:', err.message);
    return res.status(500).json({ success: false, method: 'pix', error: err.message });
  }
});
