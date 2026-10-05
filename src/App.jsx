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
  Home,
  MonitorUp,
  MonitorX,
  Speaker,
  Hash,
  CircleHelp,
  ContactRound,
  HardDrive,
  LockKeyhole,
  LogOut,
  Camera,
  PhoneIncoming,
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
  Smartphone,
  UserRound,
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
  en: {
    tagline: 'Closer people, closer conversations', chats: 'Chats', calls: 'Calls', contacts: 'Contacts',
    online: 'Online', offline: 'Offline', connecting: 'Connecting…', connected: 'Connected',
    reconnecting: 'Reconnecting…', all: 'All', unread: 'Unread', search: 'Search',
    searchPlaceholder: 'Search chats or contacts', newChat: 'New chat', addContact: 'Add by ID',
    saved: 'Saved messages', savedSub: 'Just for you', noChats: 'No chats yet',
    noChatsHint: 'Start a conversation with a contact’s You and Me ID.',
    localRoom: 'Your private space', localRoomHint: 'Keep notes and links for yourself here. They stay on this device.',
    welcomeTitle: 'Let’s get talking', welcomeHint: 'No registration or phone number. Share your ID, or enter a contact’s ID to start chatting.',
    yourId: 'Your You and Me ID', copyId: 'Copy ID', shareInvite: 'Share my ID',
    typeMessage: 'Write a message…', send: 'Send', attach: 'Attach a file', emoji: 'Emoji',
    voiceMessage: 'Voice message', recording: 'Recording', tapToStop: 'Tap again to stop',
    startConversation: 'Start the conversation', emptyChatHint: 'Messages you send here are saved on this device.',
    today: 'Today', yesterday: 'Yesterday', you: 'You', privateSpace: 'Private notes',
    newChatHint: 'Enter your contact’s You and Me ID. No account is needed.',
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
    appearance: 'Appearance', light: 'Light', dark: 'Dark',
    notifications: 'Notifications', enableNotifications: 'Enable browser notifications', sound: 'Message sound',
    privacy: 'Privacy', privacyHint: 'You and Me does not need an account, phone number, or password. Your ID is your contact address.',
    saveOnDevice: 'Chat history is saved on this device', inviteLink: 'Copy invite link', settingsHint: 'Your preferences stay on this device.',
    copied: 'Copied', copyFailed: 'Could not copy', nameSaved: 'Name saved', messageSaved: 'Message sent',
    pinned: 'Chat pinned', unpinned: 'Chat unpinned', pinChat: 'Pin chat', unpinChat: 'Unpin chat',
    clearChat: 'Clear chat history', clearConfirm: 'Clear this chat’s messages from this device?',
    attachmentTooLarge: 'Please choose a file smaller than 450 KB.', unsupportedRecording: 'Voice recording is not available in this browser.',
    messagePending: 'Waiting to send', messageSent: 'Sent', messageDelivered: 'Delivered', messageRead: 'Seen',
    shareText: 'Chat with me on You and Me', guest: 'Guest', youAndMe: 'You and Me', noSignup: 'No sign-up required',
    contactOffline: 'Offline — they’ll receive your message when they come online', tapToChat: 'Write a message to chat',
    message: 'Message', file: 'File', audio: 'Audio', noResults: 'Nothing found',
    attachPhoto: 'Photo or file', newContact: 'Add a contact', myProfile: 'My profile',
    hide: 'Hide', localOnly: 'This device only', startNew: 'Start a new conversation',
    home: 'Home', welcomeBack: 'Welcome back', heroHeadline: 'Connect. Call. Chat. Together.',
    heroDescription: 'Find your people and start a conversation — no sign-up needed.',
    globalSearchPlaceholder: 'Search by name, username or Bangladesh number…',
    quickActions: 'Quick actions', recentChats: 'Recent conversations', viewAll: 'View all',
    peopleOnline: 'People online', noRecentChats: 'Your conversations will appear here.',
    searchPeopleHint: 'Search online people by name, username, or a shared Bangladesh number.',
    noSearchResults: 'No people found', searchIdHint: 'You can also start a chat using a You and Me ID.',
    username: 'Username', phoneNumber: 'Bangladesh phone number', phoneOptional: 'Phone number (optional)',
    phoneVisibility: 'Let people find me by phone number', phonePrivacyHint: 'Your number is only listed when you turn this on.',
    profilePhoto: 'Profile photo', changePhoto: 'Change photo', removePhoto: 'Remove photo',
    audioCall: 'Audio call', startMessage: 'Message',
    account: 'Account', privacyControls: 'Privacy', dataStorage: 'Data & Storage', callsSettings: 'Calls',
    contactsSettings: 'Contacts', security: 'Security', support: 'Help & Support', logout: 'Log out',
    showPresence: 'Show my online status', presenceHint: 'When off, you will not appear in online search.',
    screenShare: 'Share screen', stopScreenShare: 'Stop sharing', allowScreenShare: 'Allow screen sharing?',
    screenShareHint: 'Your browser will ask you to choose a screen or window. You can stop sharing at any time.',
    allow: 'Allow', speaker: 'Speaker', speakerOff: 'Speaker off', keypad: 'Keypad', switchCamera: 'Switch camera',
    contactsImport: 'Import contacts', manageContacts: 'Manage contacts', contactsImportHint: 'Contacts are only accessed after you choose Import.',
    contactsUnsupported: 'This browser does not support contact import. You can still add people by You and Me ID.',
    dataStorageHint: 'Your message history and preferences are stored on this device.',
    storageUsed: 'Local storage used', clearHistory: 'Clear chat history', clearAllData: 'Clear all data and log out',
    clearAllConfirm: 'This removes this device’s guest ID, chats, call history and settings. Continue?',
    logoutConfirm: 'Log out and erase this device’s You and Me data?',
    accountHint: 'A guest profile lives only in this browser. No password or account is required.',
    securityHint: 'Messages are relayed by the service and are not end-to-end encrypted.',
    supportHint: 'Need help? Check your connection, share your You and Me ID, and make sure your browser allows microphone or camera access.',
    savedProfile: 'Profile saved', phoneInvalid: 'Enter a valid Bangladesh mobile number, for example 01712345678.',
    photoTooLarge: 'Choose a profile image smaller than 120 KB.',
    photoUnsupported: 'Use a PNG, JPG, WEBP, or GIF profile image.',
    permissionBeforeUse: 'Your browser will ask permission before this feature starts.',
    sharingNow: 'You are sharing your screen', stop: 'Stop',
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
  const suffix = identity.id.slice(-4).toLowerCase();
  return {
    identity,
    profile: { name: `Guest ${suffix.toUpperCase()}`, username: `guest${suffix}`, phone: '', phonePublic: false, avatar: '' },
    chats: [makeSavedChat()],
    calls: [],
    contacts: [],
    settings: { theme: 'light', language: 'en', notifications: false, sound: true, showPresence: true },
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
      profile: {
        name: `Guest ${value.identity.id.slice(-4)}`,
        username: `guest${value.identity.id.slice(-4).toLowerCase()}`,
        phone: '', phonePublic: false, avatar: '',
        ...(value.profile ?? {}),
      },
      chats,
      calls: Array.isArray(value.calls) ? value.calls.slice(0, 60) : [],
      contacts: Array.isArray(value.contacts) ? value.contacts.slice(0, 300) : [],
      settings: { theme: 'light', notifications: false, sound: true, showPresence: true, ...(value.settings ?? {}), language: 'en' },
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

function normaliseUsername(value) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24);
}

function localBangladeshDigits(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00880')) digits = digits.slice(2);
  if (digits.startsWith('880')) digits = `0${digits.slice(3)}`;
  return digits;
}

function normaliseBangladeshPhone(value) {
  const digits = localBangladeshDigits(value);
  if (!/^01[3-9]\d{8}$/.test(digits)) return '';
  return `+880${digits.slice(1)}`;
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

function formatTime(value, language = 'en') {
  try {
    return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatDay(value, language = 'en') {
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

function Avatar({ name, id = '', saved = false, size = 'md', online = false, photo = '' }) {
  const [background, foreground] = colorFor(id || name);
  return (
    <span className={`avatar avatar-${size} ${saved ? 'avatar-saved' : ''}`} style={{ '--avatar-bg': background, '--avatar-fg': foreground }}>
      {photo && !saved ? <img className="avatar-photo" src={photo} alt="" /> : saved ? <MessageCircle size={size === 'sm' ? 15 : 19} strokeWidth={2.2} /> : <span>{initials(name)}</span>}
      {online && <i className="avatar-online" />}
    </span>
  );
}

function BrandMark({ small = false }) {
  return (
    <span className={`brand-mark ${small ? 'brand-mark-small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <path d="M7 13.5A6.5 6.5 0 0 1 13.5 7h15a6.5 6.5 0 0 1 6.5 6.5v7a6.5 6.5 0 0 1-6.5 6.5H21l-7.5 5v-5.15A6.5 6.5 0 0 1 7 20.5v-7Z" fill="white" />
        <path d="M18 27.5A6.5 6.5 0 0 1 24.5 21h10a6.5 6.5 0 0 1 6.5 6.5v5a6.5 6.5 0 0 1-4.7 6.24V43l-6.8-4.5h-5A6.5 6.5 0 0 1 18 32v-4.5Z" fill="#DBEAFE" />
      </svg>
    </span>
  );
}

function App() {
  const [app, setApp] = useState(readStoredApp);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChatId, setSelectedChatId] = useState('saved');
  const [mobileChatOpen, setMobileChatOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
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
  const [screenSharePrompt, setScreenSharePrompt] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [settingsSection, setSettingsSection] = useState('account');

  const socketRef = useRef(null);
  const latestAppRef = useRef(app);
  latestAppRef.current = app;
  const selectedChatRef = useRef(selectedChatId);
  selectedChatRef.current = selectedChatId;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
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
  const profileFileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const globalSearchRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const typingPeerTimersRef = useRef({});
  const inviteHandledRef = useRef(false);

  const language = 'en';
  const t = words.en;
  const selectedChat = app.chats.find((chat) => chat.id === selectedChatId) ?? app.chats.find((chat) => chat.id === 'saved') ?? null;
  const selectedIsOnline = Boolean(selectedChat?.peerId && onlineUsers.some((user) => user.id === selectedChat.peerId));
  const otherOnlineUsers = onlineUsers.filter((user) => user.id !== app.identity.id);
  const directChats = app.chats.filter((chat) => chat.kind !== 'saved');
  const discoveryUsers = useMemo(() => {
    const people = new Map();
    directChats.forEach((chat) => people.set(chat.peerId, {
      id: chat.peerId, peerId: chat.peerId, name: chat.name, username: chat.username || '', phone: chat.phone || '', avatar: chat.avatar || '', online: false, kind: 'direct',
    }));
    otherOnlineUsers.forEach((user) => people.set(user.id, { ...user, peerId: user.id, kind: 'direct', online: true }));
    const localContacts = app.contacts || [];
    return [...people.values()].map((person) => {
      const imported = localContacts.find((contact) => localBangladeshDigits(contact.phone) && localBangladeshDigits(contact.phone) === localBangladeshDigits(person.phone));
      return imported ? { ...person, name: imported.name || person.name, importedName: imported.name } : person;
    });
  }, [directChats, otherOnlineUsers, app.contacts]);
  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return [];
    const nameQuery = query.replace(/^@/, '');
    const phoneQuery = localBangladeshDigits(query);
    return discoveryUsers.filter((person) => {
      const searchable = `${person.name || ''} ${person.username || ''} @${person.username || ''} ${person.id || ''}`.toLowerCase();
      const personDigits = localBangladeshDigits(person.phone || '');
      return searchable.includes(query) || searchable.includes(nameQuery) || (phoneQuery.length >= 3 && personDigits.includes(phoneQuery));
    }).slice(0, 12);
  }, [discoveryUsers, globalSearch]);
  const storageUsedBytes = useMemo(() => new Blob([JSON.stringify(app)]).size, [app]);

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
    const isActive = activeTabRef.current === 'chats' && selectedChatRef.current === message.fromId && document.visibilityState === 'visible';
    setApp((current) => {
      const existingChat = current.chats.find((chat) => chat.peerId === message.fromId);
      const newChat = existingChat ?? {
        id: message.fromId,
        peerId: message.fromId,
        name: message.senderName || `${t.guest} ${message.fromId.slice(-4)}`,
        username: message.senderUsername || '',
        phone: message.senderPhone || '',
        avatar: message.senderAvatar || '',
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
        username: message.senderUsername || newChat.username || '',
        phone: message.senderPhone || newChat.phone || '',
        avatar: message.senderAvatar || newChat.avatar || '',
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
          new Notification(message.senderName || 'You and Me', { body: message.text || message.attachment?.name || t.message });
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
      peerAvatar: payload.fromAvatar || '',
      kind: payload.kind === 'video' ? 'video' : 'audio',
      direction: 'incoming',
      status: 'ringing',
      startedAt: Date.now(),
      localStream: null,
      remoteStream: null,
      muted: false,
      videoOff: false,
      speakerOn: true,
      keypadOpen: false,
      screenSharing: false,
      cameraFacing: 'user',
    });
  }
  incomingCallRef.current = handleIncomingCall;

  useEffect(() => {
    const socket = io({ autoConnect: false, reconnection: true, timeout: 8000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connecting');
      const latest = latestAppRef.current;
      socket.emit('guest:register', {
        id: app.identity.id,
        key: app.identity.key,
        ...latest.profile,
        phone: latest.profile.phonePublic ? latest.profile.phone : '',
        showPresence: latest.settings.showPresence,
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
      setApp((current) => ({ ...current, chats: current.chats.map((chat) => chat.phone ? { ...chat, phone: '' } : chat) }));
    });
    socket.on('connect_error', () => setConnectionStatus('offline'));
    socket.on('presence:update', (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
      setApp((current) => {
        let changed = false;
        const chats = current.chats.map((chat) => {
          if (chat.kind === 'saved') return chat;
          const match = users?.find((user) => user.id === chat.peerId);
          if (!match) {
            if (chat.phone) changed = true;
            return chat.phone ? { ...chat, phone: '' } : chat;
          }
          const updated = {
            ...chat,
            name: chat.customName ? chat.name : (match.name || chat.name),
            username: match.username || '',
            phone: match.phone || '',
            avatar: match.avatar || '',
          };
          const chatChanged = updated.name !== chat.name || updated.username !== chat.username || updated.phone !== chat.phone || updated.avatar !== chat.avatar;
          if (chatChanged) changed = true;
          return chatChanged ? updated : chat;
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
    if (socketRef.current?.connected) {
      socketRef.current.emit('guest:update', {
        ...app.profile,
        phone: app.profile.phonePublic ? app.profile.phone : '',
        showPresence: app.settings.showPresence,
      });
    }
  }, [app.profile.name, app.profile.username, app.profile.phone, app.profile.phonePublic, app.profile.avatar, app.settings.showPresence]);

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

  function updateProfile(profile) {
    setApp((current) => ({ ...current, profile: { ...current.profile, ...profile } }));
  }

  function saveProfile(profile) {
    const phone = profile.phone.trim() ? normaliseBangladeshPhone(profile.phone) : '';
    if (profile.phone.trim() && !phone) {
      showToast(t.phoneInvalid);
      return false;
    }
    updateProfile({
      ...profile,
      name: profile.name.trim().slice(0, 40) || `Guest ${latestAppRef.current.identity.id.slice(-4)}`,
      username: normaliseUsername(profile.username),
      phone,
      phonePublic: Boolean(profile.phonePublic && phone),
    });
    showToast(t.savedProfile);
    return true;
  }

  async function importContacts() {
    const contactsApi = navigator.contacts;
    if (!contactsApi?.select) {
      showToast(t.contactsUnsupported);
      return;
    }
    try {
      const records = await contactsApi.select(['name', 'tel'], { multiple: true });
      const imported = records.flatMap((record) => (record.tel || []).map((phone, index) => ({
        name: record.name?.[0] || `${t.guest} ${index + 1}`,
        phone: normaliseBangladeshPhone(phone) || phone,
      }))).slice(0, 300);
      setApp((current) => ({ ...current, contacts: imported }));
      showToast(`${imported.length} ${t.contacts.toLowerCase()} imported`);
    } catch {
      // The user can cancel the browser's contact picker at any time.
    }
  }

  function clearAllLocalData() {
    if (!window.confirm(t.clearAllConfirm)) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  function logoutGuest() {
    if (!window.confirm(t.logoutConfirm)) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
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
        return {
          ...current,
          chats: current.chats.map((chat) => chat.id === found.id ? {
            ...chat,
            ...(suggestedName.trim() ? { name: suggestedName.trim(), customName: true } : {}),
            username: online?.username || chat.username || '',
            phone: online?.phone || chat.phone || '',
            avatar: online?.avatar || chat.avatar || '',
          } : chat),
        };
      }
      const chat = {
        id,
        peerId: id,
        name: initialName,
        username: online?.username || '',
        phone: online?.phone || '',
        avatar: online?.avatar || '',
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
    const shareData = { title: 'You and Me', text: t.shareText, url };
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

  async function startCall(kind, target = selectedChat) {
    const peerId = target?.peerId || (target?.kind === 'direct' ? target.id : '');
    if (!peerId) return;
    if (!socketRef.current?.connected) {
      showToast(t.callOffline);
      return;
    }
    if (!onlineUsers.some((user) => user.id === peerId)) {
      showToast(t.callOffline);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(t.callMediaError);
      return;
    }
    const callId = makeUuid();
    const peerName = target.name || `${t.guest} ${peerId.slice(-4)}`;
    const peerAvatar = target.avatar || onlineUsers.find((user) => user.id === peerId)?.avatar || '';
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    remoteIceRef.current = [];
    cameraTrackRef.current = null;
    setCurrentCall({ callId, peerId, peerName, peerAvatar, kind, direction: 'outgoing', status: 'ringing', startedAt: Date.now(), localStream: null, remoteStream: null, muted: false, videoOff: false, speakerOn: true, keypadOpen: false, screenSharing: false, cameraFacing: 'user' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      if (callRef.current?.callId !== callId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
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
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
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
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    setScreenSharing(false);
    setScreenSharePrompt(false);
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

  function toggleSpeaker() {
    setCurrentCall((current) => current ? { ...current, speakerOn: !current.speakerOn } : current);
  }

  function toggleKeypad() {
    setCurrentCall((current) => current ? { ...current, keypadOpen: !current.keypadOpen } : current);
  }

  function sendCallDigit(digit) {
    const sender = peerConnectionRef.current?.getSenders().find((item) => item.track?.kind === 'audio');
    if (sender?.dtmf?.canInsertDTMF) sender.dtmf.insertDTMF(String(digit), 120);
  }

  async function switchCamera() {
    const call = callRef.current;
    const track = cameraTrackRef.current;
    if (!call || !track || typeof track.applyConstraints !== 'function') return;
    const nextFacing = call.cameraFacing === 'environment' ? 'user' : 'environment';
    try {
      await track.applyConstraints({ facingMode: { ideal: nextFacing } });
      setCurrentCall((current) => current ? { ...current, cameraFacing: nextFacing } : current);
    } catch {
      showToast('This device cannot switch cameras during a call.');
    }
  }

  function requestScreenShare() {
    if (callRef.current?.kind !== 'video') return;
    setScreenSharePrompt(true);
  }

  async function allowScreenShare() {
    setScreenSharePrompt(false);
    if (!navigator.mediaDevices?.getDisplayMedia || !peerConnectionRef.current) {
      showToast('Screen sharing is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      const sender = peerConnectionRef.current.getSenders().find((item) => item.track?.kind === 'video');
      if (!track || !sender) {
        stream.getTracks().forEach((item) => item.stop());
        showToast('Start a video call before sharing your screen.');
        return;
      }
      screenStreamRef.current = stream;
      await sender.replaceTrack(track);
      track.onended = () => stopScreenShare();
      setScreenSharing(true);
      setCurrentCall((current) => current ? { ...current, screenSharing: true } : current);
    } catch {
      // The browser owns the prompt; cancelling it leaves the call untouched.
    }
  }

  async function stopScreenShare() {
    const sender = peerConnectionRef.current?.getSenders().find((item) => item.track?.kind === 'video');
    const cameraTrack = cameraTrackRef.current;
    if (sender && cameraTrack?.readyState === 'live') {
      try { await sender.replaceTrack(cameraTrack); } catch { /* The call may have ended. */ }
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenSharing(false);
    setCurrentCall((current) => current ? { ...current, screenSharing: false } : current);
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
              <strong>You and Me</strong>
              <small>{t.tagline}</small>
            </div>
          </div>
          <div className="sidebar-top-actions">
            <span className={`connection-dot connection-${connectionStatus}`} title={connectionStatus === 'connected' ? t.connected : t.offline} />
            <button className="icon-button subtle-icon" title={t.settings} aria-label={t.settings} onClick={() => setModal('settings')}><Settings size={19} /></button>
          </div>
        </header>

        <nav className="primary-tabs" aria-label="Main navigation">
          <button className={activeTab === 'home' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('home')}><Home size={17} /><span>{t.home}</span></button>
          <button className={activeTab === 'chats' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('chats')}>
            <MessagesSquare size={17} /><span>{t.chats}</span>
            {app.chats.reduce((sum, chat) => sum + (chat.unread || 0), 0) > 0 && <b className="tab-count">{app.chats.reduce((sum, chat) => sum + (chat.unread || 0), 0)}</b>}
          </button>
          <button className={activeTab === 'calls' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('calls')}><Phone size={17} /><span>{t.calls}</span></button>
          <button className={activeTab === 'contacts' ? 'tab-button active' : 'tab-button'} onClick={() => chooseTab('contacts')}><Users size={17} /><span>{t.contacts}</span></button>
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
                    <Avatar name={chat.kind === 'saved' ? t.saved : chat.name} id={chat.peerId || 'saved'} saved={chat.kind === 'saved'} size="md" online={isOnline} photo={chat.avatar} />
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

        {activeTab === 'home' && (
          <div className="sidebar-section-list home-sidebar-list">
            <div className="list-heading"><div><span className="eyebrow">{t.home}</span><strong>{t.peopleOnline}</strong></div><span className="soft-count">{otherOnlineUsers.length}</span></div>
            {otherOnlineUsers.slice(0, 8).map((user) => (
              <button className="mini-history-row" key={user.id} onClick={() => openPeer(user.id, user.name)}>
                <Avatar name={user.name} id={user.id} photo={user.avatar} size="sm" online />
                <span><strong>{user.name}</strong><small>{user.username ? `@${user.username}` : user.id}</small></span><MessageCircle size={15} />
              </button>
            ))}
            {!otherOnlineUsers.length && <div className="sidebar-empty compact-empty"><Users size={19} /><small>{t.noOnline}</small></div>}
            <button className="add-contact-wide" onClick={() => chooseTab('contacts')}><Users size={16} />{t.manageContacts}</button>
          </div>
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
                <Avatar name={user.name} id={user.id} size="sm" online photo={user.avatar} />
                <span><strong>{user.name}</strong><small>{user.username ? `@${user.username}` : user.id}</small></span><span className="online-small-dot" />
              </button>
            ))}
            {!otherOnlineUsers.length && <div className="sidebar-empty compact-empty"><Users size={19} /><small>{t.noOnline}</small></div>}
            <button className="add-contact-wide" onClick={() => setModal('new-chat')}><Plus size={16} />{t.addContact}</button>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className="identity-card">
            <button className="identity-main" onClick={() => setModal('settings')}>
              <Avatar name={app.profile.name} id={app.identity.id} size="sm" online={connectionStatus === 'connected'} photo={app.profile.avatar} />
              <span className="identity-copy"><strong>{app.profile.name}</strong><small>{app.identity.id}</small></span>
            </button>
            <button className="identity-share" title={t.shareInvite} aria-label={t.shareInvite} onClick={shareInvite}><Share2 size={16} /></button>
          </div>
          <div className="sidebar-footer-note"><ShieldCheck size={13} />{t.noSignup ?? 'No sign-up required'}</div>
        </div>
      </aside>

      <main className="main-panel">
        {activeTab === 'home' && (
          <HomeWorkspace
            profile={app.profile}
            identity={app.identity}
            users={discoveryUsers}
            recentChats={directChats.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5)}
            calls={app.calls.slice(0, 3)}
            query={globalSearch}
            searchOpen={globalSearchOpen}
            results={globalSearchResults}
            onlineCount={otherOnlineUsers.length}
            connectionStatus={connectionStatus}
            t={t}
            language={language}
            onQuery={(value) => setGlobalSearch(value)}
            onFocusSearch={() => setGlobalSearchOpen(true)}
            onOpenPeer={openPeer}
            onCall={startCall}
            onNewChat={() => setModal('new-chat')}
            onChats={() => chooseTab('chats')}
            onContacts={() => chooseTab('contacts')}
            onCalls={() => chooseTab('calls')}
            onSettings={() => setModal('settings')}
            onShare={shareInvite}
            onBack={() => setMobileChatOpen(false)}
          />
        )}
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
            importedContacts={app.contacts}
            query={globalSearch}
            identity={app.identity}
            t={t}
            onSearch={setGlobalSearch}
            onOpenPeer={openPeer}
            onCall={startCall}
            onNewChat={() => setModal('new-chat')}
            onCopyId={() => copyText(app.identity.id)}
            onShare={shareInvite}
            onBack={() => setMobileChatOpen(false)}
            onImportContacts={importContacts}
          />
        )}
        {activeTab !== 'chats' && <MobileBottomNav activeTab={activeTab} onSelect={chooseTab} onSettings={() => setModal('settings')} t={t} />}
      </main>

      {modal === 'new-chat' && (
        <NewChatDialog t={t} identity={app.identity} onClose={() => setModal('')} onStart={(id, name) => { setModal(''); openPeer(id, name); }} onCopy={() => copyText(app.identity.id)} />
      )}
      {modal === 'settings' && (
        <SettingsDialog
          t={t}
          app={app}
          section={settingsSection}
          onSectionChange={setSettingsSection}
          storageUsed={storageUsedBytes}
          onClose={() => setModal('')}
          onSaveProfile={saveProfile}
          onSettings={updateSettings}
          onCopy={() => copyText(app.identity.id)}
          onShare={shareInvite}
          onImportContacts={importContacts}
          onLogout={logoutGuest}
          onClearHistory={() => {
            if (!window.confirm('Clear all local conversations and call history?')) return;
            setApp((current) => ({ ...current, chats: [makeSavedChat()], calls: [] }));
          }}
          onClearAll={clearAllLocalData}
          onPhotoTooLarge={() => showToast(t.photoTooLarge)}
          onPhotoUnsupported={() => showToast(t.photoUnsupported)}
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
          onSpeaker={toggleSpeaker}
          onKeypad={toggleKeypad}
          onDigit={sendCallDigit}
          onScreenShare={screenSharing ? stopScreenShare : requestScreenShare}
          onSwitchCamera={switchCamera}
        />
      )}
      {screenSharePrompt && <ScreenSharePrompt t={t} onCancel={() => setScreenSharePrompt(false)} onAllow={allowScreenShare} />}
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  );
}

function MobileBottomNav({ activeTab, onSelect, onSettings, t }) {
  return <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
    <button className={activeTab === 'home' ? 'active' : ''} onClick={() => onSelect('home')}><Home size={18} /><span>{t.home}</span></button>
    <button className={activeTab === 'chats' ? 'active' : ''} onClick={() => onSelect('chats')}><MessagesSquare size={18} /><span>{t.chats}</span></button>
    <button className={activeTab === 'calls' ? 'active' : ''} onClick={() => onSelect('calls')}><Phone size={18} /><span>{t.calls}</span></button>
    <button className={activeTab === 'contacts' ? 'active' : ''} onClick={() => onSelect('contacts')}><Users size={18} /><span>{t.contacts}</span></button>
    <button onClick={onSettings}><Settings size={18} /><span>{t.settings}</span></button>
  </nav>;
}

function HomeWorkspace({ profile, identity, users, recentChats, calls, query, searchOpen, results, onlineCount, connectionStatus, t, language, onQuery, onFocusSearch, onOpenPeer, onCall, onNewChat, onChats, onContacts, onCalls, onSettings, onShare, onBack }) {
  const onlineUsers = users.filter((user) => user.online);
  const idQuery = parseGuestId(query);
  return (
    <section className="workspace-page home-page">
      <header className="workspace-header home-header">
        <button className="mobile-workspace-back back-button" onClick={onBack} aria-label={t.home}><ChevronLeft size={22} /></button>
        <div className="workspace-title"><span className="eyebrow">You and Me · {connectionStatus === 'connected' ? t.connected : t.connecting}</span><h1>{t.welcomeBack}, {profile.name}</h1><p>{t.heroDescription}</p></div>
        <button className="home-settings-button" onClick={onSettings} aria-label={t.settings}><Settings size={18} /><span>{t.settings}</span></button>
      </header>
      <div className="workspace-content home-content">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-kicker"><span className="home-kicker-dot" />NO ACCOUNT NEEDED</span>
            <h2>{t.heroHeadline}</h2>
            <p>{t.heroDescription}</p>
            <div className="global-search-wrap">
              <label className="global-search">
                <Search size={20} />
                <input
                  value={query}
                  onChange={(event) => onQuery(event.target.value)}
                  onFocus={onFocusSearch}
                  onKeyDown={(event) => { if (event.key === 'Enter' && idQuery) onOpenPeer(idQuery); }}
                  placeholder={t.globalSearchPlaceholder}
                  aria-label={t.globalSearchPlaceholder}
                />
                {query && <button type="button" className="global-clear" onClick={() => onQuery('')} aria-label={t.close}><X size={16} /></button>}
              </label>
              {searchOpen && query.trim() && (
                <div className="global-results-panel">
                  <div className="global-results-heading"><span>{t.searchPeopleHint}</span><span>{results.length}</span></div>
                  {results.length ? results.map((person) => <PersonCard key={person.id} person={person} t={t} compact onMessage={() => onOpenPeer(person.id, person.name)} onCall={(kind) => onCall(kind, person)} />) : idQuery ? (
                    <button className="id-search-fallback" onClick={() => onOpenPeer(idQuery)}><Hash size={17} /><span><strong>{idQuery}</strong><small>{t.searchIdHint}</small></span><MessageCircle size={17} /></button>
                  ) : <div className="global-no-results"><Search size={18} /><span>{t.noSearchResults}</span><small>{t.searchIdHint}</small></div>}
                </div>
              )}
            </div>
            <div className="home-search-hint"><ShieldCheck size={13} />{t.searchPeopleHint}</div>
            <div className="hero-quick-actions">
              <button onClick={onNewChat}><span className="quick-icon message-quick"><MessageCircle size={16} /></span>{t.startMessage}</button>
              <button onClick={onContacts}><span className="quick-icon call-quick"><Phone size={16} /></span>{t.audioCall}</button>
              <button onClick={onShare}><span className="quick-icon share-quick"><Share2 size={16} /></span>{t.shareInvite}</button>
            </div>
          </div>
          <div className="home-hero-art" aria-hidden="true">
            <span className="hero-orbit hero-orbit-one" /><span className="hero-orbit hero-orbit-two" />
            <div className="hero-app-card">
              <div className="hero-card-top"><BrandMark small /><span><strong>You and Me</strong><small>Connection, made simple</small></span><i /></div>
              <div className="hero-chat-preview"><Avatar name={onlineUsers[0]?.name || profile.name} id={onlineUsers[0]?.id || identity.id} photo={onlineUsers[0]?.avatar || profile.avatar} size="sm" online={onlineUsers.length > 0} /><span><strong>{onlineUsers[0]?.name || 'Your people'}</strong><small>{onlineUsers.length ? t.onlineNow : 'Find someone to start chatting'}</small></span><MessageCircle size={17} /></div>
              <div className="hero-message-preview"><span>Hey, are you free to talk?</span><small>10:24 AM <CheckCheck size={12} /></small></div>
              <div className="hero-card-footer"><span><Phone size={15} /> Audio</span><span><Video size={15} /> Video</span><span><ShieldCheck size={15} /> Private</span></div>
            </div>
            <span className="hero-floating-dot dot-a" /><span className="hero-floating-dot dot-b" />
            <div className="hero-online-badge"><i />{onlineCount} online</div>
          </div>
        </section>

        <div className="home-grid">
          <section className="home-section-card recent-section">
            <header className="home-section-heading"><div><span className="section-icon blue-icon"><MessagesSquare size={17} /></span><span><strong>{t.recentChats}</strong><small>{t.noRecentChats}</small></span></div><button className="text-icon-button" onClick={onChats}>{t.viewAll}<ArrowUpRight size={14} /></button></header>
            {recentChats.length ? <div className="home-recent-list">{recentChats.map((chat) => {
              const online = onlineUsers.some((person) => person.id === chat.peerId);
              const last = chat.messages.at(-1);
              return <button className="home-recent-row" key={chat.id} onClick={() => onOpenPeer(chat.peerId, chat.name)}><Avatar name={chat.name} id={chat.peerId} photo={chat.avatar} size="md" online={online} /><span className="home-recent-main"><strong>{chat.name}</strong><small>{last ? (last.text || last.attachment?.name || t.message) : chat.peerId}</small></span><span className="home-recent-time">{last ? formatTime(last.createdAt, language) : ''}{chat.unread > 0 && <b>{chat.unread}</b>}</span></button>;
            })}</div> : <div className="recent-empty"><div className="recent-empty-icon"><MessageCircle size={19} /></div><strong>{t.noRecentChats}</strong><p>{t.searchIdHint}</p><button className="primary-button compact-button" onClick={onNewChat}><Plus size={15} />{t.newChat}</button></div>}
          </section>

          <aside className="home-side-column">
            <section className="home-section-card online-section">
              <header className="home-section-heading"><div><span className="section-icon green-icon"><span className="online-small-dot" /></span><span><strong>{t.peopleOnline}</strong><small>{onlineCount} online now</small></span></div><button className="icon-only-link" onClick={onContacts} aria-label={t.contacts}><ArrowUpRight size={16} /></button></header>
              {onlineUsers.length ? <div className="online-preview-list">{onlineUsers.slice(0, 4).map((person) => <button key={person.id} className="online-preview-row" onClick={() => onOpenPeer(person.id, person.name)}><Avatar name={person.name} id={person.id} photo={person.avatar} size="sm" online /><span><strong>{person.name}</strong><small>{person.username ? `@${person.username}` : person.id}</small></span><MessageCircle size={15} /></button>)}</div> : <div className="online-empty"><Users size={18} /><span>{t.noOnline}</span></div>}
              <button className="online-section-link" onClick={onContacts}>{t.manageContacts}<ArrowUpRight size={14} /></button>
            </section>
            <section className="my-id-home-card"><div className="my-id-home-icon"><BrandMark small /></div><span><small>{t.yourId}</small><strong>{identity.id}</strong></span><button onClick={onShare} aria-label={t.shareInvite}><Share2 size={16} /></button></section>
            {calls.length > 0 && <section className="home-section-card home-call-section"><header className="home-section-heading"><div><span className="section-icon lavender-icon"><Phone size={16} /></span><span><strong>{t.callHistory}</strong><small>Recent activity</small></span></div><button className="icon-only-link" onClick={onCalls} aria-label={t.calls}><ArrowUpRight size={16} /></button></header>{calls.slice(0, 2).map((call) => <div className="home-call-row" key={call.id}><Avatar name={call.peerName} id={call.peerId} size="sm" /><span><strong>{call.peerName}</strong><small>{call.kind === 'video' ? t.videoCall : t.audioCall}</small></span><time>{formatTime(call.at, language)}</time></div>)}</section>}
          </aside>
        </div>
      </div>
    </section>
  );
}

function PersonCard({ person, t, onMessage, onCall, compact = false }) {
  return (
    <div className={`person-result ${compact ? 'person-result-compact' : ''}`}>
      <Avatar name={person.name} id={person.id} photo={person.avatar} size={compact ? 'sm' : 'md'} online={person.online} />
      <div className="person-result-copy"><strong>{person.name}</strong><span>{person.username ? `@${person.username}` : person.id}{person.phone ? ` · ${person.phone}` : ''}</span></div>
      <span className={`person-presence ${person.online ? 'presence-online' : ''}`}><i />{person.online ? t.online : t.offline}</span>
      <div className="person-result-actions">
        <button title={t.startMessage} aria-label={t.startMessage} onClick={onMessage}><MessageCircle size={15} /></button>
        <button title={t.audioCall} aria-label={t.audioCall} onClick={() => onCall('audio')}><Phone size={15} /></button>
        <button title={t.videoCall} aria-label={t.videoCall} onClick={() => onCall('video')}><Video size={15} /></button>
      </div>
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
            <Avatar name={peerName} id={chat.peerId || 'saved'} saved={isSaved} size="lg" online={isOnline} photo={chat.avatar} />
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
                <Avatar name={peerName} id={chat.peerId} size="xl" online={isOnline} photo={chat.avatar} />
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
          <div className="details-profile"><Avatar name={peerName} id={chat.peerId || 'saved'} saved={isSaved} size="xl" online={isOnline} photo={chat.avatar} /><strong>{peerName}</strong><span>{isSaved ? t.privateSpace : chat.peerId}</span></div>
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
        <div className="workspace-title"><span className="eyebrow">You and Me</span><h1>{t.calls}</h1><p>{t.callHistory}</p></div>
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

function ContactsWorkspace({ contacts, onlineUsers, identity, importedContacts, query, t, onSearch, onOpenPeer, onCall, onNewChat, onCopyId, onShare, onBack, onImportContacts }) {
  const people = new Map();
  contacts.forEach((contact) => people.set(contact.peerId, { ...contact, id: contact.peerId, online: false, kind: 'direct' }));
  onlineUsers.forEach((user) => people.set(user.id, { ...user, id: user.id, peerId: user.id, online: true, kind: 'direct' }));
  const allPeople = [...people.values()];
  const normalized = query.trim().toLowerCase().replace(/^@/, '');
  const digits = localBangladeshDigits(query);
  const filteredPeople = allPeople.filter((person) => {
    if (!normalized) return true;
    const text = `${person.name || ''} ${person.username || ''} @${person.username || ''} ${person.id || ''}`.toLowerCase();
    return text.includes(normalized) || (digits.length >= 3 && localBangladeshDigits(person.phone).includes(digits));
  });
  const online = filteredPeople.filter((person) => person.online);
  const offline = filteredPeople.filter((person) => !person.online);
  return (
    <section className="workspace-page contacts-page">
      <header className="workspace-header">
        <button className="mobile-workspace-back back-button" onClick={onBack} aria-label={t.home}><ChevronLeft size={22} /></button>
        <div className="workspace-title"><span className="eyebrow">You and Me</span><h1>{t.contacts}</h1><p>{t.onlineListHint}</p></div>
        <div className="workspace-header-actions"><button className="secondary-button" onClick={onImportContacts}><ContactRound size={16} />{t.contactsImport}</button><button className="primary-button" onClick={onNewChat}><UserPlus size={17} />{t.addContact}</button></div>
      </header>
      <div className="workspace-content contacts-content">
        <div className="contacts-search-row"><label className="contacts-search"><Search size={18} /><input value={query} onChange={(event) => onSearch(event.target.value)} placeholder={t.globalSearchPlaceholder} /><span>LIVE</span></label><small>Search currently visible You and Me users and saved contacts.</small></div>
        <div className="my-id-card">
          <div className="my-id-mark"><Share2 size={21} /></div>
          <div className="my-id-copy"><span className="eyebrow">{t.yourId}</span><strong>{identity.id}</strong><small>{t.newChatHint}</small></div>
          <div className="my-id-actions"><button className="soft-action" onClick={onCopyId}><Copy size={15} />{t.copyId}</button><button className="primary-button compact-button" onClick={onShare}><Share2 size={15} />{t.shareInvite}</button></div>
        </div>
        <div className="content-section-heading"><div><span className="section-icon green-icon"><span className="online-small-dot" /></span><div><h2>{t.onlineNow}</h2><p>{online.length} online now</p></div></div></div>
        {online.length ? <div className="people-directory-grid">{online.map((person) => <PersonCard key={person.id} person={person} t={t} onMessage={() => onOpenPeer(person.id, person.name)} onCall={(kind) => onCall(kind, person)} />)}</div> : <div className="inline-empty"><Users size={18} /><span>{query ? t.noSearchResults : t.noOnline}</span></div>}
        <div className="content-section-heading contact-heading"><div><span className="section-icon lavender-icon"><Users size={17} /></span><div><h2>{t.yourContacts}</h2><p>{offline.length} saved contacts</p></div></div><button className="text-icon-button" onClick={onNewChat}><Plus size={15} />{t.addContact}</button></div>
        {offline.length ? <div className="people-directory-grid">{offline.map((person) => <PersonCard key={person.id} person={person} t={t} onMessage={() => onOpenPeer(person.id, person.name)} onCall={(kind) => onCall(kind, person)} />)}</div> : <div className="inline-empty"><UserPlus size={18} /><span>{t.noContacts}</span><button onClick={onNewChat}>{t.addContact}</button></div>}
        {importedContacts?.length > 0 && <div className="imported-contacts-note"><ContactRound size={15} />{importedContacts.length} contacts imported on this device. Their phone details stay private here.</div>}
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
        <label className="field-label">You and Me ID</label>
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

function SettingsDialog({
  t, app, section, onSectionChange, onClose, onSaveProfile, onSettings, onCopy, onShare,
  onNotify, onImportContacts, onLogout, onClearHistory, onClearAll, storageUsed, onPhotoTooLarge, onPhotoUnsupported,
}) {
  const [draft, setDraft] = useState({
    name: app.profile.name,
    username: app.profile.username || '',
    phone: app.profile.phone || '',
    phonePublic: Boolean(app.profile.phonePublic),
    avatar: app.profile.avatar || '',
  });
  const [noticePermission, setNoticePermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const photoInputRef = useRef(null);
  const sections = [
    { key: 'account', label: t.account, icon: UserRound },
    { key: 'privacy', label: t.privacy, icon: ShieldCheck },
    { key: 'notifications', label: t.notifications, icon: Bell },
    { key: 'data', label: t.dataStorage, icon: HardDrive },
    { key: 'appearance', label: t.appearance, icon: Sun },
    { key: 'calls', label: t.callsSettings, icon: Phone },
    { key: 'contacts', label: t.contactsSettings, icon: ContactRound },
    { key: 'security', label: t.security, icon: LockKeyhole },
    { key: 'support', label: t.support, icon: CircleHelp },
    { key: 'logout', label: t.logout, icon: LogOut },
  ];
  const activeSection = sections.find((item) => item.key === section) || sections[0];

  async function enableNotifications() {
    await onNotify();
    if (typeof Notification !== 'undefined') setNoticePermission(Notification.permission);
  }

  async function onPhotoSelected(event) {
    const photo = event.target.files?.[0];
    event.target.value = '';
    if (!photo) return;
    if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(photo.type)) {
      onPhotoUnsupported();
      return;
    }
    if (photo.size > 120 * 1024) {
      onPhotoTooLarge();
      return;
    }
    try {
      const avatar = await readAsDataUrl(photo);
      setDraft((current) => ({ ...current, avatar }));
    } catch {
      onPhotoTooLarge();
    }
  }

  function saveDraft() {
    if (onSaveProfile(draft)) {
      const phone = normaliseBangladeshPhone(draft.phone);
      setDraft((current) => ({ ...current, phone, phonePublic: Boolean(current.phonePublic && phone), username: normaliseUsername(current.username) }));
    }
  }

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card settings-dialog settings-dialog-full">
        <header className="settings-dialog-header"><div><span className="eyebrow">You and Me</span><h2>{t.settings}</h2></div><button className="dialog-close static-close" onClick={onClose} aria-label={t.close}><X size={19} /></button></header>
        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {sections.map(({ key, label, icon: Icon }) => <button key={key} className={`settings-nav-item ${section === key ? 'selected' : ''} ${key === 'logout' ? 'logout-nav-item' : ''}`} onClick={() => onSectionChange(key)}><Icon size={16} /><span>{label}</span>{section === key && <i />}</button>)}
          </nav>
          <div className="settings-panel">
            <div className="settings-panel-heading"><span className="section-icon blue-icon"><activeSection.icon size={18} /></span><div><h3>{activeSection.label}</h3><p>{t.settingsHint}</p></div></div>
            <div className="settings-scroll">
              {section === 'account' && <>
                <div className="settings-profile-card">
                  <Avatar name={draft.name} id={app.identity.id} size="xl" photo={draft.avatar} />
                  <div className="settings-profile-data"><span className="eyebrow">{t.profile}</span><strong>{app.identity.id}</strong><small>{t.accountHint}</small></div>
                  <button className="secondary-button photo-change-button" onClick={() => photoInputRef.current?.click()}><Camera size={15} />{t.changePhoto}</button>
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={onPhotoSelected} />
                </div>
                {draft.avatar && <button className="remove-photo-button" onClick={() => setDraft((current) => ({ ...current, avatar: '' }))}>{t.removePhoto}</button>}
                <label className="field-label">{t.displayName}</label>
                <input className="text-field" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} maxLength={40} />
                <label className="field-label">{t.username}</label>
                <div className="username-input-wrap"><span>@</span><input className="text-field" value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: normaliseUsername(event.target.value) }))} placeholder="yourname" maxLength={24} /></div>
                <label className="field-label">{t.phoneOptional}</label>
                <input className="text-field" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="+880 1712 345678" inputMode="tel" maxLength={18} />
                <p className="field-helper">Your number stays private unless you explicitly make it searchable.</p>
                <div className="account-id-row"><span><small>{t.yourId}</small><strong>{app.identity.id}</strong></span><div><button className="small-copy-button" onClick={onCopy} aria-label={t.copyId}><Copy size={16} /></button><button className="small-copy-button" onClick={onShare} aria-label={t.shareInvite}><Share2 size={16} /></button></div></div>
                <button className="primary-button settings-save-button" onClick={saveDraft}>{t.save}</button>
              </>}

              {section === 'privacy' && <>
                <button className="setting-toggle-row setting-card-row" onClick={() => onSettings({ showPresence: !app.settings.showPresence })}><span className="setting-row-icon"><Users size={17} /></span><span><strong>{t.showPresence}</strong><small>{t.presenceHint}</small></span><span className={`toggle-switch ${app.settings.showPresence ? 'toggle-on' : ''}`}><i /></span></button>
                <button className="setting-toggle-row setting-card-row" onClick={() => setDraft((current) => ({ ...current, phonePublic: !current.phonePublic }))}><span className="setting-row-icon"><Smartphone size={17} /></span><span><strong>{t.phoneVisibility}</strong><small>{t.phonePrivacyHint}</small></span><span className={`toggle-switch ${draft.phonePublic ? 'toggle-on' : ''}`}><i /></span></button>
                <div className="privacy-card"><ShieldCheck size={18} /><div><strong>{t.privacy}</strong><p>{t.privacyHint}</p><small>{t.phonePrivacyHint}</small></div></div>
                <button className="primary-button settings-save-button" onClick={saveDraft}>{t.save}</button>
              </>}

              {section === 'notifications' && <>
                <button className="setting-toggle-row setting-card-row" onClick={() => app.settings.notifications ? onSettings({ notifications: false }) : enableNotifications()}><span className="setting-row-icon"><Bell size={17} /></span><span><strong>{t.enableNotifications}</strong><small>{noticePermission === 'granted' ? 'Browser permission granted' : 'Permission is requested only after you enable this.'}</small></span><span className={`toggle-switch ${app.settings.notifications ? 'toggle-on' : ''}`}><i /></span></button>
                <button className="setting-toggle-row setting-card-row" onClick={() => onSettings({ sound: !app.settings.sound })}><span className="setting-row-icon">{app.settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</span><span><strong>{t.sound}</strong><small>Play a short tone for new messages while the tab is open.</small></span><span className={`toggle-switch ${app.settings.sound ? 'toggle-on' : ''}`}><i /></span></button>
              </>}

              {section === 'data' && <>
                <div className="storage-meter-card"><div className="storage-meter-icon"><HardDrive size={18} /></div><div className="storage-meter-copy"><strong>{t.storageUsed}</strong><small>{t.dataStorageHint}</small></div><b>{formatBytes(storageUsed)}</b></div>
                <div className="storage-meter-track"><i style={{ width: `${Math.min(100, Math.max(4, storageUsed / (5 * 1024 * 1024) * 100))}%` }} /></div>
                <button className="setting-action-row" onClick={onClearHistory}><span className="setting-row-icon"><Trash2 size={17} /></span><span><strong>{t.clearHistory}</strong><small>Remove conversations and call history but keep this guest ID.</small></span><ChevronLeft size={16} /></button>
                <button className="setting-action-row danger-row" onClick={onClearAll}><span className="setting-row-icon"><LogOut size={17} /></span><span><strong>{t.clearAllData}</strong><small>Erase profile, guest ID, messages and settings from this browser.</small></span><ChevronLeft size={16} /></button>
              </>}

              {section === 'appearance' && <>
                <div className="appearance-options"><button className={`appearance-option ${app.settings.theme !== 'dark' ? 'selected' : ''}`} onClick={() => onSettings({ theme: 'light' })}><span className="appearance-preview light-preview"><i /><i /><i /></span><strong>{t.light}</strong><small>Clean blue and white</small></button><button className={`appearance-option ${app.settings.theme === 'dark' ? 'selected' : ''}`} onClick={() => onSettings({ theme: 'dark' })}><span className="appearance-preview dark-preview"><i /><i /><i /></span><strong>{t.dark}</strong><small>Easy on the eyes</small></button></div>
                <div className="theme-palette-row"><span><i className="palette-blue" />Blue</span><span><i className="palette-green" />Success</span><span><i className="palette-gray" />Neutral</span></div>
              </>}

              {section === 'calls' && <>
                <div className="permission-info-card"><span className="permission-info-icon"><Mic size={17} /></span><span><strong>Microphone</strong><small>Your browser asks for access only when you start or answer an audio/video call or record a voice message.</small></span></div>
                <div className="permission-info-card"><span className="permission-info-icon"><Camera size={17} /></span><span><strong>Camera</strong><small>Your browser asks for access only when you start or answer a video call.</small></span></div>
                <div className="permission-info-card"><span className="permission-info-icon"><MonitorUp size={17} /></span><span><strong>Screen sharing</strong><small>The screen picker opens only after you choose Share screen during a video call.</small></span></div>
                <div className="settings-note"><ShieldCheck size={16} />{t.permissionBeforeUse}</div>
              </>}

              {section === 'contacts' && <>
                <div className="settings-info-block"><ContactRound size={21} /><strong>{t.contactsImport}</strong><p>{t.contactsImportHint}</p><small>Imported phone-book data remains on this device and is never published to search.</small></div>
                <button className="primary-button settings-save-button" onClick={onImportContacts}><ContactRound size={16} />{t.contactsImport}</button>
                {app.contacts?.length > 0 && <div className="imported-contacts-note"><ContactRound size={15} />{app.contacts.length} contacts saved locally.</div>}
                <div className="settings-note"><ShieldCheck size={16} />No contact permission is requested until you press Import contacts.</div>
              </>}

              {section === 'security' && <>
                <div className="security-id-card"><span className="security-shield"><LockKeyhole size={19} /></span><div><strong>Guest identity</strong><small>{app.identity.id}</small></div><button className="small-copy-button" onClick={onCopy}><Copy size={16} /></button></div>
                <div className="privacy-card"><ShieldCheck size={18} /><div><strong>Security note</strong><p>{t.securityHint}</p><small>Do not share sensitive information in this starter service.</small></div></div>
                <div className="settings-note">This browser stores your guest key locally. Clearing site data creates a new identity.</div>
              </>}

              {section === 'support' && <>
                <div className="settings-info-block support-info"><CircleHelp size={22} /><strong>{t.support}</strong><p>{t.supportHint}</p><small>For calls, use a secure HTTPS connection and allow browser microphone/camera permission when prompted.</small></div>
                <button className="support-id-row" onClick={onCopy}><span><small>{t.yourId}</small><strong>{app.identity.id}</strong></span><Copy size={16} /></button>
              </>}

              {section === 'logout' && <>
                <div className="logout-panel"><span className="logout-emblem"><LogOut size={22} /></span><h3>{t.logout}</h3><p>This app uses a guest identity instead of an account. Logging out erases this browser’s local profile, guest ID, chats, contacts and settings.</p><button className="danger-button" onClick={onLogout}><LogOut size={16} />{t.logout}</button></div>
              </>}
            </div>
            <footer className="settings-panel-footer"><ShieldCheck size={14} />{t.localOnly}<button onClick={onClose}>{t.close}</button></footer>
          </div>
        </div>
      </section>
    </div>
  );
}

function CallOverlay({
  call, t, onAccept, onDecline, onEnd, onMute, onVideo, onSpeaker, onKeypad, onDigit,
  onScreenShare, onSwitchCamera,
}) {
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const isIncoming = call.direction === 'incoming' && call.status === 'ringing';
  const statusText = call.status === 'active' ? formatDuration(duration) : call.status === 'ringing' ? (isIncoming ? t.incomingCall : t.ringing) : t.connectingCall;
  useEffect(() => {
    if (remoteVideoRef.current && call.remoteStream) remoteVideoRef.current.srcObject = call.remoteStream;
    if (remoteAudioRef.current && call.remoteStream) remoteAudioRef.current.srcObject = call.remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.volume = call.speakerOn ? 1 : 0;
    if (localVideoRef.current && call.localStream) localVideoRef.current.srcObject = call.localStream;
  }, [call.remoteStream, call.localStream, call.kind, call.speakerOn]);
  useEffect(() => {
    const start = call.startedAt || Date.now();
    const tick = () => setDuration(Math.floor((Date.now() - start) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call.startedAt]);
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return (
    <div className={`call-overlay ${call.kind === 'video' ? 'video-call-overlay' : ''}`}>
      <section className="call-window">
        <header className="call-window-header"><span className="call-brand"><BrandMark small />You and Me</span><span className={`call-live-pill ${call.status === 'active' ? 'live' : ''}`}><i />{statusText}</span></header>
        <div className={`call-stage ${call.kind === 'video' ? 'video-stage' : ''} ${call.keypadOpen ? 'has-keypad' : ''}`}>
          {call.kind === 'video' && call.remoteStream ? <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline /> : <div className="call-portrait"><span className="call-pulse pulse-a" /><span className="call-pulse pulse-b" /><Avatar name={call.peerName} id={call.peerId} photo={call.peerAvatar} size="call" /><span className="call-spark">✦</span></div>}
          {call.kind === 'audio' && <audio ref={remoteAudioRef} autoPlay />}
          {call.kind === 'video' && call.localStream && <div className="local-video-tile"><video ref={localVideoRef} autoPlay playsInline muted />{call.videoOff && <span><VideoOff size={15} /></span>}</div>}
          {call.screenSharing && <div className="screen-sharing-indicator"><MonitorUp size={14} />{t.sharingNow}</div>}
          <div className="call-stage-person"><strong>{call.peerName}</strong><small>{call.kind === 'video' ? t.videoCall : t.audioCall}</small></div>
          {call.keypadOpen && call.kind === 'audio' && <div className="call-keypad">{digits.map((digit) => <button key={digit} onClick={() => onDigit(digit)}>{digit}</button>)}<button className="keypad-close" onClick={onKeypad}>Close</button></div>}
        </div>
        <footer className="call-controls">
          {isIncoming ? (
            <>
              <button className="call-control decline-control" onClick={onDecline}><PhoneOff size={20} /><span>{t.decline}</span></button>
              <button className="call-control answer-control" onClick={onAccept}><Phone size={20} /><span>{t.answer}</span></button>
            </>
          ) : (
            <>
              <button className={`call-control utility-control ${call.muted ? 'control-active' : ''}`} onClick={onMute} title={call.muted ? t.unmute : t.mute}><span className="control-round">{call.muted ? <MicOff size={18} /> : <Mic size={18} />}</span><span>{call.muted ? t.unmute : t.mute}</span></button>
              {call.kind === 'audio' && <>
                <button className={`call-control utility-control ${call.keypadOpen ? 'control-active' : ''}`} onClick={onKeypad} title={t.keypad}><span className="control-round"><Hash size={18} /></span><span>{t.keypad}</span></button>
                <button className={`call-control utility-control ${!call.speakerOn ? 'control-active' : ''}`} onClick={onSpeaker} title={t.speaker}><span className="control-round"><Speaker size={18} /></span><span>{call.speakerOn ? t.speaker : t.speakerOff}</span></button>
              </>}
              {call.kind === 'video' && <>
                <button className={`call-control utility-control ${call.videoOff ? 'control-active' : ''}`} onClick={onVideo} title={call.videoOff ? t.cameraOn : t.cameraOff}><span className="control-round">{call.videoOff ? <VideoOff size={18} /> : <Video size={18} />}</span><span>{call.videoOff ? t.cameraOn : t.cameraOff}</span></button>
                <button className={`call-control utility-control ${call.screenSharing ? 'control-active' : ''}`} onClick={onScreenShare} title={call.screenSharing ? t.stopScreenShare : t.screenShare}><span className="control-round">{call.screenSharing ? <MonitorX size={18} /> : <MonitorUp size={18} />}</span><span>{call.screenSharing ? t.stop : t.screenShare}</span></button>
                <button className="call-control utility-control" onClick={onSwitchCamera} title={t.switchCamera}><span className="control-round"><Camera size={18} /></span><span>{t.switchCamera}</span></button>
              </>}
              <button className="call-control decline-control" onClick={onEnd} title={t.endCall}><PhoneOff size={20} /><span>{t.endCall}</span></button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

function ScreenSharePrompt({ t, onCancel, onAllow }) {
  return (
    <div className="share-screen-prompt" role="dialog" aria-modal="true" aria-labelledby="screen-share-title">
      <section className="share-prompt-card">
        <div className="share-prompt-icon"><MonitorUp size={23} /></div>
        <span className="eyebrow">You and Me</span>
        <h2 id="screen-share-title">{t.allowScreenShare}</h2>
        <p>{t.screenShareHint}</p>
        <div className="share-prompt-actions"><button className="secondary-button" onClick={onCancel}>{t.cancel}</button><button className="primary-button" onClick={onAllow}><MonitorUp size={15} />{t.allow}</button></div>
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
