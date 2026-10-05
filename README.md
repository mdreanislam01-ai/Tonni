# You & Me

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

The server listens on `PORT` when provided, otherwise port `4173`, and binds to `0.0.0.0` for hosting previews.

## Included

- No registration, phone number, or password. A guest ID is generated and kept in this browser.
- Direct chat by guest ID or invite link, online presence, typing indicators, delivered/read status, and file, image, emoji, and voice messages.
- One-to-one voice/video calls using WebRTC, with in-call mute and camera controls.
- Saved messages, searchable chat/contact lists, call history, Bengali/English UI, dark mode, and browser notification preferences.
- Chat history and settings are stored locally in the browser. The app uses one responsive WhatsApp/Telegram-inspired interface.

## Hosting and privacy notes

A preview URL is useful for trying the app, but it is not a permanent public deployment. To make it continuously available, deploy this Node app to a host that supports WebSockets and HTTPS, and point your domain there. Static-only hosting is not enough because chat delivery and call signaling use the included Socket.IO server.

This starter server keeps online presence and offline message queues in process memory; queued messages are lost if the server restarts. For a production public service, add a persistent database/queue, rate limits and abuse controls, and a TURN service for reliable calls across restrictive networks. Guest IDs are not account recovery or strong identity verification. Messages are relayed by the server and are **not end-to-end encrypted**; do not use this starter for sensitive conversations without adding appropriate security and operational protections.

Microphone and camera calls require a secure context (HTTPS, or localhost) and permission from the browser.
