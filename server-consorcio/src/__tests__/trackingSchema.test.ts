import { TrackEventSchema } from '../schemas/trackingSchema';

describe('TrackEventSchema (pixel próprio)', () => {
    it('accepts a valid screen view', () => {
        const r = TrackEventSchema.safeParse({ event: 'SCREEN_VIEW', screen: 'bids' });
        expect(r.success).toBe(true);
    });

    it('accepts a QR click with entity', () => {
        const r = TrackEventSchema.safeParse({
            event: 'GENERATE_QR_CLICK',
            screen: 'bids',
            entityType: 'bid',
            entityId: '00000000-0000-0000-0000-000000000000',
            metadata: { reused: false }
        });
        expect(r.success).toBe(true);
    });

    it('rejects unknown events (allowlist)', () => {
        const r = TrackEventSchema.safeParse({ event: 'DROP_TABLE' } as any);
        expect(r.success).toBe(false);
    });

    it('rejects non-uuid entityId', () => {
        const r = TrackEventSchema.safeParse({
            event: 'COPY_PIX_CLICK',
            entityId: '../../etc/passwd'
        } as any);
        expect(r.success).toBe(false);
    });

    it('rejects oversized metadata', () => {
        const r = TrackEventSchema.safeParse({
            event: 'SCREEN_VIEW',
            metadata: { blob: 'x'.repeat(3000) }
        } as any);
        expect(r.success).toBe(false);
    });

    it('strips unknown fields (strict)', () => {
        const r = TrackEventSchema.safeParse({ event: 'SCREEN_VIEW', userId: 'victim-id' } as any);
        expect(r.success).toBe(false);
    });
});
