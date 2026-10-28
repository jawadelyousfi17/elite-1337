import { z } from 'zod';

/** The rules of a profile removal request, shared by the dialog (browser) and the server. */
export const MIN_REASON = 10, MAX_REASON = 1000;
export const hideRequestSchema = z.object({ reason: z.string().trim().min(MIN_REASON).max(MAX_REASON), acknowledged: z.literal(true) });
export type HideRequestInput = z.input<typeof hideRequestSchema>;
export type HideRequestResult = 'sent' | 'invalid' | 'limited' | 'unavailable';
