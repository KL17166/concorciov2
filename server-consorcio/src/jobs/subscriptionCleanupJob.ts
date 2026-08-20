import { SubscriptionCleanupService } from '../services/subscriptionCleanupService';
import { logger } from '../config/logger';

let cleanupTimer: NodeJS.Timeout | null = null;
let isJobRunning = false;

/**
 * Runs the subscription cleanup cycle with concurrency protection.
 */
export async function runSubscriptionCleanupCycle(): Promise<void> {
    if (isJobRunning) {
        logger.warn('[SubscriptionCleanupJob] Previous cleanup cycle is still running. Skipping iteration.');
        return;
    }

    isJobRunning = true;
    try {
        logger.info('[SubscriptionCleanupJob] Starting subscription cleanup cycle...');
        const cancelledCount = await SubscriptionCleanupService.cancelExpiredPending(3);
        logger.info(`[SubscriptionCleanupJob] Cleanup completed successfully. Cancelled ${cancelledCount} expired subscription(s).`);
    } catch (error) {
        logger.error('[SubscriptionCleanupJob] Error during subscription cleanup cycle:', error);
    } finally {
        isJobRunning = false;
    }
}

/**
 * Starts the periodic subscription cleanup background job.
 * @param intervalMs Interval between executions in milliseconds (default: 1 hour).
 */
export function startSubscriptionCleanupJob(intervalMs = 60 * 60 * 1000): void {
    if (cleanupTimer) {
        logger.warn('[SubscriptionCleanupJob] Job is already running.');
        return;
    }

    logger.info(`[SubscriptionCleanupJob] Starting cleanup job scheduler (interval: ${intervalMs / 1000}s)...`);

    // Initial run delayed by 30 seconds to let the application finish booting
    setTimeout(() => {
        runSubscriptionCleanupCycle().catch((err) => {
            logger.error('[SubscriptionCleanupJob] Initial run error:', err);
        });
    }, 30000);

    // Recurring interval
    cleanupTimer = setInterval(() => {
        runSubscriptionCleanupCycle().catch((err) => {
            logger.error('[SubscriptionCleanupJob] Periodic run error:', err);
        });
    }, intervalMs);

    // Unref timer so it does not block Node process termination in tests or scripts
    cleanupTimer.unref();
}

/**
 * Stops the subscription cleanup job timer.
 */
export function stopSubscriptionCleanupJob(): void {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
        logger.info('[SubscriptionCleanupJob] Job scheduler stopped.');
    }
}
