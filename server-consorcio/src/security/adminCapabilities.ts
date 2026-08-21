export type AdminRole = 'MASTER' | 'MANAGER' | 'SUPPORT' | 'CLIENT';

export type AdminCapability =
    | 'dashboard.view'
    | 'people.view'
    | 'people.create'
    | 'people.edit_profile'
    | 'people.change_email'
    | 'people.change_role'
    | 'people.change_password'
    | 'people.delete'
    | 'contracts.view'
    | 'contracts.manage'
    | 'payments.view'
    | 'payments.manage'
    | 'bids.view'
    | 'bids.manage'
    | 'catalog.view'
    | 'catalog.manage'
    | 'reports.view'
    | 'compliance.view'
    | 'compliance.review'
    | 'integrations.view'
    | 'integrations.manage'
    | 'security.view'
    | 'security.manage'
    | 'account.security';

const CAPABILITIES: Record<AdminRole, readonly AdminCapability[]> = {
    MASTER: [
        'dashboard.view', 'people.view', 'people.create', 'people.edit_profile',
        'people.change_email', 'people.change_role', 'people.change_password',
        'people.delete', 'contracts.view', 'contracts.manage', 'payments.view',
        'payments.manage', 'bids.view', 'bids.manage', 'catalog.view',
        'catalog.manage', 'reports.view', 'compliance.view', 'compliance.review',
        'integrations.view', 'integrations.manage', 'security.view',
        'security.manage', 'account.security'
    ],
    MANAGER: [
        'dashboard.view', 'people.view', 'people.create', 'people.edit_profile',
        'people.change_email', 'contracts.view', 'contracts.manage',
        'payments.view', 'payments.manage', 'bids.view', 'bids.manage',
        'catalog.view', 'catalog.manage', 'reports.view', 'compliance.view',
        'compliance.review', 'integrations.view', 'account.security'
    ],
    SUPPORT: [
        'dashboard.view', 'people.view', 'contracts.view', 'payments.view',
        'bids.view', 'catalog.view', 'compliance.view', 'account.security'
    ],
    CLIENT: []
};

export function capabilitiesForRole(role?: string): AdminCapability[] {
    if (!role || !(role in CAPABILITIES)) return [];
    return [...CAPABILITIES[role as AdminRole]];
}

export function hasCapability(role: string | undefined, capability: AdminCapability): boolean {
    return capabilitiesForRole(role).includes(capability);
}

export function canManageRole(actorRole: string | undefined, targetRole: string): boolean {
    if (actorRole !== 'MASTER') return false;
    return ['MASTER', 'MANAGER', 'SUPPORT', 'CLIENT'].includes(targetRole);
}

export function roleLabel(role: string): string {
    const labels: Record<string, string> = {
        MASTER: 'Mestre',
        MANAGER: 'Gerente',
        SUPPORT: 'Suporte',
        CLIENT: 'Cliente'
    };
    return labels[role] || role;
}

export function capabilityListForView(role?: string): Record<AdminCapability, boolean> {
    return Object.fromEntries(
        (Object.keys(CAPABILITIES.MASTER) as unknown as AdminCapability[]).map((capability) => [
            capability,
            hasCapability(role, capability)
        ])
    ) as Record<AdminCapability, boolean>;
}

export const ADMIN_CAPABILITIES = Object.freeze(CAPABILITIES);
