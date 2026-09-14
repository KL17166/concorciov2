import { PaymentGatewayFactory } from '../integrations/payments/PaymentGatewayFactory';
import { PaymentRequest, PaymentResult, ensurePixQrCode } from '../integrations/payments/PaymentGateway';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface FailoverAttemptError {
    gatewayName: string;
    errorMessage: string;
    statusCode?: number;
}

export class PaymentFailoverService {
    /**
     * Executa o processamento do pagamento com failover em cascata.
     * Tenta a gateway padrão/primária primeiro. Se falhar (ex: por limite de valor da SigiloPay,
     * timeout, erro 500, etc.), tenta automaticamente as próximas gateways ativas.
     * Registra alertas no banco para o administrador caso ocorra qualquer incidente.
     */
    static async executePaymentWithFailover(request: PaymentRequest): Promise<PaymentResult> {
        const candidateGateways = await PaymentGatewayFactory.getCandidateGateways(request.method);
        const failedAttempts: FailoverAttemptError[] = [];

        for (let i = 0; i < candidateGateways.length; i++) {
            const gateway = candidateGateways[i];
            try {
                logger.info(`[PaymentFailover] Tentando gateway ${gateway.name} para parcela ${request.installmentId} (R$ ${request.amount})`);
                const rawResult = await gateway.createPayment(request);

                // Normaliza o Pix para garantir QR Code gerado
                const normalizedResult = await ensurePixQrCode(rawResult, request.method);

                // Se houve falha em gateway(s) anterior(es), mas esta teve sucesso, registra aviso de contingência para o admin
                if (failedAttempts.length > 0) {
                    const failedSummary = failedAttempts
                        .map(f => `${f.gatewayName}: "${f.errorMessage}"`)
                        .join(' | ');

                    const alertTitle = `Falha em Gateway de Pagamento (Recuperado com Sucesso)`;
                    const alertMessage = `O cliente ${request.customer.name} (CPF: ${request.customer.document}) tentou gerar pagamento de R$ ${request.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, mas ocorreu falha [${failedSummary}]. O pagamento foi concluído automaticamente com sucesso pela gateway de contingência ${gateway.name}.`;

                    logger.warn(`[PaymentFailover] ${alertMessage}`);

                    try {
                        await (prisma as any).systemAlert.create({
                            data: {
                                type: 'GATEWAY_FAILOVER',
                                severity: 'WARNING',
                                title: alertTitle,
                                message: alertMessage,
                                details: JSON.stringify({
                                    customerId: (request.customer as any).id || null,
                                    customerName: request.customer.name,
                                    customerCpf: request.customer.document,
                                    amount: request.amount,
                                    installmentId: request.installmentId,
                                    method: request.method,
                                    recoveredGateway: gateway.name,
                                    failedAttempts
                                })
                            }
                        });
                    } catch (alertErr) {
                        logger.error('[PaymentFailover] Erro ao gravar alerta no banco:', alertErr);
                    }
                }

                return normalizedResult;
            } catch (err: any) {
                const errorMessage = err?.message || 'Erro desconhecido ao processar pagamento na gateway';
                const statusCode = err?.statusCode || err?.status || 500;

                logger.warn(`[PaymentFailover] Gateway ${gateway.name} falhou para ${request.customer.name} (R$ ${request.amount}): ${errorMessage}`);

                failedAttempts.push({
                    gatewayName: gateway.name,
                    errorMessage,
                    statusCode
                });

                // Se ainda há próximas gateways na fila, continua o loop
                if (i < candidateGateways.length - 1) {
                    logger.info(`[PaymentFailover] Redirecionando pagamento para a próxima gateway ativa (${candidateGateways[i + 1].name})...`);
                    continue;
                }
            }
        }

        // Se todas as gateways falharam:
        const failedNames = failedAttempts.map(f => f.gatewayName).join(', ');
        const lastError = failedAttempts[failedAttempts.length - 1];

        const criticalTitle = `Falha Crítica: Todas as Gateways de Pagamento Falharam`;
        const criticalMessage = `O cliente ${request.customer.name} (CPF: ${request.customer.document}) NÃO conseguiu gerar o pagamento no valor de R$ ${request.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Todas as gateways ativas (${failedNames}) falharam. Motivo principal: "${lastError?.errorMessage}".`;

        logger.error(`[PaymentFailover] ${criticalMessage}`);

        try {
            await (prisma as any).systemAlert.create({
                data: {
                    type: 'PAYMENT_FAILURE',
                    severity: 'CRITICAL',
                    title: criticalTitle,
                    message: criticalMessage,
                    details: JSON.stringify({
                        customerId: (request.customer as any).id || null,
                        customerName: request.customer.name,
                        customerCpf: request.customer.document,
                        amount: request.amount,
                        installmentId: request.installmentId,
                        method: request.method,
                        failedAttempts
                    })
                }
            });
        } catch (alertErr) {
            logger.error('[PaymentFailover] Erro ao gravar alerta crítico no banco:', alertErr);
        }

        throw Object.assign(
            new Error(
                lastError?.errorMessage ||
                'Não foi possível gerar a cobrança no momento. Nossos operadores foram notificados.'
            ),
            {
                statusCode: lastError?.statusCode || 500,
                code: 'GATEWAY_ERROR'
            }
        );
    }
}
