import { batchExternalId, parseBatchExternalId } from '../application/payments/generateBatchPayment';
import { alertTypeFromLabel } from '../utils/adminLabels';

describe('cobrança combinada (lote)', () => {
    it('prefixo batch-<uuid> faz roundtrip', () => {
        const id = '6a727c2e-9ebd-4e6c-96f9-3f7476b87049';
        expect(parseBatchExternalId(batchExternalId(id))).toBe(id);
        expect(parseBatchExternalId('bid-abc')).toBeNull();
        expect(parseBatchExternalId('batch-')).toBeNull();
    });

    it('filtro humano da Central resolve p/ código', () => {
        expect(alertTypeFromLabel('Verificação de pagamento')).toBe('PAYMENT_CHECK');
        expect(alertTypeFromLabel('verificação de lance')).toBe('BID_PAYMENT_CHECK');
        expect(alertTypeFromLabel('PAYMENT_CHECK')).toBe('PAYMENT_CHECK');
        expect(alertTypeFromLabel('texto livre')).toBe('texto livre');
    });
});
