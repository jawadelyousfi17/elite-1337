import { z } from 'zod';
import { MAX_XP_LEVEL } from './xp-math';

/** Browser entries and shared custom-plan URLs must use a level the XP table can calculate. */
export const customLevelSchema = z.string().trim().max(20).regex(/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/).transform(Number).pipe(z.number().min(0).max(MAX_XP_LEVEL));
