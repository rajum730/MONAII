import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, VoiceSettings } from '../types';
import { X, Send, Volume2, Copy, Trash2, Download, Bot, User, Check } from 'lucide-react';

interface ChatDrawerProps {
  isOpen: boolean;
  messages: ChatMessage[];
  voiceSettings: VoiceSettings;
  onClose: () => void;
  onSendMessage: (text: string) => void;
  onReplayVoice: (text: string) => void;
  onClearHistory: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  messages,
  voiceSettings,
  onClose,
  onSendMessage,
  onReplayVoice,
  onClearHistory
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExport = () => {
    const textContent = messages
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role === 'user' ? 'You' : 'MONA'}: ${m.text}`)
      .join('\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mona_chat_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      {/* Sliding Drawer Container */}
      <div className="w-full max-w-lg mx-auto h-[85vh] flex flex-col rounded-t-3xl glass-dock shadow-2xl border-t border-white/10 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-pink-500 flex items-center justify-center text-xs font-bold shadow-md">
              M
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">MONA Chat History</h2>
              <p className="text-[11px] text-slate-400">Sweet conversations & logs</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              title="Export as Text"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClearHistory}
              title="Clear History"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-white/10 active:scale-95 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-12">
              <Bot className="w-12 h-12 text-slate-600 mb-2 stroke-1" />
              <p className="text-sm">Abhi koi baat nahi hui hai.</p>
              <p className="text-xs text-slate-600 mt-1">Neeche Mic dabakar baat karna shuru karein!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0 mt-1">
                      M
                    </div>
                  )}

                  <div className={`max-w-[80%] rounded-2xl p-3 ${
                    isUser
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-md'
                      : 'glass-panel text-slate-100 rounded-tl-sm border border-white/10 shadow-md'
                  }`}>
                    {/* Attached Image if vision */}
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Captured visual"
                        className="rounded-xl w-full max-h-48 object-cover mb-2 border border-white/10"
                      />
                    )}

                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.cleanedText || msg.text}
                    </p>

                    {/* Bottom Metadata & Actions */}
                    <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-white/10 text-[10px] text-slate-400">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                      <div className="flex items-center gap-1.5">
                        {!isUser && (
                          <button
                            onClick={() => onReplayVoice(msg.cleanedText || msg.text)}
                            title="Replay Voice"
                            className="p-1 hover:text-cyan-300 transition"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(msg.id, msg.cleanedText || msg.text)}
                          title="Copy"
                          className="p-1 hover:text-white transition"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-slate-900/80 flex items-center gap-2 safe-bottom">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="MONA se baat karein (Hinglish/English)..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg transition active:scale-95"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
