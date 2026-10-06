// You and Me — Background Service Worker for Calls & Messages
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const type = payload.type || 'message';

    if (type === 'call') {
      const title = `📞 Incoming ${payload.kind === 'video' ? 'Video' : 'Audio'} Call`;
      const options = {
        body: `${payload.fromName || 'Someone'} is calling you on You and Me…`,
        icon: payload.fromAvatar || '/favicon.svg',
        badge: '/favicon.svg',
        tag: `call-${payload.callId || Date.now()}`,
        requireInteraction: true,
        vibrate: [300, 150, 300, 150, 300, 150, 600],
        data: {
          url: `/?to=${payload.fromId}&callId=${payload.callId}&kind=${payload.kind}&autoAnswer=true`,
          callId: payload.callId,
          fromId: payload.fromId,
        },
        actions: [
          { action: 'answer', title: '📞 Answer (ধরুন)' },
          { action: 'decline', title: '❌ Decline (কেটে দিন)' },
        ],
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } else {
      const title = payload.fromName || 'You and Me';
      const options = {
        body: payload.text || 'New message received',
        icon: payload.fromAvatar || '/favicon.svg',
        badge: '/favicon.svg',
        tag: `msg-${payload.fromId || Date.now()}`,
        vibrate: [150, 80, 150],
        data: {
          url: `/?to=${payload.fromId}`,
          fromId: payload.fromId,
        },
        actions: [
          { action: 'open', title: '💬 Open Chat (খুলুন)' },
        ],
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (err) {
    console.error('Service worker push error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  if (action === 'decline') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
