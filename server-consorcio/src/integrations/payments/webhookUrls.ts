/**
 * Builder central de URLs de callback das gateways (B4).
 *
 * A rota de webhooks vive em `/api/webhooks/:provider` (app.ts). Montar a URL
 * na mão em cada adapter já gerou `/webhooks/pixgo` (404 no provedor, receita
 * sem conciliação). Toda gateway usa daqui — nada de concatenar path solto.
 */
export type WebhookProvider = 'pixgo' | 'sigilopay' | 'eldorado' | 'g2g';

export function buildWebhookUrl(provider: WebhookProvider): string | undefined {
    const base = (process.env.PIXGO_WEBHOOK_URL || process.env.PUBLIC_API_URL || '').replace(/\/+$/, '');
    if (!base) return undefined;
    return `${base}/api/webhooks/${provider}`;
}
