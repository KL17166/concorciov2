export type NotificationFrequency = 'HOURLY' | 'DAILY';

let currentBidNotificationFrequency: NotificationFrequency = 'HOURLY';

export const getBidNotificationFrequency = (): NotificationFrequency => {
    return currentBidNotificationFrequency;
};

export const setBidNotificationFrequency = (freq: NotificationFrequency): void => {
    if (freq === 'HOURLY' || freq === 'DAILY') {
        currentBidNotificationFrequency = freq;
    }
};
