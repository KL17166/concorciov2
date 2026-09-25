/**
 * Rótulos humanos p/ o painel admin — nenhum código técnico (bids_, PAYMENT_CHECK,
 * PENDING_KYC...) chega à tela. Fonte única: telas usam estas funções.
 */

const ALERT_TYPE_LABELS: Record<string, string> = {
    PAYMENT_CHECK: 'Verificação de pagamento',
    BID_PAYMENT_CHECK: 'Verificação de lance',
    KYC_SUBMITTED: 'Documento enviado',
    KYC_PROPOSAL: 'Proposta de aprovação (KYC)',
    CONTRACT_PROPOSAL: 'Proposta de contrato',
    PAYMENT_MANUAL_REVIEW: 'Conferência manual',
    REFUND_REQUEST: 'Pedido de estorno',
    BID_ORPHAN_PAYMENT: 'Pagamento órfão (lance)',
    GATEWAY_FAILOVER: 'Falha de gateway (contornada)',
    PAYMENT_FAILURE: 'Falha de pagamento',
    KYC_REFUND_REQUIRED: 'Estorno pendente (KYC)'
};

const QUEUE_STATUS_LABELS: Record<string, string> = {
    OPEN: 'Aguardando atendimento',
    ACK: 'Em atendimento',
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Concluído',
    DISMISSED: 'Dispensado'
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendente',
    PENDING_KYC: 'Aguardando KYC',
    ACTIVE: 'Ativo',
    CONTEMPLATED: 'Contemplado',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado'
};

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendente',
    PAID: 'Pago',
    OVERDUE: 'Em atraso',
    CANCELLED: 'Cancelada',
    REFUNDED: 'Reembolsada'
};

const BID_TYPE_LABELS: Record<string, string> = {
    FREE: 'Lance livre',
    FIXED: 'Lance fixo',
    EMBEDDED: 'Lance embutido'
};

const TICKET_STATUS_LABELS: Record<string, string> = {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em atendimento',
    CLOSED: 'Encerrado'
};

export function alertTypeLabel(type: string): string {
    return ALERT_TYPE_LABELS[type] || 'Aviso do sistema';
}

/** Filtro humano → código (aceita "verificação de pagamento" ou "PAYMENT_CHECK"). */
export function alertTypeFromLabel(input: string): string {
    const q = (input || '').trim().toLowerCase();
    for (const [code, label] of Object.entries(ALERT_TYPE_LABELS)) {
        if (label.toLowerCase() === q || code.toLowerCase() === q) return code;
    }
    return input;
}

export function queueStatusLabel(status: string): string {
    return QUEUE_STATUS_LABELS[status] || status;
}

export function subscriptionStatusLabel(status: string): string {
    return SUBSCRIPTION_STATUS_LABELS[status] || status;
}

export function installmentStatusLabel(status: string): string {
    return INSTALLMENT_STATUS_LABELS[status] || status;
}

export function bidTypeLabel(type: string): string {
    return BID_TYPE_LABELS[type] || 'Lance';
}

export function ticketStatusLabel(status: string): string {
    return TICKET_STATUS_LABELS[status] || status;
}

/** "Adesão" | "Parcela 3" | "Parcelas 2, 3 e 5" | "Lance livre" | "Contrato" */
export function verificationKindLabel(parsed: any): string {
    if (!parsed) return 'Verificação';
    if (parsed.kindLabel && parsed.kindLabel !== 'Parcela' && parsed.kindLabel !== 'Contrato') return parsed.kindLabel;
    if (parsed.kind === 'ADESAO') return 'Adesão';
    if (Array.isArray(parsed.items) && parsed.items.length > 1) {
        const nums = parsed.items.map((i: any) => i.number);
        if (nums.includes(1)) {
            const rest = nums.filter((n: number) => n !== 1);
            return rest.length ? `Adesão + ${rest.length === 1 ? `Parcela ${rest[0]}` : `Parcelas ${rest.join(', ')}`}` : 'Adesão';
        }
        return nums.length === 2 ? `Parcelas ${nums[0]} e ${nums[1]}` : `Parcelas ${nums.slice(0, -1).join(', ')} e ${nums[nums.length - 1]}`;
    }
    if (parsed.kind === 'PARCELA' || parsed.kindLabel === 'Parcela') {
        const n = parsed.installmentNumber ?? parsed.items?.[0]?.number ?? '';
        return `Parcela ${n}${parsed.isAntecipacao ? ' (antecipação)' : ''}`;
    }
    if (parsed.kindLabel) return parsed.kindLabel + (parsed.isAntecipacao ? ' (antecipação)' : '');
    if (parsed.kind === 'LANCE' || parsed.bidId) return bidTypeLabel(parsed.bidType || '');
    return 'Verificação';
}

/** IDs longos nunca aparecem crus: mostra só os 8 primeiros com rótulo. */
export function shortId(id: string | null | undefined): string {
    if (!id) return '—';
    return String(id).slice(0, 8);
}

function safeParse(details: string | null): any {
    if (!details) return {};
    try { return JSON.parse(details); } catch { return {}; }
}

/** Normaliza um SystemAlert p/ exibição (Central e tela do contrato). */
export function parseVerificationAlert(a: any): any | null {
    if (!a) return null;
    const d = safeParse(a.details);
    return {
        id: a.id,
        type: a.type,
        typeLabel: alertTypeLabel(a.type),
        status: a.status,
        statusLabel: queueStatusLabel(a.status),
        severity: a.severity,
        title: a.title,
        message: a.message,
        createdAt: a.createdAt,
        assignedTo: a.assignedTo || null,
        kindLabel: verificationKindLabel(d),
        amount: d.amount ?? null,
        count: d.count ?? null,
        items: Array.isArray(d.items) ? d.items : null,
        provider: d.provider || null,
        paymentMethod: d.paymentMethod || null,
        installmentNumber: d.installmentNumber ?? null,
        installmentStatus: d.installmentStatus || null,
        dueDate: d.dueDate || null,
        isAntecipacao: !!d.isAntecipacao,
        subscriptionId: d.subscriptionId || null,
        bidSubscriptionId: d.subscriptionId || null,
        bidId: d.bidId || null,
        customerName: d.customerName || null
    };
}
