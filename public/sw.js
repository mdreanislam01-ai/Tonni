// You and Me — background notifications and call actions.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    console.error('Invalid push payload:', error);
    return;
  }

  if (payload.type === 'call-ended') {
    event.waitUntil(
      self.registration.getNotifications({ tag: `call-${payload.callId}` }).then((notifications) => {
        notifications.forEach((notification) => notification.close());
      }),
    );
    return;
  }

  if (payload.type === 'call') {
    const callerId = encodeURIComponent(payload.fromId || '');
    const callId = encodeURIComponent(payload.callId || '');
    const kind = payload.kind === 'video' ? 'video' : 'audio';
    const title = kind === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call';
    const options = {
      body: `${payload.fromName || 'Someone'} is calling you on You and Me.`,
      icon: payload.fromAvatar || '/favicon.svg',
      badge: '/favicon.svg',
      tag: `call-${payload.callId || Date.now()}`,
      renotify: false,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300, 150, 600],
      data: {
        type: 'call',
        url: `/?to=${callerId}&callId=${callId}&kind=${kind}&callAction=open`,
        callId: payload.callId,
        fromId: payload.fromId,
        kind,
      },
      actions: [
        { action: 'answer', title: '📞 Answer (ধরুন)' },
        { action: 'decline', title: '❌ Decline (কেটে দিন)' },
      ],
    };
    event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appIsFocused = windows.some((client) => client.visibilityState === 'visible' && client.focused);
      if (appIsFocused) return;
      const existing = await self.registration.getNotifications({ tag: options.tag });
      if (!existing.length) await self.registration.showNotification(title, options);
    })());
    return;
  }

  if (payload.type === 'call-missed') {
    const callerId = encodeURIComponent(payload.fromId || '');
    const kindLabel = payload.kind === 'video' ? 'video' : 'audio';
    event.waitUntil(self.registration.showNotification(
      `Missed ${kindLabel} call`,
      {
        body: `${payload.fromName || 'Someone'} called you on You and Me.`,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `missed-call-${payload.callId || Date.now()}`,
        data: {
          type: 'missed-call',
          url: `/?to=${callerId}`,
          fromId: payload.fromId,
        },
      },
    ));
    return;
  }

  if (payload.type !== 'message') return;

  const fromId = encodeURIComponent(payload.fromId || '');
  const options = {
    body: payload.text || 'New message received',
    icon: payload.fromAvatar || '/favicon.svg',
    badge: '/favicon.svg',
    tag: `msg-${payload.fromId || Date.now()}`,
    renotify: true,
    vibrate: [150, 80, 150],
    data: {
      type: 'message',
      // A notification opens straight into a compact, focused chat surface.
      url: `/?to=${fromId}&quickChat=1`,
      fullUrl: `/?to=${fromId}`,
      fromId: payload.fromId,
    },
    actions: [
      { action: 'reply', title: 'Reply' },
      { action: 'open', title: 'Open app' },
    ],
  };

  event.waitUntil((async () => {
    // Web Push may be sent even while a socket is connected (for example, when
    // a mobile browser has suspended its page). Avoid a duplicate OS alert if
    // the app is already on screen and focused; the page shows its in-app head.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appIsFocused = windows.some((client) => client.visibilityState === 'visible' && client.focused);
    if (appIsFocused) return;

    await self.registration.showNotification(payload.fromName || 'You and Me', options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  notification.close();
  const data = notification.data || {};
  const isCall = data.type === 'call';
  const isMessage = data.type === 'message';
  const action = ['answer', 'decline'].includes(event.action) ? event.action : 'open';
  const url = isMessage && event.action === 'open' ? data.fullUrl : data.url;

  event.waitUntil((async () => {
    const targetUrl = new URL(url || '/', self.location.origin);
    if (isCall) {
      targetUrl.searchParams.set('callId', data.callId);
      targetUrl.searchParams.set('callAction', action);
      if (data.fromId) targetUrl.searchParams.set('to', data.fromId);
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clients.find((item) => {
      try {
        return new URL(item.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (client) {
      await client.focus();
      if (isCall) {
        client.postMessage({
          type: 'call-notification-action',
          action,
          callId: data.callId,
          fromId: data.fromId,
        });
      } else if ('navigate' in client) {
        await client.navigate(targetUrl.href);
      }
      return;
    }

    return self.clients.openWindow(targetUrl.href);
  })());
});
