export const CONFIRM_SUBSCRIPTIONS_BTN = '💰 Confirm Subscriptions';
export const STATISTICS_BTN = '📊 Statistics';

export const isValidChatMember = (status: string) => {
  return ['administrator', 'creator', 'member'].includes(status);
};
