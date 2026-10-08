import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  Headset,
  Info,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import './whatsapp-inbox.css';

const WEBHOOK_PATH = '/api/whatsapp/webhook';
const formatDate = (value, timeOnly = false) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (timeOnly || sameDay) return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};
const initials = (name = '') => String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'WA';
const statusLabel = (status) => ({ pending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed' }[status] || 'Sent');
const terminalCallStatus = new Set(['rejected', 'ended', 'failed']);

async function waitForIceGatheringComplete(peerConnection, timeoutMs = 15_000) {
  if (peerConnection.iceGatheringState === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('ICE candidate gathering timed out.'));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener?.('icegatheringstatechange', onStateChange);
    };
    const onStateChange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };
    peerConnection.addEventListener?.('icegatheringstatechange', onStateChange);
    if (!peerConnection.addEventListener) peerConnection.onicegatheringstatechange = onStateChange;
    onStateChange();
  });
}

async function waitForPeerConnection(peerConnection, timeoutMs = 30_000) {
  if (['connected', 'completed'].includes(peerConnection.iceConnectionState) || peerConnection.connectionState === 'connected') return;
  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The WhatsApp call could not establish a secure media connection.'));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener?.('iceconnectionstatechange', onStateChange);
      peerConnection.removeEventListener?.('connectionstatechange', onStateChange);
    };
    const onStateChange = () => {
      if (['connected', 'completed'].includes(peerConnection.iceConnectionState) || peerConnection.connectionState === 'connected') {
        cleanup();
        resolve();
      } else if (peerConnection.iceConnectionState === 'failed' || peerConnection.connectionState === 'failed') {
        cleanup();
        reject(new Error('The WhatsApp call could not establish a secure media connection.'));
      }
    };
    peerConnection.addEventListener?.('iceconnectionstatechange', onStateChange);
    peerConnection.addEventListener?.('connectionstatechange', onStateChange);
    if (!peerConnection.addEventListener) {
      peerConnection.oniceconnectionstatechange = onStateChange;
      peerConnection.onconnectionstatechange = onStateChange;
    }
    onStateChange();
  });
}

function Avatar({ name, profilePictureUrl = '', size = 'medium' }) {
  return (
    <span className={`wa-avatar wa-avatar-${size}`} aria-hidden="true">
      {profilePictureUrl ? <img src={profilePictureUrl} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}

function MessageStatus({ status }) {
  if (status === 'failed') return <span className="wa-message-status is-failed" title="Failed"><AlertTriangle size={13} /> Failed</span>;
  if (status === 'pending') return <span className="wa-message-status" title="Sending"><Clock3 size={13} /> Sending</span>;
  if (status === 'read') return <span className="wa-message-status is-read" title="Read"><CheckCheck size={15} /> Read</span>;
  if (status === 'delivered') return <span className="wa-message-status" title="Delivered"><CheckCheck size={15} /> Delivered</span>;
  return <span className="wa-message-status" title="Sent"><Check size={14} /> Sent</span>;
}

function MessageBubble({ message }) {
  const outgoing = message.direction === 'outbound';
  return (
    <article className={`wa-message-row ${outgoing ? 'is-outgoing' : 'is-incoming'}`}>
      <div className={`wa-message-bubble ${outgoing ? 'is-outgoing' : 'is-incoming'} ${message.status === 'failed' ? 'has-failed' : ''}`}>
        {message.type === 'call_permission_request' && <span className="wa-call-permission-label"><Phone size={13} /> Call permission request</span>}
        <p>{message.text || (message.media?.fileName ? `Attachment: ${message.media.fileName}` : 'Message')}</p>
        {message.media?.mimeType && <small className="wa-attachment-label">{message.media.mimeType}{message.media.fileName ? ` · ${message.media.fileName}` : ''}</small>}
        {message.error && <small className="wa-failed-explanation">{message.error}</small>}
        <footer>
          <time dateTime={new Date(message.createdAt).toISOString()}>{formatDate(message.createdAt, true)}</time>
          {outgoing && <MessageStatus status={message.status} />}
        </footer>
      </div>
    </article>
  );
}

function LoginScreen({ username, password, setUsername, setPassword, onSubmit, busy, error, setupNeeded }) {
  return (
    <main className="wa-admin-login-page">
      <section className="wa-login-card" aria-labelledby="wa-login-title">
        <div className="wa-login-brand"><span><MessageCircle size={25} /></span><small>TONNI · ADMIN</small></div>
        <div className="wa-login-lock"><LockKeyhole size={21} /></div>
        <h1 id="wa-login-title">WhatsApp Inbox</h1>
        <p className="wa-login-subtitle">Sign in with your Tonni administrator credentials.</p>
        <form onSubmit={onSubmit}>
          <label>Admin username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={120} /></label>
          <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={512} /></label>
          {error && <p className="wa-form-error" role="alert">{error}</p>}
          {setupNeeded && <p className="wa-form-hint">Admin access is not configured yet. Add <code>WHATSAPP_ADMIN_USERNAME</code> and a 16+ character <code>WHATSAPP_ADMIN_PASSWORD</code> to the server environment.</p>}
          <button className="wa-primary-button" disabled={busy}>{busy ? <LoaderCircle className="wa-spin" size={17} /> : <LockKeyhole size={16} />}<span>{busy ? 'Signing in…' : 'Sign in securely'}</span></button>
        </form>
        <div className="wa-login-trust"><ShieldCheck size={14} /> Private admin-only access · HTTPS recommended</div>
      </section>
    </main>
  );
}

export default function WhatsAppInbox() {
  const [authState, setAuthState] = useState('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [adminName, setAdminName] = useState('Admin');
  const [config, setConfig] = useState({ messagingReady: false, webhookReady: false, callingEnabled: false, iceServers: [] });
  const [loginError, setLoginError] = useState('');
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [busyLogin, setBusyLogin] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedWaId, setSelectedWaId] = useState('');
  const [conversationData, setConversationData] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [toast, setToast] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [calls, setCalls] = useState([]);
  const [callState, setCallState] = useState(null);
  const [callError, setCallError] = useState('');
  const [muted, setMuted] = useState(false);
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const audioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callRef = useRef(callState);
  const selectedWaIdRef = useRef(selectedWaId);
  const queryRef = useRef(query);
  const toastTimerRef = useRef(null);
  const hasLoadedInboxRef = useRef(false);
  callRef.current = callState;
  selectedWaIdRef.current = selectedWaId;
  queryRef.current = query;

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 4_500);
  }, []);

  const api = useCallback(async (url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && url !== '/api/admin/whatsapp/login') {
        setCsrfToken('');
        setAuthState('login');
        socketRef.current?.disconnect();
        socketRef.current = null;
      }
      const error = new Error(data.message || data.error || `Request failed (${response.status}).`);
      error.status = response.status;
      error.code = data.error || '';
      throw error;
    }
    return data;
  }, [csrfToken]);

  const loadConversations = useCallback(async (search = '') => {
    const params = new URLSearchParams({ limit: '500' });
    if (search.trim()) params.set('q', search.trim());
    const data = await api(`/api/admin/whatsapp/conversations?${params.toString()}`);
    setConversations(data.conversations || []);
  }, [api]);

  const refreshCalls = useCallback(async () => {
    const data = await api('/api/admin/whatsapp/calls');
    setCalls(data.calls || []);
    const pending = (data.calls || []).find((call) => call.direction === 'inbound' && call.status === 'incoming' && call.offerSdp);
    if (pending && !callRef.current) setCallState(pending);
  }, [api]);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/whatsapp/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (response.status === 503) setSetupNeeded(body.error === 'admin_not_configured');
          if (active) setAuthState('login');
          return;
        }
        const data = await response.json();
        if (!active) return;
        setCsrfToken(data.csrfToken || '');
        setAdminName(data.admin?.username || 'Admin');
        setConfig(data.config || {});
        setAuthState('inbox');
      })
      .catch(() => {
        if (active) {
          setLoginError('Could not connect to the Tonni server. Please try again.');
          setAuthState('login');
        }
      });
    return () => { active = false; };
  }, []);

  const markRead = useCallback(async (waId) => {
    if (!waId) return;
    setConversations((current) => current.map((item) => item.waId === waId ? { ...item, unreadCount: 0 } : item));
    try {
      const data = await api(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}/read`, { method: 'POST', body: '{}' });
      if (data.conversation) setConversations((current) => current.map((item) => item.waId === waId ? { ...item, ...data.conversation } : item));
    } catch { /* Inbox will retry on the next refresh if the session/network changed. */ }
  }, [api]);

  const openConversation = useCallback(async (waId) => {
    setSelectedWaId(waId);
    setLoadingConversation(true);
    setConversationData(null);
    try {
      const data = await api(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}?limit=100`);
      setConversationData(data);
      setHasOlderMessages(Boolean(data.hasMore));
      markRead(waId);
    } catch (error) {
      showToast(error.message === 'not_found' ? 'Conversation not found.' : 'Could not load this conversation.');
    } finally {
      setLoadingConversation(false);
    }
  }, [api, markRead, showToast]);

  useEffect(() => {
    if (authState !== 'inbox') return undefined;
    let active = true;
    const socket = io('/admin-whatsapp', { withCredentials: true, autoConnect: true, reconnection: true });
    socketRef.current = socket;
    const applyCallUpdate = (incomingCall) => {
      if (!incomingCall?.id) return;
      setCalls((current) => [incomingCall, ...current.filter((item) => item.id !== incomingCall.id)].slice(0, 100));
      setCallState((current) => {
        if (current?.id === incomingCall.id) return { ...current, ...incomingCall, muted: current.muted };
        if (!current && incomingCall.direction === 'inbound' && incomingCall.status === 'incoming' && incomingCall.offerSdp) return incomingCall;
        return current;
      });
      if (terminalCallStatus.has(incomingCall.status)) {
        if (callRef.current?.id === incomingCall.id) {
          peerConnectionRef.current?.close();
          peerConnectionRef.current = null;
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          setMuted(false);
        }
        window.setTimeout(() => setCallState((current) => current?.id === incomingCall.id ? null : current), 1_500);
      }
    };
    const notifyForMessage = (waId, conversation, message) => {
      if (message.direction !== 'inbound' || notificationPermission !== 'granted' || typeof Notification === 'undefined') return;
      try {
        const alert = new Notification(`New WhatsApp message · ${conversation.name}`, {
          body: message.text || 'New message',
          icon: '/favicon.svg',
          tag: `tonni-whatsapp-${waId}`,
        });
        alert.onclick = () => { window.focus(); openConversation(waId); alert.close(); };
      } catch { /* Browser notification permission may have been revoked. */ }
    };
    const onMessage = (payload) => {
      if (!payload?.conversation || !payload.message) return;
      const { conversation, message, waId } = payload;
      if (queryRef.current.trim()) loadConversations(queryRef.current).catch(() => {});
      else setConversations((current) => [conversation, ...current.filter((item) => item.waId !== waId)].sort((a, b) => b.lastMessageAt - a.lastMessageAt));
      if (selectedWaIdRef.current === waId) {
        setConversationData((current) => {
          if (!current || current.conversation?.waId !== waId) return current;
          const found = current.messages.some((item) => item.id === message.id || (message.waMessageId && item.waMessageId === message.waMessageId));
          const messages = found
            ? current.messages.map((item) => item.id === message.id || (message.waMessageId && item.waMessageId === message.waMessageId) ? message : item)
            : [...current.messages, message];
          return { ...current, conversation, messages: messages.sort((a, b) => a.createdAt - b.createdAt) };
        });
        if (document.visibilityState === 'visible') markRead(waId);
        else notifyForMessage(waId, conversation, message);
      } else notifyForMessage(waId, conversation, message);
      if (message.direction === 'inbound') showToast(`New message from ${conversation.name}`);
    };
    const onStatus = (payload) => {
      if (!payload?.waId || !payload?.messageId) return;
      setConversationData((current) => current?.conversation?.waId === payload.waId
        ? { ...current, messages: current.messages.map((item) => item.id === payload.messageId ? { ...item, status: payload.status, statusAt: payload.statusAt, error: payload.error || '' } : item) }
        : current);
    };
    const onConversationUpdate = (summary) => {
      if (!summary?.waId) return;
      if (queryRef.current.trim()) loadConversations(queryRef.current).catch(() => {});
      else setConversations((current) => [summary, ...current.filter((item) => item.waId !== summary.waId)].sort((a, b) => b.lastMessageAt - a.lastMessageAt));
      if (selectedWaIdRef.current === summary.waId) {
        setConversationData((current) => current?.conversation?.waId === summary.waId ? { ...current, conversation: summary } : current);
      }
    };
    const onConnect = () => {
      setSocketConnected(true);
      refreshCalls().catch(() => {});
      loadConversations(queryRef.current).catch(() => {});
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', (error) => {
      setSocketConnected(false);
      if (error?.message === 'unauthorized') {
        setCsrfToken('');
        setAuthState('login');
      }
    });
    socket.on('whatsapp:message', onMessage);
    socket.on('whatsapp:message-status', onStatus);
    socket.on('whatsapp:conversation-updated', onConversationUpdate);
    socket.on('whatsapp:call-updated', applyCallUpdate);
    (async () => {
      try {
        const [sessionData] = await Promise.all([
          api('/api/admin/whatsapp/session'),
          loadConversations(''),
          refreshCalls(),
        ]);
        if (!active) return;
        setAdminName(sessionData.admin?.username || 'Admin');
        setConfig(sessionData.config || {});
        hasLoadedInboxRef.current = true;
      } catch (error) {
        if (active && error.status !== 401) showToast('Could not load WhatsApp Inbox data.');
      }
    })();
    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [authState, api, loadConversations, markRead, notificationPermission, openConversation, refreshCalls, showToast]);

  useEffect(() => {
    if (authState !== 'inbox' || !hasLoadedInboxRef.current) return undefined;
    const timer = window.setTimeout(() => loadConversations(query).catch(() => {}), 250);
    return () => window.clearTimeout(timer);
  }, [authState, loadConversations, query]);

  useEffect(() => {
    if (!conversationData?.messages?.length) return;
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversationData?.messages?.length, selectedWaId]);

  useEffect(() => {
    if (audioRef.current && callState?.remoteStream) audioRef.current.srcObject = callState.remoteStream;
  }, [callState?.remoteStream]);

  useEffect(() => {
    if (callState?.direction !== 'outbound' || !callState.answerSdp || !peerConnectionRef.current) return;
    const activePeerConnection = peerConnectionRef.current;
    if (activePeerConnection.remoteDescription?.type === 'answer') return;
    activePeerConnection.setRemoteDescription({ type: 'answer', sdp: callState.answerSdp }).catch(() => {});
  }, [callState?.id, callState?.answerSdp, callState?.direction]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const unread = conversations.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0);
    document.title = unread ? `(${unread}) WhatsApp Inbox · Tonni Admin` : 'WhatsApp Inbox · Tonni Admin';
    return () => { document.title = 'You and Me — Connect. Call. Chat.'; };
  }, [conversations]);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
    socketRef.current?.disconnect();
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const selectedConversation = useMemo(() => conversations.find((item) => item.waId === selectedWaId) || (conversationData?.conversation?.waId === selectedWaId ? conversationData.conversation : null), [conversations, conversationData, selectedWaId]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setBusyLogin(true);
    setLoginError('');
    setSetupNeeded(false);
    try {
      const response = await fetch('/api/admin/whatsapp/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === 'admin_not_configured') {
          setSetupNeeded(true);
          throw new Error('Administrator credentials have not been configured.');
        }
        if (data.error === 'too_many_attempts') throw new Error('Too many attempts. Please wait 15 minutes and try again.');
        throw new Error('The username or password is incorrect.');
      }
      setCsrfToken(data.csrfToken || '');
      setAdminName(data.admin?.username || username);
      setPassword('');
      setAuthState('inbox');
    } catch (error) {
      setLoginError(error.message || 'Sign-in failed. Please try again.');
    } finally {
      setBusyLogin(false);
    }
  };

  const handleLogout = async () => {
    try { await api('/api/admin/whatsapp/logout', { method: 'POST', body: '{}' }); } catch { /* Expired sessions are cleared locally as well. */ }
    socketRef.current?.disconnect();
    socketRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setConversationData(null);
    setConversations([]);
    setCalls([]);
    setCallState(null);
    setSelectedWaId('');
    setCsrfToken('');
    setAuthState('login');
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    const text = messageText.trim();
    if (!text || !selectedWaId || sending) return;
    setSending(true);
    setMessageText('');
    try {
      const data = await api(`/api/admin/whatsapp/conversations/${encodeURIComponent(selectedWaId)}/messages`, {
        method: 'POST', body: JSON.stringify({ text }),
      });
      if (data.message) {
        setConversationData((current) => {
          if (!current || current.conversation?.waId !== selectedWaId) return current;
          if (current.messages.some((item) => item.id === data.message.id)) return { ...current, messages: current.messages.map((item) => item.id === data.message.id ? data.message : item) };
          return { ...current, messages: [...current.messages, data.message].sort((a, b) => a.createdAt - b.createdAt) };
        });
        if (data.message.status === 'failed') showToast(data.message.error || 'Message failed to send.');
      }
      loadConversations(queryRef.current).catch(() => {});
    } catch (error) {
      setMessageText(text);
      showToast(error.message || 'Could not send this message.');
    } finally {
      setSending(false);
    }
  };

  const loadOlderMessages = async () => {
    const cursor = conversationData?.oldestMessageCursor || conversationData?.oldestMessageAt;
    if (!selectedWaId || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await api(`/api/admin/whatsapp/conversations/${encodeURIComponent(selectedWaId)}?limit=100&before=${encodeURIComponent(cursor)}`);
      setConversationData((current) => current?.conversation?.waId === selectedWaId
        ? { ...current, messages: [...(data.messages || []), ...current.messages], hasMore: data.hasMore, oldestMessageAt: data.oldestMessageAt, oldestMessageCursor: data.oldestMessageCursor }
        : current);
      setHasOlderMessages(Boolean(data.hasMore));
    } catch { showToast('Could not load older messages.'); }
    finally { setLoadingOlder(false); }
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      showToast('Desktop notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    showToast(permission === 'granted' ? 'Desktop alerts are enabled.' : 'Desktop alerts were not enabled.');
  };

  const setRemoteAudio = (stream) => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.play?.().catch(() => {});
    }
    setCallState((current) => current ? { ...current, remoteStream: stream } : current);
  };

  const attachPeerConnection = (peerConnection, callId = '') => {
    peerConnection.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      setRemoteAudio(stream);
    };
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      if (['connected', 'completed'].includes(state)) {
        setCallState((current) => current && (!callId || current.id === callId) ? { ...current, status: 'active' } : current);
      }
      if (state === 'failed') setCallError('Media connection failed. Check the browser network and STUN settings, then retry.');
    };
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'failed') setCallError('The secure WhatsApp media connection failed.');
    };
  };

  const acceptIncomingCall = async () => {
    const incoming = callRef.current;
    if (!incoming?.id || !incoming.offerSdp || !config.callingEnabled) return;
    setCallError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error('This browser does not support secure WhatsApp calling.');
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = localStream;
      const peerConnection = new RTCPeerConnection({ iceServers: config.iceServers || [] });
      peerConnectionRef.current = peerConnection;
      attachPeerConnection(peerConnection, incoming.id);
      await peerConnection.setRemoteDescription({ type: 'offer', sdp: incoming.offerSdp });
      localStream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, localStream));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await waitForIceGatheringComplete(peerConnection);
      const sdp = peerConnection.localDescription?.sdp || answer.sdp;
      setCallState((current) => current?.id === incoming.id ? { ...current, status: 'pre_accepting' } : current);
      await api(`/api/admin/whatsapp/calls/${encodeURIComponent(incoming.id)}/action`, {
        method: 'POST', body: JSON.stringify({ action: 'pre_accept', sdp }),
      });
      await waitForPeerConnection(peerConnection);
      await api(`/api/admin/whatsapp/calls/${encodeURIComponent(incoming.id)}/action`, {
        method: 'POST', body: JSON.stringify({ action: 'accept', sdp }),
      });
      setCallState((current) => current?.id === incoming.id ? { ...current, status: 'active', localStream, muted: false } : current);
    } catch (error) {
      setCallError(error.message || 'Could not answer this WhatsApp call.');
      showToast(error.message || 'Could not answer this WhatsApp call.');
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const declineIncomingCall = async () => {
    const current = callRef.current;
    if (!current?.id) return;
    try {
      await api(`/api/admin/whatsapp/calls/${encodeURIComponent(current.id)}/action`, { method: 'POST', body: JSON.stringify({ action: 'reject' }) });
    } catch (error) { showToast(error.message || 'Could not decline the call.'); }
    setCallState(null);
  };

  const startOutgoingCall = async () => {
    if (!selectedConversation || !config.callingEnabled || callRef.current) return;
    setCallError('');
    try {
      const permission = await api(`/api/admin/whatsapp/conversations/${encodeURIComponent(selectedConversation.waId)}/call-permission`);
      if (permission.permission?.status !== 'granted') {
        throw new Error(permission.permission?.status === 'pending'
          ? 'The customer has not approved the WhatsApp call request yet.'
          : 'The customer must grant WhatsApp call permission first. Use “Request permission” in the conversation header.');
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error('This browser does not support secure WhatsApp calling.');
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = localStream;
      const peerConnection = new RTCPeerConnection({ iceServers: config.iceServers || [] });
      peerConnectionRef.current = peerConnection;
      attachPeerConnection(peerConnection);
      localStream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, localStream));
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);
      const sdp = peerConnection.localDescription?.sdp || offer.sdp;
      const data = await api('/api/admin/whatsapp/calls', {
        method: 'POST', body: JSON.stringify({ waId: selectedConversation.waId, sdp }),
      });
      setCallState({ ...data.call, localStream, status: data.call.status || 'ringing', muted: false });
    } catch (error) {
      setCallError(error.message || 'Could not start a WhatsApp call.');
      showToast(error.message || 'Could not start a WhatsApp call.');
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const requestCallPermission = async () => {
    if (!selectedConversation) return;
    try {
      const data = await api(`/api/admin/whatsapp/conversations/${encodeURIComponent(selectedConversation.waId)}/call-permission`, {
        method: 'POST', body: JSON.stringify({}),
      });
      if (data.message?.status === 'failed') showToast(data.message.error || 'Call permission request failed.');
      else showToast('WhatsApp call-permission request sent. The customer must approve it before you can call.');
      setConversationData((current) => {
        if (current?.conversation?.waId !== selectedConversation.waId || !data.message) return current;
        const exists = current.messages.some((item) => item.id === data.message.id);
        return { ...current, messages: exists ? current.messages.map((item) => item.id === data.message.id ? data.message : item) : [...current.messages, data.message] };
      });
      loadConversations(queryRef.current).catch(() => {});
    } catch (error) { showToast(error.message || 'Could not request call permission.'); }
  };

  const endCall = async () => {
    const current = callRef.current;
    if (!current?.id) return;
    try {
      await api(`/api/admin/whatsapp/calls/${encodeURIComponent(current.id)}/action`, { method: 'POST', body: JSON.stringify({ action: 'terminate' }) });
    } catch { /* The local microphone is still stopped even if Meta is temporarily unreachable. */ }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setCallState(null);
    setMuted(false);
  };

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
    setCallState((current) => current ? { ...current, muted: next } : current);
  };

  const filteredConversation = conversationData?.conversation?.waId === selectedWaId ? conversationData : null;
  const desktopNotificationsEnabled = notificationPermission === 'granted';
  const businessReady = config.messagingReady && config.webhookReady;

  if (authState === 'checking') {
    return <main className="wa-admin-login-page"><div className="wa-checking"><LoaderCircle className="wa-spin" size={24} /><span>Checking secure admin session…</span></div></main>;
  }
  if (authState !== 'inbox') {
    return <LoginScreen username={username} password={password} setUsername={setUsername} setPassword={setPassword} onSubmit={handleLogin} busy={busyLogin} error={loginError} setupNeeded={setupNeeded} />;
  }

  return (
    <main className="wa-admin-app">
      <aside className={`wa-inbox-sidebar ${selectedWaId ? 'wa-mobile-hide' : ''}`}>
        <header className="wa-sidebar-header">
          <div className="wa-brand-lockup"><span><MessageCircle size={22} /></span><div><strong>WhatsApp Inbox</strong><small>Tonni Business</small></div></div>
          <div className="wa-header-actions">
            <button type="button" className={`wa-icon-button ${desktopNotificationsEnabled ? 'is-active' : ''}`} onClick={requestNotifications} title={desktopNotificationsEnabled ? 'Desktop alerts enabled' : 'Enable desktop alerts'} aria-label="Enable desktop alerts"><Bell size={17} /></button>
            <button type="button" className="wa-icon-button" onClick={handleLogout} title={`Sign out ${adminName}`} aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </header>
        <div className={`wa-connection-banner ${businessReady ? 'is-ready' : 'is-warning'}`}>
          <span className="wa-connection-dot" />
          <div><strong>{socketConnected ? 'Live inbox' : 'Connecting…'}</strong><small>{businessReady ? config.displayNumber || '+8801890047742' : 'Cloud API setup required'}</small></div>
          <span className="wa-live-pill">{socketConnected ? 'LIVE' : '—'}</span>
        </div>
        {(!config.messagingReady || !config.webhookReady) && <div className="wa-setup-banner"><Info size={15} /><span>WhatsApp Cloud API and signed Meta webhook settings are required before messages can be received or sent.</span></div>}
        <label className="wa-search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or phone number" aria-label="Search customers" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</label>
        <div className="wa-inbox-count"><span>CONVERSATIONS</span><strong>{conversations.length}</strong></div>
        <div className="wa-conversation-list" role="list" aria-label="WhatsApp customer conversations">
          {!conversations.length ? (
            <div className="wa-empty-list"><span><MessageCircle size={22} /></span><strong>{query ? 'No customer found' : 'No conversations yet'}</strong><small>{query ? 'Try another name or phone number.' : 'New customer messages will appear here automatically.'}</small></div>
          ) : conversations.map((item) => (
            <button key={item.waId} type="button" className={`wa-conversation-item ${selectedWaId === item.waId ? 'is-selected' : ''} ${item.unreadCount ? 'has-unread' : ''}`} onClick={() => openConversation(item.waId)}>
              <Avatar name={item.name} profilePictureUrl={item.profilePictureUrl} />
              <span className="wa-conversation-copy"><strong>{item.name || 'WhatsApp customer'}</strong><small>{item.lastMessagePreview || item.phoneNumber}</small></span>
              <span className="wa-conversation-meta"><time>{formatDate(item.lastMessageAt)}</time>{item.unreadCount > 0 && <i>{item.unreadCount > 99 ? '99+' : item.unreadCount}</i>}</span>
            </button>
          ))}
        </div>
        <footer className="wa-sidebar-footer"><ShieldCheck size={14} /><span>Admin-only · Meta Cloud API</span><span className={`wa-socket-state ${socketConnected ? 'is-online' : ''}`} /></footer>
      </aside>

      <section className={`wa-chat-panel ${selectedWaId ? 'wa-mobile-show' : ''}`}>
        {!selectedConversation ? (
          <div className="wa-empty-chat">
            <div className="wa-empty-illustration"><MessageCircle size={37} /></div>
            <h1>Your WhatsApp inbox</h1>
            <p>Select a customer conversation to read and reply. Incoming messages and delivery updates arrive through Meta’s verified webhook.</p>
            <div className="wa-privacy-note"><LockKeyhole size={15} /> Only authenticated Tonni admins can view this inbox.</div>
            <small className="wa-photo-note">Meta Cloud API does not provide customer profile photos; initials are shown when no supported photo is available.</small>
          </div>
        ) : (
          <>
            <header className="wa-chat-header">
              <button className="wa-back-button" type="button" onClick={() => setSelectedWaId('')} aria-label="Back to conversations"><ArrowLeft size={20} /></button>
              <Avatar name={selectedConversation.name} profilePictureUrl={selectedConversation.profilePictureUrl} size="large" />
              <div className="wa-customer-heading"><strong>{selectedConversation.name || 'WhatsApp customer'}</strong><span>{selectedConversation.phoneNumber || `+${selectedConversation.waId}`}</span></div>
              <div className="wa-customer-actions">
                {config.callingEnabled && <>
                  <button type="button" className="wa-call-permission-button" onClick={requestCallPermission} title="Request the customer’s permission to call"><span>Request permission</span></button>
                  <button type="button" className="wa-call-button" onClick={startOutgoingCall} disabled={Boolean(callState)} title="Start an official WhatsApp Business call"><Phone size={17} /></button>
                </>}
                <div className={`wa-webhook-indicator ${config.webhookReady ? 'is-ready' : ''}`} title={config.webhookReady ? 'Meta webhook configured' : 'Meta webhook not configured'}><span />{config.webhookReady ? 'Webhook on' : 'Webhook off'}</div>
              </div>
            </header>
            <div className="wa-message-history" aria-live="polite">
              {loadingConversation && <div className="wa-history-loading"><LoaderCircle className="wa-spin" size={20} /></div>}
              {filteredConversation && <>
                {hasOlderMessages && <button type="button" className="wa-load-older" onClick={loadOlderMessages} disabled={loadingOlder}>{loadingOlder ? <LoaderCircle className="wa-spin" size={14} /> : <Clock3 size={14} />} Load older messages</button>}
                {!filteredConversation.messages.length ? <div className="wa-no-messages">No messages in this conversation yet.</div> : filteredConversation.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
                <div ref={messageEndRef} />
              </>}
            </div>
            <div className="wa-policy-note"><Info size={14} /><span>Free-form replies are available during the 24-hour customer-service window. Meta requires an approved template outside that window.</span></div>
            <form className="wa-composer" onSubmit={sendMessage}>
              <textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Write a WhatsApp reply…" rows={1} maxLength={4096} aria-label="Write a WhatsApp message" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event); } }} />
              <span className="wa-char-count">{messageText.length}/4096</span>
              <button type="submit" className="wa-send-button" disabled={!messageText.trim() || sending || !config.messagingReady} aria-label="Send WhatsApp message" title="Send message">{sending ? <LoaderCircle className="wa-spin" size={17} /> : <Send size={17} />}</button>
            </form>
          </>
        )}
      </section>

      {callState && config.callingEnabled && (
        <div className="wa-call-overlay" role="dialog" aria-modal="true" aria-label="WhatsApp Business call">
          <section className="wa-call-card">
            <button className="wa-call-close" type="button" onClick={callState.direction === 'inbound' && callState.status === 'incoming' ? declineIncomingCall : endCall} aria-label="Close call"><X size={18} /></button>
            <Avatar name={callState.customerName || selectedConversation?.name || `+${callState.waId}`} size="call" />
            <span className="wa-call-brand"><Headset size={14} /> Official WhatsApp Business Calling API</span>
            <h2>{callState.customerName || selectedConversation?.name || `+${callState.waId}`}</h2>
            <p>{callState.direction === 'inbound' ? `Incoming WhatsApp call · +${callState.waId}` : `WhatsApp call · +${callState.waId}`}</p>
            <span className={`wa-call-status ${callState.status === 'active' || callState.status === 'accepted' ? 'is-active' : ''}`}>{callState.status === 'incoming' ? 'Incoming call' : callState.status === 'ringing' ? 'Ringing on WhatsApp…' : callState.status === 'active' || callState.status === 'accepted' ? 'Connected' : callState.status === 'pre_accepting' || callState.status === 'connecting' ? 'Connecting securely…' : 'Calling…'}</span>
            {callError && <p className="wa-call-error" role="alert">{callError}</p>}
            <audio ref={audioRef} autoPlay playsInline />
            <div className="wa-call-controls">
              {callState.direction === 'inbound' && callState.status === 'incoming' ? <>
                <button type="button" className="wa-call-decline" onClick={declineIncomingCall}><PhoneOff size={18} /><span>Decline</span></button>
                <button type="button" className="wa-call-answer" onClick={acceptIncomingCall}><Phone size={18} /><span>Answer</span></button>
              </> : <>
                <button type="button" className={`wa-call-mute ${muted ? 'is-muted' : ''}`} onClick={toggleMute}>{muted ? <MicOff size={18} /> : <Mic size={18} />}<span>{muted ? 'Unmute' : 'Mute'}</span></button>
                <button type="button" className="wa-call-decline" onClick={endCall}><PhoneOff size={18} /><span>End call</span></button>
              </>}
            </div>
          </section>
        </div>
      )}
      {toast && <div className="wa-toast" role="status">{toast}</div>}
      {!config.callingEnabled && calls.some((call) => call.status === 'incoming') && <div className="wa-inactive-call-notice">Incoming call received. Enable official WhatsApp Calling in Meta settings and set WHATSAPP_CALLING_ENABLED=true to answer.</div>}
    </main>
  );
}
