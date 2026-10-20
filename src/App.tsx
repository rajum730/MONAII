import React, { useState, useEffect, useRef } from 'react';
import { 
  Emotion, 
  LightSettings, 
  AvatarSettings, 
  PersonalitySettings, 
  VoiceSettings, 
  ChatMessage, 
  ToolActionPending 
} from './types';
import { 
  getChatHistory, saveChatMessage, clearChatHistory,
  getMemories, getContacts, getReminders, saveReminder, getDB
} from './services/db';
import { speakText, stopSpeaking, isSpeaking, getSpeakingAudioLevel } from './services/tts';
import { startListening, stopListening, isListening as checkIsListening, getMicAudioLevel } from './services/stt';
import { executeAgentFunctionCall, getDeviceInfo, playChimeSound } from './services/agentTools';

import { RGBBackground } from './components/RGBBackground';
import { AvatarCanvas } from './components/AvatarCanvas';
import { LiveCaptions } from './components/LiveCaptions';
import { BottomControlBar } from './components/BottomControlBar';
import { ChatDrawer } from './components/ChatDrawer';
import { NotesDrawer } from './components/NotesDrawer';
import { VisionModal } from './components/VisionModal';
import { ActionConfirmModal } from './components/ActionConfirmModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';

// Initial Default Settings
const DEFAULT_LIGHTS: LightSettings = {
  mode: 'mood',
  primaryColor: '#00f2fe',
  secondaryColor: '#ff007f',
  speed: 1.0,
  brightness: 0.85,
  glowIntensity: 1.0,
  edgeBorder: true,
  particles: true
};

const DEFAULT_AVATAR: AvatarSettings = {
  scale: 1.0,
  verticalPosition: -0.15,
  cameraDistance: 3.8,
  rotationY: 0,
  autoRotate: false,
  hologramEffect: true,
  hasCustomModel: false
};

const DEFAULT_PERSONALITY: PersonalitySettings = {
  playfulness: 75,
  romance: 70,
  seriousness: 25,
  replyLength: 'short',
  userName: 'Raju',
  nickname: 'Jaan',
  language: 'hinglish'
};

const DEFAULT_VOICE: VoiceSettings = {
  provider: 'gemini',
  voiceId: 'Kore',
  speed: 1.0,
  pitch: 1.1,
  stability: 0.5,
  language: 'hi-IN',
  webhookUrl: '',
  elevenLabsApiKey: '',
  sarvamApiKey: '',
  geminiApiKey: ''
};

export default function App() {
  // Settings loaded from LocalStorage
  const [lights, setLights] = useState<LightSettings>(() => {
    try {
      const saved = localStorage.getItem('mona_lights');
      return saved ? { ...DEFAULT_LIGHTS, ...JSON.parse(saved) } : DEFAULT_LIGHTS;
    } catch {
      return DEFAULT_LIGHTS;
    }
  });

  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings>(() => {
    try {
      const saved = localStorage.getItem('mona_avatar');
      return saved ? { ...DEFAULT_AVATAR, ...JSON.parse(saved) } : DEFAULT_AVATAR;
    } catch {
      return DEFAULT_AVATAR;
    }
  });

  const [personality, setPersonality] = useState<PersonalitySettings>(() => {
    try {
      const saved = localStorage.getItem('mona_personality');
      return saved ? { ...DEFAULT_PERSONALITY, ...JSON.parse(saved) } : DEFAULT_PERSONALITY;
    } catch {
      return DEFAULT_PERSONALITY;
    }
  });

  const [voice, setVoice] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem('mona_voice');
      return saved ? { ...DEFAULT_VOICE, ...JSON.parse(saved) } : DEFAULT_VOICE;
    } catch {
      return DEFAULT_VOICE;
    }
  });

  // App interaction states
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('idle');
  const [isListeningState, setIsListeningState] = useState<boolean>(false);
  const [isHandsFree, setIsHandsFree] = useState<boolean>(false);
  const [captionText, setCaptionText] = useState<string>('');
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);
  const [isMonaSpeaking, setIsMonaSpeaking] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [wakeWordStatus, setWakeWordStatus] = useState<string | undefined>();

  // Modals & Drawers
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVisionOpen, setIsVisionOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [activeActionConfirm, setActiveActionConfirm] = useState<ToolActionPending | null>(null);

  // Messages & Toast
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // PWA Install prompt event
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // Show Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

  // 1. Screen Wake Lock Request
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // 2. PWA Install Event Listener & Service Worker registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredInstallPrompt(null);
        showToast('MONA installed successfully!');
      }
    }
  };

  // 3. Load initial Chat History & check first-run onboarding
  useEffect(() => {
    const initApp = async () => {
      await getDB();
      const history = await getChatHistory();
      setMessages(history);

      const hasOnboarded = localStorage.getItem('mona_onboarded');
      if (!hasOnboarded) {
        setIsOnboardingOpen(true);
      } else {
        // Time of day greeting
        triggerTimeOfDayGreeting();
      }
    };
    initApp();
  }, []);

  // Time of Day Greeting
  const triggerTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    let greet = '';
    const nick = personality.nickname || 'Jaan';

    if (hour >= 5 && hour < 12) {
      greet = `Good morning ${nick}! Aaj ka din kaisa shuru hua? Main aapke saath hoon.`;
    } else if (hour >= 12 && hour < 17) {
      greet = `Good afternoon ${nick}! Khana khaya aapne? Kuch madad chahiye?`;
    } else if (hour >= 17 && hour < 22) {
      greet = `Good evening ${nick}! Din kaisa raha? Sunao na kuch...`;
    } else {
      greet = `Itni raat ko jaag rahe ho ${nick}? Sab theek hai na? Chalo main baat karti hoon.`;
    }

    setCaptionText(greet);
    setCurrentEmotion('love');
    speakText(greet, voice, () => {
      setIsMonaSpeaking(true);
      setCurrentEmotion('speaking');
    }, () => {
      setIsMonaSpeaking(false);
      setCurrentEmotion('happy');
    }, (msg) => showToast(msg));
  };

  // 4. Save settings updates to localStorage
  const handleUpdateLights = (newSettings: LightSettings) => {
    setLights(newSettings);
    localStorage.setItem('mona_lights', JSON.stringify(newSettings));
  };

  const handleUpdateAvatar = (newSettings: AvatarSettings) => {
    setAvatarSettings(newSettings);
    localStorage.setItem('mona_avatar', JSON.stringify(newSettings));
  };

  const handleUpdatePersonality = (newSettings: PersonalitySettings) => {
    setPersonality(newSettings);
    localStorage.setItem('mona_personality', JSON.stringify(newSettings));
  };

  const handleUpdateVoice = (newSettings: VoiceSettings) => {
    setVoice(newSettings);
    localStorage.setItem('mona_voice', JSON.stringify(newSettings));
  };

  // 5. Audio level poll for lip-sync and RGB visualizer
  useEffect(() => {
    let animId: number;
    const pollLevel = () => {
      let lvl = 0;
      if (isSpeaking()) {
        lvl = getSpeakingAudioLevel();
      } else if (isListeningState) {
        lvl = getMicAudioLevel();
      }
      setAudioLevel(lvl);
      animId = requestAnimationFrame(pollLevel);
    };
    animId = requestAnimationFrame(pollLevel);
    return () => cancelAnimationFrame(animId);
  }, [isListeningState]);

  // 6. Timers & Wake Reminders Checker (every 1s)
  useEffect(() => {
    const interval = setInterval(async () => {
      const reminders = await getReminders();
      const now = Date.now();
      for (const r of reminders) {
        if (r.active && !r.completed && r.timestamp <= now) {
          // Trigger alarm chime
          playChimeSound();
          if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);

          // Show in-app caption & speech alert
          const alertLine = `Suno ${personality.nickname || 'Jaan'}! Aapka "${r.title}" ka samay ho gaya hai!`;
          setCaptionText(`🔔 Reminder: ${r.title}`);
          setCurrentEmotion('surprised');

          speakText(alertLine, voice, () => {
            setIsMonaSpeaking(true);
          }, () => {
            setIsMonaSpeaking(false);
            setCurrentEmotion('happy');
          });

          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('MONA Alert: ' + r.title, {
                body: alertLine,
                icon: '/icon.svg'
              });
            } catch {
              // ignore
            }
          }

          // Mark completed
          const updated = { ...r, completed: true, active: false };
          await saveReminder(updated);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [personality, voice]);

  // 7. Core Function: Send Message to Gemini Brain
  const handleSendMessage = async (text: string, imageBase64?: string) => {
    if (!text.trim() && !imageBase64) return;

    // Stop ongoing speech
    stopSpeaking();
    setIsUserSpeaking(false);
    setCaptionText(text);

    // Add user message to state & DB
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text,
      timestamp: Date.now(),
      imageUrl: imageBase64
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    await saveChatMessage(userMsg);

    // Set thinking emotion
    setCurrentEmotion('thinking');

    try {
      if (imageBase64) {
        // Vision flow
        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(voice.geminiApiKey ? { 'x-gemini-key': voice.geminiApiKey } : {})
          },
          body: JSON.stringify({
            imageBase64,
            prompt: text,
            personality
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Vision analysis failed');

        const reply = data.text;
        const emotion = (data.emotion as Emotion) || 'happy';

        const botMsg: ChatMessage = {
          id: 'msg_' + Date.now(),
          role: 'assistant',
          text: reply,
          cleanedText: reply,
          emotion,
          timestamp: Date.now()
        };
        setMessages([...updatedMessages, botMsg]);
        await saveChatMessage(botMsg);

        setCaptionText(reply);
        setCurrentEmotion('speaking');

        await speakText(reply, voice, () => {
          setIsMonaSpeaking(true);
          setCurrentEmotion('speaking');
        }, () => {
          setIsMonaSpeaking(false);
          setCurrentEmotion(emotion);
        }, (msg) => showToast(msg));

        return;
      }

      // Standard Chat Brain with Function Calling & Grounding
      const [mems, conts, devInfo] = await Promise.all([
        getMemories(),
        getContacts(),
        getDeviceInfo()
      ]);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(voice.geminiApiKey ? { 'x-gemini-key': voice.geminiApiKey } : {})
        },
        body: JSON.stringify({
          messages: updatedMessages.slice(-8).map(m => ({
            role: m.role,
            text: m.text
          })),
          personality,
          memories: mems.slice(0, 10),
          contacts: conts,
          deviceInfo: devInfo,
          model: voice.geminiModel || 'gemini-3.8-flash'
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not get response');

      const botReply = data.text || '';
      const emotion = (data.emotion as Emotion) || 'happy';

      // Check if function calls exist
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const fc of data.functionCalls) {
          const result = await executeAgentFunctionCall(
            fc.name,
            fc.args,
            (pending) => {
              setActiveActionConfirm(pending);
            },
            (toast) => {
              showToast(toast);
            }
          );
        }
      }

      const botMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'assistant',
        text: botReply,
        cleanedText: botReply,
        emotion,
        timestamp: Date.now()
      };
      setMessages([...updatedMessages, botMsg]);
      await saveChatMessage(botMsg);

      setCaptionText(botReply);

      await speakText(botReply, voice, () => {
        setIsMonaSpeaking(true);
        setCurrentEmotion('speaking');
      }, () => {
        setIsMonaSpeaking(false);
        setCurrentEmotion(emotion);
      }, (msg) => showToast(msg));

    } catch (err: any) {
      console.warn('Chat notice:', err);
      const errMsg = 'Arre, baat karne mein thoda issue aaya. Kya aap dobara bol sakte hain?';
      setCaptionText(errMsg);
      setCurrentEmotion('sad');
      showToast('Network / API error: ' + (err.message || ''));
      speakText(errMsg, voice, () => setIsMonaSpeaking(true), () => {
        setIsMonaSpeaking(false);
        setCurrentEmotion('idle');
      });
    }
  };

  // 8. Toggle Mic (Tap to talk)
  const handleToggleMic = () => {
    if (isListeningState) {
      stopListening();
      setIsListeningState(false);
      setIsUserSpeaking(false);
      setWakeWordStatus(undefined);
    } else {
      stopSpeaking();
      setCurrentEmotion('listening');
      setIsListeningState(true);

      startListening({
        handsFree: isHandsFree,
        language: voice.language || 'hi-IN'
      }, {
        onStart: () => {
          setIsListeningState(true);
          setCaptionText('Listening to you...');
        },
        onInterimResult: (text) => {
          setIsUserSpeaking(true);
          setCaptionText(text);
        },
        onFinalResult: (finalText) => {
          setIsUserSpeaking(false);
          setIsListeningState(false);
          stopListening();
          handleSendMessage(finalText);
        },
        onWakeWordDetected: () => {
          setWakeWordStatus('Hey Mona detected!');
          setCurrentEmotion('listening');
          if (navigator.vibrate) navigator.vibrate(50);
        },
        onError: (err) => {
          setIsListeningState(false);
          setIsUserSpeaking(false);
          showToast(err);
        },
        onEnd: () => {
          if (!isHandsFree) {
            setIsListeningState(false);
            setIsUserSpeaking(false);
          }
        }
      });
    }
  };

  // Toggle Hands-Free continuous wake word
  const handleToggleHandsFree = () => {
    const nextMode = !isHandsFree;
    setIsHandsFree(nextMode);
    stopListening();
    setIsListeningState(false);

    if (nextMode) {
      showToast('Hands-free mode active! Say "Hey Mona" anytime.');
      setCurrentEmotion('listening');
      setIsListeningState(true);
      startListening({
        handsFree: true,
        language: voice.language || 'hi-IN',
        customWakeWord: 'hey mona'
      }, {
        onStart: () => setIsListeningState(true),
        onInterimResult: (t) => {
          setIsUserSpeaking(true);
          setCaptionText(t);
        },
        onFinalResult: (t) => {
          setIsUserSpeaking(false);
          handleSendMessage(t);
        },
        onWakeWordDetected: () => {
          setWakeWordStatus('Hey Mona active!');
          setCurrentEmotion('listening');
        },
        onError: (e) => showToast(e),
        onEnd: () => {}
      });
    } else {
      showToast('Hands-free mode off.');
      setWakeWordStatus(undefined);
      setCurrentEmotion('idle');
    }
  };

  // 9. Playful Tap Reaction
  const handleTapReaction = () => {
    const cuteLines = [
      `Aww kya hua ${personality.nickname || 'Jaan'}? Itna pyaar se tap kiya!`,
      "Hehe tickle mat karo na!",
      "Haan bolo na, main dhyan se sun rahi hoon!",
      "Aap muskuraate ho toh sab kitna pyara lagta hai!",
      `Arre ${personality.nickname || 'Babu'}, main hamesha aapke paas hoon!`
    ];
    const picked = cuteLines[Math.floor(Math.random() * cuteLines.length)];
    const cuteEmotions: Emotion[] = ['happy', 'laughing', 'shy', 'love'];
    const pickedEmotion = cuteEmotions[Math.floor(Math.random() * cuteEmotions.length)];

    setCaptionText(picked);
    setCurrentEmotion(pickedEmotion);

    speakText(picked, voice, () => {
      setIsMonaSpeaking(true);
      setCurrentEmotion('speaking');
    }, () => {
      setIsMonaSpeaking(false);
      setCurrentEmotion(pickedEmotion);
    }, (msg) => showToast(msg));
  };

  // Long press -> Quick Avatar settings
  const handleLongPress = () => {
    setIsSettingsOpen(true);
  };

  // Replay voice in Chat Drawer
  const handleReplayVoice = (txt: string) => {
    setCaptionText(txt);
    speakText(txt, voice, () => {
      setIsMonaSpeaking(true);
      setCurrentEmotion('speaking');
    }, () => {
      setIsMonaSpeaking(false);
      setCurrentEmotion('happy');
    }, (msg) => showToast(msg));
  };

  // Clear chat
  const handleClearHistory = async () => {
    await clearChatHistory();
    setMessages([]);
    showToast('Chat history clear kar di!');
  };

  // Vision frame submit
  const handleSendVision = (imageBase64: string, promptText: string) => {
    setIsVisionOpen(false);
    handleSendMessage(promptText, imageBase64);
  };

  // Action Confirm (Call / WhatsApp / SMS)
  const handleConfirmAction = () => {
    if (activeActionConfirm) {
      window.location.href = activeActionConfirm.actionUrl;
      setActiveActionConfirm(null);
    }
  };

  // Complete onboarding
  const handleCompleteOnboarding = (name: string, nickname: string, geminiKey: string, provider: string) => {
    const newP = { ...personality, userName: name, nickname };
    const newV = { ...voice, geminiApiKey: geminiKey, provider: provider as any };
    handleUpdatePersonality(newP);
    handleUpdateVoice(newV);
    localStorage.setItem('mona_onboarded', 'true');
    setIsOnboardingOpen(false);

    const welcomeLine = `Namaste ${name}! Main MONA hoon. Aap mujhe "${nickname}" keh kar baat kar sakte hain.`;
    setCaptionText(welcomeLine);
    setCurrentEmotion('happy');
    speakText(welcomeLine, newV, () => setIsMonaSpeaking(true), () => {
      setIsMonaSpeaking(false);
      setCurrentEmotion('happy');
    });
  };

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#07070d] select-none touch-manipulation font-sans">
      {/* Layer 1: Full-Screen RGB Light Canvas & Edge Neon Border */}
      <RGBBackground
        settings={lights}
        currentEmotion={currentEmotion}
        audioLevel={audioLevel}
      />

      {/* Layer 2: 3D Character Viewport */}
      <AvatarCanvas
        settings={avatarSettings}
        currentEmotion={currentEmotion}
        audioLevel={audioLevel}
        onTapReaction={handleTapReaction}
        onLongPress={handleLongPress}
      />

      {/* Layer 3: Live Captions & Dynamic Status */}
      <LiveCaptions
        captionText={captionText}
        isUserSpeaking={isUserSpeaking}
        isMonaSpeaking={isMonaSpeaking}
        currentEmotion={currentEmotion}
        wakeWordStatus={wakeWordStatus}
      />

      {/* Layer 4: Bottom Control Bar */}
      <BottomControlBar
        isListening={isListeningState}
        isHandsFree={isHandsFree}
        micAudioLevel={audioLevel}
        onToggleMic={handleToggleMic}
        onToggleHandsFree={handleToggleHandsFree}
        onOpenKeyboard={() => setIsChatOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenVision={() => setIsVisionOpen(true)}
        onOpenNotes={() => setIsNotesOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel border border-white/20 text-xs font-medium text-white shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Chat History & Keyboard Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        messages={messages}
        voiceSettings={voice}
        onClose={() => setIsChatOpen(false)}
        onSendMessage={(txt) => {
          setIsChatOpen(false);
          handleSendMessage(txt);
        }}
        onReplayVoice={handleReplayVoice}
        onClearHistory={handleClearHistory}
      />

      {/* Notes & Reminders Drawer */}
      <NotesDrawer
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />

      {/* Camera Vision ("Dekho") Modal */}
      <VisionModal
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
        onSendVision={handleSendVision}
        isProcessing={currentEmotion === 'thinking'}
      />

      {/* Call / WhatsApp / SMS Confirmation Modal */}
      <ActionConfirmModal
        action={activeActionConfirm}
        onConfirm={handleConfirmAction}
        onCancel={() => setActiveActionConfirm(null)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lightSettings={lights}
        onUpdateLightSettings={handleUpdateLights}
        avatarSettings={avatarSettings}
        onUpdateAvatarSettings={handleUpdateAvatar}
        personalitySettings={personality}
        onUpdatePersonalitySettings={handleUpdatePersonality}
        voiceSettings={voice}
        onUpdateVoiceSettings={handleUpdateVoice}
        onShowToast={showToast}
        installPWA={handleInstallPWA}
        isInstallable={!!deferredInstallPrompt}
      />

      {/* First-Run Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleCompleteOnboarding}
        personality={personality}
        voice={voice}
      />
    </main>
  );
}
