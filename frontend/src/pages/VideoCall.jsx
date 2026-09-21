import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, Users, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import socketService from '../services/socketService';
import webrtcService from '../services/webrtcService';
import useWebRTC from '../hooks/useWebRTC';
import useChat from '../hooks/useChat';
import VideoGrid from '../components/video/VideoGrid';
import ControlBar from '../components/common/ControlBar';
import ChatPanel from '../components/chat/ChatPanel';

const SERVER_URL = 'http://localhost:5000';

export default function VideoCall() {
  const { roomId } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const isSetup = useRef(false);
  const [copied, setCopied] = useState(false);

  // Pin state: `pinnedId` is an explicit user choice (click on a tile).
  // If nothing's explicitly pinned, we auto-focus whichever screen share
  // is currently active (yours takes priority over a remote one). There's
  // no separate "force grid" flag — that used to get permanently stuck
  // once clicked during an active share, since nothing ever cleared it.
  const [pinnedId, setPinnedId] = useState(null);

  const {
    video,
    audio,
    screen,
    localScreenStream,
    status,
    remoteStreams,
    initializeMedia,
    connectToSocketServer,
    handleAudio,
    handleVideo,
    handleScreen,
    handleEndCall,
  } = useWebRTC(webrtcService, socketService, localVideoRef);

  const { messages, msgInput, setMsgInput, showChat, setShowChat, unreadCount, chatEndRef, handleIncomingMessage, sendMessage } =
    useChat(socketService);

  // ── Setup on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (isSetup.current) return;
    isSetup.current = true;
    if (!user) return;

    (async () => {
      const ok = await initializeMedia();
      if (!ok) {
        toast.error('Camera/mic blocked — please allow access');
        return;
      }
      connectToSocketServer(SERVER_URL, roomId, user.name, {
        onChatMessage: handleIncomingMessage(user.name),
        onUserJoined: (name) => toast(`${name} joined`, { icon: '👋', duration: 2000 }),
        onUserLeft: (name) => {
          if (name) toast(`${name} left`, { duration: 2000 });
        },
        onJoinDenied: (reason) => {
          toast.error(reason, { duration: 4000 });
          handleEndCall();
          setTimeout(() => navigate(-1), 1500);
        },
      });
    })();

    return () => {
      handleEndCall();
      isSetup.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Control handlers ────────────────────────────────────────────────
  const onAudioToggle = async () => {
    if ((await handleAudio()) === 'mic-error') toast.error('Could not restart microphone');
  };

  const onVideoToggle = async () => {
    if ((await handleVideo()) === 'cam-error') toast.error('Could not restart camera');
  };

  const onScreenToggle = async () => {
    const err = await handleScreen();
    if (err === 'screen-share-error') toast.error('Screen share failed');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Meeting link copied!');
  };

  const onSendMessage = (e) => sendMessage(e, roomId, user?.name);

  const handleLeave = () => {
    handleEndCall();
    navigate(-1);
  };

  // ── Build the unified tile list (cameras + any active screen shares) ─
  const remoteEntries = Object.entries(remoteStreams);

  const tiles = useMemo(() => {
    const list = [
      { id: 'local', kind: 'camera', isLocal: true, localVideoRef, name: user?.name, camOff: !video, micOff: !audio },
    ];
    remoteEntries.forEach(([socketId, data]) => {
      list.push({ id: socketId, kind: 'camera', isLocal: false, name: data.name, stream: data.stream, camOff: data.camOff, micOff: data.micOff });
    });
    if (screen && localScreenStream) {
      list.push({ id: 'screen:local', kind: 'screen', isLocal: true, name: user?.name, stream: localScreenStream });
    }
    remoteEntries.forEach(([socketId, data]) => {
      if (data.screenStream) {
        list.push({ id: `screen:${socketId}`, kind: 'screen', isLocal: false, name: data.name, stream: data.screenStream });
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStreams, video, audio, screen, localScreenStream, user?.name]);

  // ── Decide what's pinned to the main stage ──────────────────────────
  let mainTileId = null;
  if (pinnedId && tiles.some((t) => t.id === pinnedId)) {
    mainTileId = pinnedId;
  } else {
    const autoScreen = tiles.find((t) => t.kind === 'screen' && t.isLocal) || tiles.find((t) => t.kind === 'screen');
    if (autoScreen) mainTileId = autoScreen.id;
  }

  const onSelectTile = (id) => {
    setPinnedId(id);
  };

  const onGridView = () => {
    setPinnedId(null);
  };

  // ── Layout for plain grid mode ───────────────────────────────────────
  const total = tiles.length;
  const desktopCols =
    total === 1 ? 'grid-cols-1' : total === 2 ? 'sm:grid-cols-2' : total <= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  // Always one column on phones — a 2-3 column grid is unusable that narrow.
  const gridClass = `grid-cols-1 ${desktopCols}`;

  const participantCount = 1 + remoteEntries.length;

  // iOS Safari has no getDisplayMedia at all; Android browser support is
  // inconsistent. Hide the button rather than leave a dead control that
  // fails silently when tapped.
  const screenShareSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  return (
    <div className="h-screen bg-[#050510] flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 bg-[#0f0f1a] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img src="/logo.jpg" alt="LiveTake" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">LiveTake Meeting</p>
            <p
              className={`text-xs mt-0.5 truncate ${
                status.startsWith('❌') ? 'text-red-400' : status.startsWith('🎥') ? 'text-green-400' : 'text-blue-400'
              }`}
            >
              {status}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <span className="text-white/40 text-sm flex items-center gap-1.5 px-1">
            <Users className="w-4 h-4" /> {participantCount}
          </span>
          {mainTileId && (
            <button
              onClick={onGridView}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Unpin</span>
            </button>
          )}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* ── Body: videos + optional chat ── */}
      <div className="flex-1 flex overflow-hidden">
        <VideoGrid
          tiles={tiles}
          mainTileId={mainTileId}
          onSelectTile={onSelectTile}
          onStopOwnScreen={onScreenToggle}
          gridClass={gridClass}
        />

        <ChatPanel
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          messages={messages}
          msgInput={msgInput}
          onMsgInputChange={(e) => setMsgInput(e.target.value)}
          onSendMessage={onSendMessage}
          chatEndRef={chatEndRef}
        />
      </div>

      {/* ── Controls ── */}
      <ControlBar
        audio={audio}
        video={video}
        screen={screen}
        showChat={showChat}
        unreadCount={unreadCount}
        screenShareSupported={screenShareSupported}
        onAudioToggle={onAudioToggle}
        onVideoToggle={onVideoToggle}
        onScreenToggle={onScreenToggle}
        onChatToggle={() => setShowChat((c) => !c)}
        onEndCall={handleLeave}
      />
    </div>
  );
}