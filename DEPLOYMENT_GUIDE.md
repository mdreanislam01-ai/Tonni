# Tonni ("You and Me") - Backend & Socket.IO Deployment Guide

## বর্তমান অবস্থা ও পরীক্ষার ফলাফল (Test Results)
আমরা অ্যাপটির `server.js` (Express + Socket.IO) এবং `App.jsx` ফ্রন্টএন্ড সম্পূর্ণ ইন্টিগ্রেশন পরীক্ষা করেছি:
1. **Guest Registration (`guest:register`)**: সফল (OK: true)
2. **Presence & Discovery (`presence:update`)**: অনলাইনে থাকা ব্যবহারকারীদের তাৎক্ষণিক শনাক্তকরণ সফল
3. **Live Chat Messaging (`message:send`, `message:receive`)**: সফল
4. **Typing Indicators (`typing:update`)**: সফল
5. **Audio & Video Call (`call:start`, `call:incoming`, `call:respond`)**: সফল
6. **WebRTC Signaling (`call:signal` offer/answer exchange)**: সফল
7. **Call Termination (`call:end`)**: সফল

---

## কেন `tonni.rmfbd.online` (Vercel) এ Socket.IO কাজ করছিল না?
Vercel একটি **Serverless / Static Hosting** প্ল্যাটফর্ম। Vercel শুধুমাত্র ফ্রন্টএন্ডের বিল্ড ফাইল (`dist/`) পরিবেশন করে। 
Socket.IO এবং WebRTC সিগন্যালিংয়ের জন্য সার্বক্ষণিক চলমান Node.js সার্ভার (`server.js`) প্রয়োজন। Vercel ব্যাকগ্রাউন্ডে কোনো লং-রানিং WebSocket প্রসেস সাপোর্ট করে না, ফলে `/socket.io/` রিকোয়েস্ট পাঠালে Vercel থেকে `404 Not Found` রিটার্ন আসে।

---

## সমাধান: Socket.IO ব্যাকএন্ড যুক্ত করার ২ টি উপায়

### বিকল্প ১: সম্পূর্ণ অ্যাপটি Render.com এ ডিপ্লয় করা (সবচেয়ে সহজ ও সেরা)
Render.com ফ্রিতে Node.js এবং WebSocket সমর্থন করে। আপনার অ্যাপের `server.js` একই সাথে ফ্রন্টএন্ড এবং Socket.IO সার্ভ করে।
1. [Render.com](https://render.com) এ লগইন করুন।
2. **New +** এ ক্লিক করে **Web Service** সিলেক্ট করুন।
3. আপনার GitHub অ্যাকাউন্ট কানেক্ট করে `Tonni` রিপোজিটরিটি বেছে নিন।
4. সেটিংস কনফিগার করুন:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. **Deploy Web Service** এ ক্লিক করুন।
6. ডিপ্লয় শেষ হলে Render একটি HTTPS URL দেবে (যেমন: `https://tonni-app.onrender.com`)।
7. আপনি চাইলে Render-এর **Custom Domains** সেকশনে আপনার ডোমেন `tonni.rmfbd.online` যুক্ত করতে পারেন। এর ফলে ফ্রন্টএন্ড ও ব্যাকএন্ড একসাথে একই ডোমেনে চলবে এবং কোনো অতিরিক্ত কনফিগারেশন ছাড়াই কাজ করবে!

---

### বিকল্প ২: Vercel-এ ফ্রন্টএন্ড রাখা এবং Render-এ ব্যাকএন্ড চালানো
আপনি যদি ফ্রন্টএন্ড Vercel-এই রাখতে চান:
1. Render-এ শুধুমাত্র ব্যাকএন্ড ডিপ্লয় করুন (বিকল্প ১-এর মতো)।
2. Render থেকে প্রাপ্ত ব্যাকএন্ডের URL টি কপি করুন (যেমন: `https://tonni-backend.onrender.com`)।
3. [Vercel Dashboard](https://vercel.com) এ গিয়ে আপনার `Tonni` প্রজেক্টটি খুলুন।
4. **Settings** > **Environment Variables** এ যান।
5. একটি নতুন ভেরিয়েবল যুক্ত করুন:
   - **Key**: `VITE_SOCKET_URL`
   - **Value**: আপনার Render ব্যাকএন্ড URL (যেমন: `https://tonni-backend.onrender.com`)
6. এরপর Vercel-এর **Deployments** ট্যাবে গিয়ে **Redeploy** করুন।
7. এখন `https://tonni.rmfbd.online` সরাসরি Render-এর Socket.IO সার্ভারের সাথে যুক্ত হয়ে লাইভ চ্যাট ও কল করবে।

*(টিপস: ব্রাউজারে টেস্ট করতে আপনি সাময়িকভাবে URL-এ কুয়েরি প্যারামিটার দিয়েও চেক করতে পারেন: `https://tonni.rmfbd.online/?backend=https://YOUR-BACKEND.onrender.com`)*

---

## Android অ্যাপ (APK) — ইনস্টল ও সার্ভার কনফিগার

এই রিপোজিটরির সাথেই একটি **Installer Android অ্যাপ** আছে (Capacitor শেল + Vite বান্ডল)। ওয়েবসাইটের UI-ই ভিতরে চলে, শুধু নিচের নেটিভ ফিচারগুলো যোগ হয়েছে: হার্ডওয়্যার ব্যাক বাটন, `Downloads/Tonni/` ফোল্ডারে রেকর্ডিং সেভ, লঞ্চার আইকন ও স্প্ল্যাশ স্ক্রিন।

### APK কোথায় পাবেন

1. GitHub-এ রিপোজিটরি খুলে **Actions → Build Android APK** ট্যাবে যান।
2. সর্বশেষ সফল (✅) রানের ভিতরে **Artifacts** থেকে `tonni-debug-apk` ডাউনলোড করুন → ZIP খুললে `Tonni-1.2.0-debug.apk` পাবেন।
3. অথবা **Releases** পেজে `v*` ট্যাগের রিলিজ থেকে APK সরাসরি ডাউনলোড করুন (ব্রাউজারে সবচেয়ে সহজ)।
4. ফোনে APK ট্যাপ করে ইনস্টল করুন; "Install unknown apps" অনুমতি দিতে হবে।

> এটি **debug** কী দিয়ে সাইন করা — টেস্ট ও সাইডলোডের জন্য। Google Play-তে দেওয়ার আগে নিজের release keystore যোগ করুন।

### অ্যাপে সার্ভার (Socket.IO) সেট করা — খুব গুরুত্বপূর্ণ

ব্রাউজারে অ্যাপটি নিজের ডোমেন থেকেই সার্ভারে যায়, কিন্তু ইনস্টল করা অ্যাপ `https://localhost` থেকে চলে — তাই তাকে **সম্পূর্ণ HTTPS সার্ভার URL** দিতে হয়। অ্যাপে URL যেভাবে ঠিক হয় (প্রথমটি আগে):

1. `?backend=https://...` কুয়েরি প্যারামিটার,
2. অ্যাপের ভিতরে সেভ করা URL — **Settings → Data & Storage → Server URL**,
3. বিল্ডের সময়ের `VITE_SOCKET_URL` (ওয়ার্কফ্লোতে রিপোজিটরি variable `VITE_SOCKET_URL` বা `backend_url` ইনপুট),
4. ডিফল্ট: `https://tonni.rmfbd.online`।

যদি অ্যাপে চ্যাট "offline" দেখায়: **Settings → Data & Storage → Server URL** এ আপনার Render/Node HTTPS ব্যাকএন্ডের URL বসিয়ে **Save & reconnect** চাপুন — অ্যাপ রিলোড হয়ে কানেক্ট হবে। মনে রাখবেন, Vercel-এর মতো static হোস্টে Socket.IO চলবে না (কারণ উপরের সেকশনে ব্যাখ্যা করা হয়েছে)।

### নতুন APK বিল্ড করা (লোকালি)

```bash
npm ci
npm run android:sync    # vite build + বান্ডল android/ এ কপি
npm run android:apk     # -> android/app/build/outputs/apk/debug/app-debug.apk
```

প্রয়োজন: JDK 21 এবং Android SDK (platform 36, build-tools 36.0.0)। আইকন/স্প্ল্যাশ বদলাতে চাইলে `public/icon-512.png` বদলে `npm run android:assets` চালান — বাকিটা অটো জেনারেট হয়।

### ওয়ার্কফ্লো কী করে

`.github/workflows/android-apk.yml` প্রতিবার `main`/`arena/**`/`feature/**` ব্রাঞ্চে পুশ হলে (শুধু `.md` বাদে) চলে: টেস্ট → `vite build` → আইকন জেনারেট → `cap sync` → `assembleDebug` → APK আর্টিফ্যাক্ট আপলোড। `v1.2.0`-এর মতো ট্যাগ পুশ করলে, বা ম্যানুয়াল রানে `publish_release: true` দিলে, APK সরাসরি GitHub Release-এও যুক্ত হয়।

---

## Record screen (কল রেকর্ড) — যেভাবে কাজ করে

**কোথায় পাবেন:** ভিডিও বা অডিও কল চলার সময় নিচের কন্ট্রোল বারে `Record screen` বাটন (🎞 Film আইকন)।

1. কল চালু হলে `Record screen` এ ট্যাপ করুন → উপরে লাল `REC 00:12` ব্যাজ দেখাবে।
2. কল শেষ হলে বা `Stop & save` এ ট্যাপ দিলেই রেকর্ডিং থামবে।
3. ভিডিও ফাইলটি **সরাসরি ফোনের Download ফোল্ডারে** সেভ হয় (ফাইল নাম: `YouAndMe-<নাম>-<তারিখ-সময়>.mp4`)।
   - মোবাইল: ব্রাউজারের ডাউনলোড নোটিফিকেশন থেকে ফাইল খোলা যায়; ফাইল ফোনের নিজস্ব স্টোরেজেই থাকে।
   - ডেস্কটপ (Chrome/Edge): `Save as` উইন্ডো থেকে ফোল্ডার বেছে নেওয়া যায়।
4. সেভ হওয়ার পর নিচে একটি কার্ড আসে — সেখান থেকে আবার `Save to files`, `Share` (WhatsApp/Drive ইত্যাদি) বা `View recordings` করা যায়।
5. **Calls ট্যাব → Recordings** অথবা **Settings → Data & Storage → Call recordings** থেকে সব রেকর্ডিং দেখা, প্লে করা, আবার সেভ করা, শেয়ার করা বা ডিলিট করা যায় (IndexedDB-তে এই ডিভাইসেই সংরক্ষিত, সর্বশেষ ১২টি)।

### টেকনিক্যাল নোট
- মোবাইল ব্রাউজারে (Android Chrome / iPhone Safari) `getDisplayMedia` অর্থাৎ আসল "স্ক্রিন ক্যাপচার" API নেই। তাই রেকর্ডিং তৈরি হয় ক্যানভাস কম্পোজিট দিয়ে: সামনের ভিডিও (অপর প্রান্ত, অথবা আপনি স্ক্রিন শেয়ার করলে আপনার শেয়ার করা স্ক্রিন) + ছোট টাইলে আপনার ক্যামেরা + Web Audio দিয়ে দুই প্রান্তের গলা মিক্স করে `MediaRecorder` এ রেকর্ড।
- ফরম্যাট: সম্ভব হলে `video/mp4` (H.264/AAC — ফোনের গ্যালারিতে সরাসরি চলে), না হলে `video/webm`।
- ট্যাব পিছনে গেলেও ফ্রেম যেন না আটকে যায়, সেজন্য Worker টাইমার ব্যবহার করা হয়েছে।
- রেকর্ডিং **কোনো সার্ভারে আপলোড হয় না** — ফাইল শুধু এই ডিভাইসে থাকে। কল শেষ হলে রেকর্ডিং নিজে থেকেই থামে ও সেভ হয়।
- যাচাই: `npm test` (রেকর্ডার পাইপলাইন + কল UI রেন্ডার স্মোক টেস্ট, ব্রাউজার ছাড়াই চলে)।
