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
- Messenger-style in-page chat heads open a compact chat panel; background push alerts open a focused quick-chat view with a text composer, without routing through the home screen.
- Profile photos, usernames, and optional phone numbers can be added without creating an account. Contacts are imported only after an explicit browser contact-picker action.
- Chat history and preferences are stored locally in the browser. The interface is English-only, responsive, and uses Poppins headings with Inter body text.

## Background messages and quick chat

The site does not need to remain open for background message alerts: the browser's service worker receives Web Push and shows a system notification, and tapping it opens the compact quick-chat screen directly. In the foreground, tapping a Messenger-style chat head opens a floating conversation panel without changing the current page.

For background alerts, deploy on HTTPS, grant notification permission, leave the background-alert setting enabled, and keep the Node/Socket.IO server available. On iPhone/iPad, Web Push requires a supported iOS version and the web app added to the Home Screen; behavior and notification action buttons vary by browser/OS. Web pages cannot create an always-on-top Messenger bubble over other apps, and browser notifications cannot provide a universal inline text-reply field. The notification's Reply action therefore opens the compact chat composer; it does not send a reply without opening the app surface. A true OS-level chat head/inline reply needs a native app (and Android overlay permission).

## Android app (APK)

The same web client also ships as an installable Android app. The native part is
a small Capacitor shell (`capacitor.config.json` + `android/`) around the Vite
bundle, so the UI is identical to the website.

**Download an APK:** open the repository's **Actions → Build Android APK**, pick
the newest successful run, and download the `tonni-debug-apk` artifact. Tagging a
`v*` release (or running the workflow with `publish_release: true`) attaches the
APK to a GitHub **Release** instead, which is easier to install from a phone.

Install it by opening the file on the phone and allowing *Install unknown apps*
for whatever app opened it. The APK is signed with Gradle's throw-away debug
keystore, so it is meant for testing and sideloading — add a release keystore
before publishing to Google Play.

**Server URL.** A bundled app is served from `https://localhost`, so it cannot
reach the Socket.IO server "same origin" the way the website does. The URL is
resolved in this order:

1. `?backend=https://…` query parameter,
2. `window.__SOCKET_URL__` or a URL saved on the device (Settings → Data &
   Storage → Server URL, key `ym_backend_url`),
3. `VITE_SOCKET_URL` at build time — the workflow takes it from the repository
   variable `VITE_SOCKET_URL` or its manual `backend_url` input,
4. `https://tonni.rmfbd.online`.

If chat says *offline* in the app, open Settings → Data & Storage → Server URL,
paste the deployed HTTPS backend (it must be a Node/Socket.IO host such as
Render, not a static host), and save — the app reloads and reconnects.

**What the shell adds beyond the browser tab**

- Android hardware/gesture back closes the top surface (dialog, details panel,
  open chat, tab) before it leaves the app.
- Recorded calls and downloaded attachments are written to
  `Downloads/Tonni/` through a loopback file receiver, because a WebView has no
  download manager and `blob:` downloads silently fail there.
- Branded launcher icon, splash screen and status bar; microphone/camera
  permissions are requested by the WebView when a call starts.

**Building locally** (needs JDK 21 and an Android SDK with platform 36):

```bash
npm ci
npm run android:sync    # vite build + copy the bundle into android/
npm run android:apk     # -> android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:assets` regenerates the launcher icons and splash screens from
`public/icon-512.png` (pure Node, no ImageMagick/Pillow needed).

## Hosting and privacy notes

A preview URL is useful for trying the app, but it is not a permanent public deployment. To make it continuously available, deploy this Node app to a host that supports WebSockets and HTTPS, and point your domain there. Static-only hosting is not enough because chat delivery and call signaling use the included Socket.IO server.

This starter server keeps online presence and offline message queues in process memory; queued messages are lost if the server restarts. For a production public service, add a persistent database/queue, rate limits and abuse controls, and a TURN service for reliable calls across restrictive networks. Guest IDs are not account recovery or strong identity verification. Messages are relayed by the server and are **not end-to-end encrypted**; do not use this starter for sensitive conversations without adding appropriate security and operational protections.

Microphone and camera calls require a secure context (HTTPS, or localhost) and permission from the browser.
