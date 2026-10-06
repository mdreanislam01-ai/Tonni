// SSR smoke test: renders the call UI pieces with React's server renderer to
// catch undefined identifiers, bad icon imports, or broken JSX that a plain
// `vite build` would happily ship.
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import assert from 'node:assert/strict';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const mod = await vite.ssrLoadModule('/src/App.jsx');
const { CallOverlay, RecordingsDialog, RecordingSavedCard, CallsWorkspace } = mod;
const t = new Proxy({}, { get: (_target, key) => String(key) });
const noop = () => {};

const baseCall = {
  callId: 'c1', peerId: 'YM-ABC123', peerName: 'Tonni', peerAvatar: '', kind: 'video',
  direction: 'outgoing', status: 'active', muted: false, videoOff: false, speakerOn: true,
  keypadOpen: false, screenSharing: false, screenRecording: true, cameraFacing: 'user',
  localStream: null, remoteStream: null, startedAt: Date.now(),
};

// 1. Video call, recording active.
let html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: baseCall, t, language: 'en', onAccept: noop, onDecline: noop, onEnd: noop,
  onMute: noop, onVideo: noop, onSpeaker: noop, onKeypad: noop, onDigit: noop,
  onScreenShare: noop, onSwitchCamera: noop, onRecordScreen: noop,
  screenRecording: true, screenRecordingSeconds: 75,
}));
assert.match(html, /call-recording-badge/, 'REC badge should render while recording');
assert.match(html, /01:15/, 'badge should show the recording clock');
assert.match(html, /record-control-active/, 'record button should show the active state');
assert.match(html, /stopRecording/, 'active label should come from t.stopRecording');
assert.match(html, /screen-sharing|Share/i, 'screen share control still present');

// 2. Audio call gets the record control too.
html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, kind: 'audio', screenRecording: false }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
}));
assert.match(html, /record-control/, 'audio calls should expose recording');
assert.doesNotMatch(html, /call-recording-badge/, 'no badge when not recording');

// 3. Ringing call shows answer/decline only.
html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, status: 'ringing', direction: 'incoming' }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
}));
assert.doesNotMatch(html, /record-control/, 'ringing state must not offer recording yet');

// 4. Recordings dialog with items and empty.
const items = [{
  id: 'rec-1', peerName: 'Tonni', peerId: 'YM-ABC123', createdAt: Date.now() - 3600_000,
  durationMs: 95_000, size: 4_800_000, mime: 'video/mp4', ext: 'mp4', savedToDevice: true,
}];
html = renderToStaticMarkup(React.createElement(RecordingsDialog, {
  t, language: 'en', recordings: items, canShare: true, onClose: noop, onSave: noop,
  onShare: noop, onDelete: noop, onOpenPeer: noop,
}));
assert.match(html, /recording-card/, 'recording row should render');
assert.match(html, /Tonni/, 'peer name should render');
assert.match(html, /4\.6 MB/, 'size should be formatted in MB');
assert.match(html, /01:35/, 'duration should be formatted');
assert.match(html, /MP4/, 'container should be shown');
assert.match(html, /recording-delete/, 'delete control should render');

html = renderToStaticMarkup(React.createElement(RecordingsDialog, {
  t, language: 'bn', recordings: [], canShare: false, onClose: noop, onSave: noop,
  onShare: noop, onDelete: noop, onOpenPeer: noop,
}));
assert.match(html, /recordings-empty/, 'empty state should render');

// 5. Saved-recording card.
html = renderToStaticMarkup(React.createElement(RecordingSavedCard, {
  t, item: { ...items[0], filename: 'YouAndMe-Tonni.mp4', saved: true }, busy: false,
  canShare: true, onSave: noop, onShare: noop, onViewAll: noop, onClose: noop,
}));
assert.match(html, /recording-saved-card/, 'saved card should render');
assert.match(html, /saveToFiles/, 'save action should render');

// 6. Calls page exposes the recordings entry point.
html = renderToStaticMarkup(React.createElement(CallsWorkspace, {
  calls: [{ id: 'c1', peerId: 'YM-ABC123', peerName: 'Tonni', kind: 'video', direction: 'outgoing', status: 'completed', at: Date.now() }],
  recordings: items, t, language: 'en', onOpenPeer: noop, onNewChat: noop, onOpenRecordings: noop, onBack: noop,
}));
assert.match(html, /recordings-strip/, 'calls page should advertise recordings');

await vite.close();
console.log('✅ UI smoke test passed (call overlay, recordings dialog, saved card, calls page)');
process.exit(0);
