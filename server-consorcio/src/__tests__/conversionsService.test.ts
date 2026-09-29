import crypto from 'crypto';
import { sendServerConversions } from '../services/conversionsService';

jest.mock('../config/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
}));

const mockFetch = jest.fn();
const realFetch = global.fetch;

const OLD_ENV = { ...process.env };

function setCreds() {
    process.env.META_PIXEL_ID = '1234567890';
    process.env.META_CAPI_TOKEN = 'test-token';
    process.env.GA4_MEASUREMENT_ID = 'G-TEST123';
    process.env.GA4_API_SECRET = 'ga-secret';
    delete process.env.META_CAPI_ENABLED;
    delete process.env.GA4_MP_ENABLED;
    delete process.env.META_TEST_EVENT_CODE;
    delete process.env.GA4_MP_DEBUG;
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    (global as any).fetch = mockFetch;
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as any);
});

afterAll(() => {
    process.env = OLD_ENV;
    (global as any).fetch = realFetch;
});

describe('conversionsService (Meta CAPI + GA4 MP)', () => {
    it('vira no-op sem credenciais (nenhum fetch)', async () => {
        delete process.env.META_PIXEL_ID;
        delete process.env.META_CAPI_TOKEN;
        delete process.env.GA4_MEASUREMENT_ID;
        delete process.env.GA4_API_SECRET;
        await sendServerConversions({ event: 'PAYMENT_CONFIRMED_VIEW', entityId: 'tx-1' });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('envia Purchase ao CAPI com event_id do front (deduplicação)', async () => {
        setCreds();
        await sendServerConversions({
            event: 'PAYMENT_CONFIRMED_VIEW',
            entityId: 'tx-abc',
            userId: 'user-123',
            metadata: { eid: 'eid-999', price: 18500, fbp: 'fb.1.1.abc', fbc: 'fb.1.2.xyz' },
            ipAddress: '187.1.2.3',
            userAgent: 'Mozilla/5.0'
        });

        const metaCall = mockFetch.mock.calls.find(([url]: any[]) =>
            String(url).includes('graph.facebook.com')
        );
        expect(metaCall).toBeDefined();
        const [url, opts] = metaCall!;
        expect(String(url)).toContain('/1234567890/events');
        const body = JSON.parse((opts as any).body);
        const ev = body.data[0];
        expect(ev.event_name).toBe('Purchase');
        expect(ev.event_id).toBe('eid-999');
        expect(ev.action_source).toBe('server');
        expect(ev.custom_data).toMatchObject({
            currency: 'BRL',
            value: 18500,
            order_id: 'tx-abc',
            content_ids: ['tx-abc']
        });
        expect(ev.user_data).toMatchObject({
            client_ip_address: '187.1.2.3',
            fbp: 'fb.1.1.abc',
            fbc: 'fb.1.2.xyz',
            external_id: crypto.createHash('sha256').update('user-123', 'utf8').digest('hex')
        });
        // userId cru nunca vaza
        expect((opts as any).body).not.toContain('user-123');
    });

    it('inclui test_event_code quando configurado', async () => {
        setCreds();
        process.env.META_TEST_EVENT_CODE = 'TEST-CODE';
        await sendServerConversions({ event: 'REGISTER', userId: 'u1' });
        const metaCall = mockFetch.mock.calls.find(([url]: any[]) =>
            String(url).includes('graph.facebook.com')
        );
        const body = JSON.parse((metaCall![1] as any).body);
        expect(body.test_event_code).toBe('TEST-CODE');
        expect(body.data[0].event_name).toBe('CompleteRegistration');
    });

    it('GA4 MP só envia com ga_client_id (sem poluir a base)', async () => {
        setCreds();
        await sendServerConversions({ event: 'PAYMENT_CONFIRMED_VIEW', entityId: 'tx-1' });
        const gaCalls = mockFetch.mock.calls.filter(([url]: any[]) =>
            String(url).includes('google-analytics.com')
        );
        expect(gaCalls).toHaveLength(0);
    });

    it('GA4 MP envia purchase com transaction_id quando há client_id', async () => {
        setCreds();
        await sendServerConversions({
            event: 'PAYMENT_CONFIRMED_VIEW',
            entityId: 'tx-77',
            metadata: { ga_client_id: '123.456', price: 100 }
        });
        const gaCall = mockFetch.mock.calls.find(([url]: any[]) =>
            String(url).includes('/mp/collect')
        );
        expect(gaCall).toBeDefined();
        const [url, opts] = gaCall!;
        expect(String(url)).toContain('measurement_id=G-TEST123');
        const body = JSON.parse((opts as any).body);
        expect(body.client_id).toBe('123.456');
        expect(body.events[0]).toMatchObject({
            name: 'purchase',
            params: { currency: 'BRL', value: 100, transaction_id: 'tx-77' }
        });
    });

    it('GA4_MP_DEBUG usa endpoint de validação', async () => {
        setCreds();
        process.env.GA4_MP_DEBUG = 'true';
        await sendServerConversions({
            event: 'REGISTER',
            metadata: { ga_client_id: '1.2' }
        });
        const gaCall = mockFetch.mock.calls.find(([url]: any[]) =>
            String(url).includes('google-analytics.com')
        );
        expect(String(gaCall![0])).toContain('/debug/mp/collect');
    });

    it('respeita os flags de desligamento', async () => {
        setCreds();
        process.env.META_CAPI_ENABLED = 'false';
        process.env.GA4_MP_ENABLED = 'false';
        await sendServerConversions({
            event: 'PAYMENT_CONFIRMED_VIEW',
            metadata: { ga_client_id: '1.2' }
        });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falha de rede não derruba o fluxo (nunca throws)', async () => {
        setCreds();
        mockFetch.mockRejectedValue(new Error('boom'));
        await expect(
            sendServerConversions({ event: 'PAYMENT_CONFIRMED_VIEW' })
        ).resolves.toBeUndefined();
    });
});
