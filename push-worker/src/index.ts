/**
 * Serveur de notifications « fin de repos » de Coach Muscu (Cloudflare Workers, offre gratuite).
 *
 * POST /schedule { id, endsAt, subscription }  → programme une notification à l'heure endsAt
 * POST /cancel   { id }                         → annule la notification en attente
 *
 * Chaque appareil a son minuteur (Durable Object, nommé par `id`), réveillé à l'heure exacte par une
 * alarme. Données conservées : l'abonnement push (identifiant technique anonyme fourni par Apple) et
 * l'heure de fin du repos, effacés dès l'envoi ou l'annulation. Aucune donnée d'entraînement.
 */
import { isAllowedEndpoint, sendEmptyPush, type PushSubscriptionJSON } from './webpush';

export interface Env {
  TIMERS: DurableObjectNamespace;
  VAPID_PRIVATE_JWK: string; // secret (wrangler secret put)
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
  ALLOWED_ORIGINS: string; // séparées par des virgules
}

const MAX_DELAY_MS = 60 * 60 * 1000; // un repos dure au plus 1 h
const ID_RE = /^[0-9a-f-]{36}$/;

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const { pathname } = new URL(req.url);
    if (req.method === 'GET' && pathname === '/health') return json(200, { ok: true }, headers);
    if (req.method !== 'POST' || (pathname !== '/schedule' && pathname !== '/cancel')) return json(404, { error: 'introuvable' }, headers);
    if (!headers['Access-Control-Allow-Origin']) return json(403, { error: 'origine refusée' }, headers);

    let body: { id?: string; endsAt?: number; subscription?: PushSubscriptionJSON };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'JSON invalide' }, headers);
    }
    if (!body.id || !ID_RE.test(body.id)) return json(400, { error: 'id invalide' }, headers);

    if (pathname === '/schedule') {
      const delay = (body.endsAt ?? 0) - Date.now();
      if (!Number.isFinite(delay) || delay > MAX_DELAY_MS || delay < -5000) return json(400, { error: 'heure invalide' }, headers);
      if (!body.subscription?.endpoint || !isAllowedEndpoint(body.subscription.endpoint)) return json(400, { error: 'abonnement invalide' }, headers);
    }

    const stub = env.TIMERS.get(env.TIMERS.idFromName(body.id));
    const res = await stub.fetch(`https://timer${pathname}`, { method: 'POST', body: JSON.stringify(body) });
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json', ...headers } });
  },
};

/** Minuteur d'un appareil : une seule notification en attente à la fois (la dernière remplace la précédente). */
export class RestTimer {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const body = (await req.json()) as { endsAt?: number; subscription?: PushSubscriptionJSON };
    if (pathname === '/schedule') {
      await this.state.storage.put('job', { endsAt: body.endsAt, subscription: body.subscription });
      await this.state.storage.setAlarm(Math.max(Date.now(), body.endsAt!));
      return Response.json({ scheduled: body.endsAt });
    }
    await this.state.storage.deleteAlarm();
    await this.state.storage.delete('job');
    return Response.json({ cancelled: true });
  }

  async alarm(): Promise<void> {
    const job = await this.state.storage.get<{ endsAt: number; subscription: PushSubscriptionJSON }>('job');
    await this.state.storage.delete('job');
    if (!job) return;
    const status = await sendEmptyPush(job.subscription, {
      privateJwk: JSON.parse(this.env.VAPID_PRIVATE_JWK) as JsonWebKey,
      publicKey: this.env.VAPID_PUBLIC_KEY,
      subject: this.env.VAPID_SUBJECT,
    });
    console.log(`push envoyé, statut ${status}, retard ${Date.now() - job.endsAt} ms`);
  }
}
