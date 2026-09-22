import { useRef, useState } from 'react';

/**
 * Owns all WebRTC + signaling state for a call: local media, peer
 * connections, remote streams (camera + optional screen share per peer),
 * and the mic/cam/screen-share toggles.
 *
 * Screen share is sent as a SEPARATE video track alongside the camera
 * track (not a replacement), so a participant's camera stays visible to
 * everyone else even while they're sharing their screen. Adding/removing
 * that track requires renegotiating the connection (a fresh offer/answer)
 * after the call is already established.
 */
export default function useWebRTC(webrtcService, socketService, localVideoRef) {
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef({});
  const cameraSendersRef = useRef({}); // { [remoteId]: RTCRtpSender } — the camera sender, captured once
  const screenSendersRef = useRef({}); // { [remoteId]: RTCRtpSender } — the screen sender, only while sharing
  const hasJoined = useRef(false);
  const roomInfoRef = useRef({ roomId: null, userName: null });

  const [video, setVideo] = useState(true); // camera on/off
  const [audio, setAudio] = useState(true); // mic on/off
  const [screen, setScreen] = useState(false); // screen share on/off
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [localStream, setLocalStream] = useState(null); // exposed for the UI to self-heal srcObject on remount
  const [status, setStatus] = useState('Connecting...');
  // { socketId: { name, stream (camera), screenStream, camOff, micOff } }
  const [remoteStreams, setRemoteStreams] = useState({});

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return true;
    } catch (err) {
      setStatus('❌ Camera or mic blocked');
      return false;
    }
  };

  const createPC = (remoteId) => {
    const pc = webrtcService.createPeerConnection(localStreamRef.current, {
      onTrack: (stream, track) => {
        setRemoteStreams((prev) => {
          const existing = prev[remoteId] || {};
          // First video stream for this peer = camera. A second, different
          // video stream showing up later = their screen share.
          if (track.kind === 'video' && existing.stream && existing.stream.id !== stream.id) {
            return { ...prev, [remoteId]: { ...existing, screenStream: stream } };
          }
          return { ...prev, [remoteId]: { ...existing, stream } };
        });

        // When a track is removed via renegotiation (e.g. the other side
        // stopped screen sharing), the browser fires 'ended' on THIS
        // specific track. Without this, the last frame just sits frozen
        // forever since nothing ever clears it from state.
        track.onended = () => {
          setRemoteStreams((prev) => {
            const existing = prev[remoteId];
            if (!existing) return prev;
            if (existing.screenStream && existing.screenStream.id === stream.id) {
              const { screenStream, ...rest } = existing;
              return { ...prev, [remoteId]: rest };
            }
            return prev;
          });
        };
      },
      onIceCandidate: (candidate) => {
        socketService.emit('video_ice_candidate', { to: remoteId, candidate });
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') setStatus('🎥 In call');
      },
    });
    peersRef.current[remoteId] = pc;
    // Capture the camera sender once, up front, so cam on/off toggles never
    // risk grabbing the screen-share sender by mistake once one exists.
    cameraSendersRef.current[remoteId] = pc.getSenders().find((s) => s.track?.kind === 'video') || null;
    return pc;
  };

  // Renegotiates a single peer connection after tracks were added/removed
  // post-connection (e.g. starting/stopping screen share mid-call).
  const renegotiate = async (remoteId) => {
    const pc = peersRef.current[remoteId];
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketService.emit('video_offer', { to: remoteId, offer, userName: roomInfoRef.current.userName });
    } catch (err) {
      console.error('Renegotiation offer error:', err);
    }
  };

  const connectToSocketServer = (serverUrl, roomId, userName, callbacks = {}) => {
    const { onChatMessage, onUserJoined, onUserLeft } = callbacks;
    roomInfoRef.current = { roomId, userName };
    const socket = socketService.connect(serverUrl);

    socket.on('connect', () => {
      setStatus('✅ Connected — waiting for others...');
      if (!hasJoined.current) {
        hasJoined.current = true;
        socketService.emit('video_join', { roomId, userId: userName, userName });
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket error:', err.message);
      setStatus('❌ Cannot connect to backend — is port 5000 running?');
    });

    // Server refused the join (meeting expired, cancelled, not found...).
    socket.on('video_join_denied', ({ reason }) => {
      setStatus(`❌ ${reason}`);
      hasJoined.current = false;
      callbacks.onJoinDenied?.(reason);
    });

    // Someone joined → send offer (include our screen track too, if we're already sharing)
    socket.on('video_user_joined', async ({ socketId, userName: joinedName }) => {
      if (socketId === socket.id || peersRef.current[socketId]) return;
      onUserJoined?.(joinedName);
      setStatus(`🎥 ${joinedName} joined`);
      setRemoteStreams((prev) => ({ ...prev, [socketId]: { name: joinedName, stream: null } }));
      const pc = createPC(socketId);
      if (screenStreamRef.current) {
        const track = screenStreamRef.current.getVideoTracks()[0];
        screenSendersRef.current[socketId] = webrtcService.addScreenTrack(pc, track, screenStreamRef.current);
      }
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.emit('video_offer', { to: socketId, offer, userName });
      } catch (err) {
        console.error('Offer error:', err);
      }
    });

    // Got offer → send answer. Reuse the existing peer connection if we
    // already have one (this is a renegotiation, e.g. a screen-share
    // track being added/removed) instead of tearing it down.
    socket.on('video_offer', async ({ from, offer, userName: fromName }) => {
      if (from === socket.id) return;
      setRemoteStreams((prev) => ({
        ...prev,
        [from]: { ...(prev[from] || {}), name: fromName || prev[from]?.name || 'Participant' },
      }));
      let pc = peersRef.current[from];
      if (!pc) pc = createPC(from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketService.emit('video_answer', { to: from, answer, userName });
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    // Got answer
    socket.on('video_answer', async ({ from, answer }) => {
      if (from === socket.id) return;
      const pc = peersRef.current[from];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Set answer error:', err);
        }
      }
    });

    // ICE candidate
    socket.on('video_ice_candidate', async ({ from, candidate }) => {
      if (from === socket.id) return;
      const pc = peersRef.current[from];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          /* ignore stray candidates arriving after close */
        }
      }
    });

    // User left
    socket.on('video_user_left', ({ socketId, userName: leftName }) => {
      if (!socketId) return;
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      delete cameraSendersRef.current[socketId];
      delete screenSendersRef.current[socketId];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      onUserLeft?.(leftName);
      setStatus('✅ Connected — waiting for others...');
    });

    // Media state (cam/mic/screen) from remote peers — screen-share stop
    // rides on this same event rather than a new one, since this channel
    // is already confirmed working end-to-end in this app.
    socket.on('video_media_state', ({ socketId, camOn, micOn, screenSharing }) => {
      setRemoteStreams((prev) => {
        if (!prev[socketId]) return prev;
        const next = { ...prev[socketId], camOff: !camOn, micOff: !micOn };
        if (screenSharing === false && next.screenStream) {
          delete next.screenStream;
        }
        return { ...prev, [socketId]: next };
      });
    });

    if (onChatMessage) socket.on('video_chat_message', onChatMessage);
  };

  const handleAudio = async () => {
    const { roomId } = roomInfoRef.current;
    if (audio) {
      const t = localStreamRef.current?.getAudioTracks()[0];
      if (t) t.stop();
      setAudio(false);
      socketService.emit('video_media_state', { roomId, camOn: video, micOn: false });
      const silentTrack = webrtcService.createSilentAudioTrack();
      Object.values(peersRef.current).forEach((pc) => webrtcService.replaceTrack(pc, 'audio', silentTrack));
      return null;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      const newTrack = newStream.getAudioTracks()[0];
      const oldTrack = localStreamRef.current?.getAudioTracks()[0];
      if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
      localStreamRef.current.addTrack(newTrack);
      Object.values(peersRef.current).forEach((pc) => webrtcService.replaceTrack(pc, 'audio', newTrack));
      setAudio(true);
      socketService.emit('video_media_state', { roomId, camOn: video, micOn: true });
      return null;
    } catch (err) {
      return 'mic-error';
    }
  };

  const handleVideo = async () => {
    const { roomId } = roomInfoRef.current;
    if (video) {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      const t = localStreamRef.current?.getVideoTracks()[0];
      if (t) {
        localStreamRef.current.removeTrack(t);
        t.stop();
      }
      setVideo(false);
      socketService.emit('video_media_state', { roomId, camOn: false, micOn: audio });
      const blackTrack = webrtcService.createBlackVideoTrack();
      Object.values(cameraSendersRef.current).forEach((sender) => sender?.replaceTrack(blackTrack));
      return null;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const newTrack = newStream.getVideoTracks()[0];
      localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      Object.values(cameraSendersRef.current).forEach((sender) => sender?.replaceTrack(newTrack));
      setVideo(true);
      socketService.emit('video_media_state', { roomId, camOn: true, micOn: audio });
      return null;
    } catch (err) {
      return 'cam-error';
    }
  };

  // Screen share is a SEPARATE track from the camera — starting/stopping
  // it never touches the camera sender, and requires a renegotiation
  // round (fresh offer/answer) per peer since the set of tracks changed.
  const handleScreen = async () => {
    const { roomId } = roomInfoRef.current;
    if (screen) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreen(false);
      setLocalScreenStream(null);
      socketService.emit('video_media_state', { roomId, camOn: video, micOn: audio, screenSharing: false });
      Object.entries(peersRef.current).forEach(([remoteId, pc]) => {
        const sender = screenSendersRef.current[remoteId];
        if (sender) {
          webrtcService.removeTrack(pc, sender);
          delete screenSendersRef.current[remoteId];
        }
        renegotiate(remoteId);
      });
      return null;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      setScreen(true);
      setLocalScreenStream(screenStream);
      socketService.emit('video_media_state', { roomId, camOn: video, micOn: audio, screenSharing: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      Object.entries(peersRef.current).forEach(([remoteId, pc]) => {
        screenSendersRef.current[remoteId] = webrtcService.addScreenTrack(pc, screenTrack, screenStream);
        renegotiate(remoteId);
      });
      // Auto-stop when user clicks browser's native "Stop sharing" control
      screenTrack.onended = () => {
        screenStreamRef.current = null;
        setScreen(false);
        setLocalScreenStream(null);
        socketService.emit('video_media_state', { roomId: roomInfoRef.current.roomId, camOn: video, micOn: audio, screenSharing: false });
        Object.entries(peersRef.current).forEach(([remoteId, pc]) => {
          const sender = screenSendersRef.current[remoteId];
          if (sender) {
            webrtcService.removeTrack(pc, sender);
            delete screenSendersRef.current[remoteId];
          }
          renegotiate(remoteId);
        });
      };
      return null;
    } catch (err) {
      return err.name !== 'NotAllowedError' ? 'screen-share-error' : null;
    }
  };

  const handleEndCall = () => {
    const { roomId, userName } = roomInfoRef.current;
    socketService.emit('video_leave', { roomId, userName });
    socketService.disconnect();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    cameraSendersRef.current = {};
    screenSendersRef.current = {};
    hasJoined.current = false;
  };

  return {
    video,
    audio,
    screen,
    localScreenStream,
    localStream,
    status,
    remoteStreams,
    initializeMedia,
    connectToSocketServer,
    handleAudio,
    handleVideo,
    handleScreen,
    handleEndCall,
  };
}