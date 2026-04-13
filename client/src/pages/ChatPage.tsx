import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';

export default function ChatPage() {
  const { user, conversations, messages, sendMessage, fetchMessages, refreshConversations } = useApp();
  const { socket } = useSocket();
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv, messages]);

  // Fetch messages when switching conversations
  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv);
      socket?.emit('join-conversation', activeConv);
    }
    return () => {
      if (activeConv) socket?.emit('leave-conversation', activeConv);
    };
  }, [activeConv, fetchMessages, socket]);

  // Listen for real-time events
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      if (activeConv) fetchMessages(activeConv);
      refreshConversations();
    };
    const handleTyping = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId === activeConv && data.userId !== user?.id) {
        setTyping(data.userId);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(null), 2000);
      }
    };
    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', () => setTyping(null));
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing');
    };
  }, [socket, activeConv, fetchMessages, refreshConversations, user?.id]);

  const handleSend = useCallback(async () => {
    if (!newMsg.trim() || !activeConv) return;
    const text = newMsg.trim();
    setNewMsg('');
    await sendMessage(activeConv, text);
    socket?.emit('send-message', { conversationId: activeConv, content: text });
  }, [newMsg, activeConv, sendMessage, socket]);

  const handleTypingEmit = useCallback(() => {
    if (activeConv && socket) {
      socket.emit('typing', { conversationId: activeConv });
    }
  }, [activeConv, socket]);

  const activeMessages = activeConv ? messages[activeConv] || [] : [];
  const activeConversation = conversations.find(c => c.id === activeConv);

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Conversations List */}
      <div className={`${activeConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-200`}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            Messages
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {conversations.reduce((s, c) => s + c.unreadCount, 0)} unread
            </span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No conversations yet.
            </div>
          ) : conversations.map(conv => {
            const otherName = conv.participantNames.find(n =>
              n !== user?.name
            ) || conv.participantNames[0];
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv.id)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition border-b border-gray-50 ${
                  activeConv === conv.id ? 'bg-red-50' : ''
                }`}
              >
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-sm font-medium text-red-600 flex-shrink-0">
                  {otherName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-800 truncate">{otherName}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(conv.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${activeConv ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
        {activeConv && activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <button
                onClick={() => setActiveConv(null)}
                className="md:hidden text-gray-500 hover:text-gray-700"
              >
                ← 
              </button>
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-sm font-medium text-red-600">
                {(activeConversation.participantNames.find(n => n !== user?.name) || activeConversation.participantNames[0])?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {activeConversation.participantNames.find(n => n !== user?.name) || activeConversation.participantNames[0]}
                </p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span> Online
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2"></div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {activeMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    msg.senderId === user?.id
                      ? 'bg-red-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${msg.senderId === user?.id ? 'justify-end' : ''}`}>
                      <span className={`text-xs ${msg.senderId === user?.id ? 'text-red-200' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.senderId === user?.id && (
                        <span className="text-xs text-red-200">{msg.read ? '✓✓' : '✓'}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-gray-100 rounded-bl-md">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMsg}
                  onChange={e => { setNewMsg(e.target.value); handleTypingEmit(); }}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMsg.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                >
                  Send →
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Select a Conversation</h3>
              <p className="text-sm text-gray-500">Choose a chat from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
