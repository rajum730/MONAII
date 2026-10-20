import React from 'react';
import { Emotion } from '../types';
import { Sparkles, Mic, Volume2 } from 'lucide-react';

interface LiveCaptionsProps {
  captionText: string;
  isUserSpeaking: boolean;
  isMonaSpeaking: boolean;
  currentEmotion: Emotion;
  wakeWordStatus?: string;
}

const EMOTION_LABELS: Record<Emotion, { label: string; color: string }> = {
  idle: { label: 'Online', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30' },
  listening: { label: 'Listening...', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' },
  thinking: { label: 'Thinking...', color: 'text-purple-400 bg-purple-950/60 border-purple-500/30' },
  speaking: { label: 'Speaking', color: 'text-pink-400 bg-pink-950/60 border-pink-500/30' },
  happy: { label: 'Happy 😊', color: 'text-amber-400 bg-amber-950/60 border-amber-500/30' },
  laughing: { label: 'Laughing 😆', color: 'text-orange-400 bg-orange-950/60 border-orange-500/30' },
  shy: { label: 'Shy 🙈', color: 'text-rose-300 bg-rose-950/60 border-rose-500/30' },
  surprised: { label: 'Surprised 😲', color: 'text-cyan-300 bg-cyan-950/60 border-cyan-500/30' },
  sad: { label: 'Sad 🥺', color: 'text-blue-400 bg-blue-950/60 border-blue-500/30' },
  angry: { label: 'Pouty 😤', color: 'text-red-400 bg-red-950/60 border-red-500/30' },
  love: { label: 'In Love 💕', color: 'text-pink-300 bg-pink-950/60 border-pink-500/30' }
};

export const LiveCaptions: React.FC<LiveCaptionsProps> = ({
  captionText,
  isUserSpeaking,
  isMonaSpeaking,
  currentEmotion,
  wakeWordStatus
}) => {
  if (!captionText && !wakeWordStatus) return null;

  const currentBadge = EMOTION_LABELS[currentEmotion] || EMOTION_LABELS.idle;

  return (
    <div className="absolute bottom-28 left-4 right-4 z-20 pointer-events-none flex flex-col items-center justify-end">
      {/* Dynamic Status / Emotion Pill */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-md shadow-sm transition-all duration-300 ${currentBadge.color}`}
        >
          {isUserSpeaking ? (
            <Mic className="w-3 h-3 animate-pulse" />
          ) : isMonaSpeaking ? (
            <Volume2 className="w-3 h-3 animate-pulse" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          <span>{currentBadge.label}</span>
        </span>

        {wakeWordStatus && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/70 border border-slate-700/40 text-slate-400 backdrop-blur-md">
            {wakeWordStatus}
          </span>
        )}
      </div>

      {/* Caption Text Bubble */}
      {captionText && (
        <div className="max-w-[90%] text-center px-4 py-2.5 rounded-2xl glass-panel shadow-2xl border border-white/10 transition-all duration-200">
          <p className="text-sm md:text-base font-normal tracking-wide text-slate-100 leading-snug break-words">
            {captionText}
          </p>
        </div>
      )}
    </div>
  );
};
