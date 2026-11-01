/**
 * Notification « Repos terminé » quand l'app est quittée pendant un repos.
 *
 * Une app web iOS (≥ 16.4, installée sur l'écran d'accueil) est suspendue en arrière-plan : elle ne
 * peut ni sonner ni programmer une notification locale. On demande donc au serveur (push-worker/,
 * Cloudflare) d'envoyer une notification à l'heure de fin du repos :
 * - au moment où l'app passe en arrière-plan pendant un repos → programmation ;
 * - au retour dans l'app → annulation (le chrono de l'app prend le relais).
 * Données envoyées : l'abonnement push (anonyme) et l'heure de fin du repos. Rien d'autre.
 */
import config from '../data/push.json';
import { db } from '../db/db';
import { uuid } from './id';

export type PushState = 'unsupported' | 'not-installed' | 'denied' | 'off' | 'on' | 'not-configured';

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): 'ok' | 'unsupported' | 'not-installed' {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // Sur iPhone, ces API n'existent que dans l'app installée sur l'écran d'accueil.
    return /iPhone|iPad/.test(navigator.userAgent) && !standalone() ? 'not-installed' : 'unsupported';
  }
  return 'ok';
}

export const pushConfigured = () => Boolean(config.workerUrl);

export async function pushState(): Promise<PushState> {
  const support = pushSupport();
  if (support !== 'ok') return support;
  if (!pushConfigured()) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  return (await db.meta.get('pushSubscription')) ? 'on' : 'off';
}

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** À appeler depuis un tap : demande l'autorisation puis s'abonne. */
export async function enablePush(): Promise<PushState> {
  if (pushSupport() !== 'ok' || !pushConfigured()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return pushState();
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.vapidPublicKey) }));
  await db.meta.put({ key: 'pushSubscription', value: JSON.stringify(sub.toJSON()) });
  if (!(await db.meta.get('pushDeviceId'))) await db.meta.put({ key: 'pushDeviceId', value: uuid() });
  return 'on';
}

export async function disablePush(): Promise<void> {
  await cancelRestPush();
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch {
    // Pas grave : l'abonnement local est supprimé ci-dessous.
  }
  await db.meta.delete('pushSubscription');
}

async function call(path: '/schedule' | '/cancel', body: Record<string, unknown>): Promise<boolean> {
  try {
    // keepalive : la requête part même si iOS suspend l'app juste après.
    const res = await fetch(`${config.workerUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false; // hors ligne : pas de notification, le chrono de l'app reste juste
  }
}

/** Programme la notification de fin de repos (sans effet si les notifications sont désactivées). */
export async function scheduleRestPush(endsAt: number): Promise<boolean> {
  if (!pushConfigured()) return false;
  const [sub, id] = await Promise.all([db.meta.get('pushSubscription'), db.meta.get('pushDeviceId')]);
  if (!sub || !id) return false;
  return call('/schedule', { id: id.value, endsAt, subscription: JSON.parse(String(sub.value)) });
}

export async function cancelRestPush(): Promise<void> {
  if (!pushConfigured()) return;
  const id = await db.meta.get('pushDeviceId');
  if (id) await call('/cancel', { id: id.value });
}
