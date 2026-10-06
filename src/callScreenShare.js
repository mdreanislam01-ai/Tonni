function stopTracks(stream) {
  for (const track of stream?.getTracks?.() || []) {
    try { track.stop(); } catch { /* The browser may already have stopped the track. */ }
  }
}

function screenShareError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function findVideoSender(peerConnection) {
  if (!peerConnection) return null;

  const senders = peerConnection.getSenders?.() || [];
  const sender = senders.find((item) => item.track?.kind === 'video');
  if (sender) return sender;

  // Some browsers temporarily expose a transceiver sender without its current
  // track. The remote video receiver still identifies the video transceiver.
  const transceivers = peerConnection.getTransceivers?.() || [];
  const videoTransceiver = transceivers.find((item) => (
    item.sender && (item.sender.track?.kind === 'video' || item.receiver?.track?.kind === 'video')
  ));
  return videoTransceiver?.sender || null;
}

/**
 * Ask the browser for a screen/window/tab capture.
 *
 * getDisplayMedia is gesture gated, so this must be the very first thing a
 * click handler awaits — no confirmation dialog or state update may run before
 * it or the browser refuses the capture.
 */
export async function captureScreenStream({ mediaDevices }) {
  if (typeof mediaDevices?.getDisplayMedia !== 'function') {
    throw screenShareError('unsupported', 'Display capture is not available in this browser.');
  }

  // Call the gesture-gated browser API before yielding so the request remains
  // tied to the user's click on the Share screen menu item.
  const stream = await mediaDevices.getDisplayMedia({ video: true, audio: false });

  const track = stream?.getVideoTracks?.()[0];
  if (!track) {
    stopTracks(stream);
    throw screenShareError('missing-video-track', 'The selected source did not provide a video track.');
  }
  return { stream, track };
}

export async function captureAndReplaceVideoTrack({ mediaDevices, peerConnection, isCallCurrent = () => true }) {
  // Call the gesture-gated browser API before yielding so the request remains
  // tied to the user's click on the Share screen menu item.
  const { stream, track } = await captureScreenStream({ mediaDevices });

  try {
    if (!isCallCurrent()) {
      stopTracks(stream);
      return null;
    }

    const sender = findVideoSender(peerConnection);
    if (!sender || typeof sender.replaceTrack !== 'function') {
      throw screenShareError('missing-video-sender', 'This call has no video sender ready for screen sharing.');
    }

    await sender.replaceTrack(track);
    if (!isCallCurrent()) {
      stopTracks(stream);
      return null;
    }

    return { stream, track };
  } catch (error) {
    stopTracks(stream);
    throw error;
  }
}

/**
 * Share a screen on a call that has no video track yet — an audio call.
 *
 * The captured screen is published on a brand new video sender and the call is
 * renegotiated (a fresh offer is sent to the other person) so their browser
 * starts receiving the picture. `associateStream` should be the call's existing
 * local stream: grouping the screen with it keeps the receiver's audio and
 * video in one MediaStream instead of splitting the call in two.
 */
export async function captureAndPublishVideoTrack({
  mediaDevices,
  peerConnection,
  associateStream = null,
  isCallCurrent = () => true,
  renegotiate,
}) {
  const { stream, track } = await captureScreenStream({ mediaDevices });

  let sender = null;
  try {
    if (!isCallCurrent()) {
      stopTracks(stream);
      return null;
    }
    if (typeof peerConnection?.addTrack !== 'function') {
      throw screenShareError('missing-video-sender', 'This call cannot publish a screen right now.');
    }

    sender = associateStream ? peerConnection.addTrack(track, associateStream) : peerConnection.addTrack(track);
    if (!sender) throw screenShareError('missing-video-sender', 'This call cannot publish a screen right now.');

    // Send-only: the other person is on an audio call and has no picture to
    // send back on this new video channel.
    const transceiver = (peerConnection.getTransceivers?.() || []).find((item) => item.sender === sender);
    if (transceiver && 'direction' in transceiver) {
      try { transceiver.direction = 'sendonly'; } catch { /* Older browsers pick the direction themselves. */ }
    }

    if (typeof renegotiate === 'function') await renegotiate({ sender, track, stream });
    if (!isCallCurrent()) {
      stopTracks(stream);
      return null;
    }

    return { stream, track, sender, published: true };
  } catch (error) {
    // Leave the peer connection exactly as it was before this attempt.
    if (sender) {
      try { peerConnection.removeTrack?.(sender); } catch { /* the call may already be closed */ }
    }
    stopTracks(stream);
    throw error;
  }
}

/**
 * Take a published screen back off an audio call. Returns true when the sender
 * was removed and the call therefore has to be renegotiated.
 */
export function unpublishVideoTrack({ peerConnection, sender }) {
  if (!peerConnection || !sender) return false;
  if (typeof peerConnection.removeTrack !== 'function') return false;
  try {
    peerConnection.removeTrack(sender);
    return true;
  } catch {
    return false;
  }
}
