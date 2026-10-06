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
