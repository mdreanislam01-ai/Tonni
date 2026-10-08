// You and Me — call screen recorder.
//
// The recorder composites the live call (the other person's video plus your own
// picture-in-picture tile) onto a canvas, mixes both sides of the audio with the
// Web Audio API, and feeds the result into MediaRecorder. The finished blob is
// written straight to the device (the phone's Download folder, or a folder the
// user picks on desktop), and a copy is kept in a small IndexedDB library so it
// can be replayed, re-saved, shared, or deleted later.
//
// Canvas capture is used instead of getDisplayMedia on purpose: mobile browsers
// (Android Chrome, iPhone Safari) do not expose screen capture, so this is the
// only way recording can work during a real phone call.

const FRAME_RATE_DESKTOP = 30;
const FRAME_RATE_MOBILE = 24;
const DESKTOP_SIZE = { width: 1280, height: 720 };
const MOBILE_SIZE = { width: 854, height: 480 };
const MAX_LIBRARY_ITEMS = 12;

const DB_NAME = 'you-and-me.recordings';
const DB_VERSION = 1;
const DB_STORE = 'recordings';

// MP4 first: phone galleries, WhatsApp and most players open it without extra
// codecs. WebM is the fallback on browsers that cannot mux MP4 (Firefox).
const VIDEO_FORMATS = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mime: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1.42E01E,opus', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mime: 'video/webm;codecs=h264,opus', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const agent = navigator.userAgent || '';
  if (/android|iphone|ipad|ipod|mobile/i.test(agent)) return true;
  return typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /macintosh/i.test(agent);
}

export function callRecordingSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof window.MediaRecorder === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return typeof canvas.captureStream === 'function';
  } catch {
    return false;
  }
}

export function pickRecordingFormat() {
  for (const candidate of VIDEO_FORMATS) {
    try {
      if (window.MediaRecorder?.isTypeSupported?.(candidate.mime)) return candidate;
    } catch {
      // Some browsers throw on odd mime strings; just try the next one.
    }
  }
  return { mime: '', ext: isMobileDevice() ? 'mp4' : 'webm' };
}

function extensionForMime(mime, fallback = 'webm') {
  if (!mime) return fallback;
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogv';
  return fallback;
}

export function formatRecordingFilename({ peerName = 'call', createdAt = Date.now(), ext = 'webm' } = {}) {
  const safeName = String(peerName || 'call').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'call';
  const date = new Date(createdAt);
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
  return `YouAndMe-${safeName}-${stamp}.${ext}`;
}

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(rest).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Recording session
// ---------------------------------------------------------------------------

function createHiddenVideo(layer) {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.autoplay = true;
  video.preload = 'auto';
  layer.appendChild(video);
  return video;
}

function attachStreamToVideo(video, stream) {
  if (video.srcObject === stream) return;
  if (!stream) {
    video.srcObject = null;
    return;
  }
  video.srcObject = stream;
  const played = video.play();
  if (played && typeof played.catch === 'function') played.catch(() => { /* Autoplay may need a moment; the next frame retries. */ });
}

function videoReady(video) {
  return Boolean(video && video.srcObject && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
}

function createTicker(intervalMs, onTick) {
  // A worker timer keeps recording at full frame rate when the tab is hidden or
  // the phone screen is locked to another app.
  try {
    const source = `let timer=null;onmessage=function(event){if(event.data==='start'){timer=setInterval(function(){postMessage(1);},${intervalMs});}else if(event.data==='stop'){if(timer){clearInterval(timer);timer=null;}}};`;
    const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = () => onTick();
    worker.onerror = () => { /* The fallback below already covers the frames. */ };
    worker.postMessage('start');
    let fallback = setInterval(onTick, intervalMs * 4);
    return () => {
      clearInterval(fallback);
      fallback = null;
      try { worker.postMessage('stop'); } catch { /* already gone */ }
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = setInterval(onTick, intervalMs);
    return () => clearInterval(id);
  }
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '✦';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCover(ctx, video, x, y, width, height) {
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  ctx.drawImage(video, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawContain(ctx, video, x, y, width, height) {
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  ctx.drawImage(video, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

/**
 * Start recording the call screen.
 *
 * @param {Object} options
 * @param {() => {main: MediaStream|null, pip: MediaStream|null, mainOff: boolean, pipOff: boolean, audio: MediaStream[]}} options.getSources
 * @param {string} options.peerName
 * @param {string} options.selfName
 * @returns {Promise<{stop: () => Promise<Object|null>, seconds: () => number, format: Object}>}
 */
export async function startCallScreenRecording(options = {}) {
  const {
    getSources = () => ({ main: null, pip: null, mainOff: false, pipOff: false }),
    peerName = 'Call',
    selfName = 'You',
    onRecorderError = () => {},
  } = options;

  if (!callRecordingSupported()) {
    const error = new Error('Recording is not supported in this browser.');
    error.code = 'unsupported';
    throw error;
  }

  const mobile = isMobileDevice();
  const frameRate = mobile ? FRAME_RATE_MOBILE : FRAME_RATE_DESKTOP;
  const size = mobile ? MOBILE_SIZE : DESKTOP_SIZE;
  const format = pickRecordingFormat();

  const layer = document.createElement('div');
  layer.className = 'recorder-source-layer';
  layer.setAttribute('aria-hidden', 'true');
  const mainVideo = createHiddenVideo(layer);
  const pipVideo = createHiddenVideo(layer);
  document.body.appendChild(layer);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    layer.remove();
    throw new Error('Recording could not start.');
  }

  const background = document.createElement('canvas');
  background.width = 160;
  background.height = 90;
  const bgCtx = background.getContext('2d');
  const supportsFilter = (() => {
    try {
      bgCtx.filter = 'blur(2px)';
      return bgCtx.filter === 'blur(2px)';
    } catch {
      return false;
    }
  })();
  if (bgCtx) bgCtx.filter = 'none';

  const canvasStream = canvas.captureStream(frameRate);
  const canvasTrack = canvasStream.getVideoTracks()[0];

  // --- audio mixing -------------------------------------------------------
  let audioCtx = null;
  let audioDest = null;
  const attachedStreams = new WeakSet();
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) {
      audioCtx = new AudioCtor();
      if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') await audioCtx.resume();
      audioDest = audioCtx.createMediaStreamDestination();
    }
  } catch {
    audioCtx = null;
    audioDest = null;
  }

  function attachAudio(stream) {
    if (!audioCtx || !audioDest || !stream || attachedStreams.has(stream)) return;
    if (!stream.getAudioTracks().some((track) => track.readyState === 'live')) return;
    try {
      const source = audioCtx.createMediaStreamSource(stream);
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(audioDest);
      attachedStreams.add(stream);
    } catch {
      // Recording continues without this audio source.
    }
  }

  const composite = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioDest ? audioDest.stream.getAudioTracks() : []),
  ]);

  const recorderOptions = { videoBitsPerSecond: mobile ? 1_600_000 : 2_500_000, audioBitsPerSecond: 128_000 };
  if (format.mime) recorderOptions.mimeType = format.mime;

  let recorder;
  try {
    recorder = new MediaRecorder(composite, recorderOptions);
  } catch {
    delete recorderOptions.mimeType;
    recorder = new MediaRecorder(composite, recorderOptions);
  }

  const chunks = [];
  const finished = new Promise((resolve) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => resolve();
  });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };

  const startedAt = Date.now();
  let stopped = false;
  let stopTicker = () => {};

  function readSources() {
    try {
      return getSources() || {};
    } catch {
      return {};
    }
  }

  function paintStage(sources, elapsedSeconds) {
    const { width, height } = canvas;
    ctx.save();
    ctx.fillStyle = '#0a1730';
    ctx.fillRect(0, 0, width, height);

    const mainPlayable = !sources.mainOff && videoReady(mainVideo);
    const pipPlayable = !sources.pipOff && videoReady(pipVideo);

    if (mainPlayable) {
      // Soft blurred backdrop so portrait or shared screens are not letterboxed
      // against a flat colour.
      if (bgCtx) {
        bgCtx.save();
        bgCtx.filter = supportsFilter ? 'blur(7px) brightness(0.62)' : 'none';
        bgCtx.fillStyle = '#0a1730';
        bgCtx.fillRect(0, 0, background.width, background.height);
        try { drawCover(bgCtx, mainVideo, 0, 0, background.width, background.height); } catch { /* frame not ready */ }
        bgCtx.restore();
        if (bgCtx) bgCtx.filter = 'none';
        ctx.drawImage(background, 0, 0, width, height);
      }
      try { drawContain(ctx, mainVideo, 0, 0, width, height); } catch { /* frame not ready */ }
    } else {
      drawIdleStage(ctx, width, height, peerName, selfName, elapsedSeconds);
    }

    const pipLabel = sources.pipLabel || selfName;
    if (pipPlayable) drawPip(ctx, width, height, pipVideo, pipLabel);
    else if (sources.pip || sources.pipOff) drawPipPlaceholder(ctx, width, height, pipLabel, sources.pipOff);

    drawHud(ctx, width, height, peerName, elapsedSeconds, mainPlayable);
    ctx.restore();
  }

  function drawFrame() {
    if (stopped) return;
    const sources = readSources();
    attachStreamToVideo(mainVideo, sources.main || null);
    attachStreamToVideo(pipVideo, sources.pip || null);
    attachAudio(sources.main);
    attachAudio(sources.pip);
    (sources.audio || []).forEach((stream) => attachAudio(stream));
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    try {
      paintStage(sources, elapsedSeconds);
    } catch {
      // A single failed frame must never kill the recording.
    }
    if (recorder.state === 'inactive' && !stopped) {
      // The browser stopped us (for example after an error); finalise quietly.
      stop();
      onRecorderError(new Error('Recording stopped unexpectedly.'));
    }
  }

  try {
    recorder.start(1000);
  } catch (error) {
    layer.remove();
    canvasTrack?.stop();
    audioCtx?.close?.().catch(() => {});
    throw error;
  }

  drawFrame();
  stopTicker = createTicker(Math.round(1000 / frameRate), drawFrame);

  async function stop() {
    if (stopped) return null;
    stopped = true;
    try { stopTicker(); } catch { /* already stopped */ }
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ }
    // Never hang the UI if a browser forgets to fire the recorder's stop event.
    await Promise.race([finished, new Promise((resolve) => setTimeout(resolve, 4000))]);

    canvasTrack?.stop();
    mainVideo.srcObject = null;
    pipVideo.srcObject = null;
    layer.remove();
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});

    const mimeType = recorder.mimeType || format.mime || 'video/webm';
    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) return null;
    return {
      blob,
      mimeType,
      ext: extensionForMime(mimeType, format.ext),
      durationMs: Date.now() - startedAt,
      width: canvas.width,
      height: canvas.height,
      startedAt,
    };
  }

  return {
    stop,
    format,
    seconds: () => Math.floor((Date.now() - startedAt) / 1000),
    isActive: () => !stopped && recorder.state !== 'inactive',
  };
}

function drawIdleStage(ctx, width, height, peerName, selfName, elapsedSeconds) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#16325e');
  gradient.addColorStop(1, '#0a1730');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const radius = Math.round(Math.min(width, height) * 0.14);
  const cx = Math.round(width / 2);
  const cy = Math.round(height * 0.42);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + Math.round(radius * 0.18 * (1 + Math.sin(elapsedSeconds * 2))), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(126, 190, 255, 0.14)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2f7fd1';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(radius * 0.78)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initialsOf(peerName), cx, cy + 2);
  ctx.font = `600 ${Math.round(height * 0.045)}px Poppins, Inter, system-ui, sans-serif`;
  ctx.fillText(String(peerName || 'Call'), cx, cy + radius + Math.round(height * 0.07));
  ctx.font = `400 ${Math.round(height * 0.032)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(214, 230, 255, 0.78)';
  ctx.fillText(`${selfName || 'You'} · You and Me`, cx, cy + radius + Math.round(height * 0.13));
  ctx.restore();
}

function drawPip(ctx, width, height, video, label) {
  const pipWidth = Math.round(width * 0.24);
  const pipHeight = Math.max(60, Math.round(pipWidth * (video.videoHeight / video.videoWidth || 0.75)));
  const margin = Math.round(width * 0.022);
  const x = width - pipWidth - margin;
  const y = height - pipHeight - margin;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.round(width * 0.02);
  ctx.shadowOffsetY = 4;
  roundedRect(ctx, x, y, pipWidth, pipHeight, Math.round(pipWidth * 0.09));
  ctx.fillStyle = '#101c33';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  try { drawCover(ctx, video, x, y, pipWidth, pipHeight); } catch { /* frame not ready */ }
  ctx.restore();
  ctx.save();
  roundedRect(ctx, x, y, pipWidth, pipHeight, Math.round(pipWidth * 0.09));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(2, Math.round(width * 0.0025));
  ctx.stroke();
  ctx.font = `600 ${Math.round(pipHeight * 0.16)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.fillText(String(label || 'You').slice(0, 18), x + Math.round(pipWidth * 0.06), y + pipHeight - Math.round(pipHeight * 0.08));
  ctx.restore();
}

function drawPipPlaceholder(ctx, width, height, label, cameraOff) {
  const pipWidth = Math.round(width * 0.24);
  const pipHeight = Math.round(pipWidth * 0.66);
  const margin = Math.round(width * 0.022);
  const x = width - pipWidth - margin;
  const y = height - pipHeight - margin;
  ctx.save();
  roundedRect(ctx, x, y, pipWidth, pipHeight, Math.round(pipWidth * 0.09));
  ctx.fillStyle = 'rgba(16, 28, 51, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(2, Math.round(width * 0.002));
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(226, 236, 255, 0.9)';
  ctx.font = `600 ${Math.round(pipHeight * 0.3)}px Inter, system-ui, sans-serif`;
  ctx.fillText(initialsOf(label), x + pipWidth / 2, y + pipHeight * 0.42);
  ctx.font = `500 ${Math.round(pipHeight * 0.14)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(198, 214, 244, 0.85)';
  ctx.fillText(cameraOff ? 'Camera off' : String(label || 'You').slice(0, 16), x + pipWidth / 2, y + pipHeight * 0.72);
  ctx.restore();
}

function drawHud(ctx, width, height, peerName, elapsedSeconds, connected) {
  const scale = width / 1280;
  ctx.save();
  ctx.textBaseline = 'middle';

  // Peer + status chip (top-left).
  const label = `${peerName || 'Call'} · ${connected ? 'Live' : 'Connecting'}`;
  ctx.font = `600 ${Math.round(26 * scale)}px Inter, system-ui, sans-serif`;
  const chipPadding = Math.round(16 * scale);
  const chipWidth = Math.round(ctx.measureText(label).width + chipPadding * 2);
  const chipHeight = Math.round(46 * scale);
  const chipX = Math.round(24 * scale);
  const chipY = Math.round(24 * scale);
  roundedRect(ctx, chipX, chipY, chipWidth, chipHeight, chipHeight / 2);
  ctx.fillStyle = 'rgba(8, 18, 38, 0.55)';
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillText(label, chipX + chipPadding, chipY + chipHeight / 2 + 1);

  // REC chip (top-right).
  const timeText = formatClock(elapsedSeconds);
  ctx.font = `700 ${Math.round(26 * scale)}px Inter, system-ui, sans-serif`;
  const recWidth = Math.round(ctx.measureText(`REC ${timeText}`).width + Math.round(58 * scale));
  const recX = width - recWidth - Math.round(24 * scale);
  roundedRect(ctx, recX, chipY, recWidth, chipHeight, chipHeight / 2);
  ctx.fillStyle = 'rgba(190, 24, 45, 0.88)';
  ctx.fill();
  const dotRadius = Math.round(9 * scale);
  const dotX = recX + Math.round(24 * scale);
  const dotY = chipY + chipHeight / 2;
  const pulse = 0.45 + 0.55 * Math.abs(Math.sin(elapsedSeconds * Math.PI));
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${pulse.toFixed(3)})`;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`REC ${timeText}`, dotX + dotRadius + Math.round(12 * scale), dotY + 1);

  // Watermark (bottom-left).
  ctx.font = `500 ${Math.round(20 * scale)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('You and Me', Math.round(26 * scale), height - Math.round(28 * scale));
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Saving / sharing
// ---------------------------------------------------------------------------

/**
 * Address of the loopback file receiver that the Android shell exposes. A
 * WebView has no download manager, so blob downloads are a no-op there; the
 * native side hands the page a local endpoint that streams files into the
 * phone's Download folder instead.
 */
function nativeSaveEndpoint() {
  if (typeof window === 'undefined') return '';
  try {
    const endpoint = window.TonniNative?.saveEndpoint?.();
    return typeof endpoint === 'string' ? endpoint : '';
  } catch {
    return '';
  }
}

async function postRecordingToNativeShell(blob, name, type) {
  const endpoint = nativeSaveEndpoint();
  if (!endpoint) return null;
  try {
    const response = await fetch(`${endpoint}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': type || 'application/octet-stream',
        'X-Tonni-Filename': encodeURIComponent(name),
      },
      body: blob,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return { method: 'native', filename: name, path: payload?.path || '' };
  } catch {
    return null;
  }
}

/**
 * Write a recording to the device. In the installed Android/iOS app the file is
 * streamed to the native Download folder; on phones using a browser the anchor
 * download lands directly in the Download folder; on desktop browsers that
 * support the File System Access API the user can choose where to keep it.
 */
export async function saveRecordingToDevice({ blob, filename, mime }) {
  const type = mime || blob.type || 'video/webm';
  const ext = extensionForMime(type);
  const name = filename || formatRecordingFilename({ ext });

  const nativeResult = await postRecordingToNativeShell(blob, name, type);
  if (nativeResult) return nativeResult;

  if (typeof window.showSaveFilePicker === 'function' && !isMobileDevice()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Video recording', accept: { [type]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { method: 'picker', filename: name };
    } catch (error) {
      if (error && error.name === 'AbortError') return { method: 'cancelled', filename: name };
      // Fall through to the plain download below.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return { method: 'download', filename: name, url };
}

export function canShareRecording() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function' || typeof File === 'undefined') return true;
  try {
    return navigator.canShare({ files: [new File([], 'preview.webm', { type: 'video/webm' })] });
  } catch {
    return true;
  }
}

export async function shareRecordingFile({ blob, filename, title }) {
  const name = filename || formatRecordingFilename({});
  const file = new File([blob], name, { type: blob.type || 'video/webm' });
  if (typeof navigator.share !== 'function') return { method: 'unsupported' };
  try {
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return { method: 'unsupported' };
    await navigator.share({ files: [file], title: title || name, text: 'Recorded on You and Me' });
    return { method: 'share' };
  } catch (error) {
    if (error && error.name === 'AbortError') return { method: 'cancelled' };
    return { method: 'unsupported' };
  }
}

// ---------------------------------------------------------------------------
// On-device recordings library (IndexedDB)
// ---------------------------------------------------------------------------

function openRecordingsDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open recordings storage'));
  });
}

async function withStore(mode, run) {
  const db = await openRecordingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const store = tx.objectStore(DB_STORE);
    let result;
    const finish = (error) => {
      try { db.close(); } catch { /* ignore */ }
      if (error) reject(error); else resolve(result);
    };
    tx.oncomplete = () => finish(null);
    tx.onerror = () => finish(tx.error);
    tx.onabort = () => finish(tx.error || new Error('Recording storage busy'));
    try {
      const request = run(store);
      if (request && typeof request.then === 'function') request.then((value) => { result = value; }).catch(finish);
      else if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => finish(request.error);
      }
    } catch (error) {
      finish(error);
    }
  });
}

export async function listRecordings() {
  try {
    const rows = await withStore('readonly', (store) => store.getAll());
    const items = Array.isArray(rows) ? rows : [];
    return items
      .map((row) => ({
        id: row.id,
        peerName: row.peerName || 'Call',
        peerId: row.peerId || '',
        createdAt: row.createdAt || 0,
        durationMs: row.durationMs || 0,
        size: row.size || 0,
        mime: row.mime || 'video/webm',
        ext: row.ext || 'webm',
        width: row.width || 0,
        height: row.height || 0,
        savedToDevice: Boolean(row.savedToDevice),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function addRecordingToLibrary(entry) {
  try {
    await withStore('readwrite', (store) => store.put(entry));
    const rows = await withStore('readonly', (store) => store.getAll());
    const items = (Array.isArray(rows) ? rows : []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const overflow = items.slice(0, Math.max(0, items.length - MAX_LIBRARY_ITEMS));
    for (const old of overflow) {
      try { await withStore('readwrite', (store) => store.delete(old.id)); } catch { /* keep going */ }
    }
    return true;
  } catch {
    return false;
  }
}

export async function removeRecordingFromLibrary(id) {
  try {
    await withStore('readwrite', (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}

export async function getRecordingBlob(id) {
  try {
    const row = await withStore('readonly', (store) => store.get(id));
    return row?.blob || null;
  } catch {
    return null;
  }
}

export async function markRecordingSaved(id) {
  try {
    const row = await withStore('readonly', (store) => store.get(id));
    if (!row) return false;
    row.savedToDevice = true;
    await withStore('readwrite', (store) => store.put(row));
    return true;
  } catch {
    return false;
  }
}
