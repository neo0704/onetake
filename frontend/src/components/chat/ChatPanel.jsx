import React from 'react';
import { MessageSquare, X, Send } from 'lucide-react';

export default function ChatPanel({ isOpen, onClose, messages, msgInput, onMsgInputChange, onSendMessage, chatEndRef }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0f0f1a] flex flex-col
        lg:static lg:inset-auto lg:z-auto lg:w-72 lg:flex-shrink-0 lg:border-l lg:border-white/10"
    >
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-white font-semibold text-sm">Meeting Chat</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
            <MessageSquare className="w-8 h-8 text-white/10" />
            <p className="text-white/30 text-xs text-center">
              No messages yet.
              <br />
              Start the conversation!
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-white/40 text-xs font-medium">{msg.from}</span>
              <span className="text-white/20 text-xs">{msg.time}</span>
            </div>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                ${msg.isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={onSendMessage} className="flex gap-2 p-3 border-t border-white/10 flex-shrink-0">
        <input
          value={msgInput}
          onChange={onMsgInputChange}
          placeholder="Type a message..."
          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white hover:bg-primary/80 transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}