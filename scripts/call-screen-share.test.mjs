import assert from 'node:assert/strict';
import { captureAndPublishVideoTrack, captureAndReplaceVideoTrack, findVideoSender, unpublishVideoTrack } from '../src/callScreenShare.js';

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

// ---------------------------------------------------------------------------
// Audio calls: the screen is published on a brand new video sender and the call
// is renegotiated, because an audio call has no video track to replace.
// ---------------------------------------------------------------------------

// A successful selection adds the track, groups it with the call stream so the
// other person keeps audio and picture together, and renegotiates the call.
{
  const micTrack = makeTrack('audio');
  const callStream = makeStream(micTrack);
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  let userActivation = true;
  const added = [];
  let renegotiations = 0;
  const peerConnection = {
    addTrack(track, group) { const sender = { track }; added.push({ track, group, sender }); return sender; },
    removeTrack() { assert.fail('a fresh share must not remove anything'); },
  };

  const result = await captureAndPublishVideoTrack({
    mediaDevices: {
      getDisplayMedia(constraints) {
        assert.equal(userActivation, true, 'display capture should start during the click activation');
        assert.deepEqual(constraints, { video: true, audio: false });
        userActivation = false;
        return Promise.resolve(stream);
      },
    },
    peerConnection,
    associateStream: callStream,
    renegotiate: async ({ sender, track }) => {
      renegotiations += 1;
      assert.equal(track, displayTrack, 'renegotiation should publish the chosen screen');
      assert.equal(sender, added[0].sender);
    },
  });

  assert.equal(added.length, 1, 'exactly one video sender should be added');
  assert.equal(added[0].track, displayTrack);
  assert.equal(added[0].group, callStream, 'the screen should join the call stream for the remote peer');
  assert.equal(renegotiations, 1, 'the call must be renegotiated so the peer receives the picture');
  assert.equal(result.published, true);
  assert.equal(result.stream, stream);
  assert.equal(result.track, displayTrack);
  assert.equal(displayTrack.stopped, false);
}

// If renegotiation fails, the sender is taken back off and the capture released.
{
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  const sender = { track: displayTrack };
  let removed = null;
  await assert.rejects(
    captureAndPublishVideoTrack({
      mediaDevices: { getDisplayMedia: async () => stream },
      peerConnection: { addTrack: () => sender, removeTrack: (item) => { removed = item; } },
      renegotiate: async () => { throw new Error('offer failed'); },
    }),
    /offer failed/,
  );
  assert.equal(removed, sender, 'a failed share must leave the peer connection as it was');
  assert.equal(displayTrack.stopped, true, 'a failed share must release the capture');
}

// If the call ends while the user is choosing a screen, discard the result.
{
  const displayTrack = makeTrack();
  const stream = makeStream(displayTrack);
  const result = await captureAndPublishVideoTrack({
    mediaDevices: { getDisplayMedia: async () => stream },
    peerConnection: { addTrack: () => assert.fail('a stale call must not publish a screen') },
    isCallCurrent: () => false,
  });
  assert.equal(result, null);
  assert.equal(displayTrack.stopped, true);
}

// Stopping a shared screen on an audio call removes the sender so the caller can
// renegotiate the picture back off the call.
{
  const sender = { track: makeTrack() };
  let removed = null;
  assert.equal(unpublishVideoTrack({ peerConnection: { removeTrack: (item) => { removed = item; } }, sender }), true);
  assert.equal(removed, sender);
  assert.equal(unpublishVideoTrack({ peerConnection: null, sender }), false);
  assert.equal(unpublishVideoTrack({ peerConnection: { removeTrack() {} }, sender: null }), false);
  assert.equal(unpublishVideoTrack({ peerConnection: { removeTrack: () => { throw new Error('closed'); } }, sender }), false);
}

console.log('✅ screen-share capture and sender tests passed');
