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

export async function captureAndReplaceVideoTrack({ mediaDevices, peerConnection, isCallCurrent = () => true }) {
  if (typeof mediaDevices?.getDisplayMedia !== 'function') {
    throw screenShareError('unsupported', 'Display capture is not available in this browser.');
  }

  // Call the gesture-gated browser API before yielding so the request remains
  // tied to the user's click on the Share screen menu item.
  const stream = await mediaDevices.getDisplayMedia({ video: true, audio: false });

  try {
    const track = stream?.getVideoTracks?.()[0];
    if (!track) throw screenShareError('missing-video-track', 'The selected source did not provide a video track.');
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
