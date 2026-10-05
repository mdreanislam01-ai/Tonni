import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  Copy,
  FileText,
  Globe,
  Image as ImageIcon,
  Info,
  MessageCircle,
  MessagesSquare,
  Mic,
  MicOff,
  Moon,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Pin,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'you-and-me.local.v1';
const ID_PATTERN = /^YM-[A-Z0-9]{6}$/;
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QUICK_EMOJIS = ['😀', '🥰', '😂', '😊', '❤️', '👍', '🙌', '🔥', '🙏', '😘', '🤔', '🎉', '✨', '💚', '👏', '😎'];
const AVATAR_COLORS = [
  ['#c7f4e4', '#2f9679'],
  ['#e8dbff', '#8057c8'],
  ['#ffe3cf', '#db8054'],
  ['#d3e9ff', '#4e84bd'],
  ['#ffe0e6', '#c8677a'],
  ['#e9edca', '#879244'],
  ['#d9e5ff', '#687fc0'],
];

const words = {
  bn: {
    tagline: 'কাছের মানুষ, কাছের কথা', chats: 'চ্যাট', calls: 'কল', contacts: 'পরিচিতি',
    online: 'অনলাইন', offline: 'অফলাইন', connecting: 'সংযোগ হচ্ছে…', connected: 'সংযুক্ত',
    reconnecting: 'আবার সংযোগ হচ্ছে…', all: 'সব', unread: 'নতুন', search: 'খুঁজুন',
    searchPlaceholder: 'চ্যাট বা পরিচিতি খুঁজুন', newChat: 'নতুন চ্যাট', addContact: 'ID দিয়ে যোগ করুন',
    saved: 'সেভড মেসেজ', savedSub: 'শুধু আপনার জন্য', noChats: 'এখনও কোনো চ্যাট নেই',
    noChatsHint: 'পরিচিতির You & Me ID দিয়ে নতুন কথোপকথন শুরু করুন।',
    localRoom: 'আপনার ব্যক্তিগত জায়গা', localRoomHint: 'নিজের জন্য নোট বা লিংক এখানে লিখে রাখুন। এগুলো এই ডিভাইসেই থাকে।',
    welcomeTitle: 'কথা শুরু হোক', welcomeHint: 'রেজিস্ট্রেশন বা ফোন নম্বর লাগবে না। আপনার ID শেয়ার করুন, অথবা পরিচিতির ID দিয়ে নতুন চ্যাট খুলুন।',
    yourId: 'আপনার You & Me ID', copyId: 'ID কপি', shareInvite: 'আমার ID শেয়ার করুন',
    typeMessage: 'একটি মেসেজ লিখুন…', send: 'পাঠান', attach: 'ফাইল যুক্ত করুন', emoji: 'ইমোজি',
    voiceMessage: 'ভয়েস মেসেজ', recording: 'রেকর্ড হচ্ছে', tapToStop: 'থামাতে আবার চাপুন',
    startConversation: 'কথোপকথন শুরু করুন', emptyChatHint: 'এখানে পাঠানো মেসেজ এই ডিভাইসে সেভ হবে।',
    today: 'আজ', yesterday: 'গতকাল', you: 'আপনি', privateSpace: 'ব্যক্তিগত নোট',
    newChatHint: 'বন্ধুর You & Me ID লিখুন। অ্যাকাউন্ট খুলতে হবে না।',
    idPlaceholder: 'যেমন YM-A7K4Q9', nameOptional: 'নাম (ঐচ্ছিক)', namePlaceholder: 'পরিচিতির নাম',
    startChat: 'চ্যাট শুরু করুন', cancel: 'বাতিল', close: 'বন্ধ করুন', invalidId: 'সঠিক ID দিন — যেমন YM-A7K4Q9', noConnection: 'পরিচয় যাচাই করা যায়নি। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।',
    onlineNow: 'এখন অনলাইন', yourContacts: 'আপনার পরিচিতি', noOnline: 'এখন পরিচিত কেউ অনলাইনে নেই',
    noContacts: 'পরিচিতি যোগ করা হয়নি', onlineListHint: 'বন্ধুরা অনলাইনে এলে এখানে দেখা যাবে।',
    callHistory: 'সাম্প্রতিক কল', noCalls: 'এখনও কোনো কল নেই', noCallsHint: 'চ্যাট থেকে ভয়েস বা ভিডিও কল শুরু করুন।',
    voiceCall: 'ভয়েস কল', videoCall: 'ভিডিও কল', incomingCall: 'ইনকামিং কল', outgoingCall: 'আউটগোয়িং কল',
    incoming: 'আসছে', outgoing: 'আপনি করেছেন', missed: 'মিসড কল', declined: 'কল কেটে দিয়েছেন',
    answer: 'রিসিভ', decline: 'বাতিল', endCall: 'কল শেষ', mute: 'মিউট', unmute: 'আনমিউট',
    cameraOff: 'ক্যামেরা বন্ধ', cameraOn: 'ক্যামেরা চালু', ringing: 'রিং হচ্ছে…', connectingCall: 'সংযোগ হচ্ছে…',
    callConnected: 'কথা হচ্ছে', callEnded: 'কল শেষ হয়েছে', callOffline: 'এই মুহূর্তে পরিচিতি অনলাইনে নেই।',
    callBusy: 'পরিচিতি অন্য কলে আছেন।', callMediaError: 'মাইক্রোফোন বা ক্যামেরার অনুমতি দিন, তারপর আবার চেষ্টা করুন।',
    settings: 'সেটিংস', profile: 'প্রোফাইল', displayName: 'আপনার নাম', save: 'সেভ করুন',
    appearance: 'দেখতে কেমন হবে', light: 'লাইট', dark: 'ডার্ক', language: 'ভাষা', bengali: 'বাংলা', english: 'English',
    notifications: 'নোটিফিকেশন', enableNotifications: 'ব্রাউজার নোটিফিকেশন চালু করুন', sound: 'মেসেজের সাউন্ড',
    privacy: 'প্রাইভেসি', privacyHint: 'You & Me-তে অ্যাকাউন্ট, ফোন নম্বর বা পাসওয়ার্ড লাগে না। আপনার ID-ই পরিচিতির ঠিকানা।',
    saveOnDevice: 'চ্যাট হিস্ট্রি এই ডিভাইসে সেভ হয়', inviteLink: 'ইনভাইট লিংক কপি', settingsHint: 'আপনার পছন্দ এই ডিভাইসেই রাখা হয়।',
    copied: 'কপি হয়েছে', copyFailed: 'কপি করা যায়নি', nameSaved: 'নাম সেভ হয়েছে', messageSaved: 'মেসেজ পাঠানো হয়েছে',
    pinned: 'পিন করা হয়েছে', unpinned: 'আনপিন করা হয়েছে', pinChat: 'চ্যাট পিন করুন', unpinChat: 'চ্যাট আনপিন করুন',
    clearChat: 'চ্যাট হিস্ট্রি মুছুন', clearConfirm: 'এই ডিভাইস থেকে এই চ্যাটের মেসেজ মুছে ফেলবেন?',
    attachmentTooLarge: 'ফাইলটি ৪৫০ KB-এর চেয়ে ছোট হতে হবে।', unsupportedRecording: 'এই ব্রাউজারে ভয়েস রেকর্ডিং নেই।',
    messagePending: 'পাঠানোর অপেক্ষায়', messageSent: 'পাঠানো হয়েছে', messageDelivered: 'পৌঁছেছে', messageRead: 'দেখেছেন',
    shareText: 'You & Me-তে আমাকে চ্যাট করুন', guest: 'অতিথি', youAndMe: 'You & Me', noSignup: 'অ্যাকাউন্ট লাগবে না',
    contactOffline: 'অফলাইনে — মেসেজ পাঠালে অনলাইনে এলে পেয়ে যাবেন', tapToChat: 'মেসেজ পাঠাতে লিখুন',
    message: 'মেসেজ', file: 'ফাইল', audio: 'অডিও', noResults: 'কিছু পাওয়া যায়নি',
    attachPhoto: 'ছবি বা ফাইল', newContact: 'পরিচিতি যোগ করুন', myProfile: 'আমার প্রোফাইল',
    hide: 'লুকান', localOnly: 'শুধু এই ডিভাইসে', startNew: 'নতুন কথোপকথন',
  },
  en: {
    tagline: 'Closer people, closer conversations', chats: 'Chats', calls: 'Calls', contacts: 'Contacts',
    online: 'Online', offline: 'Offline', connecting: 'Connecting…', connected: 'Connected',
    reconnecting: 'Reconnecting…', all: 'All', unread: 'Unread', search: 'Search',
    searchPlaceholder: 'Search chats or contacts', newChat: 'New chat', addContact: 'Add by ID',
    saved: 'Saved messages', savedSub: 'Just for you', noChats: 'No chats yet',
    noChatsHint: 'Start a conversation with a contact’s You & Me ID.',
    localRoom: 'Your private space', localRoomHint: 'Keep notes and links for yourself here. They stay on this device.',
    welcomeTitle: 'Let’s get talking', welcomeHint: 'No registration or phone number. Share your ID, or enter a contact’s ID to start chatting.',
    yourId: 'Your You & Me ID', copyId: 'Copy ID', shareInvite: 'Share my ID',
    typeMessage: 'Write a message…', send: 'Send', attach: 'Attach a file', emoji: 'Emoji',
    voiceMessage: 'Voice message', recording: 'Recording', tapToStop: 'Tap again to stop',
    startConversation: 'Start the conversation', emptyChatHint: 'Messages you send here are saved on this device.',
    today: 'Today', yesterday: 'Yesterday', you: 'You', privateSpace: 'Private notes',
    newChatHint: 'Enter your contact’s You & Me ID. No account is needed.',
    idPlaceholder: 'For example, YM-A7K4Q9', nameOptional: 'Name (optional)', namePlaceholder: 'Contact name',
    startChat: 'Start chat', cancel: 'Cancel', close: 'Close', invalidId: 'Enter a valid ID, for example YM-A7K4Q9', noConnection: 'Your guest ID could not be verified. Refresh and try again.',
    onlineNow: 'Online now', yourContacts: 'Your contacts', noOnline: 'No contacts are online right now',
    noContacts: 'No contacts added', onlineListHint: 'Your friends will show here when they come online.',
    callHistory: 'Recent calls', noCalls: 'No calls yet', noCallsHint: 'Start a voice or video call from a chat.',
    voiceCall: 'Voice call', videoCall: 'Video call', incomingCall: 'Incoming call', outgoingCall: 'Outgoing call',
    incoming: 'Incoming', outgoing: 'Outgoing', missed: 'Missed call', declined: 'Call declined',
    answer: 'Answer', decline: 'Decline', endCall: 'End call', mute: 'Mute', unmute: 'Unmute',
    cameraOff: 'Camera off', cameraOn: 'Camera on', ringing: 'Ringing…', connectingCall: 'Connecting…',
    callConnected: 'Connected', callEnded: 'Call ended', callOffline: 'This contact is not online right now.',
    callBusy: 'This contact is already on a call.', callMediaError: 'Allow microphone or camera access, then try again.',
    settings: 'Settings', profile: 'Profile', displayName: 'Your name', save: 'Save',
    appearance: 'Appearance', light: 'Light', dark: 'Dark', language: 'Language', bengali: 'বাংলা', english: 'English',
    notifications: 'Notifications', enableNotifications: 'Enable browser notifications', sound: 'Message sound',
    privacy: 'Privacy', privacyHint: 'You & Me does not need an account, phone number, or password. Your ID is your contact address.',
    saveOnDevice: 'Chat history is saved on this device', inviteLink: 'Copy invite link', settingsHint: 'Your preferences stay on this device.',
    copied: 'Copied', copyFailed: 'Could not copy', nameSaved: 'Name saved', messageSaved: 'Message sent',
    pinned: 'Chat pinned', unpinned: 'Chat unpinned', pinChat: 'Pin chat', unpinChat: 'Unpin chat',
    clearChat: 'Clear chat history', clearConfirm: 'Clear this chat’s messages from this device?',
    attachmentTooLarge: 'Please choose a file smaller than 450 KB.', unsupportedRecording: 'Voice recording is not available in this browser.',
    messagePending: 'Waiting to send', messageSent: 'Sent', messageDelivered: 'Delivered', messageRead: 'Seen',
    shareText: 'Chat with me on You & Me', guest: 'Guest', youAndMe: 'You & Me', noSignup: 'No sign-up required',
    contactOffline: 'Offline — they’ll receive your message when they come online', tapToChat: 'Write a message to chat',
    message: 'Message', file: 'File', audio: 'Audio', noResults: 'Nothing found',
    attachPhoto: 'Photo or file', newContact: 'Add a contact', myProfile: 'My profile',
    hide: 'Hide', localOnly: 'This device only', startNew: 'Start a new conversation',
  },
};

function randomToken(length) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => ID_CHARS[byte % ID_CHARS.length]).join('');
}

function createIdentity() {
  const id = `YM-${randomToken(6)}`;
  const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}-${Math.random()}`;
  return { id, key: `${key}-${randomToken(18)}` };
}

function makeSavedChat() {
  return {
    id: 'saved',
    peerId: '',
    name: 'Saved messages',
    kind: 'saved',
    messages: [],
    unread: 0,
    pinned: true,
    updatedAt: Date.now(),
  };
}

function createDefaultApp() {
  const identity = createIdentity();
  return {
    identity,
    profile: { name: `Guest ${identity.id.slice(-4)}` },
    chats: [makeSavedChat()],
    calls: [],
    settings: { theme: 'light', language: 'bn', notifications: false, sound: true },
  };
}

function readStoredApp() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!ID_PATTERN.test(value?.identity?.id ?? '') || String(value?.identity?.key ?? '').length < 20) return createDefaultApp();
    const saved = Array.isArray(value.chats) ? value.chats : [];
    const chats = saved.some((chat) => chat.id === 'saved') ? saved : [makeSavedChat(), ...saved];
    return {
      ...createDefaultApp(),
      ...value,
      profile: { name: `Guest ${value.identity.id.slice(-4)}`, ...(value.profile ?? {}) },
      chats,
      calls: Array.isArray(value.calls) ? value.calls.slice(0, 60) : [],
      settings: { theme: 'light', language: 'bn', notifications: false, sound: true, ...(value.settings ?? {}) },
    };
  } catch {
    return createDefaultApp();
  }
}

function parseGuestId(value) {
  const text = String(value ?? '').trim().toUpperCase();
  const match = text.match(/YM-[A-Z0-9]{6}/);
  return match?.[0] ?? '';
}

function initials(value = '') {
  const bits = value.trim().split(/\s+/).filter(Boolean);
  if (!bits.length) return 'Y';
  return `${bits[0][0] ?? 'Y'}${bits.length > 1 ? bits[bits.length - 1][0] : ''}`.toUpperCase();
}

function colorFor(value = '') {
  const hash = [...value].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function makeUuid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(value, language = 'bn') {
  try {
    return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatDay(value, language = 'bn') {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return words[language].today;
  if (date.toDateString() === yesterday.toDateString()) return words[language].yesterday;
  try {
    return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' }).format(date);
  } catch {
    return '';
  }
}

function previewText(message, t) {
  if (!message) return t.savedSub;
  if (message.type === 'audio') return `♪ ${t.voiceMessage}`;
  if (message.type === 'image') return `▧ ${t.file}`;
  if (message.type === 'file') return `▤ ${message.attachment?.name || t.file}`;
  return message.text || t.message;
}

function Avatar({ name, id = '', saved = false, size = 'md', online = false }) {
  const [background, foreground] = colorFor(id || name);
  return (
    <span className={`avatar avatar-${size} ${saved ? 'avatar-saved' : ''}`} style={{ '--avatar-bg': background, '--avatar-fg': foreground }}>
      {saved ? <MessageCircle size={size === 'sm' ? 15 : 19} strokeWidth={2.2} /> : <span>{initials(name)}</span>}
      {online && <i className="avatar-online" />}
    </span>
  );
}

function BrandMark({ small = false }) {
  return (
    <span className={`brand-mark ${small ? 'brand-mark-small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M7 13.5A6.5 6.5 0 0 1 13.5 7h15a6.5 6.5 0 0 1 6.5 6.5v7a6.5 6.5 0 0 1-6.5 6.5H21l-7.5 5v-5.15A6.5 6.5 0 0 1 7 20.5v-7Z" fill="white" />
        <path d="M18 27.5A6.5 6.5 0 0 1 24.5 21h10a6.5 6.5 0 0 1 6.5 6.5v5a6.5 6.5 0 0 1-4.7 6.24V43l-6.8-4.5h-5A6.5 6.5 0 0 1 18 32v-4.5Z" fill="#C7FFEA" />
      </svg>
    </span>
  );
}

function App() {
  const [app, setApp] = useState(readStoredApp);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('chats');
  const [selectedChatId, setSelectedChatId] = useState('saved');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [messageText, setMessageText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [modal, setModal] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [typingPeers, setTypingPeers] = useState({});
  const [callState, setCallState] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const socketRef = useRef(null);
  const latestAppRef = useRef(app);
  latestAppRef.current = app;
  const selectedChatRef = useRef(selectedChatId);
  selectedChatRef.current = selectedChatId;
  const connectionRef = useRef(connectionStatus);
  connectionRef.current = connectionStatus;
  const callRef = useRef(callState);
  callRef.current = callState;
  const receiveMessageRef = useRef(null);
  const callSignalRef = useRef(null);
  const incomingCallRef = useRef(null);
  const toastRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteIceRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const pendingAnswerRef = useRef(null);
  const offerInFlightRef = useRef(false);
  const messageEndRef = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const typingPeerTimersRef = useRef({});
  const inviteHandledRef = useRef(false);

  const language = app.settings.language === 'en' ? 'en' : 'bn';
  const t = words[language];
  const selectedChat = app.chats.find((chat) => chat.id === selectedChatId) ?? app.chats.find((chat) => chat.id === 'saved') ?? null;
  const selectedIsOnline = Boolean(selectedChat?.peerId && onlineUsers.some((user) => user.id === selectedChat.peerId));
  const otherOnlineUsers = onlineUsers.filter((user) => user.id !== app.identity.id);
  const directChats = app.chats.filter((chat) => chat.kind !== 'saved');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
    } catch {
      // Private browsing or a full local store should not prevent messaging.
    }
  }, [app]);

  function showToast(message) {
    setToast(message);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2600);
  }

  function setCurrentCall(next) {
    const value = typeof next === 'function' ? next(callRef.current) : next;
    callRef.current = value;
    setCallState(value);
  }

  function patchMessageStatus(messageId, status) {
    setApp((current) => ({
      ...current,
      chats: current.chats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((message) => message.id === messageId ? { ...message, status } : message),
      })),
    }));
  }

  function receiveRemoteMessage(message) {
    if (!message?.fromId || !message.id) return;
    const isActive = selectedChatRef.current === message.fromId && document.visibilityState === 'visible';
    setApp((current) => {
      const existingChat = current.chats.find((chat) => chat.peerId === message.fromId);
      const newChat = existingChat ?? {
        id: message.fromId,
        peerId: message.fromId,
        name: message.senderName || `${t.guest} ${message.fromId.slice(-4)}`,
        kind: 'direct',
        messages: [],
        unread: 0,
        pinned: false,
        updatedAt: Date.now(),
      };
      if (newChat.messages.some((item) => item.id === message.id)) return current;
      const received = { ...message, status: 'delivered' };
      const updated = {
        ...newChat,
        name: newChat.customName ? newChat.name : message.senderName || newChat.name,
        messages: [...newChat.messages, received].slice(-180),
        unread: isActive ? 0 : (newChat.unread ?? 0) + 1,
        updatedAt: Number(message.createdAt) || Date.now(),
      };
      const chats = existingChat
        ? current.chats.map((chat) => chat.id === existingChat.id ? updated : chat)
        : [updated, ...current.chats];
      return { ...current, chats };
    });

    socketRef.current?.emit('message:delivered', { id: message.id, fromId: message.fromId });
    if (isActive) socketRef.current?.emit('chat:read', { peerId: message.fromId });
    else {
      const settings = latestAppRef.current.settings;
      if (settings.notifications && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(message.senderName || 'You & Me', { body: message.text || message.attachment?.name || t.message });
        } catch {
          // Browser notifications are an optional enhancement.
        }
      }
      if (settings.sound) playMessageSound();
    }
  }
  receiveMessageRef.current = receiveRemoteMessage;

  async function handleCallSignal(payload) {
    const currentCall = callRef.current;
    if (!currentCall || currentCall.callId !== payload?.callId || !payload.signal) return;
    const signal = payload.signal;
    const pc = peerConnectionRef.current;

    try {
      if (signal.type === 'offer') {
        pendingOfferRef.current = signal.sdp;
        if (!pc || currentCall.direction !== 'incoming') return;
        await applyIncomingOffer(payload.callId, signal.sdp);
      } else if (signal.type === 'answer') {
        if (!pc) {
          pendingAnswerRef.current = signal.sdp;
          return;
        }
        if (!pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await flushRemoteIce(pc);
        }
      } else if (signal.type === 'ice' && signal.candidate) {
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          remoteIceRef.current.push(signal.candidate);
        }
      }
    } catch {
      // ICE candidates can arrive after a peer has already closed the call.
    }
  }
  callSignalRef.current = handleCallSignal;

  function handleIncomingCall(payload) {
    if (callRef.current) {
      socketRef.current?.emit('call:respond', { callId: payload.callId, accepted: false, reason: 'busy' });
      return;
    }
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    remoteIceRef.current = [];
    setCurrentCall({
      callId: payload.callId,
      peerId: payload.fromId,
      peerName: payload.fromName || `${t.guest} ${payload.fromId.slice(-4)}`,
      kind: payload.kind === 'video' ? 'video' : 'audio',
      direction: 'incoming',
      status: 'ringing',
      startedAt: Date.now(),
      localStream: null,
      remoteStream: null,
      muted: false,
      videoOff: false,
    });
  }
  incomingCallRef.current = handleIncomingCall;

  useEffect(() => {
    const socket = io({ autoConnect: false, reconnection: true, timeout: 8000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connecting');
      socket.emit('guest:register', {
        id: app.identity.id,
        key: app.identity.key,
        name: latestAppRef.current.profile.name,
      }, (result) => {
        if (!result?.ok) {
          setConnectionStatus('offline');
          if (result?.error === 'identity-in-use') showToast(t.noConnection);
          return;
        }
        setConnectionStatus('connected');
        setOnlineUsers(result.online ?? []);
        (result.inbox ?? []).forEach((message) => receiveMessageRef.current?.(message));

        latestAppRef.current.chats.forEach((chat) => {
          if (chat.kind === 'saved') return;
          chat.messages.filter((message) => message.fromId === app.identity.id && message.status === 'pending').forEach((message) => {
            socket.emit('message:send', { ...message, toId: chat.peerId }, (ack) => {
              if (ack?.ok) patchMessageStatus(message.id, ack.status || 'sent');
            });
          });
        });
      });
    });
    socket.on('disconnect', () => {
      setConnectionStatus('offline');
      setOnlineUsers([]);
    });
    socket.on('connect_error', () => setConnectionStatus('offline'));
    socket.on('presence:update', (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
      setApp((current) => {
        let changed = false;
        const chats = current.chats.map((chat) => {
          if (chat.kind === 'saved') return chat;
          const match = users?.find((user) => user.id === chat.peerId);
          if (match && chat.name !== match.name && (!chat.customName || chat.name.startsWith('Guest '))) {
            changed = true;
            return { ...chat, name: match.name };
          }
          return chat;
        });
        return changed ? { ...current, chats } : current;
      });
    });
    socket.on('message:receive', (message) => receiveMessageRef.current?.(message));
    socket.on('message:status', ({ id, status }) => patchMessageStatus(id, status));
    socket.on('chat:read', ({ byId }) => {
      setApp((current) => ({
        ...current,
        chats: current.chats.map((chat) => chat.peerId === byId ? {
          ...chat,
          messages: chat.messages.map((message) => message.fromId === current.identity.id ? { ...message, status: 'read' } : message),
        } : chat),
      }));
    });
    socket.on('typing:update', ({ fromId, active }) => {
      if (!fromId) return;
      setTypingPeers((current) => ({ ...current, [fromId]: Boolean(active) }));
      clearTimeout(typingPeerTimersRef.current[fromId]);
      if (active) {
        typingPeerTimersRef.current[fromId] = setTimeout(() => {
          setTypingPeers((current) => ({ ...current, [fromId]: false }));
        }, 2400);
      }
    });
    socket.on('call:incoming', (payload) => incomingCallRef.current?.(payload));
    socket.on('call:signal', (payload) => callSignalRef.current?.(payload));
    socket.on('call:response', ({ callId, accepted, reason }) => {
      if (callRef.current?.callId !== callId) return;
      if (accepted) {
        setCurrentCall((current) => current ? { ...current, status: 'connecting' } : current);
      } else {
        if (reason === 'busy') showToast(t.callBusy);
        closeCall(reason === 'busy' ? 'missed' : 'declined', false);
      }
    });
    socket.on('call:ended', ({ callId }) => {
      if (callRef.current?.callId === callId) closeCall('ended', false);
    });

    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
    // One guest socket per browser profile. Name changes are sent by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.identity.id, app.identity.key]);

  useEffect(() => {
    if (socketRef.current?.connected) socketRef.current.emit('guest:update', { name: app.profile.name });
  }, [app.profile.name]);

  useEffect(() => {
    const inviteId = parseGuestId(new URLSearchParams(window.location.search).get('to'));
    if (!inviteHandledRef.current && inviteId && inviteId !== app.identity.id) {
      inviteHandledRef.current = true;
      openPeer(inviteId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [app.identity.id]);

  useEffect(() => {
    if (activeTab !== 'chats') return;
    if (selectedChat?.peerId) {
      setApp((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === selectedChat.id ? { ...chat, unread: 0 } : chat) }));
      socketRef.current?.emit('chat:read', { peerId: selectedChat.peerId });
    }
  }, [selectedChatId, activeTab]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selectedChat?.messages?.length, selectedChatId, typingPeers[selectedChat?.peerId]]);

  useEffect(() => () => {
    if (toastRef.current) clearTimeout(toastRef.current);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    Object.values(typingPeerTimersRef.current).forEach(clearTimeout);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
  }, []);

  function updateSettings(partial) {
    setApp((current) => ({ ...current, settings: { ...current.settings, ...partial } }));
  }

  function updateDisplayName(name) {
    setApp((current) => ({ ...current, profile: { ...current.profile, name: name.trim().slice(0, 40) || 'You' } }));
  }

  function openPeer(peerId, suggestedName = '') {
    const id = parseGuestId(peerId);
    if (!ID_PATTERN.test(id)) {
      showToast(t.invalidId);
      return;
    }
    if (id === latestAppRef.current.identity.id) {
      setSelectedChatId('saved');
      setActiveTab('chats');
      setMobileChatOpen(true);
      return;
    }
    const online = onlineUsers.find((user) => user.id === id);
    const initialName = suggestedName.trim() || online?.name || `${t.guest} ${id.slice(-4)}`;
    setApp((current) => {
      const found = current.chats.find((chat) => chat.peerId === id);
      if (found) {
        if (suggestedName.trim() && found.name !== suggestedName.trim()) {
          return { ...current, chats: current.chats.map((chat) => chat.id === found.id ? { ...chat, name: suggestedName.trim(), customName: true } : chat) };
        }
        return current;
      }
      const chat = {
        id,
        peerId: id,
        name: initialName,
        customName: Boolean(suggestedName.trim()),
        kind: 'direct',
        messages: [],
        unread: 0,
        pinned: false,
        updatedAt: Date.now(),
      };
      return { ...current, chats: [chat, ...current.chats] };
    });
    setSelectedChatId(id);
    setActiveTab('chats');
    setMobileChatOpen(true);
    socketRef.current?.emit('guest:lookup', { id }, (result) => {
      if (result?.online && result.name && !suggestedName.trim()) {
        setApp((current) => ({
          ...current,
          chats: current.chats.map((chat) => chat.peerId === id && !chat.customName ? { ...chat, name: result.name } : chat),
        }));
      }
    });
  }

  function chooseTab(tab) {
    setActiveTab(tab);
    setMobileChatOpen(tab !== 'chats');
    setDetailsOpen(false);
  }

  const visibleChats = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return [...app.chats]
      .sort((a, b) => a.kind === 'saved' ? -1 : b.kind === 'saved' ? 1 : a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter((chat) => filter !== 'unread' || chat.unread > 0)
      .filter((chat) => !query || `${chat.name} ${chat.peerId}`.toLowerCase().includes(query));
  }, [app.chats, filter, searchTerm]);

  function updateChat(chatId, updater) {
    setApp((current) => ({
      ...current,
      chats: current.chats.map((chat) => chat.id === chatId ? updater(chat) : chat),
    }));
  }

  function sendToChat(chatId, payload) {
    const current = latestAppRef.current;
    const chat = current.chats.find((item) => item.id === chatId);
    if (!chat) return;
    const outgoing = {
      id: makeUuid(),
      fromId: current.identity.id,
      toId: chat.peerId || current.identity.id,
      text: payload.text || '',
      type: payload.type || 'text',
      attachment: payload.attachment ?? null,
      createdAt: Date.now(),
      status: chat.kind === 'saved' ? 'read' : 'pending',
    };
    setApp((state) => ({
      ...state,
      chats: state.chats.map((item) => item.id === chatId ? {
        ...item,
        messages: [...item.messages, outgoing].slice(-180),
        unread: 0,
        updatedAt: outgoing.createdAt,
      } : item),
    }));

    if (chat.kind === 'saved') {
      showToast(t.messageSaved);
      return;
    }
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit('message:send', outgoing, (result) => {
      if (result?.ok) patchMessageStatus(outgoing.id, result.status || 'sent');
      else patchMessageStatus(outgoing.id, 'pending');
    });
  }

  function stopTyping() {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingActiveRef.current && selectedChat?.peerId) {
      socketRef.current?.emit('typing:update', { toId: selectedChat.peerId, active: false });
    }
    typingActiveRef.current = false;
  }

  function onComposerChange(event) {
    const value = event.target.value;
    setMessageText(value);
    if (selectedChat?.peerId && value.trim() && !typingActiveRef.current) {
      typingActiveRef.current = true;
      socketRef.current?.emit('typing:update', { toId: selectedChat.peerId, active: true });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (selectedChat?.peerId && value.trim()) {
      typingTimerRef.current = setTimeout(stopTyping, 1500);
    }
  }

  function sendTextMessage(event) {
    event?.preventDefault?.();
    const text = messageText.trim();
    if (!text || !selectedChat) return;
    sendToChat(selectedChat.id, { type: 'text', text });
    setMessageText('');
    setEmojiOpen(false);
    stopTyping();
    composerRef.current?.focus();
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');
        input.value = value;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      showToast(t.copied);
    } catch {
      showToast(t.copyFailed);
    }
  }

  function makeInviteLink(id = app.identity.id) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('to', id);
    return url.toString();
  }

  async function shareInvite() {
    const url = makeInviteLink();
    const shareData = { title: 'You & Me', text: t.shareText, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyText(url);
  }

  function playMessageSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.14);
      oscillator.onended = () => context.close();
    } catch {
      // Sound is optional.
    }
  }

  async function onFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedChat) return;
    if (file.size > 450 * 1024) {
      showToast(t.attachmentTooLarge);
      return;
    }
    try {
      const data = await readAsDataUrl(file);
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file';
      sendToChat(selectedChat.id, { type, text: '', attachment: { name: file.name, mime: file.type || 'application/octet-stream', data } });
    } catch {
      showToast(t.copyFailed);
    }
  }

  async function toggleVoiceRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      setRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast(t.unsupportedRecording);
      return;
    }
    try {
      const targetChatId = selectedChat?.id;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        if (blob.size > 450 * 1024) {
          showToast(t.attachmentTooLarge);
          return;
        }
        if (!blob.size || !targetChatId) return;
        const data = await readAsDataUrl(blob);
        sendToChat(targetChatId, { type: 'audio', text: '', attachment: { name: `voice-${Date.now()}.webm`, mime: blob.type || 'audio/webm', data } });
      };
      recorder.start(180);
      setRecording(true);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch {
      showToast(t.callMediaError);
    }
  }

  function makePeerConnection(callId, peerId, stream) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit('call:signal', {
        callId,
        toId: peerId,
        signal: { type: 'ice', candidate: event.candidate.toJSON() },
      });
    };
    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0];
      if (remoteStream) {
        setCurrentCall((current) => current?.callId === callId ? { ...current, remoteStream, status: 'active' } : current);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCurrentCall((current) => current?.callId === callId ? { ...current, status: 'active' } : current);
      }
      if (pc.connectionState === 'failed') closeCall('failed', true);
    };
    peerConnectionRef.current = pc;
    return pc;
  }

  async function flushRemoteIce(pc) {
    const candidates = remoteIceRef.current.splice(0);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidates after a network switch.
      }
    }
  }

  async function applyIncomingOffer(callId, sdp) {
    const call = callRef.current;
    const pc = peerConnectionRef.current;
    if (!call || call.callId !== callId || call.direction !== 'incoming' || !pc || offerInFlightRef.current) return;
    offerInFlightRef.current = true;
    try {
      if (!pc.remoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushRemoteIce(pc);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('call:signal', {
        callId,
        toId: call.peerId,
        signal: { type: 'answer', sdp: pc.localDescription },
      });
      setCurrentCall((current) => current?.callId === callId ? { ...current, status: 'connecting' } : current);
    } catch {
      closeCall('failed', true);
    } finally {
      offerInFlightRef.current = false;
    }
  }

  async function startCall(kind) {
    if (!selectedChat?.peerId) return;
    if (!socketRef.current?.connected) {
      showToast(t.callOffline);
      return;
    }
    if (!onlineUsers.some((user) => user.id === selectedChat.peerId)) {
      showToast(t.callOffline);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(t.callMediaError);
      return;
    }
    const callId = makeUuid();
    const peerId = selectedChat.peerId;
    const peerName = selectedChat.name;
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    remoteIceRef.current = [];
    setCurrentCall({ callId, peerId, peerName, kind, direction: 'outgoing', status: 'ringing', startedAt: Date.now(), localStream: null, remoteStream: null, muted: false, videoOff: false });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      if (callRef.current?.callId !== callId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setCurrentCall((current) => current?.callId === callId ? { ...current, localStream: stream } : current);
      const pc = makePeerConnection(callId, peerId, stream);
      socketRef.current.emit('call:start', { callId, toId: peerId, kind }, async (result) => {
        if (!result?.ok) {
          showToast(result?.error === 'busy' ? t.callBusy : t.callOffline);
          closeCall(result?.error === 'busy' ? 'missed' : 'failed', false);
          return;
        }
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('call:signal', { callId, toId: peerId, signal: { type: 'offer', sdp: pc.localDescription } });
        } catch {
          closeCall('failed', true);
        }
      });
    } catch {
      closeCall('failed', false);
      showToast(t.callMediaError);
    }
  }

  async function acceptCall() {
    const call = callRef.current;
    if (!call || call.direction !== 'incoming') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.kind === 'video' });
      if (callRef.current?.callId !== call.callId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setCurrentCall((current) => current?.callId === call.callId ? { ...current, status: 'connecting', localStream: stream } : current);
      makePeerConnection(call.callId, call.peerId, stream);
      socketRef.current?.emit('call:respond', { callId: call.callId, accepted: true });
      if (pendingOfferRef.current) await applyIncomingOffer(call.callId, pendingOfferRef.current);
      if (pendingAnswerRef.current && peerConnectionRef.current && !peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(pendingAnswerRef.current));
        await flushRemoteIce(peerConnectionRef.current);
      }
    } catch {
      socketRef.current?.emit('call:respond', { callId: call.callId, accepted: false, reason: 'permission' });
      closeCall('declined', false);
      showToast(t.callMediaError);
    }
  }

  function closeCall(reason = 'ended', notifyPeer = true) {
    const call = callRef.current;
    if (!call) return;
    if (notifyPeer) socketRef.current?.emit('call:end', { callId: call.callId, toId: call.peerId });
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    remoteIceRef.current = [];
    offerInFlightRef.current = false;
    setCurrentCall(null);
    const status = reason === 'declined' ? 'declined' : reason === 'missed' || reason === 'failed' || (reason === 'ended' && call.status === 'ringing') ? 'missed' : 'completed';
    setApp((current) => ({
      ...current,
      calls: [{ id: call.callId, peerId: call.peerId, peerName: call.peerName, kind: call.kind, direction: call.direction, status, at: Date.now() }, ...current.calls].slice(0, 60),
    }));
  }

  function declineCall() {
    const call = callRef.current;
    if (!call) return;
    socketRef.current?.emit('call:respond', { callId: call.callId, accepted: false, reason: 'declined' });
    closeCall('declined', false);
  }

  function toggleCallMute() {
    const call = callRef.current;
    if (!call?.localStream) return;
    const nextMuted = !call.muted;
    call.localStream.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setCurrentCall((current) => current ? { ...current, muted: nextMuted } : current);
  }

  function toggleCallVideo() {
    const call = callRef.current;
    if (!call?.localStream) return;
    const nextOff = !call.videoOff;
    call.localStream.getVideoTracks().forEach((track) => { track.enabled = !nextOff; });
    setCurrentCall((current) => current ? { ...current, videoOff: nextOff } : current);
  }

  function togglePin(chat) {
    if (!chat || chat.kind === 'saved') return;
    updateChat(chat.id, (current) => ({ ...current, pinned: !current.pinned }));
    showToast(chat.pinned ? t.unpinned : t.pinned);
  }

  function clearSelectedChat() {
    if (!selectedChat) return;
    if (!window.confirm(t.clearConfirm)) return;
    updateChat(selectedChat.id, (chat) => ({ ...chat, messages: [], unread: 0, updatedAt: Date.now() }));
    setDetailsOpen(false);
  }

  return (
    <div className={`app-shell ${app.settings.theme === 'dark' ? 'theme-dark' : ''} ${mobileChatOpen ? 'mobile-chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar-top">
          <div className="brand-lockup">
            <BrandMark />
            <div className="brand-copy">
              <strong>You <span>&amp;</span> Me</strong>
              <small>{t.tagline}</small>
            </div>
          </div>
          <div className="sidebar-top-actions">
            <span className={`connection-dot connection-${connectionStatus}`} title={connectionStatus === 'connected' ? t.connected : t.offline} />
            <button className="icon-button subtle-icon" title={t.settings} aria-label={t.settings} onClick={() => setModal('settings')}><Settings size={19} /></button>
          </div>
        </header>

        <nav className="primary-tabs" aria-label="Main navigation">
          <button className={activeTab === 'chats' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('chats')}>
            <MessagesSquare size={18} /><span>{t.chats}</span>
            {app.chats.reduce((sum, chat) => sum + (chat.unread || 0), 0) > 0 && <b className="tab-count">{app.chats.reduce((sum, chat) => sum + (chat.unread || 0), 0)}</b>}
          </button>
          <button className={activeTab === 'calls' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('calls')}><Phone size={18} /><span>{t.calls}</span></button>
          <button className={activeTab === 'contacts' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('contacts')}><Users size={18} /><span>{t.contacts}</span></button>
        </nav>

        <div className="sidebar-search-row">
          <label className="search-box">
            <Search size={17} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search} />
            {searchTerm && <button type="button" className="clear-search" onClick={() => setSearchTerm('')} aria-label={t.close}><X size={14} /></button>}
          </label>
          <button className="round-action" title={t.newChat} aria-label={t.newChat} onClick={() => setModal('new-chat')}><Plus size={19} /></button>
        </div>

        {activeTab === 'chats' && (
          <>
            <div className="list-heading">
              <div><span className="eyebrow">{t.chats}</span><strong>{t.startNew}</strong></div>
              <button className="text-icon-button" onClick={() => setModal('new-chat')}><UserPlus size={16} /><span>{t.addContact}</span></button>
            </div>
            <div className="filter-pills">
              <button className={filter === 'all' ? 'filter-pill selected' : 'filter-pill'} onClick={() => setFilter('all')}>{t.all}</button>
              <button className={filter === 'unread' ? 'filter-pill selected' : 'filter-pill'} onClick={() => setFilter('unread')}>{t.unread}</button>
            </div>
            <div className="sidebar-scroll chat-list" role="list">
              {visibleChats.length ? visibleChats.map((chat) => {
                const lastMessage = chat.messages.at(-1);
                const isOnline = onlineUsers.some((user) => user.id === chat.peerId);
                return (
                  <button key={chat.id} className={`chat-list-item ${selectedChatId === chat.id && activeTab === 'chats' ? 'selected' : ''}`} onClick={() => { setSelectedChatId(chat.id); setActiveTab('chats'); setMobileChatOpen(true); setDetailsOpen(false); }} role="listitem">
                    <Avatar name={chat.kind === 'saved' ? t.saved : chat.name} id={chat.peerId || 'saved'} saved={chat.kind === 'saved'} size="md" online={isOnline} />
                    <span className="chat-list-copy">
                      <span className="chat-list-title"><strong>{chat.kind === 'saved' ? t.saved : chat.name}</strong><time>{lastMessage ? formatTime(lastMessage.createdAt, language) : ''}</time></span>
                      <span className="chat-list-preview">
                        <span>{lastMessage?.fromId === app.identity.id && chat.kind !== 'saved' ? `${t.you}: ` : ''}{lastMessage ? previewText(lastMessage, t) : chat.kind === 'saved' ? t.savedSub : chat.peerId}</span>
                        <span className="chat-row-meta">{chat.pinned && chat.kind !== 'saved' && <Pin size={12} />}{chat.unread > 0 && <b>{chat.unread > 99 ? '99+' : chat.unread}</b>}</span>
                      </span>
                    </span>
                  </button>
                );
              }) : (
                <div className="sidebar-empty"><span className="empty-mini-icon"><Search size={16} /></span><strong>{t.noResults}</strong><small>{t.noChatsHint}</small></div>
              )}
            </div>
          </>
        )}

        {activeTab === 'calls' && (
          <div className="sidebar-section-list">
            <div className="list-heading"><div><span className="eyebrow">{t.calls}</span><strong>{t.callHistory}</strong></div><span className="soft-count">{app.calls.length}</span></div>
            {app.calls.slice(0, 8).map((call) => (
              <button className="mini-history-row" key={call.id} onClick={() => openPeer(call.peerId, call.peerName)}>
                <Avatar name={call.peerName} id={call.peerId} size="sm" />
                <span><strong>{call.peerName}</strong><small>{call.kind === 'video' ? t.videoCall : t.voiceCall}</small></span>
                {call.direction === 'incoming' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </button>
            ))}
            {!app.calls.length && <div className="sidebar-empty compact-empty"><Phone size={19} /><small>{t.noCallsHint}</small></div>}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="sidebar-section-list">
            <div className="list-heading"><div><span className="eyebrow">{t.contacts}</span><strong>{t.onlineNow}</strong></div><span className="soft-count">{otherOnlineUsers.length}</span></div>
            {otherOnlineUsers.filter((user) => !searchTerm || `${user.name} ${user.id}`.toLowerCase().includes(searchTerm.toLowerCase())).map((user) => (
              <button className="mini-history-row" key={user.id} onClick={() => openPeer(user.id, user.name)}>
                <Avatar name={user.name} id={user.id} size="sm" online />
                <span><strong>{user.name}</strong><small>{user.id}</small></span><span className="online-small-dot" />
              </button>
            ))}
            {!otherOnlineUsers.length && <div className="sidebar-empty compact-empty"><Users size={19} /><small>{t.noOnline}</small></div>}
            <button className="add-contact-wide" onClick={() => setModal('new-chat')}><Plus size={16} />{t.addContact}</button>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="identity-card">
            <button className="identity-main" onClick={() => setModal('settings')}>
              <Avatar name={app.profile.name} id={app.identity.id} size="sm" online={connectionStatus === 'connected'} />
              <span className="identity-copy"><strong>{app.profile.name}</strong><small>{app.identity.id}</small></span>
            </button>
            <button className="identity-share" title={t.shareInvite} aria-label={t.shareInvite} onClick={shareInvite}><Share2 size={16} /></button>
          </div>
          <div className="sidebar-footer-note"><ShieldCheck size={13} />{t.noSignup ?? 'No sign-up required'}</div>
        </div>
      </aside>

      <main className="main-panel">
        {activeTab === 'chats' && selectedChat && (
          <ConversationView
            chat={selectedChat}
            isOnline={selectedIsOnline}
            typing={Boolean(selectedChat.peerId && typingPeers[selectedChat.peerId])}
            identity={app.identity}
            profile={app.profile}
            messages={selectedChat.messages}
            t={t}
            language={language}
            messageText={messageText}
            onMessageChange={onComposerChange}
            onSend={sendTextMessage}
            onOpenDetails={() => setDetailsOpen((value) => !value)}
            detailsOpen={detailsOpen}
            onStartCall={startCall}
            onBack={() => setMobileChatOpen(false)}
            mobile={mobileChatOpen}
            onNewChat={() => setModal('new-chat')}
            onCopyId={() => copyText(app.identity.id)}
            onShare={shareInvite}
            emojiOpen={emojiOpen}
            setEmojiOpen={setEmojiOpen}
            onEmoji={(emoji) => { setMessageText((value) => `${value}${emoji}`); composerRef.current?.focus(); }}
            onAttach={() => fileInputRef.current?.click()}
            onFileSelected={onFileSelected}
            fileInputRef={fileInputRef}
            onToggleRecording={toggleVoiceRecording}
            recording={recording}
            recordingSeconds={recordingSeconds}
            composerRef={composerRef}
            messageEndRef={messageEndRef}
            detailsProps={{ onPin: () => togglePin(selectedChat), onClear: clearSelectedChat, onClose: () => setDetailsOpen(false), onCopyPeer: () => copyText(selectedChat.peerId || app.identity.id), isPinned: selectedChat.pinned, online: selectedIsOnline }}
          />
        )}
        {activeTab === 'calls' && (
          <CallsWorkspace calls={app.calls} t={t} language={language} onOpenPeer={openPeer} onNewChat={() => setModal('new-chat')} onBack={() => setMobileChatOpen(false)} />
        )}
        {activeTab === 'contacts' && (
          <ContactsWorkspace
            contacts={directChats}
            onlineUsers={otherOnlineUsers}
            searchTerm={searchTerm}
            identity={app.identity}
            t={t}
            onOpenPeer={openPeer}
            onNewChat={() => setModal('new-chat')}
            onCopyId={() => copyText(app.identity.id)}
            onShare={shareInvite}
            onBack={() => setMobileChatOpen(false)}
          />
        )}
      </main>

      {modal === 'new-chat' && (
        <NewChatDialog t={t} identity={app.identity} onClose={() => setModal('')} onStart={(id, name) => { setModal(''); openPeer(id, name); }} onCopy={() => copyText(app.identity.id)} />
      )}
      {modal === 'settings' && (
        <SettingsDialog
          t={t}
          app={app}
          onClose={() => setModal('')}
          onSaveName={(name) => { updateDisplayName(name); showToast(t.nameSaved); }}
          onSettings={updateSettings}
          onCopy={() => copyText(app.identity.id)}
          onShare={shareInvite}
          onNotify={async () => {
            if (!('Notification' in window)) { showToast(t.enableNotifications); return; }
            const permission = await Notification.requestPermission();
            updateSettings({ notifications: permission === 'granted' });
            if (permission === 'granted') showToast(t.copied);
          }}
        />
      )}
      {callState && (
        <CallOverlay
          call={callState}
          t={t}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={() => closeCall('ended', true)}
          onMute={toggleCallMute}
          onVideo={toggleCallVideo}
        />
      )}
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  );
}

function ConversationView({
  chat, isOnline, typing, identity, profile, messages, t, language, messageText, onMessageChange, onSend,
  onOpenDetails, detailsOpen, onStartCall, onBack, mobile, onNewChat, onCopyId, onShare, emojiOpen,
  setEmojiOpen, onEmoji, onAttach, onFileSelected, fileInputRef, onToggleRecording, recording,
  recordingSeconds, composerRef, messageEndRef, detailsProps,
}) {
  const isSaved = chat.kind === 'saved';
  const peerName = isSaved ? t.saved : chat.name;
  return (
    <div className={`conversation-shell ${detailsOpen ? 'details-visible' : ''}`}>
      <section className="conversation-main">
        <header className="conversation-header">
          <div className="conversation-person">
            {mobile && <button className="back-button" onClick={onBack} aria-label={t.chats}><ChevronLeft size={22} /></button>}
            <Avatar name={peerName} id={chat.peerId || 'saved'} saved={isSaved} size="lg" online={isOnline} />
            <div className="person-meta">
              <strong>{peerName}</strong>
              <span className={isOnline ? 'person-status online-text' : 'person-status'}>
                <i />{isSaved ? t.privateSpace : isOnline ? t.online : t.contactOffline}
              </span>
            </div>
          </div>
          <div className="conversation-actions">
            {!isSaved && <>
              <button className="header-action" title={t.voiceCall} aria-label={t.voiceCall} onClick={() => onStartCall('audio')}><Phone size={19} /></button>
              <button className="header-action video-action" title={t.videoCall} aria-label={t.videoCall} onClick={() => onStartCall('video')}><Video size={20} /></button>
            </>}
            <span className="header-action-divider" />
            <button className={`header-action ${detailsOpen ? 'active' : ''}`} title={t.profile} aria-label={t.profile} onClick={onOpenDetails}><Info size={19} /></button>
            <button className="header-action mobile-more" title={t.settings} aria-label={t.settings} onClick={onOpenDetails}><MoreHorizontal size={20} /></button>
          </div>
        </header>

        <div className="message-area">
          <div className="chat-date-divider"><span>{t.today}</span></div>
          {!messages.length && (
            isSaved ? (
              <div className="empty-thread-card saved-thread-card">
                <div className="empty-orbit"><BrandMark small /></div>
                <span className="eyebrow">{t.localOnly}</span>
                <h2>{t.localRoom}</h2>
                <p>{t.localRoomHint}</p>
                <div className="saved-actions">
                  <button className="soft-action" onClick={onNewChat}><UserPlus size={16} />{t.newChat}</button>
                  <button className="soft-action outline-action" onClick={onShare}><Share2 size={16} />{t.shareInvite}</button>
                </div>
              </div>
            ) : (
              <div className="empty-thread-card contact-thread-card">
                <Avatar name={peerName} id={chat.peerId} size="xl" online={isOnline} />
                <h2>{peerName}</h2>
                <span className="id-badge">{chat.peerId}</span>
                <p>{t.startConversation}</p>
                <span className="privacy-caption"><ShieldCheck size={14} />{t.emptyChatHint}</span>
              </div>
            )
          )}
          <div className="message-list">
            {messages.map((message) => <MessageBubble key={message.id} message={message} own={message.fromId === identity.id} t={t} language={language} />)}
          </div>
          {typing && <div className="typing-indicator"><span><i /><i /><i /></span><small>{chat.name}…</small></div>}
          <div ref={messageEndRef} />
        </div>

        <div className="composer-wrap">
          {emojiOpen && (
            <div className="emoji-popover">
              <div className="emoji-popover-head"><span>{t.emoji}</span><button onClick={() => setEmojiOpen(false)} aria-label={t.close}><X size={14} /></button></div>
              <div className="emoji-grid">{QUICK_EMOJIS.map((emoji) => <button key={emoji} onClick={() => onEmoji(emoji)}>{emoji}</button>)}</div>
            </div>
          )}
          {recording && <div className="recording-strip"><span className="record-dot" /><strong>{t.recording}</strong><span>{formatDuration(recordingSeconds)}</span><small>{t.tapToStop}</small></div>}
          <form className="composer" onSubmit={onSend}>
            <div className="composer-tools">
              <button type="button" className={`composer-tool ${emojiOpen ? 'tool-active' : ''}`} title={t.emoji} aria-label={t.emoji} onClick={() => setEmojiOpen((value) => !value)}><Smile size={20} /></button>
              <button type="button" className="composer-tool" title={t.attach} aria-label={t.attach} onClick={onAttach}><Paperclip size={19} /></button>
              <input ref={fileInputRef} className="hidden-file-input" type="file" accept="image/*,audio/*,application/pdf,text/plain" onChange={onFileSelected} />
            </div>
            <textarea
              ref={composerRef}
              value={messageText}
              onChange={onMessageChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  onSend(event);
                }
              }}
              placeholder={isSaved ? t.localRoomHint : t.typeMessage}
              aria-label={t.typeMessage}
              rows={1}
            />
            {messageText.trim() ? (
              <button type="submit" className="send-button" title={t.send} aria-label={t.send}><Send size={18} /></button>
            ) : (
              <button type="button" className={`record-button ${recording ? 'recording-active' : ''}`} onClick={onToggleRecording} title={recording ? t.tapToStop : t.voiceMessage} aria-label={t.voiceMessage}>
                {recording ? <MicOff size={19} /> : <Mic size={19} />}
              </button>
            )}
          </form>
          <div className="composer-caption"><ShieldCheck size={12} /><span>{isSaved ? t.saveOnDevice : t.emptyChatHint}</span><kbd>Enter</kbd></div>
        </div>
      </section>

      {detailsOpen && (
        <aside className="details-panel">
          <header><strong>{t.profile}</strong><button className="icon-button" onClick={detailsProps.onClose} aria-label={t.close}><X size={18} /></button></header>
          <div className="details-profile"><Avatar name={peerName} id={chat.peerId || 'saved'} saved={isSaved} size="xl" online={isOnline} /><strong>{peerName}</strong><span>{isSaved ? t.privateSpace : chat.peerId}</span></div>
          <div className="details-actions">
            {!isSaved && <button onClick={detailsProps.onPin}><Pin size={17} /><span>{chat.pinned ? t.unpinChat : t.pinChat}</span></button>}
            <button onClick={detailsProps.onCopyPeer}><Copy size={17} /><span>{t.copyId}</span></button>
            {!isSaved && <button className="danger-action" onClick={detailsProps.onClear}><Trash2 size={17} /><span>{t.clearChat}</span></button>}
          </div>
          <div className="details-info-card"><ShieldCheck size={16} /><span>{t.privacyHint}</span></div>
          <div className="details-status"><span className={isOnline ? 'status-light online-light' : 'status-light'} />{isSaved ? t.localOnly : isOnline ? t.online : t.offline}</div>
        </aside>
      )}
    </div>
  );
}

function MessageBubble({ message, own, t, language }) {
  const time = formatTime(message.createdAt, language);
  const file = message.attachment;
  const statusLabel = message.status === 'read' ? t.messageRead : message.status === 'delivered' ? t.messageDelivered : message.status === 'pending' ? t.messagePending : t.messageSent;
  return (
    <div className={`message-row ${own ? 'message-own' : 'message-theirs'}`}>
      <div className="message-bubble">
        {file?.data && message.type === 'image' && <a href={file.data} target="_blank" rel="noreferrer" className="message-image-link"><img src={file.data} alt={file.name || t.file} /></a>}
        {file?.data && message.type === 'audio' && <audio className="message-audio" controls preload="metadata" src={file.data} />}
        {file && message.type === 'file' && (
          <a className="attachment-card" href={file.data || undefined} download={file.name} target={file.data ? '_blank' : undefined} rel="noreferrer">
            <span className="attachment-icon"><FileText size={19} /></span>
            <span><strong>{file.name || t.file}</strong><small>{formatBytes(file.data?.length ? Math.floor(file.data.length * 0.72) : 0)}</small></span>
          </a>
        )}
        {message.text && <p className="message-text">{message.text}</p>}
        {file && message.type === 'image' && !message.text && <span className="attachment-caption">{file.name}</span>}
        <span className="message-meta"><time>{time}</time>{own && <span className={`message-status status-${message.status}`} title={statusLabel}>{message.status === 'pending' ? <Clock3 size={13} /> : message.status === 'read' || message.status === 'delivered' ? <CheckCheck size={15} /> : <Check size={14} />}</span>}</span>
      </div>
    </div>
  );
}

function CallsWorkspace({ calls, t, language, onOpenPeer, onNewChat, onBack }) {
  return (
    <section className="workspace-page calls-page">
      <header className="workspace-header">
        <button className="mobile-workspace-back back-button" onClick={onBack} aria-label={t.chats}><ChevronLeft size={22} /></button>
        <div className="workspace-title"><span className="eyebrow">You &amp; Me</span><h1>{t.calls}</h1><p>{t.callHistory}</p></div>
        <button className="primary-button" onClick={onNewChat}><Plus size={17} />{t.newChat}</button>
      </header>
      <div className="workspace-content">
        <div className="content-section-heading"><div><span className="section-icon green-icon"><Phone size={17} /></span><div><h2>{t.callHistory}</h2><p>{calls.length ? `${calls.length} ${t.calls}` : t.noCallsHint}</p></div></div></div>
        {calls.length ? (
          <div className="call-history-list">
            {calls.map((call) => (
              <button className="call-history-card" key={call.id} onClick={() => onOpenPeer(call.peerId, call.peerName)}>
                <Avatar name={call.peerName} id={call.peerId} size="md" />
                <span className="history-main"><strong>{call.peerName}</strong><small>{call.direction === 'incoming' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{call.direction === 'incoming' ? t.incoming : t.outgoing} · {call.kind === 'video' ? t.videoCall : t.voiceCall}</small></span>
                <span className={`call-result ${call.status === 'missed' || call.status === 'declined' ? 'call-result-missed' : ''}`}>{call.status === 'missed' ? t.missed : call.status === 'declined' ? t.declined : formatDay(call.at, language)}</span>
                <span className="history-time">{formatTime(call.at, language)}</span>
                <span className="quick-call"><Phone size={16} /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="workspace-empty">
            <div className="workspace-empty-art"><span className="art-ring ring-one" /><span className="art-ring ring-two" /><span className="art-center"><Phone size={27} /></span><span className="art-spark">✦</span></div>
            <h2>{t.noCalls}</h2><p>{t.noCallsHint}</p><button className="soft-action" onClick={onNewChat}><UserPlus size={16} />{t.addContact}</button>
          </div>
        )}
      </div>
    </section>
  );
}

function ContactsWorkspace({ contacts, onlineUsers, searchTerm, identity, t, onOpenPeer, onNewChat, onCopyId, onShare, onBack }) {
  const query = searchTerm.trim().toLowerCase();
  const online = onlineUsers.filter((user) => `${user.name} ${user.id}`.toLowerCase().includes(query));
  const existing = contacts.filter((contact) => !onlineUsers.some((user) => user.id === contact.peerId) && (!query || `${contact.name} ${contact.peerId}`.toLowerCase().includes(query)));
  return (
    <section className="workspace-page contacts-page">
      <header className="workspace-header">
        <button className="mobile-workspace-back back-button" onClick={onBack} aria-label={t.chats}><ChevronLeft size={22} /></button>
        <div className="workspace-title"><span className="eyebrow">You &amp; Me</span><h1>{t.contacts}</h1><p>{t.onlineListHint}</p></div>
        <button className="primary-button" onClick={onNewChat}><UserPlus size={17} />{t.addContact}</button>
      </header>
      <div className="workspace-content contacts-content">
        <div className="my-id-card">
          <div className="my-id-mark"><Share2 size={21} /></div>
          <div className="my-id-copy"><span className="eyebrow">{t.yourId}</span><strong>{identity.id}</strong><small>{t.newChatHint}</small></div>
          <div className="my-id-actions"><button className="soft-action" onClick={onCopyId}><Copy size={15} />{t.copyId}</button><button className="primary-button compact-button" onClick={onShare}><Share2 size={15} />{t.shareInvite}</button></div>
        </div>
        <div className="content-section-heading"><div><span className="section-icon green-icon"><span className="online-small-dot" /></span><div><h2>{t.onlineNow}</h2><p>{online.length} {t.online}</p></div></div></div>
        {online.length ? <div className="contact-card-grid">{online.map((user) => <button key={user.id} className="contact-card" onClick={() => onOpenPeer(user.id, user.name)}><Avatar name={user.name} id={user.id} size="lg" online /><span className="contact-card-text"><strong>{user.name}</strong><small>{user.id}</small></span><span className="contact-card-action"><MessageCircle size={17} /></span></button>)}</div> : <div className="inline-empty"><Users size={18} /><span>{t.noOnline}</span></div>}
        <div className="content-section-heading contact-heading"><div><span className="section-icon lavender-icon"><Users size={17} /></span><div><h2>{t.yourContacts}</h2><p>{existing.length} {t.contacts}</p></div></div><button className="text-icon-button" onClick={onNewChat}><Plus size={15} />{t.addContact}</button></div>
        {existing.length ? <div className="contact-card-grid">{existing.map((contact) => <button key={contact.id} className="contact-card" onClick={() => onOpenPeer(contact.peerId, contact.name)}><Avatar name={contact.name} id={contact.peerId} size="lg" /><span className="contact-card-text"><strong>{contact.name}</strong><small>{contact.peerId}</small></span><span className="contact-card-action"><MessageCircle size={17} /></span></button>)}</div> : <div className="inline-empty"><UserPlus size={18} /><span>{t.noContacts}</span><button onClick={onNewChat}>{t.addContact}</button></div>}
      </div>
    </section>
  );
}

function NewChatDialog({ t, identity, onClose, onStart, onCopy }) {
  const [rawId, setRawId] = useState('');
  const [name, setName] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  function submit(event) {
    event.preventDefault();
    const id = parseGuestId(rawId);
    if (!ID_PATTERN.test(id)) { setInvalid(true); return; }
    onStart(id, name.trim());
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="dialog-card new-chat-dialog" onSubmit={submit}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label={t.close}><X size={18} /></button>
        <div className="dialog-icon green-icon"><MessageCircle size={21} /></div>
        <span className="eyebrow">{t.startNew}</span>
        <h2>{t.newChat}</h2>
        <p>{t.newChatHint}</p>
        <label className="field-label">You &amp; Me ID</label>
        <input ref={inputRef} className={`text-field id-field ${invalid ? 'field-invalid' : ''}`} value={rawId} onChange={(event) => { setRawId(event.target.value.toUpperCase()); setInvalid(false); }} placeholder={t.idPlaceholder} autoComplete="off" />
        {invalid && <small className="field-error">{t.invalidId}</small>}
        <label className="field-label optional-label">{t.nameOptional}</label>
        <input className="text-field" value={name} onChange={(event) => setName(event.target.value)} placeholder={t.namePlaceholder} maxLength={40} />
        <div className="dialog-invite-row"><span><small>{t.yourId}</small><strong>{identity.id}</strong></span><button type="button" onClick={onCopy}><Copy size={15} />{t.copyId}</button></div>
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t.cancel}</button><button type="submit" className="primary-button"><MessageCircle size={16} />{t.startChat}</button></div>
      </form>
    </div>
  );
}

function SettingsDialog({ t, app, onClose, onSaveName, onSettings, onCopy, onShare, onNotify }) {
  const [name, setName] = useState(app.profile.name);
  const [noticePermission, setNoticePermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const isDark = app.settings.theme === 'dark';
  async function enableNotifications() {
    await onNotify();
    if (typeof Notification !== 'undefined') setNoticePermission(Notification.permission);
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card settings-dialog">
        <header className="settings-dialog-header"><div><span className="eyebrow">You &amp; Me</span><h2>{t.settings}</h2></div><button className="dialog-close static-close" onClick={onClose} aria-label={t.close}><X size={19} /></button></header>
        <div className="settings-scroll">
          <div className="settings-profile-card">
            <Avatar name={app.profile.name} id={app.identity.id} size="xl" />
            <div className="settings-profile-data"><span className="eyebrow">{t.profile}</span><strong>{app.identity.id}</strong><small>{t.privacy}</small></div>
            <button className="small-copy-button" onClick={onCopy} aria-label={t.copyId}><Copy size={16} /></button>
          </div>
          <label className="field-label">{t.displayName}</label>
          <div className="name-edit-row"><input className="text-field" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /><button className="primary-button save-name-button" onClick={() => onSaveName(name)}>{t.save}</button></div>

          <div className="settings-section-title"><span className="section-icon lavender-icon"><Sun size={16} /></span><div><strong>{t.appearance}</strong><small>{t.settingsHint}</small></div></div>
          <div className="choice-row">
            <button className={!isDark ? 'choice-button selected' : 'choice-button'} onClick={() => onSettings({ theme: 'light' })}><Sun size={16} />{t.light}</button>
            <button className={isDark ? 'choice-button selected' : 'choice-button'} onClick={() => onSettings({ theme: 'dark' })}><Moon size={16} />{t.dark}</button>
          </div>

          <div className="settings-section-title"><span className="section-icon blue-icon"><Globe size={16} /></span><div><strong>{t.language}</strong><small>{t.settingsHint}</small></div></div>
          <div className="choice-row">
            <button className={app.settings.language === 'bn' ? 'choice-button selected' : 'choice-button'} onClick={() => onSettings({ language: 'bn' })}>{t.bengali}</button>
            <button className={app.settings.language === 'en' ? 'choice-button selected' : 'choice-button'} onClick={() => onSettings({ language: 'en' })}>English</button>
          </div>

          <div className="settings-section-title"><span className="section-icon peach-icon"><Bell size={16} /></span><div><strong>{t.notifications}</strong><small>{t.settingsHint}</small></div></div>
          <button className="setting-toggle-row" onClick={() => onSettings({ sound: !app.settings.sound })}><span className="setting-row-icon">{app.settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</span><span><strong>{t.sound}</strong><small>{app.settings.sound ? t.online : t.hide}</small></span><span className={`toggle-switch ${app.settings.sound ? 'toggle-on' : ''}`}><i /></span></button>
          <button className="setting-toggle-row" onClick={() => app.settings.notifications ? onSettings({ notifications: false }) : enableNotifications()}><span className="setting-row-icon"><Bell size={17} /></span><span><strong>{t.enableNotifications}</strong><small>{app.settings.notifications ? t.online : t.offline}</small></span><span className={`toggle-switch ${app.settings.notifications ? 'toggle-on' : ''}`}><i /></span></button>

          <div className="privacy-card"><ShieldCheck size={18} /><div><strong>{t.privacy}</strong><p>{t.privacyHint}</p><small>{t.saveOnDevice}</small></div></div>
        </div>
        <footer className="settings-dialog-footer"><span><ShieldCheck size={14} />{t.localOnly}</span><div><button className="secondary-button" onClick={onShare}><Share2 size={15} />{t.shareInvite}</button><button className="primary-button" onClick={onClose}>{t.close}</button></div></footer>
      </section>
    </div>
  );
}

function CallOverlay({ call, t, onAccept, onDecline, onEnd, onMute, onVideo }) {
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const isIncoming = call.direction === 'incoming' && call.status === 'ringing';
  const statusText = call.status === 'active' ? formatDuration(duration) : call.status === 'ringing' ? (isIncoming ? t.incomingCall : t.ringing) : t.connectingCall;
  useEffect(() => {
    if (remoteVideoRef.current && call.remoteStream) remoteVideoRef.current.srcObject = call.remoteStream;
    if (remoteAudioRef.current && call.remoteStream) remoteAudioRef.current.srcObject = call.remoteStream;
    if (localVideoRef.current && call.localStream) localVideoRef.current.srcObject = call.localStream;
  }, [call.remoteStream, call.localStream, call.kind]);
  useEffect(() => {
    const start = call.startedAt || Date.now();
    const tick = () => setDuration(Math.floor((Date.now() - start) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.startedAt]);
  return (
    <div className={`call-overlay ${call.kind === 'video' ? 'video-call-overlay' : ''}`}>
      <section className="call-window">
        <header className="call-window-header"><span className="call-brand"><BrandMark small />You &amp; Me</span><span className={`call-live-pill ${call.status === 'active' ? 'live' : ''}`}><i />{statusText}</span></header>
        <div className={`call-stage ${call.kind === 'video' ? 'video-stage' : ''}`}>
          {call.kind === 'video' && call.remoteStream ? <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline /> : <div className="call-portrait"><span className="call-pulse pulse-a" /><span className="call-pulse pulse-b" /><Avatar name={call.peerName} id={call.peerId} size="call" /><span className="call-spark">✦</span></div>}
          {call.kind === 'audio' && <audio ref={remoteAudioRef} autoPlay />}
          {call.kind === 'video' && call.localStream && <div className="local-video-tile"><video ref={localVideoRef} autoPlay playsInline muted />{call.videoOff && <span><VideoOff size={15} /></span>}</div>}
          <div className="call-stage-person"><strong>{call.peerName}</strong><small>{call.kind === 'video' ? t.videoCall : t.voiceCall}</small></div>
        </div>
        <footer className="call-controls">
          {isIncoming ? (
            <>
              <button className="call-control decline-control" onClick={onDecline}><PhoneOff size={20} /><span>{t.decline}</span></button>
              <button className="call-control answer-control" onClick={onAccept}><Phone size={20} /><span>{t.answer}</span></button>
            </>
          ) : (
            <>
              <button className={`call-control utility-control ${call.muted ? 'control-active' : ''}`} onClick={onMute}><span className="control-round">{call.muted ? <MicOff size={19} /> : <Mic size={19} />}</span><span>{call.muted ? t.unmute : t.mute}</span></button>
              {call.kind === 'video' && <button className={`call-control utility-control ${call.videoOff ? 'control-active' : ''}`} onClick={onVideo}><span className="control-round">{call.videoOff ? <VideoOff size={19} /> : <Video size={19} />}</span><span>{call.videoOff ? t.cameraOn : t.cameraOff}</span></button>}
              <button className="call-control decline-control" onClick={onEnd}><PhoneOff size={20} /><span>{t.endCall}</span></button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default App;
