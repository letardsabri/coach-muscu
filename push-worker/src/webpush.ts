/**
 * Web Push minimal (RFC 8030 + VAPID RFC 8292), sans dépendance : WebCrypto uniquement.
 *
 * Les notifications sont envoyées SANS contenu chiffré (push « vide ») : le service worker de l'app
 * affiche lui-même « Repos terminé ». Aucune donnée personnelle ne transite, et pas besoin du
 * chiffrement RFC 8291.
 */

export interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

const enc = new TextEncoder();

export function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Services de push autorisés (empêche d'utiliser le serveur pour appeler n'importe quelle URL). */
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

/** En-tête Authorization VAPID : JWT ES256 signé avec la clé privée du serveur. */
export async function vapidAuthorization(args: {
  endpoint: string;
  privateJwk: JsonWebKey;
  publicKey: string;
  subject: string;
  now?: number;
}): Promise<string> {
  const now = args.now ?? Date.now();
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64url(JSON.stringify({ aud: new URL(args.endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: args.subject }));
  const key = await crypto.subtle.importKey('jwk', args.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto renvoie la signature au format brut r||s (64 octets), celui qu'attend JWS.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64url(signature)}, k=${args.publicKey}`;
}

/** Envoie une notification vide. Renvoie le statut HTTP du service de push (201 = acceptée). */
export async function sendEmptyPush(sub: PushSubscriptionJSON, vapid: { privateJwk: JsonWebKey; publicKey: string; subject: string }): Promise<number> {
  const authorization = await vapidAuthorization({ endpoint: sub.endpoint, ...vapid });
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '120', Urgency: 'high', Authorization: authorization },
  });
  return res.status;
}
