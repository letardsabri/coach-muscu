import { describe, expect, it } from 'vitest';
import { b64url, isAllowedEndpoint, vapidAuthorization } from './webpush';

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

describe('Web Push', () => {
  it('signature VAPID valide (ES256), vérifiable avec la clé publique', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
    const header = await vapidAuthorization({ endpoint: 'https://web.push.apple.com/abc', privateJwk, publicKey, subject: 'https://example.org/', now: 1_800_000_000_000 });

    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(publicKey);
    const [h, p, sig] = token!.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromB64url(p!)))).toEqual({ aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://example.org/' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, fromB64url(sig!), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });

  it('n’accepte que les services de push connus', () => {
    expect(isAllowedEndpoint('https://web.push.apple.com/QW1hMQ')).toBe(true);
    expect(isAllowedEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(isAllowedEndpoint('https://evil.example.com/x')).toBe(false);
    expect(isAllowedEndpoint('http://web.push.apple.com/x')).toBe(false);
  });
});
