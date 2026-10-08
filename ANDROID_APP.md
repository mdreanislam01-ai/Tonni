# Tonni Android APK — GitHub Actions দিয়ে বিল্ড গাইড

এই রিপোজিটরি থেকে এখন **অ্যান্ড্রয়েড APK** বানানো যায়, সম্পূর্ণ **GitHub Actions** দিয়ে — আপনার কম্পিউটারে Android Studio বা Java ইনস্টল করা লাগবে না।

অ্যাপটি **Capacitor** দিয়ে মোড়ানো (wrap): ভেতরে সেই একই React ওয়েব অ্যাপ (চ্যাট, কল, রেকর্ডিং — সব) চলে একটি নেটিভ Android WebView-এ।

---

## APK ফাইল কীভাবে পাবেন (২ ভাবে)

### উপায় ১: GitHub-এ ম্যানুয়ালি রান করুন (সবচেয়ে সহজ)

1. GitHub-এ এই রিপোর **Actions** ট্যাবে যান।
2. বাম পাশের তালিকা থেকে **Build Android APK** সিলেক্ট করুন।
3. ডান পাশে **Run workflow** বাটনে ক্লিক করুন।
4. ইচ্ছা হলে ইনপুট দিন (না দিলেও ডিফল্ট দিয়েই চলবে):
   - **server_url** — আপনার চালু সার্ভারের URL (যেমন `https://tonni.rmfbd.online`)। APK এই সার্ভারের সাথে কানেক্ট হবে।
   - **version_name / version_code** — অ্যাপের ভার্সন (ডিফল্ট: `package.json` থেকে / GitHub run number)।
   - **build_type** — `release` (ডিফল্ট) বা `debug`।
5. **Run workflow** → কয়েক মিনিট অপেক্ষা করুন।
6. রান শেষ হলে সেই রানের পেজের নিচে **Artifacts** সেকশনে **Tonni-APK** দেখাবে → ডাউনলোড করে ফোনে ইনস্টল করুন।

### উপায় ২: নতুন ট্যাগ দিলে অটো বিল্ড + Release

```bash
git tag v1.1.0
git push origin v1.1.0
```

বিল্ড শেষ হলে APK ফাইলটি রিপোর **Releases** সেকশনে ঝুলে যাবে — সেখান থেকে যে কেউ ডাউনলোড করতে পারবে।

---

## সার্ভার URL পরিবর্তন করবেন যেভাবে

APK-র ভেতরে বিল্ড করার সময় সার্ভারের ঠিকানা বসে যায়। প্রায়োরিটি:

1. workflow চালানোর সময় **server_url** ইনপুট (সবচেয়ে সহজ)
2. রিপো ভেরিয়েবল **TONNI_SERVER_URL** — Settings → Secrets and variables → Actions → **Variables** ট্যাবে যোগ করুন (একবার সেট করলে প্রতিবার অটো ব্যবহৃত হবে)
3. ডিফল্ট: `https://tonni.rmfbd.online`

সার্ভার URL বদলাতে APK আবার বিল্ড করতে হয় (নতুন রান = নতুন APK)।

---

## সাইনিং (Play Store-এ দিতে চাইলে)

কোনো secret ছাড়া বিল্ড করলে APK **debug key** দিয়ে সাইন হয় — যেকোনো ফোনে ইনস্টল হবে, শুধু Play Store-এ দেওয়া যাবে না। নিজের কীস্টোর দিয়ে সাইন করতে রিপোর এই **Secrets** যোগ করুন (Settings → Secrets and variables → Actions → Secrets):

| Secret | মান |
| --- | --- |
| `KEYSTORE_BASE64` | আপনার `.jks`/`.keystore` ফাইলের base64: `base64 -w0 my.keystore` |
| `KEYSTORE_PASSWORD` | কীস্টোরের পাসওয়ার্ড |
| `KEYSTORE_ALIAS` | কী-এর alias |
| `KEYSTORE_KEY_PASSWORD` | কী পাসওয়ার্ড (খালি রাখলে KEYSTORE_PASSWORD ব্যবহৃত হয়) |

> ⚠️ কীস্টোর ফাইল কখনো রিপোতে কমিট করবেন না — শুধু secret হিসেবে দিন।

---

## APK-তে কী কী কাজ করে

- ✅ গেস্ট চ্যাট, ফাইল/ইমেজ/ভয়েস মেসেজ, টাইপিং/ডেলিভারি/রিড স্ট্যাটাস
- ✅ অডিও/ভিডিও কল (WebRTC) — প্রথম কলে ফোন ক্যামেরা/মাইক্রোফোন পারমিশন চাইবে
- ✅ কল রেকর্ডিং ও ইন-অ্যাপ রেকর্ডিংস লাইব্রেরি
- ✅ প্রোফাইল, কন্টাক্ট, থিম, সব লোকাল সেটিংস
- ✅ ফাইল সেভ/শেয়ার — Android এর নেটিভ **Share sheet** খোলে (সেখান থেকে Downloads, Drive, Messenger ইত্যাদিতে পাঠানো যায়)

### ওয়েবসাইটের সাথে পার্থক্য (সীমাবদ্ধতা)

- ⚠️ **ব্যাকগ্রাউন্ড Web Push**: Android-এর WebView-তে ব্রাউজারের মতো Web Push নেই। তাই অ্যাপ বন্ধ থাকা অবস্থায় সিস্টেম নোটিফিকেশনে মেসেজ অ্যালার্ট আসবে না। অ্যাপ খোলা বা সাম্প্রতিক (recent apps) থাকলে সকেটের মাধ্যমে সব মেসেজ/কল ঠিকই আসে। সত্যিকারের OS লেভেল পুশ চাইলে FCM ইন্টিগ্রেশন লাগবে (ভবিষ্যতে যোগ করা যাবে)।
- ⚠️ **স্ক্রিন শেয়ার কল**: ব্রাউজারের `getDisplayMedia` WebView-তে নেই, তাই কলে নিজের ফোনের স্ক্রিন শেয়ার করা যাবে না (সামনের পাশের স্ক্রিন দেখা ও রেকর্ডিং কাজ করে)।
- ⚠️ রেকর্ডিং "ডাউনলোড" বাটন সরাসরি Downloads ফোল্ডারে লেখে না — বদলে শেয়ার শিট খোলে, সেখান থেকে **Save to Files/Drive** করলেই সেভ হয়।

---

## নিজের কম্পিউটারে বিল্ড করতে চাইলে (ঐচ্ছিক)

দরকার: Node.js 20+, JDK 17, Android SDK (Android Studio)।

```bash
npm install
npm run android:sync     # dist তৈরি করে android প্রজেক্টে কপি করে
cd android && ./gradlew assembleDebug   # android/app/build/outputs/apk/debug/
```

সার্ভার URL দিয়ে বিল্ড: `VITE_SOCKET_URL=https://your-server.example.com npm run android:sync`

আইকন পরিবর্তন করলে: `public/icon-512.png` বদলে `node scripts/make-android-icons.mjs` চালান।

---

## কারিগরি খুঁটিনাটি

- প্যাকেজ আইডি: `online.rmfbd.tonni` · অ্যাপের নাম: **Tonni** (`capacitor.config.json` / `android/` এ পরিবর্তনযোগ্য)
- minSdk 22 (Android 5.1+) · targetSdk 34
- Workflow ফাইল: `.github/workflows/build-apk.yml`
- ওয়েব বান্ডল বদলালেই যথেষ্ট — workflow প্রতিবার `npx cap sync android` চালিয়ে সদ্য বিল্ড করা ওয়েব UI করে APK-তে ঢোকায়
