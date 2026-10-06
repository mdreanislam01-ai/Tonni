// Local harness: exercises src/callRecorder.js against stubbed browser APIs so
// the recording pipeline (canvas composite + audio mixing + MediaRecorder +
// device save + IndexedDB library) can be verified without a real browser.
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------
let objectUrlCount = 0;
const clickedDownloads = [];

class FakeTrack {
  constructor(kind, enabled = true) { this.kind = kind; this.enabled = enabled; this.readyState = 'live'; this.stopped = false; }
  stop() { this.stopped = true; this.readyState = 'ended'; }
}

class FakeMediaStream {
  constructor(tracks = []) { this.tracks = tracks; this.id = `stream-${Math.random().toString(36).slice(2)}`; }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
  getTracks() { return this.tracks; }
}

function makeCtx(canvas) {
  const noop = () => {};
  return {
    canvas,
    filter: 'none',
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    shadowColor: '', shadowBlur: 0, shadowOffsetY: 0, globalAlpha: 1,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, arc: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, drawImage: noop, fillText: noop,
    measureText: (text) => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
}

class FakeCanvas {
  constructor() { this.width = 300; this.height = 150; this.ctx = makeCtx(this); this.streams = 0; }
  getContext() { return this.ctx; }
  captureStream(fps) {
    this.streams += 1;
    this.fps = fps;
    return new FakeMediaStream([new FakeTrack('video')]);
  }
}

class FakeVideo {
  constructor() {
    this.readyState = 0; this.videoWidth = 0; this.videoHeight = 0;
    this.muted = false; this.playsInline = false; this.autoplay = false; this.preload = '';
    this._srcObject = null; this.playCalls = 0;
  }
  set srcObject(stream) {
    this._srcObject = stream;
    if (stream) { this.readyState = 4; this.videoWidth = 640; this.videoHeight = 480; }
    else { this.readyState = 0; this.videoWidth = 0; this.videoHeight = 0; }
  }
  get srcObject() { return this._srcObject; }
  setAttribute() {}
  play() { this.playCalls += 1; return Promise.resolve(); }
}

class FakeElement {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.className = ''; this.style = {}; }
  appendChild(child) { this.children.push(child); return child; }
  remove() { this.removed = true; }
  setAttribute() {}
  click() { if (this.tagName === 'A') clickedDownloads.push({ href: this.href, download: this.download }); }
}

const documentStub = {
  body: new FakeElement('body'),
  createElement(tag) {
    if (tag === 'canvas') return new FakeCanvas();
    if (tag === 'video') return new FakeVideo();
    return new FakeElement(tag);
  },
};

class FakeMediaRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
    this.timer = null;
    FakeMediaRecorder.instances.push(this);
  }
  start(timeslice) {
    this.state = 'recording';
    this.timer = setInterval(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(4096)], { type: this.mimeType }) }), timeslice || 250);
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) });
  }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    clearInterval(this.timer);
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) });
    setTimeout(() => this.onstop?.(), 0);
  }
  static isTypeSupported(mime) { return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp8,opus', 'video/webm'].includes(mime); }
}
FakeMediaRecorder.instances = [];

class FakeGain { constructor() { this.gain = { value: 1 }; } connect() { return this; } }
class FakeAudioContext {
  constructor() { this.state = 'running'; this.closed = false; this.sources = 0; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createMediaStreamDestination() { this.destination = new FakeMediaStream([new FakeTrack('audio')]); return { stream: this.destination, connect() {} }; }
  createMediaStreamSource() { this.sources += 1; return { connect() {} }; }
  createGain() { return new FakeGain(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
}

// Minimal in-memory IndexedDB
function makeFakeIndexedDb() {
  const stores = new Map();
  const wrap = (result) => {
    const request = { result, onsuccess: null, onerror: null };
    setTimeout(() => request.onsuccess?.(), 0);
    return request;
  };
  return {
    open(name, version) {
      const request = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      const db = {
        objectStoreNames: { contains: (store) => stores.has(store) },
        createObjectStore: (store) => { stores.set(store, new Map()); return {}; },
        transaction(store) {
          const data = stores.get(store) || new Map();
          const api = {
            getAll: () => wrap([...data.values()]),
            get: (key) => wrap(data.get(key)),
            put: (value) => { data.set(value.id, structuredClone(value)); return wrap(value.id); },
            delete: (key) => { data.delete(key); return wrap(undefined); },
          };
          const tx = { objectStore: () => api, oncomplete: null, onerror: null, onabort: null, error: null };
          setTimeout(() => tx.oncomplete?.(), 5);
          return tx;
        },
        close() {},
      };
      setTimeout(() => { request.result = db; request.onupgradeneeded?.(); request.onsuccess?.(); }, 0);
      return request;
    },
  };
}

class FakeWorker {
  constructor() { throw new Error('Worker unavailable in harness'); }
}

globalThis.window = globalThis;
globalThis.document = documentStub;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131 Mobile Safari/537.36', maxTouchPoints: 5 },
});
globalThis.MediaRecorder = FakeMediaRecorder;
globalThis.MediaStream = FakeMediaStream;
globalThis.AudioContext = FakeAudioContext;
globalThis.Worker = FakeWorker;
globalThis.indexedDB = makeFakeIndexedDb();
globalThis.URL.createObjectURL = () => `blob:fake/${++objectUrlCount}`;
globalThis.URL.revokeObjectURL = () => {};
globalThis.structuredClone = (value) => ({ ...value });

const {
  callRecordingSupported,
  pickRecordingFormat,
  formatRecordingFilename,
  formatClock,
  startCallScreenRecording,
  saveRecordingToDevice,
  addRecordingToLibrary,
  listRecordings,
  getRecordingBlob,
  markRecordingSaved,
  removeRecordingFromLibrary,
} = await import('../src/callRecorder.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

assert.equal(callRecordingSupported(), true, 'recording should be supported with stubs');
assert.deepEqual(pickRecordingFormat(), { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' });
assert.equal(formatClock(65), '01:05');
assert.equal(formatClock(3725), '1:02:05');
assert.match(formatRecordingFilename({ peerName: 'Rafiul Islam!', createdAt: Date.UTC(2026, 9, 6, 10, 5, 9), ext: 'webm' }), /^YouAndMe-Rafiul-Islam-\d{8}-\d{6}\.webm$/);

const remoteStream = new FakeMediaStream([new FakeTrack('video'), new FakeTrack('audio')]);
const localStream = new FakeMediaStream([new FakeTrack('video'), new FakeTrack('audio')]);
let sources = { main: remoteStream, pip: localStream, mainOff: false, pipOff: false, audio: [remoteStream, localStream] };
let sourceReads = 0;

const session = await startCallScreenRecording({
  getSources: () => { sourceReads += 1; return sources; },
  peerName: 'Tonni',
  selfName: 'Me',
});

await wait(900);
assert.ok(sourceReads > 2, `draw loop should run repeatedly (got ${sourceReads})`);

// Camera off + screen share swap mid-recording must not break the loop.
const screenStream = new FakeMediaStream([new FakeTrack('video')]);
sources = { main: remoteStream, pip: screenStream, mainOff: false, pipOff: false, audio: [remoteStream, localStream] };
await wait(400);
sources = { main: remoteStream, pip: localStream, mainOff: false, pipOff: true, audio: [remoteStream, localStream] };
await wait(400);

// No video at all (audio-only call) still produces frames.
sources = { main: null, pip: null, mainOff: false, pipOff: false, audio: [localStream] };
await wait(400);

assert.ok(session.seconds() >= 1, 'session should count seconds');
assert.equal(session.isActive(), true);

const result = await session.stop();
assert.ok(result, 'stop should return a result');
assert.ok(result.blob.size > 0, `blob should not be empty (got ${result.blob.size})`);
assert.equal(result.ext, 'mp4', 'prefers mp4 for phone galleries');
assert.equal(result.width, 854, 'mobile canvas width');
assert.equal(result.height, 480, 'mobile canvas height');
assert.ok(result.durationMs >= 1500);

const recorder = FakeMediaRecorder.instances.at(-1);
assert.equal(recorder.state, 'inactive');
assert.ok(recorder.stream.getAudioTracks().length === 1, 'composite should carry mixed audio');

// Stopping twice is safe.
assert.equal(await session.stop(), null);

// Saving to the device falls back to an anchor download on mobile.
const saved = await saveRecordingToDevice({ blob: result.blob, filename: 'test.webm', mime: result.mimeType });
assert.equal(saved.method, 'download');
assert.equal(clickedDownloads.length, 1);
assert.equal(clickedDownloads[0].download, 'test.webm');
assert.ok(clickedDownloads[0].href.startsWith('blob:'));

// Library round-trip.
const entry = {
  id: 'rec-1', peerName: 'Tonni', peerId: 'YM-ABC123', createdAt: Date.now(),
  durationMs: result.durationMs, size: result.blob.size, mime: result.mimeType,
  ext: result.ext, width: result.width, height: result.height, blob: result.blob, savedToDevice: false,
};
assert.equal(await addRecordingToLibrary(entry), true);
let items = await listRecordings();
assert.equal(items.length, 1);
assert.equal(items[0].peerName, 'Tonni');
assert.equal(items[0].blob, undefined, 'list should not return blobs');
assert.ok(await getRecordingBlob('rec-1'));
assert.equal(await markRecordingSaved('rec-1'), true);
items = await listRecordings();
assert.equal(items[0].savedToDevice, true);
assert.equal(await removeRecordingFromLibrary('rec-1'), true);
items = await listRecordings();
assert.equal(items.length, 0);

console.log('✅ callRecorder harness passed');
console.log(`   blob: ${result.blob.size} bytes ${result.mimeType} · ${result.width}x${result.height} · ${result.durationMs}ms · frames drawn: ${sourceReads}`);
process.exit(0);
