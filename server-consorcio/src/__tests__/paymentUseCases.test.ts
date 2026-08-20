import { listSubscriptionPayments } from '../application/payments/listSubscriptionPayments';
import { PaymentGatewayFactory } from '../integrations/payments/PaymentGatewayFactory';
import { SandboxPaymentAdapter } from '../integrations/payments/SandboxPaymentAdapter';
import { PixGoAdapter } from '../integrations/payments/PixGoAdapter';
import { SigiloPayAdapter } from '../integrations/payments/SigiloPayAdapter';
import { prisma } from '../config/database';

jest.mock('../config/database', () => ({
    prisma: {
        subscription: {
            findUnique: jest.fn()
        },
        installment: {
            findMany: jest.fn()
        },
        gatewayConfig: {
            findFirst: jest.fn()
        }
    }
}));

describe('Payment Use Cases & Gateways', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('listSubscriptionPayments', () => {
        it('should throw 404 if subscription does not exist', async () => {
            (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(listSubscriptionPayments({ subscriptionId: 'sub-999' }))
                .rejects
                .toMatchObject({ message: 'Contrato não encontrado', statusCode: 404 });
        });

        it('should throw 403 if requester is not the subscription owner and not admin', async () => {
            (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
                id: 'sub-1',
                userId: 'user-owner'
            });

            await expect(listSubscriptionPayments({
                subscriptionId: 'sub-1',
                requesterUserId: 'user-intruder',
                isAdmin: false
            }))
                .rejects
                .toMatchObject({ message: 'Acesso negado', statusCode: 403 });
        });

        it('should allow admin to list payments regardless of userId', async () => {
            (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
                id: 'sub-1',
                userId: 'user-owner',
                totalInstallments: 2
            });

            (prisma.installment.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'inst-1',
                    idTokenPay: 'token-1',
                    number: 1,
                    amount: 500,
                    dueDate: new Date(),
                    status: 'PAID',
                    paymentDate: new Date(),
                    paymentMethod: 'PIX'
                },
                {
                    id: 'inst-2',
                    idTokenPay: 'token-2',
                    number: 2,
                    amount: 500,
                    dueDate: new Date(),
                    status: 'PENDING',
                    paymentDate: null,
                    paymentMethod: null
                }
            ]);

            const result = await listSubscriptionPayments({
                subscriptionId: 'sub-1',
                requesterUserId: 'admin-user',
                isAdmin: true
            });

            expect(result).toHaveLength(2);
            expect(result[0].status).toBe('PAID');
            expect(result[1].status).toBe('PENDING');
            expect(result[1].valueToPay).toBe(500);
        });
    });

    describe('PaymentGatewayFactory', () => {
        it('should return SandboxPaymentAdapter when gateway environment is sandbox', async () => {
            (prisma.gatewayConfig.findFirst as jest.Mock).mockResolvedValue({
                name: 'pixgo',
                environment: 'sandbox',
                enabled: true,
                apiKey: 'test-key'
            });

            const gateway = await PaymentGatewayFactory.getGateway('PIX');
            expect(gateway).toBeInstanceOf(SandboxPaymentAdapter);
            expect(gateway.name).toBe('sandbox');
        });

        it('should return PixGoAdapter when provider is pixgo in production', async () => {
            (prisma.gatewayConfig.findFirst as jest.Mock).mockResolvedValue({
                name: 'pixgo',
                environment: 'production',
                enabled: true,
                apiKey: 'live-key'
            });

            const gateway = await PaymentGatewayFactory.getGateway('PIX');
            expect(gateway).toBeInstanceOf(PixGoAdapter);
            expect(gateway.name).toBe('pixgo');
        });

        it('should return SigiloPayAdapter when provider is sigilopay in production', async () => {
            (prisma.gatewayConfig.findFirst as jest.Mock).mockResolvedValue({
                name: 'sigilopay',
                environment: 'production',
                enabled: true,
                apiKey: 'live-key'
            });

            const gateway = await PaymentGatewayFactory.getGateway('BOLETO');
            expect(gateway).toBeInstanceOf(SigiloPayAdapter);
            expect(gateway.name).toBe('sigilopay');
        });

        it('should throw error when gateway configuration is not found or disabled', async () => {
            (prisma.gatewayConfig.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(PaymentGatewayFactory.getGateway('PIX'))
                .rejects
                .toMatchObject({
                    message: 'Nenhum gateway de pagamento ativo no momento.',
                    code: 'GATEWAY_UNAVAILABLE'
                });
        });
    });
});
