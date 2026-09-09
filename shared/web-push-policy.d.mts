export type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export function validPushEndpoint(value: unknown): boolean;
export function parsePushSubscription(input: unknown): WebPushSubscription;
export function pushNotice(agent: boolean): { title: string; body: string; tag: string; destination: string };
