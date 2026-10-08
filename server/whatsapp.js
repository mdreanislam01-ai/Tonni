import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_COOKIE = 'tonni_wa_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 6;
const MAX_MESSAGES_PER_PAGE = 100;
const MAX_SDP_LENGTH = 80_000;
const STATUS_RANK = { pending: 0, sent: 1, delivered: 2, read: 3 };
const ACTIVE_CALL_STATES = new Set(['incoming', 'pre_accepting', 'connecting', 'ringing', 'accepted', 'active', 'terminating']);

const asString = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');
const validWaId = (value) => /^\d{6,20}$/.test(String(value ?? ''));
const safeName = (value) => asString(value, 80).trim() || 'WhatsApp customer';
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const nowSeconds = (value) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds * 1000) : Date.now();
};
const equalText = (left, right) => {
  const leftHash = Buffer.from(hash(left), 'hex');
  const rightHash = Buffer.from(hash(right), 'hex');
  return crypto.timingSafeEqual(leftHash, rightHash);
};

function parseCookies(header = '') {
  const result = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

function emptyDatabase() {
  return { version: 1, conversations: {}, calls: [], deferredStatuses: {} };
}

function readDatabase(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed?.version === 1 && parsed.conversations && typeof parsed.conversations === 'object') {
      return {
        ...emptyDatabase(),
        ...parsed,
        calls: Array.isArray(parsed.calls) ? parsed.calls : [],
        deferredStatuses: parsed.deferredStatuses && typeof parsed.deferredStatuses === 'object' ? parsed.deferredStatuses : {},
      };
    }
  } catch {
    // A first run or an empty/corrupt data file starts with an empty inbox.
  }
  return emptyDatabase();
}

function normalizeStunServers(raw) {
  if (!raw) return [];
  return String(raw).split(',')
    .map((url) => url.trim())
    .filter((url) => /^(stun|stuns):[a-z0-9.-]+(?::\d{1,5})?$/i.test(url))
    .slice(0, 8)
    .map((urls) => ({ urls }));
}

function messageDetails(message) {
  const type = asString(message?.type || 'unknown', 32).toLowerCase();
  const body = message?.[type];
  const details = { type, text: '', media: null };
  if (type === 'text') details.text = asString(body?.body, 4096);
  else if (['image', 'audio', 'video', 'document', 'sticker'].includes(type)) {
    const label = { image: 'Photo', audio: 'Voice message', video: 'Video', document: 'Document', sticker: 'Sticker' }[type];
    details.text = asString(body?.caption, 4096) || (type === 'document' && body?.filename ? `Document: ${asString(body.filename, 180)}` : label);
    details.media = {
      id: asString(body?.id, 200),
      mimeType: asString(body?.mime_type, 120),
      fileName: asString(body?.filename, 180),
    };
  } else if (type === 'location') {
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    details.text = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `Location: ${latitude}, ${longitude}`
      : 'Location shared';
  } else if (type === 'interactive') {
    details.text = asString(body?.button_reply?.title || body?.list_reply?.title, 4096) || 'Interactive reply';
  } else if (type === 'button') details.text = asString(body?.text, 4096) || 'Button reply';
  else if (type === 'reaction') details.text = asString(body?.emoji, 40) || 'Reaction';
  else if (type === 'contacts') details.text = 'Contact shared';
  else details.text = type ? `${type[0].toUpperCase()}${type.slice(1)} message` : 'Message';
  return details;
}

function errorForMeta(error, mode = 'message') {
  const code = Number(error?.code);
  if (mode === 'call' && code === 138006) return 'This customer has not granted permission for a business-initiated WhatsApp call. Send a call-permission request first.';
  if (mode === 'message' && (code === 131047 || code === 470)) return 'The 24-hour customer-service window has closed. Send an approved WhatsApp template instead.';
  if (code === 190 || code === 200 || code === 10) return 'Meta denied this request. Check the access token, app permissions, and WhatsApp account assignment.';
  if (code === 4 || code === 80007) return 'Meta rate-limited this request. Please wait a moment and try again.';
  if (code) return `Meta WhatsApp API error (${code}).`;
  return mode === 'call' ? 'The official WhatsApp Calling API request failed.' : 'The official WhatsApp message could not be sent.';
}

function callIdFrom(value) {
  const result = asString(value, 160);
  return /^[A-Za-z0-9._:-]{1,160}$/.test(result) ? result : '';
}

export function createWhatsappIntegration({ app, io, storagePath, env = process.env, fetchImpl = globalThis.fetch, clock = Date.now }) {
  if (!app || !io || !storagePath) throw new Error('WhatsApp integration needs an Express app, Socket.IO server, and storage path.');

  const config = {
    accessToken: String(env.WHATSAPP_ACCESS_TOKEN || ''),
    phoneNumberId: String(env.WHATSAPP_PHONE_NUMBER_ID || ''),
    businessAccountId: String(env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''),
    appSecret: String(env.WHATSAPP_APP_SECRET || ''),
    verifyToken: String(env.WHATSAPP_VERIFY_TOKEN || ''),
    adminUsername: String(env.WHATSAPP_ADMIN_USERNAME || '').trim(),
    adminPassword: String(env.WHATSAPP_ADMIN_PASSWORD || ''),
    graphVersion: /^v\d+\.\d+$/.test(String(env.WHATSAPP_GRAPH_API_VERSION || 'v26.0'))
      ? String(env.WHATSAPP_GRAPH_API_VERSION || 'v26.0')
      : 'v26.0',
    callingEnabled: String(env.WHATSAPP_CALLING_ENABLED || '').toLowerCase() === 'true',
    displayNumber: String(env.WHATSAPP_DISPLAY_PHONE_NUMBER || '+8801890047742'),
    expectedDisplayDigits: digitsOnly(env.WHATSAPP_DISPLAY_PHONE_NUMBER || '+8801890047742'),
    iceServers: normalizeStunServers(env.WHATSAPP_CALLING_STUN_URLS),
    secureCookies: String(env.NODE_ENV || '').toLowerCase() === 'production',
  };

  let database = readDatabase(storagePath);
  const sessions = new Map(); // SHA-256(cookie) -> in-memory admin session
  const loginAttempts = new Map();
  const messagesByWaId = new Map();
  let phoneNumberVerificationPromise = null;
  const adminNamespace = io.of('/admin-whatsapp');

  for (const [waId, conversation] of Object.entries(database.conversations)) {
    if (!validWaId(waId) || !Array.isArray(conversation?.messages)) continue;
    for (const message of conversation.messages) {
      if (message?.waMessageId) messagesByWaId.set(String(message.waMessageId), { waId, message });
    }
  }

  function persist() {
    const directory = path.dirname(storagePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${storagePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(database), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, storagePath);
    try { fs.chmodSync(storagePath, 0o600); } catch { /* platform may not support chmod */ }
  }

  function emitToAdmins(event, payload) {
    for (const socket of adminNamespace.sockets.values()) {
      const session = sessions.get(socket.data.whatsappAdminHash);
      if (!session || session.expiresAt <= clock()) {
        socket.disconnect(true);
        continue;
      }
      socket.emit(event, payload);
    }
  }

  function apiConfigured() {
    return Boolean(config.accessToken && /^\d{5,30}$/.test(config.phoneNumberId));
  }

  function webhookConfigured() {
    return Boolean(config.appSecret && config.verifyToken && apiConfigured());
  }

  function adminConfigured() {
    return Boolean(config.adminUsername && config.adminPassword.length >= 16);
  }

  function callingConfigured() {
    return config.callingEnabled && webhookConfigured();
  }

  function sessionFromCookie(cookieHeader) {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!token || token.length > 160) return null;
    const sessionHash = hash(token);
    const session = sessions.get(sessionHash);
    if (!session) return null;
    if (session.expiresAt <= clock()) {
      sessions.delete(sessionHash);
      return null;
    }
    return { ...session, sessionHash };
  }

  function noStore(_req, res, next) {
    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    next();
  }

  function requireAdmin(req, res, next) {
    const session = sessionFromCookie(req.headers.cookie || '');
    if (!session) return res.status(401).json({ ok: false, error: 'unauthorized' });
    req.whatsappAdmin = session;
    next();
  }

  function sameOrigin(req) {
    const origin = req.get?.('origin');
    if (!origin) return true;
    try {
      return new URL(origin).host === String(req.get?.('host') || req.headers.host || '');
    } catch {
      return false;
    }
  }

  function requireCsrf(req, res, next) {
    const supplied = String(req.get?.('x-csrf-token') || '');
    if (!sameOrigin(req) || !supplied || !equalText(supplied, req.whatsappAdmin.csrfToken)) {
      return res.status(403).json({ ok: false, error: 'csrf' });
    }
    next();
  }

  adminNamespace.use((socket, next) => {
    const session = sessionFromCookie(socket.handshake.headers.cookie || '');
    if (!session) return next(new Error('unauthorized'));
    socket.data.whatsappAdminHash = session.sessionHash;
    socket.data.whatsappAdminExpiresAt = session.expiresAt;
    next();
  });
  adminNamespace.on('connection', (socket) => {
    socket.emit('whatsapp:connected', { ok: true });
  });

  function getOrCreateConversation(waId, customerName = '') {
    let conversation = database.conversations[waId];
    if (!conversation) {
      conversation = {
        waId,
        name: safeName(customerName),
        unreadCount: 0,
        lastMessageAt: 0,
        lastMessagePreview: '',
        messages: [],
      };
      database.conversations[waId] = conversation;
    }
    if (customerName) conversation.name = safeName(customerName);
    return conversation;
  }

  function conversationSummary(conversation) {
    return {
      waId: conversation.waId,
      phoneNumber: `+${conversation.waId}`,
      name: safeName(conversation.name),
      profilePictureUrl: '', // Meta's Cloud API does not provide customer profile photos.
      unreadCount: Number(conversation.unreadCount) || 0,
      lastMessageAt: Number(conversation.lastMessageAt) || 0,
      lastMessagePreview: asString(conversation.lastMessagePreview, 400),
      lastMessageDirection: conversation.messages?.at(-1)?.direction || '',
      messageCount: conversation.messages?.length || 0,
    };
  }

  function emitConversation(conversation) {
    emitToAdmins('whatsapp:conversation-updated', conversationSummary(conversation));
  }

  function addMessage(conversation, message, { unread = false } = {}) {
    if (message.waMessageId && messagesByWaId.has(message.waMessageId)) return null;
    conversation.messages.push(message);
    conversation.messages.sort((a, b) => (a.createdAt - b.createdAt) || String(a.id).localeCompare(String(b.id)));
    if (message.waMessageId) messagesByWaId.set(message.waMessageId, { waId: conversation.waId, message });
    if (unread) conversation.unreadCount = (Number(conversation.unreadCount) || 0) + 1;
    if (message.createdAt >= (Number(conversation.lastMessageAt) || 0)) {
      conversation.lastMessageAt = message.createdAt;
      conversation.lastMessagePreview = message.text || (message.type === 'call_permission_request' ? 'Call permission request' : 'Message');
    }
    return message;
  }

  function serializeMessage(message) {
    return {
      id: message.id,
      waMessageId: message.waMessageId || '',
      direction: message.direction,
      type: message.type || 'text',
      text: asString(message.text, 4096),
      media: message.media || null,
      createdAt: Number(message.createdAt) || clock(),
      status: message.status || (message.direction === 'inbound' ? 'received' : 'sent'),
      statusAt: Number(message.statusAt) || 0,
      error: asString(message.error, 400),
    };
  }

  function serializeCall(call) {
    return {
      id: call.id,
      waId: call.waId,
      customerName: call.customerName,
      direction: call.direction,
      status: call.status,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
      offerSdp: call.offerSdp || '',
      answerSdp: call.answerSdp || '',
      error: asString(call.error, 400),
    };
  }

  function setMessageStatus(message, status, timestamp, error = '') {
    const nextStatus = String(status || '').toLowerCase();
    if (!['sent', 'delivered', 'read', 'failed'].includes(nextStatus)) return false;
    const current = String(message.status || 'pending').toLowerCase();
    const nextAt = Number(timestamp) || clock();
    if (nextStatus === 'failed') {
      if (current === 'read' || current === 'delivered') return false;
      message.status = 'failed';
      message.error = asString(error, 400) || 'Meta reported that this message failed to send.';
      message.statusAt = nextAt;
      return true;
    }
    if ((STATUS_RANK[nextStatus] ?? 0) < (STATUS_RANK[current] ?? 0)) return false;
    if (nextAt < (Number(message.statusAt) || 0) && (STATUS_RANK[nextStatus] ?? 0) === (STATUS_RANK[current] ?? 0)) return false;
    message.status = nextStatus;
    message.error = '';
    message.statusAt = nextAt;
    return true;
  }

  function applyDeferredStatus(waMessageId, message) {
    const deferred = database.deferredStatuses[waMessageId];
    if (!deferred) return;
    setMessageStatus(message, deferred.status, deferred.timestamp, deferred.error);
    delete database.deferredStatuses[waMessageId];
  }

  function processMessageStatuses(value) {
    for (const item of value?.statuses || []) {
      const waMessageId = asString(item?.id, 200);
      const status = asString(item?.status, 32).toLowerCase();
      if (!waMessageId || !['sent', 'delivered', 'read', 'failed'].includes(status)) continue;
      const timestamp = nowSeconds(item.timestamp);
      const error = Array.isArray(item.errors) ? item.errors.map((entry) => asString(entry?.title || entry?.message, 150)).filter(Boolean).join(' — ') : '';
      const indexed = messagesByWaId.get(waMessageId);
      if (!indexed) {
        database.deferredStatuses[waMessageId] = { status, timestamp, error };
        const deferredIds = Object.keys(database.deferredStatuses);
        if (deferredIds.length > 2_000) delete database.deferredStatuses[deferredIds[0]];
        continue;
      }
      if (setMessageStatus(indexed.message, status, timestamp, error)) {
        const conversation = database.conversations[indexed.waId];
        if (conversation) emitToAdmins('whatsapp:message-status', {
          waId: indexed.waId,
          messageId: indexed.message.id,
          waMessageId,
          status: indexed.message.status,
          statusAt: indexed.message.statusAt,
          error: indexed.message.error,
        });
      }
    }
  }

  function processIncomingMessages(value) {
    const contacts = new Map();
    for (const contact of value?.contacts || []) {
      const waId = digitsOnly(contact?.wa_id);
      if (validWaId(waId)) contacts.set(waId, contact);
    }
    for (const incoming of value?.messages || []) {
      const waMessageId = asString(incoming?.id, 200);
      const from = digitsOnly(incoming?.from);
      const waId = validWaId(from) ? from : '';
      if (!waId || !waMessageId || messagesByWaId.has(waMessageId)) continue;
      const contact = contacts.get(waId);
      const name = safeName(contact?.profile?.name || database.conversations[waId]?.name || 'WhatsApp customer');
      const conversation = getOrCreateConversation(waId, name);
      if (contact?.user_id) conversation.userId = asString(contact.user_id, 200);
      if (contact?.parent_user_id) conversation.parentUserId = asString(contact.parent_user_id, 200);
      const details = messageDetails(incoming);
      const message = {
        id: crypto.randomUUID(),
        waMessageId,
        direction: 'inbound',
        type: details.type,
        text: details.text,
        media: details.media,
        createdAt: nowSeconds(incoming.timestamp),
        status: 'received',
        statusAt: 0,
        error: '',
      };
      if (!addMessage(conversation, message, { unread: true })) continue;
      persist();
      const serialized = serializeMessage(message);
      const summary = conversationSummary(conversation);
      emitToAdmins('whatsapp:message', { waId, message: serialized, conversation: summary });
      emitConversation(conversation);
    }
  }

  function findCall(callId) {
    return database.calls.find((call) => call.id === callId || call.opaqueCallbackData === callId) || null;
  }

  function keepRecentCalls() {
    if (database.calls.length > 300) database.calls = database.calls.slice(-300);
  }

  function processCallEvents(value) {
    const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
    const defaultContact = contacts[0] || {};
    for (const event of value?.calls || []) {
      const id = callIdFrom(event?.id);
      if (!id) continue;
      const eventName = asString(event?.event, 32).toLowerCase();
      const sdpType = asString(event?.session?.sdp_type, 20).toLowerCase();
      const direction = asString(event?.direction, 40).toLowerCase() === 'business_initiated' || sdpType === 'answer' ? 'outbound' : 'inbound';
      const businessNumber = digitsOnly(value?.metadata?.display_phone_number);
      const candidates = [
        defaultContact?.wa_id,
        direction === 'outbound' ? event?.to : event?.from,
        direction === 'outbound' ? event?.from : event?.to,
      ].map(digitsOnly);
      const waId = candidates.find((candidate) => validWaId(candidate) && candidate !== businessNumber) || '';
      const customer = safeName(defaultContact?.profile?.name || database.conversations[waId]?.name || 'WhatsApp customer');
      const opaque = asString(event?.biz_opaque_callback_data, 200);
      let call = findCall(id) || (opaque ? findCall(opaque) : null);

      if (eventName === 'terminate' || eventName === 'terminated') {
        if (call) {
          call.id = id;
          call.status = 'ended';
          call.updatedAt = nowSeconds(event.timestamp);
          persist();
          emitToAdmins('whatsapp:call-updated', serializeCall(call));
        }
        continue;
      }
      if (!['connect', 'ringing', 'accept', 'accepted'].includes(eventName)) continue;
      if (validWaId(waId)) getOrCreateConversation(waId, defaultContact?.profile?.name || customer);

      if (!call) {
        call = {
          id,
          waId: validWaId(waId) ? waId : '',
          customerName: customer,
          direction,
          status: direction === 'inbound' ? 'incoming' : 'ringing',
          createdAt: nowSeconds(event.timestamp),
          updatedAt: nowSeconds(event.timestamp),
          opaqueCallbackData: opaque,
          offerSdp: '',
          answerSdp: '',
          error: '',
        };
        database.calls.push(call);
      } else {
        call.id = id;
        if (validWaId(waId)) call.waId = waId;
        call.customerName = customer || call.customerName;
        call.direction = direction;
        call.updatedAt = nowSeconds(event.timestamp);
        call.opaqueCallbackData ||= opaque;
      }

      const sdp = asString(event?.session?.sdp || event?.connection?.webrtc?.sdp, MAX_SDP_LENGTH);
      if (direction === 'inbound' && sdpType === 'offer' && sdp) {
        call.offerSdp = sdp;
        call.status = 'incoming';
      } else if (direction === 'outbound' && sdpType === 'answer' && sdp) {
        call.answerSdp = sdp;
        if (!['accepted', 'active'].includes(call.status)) call.status = 'ringing';
      }
      keepRecentCalls();
      persist();
      emitToAdmins('whatsapp:call-updated', serializeCall(call));
    }

    for (const statusUpdate of value?.statuses || []) {
      if (String(statusUpdate?.type || '').toLowerCase() !== 'call') continue;
      const id = callIdFrom(statusUpdate?.id);
      const call = id && findCall(id);
      if (!call) continue;
      const status = asString(statusUpdate.status, 32).toLowerCase();
      if (['ringing', 'accepted', 'rejected', 'ended', 'failed'].includes(status)) {
        call.status = status;
        call.updatedAt = nowSeconds(statusUpdate.timestamp);
        if (status === 'rejected' || status === 'ended' || status === 'failed') call.error = status === 'failed' ? 'Meta reported that the call failed.' : '';
        persist();
        emitToAdmins('whatsapp:call-updated', serializeCall(call));
      }
    }
  }

  function processWebhook(body) {
    if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return;
    for (const entry of body.entry) {
      if (config.businessAccountId && String(entry?.id || '') !== config.businessAccountId) continue;
      for (const change of entry?.changes || []) {
        const value = change?.value || {};
        const phoneNumberId = String(value?.metadata?.phone_number_id || '');
        const displayDigits = digitsOnly(value?.metadata?.display_phone_number);
        if (phoneNumberId !== config.phoneNumberId) continue;
        if (config.expectedDisplayDigits && displayDigits && displayDigits !== config.expectedDisplayDigits) continue;
        if (change.field === 'messages') {
          processIncomingMessages(value);
          processMessageStatuses(value);
        } else if (change.field === 'calls') {
          processCallEvents(value);
        }
      }
    }
  }

  function signatureIsValid(req) {
    if (!config.appSecret || !Buffer.isBuffer(req.rawBody)) return false;
    const received = String(req.get?.('x-hub-signature-256') || '');
    const match = /^sha256=([0-9a-f]{64})$/i.exec(received);
    if (!match) return false;
    const expected = crypto.createHmac('sha256', config.appSecret).update(req.rawBody).digest();
    const actual = Buffer.from(match[1], 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  function jsonError(res, status, error, extra = {}) {
    return res.status(status).json({ ok: false, error, ...extra });
  }

  function metaFailureMessage(err, mode) {
    if (err?.metaError) return errorForMeta(err.metaError, mode);
    return mode === 'call' ? 'Could not reach Meta WhatsApp Calling API. Please try again.' : 'Could not reach Meta WhatsApp Cloud API. Please try again.';
  }

  async function verifyConfiguredPhoneNumber() {
    if (!phoneNumberVerificationPromise) {
      phoneNumberVerificationPromise = (async () => {
        if (!config.expectedDisplayDigits) {
          const error = new Error('The expected WhatsApp display number is not configured.');
          error.userMessage = 'Set WHATSAPP_DISPLAY_PHONE_NUMBER to +8801890047742 before sending WhatsApp messages or starting calls.';
          throw error;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const target = new URL(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}`);
          target.searchParams.set('fields', 'display_phone_number');
          const response = await fetchImpl(target.toString(), {
            method: 'GET',
            headers: { Authorization: `Bearer ${config.accessToken}` },
            signal: controller.signal,
          });
          let payload = {};
          try { payload = await response.json(); } catch { payload = {}; }
          if (!response.ok || payload?.error) {
            const error = new Error('Meta could not verify the configured WhatsApp phone number.');
            error.metaError = payload?.error || {};
            error.userMessage = errorForMeta(error.metaError, 'message');
            throw error;
          }
          if (digitsOnly(payload?.display_phone_number) !== config.expectedDisplayDigits) {
            const error = new Error('Configured Meta Phone Number ID does not match the expected business number.');
            error.userMessage = `The configured Phone Number ID is not registered to ${config.displayNumber}. Check WHATSAPP_PHONE_NUMBER_ID before sending.`;
            throw error;
          }
        } finally {
          clearTimeout(timeout);
        }
      })();
    }
    try {
      await phoneNumberVerificationPromise;
    } catch (error) {
      phoneNumberVerificationPromise = null;
      throw error;
    }
  }

  async function callMeta(endpoint, body = {}, mode = 'message', method = 'POST') {
    if (!apiConfigured()) {
      const error = new Error('WhatsApp Cloud API is not configured.');
      error.notConfigured = true;
      throw error;
    }
    await verifyConfiguredPhoneNumber();
    const target = new URL(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/${endpoint}`);
    const requestOptions = {
      method,
      headers: { Authorization: `Bearer ${config.accessToken}` },
    };
    if (method === 'GET') {
      for (const [key, value] of Object.entries(body || {})) target.searchParams.set(key, String(value));
    } else {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(body);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(target.toString(), {
        ...requestOptions,
        signal: controller.signal,
      });
      let payload = {};
      try { payload = await response.json(); } catch { payload = {}; }
      if (!response.ok || payload?.error) {
        const error = new Error('Meta WhatsApp API rejected the request.');
        error.metaError = payload?.error || {};
        error.userMessage = errorForMeta(error.metaError, mode);
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizedCallPermission(response) {
    const nested = Object.values(response || {}).find((item) => item?.value?.permission)?.value;
    const details = response?.permission ? response : nested || response?.value || response || {};
    const permission = details.permission || {};
    return {
      status: asString(permission.status || 'unknown', 24).toLowerCase(),
      expirationTime: Number(permission.expiration_time) || 0,
      actions: Array.isArray(details.actions) ? details.actions.map((item) => ({
        name: asString(item?.action_name, 64),
        canPerform: Boolean(item?.can_perform_action),
        limits: Array.isArray(item?.limits) ? item.limits.map((limit) => ({
          timePeriod: asString(limit?.time_period, 16),
          currentUsage: Number(limit?.current_usage) || 0,
          maxAllowed: Number(limit?.max_allowed) || 0,
          expiresAt: Number(limit?.limit_expiration_time) || 0,
        })) : [],
      })) : [],
    };
  }

  function listConversations(search = '', limit = 500) {
    const query = String(search || '').trim().toLowerCase();
    const phoneQuery = digitsOnly(query);
    const all = Object.values(database.conversations).filter((conversation) => {
      if (!query) return true;
      return safeName(conversation.name).toLowerCase().includes(query) || (phoneQuery && conversation.waId.includes(phoneQuery));
    });
    all.sort((a, b) => (Number(b.lastMessageAt) || 0) - (Number(a.lastMessageAt) || 0));
    return all.slice(0, Math.max(1, Math.min(Number(limit) || 500, 1_000))).map(conversationSummary);
  }

  function listConversationMessages(conversation, before, limit) {
    const messages = conversation.messages || [];
    let eligible = messages;
    if (before) {
      const cursorIndex = messages.findIndex((message) => message.id === before);
      if (cursorIndex >= 0) eligible = messages.slice(0, cursorIndex);
      else {
        const beforeTimestamp = Number(before);
        if (Number.isFinite(beforeTimestamp) && beforeTimestamp > 0) eligible = messages.filter((message) => message.createdAt < beforeTimestamp);
      }
    }
    const page = eligible.slice(-Math.max(1, Math.min(Number(limit) || MAX_MESSAGES_PER_PAGE, MAX_MESSAGES_PER_PAGE)));
    return {
      conversation: conversationSummary(conversation),
      messages: page.map(serializeMessage),
      hasMore: eligible.length > page.length,
      oldestMessageAt: page[0]?.createdAt || 0,
      oldestMessageCursor: page[0]?.id || '',
    };
  }

  function createOutboundMessage(conversation, { text, type = 'text' }) {
    const message = {
      id: crypto.randomUUID(),
      waMessageId: '',
      direction: 'outbound',
      type,
      text,
      media: null,
      createdAt: clock(),
      status: 'pending',
      statusAt: 0,
      error: '',
    };
    addMessage(conversation, message);
    persist();
    emitToAdmins('whatsapp:message', {
      waId: conversation.waId,
      message: serializeMessage(message),
      conversation: conversationSummary(conversation),
    });
    emitConversation(conversation);
    return message;
  }

  async function sendCloudMessage(conversation, message, payload) {
    try {
      const response = await callMeta('messages', payload, 'message');
      const waMessageId = asString(response?.messages?.[0]?.id, 200);
      if (!waMessageId) throw new Error('Meta response did not contain a WhatsApp message id.');
      message.waMessageId = waMessageId;
      message.status = 'sent';
      message.statusAt = clock();
      messagesByWaId.set(waMessageId, { waId: conversation.waId, message });
      applyDeferredStatus(waMessageId, message);
    } catch (error) {
      message.status = 'failed';
      message.statusAt = clock();
      message.error = error.userMessage || (error.notConfigured ? 'WhatsApp Cloud API is not configured on the server.' : metaFailureMessage(error, 'message'));
    }
    persist();
    const serialized = serializeMessage(message);
    emitToAdmins('whatsapp:message', { waId: conversation.waId, message: serialized, conversation: conversationSummary(conversation) });
    emitConversation(conversation);
    return serialized;
  }

  app.get('/api/whatsapp/webhook', (req, res) => {
    if (!config.verifyToken || !config.appSecret) return res.status(503).send('Webhook is not configured.');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && typeof token === 'string' && equalText(token, config.verifyToken) && typeof challenge === 'string') {
      return res.status(200).type('text/plain').send(challenge.slice(0, 300));
    }
    return res.sendStatus(403);
  });

  app.post('/api/whatsapp/webhook', (req, res) => {
    if (!webhookConfigured()) return res.status(503).send('Webhook is not configured.');
    if (!signatureIsValid(req)) return res.sendStatus(401);
    try {
      processWebhook(req.body);
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('WhatsApp webhook processing error:', asString(error?.message, 200));
      return res.sendStatus(500);
    }
  });

  app.post('/api/admin/whatsapp/login', noStore, (req, res) => {
    if (!sameOrigin(req)) return jsonError(res, 403, 'origin');
    if (!adminConfigured()) return jsonError(res, 503, 'admin_not_configured');
    const ip = asString(req.ip || req.socket?.remoteAddress || 'unknown', 100);
    const attempt = loginAttempts.get(ip) || { count: 0, resetAt: clock() + LOGIN_WINDOW_MS };
    if (attempt.resetAt <= clock()) {
      attempt.count = 0;
      attempt.resetAt = clock() + LOGIN_WINDOW_MS;
    }
    if (attempt.count >= MAX_LOGIN_FAILURES) {
      loginAttempts.set(ip, attempt);
      return jsonError(res, 429, 'too_many_attempts');
    }
    const username = asString(req.body?.username, 120).trim();
    const password = String(req.body?.password || '').slice(0, 512);
    if (!equalText(username.toLowerCase(), config.adminUsername.toLowerCase()) || !equalText(password, config.adminPassword)) {
      attempt.count += 1;
      loginAttempts.set(ip, attempt);
      return jsonError(res, 401, 'invalid_credentials');
    }
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    const csrfToken = crypto.randomBytes(32).toString('base64url');
    const sessionHash = hash(token);
    const expiresAt = clock() + SESSION_TTL_MS;
    sessions.set(sessionHash, {
      username: config.adminUsername,
      csrfToken,
      expiresAt,
      createdAt: clock(),
    });
    const cookieParts = [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    ];
    if (config.secureCookies) cookieParts.push('Secure');
    res.set('Set-Cookie', cookieParts.join('; '));
    return res.json({ ok: true, csrfToken, admin: { username: config.adminUsername } });
  });

  app.get('/api/admin/whatsapp/session', noStore, requireAdmin, (req, res) => {
    return res.json({
      ok: true,
      csrfToken: req.whatsappAdmin.csrfToken,
      admin: { username: req.whatsappAdmin.username },
      config: {
        messagingReady: apiConfigured(),
        webhookReady: webhookConfigured(),
        callingEnabled: callingConfigured(),
        displayNumber: config.displayNumber,
        iceServers: callingConfigured() ? config.iceServers : [],
      },
    });
  });

  app.post('/api/admin/whatsapp/logout', noStore, requireAdmin, requireCsrf, (req, res) => {
    const sessionHash = req.whatsappAdmin.sessionHash;
    sessions.delete(sessionHash);
    for (const socket of adminNamespace.sockets.values()) {
      if (socket.data.whatsappAdminHash === sessionHash) socket.disconnect(true);
    }
    const cookieParts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
    if (config.secureCookies) cookieParts.push('Secure');
    res.set('Set-Cookie', cookieParts.join('; '));
    return res.json({ ok: true });
  });

  app.get('/api/admin/whatsapp/conversations', noStore, requireAdmin, (req, res) => {
    return res.json({ ok: true, conversations: listConversations(req.query.q, req.query.limit) });
  });

  app.get('/api/admin/whatsapp/conversations/:waId', noStore, requireAdmin, (req, res) => {
    const waId = String(req.params.waId || '');
    if (!validWaId(waId)) return jsonError(res, 400, 'invalid_customer');
    const conversation = database.conversations[waId];
    if (!conversation) return jsonError(res, 404, 'not_found');
    const beforeValue = Number(req.query.before);
    const before = Number.isFinite(beforeValue) && beforeValue > 0 ? beforeValue : 0;
    return res.json({ ok: true, ...listConversationMessages(conversation, before, req.query.limit) });
  });

  app.post('/api/admin/whatsapp/conversations/:waId/read', noStore, requireAdmin, requireCsrf, (req, res) => {
    const waId = String(req.params.waId || '');
    if (!validWaId(waId)) return jsonError(res, 400, 'invalid_customer');
    const conversation = database.conversations[waId];
    if (!conversation) return jsonError(res, 404, 'not_found');
    conversation.unreadCount = 0;
    persist();
    emitConversation(conversation);
    return res.json({ ok: true, conversation: conversationSummary(conversation) });
  });

  app.post('/api/admin/whatsapp/conversations/:waId/messages', noStore, requireAdmin, requireCsrf, async (req, res) => {
    const waId = String(req.params.waId || '');
    const text = String(req.body?.text || '').trim();
    if (!validWaId(waId)) return jsonError(res, 400, 'invalid_customer');
    if (!text || text.length > 4096) return jsonError(res, 400, 'invalid_message');
    const conversation = database.conversations[waId];
    if (!conversation) return jsonError(res, 404, 'not_found');
    const message = createOutboundMessage(conversation, { text, type: 'text' });
    const sent = await sendCloudMessage(conversation, message, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'text',
      text: { preview_url: false, body: text },
    });
    return res.json({ ok: true, message: sent });
  });

  app.get('/api/admin/whatsapp/conversations/:waId/call-permission', noStore, requireAdmin, async (req, res) => {
    if (!callingConfigured()) return jsonError(res, 503, 'calling_not_enabled');
    const waId = String(req.params.waId || '');
    if (!validWaId(waId) || !database.conversations[waId]) return jsonError(res, 404, 'not_found');
    try {
      const result = await callMeta('call_permissions', { user_wa_id: waId }, 'call', 'GET');
      return res.json({ ok: true, permission: normalizedCallPermission(result) });
    } catch (error) {
      return jsonError(res, error.notConfigured ? 503 : 502, 'call_permission_check_failed', {
        message: error.userMessage || metaFailureMessage(error, 'call'),
      });
    }
  });

  app.post('/api/admin/whatsapp/conversations/:waId/call-permission', noStore, requireAdmin, requireCsrf, async (req, res) => {
    if (!callingConfigured()) return jsonError(res, 503, 'calling_not_enabled');
    const waId = String(req.params.waId || '');
    const conversation = database.conversations[waId];
    if (!validWaId(waId) || !conversation) return jsonError(res, 404, 'not_found');
    const text = String(req.body?.text || 'We would like to call you on WhatsApp to help with your request.').trim().slice(0, 280);
    const message = createOutboundMessage(conversation, { text, type: 'call_permission_request' });
    const sent = await sendCloudMessage(conversation, message, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        action: { name: 'call_permission_request' },
        body: { text },
      },
    });
    return res.json({ ok: true, message: sent });
  });

  app.get('/api/admin/whatsapp/calls', noStore, requireAdmin, (_req, res) => {
    const calls = database.calls.filter((call) => ACTIVE_CALL_STATES.has(call.status) || clock() - Number(call.updatedAt || call.createdAt) < 24 * 60 * 60 * 1000);
    return res.json({ ok: true, calls: calls.slice(-100).reverse().map(serializeCall) });
  });

  app.post('/api/admin/whatsapp/calls', noStore, requireAdmin, requireCsrf, async (req, res) => {
    if (!callingConfigured()) return jsonError(res, 503, 'calling_not_enabled');
    const waId = String(req.body?.waId || '');
    const sdp = String(req.body?.sdp || '');
    const conversation = database.conversations[waId];
    if (!validWaId(waId) || !conversation) return jsonError(res, 404, 'not_found');
    if (!sdp || sdp.length > MAX_SDP_LENGTH || !/^v=0(?:\r?\n)/m.test(sdp) || !/^m=audio\s/m.test(sdp)) return jsonError(res, 400, 'invalid_call_sdp');
    try {
      const opaqueCallbackData = crypto.randomBytes(16).toString('hex');
      const body = {
        messaging_product: 'whatsapp',
        to: waId,
        action: 'connect',
        session: { sdp_type: 'offer', sdp },
        biz_opaque_callback_data: opaqueCallbackData,
      };
      const response = await callMeta('calls', body, 'call');
      const id = callIdFrom(response?.calls?.[0]?.id);
      if (!id) return jsonError(res, 502, 'call_id_missing');
      let call = findCall(id) || findCall(opaqueCallbackData);
      if (!call) {
        call = {
          id,
          waId,
          customerName: safeName(conversation.name),
          direction: 'outbound',
          status: 'ringing',
          createdAt: clock(),
          updatedAt: clock(),
          opaqueCallbackData,
          offerSdp: sdp,
          answerSdp: '',
          error: '',
        };
        database.calls.push(call);
      } else {
        call.id = id;
        call.waId = waId;
        call.direction = 'outbound';
        call.status = call.answerSdp ? 'ringing' : call.status;
        call.opaqueCallbackData = opaqueCallbackData;
        call.offerSdp = sdp;
      }
      keepRecentCalls();
      persist();
      emitToAdmins('whatsapp:call-updated', serializeCall(call));
      return res.json({ ok: true, call: serializeCall(call) });
    } catch (error) {
      const message = error.userMessage || (error.notConfigured ? 'WhatsApp Cloud API is not configured on the server.' : metaFailureMessage(error, 'call'));
      return jsonError(res, error.notConfigured ? 503 : 502, 'call_failed', { message });
    }
  });

  app.post('/api/admin/whatsapp/calls/:callId/action', noStore, requireAdmin, requireCsrf, async (req, res) => {
    if (!callingConfigured()) return jsonError(res, 503, 'calling_not_enabled');
    const id = callIdFrom(req.params.callId);
    const call = id && findCall(id);
    if (!call) return jsonError(res, 404, 'not_found');
    const action = String(req.body?.action || '').toLowerCase();
    const sdp = String(req.body?.sdp || '');
    if (!['pre_accept', 'accept', 'reject', 'terminate'].includes(action)) return jsonError(res, 400, 'invalid_call_action');
    if (call.direction === 'outbound' && action !== 'terminate') return jsonError(res, 400, 'invalid_call_action');
    if (call.direction === 'inbound' && action !== 'terminate' && !['pre_accept', 'accept', 'reject'].includes(action)) return jsonError(res, 400, 'invalid_call_action');
    if (['pre_accept', 'accept'].includes(action) && (!sdp || sdp.length > MAX_SDP_LENGTH || !/^v=0(?:\r?\n)/m.test(sdp) || !/^m=audio\s/m.test(sdp))) {
      return jsonError(res, 400, 'invalid_call_sdp');
    }
    const payload = { messaging_product: 'whatsapp', call_id: call.id, action };
    if (['pre_accept', 'accept'].includes(action)) payload.session = { sdp_type: 'answer', sdp };
    try {
      const result = await callMeta('calls', payload, 'call');
      call.updatedAt = clock();
      call.error = '';
      call.status = action === 'pre_accept' ? 'pre_accepting'
        : action === 'accept' ? 'connecting'
          : action === 'reject' ? 'rejected' : 'terminating';
      persist();
      emitToAdmins('whatsapp:call-updated', serializeCall(call));
      return res.json({ ok: true, result, call: serializeCall(call) });
    } catch (error) {
      call.error = error.userMessage || (error.notConfigured ? 'WhatsApp Cloud API is not configured on the server.' : metaFailureMessage(error, 'call'));
      call.updatedAt = clock();
      persist();
      emitToAdmins('whatsapp:call-updated', serializeCall(call));
      return jsonError(res, error.notConfigured ? 503 : 502, 'call_action_failed', { message: call.error });
    }
  });

  return {
    processWebhook,
    getDatabase: () => database,
    getConfig: () => ({
      messagingReady: apiConfigured(),
      webhookReady: webhookConfigured(),
      callingEnabled: callingConfigured(),
    }),
  };
}
