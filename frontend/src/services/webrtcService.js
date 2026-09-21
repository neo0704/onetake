const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * Wraps everything RTCPeerConnection-related: creating peers, wiring their
 * event handlers, swapping tracks, and generating the "fake" black/silent
 * tracks used so remote peers don't freeze when cam/mic are toggled off.
 */
class WebRTCService {
  createPeerConnection(localStream, handlers = {}) {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (e) => {
      handlers.onTrack?.(e.streams[0], e.track);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) handlers.onIceCandidate?.(e.candidate);
    };

    pc.onconnectionstatechange = () => {
      handlers.onConnectionStateChange?.(pc.connectionState);
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    return pc;
  }

  replaceTrack(pc, kind, newTrack) {
    const sender = pc.getSenders().find((s) => s.track?.kind === kind);
    if (sender) sender.replaceTrack(newTrack);
  }

  // Adds screen-share track as a SEPARATE sender, alongside the existing
  // camera track — so the camera keeps flowing while screen sharing.
  // Returns the sender so it can be removed later.
  addScreenTrack(pc, track, stream) {
    return pc.addTrack(track, stream);
  }

  removeTrack(pc, sender) {
    if (sender) pc.removeTrack(sender);
  }

  // Sends a real black video track so remote doesn't freeze on last frame
  createBlackVideoTrack() {
    const canvas = Object.assign(document.createElement('canvas'), {
      width: 640,
      height: 480,
    });
    canvas.getContext('2d').fillRect(0, 0, 640, 480);
    return canvas.captureStream(1).getVideoTracks()[0];
  }

  // Sends a real silent audio track so remote connection stays alive
  createSilentAudioTrack() {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    return dest.stream.getAudioTracks()[0];
  }
}

export default new WebRTCService();