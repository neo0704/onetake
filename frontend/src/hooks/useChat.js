import { useEffect, useRef, useState } from 'react';

/**
 * Owns chat message state, unread badge, and the auto-scroll behavior.
 * Signaling itself still goes through socketService so it stays in sync
 * with the same connection useWebRTC manages.
 */
export default function useChat(socketService) {
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset unread when chat opens
  useEffect(() => {
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  // Returns a socket event handler bound to the current user's name, so
  // it can skip echoing back messages the user sent themselves.
  const handleIncomingMessage = (currentUserName) => ({ from, text, time }) => {
    if (from === currentUserName) return;
    setMessages((prev) => [...prev, { from, text, time, isMe: false }]);
    setShowChat((curr) => {
      if (!curr) setUnreadCount((c) => c + 1);
      return curr;
    });
  };

  const sendMessage = (e, roomId, userName) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = { from: userName, text: msgInput.trim(), time, isMe: true };
    socketService.emit('video_chat_message', { roomId, from: userName, text: msgInput.trim(), time });
    setMessages((prev) => [...prev, msg]);
    setMsgInput('');
  };

  return {
    messages,
    msgInput,
    setMsgInput,
    showChat,
    setShowChat,
    unreadCount,
    chatEndRef,
    handleIncomingMessage,
    sendMessage,
  };
}