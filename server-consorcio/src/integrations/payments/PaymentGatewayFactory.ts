import { PaymentGateway, PaymentMethod } from './PaymentGateway';
import { PixGoAdapter } from './PixGoAdapter';
import { SigiloPayAdapter } from './SigiloPayAdapter';
import { SandboxPaymentAdapter } from './SandboxPaymentAdapter';
import { prisma } from '../../config/database';

export class PaymentGatewayFactory {
    static async getGateway(method: PaymentMethod): Promise<PaymentGateway> {
        const whereClause: any = {
            enabled: true
        };

        if (method === 'PIX') {
            whereClause.isDefaultPix = true;
            whereClause.supportsPix = true;
        } else if (method === 'BOLETO') {
            whereClause.isDefaultBoleto = true;
            whereClause.supportsBoleto = true;
        }

        const gatewayConfig = await prisma.gatewayConfig.findFirst({
            where: whereClause
        });

        if (gatewayConfig?.environment === 'sandbox') {
            return new SandboxPaymentAdapter();
        }

        if (!gatewayConfig || !gatewayConfig.enabled) {
            throw Object.assign(new Error('Nenhum gateway de pagamento ativo no momento.'), {
                code: 'GATEWAY_UNAVAILABLE',
                statusCode: 503,
                retryable: true
            });
        }

        if (gatewayConfig.name === 'sigilopay') {
            return new SigiloPayAdapter();
        }

        if (gatewayConfig.name === 'pixgo') {
            if (method === 'BOLETO') {
                throw Object.assign(new Error('O gateway ativo (PixGo) não suporta geração de boletos.'), { statusCode: 400 });
            }
            return new PixGoAdapter();
        }

        throw Object.assign(new Error(`Gateway configurado (${gatewayConfig.name}) não é suportado.`), { statusCode: 500 });
    }
}
