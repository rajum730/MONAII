import React from 'react';
import { Mic, MicOff, MessageSquare, Settings, Radio, Camera, CheckSquare } from 'lucide-react';

interface BottomControlBarProps {
  isListening: boolean;
  isHandsFree: boolean;
  micAudioLevel: number; // 0 to 1
  onToggleMic: () => void;
  onToggleHandsFree: () => void;
  onOpenKeyboard: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onOpenVision: () => void;
  onOpenNotes: () => void;
}

export const BottomControlBar: React.FC<BottomControlBarProps> = ({
  isListening,
  isHandsFree,
  micAudioLevel,
  onToggleMic,
  onToggleHandsFree,
  onOpenKeyboard,
  onOpenChat,
  onOpenSettings,
  onOpenVision,
  onOpenNotes
}) => {
  // Mic pulsating ring scale based on real-time audio level
  const pulseScale = 1 + micAudioLevel * 0.7;
  const pulseGlow = Math.round(micAudioLevel * 24);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center justify-end px-4 pb-4 pt-2 safe-bottom pointer-events-auto">
      {/* Horizontal Floating Glass Dock */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between px-3 py-2.5 rounded-3xl glass-dock">
        {/* Left: Chat History */}
        <button
          onClick={onOpenChat}
          aria-label="Chat History"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-2xl text-slate-300 hover:text-white active:scale-95 transition bg-white/5 hover:bg-white/10"
        >
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          <span className="text-[9px] mt-0.5 text-slate-400">Chat</span>
        </button>

        {/* Notes & To-Do */}
        <button
          onClick={onOpenNotes}
          aria-label="Notes & Tasks"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-2xl text-slate-300 hover:text-white active:scale-95 transition bg-white/5 hover:bg-white/10"
        >
          <CheckSquare className="w-5 h-5 text-amber-400" />
          <span className="text-[9px] mt-0.5 text-slate-400">Notes</span>
        </button>

        {/* Center: BIG Mic Button with Audio Reactive Wave Ring */}
        <div className="relative flex items-center justify-center -mt-6">
          {/* Animated Glowing Ring when active */}
          {isListening && (
            <div
              className="absolute w-20 h-20 rounded-full transition-transform duration-75 pointer-events-none"
              style={{
                transform: `scale(${pulseScale})`,
                background: 'radial-gradient(circle, rgba(0,242,254,0.3) 0%, rgba(255,0,127,0.15) 60%, transparent 100%)',
                boxShadow: `0 0 ${pulseGlow + 8}px rgba(0, 242, 254, 0.7)`
              }}
            />
          )}

          <button
            onClick={onToggleMic}
            aria-label={isListening ? 'Stop Listening' : 'Tap to Talk'}
            className={`relative z-10 flex items-center justify-center w-16 h-16 rounded-full shadow-2xl transition-all duration-200 active:scale-90 ${
              isListening
                ? 'bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-pink-500/50 scale-105'
                : 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 text-white shadow-cyan-500/30 hover:brightness-110'
            }`}
          >
            {isListening ? (
              <Mic className="w-7 h-7 animate-pulse" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Hands-Free Toggle */}
        <button
          onClick={onToggleHandsFree}
          aria-label="Hands-free Wake Word Mode"
          className={`flex flex-col items-center justify-center w-11 h-11 rounded-2xl active:scale-95 transition ${
            isHandsFree
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
              : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Radio className={`w-5 h-5 ${isHandsFree ? 'animate-pulse text-cyan-400' : ''}`} />
          <span className="text-[9px] mt-0.5">Handsfree</span>
        </button>

        {/* Camera Vision ("Dekho") */}
        <button
          onClick={onOpenVision}
          aria-label="Camera Vision"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-2xl text-slate-300 hover:text-white active:scale-95 transition bg-white/5 hover:bg-white/10"
        >
          <Camera className="w-5 h-5 text-emerald-400" />
          <span className="text-[9px] mt-0.5 text-slate-400">Dekho</span>
        </button>

        {/* Right: Settings */}
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-2xl text-slate-300 hover:text-white active:scale-95 transition bg-white/5 hover:bg-white/10"
        >
          <Settings className="w-5 h-5 text-purple-400" />
          <span className="text-[9px] mt-0.5 text-slate-400">Settings</span>
        </button>
      </div>

      {/* Auxiliary text keyboard trigger button */}
      <button
        onClick={onOpenKeyboard}
        className="mt-2 text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/60 border border-white/5 active:scale-95 transition"
      >
        <span>💬 Tap here to type a message...</span>
      </button>
    </div>
  );
};
