// Centralized role and status constants — prevents typos and phantom strings across the codebase

export const AdminRoles = {
    MASTER: 'MASTER',
    MANAGER: 'MANAGER',
    SUPPORT: 'SUPPORT',
} as const;

export type AdminRole = typeof AdminRoles[keyof typeof AdminRoles];

/** All valid admin roles as an array (use for includes() checks) */
export const ADMIN_ROLE_LIST: string[] = [AdminRoles.MASTER, AdminRoles.MANAGER, AdminRoles.SUPPORT];

/** All valid roles that can be assigned to any user */
export const ALL_VALID_ROLES: string[] = [...ADMIN_ROLE_LIST, 'CLIENT'];

/**
 * Subscription Statuses
 */
export const SubscriptionStatuses = {
    PENDING: 'PENDING',
    PENDING_KYC: 'PENDING_KYC',
    ACTIVE: 'ACTIVE',
    CONTEMPLATED: 'CONTEMPLATED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
} as const;

export type SubscriptionStatus = typeof SubscriptionStatuses[keyof typeof SubscriptionStatuses];

/**
 * Installment Statuses
 */
export const InstallmentStatuses = {
    PENDING: 'PENDING',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
    CANCELLED: 'CANCELLED',
} as const;

export type InstallmentStatus = typeof InstallmentStatuses[keyof typeof InstallmentStatuses];

/**
 * KYC Statuses
 */
export const KycStatuses = {
    PENDING: 'PENDING',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;

export type KycStatus = typeof KycStatuses[keyof typeof KycStatuses];
