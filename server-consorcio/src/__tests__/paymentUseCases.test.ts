import { listSubscriptionPayments } from '../application/payments/listSubscriptionPayments';
import { PaymentGatewayFactory } from '../integrations/payments/PaymentGatewayFactory';
import { SandboxPaymentAdapter } from '../integrations/payments/SandboxPaymentAdapter';
import { PixGoAdapter } from '../integrations/payments/PixGoAdapter';
import { SigiloPayAdapter } from '../integrations/payments/SigiloPayAdapter';
import { PaymentFailoverService } from '../services/paymentFailoverService';
import { prisma } from '../config/database';

jest.mock('../config/database', () => ({
    prisma: {
        subscription: {
            findUnique: jest.fn()
        },
        installment: {
            findMany: jest.fn(),
            update: jest.fn()
        },
        gatewayConfig: {
            findFirst: jest.fn(),
            findMany: jest.fn()
        },
        systemAlert: {
            create: jest.fn()
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
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([{
                name: 'pixgo',
                environment: 'sandbox',
                enabled: true,
                isDefaultPix: true,
                supportsPix: true
            }]);

            const gateway = await PaymentGatewayFactory.getGateway('PIX');
            expect(gateway).toBeInstanceOf(SandboxPaymentAdapter);
            expect(gateway.name).toBe('sandbox');
        });

        it('should return PixGoAdapter when provider is pixgo in production', async () => {
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([{
                name: 'pixgo',
                environment: 'production',
                enabled: true,
                isDefaultPix: true,
                supportsPix: true
            }]);

            const gateway = await PaymentGatewayFactory.getGateway('PIX');
            expect(gateway).toBeInstanceOf(PixGoAdapter);
            expect(gateway.name).toBe('pixgo');
        });

        it('should return SigiloPayAdapter when provider is sigilopay in production for PIX', async () => {
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([{
                name: 'sigilopay',
                environment: 'production',
                enabled: true,
                isDefaultPix: true,
                supportsPix: true
            }]);

            const gateway = await PaymentGatewayFactory.getGateway('PIX');
            expect(gateway).toBeInstanceOf(SigiloPayAdapter);
            expect(gateway.name).toBe('sigilopay');
        });

        it('should throw error when requesting BOLETO when active gateways do not support boleto', async () => {
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([]);

            await expect(PaymentGatewayFactory.getGateway('BOLETO'))
                .rejects
                .toMatchObject({
                    message: 'Nenhum gateway de pagamento ativo no momento.',
                    code: 'GATEWAY_UNAVAILABLE',
                    statusCode: 503
                });
        });

        it('should throw error when gateway configuration is not found or disabled', async () => {
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([]);

            await expect(PaymentGatewayFactory.getGateway('PIX'))
                .rejects
                .toMatchObject({
                    message: 'Nenhum gateway de pagamento ativo no momento.',
                    code: 'GATEWAY_UNAVAILABLE'
                });
        });
    });

    describe('PaymentFailoverService', () => {
        it('should failover to secondary gateway when primary fails and register warning alert', async () => {
            // Configura duas gateways ativas: SigiloPay (padrão) e Sandbox (contingência)
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([
                {
                    name: 'sigilopay',
                    environment: 'production',
                    enabled: true,
                    isDefaultPix: true,
                    supportsPix: true
                },
                {
                    name: 'pixgo',
                    environment: 'sandbox',
                    enabled: true,
                    isDefaultPix: false,
                    supportsPix: true
                }
            ]);

            // Força erro na primeira (ex: SigiloPayAdapter createPayment rejeita)
            jest.spyOn(SigiloPayAdapter.prototype, 'createPayment').mockRejectedValueOnce(
                new Error('Preço não pode ser maior que R$ 350,00')
            );

            const result = await PaymentFailoverService.executePaymentWithFailover({
                installmentId: 'inst-123',
                installmentNumber: 1,
                amount: 5879.15,
                method: 'PIX',
                customer: {
                    name: 'Mariana Oliveira',
                    email: 'mariana@example.com',
                    document: '12345678900'
                }
            });

            expect(result).toBeDefined();
            expect(result.copyPaste).toBeDefined();
            expect(result.qrCode).toBeDefined();

            // Verifica que o alerta foi gravado
            expect((prisma as any).systemAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: 'GATEWAY_FAILOVER',
                        severity: 'WARNING'
                    })
                })
            );
        });

        it('should throw error and register CRITICAL alert when all gateways fail', async () => {
            (prisma.gatewayConfig.findMany as jest.Mock).mockResolvedValue([
                {
                    name: 'sigilopay',
                    environment: 'production',
                    enabled: true,
                    isDefaultPix: true,
                    supportsPix: true
                }
            ]);

            jest.spyOn(SigiloPayAdapter.prototype, 'createPayment').mockRejectedValueOnce(
                new Error('Falha de conexão com gateway')
            );

            await expect(
                PaymentFailoverService.executePaymentWithFailover({
                    installmentId: 'inst-123',
                    installmentNumber: 1,
                    amount: 500,
                    method: 'PIX',
                    customer: {
                        name: 'Mariana Oliveira',
                        email: 'mariana@example.com',
                        document: '12345678900'
                    }
                })
            ).rejects.toThrow('Falha de conexão com gateway');

            expect((prisma as any).systemAlert.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: 'PAYMENT_FAILURE',
                        severity: 'CRITICAL'
                    })
                })
            );
        });
    });
});
