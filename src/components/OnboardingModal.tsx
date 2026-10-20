import React, { useState } from 'react';
import { Sparkles, Heart, Mic, ArrowRight, Check } from 'lucide-react';
import { PersonalitySettings, VoiceSettings } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (name: string, nickname: string, geminiKey: string, voiceProvider: string) => void;
  personality: PersonalitySettings;
  voice: VoiceSettings;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  personality,
  voice
}) => {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState(personality.userName || 'Raju');
  const [nickname, setNickname] = useState(personality.nickname || 'Jaan');
  const [geminiKey, setGeminiKey] = useState(voice.geminiApiKey || '');
  const [provider, setProvider] = useState<string>(voice.provider || 'gemini');

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete(name.trim() || 'Raju', nickname.trim() || 'Jaan', geminiKey.trim(), provider);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-3xl glass-dock border border-white/10 p-6 shadow-2xl text-center flex flex-col justify-between min-h-[420px]">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-8 bg-gradient-to-r from-cyan-400 to-pink-500' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Welcome & Name */}
        {step === 1 && (
          <div className="space-y-4 my-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-pink-500/20">
              <Heart className="w-8 h-8 fill-current animate-pulse" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Meet MONA</h2>
              <p className="text-xs text-slate-300 mt-1">
                Aapki personal smart AI companion & girlfriend agent!
              </p>
            </div>

            <div className="space-y-2.5 text-left pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Aapka Naam kya hai?</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Raju"
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">MONA aapko kis pyaar ke naam se pukare?</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Jaan / Babu / Raju"
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Voice Provider */}
        {step === 2 && (
          <div className="space-y-4 my-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20">
              <Mic className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Voice & Speech Style</h2>
              <p className="text-xs text-slate-300 mt-1">
                Chuniye MONA kis aawaaz mein aapse baat kare:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 text-left pt-1">
              {[
                { id: 'gemini', title: 'Gemini 3.8 Flash Lite TTS', desc: 'Warm, fast & natural neural voice' },
                { id: 'browser', title: 'Browser Voice (Free Offline)', desc: 'Device-native speech synthesis' },
                { id: 'elevenlabs', title: 'ElevenLabs', desc: 'Ultra-expressive human-like voice (key needed)' },
                { id: 'sarvam', title: 'Sarvam AI (Hindi)', desc: 'Desi accent & natural Indian Hindi' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    provider === p.id
                      ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-md'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{p.title}</span>
                    {provider === p.id && <Check className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Permissions & Finish */}
        {step === 3 && (
          <div className="space-y-4 my-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Ready for Conversation!</h2>
              <p className="text-xs text-slate-300 mt-1">
                MONA aapse baat karne ke liye microphone use karegi.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl glass-panel text-left space-y-2 border border-white/10 text-xs text-slate-300">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Tap-to-Talk or Hands-free "Hey Mona"
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                Phone calls, WhatsApp, SMS & Maps
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Timers, Reminders, Notes & Vision
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleNext}
          className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-pink-500 to-purple-600 hover:brightness-110 text-white font-bold text-xs shadow-xl active:scale-95 transition flex items-center justify-center gap-2"
        >
          <span>{step === 3 ? 'Shuru Karein (Start)!' : 'Next'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
