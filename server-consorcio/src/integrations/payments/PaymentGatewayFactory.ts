import { PaymentGateway, PaymentMethod } from './PaymentGateway';
import { PixGoAdapter } from './PixGoAdapter';
import { SigiloPayAdapter } from './SigiloPayAdapter';
import { SandboxPaymentAdapter } from './SandboxPaymentAdapter';
import { EldoradoAdapter } from './EldoradoAdapter';
import { G2gAdapter } from './G2gAdapter';
import { prisma } from '../../config/database';

export class PaymentGatewayFactory {
    /**
     * Cria a instância do adaptador correspondente à configuração do gateway
     */
    static createAdapter(config: any, method: PaymentMethod): PaymentGateway | null {
        if (!config || !config.enabled) return null;

        // Gateways locais: sempre reais, não têm modo sandbox
        if (config.name === 'eldorado') {
            if (method === 'BOLETO') return null;
            return new EldoradoAdapter(config);
        }

        if (config.name === 'g2g') {
            if (method === 'BOLETO') return null;
            return new G2gAdapter(config);
        }

        if (config.environment === 'sandbox') {
            return new SandboxPaymentAdapter();
        }

        if (config.name === 'sigilopay') {
            if (method === 'BOLETO') return null;
            return new SigiloPayAdapter();
        }

        if (config.name === 'pixgo') {
            if (method === 'BOLETO') return null;
            return new PixGoAdapter();
        }

        return null;
    }

    /**
     * Retorna a lista ordenada de todos os gateways ativos que suportam o método solicitado.
     * O gateway marcado como padrão (isDefaultPix / isDefaultBoleto) sempre fica em primeiro lugar,
     * seguido pelos gateways secundários para failover automático.
     */
    static async getCandidateGateways(method: PaymentMethod): Promise<PaymentGateway[]> {
        const configs = await prisma.gatewayConfig.findMany({
            where: {
                enabled: true,
                ...(method === 'PIX' ? { supportsPix: true } : { supportsBoleto: true })
            }
        });

        if (!configs || configs.length === 0) {
            throw Object.assign(new Error('Nenhum gateway de pagamento ativo no momento.'), {
                code: 'GATEWAY_UNAVAILABLE',
                statusCode: 503,
                retryable: true
            });
        }

        // Ordena para que o padrão venha primeiro
        configs.sort((a, b) => {
            const aDefault = method === 'PIX' ? a.isDefaultPix : a.isDefaultBoleto;
            const bDefault = method === 'PIX' ? b.isDefaultPix : b.isDefaultBoleto;
            if (aDefault && !bDefault) return -1;
            if (!aDefault && bDefault) return 1;
            return 0;
        });

        const gateways: PaymentGateway[] = [];
        for (const config of configs) {
            const adapter = this.createAdapter(config, method);
            if (adapter) {
                gateways.push(adapter);
            }
        }

        if (gateways.length === 0) {
            throw Object.assign(new Error('Nenhum gateway compatível com o método selecionado está ativo no momento.'), {
                code: 'GATEWAY_UNAVAILABLE',
                statusCode: 503,
                retryable: true
            });
        }

        return gateways;
    }

    /**
     * Retorna o gateway principal ativo
     */
    static async getGateway(method: PaymentMethod): Promise<PaymentGateway> {
        const candidates = await this.getCandidateGateways(method);
        return candidates[0];
    }
}
