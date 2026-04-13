import { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { chatbotAnswer } from '../utils/ai';

interface Message {
  id: number;
  role: 'user' | 'bot';
  content: string;
  confidence?: number;
  topics?: string[];
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'bot',
      content: 'Hello! I\'m the BloodLink Assistant. I can help you with questions about blood donation, eligibility, blood types, and more. What would you like to know?',
      topics: ['Eligibility', 'Blood Types', 'Donation Process', 'Safety', 'Preparation'],
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const question = text || input.trim();
    if (!question || isTyping) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Try backend AI endpoint first
      const data = await api<{ answer: string; confidence: number; relatedTopics: string[] }>('/ai/chatbot', {
        method: 'POST',
        body: { message: question },
      });
      const botMsg: Message = {
        id: Date.now() + 1,
        role: 'bot',
        content: data.answer,
        confidence: data.confidence,
        topics: data.relatedTopics,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      // Fallback to local AI
      const response = chatbotAnswer(question);
      const botMsg: Message = {
        id: Date.now() + 1,
        role: 'bot',
        content: response.answer,
        confidence: response.confidence,
        topics: response.relatedTopics,
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickQuestions = [
    'Who can donate blood?',
    'How often can I donate?',
    'What are the blood types?',
    'How to prepare for donation?',
    'Is blood donation safe?',
    'What happens after donation?',
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-7rem)]">
        {/* Header */}
        <div className="bg-linear-to-r from-red-600 to-red-700 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V5a2 2 0 00-2-2H7a2 2 0 00-2 2v9.5" /></svg>
            </div>
            <div>
              <h2 className="font-bold">BloodLink Assistant</h2>
              <p className="text-xs text-red-100 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                Always online
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                {msg.role === 'bot' && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5" /></svg>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Assistant</span>
                    {msg.confidence && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        msg.confidence >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {msg.confidence}% confident
                      </span>
                    )}
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-red-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                </div>

                {/* Related Topics */}
                {msg.role === 'bot' && msg.topics && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.topics.map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(`Tell me about ${topic}`)}
                        className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-full transition"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 rounded-bl-md">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick Questions */}
        <div className="p-3 border-t border-gray-100 bg-white">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="flex-shrink-0 text-xs bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 px-3 py-1.5 rounded-full transition whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask me about blood donation..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-1"
            >
              <span>Ask</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
