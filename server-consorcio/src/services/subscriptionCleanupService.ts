import { SubscriptionRepository } from '../repositories/subscriptionRepository';
import { logger } from '../config/logger';

export class SubscriptionCleanupService {
    /**
     * Cancels pending subscriptions that are older than the specified retention days.
     */
    static async cancelExpiredPending(daysOld = 3, userId?: string): Promise<number> {
        try {
            const result = await SubscriptionRepository.autoCancelPendingOlderThan(daysOld, userId);
            const count = result.count;
            if (count > 0) {
                logger.info(`[SubscriptionCleanup] Cancelled ${count} expired pending subscription(s).`);
            }
            return count;
        } catch (error) {
            logger.error('[SubscriptionCleanup] Error during pending subscription cleanup:', error);
            return 0;
        }
    }

    /**
     * Cancels orphan subscriptions (subscriptions without valid products or plans).
     */
    static async cancelOrphans(orphanIds: string[]): Promise<void> {
        if (!orphanIds || orphanIds.length === 0) return;
        try {
            logger.warn(`[SubscriptionCleanup] Cancelling ${orphanIds.length} orphan subscription(s): ${orphanIds.join(', ')}`);
            await SubscriptionRepository.autoCancelOrphans(orphanIds);
        } catch (error) {
            logger.error('[SubscriptionCleanup] Error during orphan cleanup:', error);
        }
    }
}
