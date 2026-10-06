import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import webpush from 'web-push';
import { Server as SocketServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const app = express();
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  maxHttpBufferSize: 2_000_000,
  cors: { origin: true, credentials: true },
});

// Profile persistence store
const dataDir = path.join(__dirname, 'data');
const profilesFile = path.join(dataDir, 'profiles.json');
try {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch {
  // directory creation fallback
}

const registeredProfiles = new Map(); // id -> profile

const VAPID_PUBLIC_KEY = 'BBcmeZ7W_lOStUVhoU4vb2GzTOuFjErD5VJTuZqaa_5i4UK-w8WfKeOfznfrT6YohkN0omVXB7wlPlrPOMeYIV0';
const VAPID_PRIVATE_KEY = '4P_QUL5chQyFxSGeMrW8Y18bsvmJi3PC_dqncr2q3PI';

try {
  webpush.setVapidDetails(
    'mailto:support@rmfbd.online',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (err) {
  console.warn('VAPID setup error:', err.message);
}

const pushSubscriptions = new Map(); // guestId -> subscription object
const subsFile = path.join(dataDir, 'subscriptions.json');

try {
  if (fs.existsSync(subsFile)) {
    const data = JSON.parse(fs.readFileSync(subsFile, 'utf-8'));
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item?.id && item?.subscription) pushSubscriptions.set(item.id, item.subscription);
      }
    }
  }
} catch {}

function saveSubscriptions() {
  try {
    const list = [...pushSubscriptions.entries()].map(([id, subscription]) => ({ id, subscription }));
    fs.writeFileSync(subsFile, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

function sendPushNotification(targetId, payload) {
  const sub = pushSubscriptions.get(targetId);
  if (!sub) return;
  webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
    if (err.statusCode === 404 || err.statusCode === 410) {
      pushSubscriptions.delete(targetId);
      saveSubscriptions();
    }
  });
}


function loadSavedProfiles() {
  try {
    if (fs.existsSync(profilesFile)) {
      const data = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item?.id) registeredProfiles.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load saved profiles:', err.message);
  }
}
loadSavedProfiles();

function saveProfilesToDisk() {
  try {
    const list = [...registeredProfiles.values()];
    fs.writeFileSync(profilesFile, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save profiles to disk:', err.message);
  }
}

app.get('/api/vapid-key', (_req, res) => {
  res.json({ ok: true, publicKey: VAPID_PUBLIC_KEY });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'You and Me', online: activeUsers.size, profiles: registeredProfiles.size });
});

// Guest identities live in memory and persist across reloads
const activeUsers = new Map(); // guest ID -> { id, name, key, sockets: Set<string> }
const socketGuests = new Map(); // socket ID -> guest ID
const inboxes = new Map(); // guest ID -> messages waiting for the guest to reconnect
const calls = new Map(); // call ID -> { a, b }
const userCalls = new Map(); // guest ID -> call ID

const roomFor = (id) => `guest:${id}`;
const normaliseId = (value) => String(value ?? '').trim().toUpperCase();
const validId = (value) => /^YM-[A-Z0-9]{6}$/.test(value);
const safeName = (value) => String(value ?? 'User').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 40) || 'User';
const safeUsername = (value) => String(value ?? '').trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24);
const safeBio = (value) => String(value ?? '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 160);
const safePhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  const national = digits.startsWith('00880') ? digits.slice(2) : digits;
  const local = national.startsWith('880') ? `0${national.slice(3)}` : national;
  return /^01[3-9]\d{8}$/.test(local) ? `+880${local.slice(1)}` : '';
};
const safeAvatar = (value) => {
  const avatar = String(value ?? '');
  return /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(avatar) && avatar.length <= 180_000 ? avatar : '';
};

const updateGuestProfile = (guest, payload = {}) => {
  if (payload.name && payload.name.trim()) guest.name = safeName(payload.name);
  if (payload.username !== undefined) guest.username = safeUsername(payload.username);
  if (payload.bio !== undefined) guest.bio = safeBio(payload.bio);
  if (payload.phone !== undefined) guest.phone = safePhone(payload.phone);
  if (payload.phonePublic !== undefined) guest.phonePublic = Boolean(payload.phonePublic && guest.phone);
  if (payload.avatar !== undefined) guest.avatar = safeAvatar(payload.avatar);
  if (payload.showPresence !== undefined) guest.showPresence = payload.showPresence !== false;

  // Persist into registeredProfiles
  registeredProfiles.set(guest.id, {
    id: guest.id,
    key: guest.key,
    name: guest.name,
    username: guest.username || '',
    bio: guest.bio || '',
    phone: guest.phone || '',
    phonePublic: Boolean(guest.phonePublic),
    avatar: guest.avatar || '',
    showPresence: guest.showPresence !== false,
    updatedAt: Date.now(),
  });
  saveProfilesToDisk();
};

const ackWith = (ack, body) => {
  if (typeof ack === 'function') ack(body);
};

const publicUsers = () => [...activeUsers.values()]
  .filter((guest) => guest.showPresence)
  .map(({ id, name, username, bio, phone, phonePublic, avatar }) => ({
    id,
    name,
    username: username || '',
    bio: bio || '',
    phone: phonePublic ? phone : '',
    avatar: avatar || '',
    online: true,
  }));

const getPeer = (call, id) => (call?.a === id ? call.b : call?.b === id ? call.a : null);

function emitPresence() {
  io.emit('presence:update', publicUsers());
}

function removeCall(callId, endedBy = null) {
  const call = calls.get(callId);
  if (!call) return;
  calls.delete(callId);
  userCalls.delete(call.a);
  userCalls.delete(call.b);
  const recipient = endedBy ? getPeer(call, endedBy) : null;
  if (recipient) {
    io.to(roomFor(recipient)).emit('call:ended', { callId, byId: endedBy });
  }
}

io.on('connection', (socket) => {
  socket.on('guest:register', (payload = {}, ack) => {
    const id = normaliseId(payload.id);
    const key = String(payload.key ?? '').slice(0, 96);
    if (!validId(id) || key.length < 20) {
      ackWith(ack, { ok: false, error: 'invalid-guest' });
      return;
    }

    const saved = registeredProfiles.get(id);
    if (saved && saved.key && saved.key !== key) {
      ackWith(ack, { ok: false, error: 'identity-in-use' });
      return;
    }

    let guest = activeUsers.get(id);
    if (!guest) {
      guest = {
        id,
        key,
        sockets: new Set(),
        name: saved?.name || safeName(payload.name),
        username: saved?.username || safeUsername(payload.username),
        bio: saved?.bio || safeBio(payload.bio),
        phone: saved?.phone || safePhone(payload.phone),
        phonePublic: saved ? saved.phonePublic : Boolean(payload.phonePublic),
        avatar: saved?.avatar || safeAvatar(payload.avatar),
        showPresence: saved ? saved.showPresence : payload.showPresence !== false,
      };
      activeUsers.set(id, guest);
    }
    updateGuestProfile(guest, payload);

    guest.sockets.add(socket.id);
    socketGuests.set(socket.id, id);
    socket.join(roomFor(id));

    const pending = inboxes.get(id) ?? [];
    inboxes.delete(id);
    ackWith(ack, { ok: true, online: publicUsers(), inbox: pending });
    emitPresence();
  });

  socket.on('guest:update', (payload = {}) => {
    const id = socketGuests.get(socket.id);
    const guest = id && activeUsers.get(id);
    if (!guest) return;
    updateGuestProfile(guest, payload);
    emitPresence();
    // Broadcast live profile update so all open chats with this user refresh instantly
    io.emit('profile:update', {
      id: guest.id,
      name: guest.name,
      username: guest.username || '',
      bio: guest.bio || '',
      avatar: guest.avatar || '',
      phone: guest.phonePublic ? guest.phone : '',
    });
  });

  socket.on('guest:lookup', (payload = {}, ack) => {
    const id = normaliseId(payload.id);
    if (!validId(id)) {
      ackWith(ack, { ok: false, error: 'invalid-id' });
      return;
    }
    const active = activeUsers.get(id);
    const profile = active || registeredProfiles.get(id);
    if (!profile) {
      ackWith(ack, { ok: true, found: false });
      return;
    }
    const isOnline = Boolean(active?.sockets?.size);
    ackWith(ack, {
      ok: true,
      found: true,
      id: profile.id,
      name: profile.name,
      username: profile.username || '',
      bio: profile.bio || '',
      avatar: profile.avatar || '',
      phone: profile.phonePublic ? profile.phone : '',
      online: isOnline,
    });
  });


  socket.on('push:subscribe', (payload = {}) => {
    const id = socketGuests.get(socket.id);
    if (!id || !payload.subscription) return;
    pushSubscriptions.set(id, payload.subscription);
    saveSubscriptions();
  });

  socket.on('push:unsubscribe', () => {
    const id = socketGuests.get(socket.id);
    if (!id) return;
    pushSubscriptions.delete(id);
    saveSubscriptions();
  });

  socket.on('message:send', (payload = {}, ack) => {
    const senderId = socketGuests.get(socket.id);
    const sender = (senderId && activeUsers.get(senderId)) || registeredProfiles.get(senderId);
    const toId = normaliseId(payload.toId);
    if (!sender || !validId(toId)) {
      ackWith(ack, { ok: false, error: 'not-connected' });
      return;
    }

    const messageId = String(payload.id ?? crypto.randomUUID()).slice(0, 100);
    const text = String(payload.text ?? '').slice(0, 12_000);
    const type = ['text', 'image', 'file', 'audio'].includes(payload.type) ? payload.type : 'text';
    const attachment = payload.attachment && typeof payload.attachment === 'object'
      ? {
          name: String(payload.attachment.name ?? 'Attachment').slice(0, 180),
          mime: String(payload.attachment.mime ?? 'application/octet-stream').slice(0, 100),
          data: String(payload.attachment.data ?? '').slice(0, 900_000),
          duration: Number(payload.attachment.duration) || 0,
        }
      : null;

    if (!text && !attachment) {
      ackWith(ack, { ok: false, error: 'empty-message' });
      return;
    }

    const message = {
      id: messageId,
      fromId: senderId,
      toId,
      senderName: sender.name,
      senderUsername: sender.username || '',
      senderBio: sender.bio || '',
      senderPhone: sender.phonePublic ? sender.phone : '',
      senderAvatar: sender.avatar || '',
      text,
      type,
      attachment,
      createdAt: Number(payload.createdAt) || Date.now(),
    };
    const target = activeUsers.get(toId);
    if (target) {
      io.to(roomFor(toId)).emit('message:receive', message);
    } else {
      const queue = inboxes.get(toId) ?? [];
      if (!queue.some((item) => item.id === messageId)) queue.push(message);
      inboxes.set(toId, queue.slice(-200));

      // Send background push notification to wake up device!
      sendPushNotification(toId, {
        type: 'message',
        fromId: senderId,
        fromName: sender.name,
        fromAvatar: sender.avatar,
        text: text || (type === 'audio' ? '🎤 Voice message' : '📷 Photo'),
      });
    }
    ackWith(ack, { ok: true, status: target ? 'delivered' : 'sent' });
  });

  socket.on('message:delivered', (payload = {}) => {
    const recipientId = socketGuests.get(socket.id);
    const fromId = normaliseId(payload.fromId);
    if (!recipientId || !validId(fromId)) return;
    io.to(roomFor(fromId)).emit('message:status', {
      id: String(payload.id ?? '').slice(0, 100),
      status: 'delivered',
      byId: recipientId,
    });
  });

  socket.on('chat:read', (payload = {}) => {
    const readerId = socketGuests.get(socket.id);
    const peerId = normaliseId(payload.peerId);
    if (!readerId || !validId(peerId)) return;
    io.to(roomFor(peerId)).emit('chat:read', { byId: readerId });
  });

  socket.on('typing:update', (payload = {}) => {
    const fromId = socketGuests.get(socket.id);
    const toId = normaliseId(payload.toId);
    if (!fromId || !validId(toId) || fromId === toId) return;
    socket.to(roomFor(toId)).emit('typing:update', {
      fromId,
      active: Boolean(payload.active),
    });
  });

  socket.on('call:start', (payload = {}, ack) => {
    const fromId = socketGuests.get(socket.id);
    const toId = normaliseId(payload.toId);
    const kind = payload.kind === 'video' ? 'video' : 'audio';
    const callId = String(payload.callId ?? '').slice(0, 100);
    const target = activeUsers.get(toId);
    if (!fromId || !validId(toId) || fromId === toId || !callId) {
      ackWith(ack, { ok: false, error: 'invalid-call' });
      return;
    }
    if (!target) {
      // Send background push call notification so device rings even if closed!
      sendPushNotification(toId, {
        type: 'call',
        callId,
        fromId,
        fromName: caller?.name ?? 'User',
        fromAvatar: caller?.avatar ?? '',
        kind,
      });
      ackWith(ack, { ok: false, error: 'offline' });
      return;
    }

    // Also send push alert in case app is minimized
    sendPushNotification(toId, {
      type: 'call',
      callId,
      fromId,
      fromName: caller?.name ?? 'User',
      fromAvatar: caller?.avatar ?? '',
      kind,
    });
    if (userCalls.has(fromId) || userCalls.has(toId)) {
      ackWith(ack, { ok: false, error: 'busy' });
      return;
    }

    const caller = activeUsers.get(fromId) || registeredProfiles.get(fromId);
    calls.set(callId, { a: fromId, b: toId });
    userCalls.set(fromId, callId);
    userCalls.set(toId, callId);
    io.to(roomFor(toId)).emit('call:incoming', {
      callId,
      fromId,
      fromName: caller?.name ?? 'User',
      fromAvatar: caller?.avatar ?? '',
      kind,
    });
    ackWith(ack, { ok: true });
  });

  socket.on('call:respond', (payload = {}) => {
    const fromId = socketGuests.get(socket.id);
    const callId = String(payload.callId ?? '').slice(0, 100);
    const call = calls.get(callId);
    const toId = getPeer(call, fromId);
    if (!fromId || !toId) return;
    const accepted = Boolean(payload.accepted);
    io.to(roomFor(toId)).emit('call:response', {
      callId,
      fromId,
      accepted,
      reason: String(payload.reason ?? '').slice(0, 32),
    });
    if (!accepted) removeCall(callId);
  });

  socket.on('call:signal', (payload = {}) => {
    const fromId = socketGuests.get(socket.id);
    const callId = String(payload.callId ?? '').slice(0, 100);
    const call = calls.get(callId);
    const toId = getPeer(call, fromId);
    if (!fromId || !toId || !payload.signal || typeof payload.signal !== 'object') return;
    io.to(roomFor(toId)).emit('call:signal', {
      callId,
      fromId,
      signal: payload.signal,
    });
  });

  socket.on('call:end', (payload = {}) => {
    const fromId = socketGuests.get(socket.id);
    const callId = String(payload.callId ?? '').slice(0, 100);
    if (!fromId || !calls.has(callId) || !getPeer(calls.get(callId), fromId)) return;
    removeCall(callId, fromId);
  });

  socket.on('disconnect', () => {
    const id = socketGuests.get(socket.id);
    socketGuests.delete(socket.id);
    if (!id) return;

    const guest = activeUsers.get(id);
    if (guest) {
      guest.sockets.delete(socket.id);
      if (guest.sockets.size === 0) {
        activeUsers.delete(id);
        const callId = userCalls.get(id);
        if (callId) removeCall(callId, id);
        emitPresence();
      }
    }
  });
});

if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath, { index: false }));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  const vite = await createViteServer({
    configFile: path.join(__dirname, 'vite.config.js'),
    server: {
      middlewareMode: true,
      hmr: { server: httpServer },
      allowedHosts: true,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const port = Number(process.env.PORT) || 4173;
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`You and Me is ready on http://0.0.0.0:${port} (${isProduction ? 'production' : 'development'})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    io.close();
    httpServer.close(() => process.exit(0));
  });
}
