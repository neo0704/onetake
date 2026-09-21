import React from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, PhoneOff } from 'lucide-react';

export default function ControlBar({
  audio,
  video,
  screen,
  showChat,
  unreadCount,
  onAudioToggle,
  onVideoToggle,
  onScreenToggle,
  onChatToggle,
  onEndCall,
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-4 bg-[#0f0f1a] border-t border-white/10 flex-shrink-0">
      <button
        onClick={onAudioToggle}
        title={audio ? 'Mute' : 'Unmute'}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${audio ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
      >
        {audio ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button
        onClick={onVideoToggle}
        title={video ? 'Stop Video' : 'Start Video'}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${video ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
      >
        {video ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>

      <button
        onClick={onScreenToggle}
        title={screen ? 'Stop Sharing' : 'Share Screen'}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${screen ? 'bg-primary text-white' : 'bg-white/15 hover:bg-white/25 text-white'}`}
      >
        {screen ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
      </button>

      <button
        onClick={onChatToggle}
        title="Chat"
        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors
          ${showChat ? 'bg-primary text-white' : 'bg-white/15 hover:bg-white/25 text-white'}`}
      >
        <MessageSquare className="w-5 h-5" />
        {unreadCount > 0 && !showChat && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={onEndCall}
        title="Leave Call"
        className="w-14 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}