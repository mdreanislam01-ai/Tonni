// SSR smoke test: renders the call UI pieces with React's server renderer to
// catch undefined identifiers, bad icon imports, or broken JSX that a plain
// `vite build` would happily ship.
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import assert from 'node:assert/strict';

const vite = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
const mod = await vite.ssrLoadModule('/src/App.jsx');
const { CallOverlay, RecordingsDialog, RecordingSavedCard, CallsWorkspace, MessengerChatPanel } = mod;
const t = new Proxy({}, { get: (_target, key) => String(key) });
const noop = () => {};
const controlsMarkup = (markup) => markup.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
const headerMarkup = (markup) => markup.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0] || '';
const controlLabels = (markup) => [...controlsMarkup(markup).matchAll(/<span>([^<]*)<\/span><\/button>/g)].map((match) => match[1]);

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
assert.match(html, /stopRecording/, 'recording badge should retain its stop hint');
assert.match(controlsMarkup(html), /video-call-controls/, 'video controls should use the compact layout');
assert.match(headerMarkup(html), /call-more-trigger/, 'More should move to the call header');
assert.match(headerMarkup(html), /aria-haspopup="menu"/, 'More should announce its popup');
assert.match(headerMarkup(html), /aria-expanded="false"/, 'More should start collapsed');
assert.doesNotMatch(controlsMarkup(html), /call-more/, 'More must not render in the bottom controls');
assert.deepEqual(controlLabels(html), ['mute', 'cameraOff', 'switchCamera', 'endCall'], 'video controls should keep their requested order');
assert.equal((controlsMarkup(html).match(/<button\b/g) || []).length, 4, 'only the three primary controls and End call should render');
assert.doesNotMatch(headerMarkup(html), /call-more-menu|screenShare|recordScreen|stopRecording/, 'share and recording actions must stay hidden even while recording');
assert.doesNotMatch(controlsMarkup(html), /call-more-menu|record-control|screenShare|recordScreen|stopRecording/, 'share and recording actions must stay out of the bottom controls');

// Share/record actions also stay hidden before opening More in other outgoing states.
for (const status of ['ringing', 'connecting', 'active']) {
  html = renderToStaticMarkup(React.createElement(CallOverlay, {
    call: { ...baseCall, status, screenSharing: true, muted: true, videoOff: true }, t, language: 'en',
    onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
    onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
    onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
  }));
  assert.deepEqual(controlLabels(html), ['unmute', 'cameraOn', 'switchCamera', 'endCall'], `${status}: primary toggle labels should remain intact`);
  assert.doesNotMatch(headerMarkup(html), /call-more-menu|screenShare|recordScreen|stopScreenShare/, `${status}: menu actions should not render until opened`);
  assert.doesNotMatch(controlsMarkup(html), /call-more/, `${status}: More must stay out of the bottom controls`);
  assert.match(html, /screen-sharing-indicator/, 'existing sharing status should remain visible');
  assert.doesNotMatch(html, /call-recording-badge/, 'recording badge should stay hidden when not recording');
}

// 2. Audio call gets the very same header menu as a video call.
html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, kind: 'audio', screenRecording: false }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
}));
assert.match(headerMarkup(html), /call-more-trigger/, 'audio calls should expose the More menu in the header');
assert.match(headerMarkup(html), /aria-haspopup="menu"/, 'audio More should announce its popup');
assert.match(headerMarkup(html), /aria-expanded="false"/, 'audio More should start collapsed');
assert.doesNotMatch(html, /record-control/, 'recording belongs to the menu, not the bottom row');
assert.doesNotMatch(controlsMarkup(html), /call-more/, 'More must not render in the bottom controls');
assert.deepEqual(controlLabels(html), ['mute', 'keypad', 'speaker', 'endCall'], 'audio calls keep mute, keypad, speaker and end call');
assert.doesNotMatch(html, /call-recording-badge/, 'no badge when not recording');
assert.doesNotMatch(headerMarkup(html), /call-more-menu|screenShare|recordScreen|stopRecording/, 'audio menu actions stay hidden until opened');
assert.doesNotMatch(html, /video-call-overlay/, 'a plain audio call keeps its compact window');

// 2b. Recording an audio call still shows the live badge.
html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, kind: 'audio', screenRecording: true }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: true, screenRecordingSeconds: 45,
}));
assert.match(html, /call-recording-badge/, 'audio recording should show the badge');
assert.match(html, /00:45/, 'audio recording badge should show the clock');

// 2c. A screen shared on an audio call fills the stage for both sides.
const fakeStream = { getVideoTracks: () => [], getAudioTracks: () => [] };
html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, kind: 'audio', remoteVideo: true, remoteStream: fakeStream }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
}));
assert.match(html, /remote-video-screen/, 'the peer screen should fill the audio call stage');
assert.match(html, /is sharing their screen/, 'the audio call should name who is sharing');
assert.match(html, /video-call-overlay/, 'the window should widen for the shared screen');
assert.doesNotMatch(html, /call-portrait/, 'the avatar should step aside for the picture');

html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, kind: 'audio', screenSharing: true, screenStream: fakeStream }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
}));
assert.match(html, /remote-video-screen/, 'your own shared screen should preview on the stage');
assert.match(html, /screen-sharing-indicator/, 'the sharing indicator should stay visible');
assert.match(html, /sharingNow/, 'the indicator should say you are sharing');

// 3. Ringing call shows answer/decline only.
html = renderToStaticMarkup(React.createElement(CallOverlay, {
  call: { ...baseCall, status: 'ringing', direction: 'incoming' }, t, language: 'en',
  onAccept: noop, onDecline: noop, onEnd: noop, onMute: noop, onVideo: noop, onSpeaker: noop,
  onKeypad: noop, onDigit: noop, onScreenShare: noop, onSwitchCamera: noop,
  onRecordScreen: noop, screenRecording: false, screenRecordingSeconds: 0,
}));
assert.doesNotMatch(html, /record-control|call-more-options|video-call-controls/, 'incoming ringing controls must not change');
assert.deepEqual(controlLabels(html), ['decline', 'answer'], 'incoming calls should still show only answer/decline');

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

// 7. Messenger-style floating/quick chat surface for chat-head and push entry.
html = renderToStaticMarkup(React.createElement(MessengerChatPanel, {
  chat: { id: 'YM-ABC123', peerId: 'YM-ABC123', name: 'Tonni', avatar: '', kind: 'direct' },
  identity: { id: 'YM-DEF456' },
  messages: [{ id: 'm1', fromId: 'YM-ABC123', text: 'Are you free to talk?', type: 'text', createdAt: Date.now(), status: 'delivered' }],
  isOnline: true, typing: false, t, language: 'en', onClose: noop, onOpenFull: noop, onSend: noop,
}));
assert.match(html, /messenger-chat-window/, 'compact chat surface should render');
assert.match(html, /Tonni/, 'peer name should render in the chat header');
assert.match(html, /Are you free to talk\?/, 'chat history should render');
assert.match(html, /aria-label="send"/, 'quick chat should expose a send control');

await vite.close();
console.log('✅ UI smoke test passed (call overlay, recordings, calls page, quick chat panel)');
process.exit(0);
