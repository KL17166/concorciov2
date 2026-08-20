import { validateMagicBytes } from '../security/magicBytes';
import { processPaymentWebhook } from '../application/payments/processPaymentWebhook';
import { getSubscriptionDetails } from '../application/subscriptions/getSubscriptionDetails';
import { markInstallmentAsPaid } from '../services/installmentService';
import { prisma } from '../config/database';
import fs from 'fs';
import path from 'path';

jest.mock('../config/database', () => ({
    prisma: {
        webhookLog: {
            findUnique: jest.fn(),
            create: jest.fn(),
            upsert: jest.fn()
        },
        installment: {
            findUnique: jest.fn()
        },
        subscription: {
            findUnique: jest.fn()
        },
        $transaction: jest.fn()
    }
}));

jest.mock('../services/installmentService', () => ({
    markInstallmentAsPaid: jest.fn().mockResolvedValue({
        success: true,
        message: 'Parcela marcada como paga com sucesso'
    })
}));

describe('Security & Webhook Integrity Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Magic Bytes Validation (File Disguise Defense)', () => {
        const tempTestFile = path.join(__dirname, 'temp_test_magic.bin');

        afterEach(() => {
            if (fs.existsSync(tempTestFile)) {
                fs.unlinkSync(tempTestFile);
            }
        });

        it('should accept valid PNG header', () => {
            const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
            fs.writeFileSync(tempTestFile, pngHeader);

            expect(validateMagicBytes(tempTestFile)).toBe(true);
        });

        it('should accept valid JPEG header', () => {
            const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
            fs.writeFileSync(tempTestFile, jpegHeader);

            expect(validateMagicBytes(tempTestFile)).toBe(true);
        });

        it('should accept valid PDF header', () => {
            const pdfHeader = Buffer.from('%PDF-1.4\n%test');
            fs.writeFileSync(tempTestFile, pdfHeader);

            expect(validateMagicBytes(tempTestFile)).toBe(true);
        });

        it('should reject text or malicious executable disguised as image', () => {
            const fakeImage = Buffer.from('<?php echo "evil"; ?>');
            fs.writeFileSync(tempTestFile, fakeImage);

            expect(validateMagicBytes(tempTestFile)).toBe(false);
        });
    });

    describe('Payment Webhook Processing & Idempotency', () => {
        it('should return 200 immediately if webhook was already processed (replay attack / duplicate)', async () => {
            (prisma.webhookLog.findUnique as jest.Mock).mockResolvedValue({
                id: 'log-1',
                signature: 'sig-abc-123',
                provider: 'pixgo',
                status: 'PROCESSED'
            });

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId: 'inst-1',
                paymentMethod: 'PIX-PIXGO',
                eventSignature: 'sig-abc-123',
                rawPayload: { event: 'payment.completed' }
            });

            expect(result.success).toBe(true);
            expect(result.alreadyProcessed).toBe(true);
            expect(result.statusCode).toBe(200);
        });

        it('should reject when installment is not found', async () => {
            (prisma.webhookLog.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.installment.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId: 'non-existent-inst',
                paymentMethod: 'PIX-PIXGO',
                eventSignature: 'sig-new-456',
                rawPayload: { event: 'payment.completed' }
            });

            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(404);
        });

        it('should acknowledge 200 without reprocessing if installment is already PAID', async () => {
            (prisma.webhookLog.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.installment.findUnique as jest.Mock).mockResolvedValue({
                id: 'inst-already-paid',
                status: 'PAID',
                amount: 500
            });

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId: 'inst-already-paid',
                paidAmount: 500,
                paymentMethod: 'PIX-PIXGO',
                eventSignature: 'sig-already-paid',
                rawPayload: { event: 'payment.completed' }
            });

            expect(result.success).toBe(true);
            expect(result.alreadyProcessed).toBe(true);
            expect(result.statusCode).toBe(200);
        });

        it('should reject webhook if paid amount is divergent from installment amount', async () => {
            (prisma.webhookLog.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.installment.findUnique as jest.Mock).mockResolvedValue({
                id: 'inst-2',
                status: 'PENDING',
                amount: 1000
            });

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId: 'inst-2',
                paidAmount: 100, // Attempt to pay R$ 100 on a R$ 1000 installment
                paymentMethod: 'PIX-PIXGO',
                eventSignature: 'sig-underpaid',
                rawPayload: { event: 'payment.completed' }
            });

            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(400);
            expect(result.message).toContain('Valor pago divergente');
        });

        it('should return 500 on transient database failure to allow gateway retry', async () => {
            (prisma.webhookLog.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.installment.findUnique as jest.Mock).mockResolvedValue({
                id: 'inst-transient-fail',
                status: 'PENDING',
                amount: 500
            });

            (markInstallmentAsPaid as jest.Mock).mockResolvedValueOnce({
                success: false,
                message: 'Erro temporário de conexão com o banco'
            });

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId: 'inst-transient-fail',
                paidAmount: 500,
                paymentMethod: 'PIX-PIXGO',
                eventSignature: 'sig-fail-retry',
                rawPayload: { event: 'payment.completed' }
            });

            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(500);
        });

        it('should process payment and record webhook log on valid payload', async () => {
            (prisma.webhookLog.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.installment.findUnique as jest.Mock).mockResolvedValue({
                id: 'inst-valid',
                status: 'PENDING',
                amount: 500
            });

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId: 'inst-valid',
                paidAmount: 500,
                paymentMethod: 'PIX-PIXGO',
                eventSignature: 'sig-valid-999',
                rawPayload: { event: 'payment.completed' }
            });

            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(prisma.webhookLog.upsert).toHaveBeenCalled();
        });
    });

    describe('IDOR & Ownership Defense on Subscriptions', () => {
        it('should reject when user tries to access another users subscription details', async () => {
            (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
                id: 'sub-victim',
                userId: 'victim-user-123',
                groupNumber: '1001',
                quotaNumber: '001',
                creditValue: 30000,
                balanceDue: 30000,
                status: 'ACTIVE',
                totalInstallments: 36,
                plan: {
                    id: 'plan-1',
                    name: 'Plano Moto',
                    durationMonths: 36,
                    adminFeeRate: 0.15,
                    fundRate: 0.05,
                    product: { id: 'prod-1', name: 'Honda CG 160', price: 15000, category: 'MOTO' }
                },
                installments: [],
                bids: []
            });

            await expect(getSubscriptionDetails('sub-victim', 'attacker-user-999'))
                .rejects
                .toMatchObject({ message: 'Acesso negado', statusCode: 403 });
        });

        it('should allow user to access their own subscription details', async () => {
            (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
                id: 'sub-owner',
                userId: 'legit-user-123',
                groupNumber: '1001',
                quotaNumber: '001',
                creditValue: 30000,
                balanceDue: 30000,
                status: 'ACTIVE',
                totalInstallments: 36,
                plan: {
                    id: 'plan-1',
                    name: 'Plano Moto',
                    durationMonths: 36,
                    adminFeeRate: 0.15,
                    fundRate: 0.05,
                    product: { id: 'prod-1', name: 'Honda CG 160', price: 15000, category: 'MOTO' }
                },
                installments: [],
                bids: []
            });

            const result = await getSubscriptionDetails('sub-owner', 'legit-user-123');
            expect(result.id).toBe('sub-owner');
            expect(result.groupNumber).toBe('1001');
        });
    });
});
