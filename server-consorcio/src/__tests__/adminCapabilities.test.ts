import {
    canManageRole,
    hasCapability,
    capabilitiesForRole
} from '../security/adminCapabilities';

describe('admin capability policy', () => {
    it('permits the master to manage sensitive account actions', () => {
        expect(hasCapability('MASTER', 'people.change_password')).toBe(true);
        expect(hasCapability('MASTER', 'people.change_email')).toBe(true);
        expect(hasCapability('MASTER', 'security.manage')).toBe(true);
    });

    it('limits manager and support actions to their responsibilities', () => {
        expect(hasCapability('MANAGER', 'people.change_email')).toBe(true);
        expect(hasCapability('MANAGER', 'people.change_password')).toBe(false);
        expect(hasCapability('SUPPORT', 'people.view')).toBe(true);
        expect(hasCapability('SUPPORT', 'people.change_email')).toBe(false);
        expect(hasCapability('SUPPORT', 'payments.manage')).toBe(false);
    });

    it('does not grant administrative capabilities to clients', () => {
        expect(capabilitiesForRole('CLIENT')).toEqual([]);
        expect(hasCapability('CLIENT', 'people.view')).toBe(false);
    });

    it('allows only the master to change administrative roles', () => {
        expect(canManageRole('MASTER', 'MANAGER')).toBe(true);
        expect(canManageRole('MANAGER', 'SUPPORT')).toBe(false);
        expect(canManageRole('SUPPORT', 'CLIENT')).toBe(false);
    });
});
