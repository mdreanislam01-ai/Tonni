// Exercise the service-worker push and notification-click flow without a browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const handlers = new Map();
const notifications = [];
let focusedWindows = [];
let openedUrl = '';
const registration = {
  async getNotifications() { return []; },
  async showNotification(title, options) {
    notifications.push({ title, options });
  },
};
const clients = {
  async matchAll() { return focusedWindows; },
  async openWindow(url) { openedUrl = url; return null; },
};
const self = {
  addEventListener(type, handler) { handlers.set(type, handler); },
  skipWaiting() { return Promise.resolve(); },
  clients,
  registration,
  location: { origin: 'https://you-and-me.example' },
};

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
vm.runInNewContext(source, { self, URL, Date, encodeURIComponent, console });

async function push(payload) {
  const waits = [];
  handlers.get('push')({
    data: { json: () => payload },
    waitUntil(promise) { waits.push(promise); },
  });
  await Promise.all(waits);
}

async function click(notificationData, action = '') {
  let closed = false;
  const waits = [];
  handlers.get('notificationclick')({
    action,
    notification: { data: notificationData, close() { closed = true; } },
    waitUntil(promise) { waits.push(promise); },
  });
  await Promise.all(waits);
  assert.equal(closed, true, 'clicked notification should be dismissed');
}

await push({
  type: 'message',
  fromId: 'YM-ABC123',
  fromName: 'Tonni',
  text: 'Are you free to talk?',
});
assert.equal(notifications.length, 1, 'background message creates one OS notification');
assert.equal(notifications[0].title, 'Tonni');
assert.match(notifications[0].options.data.url, /to=YM-ABC123&quickChat=1/);
assert.match(notifications[0].options.data.fullUrl, /to=YM-ABC123/);
assert.deepEqual(
  JSON.parse(JSON.stringify(notifications[0].options.actions.map(({ action }) => action))),
  ['reply', 'open'],
  'message notification offers a quick reply entry and full app action',
);

await click(notifications[0].options.data, 'reply');
assert.match(openedUrl, /to=YM-ABC123&quickChat=1/, 'Reply opens the focused quick-chat composer');

await click(notifications[0].options.data, 'open');
assert.match(openedUrl, /to=YM-ABC123/);
assert.doesNotMatch(openedUrl, /quickChat=1/, 'Open app uses the full app route');

const beforeFocusedPush = notifications.length;
focusedWindows = [{ visibilityState: 'visible', focused: true }];
await push({ type: 'message', fromId: 'YM-ABC123', fromName: 'Tonni', text: 'No duplicate alert' });
assert.equal(notifications.length, beforeFocusedPush, 'focused app suppresses duplicate system alerts');

console.log('✅ background chat push and notification-action tests passed');
