import {
    alertTypeLabel, queueStatusLabel, subscriptionStatusLabel,
    installmentStatusLabel, bidTypeLabel, ticketStatusLabel,
    verificationKindLabel, shortId
} from '../utils/adminLabels';

describe('rótulos humanos do painel (sem código técnico na tela)', () => {
    it('traduz tipos de alerta', () => {
        expect(alertTypeLabel('PAYMENT_CHECK')).toBe('Verificação de pagamento');
        expect(alertTypeLabel('BID_PAYMENT_CHECK')).toBe('Verificação de lance');
        expect(alertTypeLabel('REFUND_REQUEST')).toBe('Pedido de estorno');
        expect(alertTypeLabel('QUALQUER_COISA_NOVA')).toBe('Aviso do sistema');
    });

    it('traduz status da fila e do contrato', () => {
        expect(queueStatusLabel('OPEN')).toBe('Aguardando atendimento');
        expect(queueStatusLabel('IN_PROGRESS')).toBe('Em andamento');
        expect(subscriptionStatusLabel('PENDING_KYC')).toBe('Aguardando KYC');
        expect(installmentStatusLabel('OVERDUE')).toBe('Em atraso');
        expect(ticketStatusLabel('CLOSED')).toBe('Encerrado');
    });

    it('descreve o quê o cliente pediu p/ verificar', () => {
        expect(verificationKindLabel({ kind: 'ADESAO' })).toBe('Adesão');
        expect(verificationKindLabel({ kind: 'PARCELA', installmentNumber: 3 })).toBe('Parcela 3');
        expect(verificationKindLabel({ kind: 'PARCELA', installmentNumber: 5, isAntecipacao: true }))
            .toBe('Parcela 5 (antecipação)');
        expect(verificationKindLabel({ kind: 'LANCE', bidType: 'FIXED' })).toBe('Lance fixo');
        expect(verificationKindLabel({ items: [{ number: 2 }, { number: 3 }, { number: 5 }] }))
            .toBe('Parcelas 2, 3 e 5');
        expect(verificationKindLabel({ items: [{ number: 1 }, { number: 2 }] }))
            .toBe('Adesão + Parcela 2');
    });

    it('nunca exibe código técnico nem id cru', () => {
        expect(shortId('6a727c2e-9ebd-4e6c-96f9-3f7476b87049')).toBe('6a727c2e');
        expect(shortId(null)).toBe('—');
        // nenhum rótulo contém underscore de código
        for (const s of [alertTypeLabel('PAYMENT_CHECK'), queueStatusLabel('OPEN'), subscriptionStatusLabel('PENDING_KYC')]) {
            expect(s).not.toMatch(/_/);
        }
        expect(bidTypeLabel('FREE')).not.toMatch(/_/);
    });
});
