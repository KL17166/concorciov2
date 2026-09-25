import { canTransition } from '../application/alerts/alertQueue';
import { hasCapability } from '../security/adminCapabilities';

describe('central de notificações fase 1', () => {
    it('permite OPEN->ACK->IN_PROGRESS->RESOLVED e reabertura', () => {
        expect(canTransition('OPEN', 'ACK')).toBe(true);
        expect(canTransition('ACK', 'IN_PROGRESS')).toBe(true);
        expect(canTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
        expect(canTransition('RESOLVED', 'OPEN')).toBe(true);
    });

    it('bloqueia transição inválida RESOLVED->ACK', () => {
        expect(canTransition('RESOLVED', 'ACK')).toBe(false);
        expect(canTransition('DISMISSED', 'RESOLVED')).toBe(false);
    });

    it('atendente vê mas não conclui sozinho (concluir exige notifications.manage)', () => {
        expect(hasCapability('SUPPORT', 'notifications.view')).toBe(true);
        expect(hasCapability('SUPPORT', 'notifications.manage')).toBe(false);
        expect(hasCapability('MANAGER', 'notifications.manage')).toBe(true);
        expect(hasCapability('MASTER', 'notifications.manage')).toBe(true);
    });
});
