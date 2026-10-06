# You and Me

A guest-first messaging and calling web app. This repository contains the **single application** (React UI, Node/Socket.IO server, and WebRTC call signaling); it does not create or depend on separate projects.

## Run it

```bash
npm install
npm run dev
```

Open the URL printed by the server (default `http://localhost:4173`). To build and run the production bundle:

```bash
npm run build
npm start
```

Run the checks (recorder pipeline + call UI render smoke tests, no browser needed):

```bash
npm test
```

The server listens on `PORT` when provided, otherwise port `4173`, and binds to `0.0.0.0` for hosting previews.

## Included

- No registration, password, or phone number is required. A guest ID is generated and kept in this browser; adding a phone number is optional and private unless the user enables discovery.
- No-sign-up discovery by display name, username, public Bangladesh mobile number, or guest ID. Phone visibility is opt-in.
- Direct chat by guest ID or invite link, online presence, typing indicators, delivered/read status, and file, image, emoji, and voice messages.
- One-to-one audio/video calls using WebRTC, with mute, speaker, keypad, camera switching, and opt-in screen sharing.
- **Record screen during a call**: one tap records the call picture (your shared screen becomes the main frame) together with both voices, and the finished video file is written straight to the device — the phone's Download folder on mobile, or a folder you pick on desktop. A private on-device library (Calls → Recordings) can replay, re-save, share, or delete each recording. Nothing is uploaded to the server. Recording is built on canvas capture + MediaRecorder, so it also works on Android/iOS browsers that do not expose `getDisplayMedia`.
- Home, chats, contacts, call history, profile and privacy controls, local data/storage, theme, notifications, help, and guest logout.
- Profile photos, usernames, and optional phone numbers can be added without creating an account. Contacts are imported only after an explicit browser contact-picker action.
- Chat history and preferences are stored locally in the browser. The interface is English-only, responsive, and uses Poppins headings with Inter body text.

## Hosting and privacy notes

A preview URL is useful for trying the app, but it is not a permanent public deployment. To make it continuously available, deploy this Node app to a host that supports WebSockets and HTTPS, and point your domain there. Static-only hosting is not enough because chat delivery and call signaling use the included Socket.IO server.

This starter server keeps online presence and offline message queues in process memory; queued messages are lost if the server restarts. For a production public service, add a persistent database/queue, rate limits and abuse controls, and a TURN service for reliable calls across restrictive networks. Guest IDs are not account recovery or strong identity verification. Messages are relayed by the server and are **not end-to-end encrypted**; do not use this starter for sensitive conversations without adding appropriate security and operational protections.

Microphone and camera calls require a secure context (HTTPS, or localhost) and permission from the browser.
