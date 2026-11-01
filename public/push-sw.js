/* Notifications de Coach Muscu, chargées par le service worker principal (importScripts).
 * Le serveur envoie une notification vide (aucune donnée personnelle) : le texte est défini ici. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || 'Repos terminé';
  const body = data.body || "C'est reparti : série suivante quand tu es prêt.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: 'fin-de-repos',
      renotify: true,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) if ('focus' in client) return client.focus();
      return self.clients.openWindow('./');
    }),
  );
});
