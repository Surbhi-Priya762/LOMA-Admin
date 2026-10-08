// "Sync from Calendly" button on the Home Trials page calls this.
// It only returns counts, never customer details.
import { runSync } from '../lib/calendly-sync.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  try {
    const result = await runSync();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
};
