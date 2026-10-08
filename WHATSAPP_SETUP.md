# Tonni WhatsApp Business Cloud API setup

Tonni's WhatsApp Inbox is an isolated admin-only route at **`/admin/whatsapp`**. WhatsApp data is served only by authenticated `/api/admin/whatsapp/*` endpoints and the authenticated `/admin-whatsapp` Socket.IO namespace. A regular guest account, direct URL, or unauthenticated API/socket request cannot read conversations. The Meta webhook is public only for Meta's signed webhook deliveries and its verify-token handshake.

This integration uses Meta's official WhatsApp Business Platform Cloud API only. Access tokens and the App Secret are read by the Node server and are never returned to the browser.

## Server environment variables

Set these in the **server/deployment** environment (for example, the Render service's Environment page). Do not use `VITE_` names, commit a real `.env`, or put secrets in frontend settings.

| Variable | Required | Value |
| --- | --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Yes | Long-lived System User access token with `business_management`, `whatsapp_business_messaging`, and `whatsapp_business_management` access to this WABA/phone number. Keep server-side. |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Meta's **Phone Number ID** for the registered `+8801890047742` number. This is not the phone number itself. |
| `WHATSAPP_APP_SECRET` | Yes | App Secret from Meta App Dashboard → App settings → Basic. Used to validate `X-Hub-Signature-256`. |
| `WHATSAPP_VERIFY_TOKEN` | Yes | A strong random string you choose. Enter the exact same value in Meta's webhook verification form. |
| `WHATSAPP_ADMIN_USERNAME` | Yes | Dedicated username for the Tonni WhatsApp administrator. |
| `WHATSAPP_ADMIN_PASSWORD` | Yes | Unique password of at least 16 characters. The server does not create a default admin if this is missing. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Recommended | WhatsApp Business Account (WABA) ID. When supplied, webhook events from another WABA are ignored. |
| `WHATSAPP_DISPLAY_PHONE_NUMBER` | Recommended | `+8801890047742`. Also used to reject webhook events for another displayed number. |
| `WHATSAPP_GRAPH_API_VERSION` | Optional | Graph API version, default `v26.0`; use a version enabled for your Meta app. |
| `WHATSAPP_CALLING_ENABLED` | Optional | `true` only after Cloud API Calling is enabled for this number and the `calls` webhook is subscribed. Defaults to `false`. |
| `WHATSAPP_CALLING_STUN_URLS` | Optional | Comma-separated public STUN server URLs for WebRTC NAT discovery, e.g. `stun:stun.example.net:3478`. STUN URLs contain no credentials or secrets. |
| `WHATSAPP_DATA_PATH` | Optional | Persistent inbox JSON file path. For a Render persistent disk mounted at `/var/data`, use `/var/data/whatsapp-inbox.json`. Default: `data/whatsapp-inbox.json`. |

Copy `.env.example` as a checklist; replace every placeholder in the deployment dashboard. The access token, App Secret, verify token, admin password, and TURN credentials must not be committed to Git.

## Meta Developer setup

1. In [Meta for Developers](https://developers.facebook.com/), use a Business app and add the **WhatsApp** product. In WhatsApp API Setup, add/register the business phone number **`+8801890047742`** in the intended WhatsApp Business Account. Complete Meta's phone-number verification and business requirements. If the number is currently on the WhatsApp Business app, use Meta's supported migration/coexistence path if eligible; do not use QR/session tools.
2. From the WhatsApp API Setup page, copy the **Phone Number ID** and **WhatsApp Business Account ID** into the server environment. Confirm that the Phone Number ID belongs to `+8801890047742` before enabling sends.
3. In Meta Business Settings, create a System User, assign the Meta app and this WhatsApp account/phone number, and generate a server-side token with `business_management`, `whatsapp_business_messaging`, and `whatsapp_business_management` for this WABA. The server checks that the configured Phone Number ID really resolves to `+8801890047742` before sending/calling. Use the non-expiring/long-lived production token flow recommended by Meta; do not use the temporary getting-started token for production.
4. Copy the app's **App Secret** from App settings → Basic to `WHATSAPP_APP_SECRET`. Create a separate random `WHATSAPP_VERIFY_TOKEN` and set that same value in both Meta and the server.
5. In Meta App Dashboard → **Webhooks**, choose the WhatsApp Business Account object and set the callback URL to:

   ```text
   https://tonni.rmfbd.online/api/whatsapp/webhook
   ```

   Enter the exact `WHATSAPP_VERIFY_TOKEN`, verify the callback, then subscribe the app/WABA to **`messages`**. Message delivery/read/failure receipts are delivered in the messages webhook field.
6. Subscribe the app to this WABA. If your setup requires the API step, run the official `subscribed_apps` call with your server-side token:

   ```bash
   curl -X POST "https://graph.facebook.com/v26.0/$WHATSAPP_BUSINESS_ACCOUNT_ID/subscribed_apps" \\
     -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
   ```

7. If enabling calls, also subscribe the app to the **`calls`** webhook field. Confirm Meta's webhook test succeeds before setting `WHATSAPP_CALLING_ENABLED=true`.
8. Keep the Render service on HTTPS and running. The callback must be publicly reachable by Meta. Webhook POST requests are accepted only when their HMAC signature matches the configured App Secret and the phone-number ID (and WABA ID, when supplied) match this integration.

After deployment, open `https://tonni.rmfbd.online/admin/whatsapp` and sign in using the configured admin username/password. No Inbox navigation or message data is exposed in the guest site.

## Calling API and policy notes

Meta officially offers WhatsApp Business Calling via Cloud API. Tonni implements real audio-call signaling through Meta's `/{PHONE_NUMBER_ID}/calls` API, the signed `calls` webhook, and browser WebRTC; it does not simulate calls. Keep the feature disabled until Meta calling is switched on for the number. Production Calling has eligibility/quality requirements (including the account's messaging tier), and an outbound business call requires customer permission. The Inbox has a real call-permission request action; Meta can reject that request outside the customer-service window unless you use an approved template. Bangladesh (`+880`) is not listed by Meta among the excluded business-number countries for business-initiated calls. Browser microphone access requires HTTPS. `WHATSAPP_CALLING_STUN_URLS` is optional public WebRTC STUN configuration (it contains no credentials); restrictive networks that require a TURN relay need a separately secured relay service before calls can connect reliably. No TURN secret or Meta token is placed in the browser.

Meta's Cloud API does **not** provide a customer's WhatsApp profile photo in its standard message/contact webhooks, so the official-only Inbox uses a name-initial avatar instead of fetching a photo through an unofficial service. Incoming image/audio/video/document messages are recorded as message entries with the available type/caption/metadata; replies in this initial Inbox are text messages. Free-form text sending is subject to Meta's 24-hour customer-service window; use approved templates where required.

## Storage and hosting

Conversation data is kept in a separate server-side JSON database, written atomically with owner-only file permissions. It is not served as a static asset. The default local `data/` path survives ordinary process restarts on a persistent filesystem; ephemeral hosting filesystems can be wiped on redeploy/restart. For durable production retention, attach a persistent disk to the web service and set `WHATSAPP_DATA_PATH` to a file on its mount. Run a single server instance unless the store is replaced with a shared transactional database.
