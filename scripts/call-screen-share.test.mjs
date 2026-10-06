import assert from 'node:assert/strict';
import { captureAndReplaceVideoTrack, findVideoSender } from '../src/callScreenShare.js';

function makeTrack(kind = 'video') {
  return {
    kind,
    readyState: 'live',
    stopped: false,
    stop() { this.stopped = true; this.readyState = 'ended'; },
  };
}

function makeStream(...tracks) {
  return {
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    getTracks: () => tracks,
  };
}

// A successful selection replaces the call's video sender, and capture starts
// synchronously from the menu click before any asynchronous work is awaited.
{
  const cameraTrack = makeTrack();
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  const sender = {
    track: cameraTrack,
    async replaceTrack(track) { this.track = track; },
  };
  let userActivation = true;
  const resultPromise = captureAndReplaceVideoTrack({
    mediaDevices: {
      getDisplayMedia(constraints) {
        assert.equal(userActivation, true, 'display capture should start during the click activation');
        assert.deepEqual(constraints, { video: true, audio: false });
        userActivation = false;
        return Promise.resolve(stream);
      },
    },
    peerConnection: { getSenders: () => [sender] },
  });
  const result = await resultPromise;
  assert.equal(sender.track, displayTrack, 'the remote call sender should carry the chosen screen');
  assert.equal(result.stream, stream);
  assert.equal(result.track, displayTrack);
  assert.equal(displayTrack.stopped, false);
}

// The sender can be recovered from a video transceiver even if its track is
// temporarily unset, which also covers browsers with delayed sender tracks.
{
  const sender = { track: null, replaceTrack() {} };
  const peerConnection = {
    getSenders: () => [sender],
    getTransceivers: () => [{ sender, receiver: { track: makeTrack('video') } }],
  };
  assert.equal(findVideoSender(peerConnection), sender);
}

// If the peer connection has no video sender, release the OS/browser capture
// immediately rather than leaving a screen capture running invisibly.
{
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  await assert.rejects(
    captureAndReplaceVideoTrack({
      mediaDevices: { getDisplayMedia: async () => stream },
      peerConnection: { getSenders: () => [] },
    }),
    (error) => error.code === 'missing-video-sender',
  );
  assert.equal(displayTrack.stopped, true);
}

// If the call ends while the user is choosing a screen, discard the result.
{
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  const sender = { track: makeTrack(), replaceTrack() { assert.fail('stale calls must not replace their sender'); } };
  const result = await captureAndReplaceVideoTrack({
    mediaDevices: { getDisplayMedia: async () => stream },
    peerConnection: { getSenders: () => [sender] },
    isCallCurrent: () => false,
  });
  assert.equal(result, null);
  assert.equal(displayTrack.stopped, true);
}

// A failed replace must release the capture and bubble the failure for visible
// feedback in the call UI.
{
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  await assert.rejects(
    captureAndReplaceVideoTrack({
      mediaDevices: { getDisplayMedia: async () => stream },
      peerConnection: { getSenders: () => [{ track: makeTrack(), replaceTrack: async () => { throw new Error('replace failed'); } }] },
    }),
    /replace failed/,
  );
  assert.equal(displayTrack.stopped, true);
}

console.log('✅ screen-share capture and sender tests passed');
