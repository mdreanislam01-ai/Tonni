import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { io as socketClient } from 'socket.io-client';
import { createWhatsappIntegration } from '../server/whatsapp.js';

const appSecret = 'unit-test-meta-app-secret';
const verifyToken = 'unit-test-verify-token';
const accessToken = 'unit-test-access-token-not-for-browser';
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tonni-whatsapp-test-'));
const storagePath = path.join(dataDirectory, 'whatsapp-inbox.json');
const app = express();
const httpServer = http.createServer(app);
const ioServer = new SocketServer(httpServer, { cors: { origin: true, credentials: true } });
const graphRequests = [];
let graphMessageId = 0;
const integrationEnv = {
  NODE_ENV: 'test',
  WHATSAPP_ACCESS_TOKEN: accessToken,
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_BUSINESS_ACCOUNT_ID: '987654321098765',
  WHATSAPP_APP_SECRET: appSecret,
  WHATSAPP_VERIFY_TOKEN: verifyToken,
  WHATSAPP_ADMIN_USERNAME: 'tonni-admin',
  WHATSAPP_ADMIN_PASSWORD: 'a-secure-test-password-123',
  WHATSAPP_GRAPH_API_VERSION: 'v26.0',
  WHATSAPP_DISPLAY_PHONE_NUMBER: '+8801890047742',
  WHATSAPP_CALLING_ENABLED: 'true',
};

app.use(express.json({
  limit: '3mb',
  verify(req, _res, buffer) {
    if (req.originalUrl?.startsWith('/api/whatsapp/webhook')) req.rawBody = Buffer.from(buffer);
  },
}));

createWhatsappIntegration({
  app,
  io: ioServer,
  storagePath,
  env: integrationEnv,
  fetchImpl: async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    graphRequests.push({ url, options, body });
    if (url.includes('/123456789012345?fields=display_phone_number')) {
      return new Response(JSON.stringify({ id: '123456789012345', display_phone_number: '+8801890047742' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/call_permissions?')) {
      return new Response(JSON.stringify({ messaging_product: 'whatsapp', permission: { status: 'granted', expiration_time: 1900000000 }, actions: [{ action_name: 'start_call', can_perform_action: true }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/messages') && body.type === 'text' && body.text.body === 'outside the window') {
      return new Response(JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/messages')) {
      graphMessageId += 1;
      return new Response(JSON.stringify({ messages: [{ id: `wamid.outgoing-${graphMessageId}` }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/calls') && body.action === 'connect') {
      return new Response(JSON.stringify({ calls: [{ id: 'wacid.outgoing-call-1' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});

await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
const cleanup = async () => {
  ioServer.close();
  await new Promise((resolve) => httpServer.close(resolve));
  fs.rmSync(dataDirectory, { recursive: true, force: true });
};

try {
  // Admin APIs and their dedicated Socket.IO namespace fail closed without a session.
  const privateResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations`);
  assert.equal(privateResponse.status, 401);
  assert.deepEqual(await privateResponse.json(), { ok: false, error: 'unauthorized' });
  const unauthenticatedSocket = socketClient(`${baseUrl}/admin-whatsapp`, { forceNew: true, reconnection: false });
  const unauthorizedError = new Promise((resolve) => unauthenticatedSocket.on('connect_error', resolve));
  const error = await unauthorizedError;
  assert.equal(error.message, 'unauthorized');
  unauthenticatedSocket.close();

  const loginResponse = await fetch(`${baseUrl}/api/admin/whatsapp/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'tonni-admin', password: integrationEnv.WHATSAPP_ADMIN_PASSWORD }),
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json();
  assert.equal(login.ok, true);
  assert.ok(login.csrfToken);
  const setCookie = loginResponse.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const sessionResponse = await fetch(`${baseUrl}/api/admin/whatsapp/session`, { headers: { Cookie: cookie } });
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  assert.equal(session.config.messagingReady, true);
  assert.equal(session.config.webhookReady, true);
  assert.equal(session.config.callingEnabled, true);
  assert.doesNotMatch(JSON.stringify(session), new RegExp(accessToken));
  assert.doesNotMatch(JSON.stringify(session), new RegExp(appSecret));

  const csrfDenied = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801890047742/read`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(csrfDenied.status, 403);
  const originDenied = await fetch(`${baseUrl}/api/admin/whatsapp/logout`, {
    method: 'POST', headers: { Cookie: cookie, Origin: 'https://attacker.example', 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: '{}',
  });
  assert.equal(originDenied.status, 403);

  const verified = await fetch(`${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=challenge-123`);
  assert.equal(verified.status, 200);
  assert.equal(await verified.text(), 'challenge-123');
  const rejectedVerification = await fetch(`${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123`);
  assert.equal(rejectedVerification.status, 403);

  const adminSocket = socketClient(`${baseUrl}/admin-whatsapp`, { forceNew: true, reconnection: false, extraHeaders: { Cookie: cookie } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Authenticated admin socket timed out.')), 2_000);
    adminSocket.once('connect', () => { clearTimeout(timer); resolve(); });
    adminSocket.once('connect_error', (socketError) => { clearTimeout(timer); reject(socketError); });
  });

  const sendWebhook = async (payload, signatureOverride) => {
    const rawBody = JSON.stringify(payload);
    const signature = signatureOverride || `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    return fetch(`${baseUrl}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body: rawBody,
    });
  };
  const incomingPayload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '987654321098765',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '+8801890047742', phone_number_id: '123456789012345' },
          contacts: [{ profile: { name: 'Nadia Customer' }, wa_id: '8801712345678', user_id: 'BD.user-123' }],
          messages: [{ from: '8801712345678', id: 'wamid.incoming-1', timestamp: '1758254145', type: 'text', text: { body: 'Hello Tonni!' } }],
        },
      }],
    }],
  };

  const badSignature = await sendWebhook(incomingPayload, 'sha256=' + '0'.repeat(64));
  assert.equal(badSignature.status, 401);
  let liveMessage;
  const liveMessageReceived = new Promise((resolve) => adminSocket.once('whatsapp:message', (payload) => { liveMessage = payload; resolve(); }));
  const incomingResponse = await sendWebhook(incomingPayload);
  assert.equal(incomingResponse.status, 200);
  await liveMessageReceived;
  assert.equal(liveMessage.conversation.name, 'Nadia Customer');
  assert.equal(liveMessage.conversation.phoneNumber, '+8801712345678');
  assert.equal(liveMessage.message.text, 'Hello Tonni!');

  const wrongDisplayNumberPayload = structuredClone(incomingPayload);
  wrongDisplayNumberPayload.entry[0].changes[0].value.metadata.display_phone_number = '+8801999999999';
  const wrongDisplayNumber = await sendWebhook(wrongDisplayNumberPayload);
  assert.equal(wrongDisplayNumber.status, 200);
  const otherBusinessNumberPayload = structuredClone(incomingPayload);
  otherBusinessNumberPayload.entry[0].changes[0].value.metadata.phone_number_id = '111111111111111';
  const otherBusinessNumber = await sendWebhook(otherBusinessNumberPayload);
  assert.equal(otherBusinessNumber.status, 200);

  const conversationsResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations?q=Nadia`, { headers: { Cookie: cookie } });
  const conversations = await conversationsResponse.json();
  assert.equal(conversations.conversations.length, 1);
  assert.equal(conversations.conversations[0].unreadCount, 1);
  assert.equal(conversations.conversations[0].phoneNumber, '+8801712345678');
  assert.equal(conversations.conversations[0].profilePictureUrl, '', 'do not invent customer pictures unavailable through Meta Cloud API');

  await sendWebhook(incomingPayload);
  const dedupedResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678`, { headers: { Cookie: cookie } });
  const deduped = await dedupedResponse.json();
  assert.equal(deduped.messages.length, 1, 'webhook retries must not duplicate a message');

  const readResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678/read`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: '{}',
  });
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).conversation.unreadCount, 0);

  const sentResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678/messages`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: JSON.stringify({ text: 'Thanks for messaging Tonni.' }),
  });
  const sent = await sentResponse.json();
  assert.equal(sentResponse.status, 200);
  assert.equal(sent.message.status, 'sent');
  assert.equal(sent.message.waMessageId, 'wamid.outgoing-1');
  const cloudSendRequest = graphRequests.find((request) => request.url.endsWith('/messages') && request.body.type === 'text' && request.body.text.body === 'Thanks for messaging Tonni.');
  assert.match(cloudSendRequest.url, /graph\.facebook\.com\/v26\.0\/123456789012345\/messages$/);
  assert.equal(cloudSendRequest.options.headers.Authorization, `Bearer ${accessToken}`);

  const statusPayload = {
    object: 'whatsapp_business_account',
    entry: [{ id: '987654321098765', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: '123456789012345' },
      statuses: [{ id: 'wamid.outgoing-1', status: 'read', timestamp: '1758254150', recipient_id: '8801712345678' }],
    } }] }],
  };
  await sendWebhook(statusPayload);
  const afterStatus = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678`, { headers: { Cookie: cookie } });
  const afterStatusBody = await afterStatus.json();
  assert.equal(afterStatusBody.messages.at(-1).status, 'read');

  const failedResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678/messages`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: JSON.stringify({ text: 'outside the window' }),
  });
  const failed = await failedResponse.json();
  assert.equal(failed.message.status, 'failed');
  assert.match(failed.message.error, /24-hour/);

  const permissionResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678/call-permission`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: '{}',
  });
  assert.equal(permissionResponse.status, 200);
  assert.equal(graphRequests.at(-1).body.interactive.type, 'call_permission_request');

  const permissionCheck = await fetch(`${baseUrl}/api/admin/whatsapp/conversations/8801712345678/call-permission`, { headers: { Cookie: cookie } });
  assert.equal(permissionCheck.status, 200);
  assert.equal((await permissionCheck.json()).permission.status, 'granted');

  const offerSdp = 'v=0\r\nm=audio 9 RTP/AVP 0\r\n';
  const outboundCallResponse = await fetch(`${baseUrl}/api/admin/whatsapp/calls`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: JSON.stringify({ waId: '8801712345678', sdp: offerSdp }),
  });
  const outboundCall = await outboundCallResponse.json();
  assert.equal(outboundCallResponse.status, 200);
  assert.equal(outboundCall.call.id, 'wacid.outgoing-call-1');
  assert.equal(graphRequests.at(-1).body.action, 'connect');
  assert.equal(graphRequests.at(-1).body.to, '8801712345678');
  assert.doesNotMatch(graphRequests.at(-1).url, /unit-test-access-token/);

  const outboundAnswer = 'v=0\r\nm=audio 9 RTP/AVP 0\r\n';
  const outgoingCallPayload = {
    object: 'whatsapp_business_account',
    entry: [{ id: '987654321098765', changes: [{ field: 'calls', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: '123456789012345', display_phone_number: '+8801890047742' },
      contacts: [{ profile: { name: 'Nadia Customer' }, wa_id: '8801712345678' }],
      calls: [{ id: 'wacid.outgoing-call-1', to: '8801712345678', direction: 'BUSINESS_INITIATED', event: 'connect', timestamp: '1758254160', session: { sdp_type: 'answer', sdp: outboundAnswer } }],
    } }] }],
  };
  await sendWebhook(outgoingCallPayload);
  const callsAfterAnswer = await fetch(`${baseUrl}/api/admin/whatsapp/calls`, { headers: { Cookie: cookie } });
  const callsList = await callsAfterAnswer.json();
  assert.equal(callsList.calls.find((call) => call.id === 'wacid.outgoing-call-1').answerSdp, outboundAnswer);

  const incomingCallPayload = {
    object: 'whatsapp_business_account',
    entry: [{ id: '987654321098765', changes: [{ field: 'calls', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: '123456789012345', display_phone_number: '+8801890047742' },
      contacts: [{ profile: { name: 'New caller' }, wa_id: '8801812345678' }],
      calls: [{ id: 'wacid.incoming-call-1', to: '8801812345678', from: '8801890047742', event: 'connect', timestamp: '1758254170', session: { sdp_type: 'offer', sdp: offerSdp } }],
    } }] }],
  };
  await sendWebhook(incomingCallPayload);
  const callsAfterIncoming = await fetch(`${baseUrl}/api/admin/whatsapp/calls`, { headers: { Cookie: cookie } });
  const incomingCall = (await callsAfterIncoming.json()).calls.find((call) => call.id === 'wacid.incoming-call-1');
  assert.equal(incomingCall.direction, 'inbound');
  assert.equal(incomingCall.status, 'incoming');
  assert.equal(incomingCall.offerSdp, offerSdp);

  const preAcceptResponse = await fetch(`${baseUrl}/api/admin/whatsapp/calls/wacid.incoming-call-1/action`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: JSON.stringify({ action: 'pre_accept', sdp: outboundAnswer }),
  });
  assert.equal(preAcceptResponse.status, 200);
  assert.equal(graphRequests.at(-1).body.action, 'pre_accept');

  const privateAfterLogout = await fetch(`${baseUrl}/api/admin/whatsapp/logout`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: '{}',
  });
  assert.equal(privateAfterLogout.status, 200);
  const expiredResponse = await fetch(`${baseUrl}/api/admin/whatsapp/conversations`, { headers: { Cookie: cookie } });
  assert.equal(expiredResponse.status, 401);

  adminSocket.close();
  console.log('✅ WhatsApp Cloud API inbox, webhook signatures, RBAC, message statuses, and official call signaling tests passed');
} finally {
  await cleanup();
}
