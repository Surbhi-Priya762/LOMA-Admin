// Runs by itself every 30 minutes on Netlify, so new bookings appear without anyone clicking Sync.
import { runSync } from '../lib/calendly-sync.mjs';

export default async () => {
  try {
    const result = await runSync();
    console.log('Calendly sync', result);
  } catch (e) {
    console.error('Calendly sync failed:', e.message || e);
  }
};

export const config = { schedule: '*/30 * * * *' };
