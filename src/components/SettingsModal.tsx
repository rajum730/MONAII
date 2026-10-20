import React, { useState, useEffect } from 'react';
import { 
  LightSettings, 
  AvatarSettings, 
  PersonalitySettings, 
  VoiceSettings, 
  VoiceProvider,
  Contact, 
  MemoryItem, 
  AutomationCommand 
} from '../types';
import { 
  getContacts, saveContact, deleteContact,
  getMemories, saveMemory, deleteMemory,
  getAutomations, saveAutomation, deleteAutomation,
  saveModelFile, removeModelFile
} from '../services/db';
import { speakText } from '../services/tts';
import { 
  X, Key, Volume2, Palette, User, Heart, Brain, 
  Phone, Zap, Shield, Info, Upload, Trash2, Plus, 
  Play, Download, RefreshCw, Smartphone
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lightSettings: LightSettings;
  onUpdateLightSettings: (settings: LightSettings) => void;
  avatarSettings: AvatarSettings;
  onUpdateAvatarSettings: (settings: AvatarSettings) => void;
  personalitySettings: PersonalitySettings;
  onUpdatePersonalitySettings: (settings: PersonalitySettings) => void;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (settings: VoiceSettings) => void;
  onShowToast: (msg: string) => void;
  installPWA?: () => void;
  isInstallable?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  lightSettings,
  onUpdateLightSettings,
  avatarSettings,
  onUpdateAvatarSettings,
  personalitySettings,
  onUpdatePersonalitySettings,
  voiceSettings,
  onUpdateVoiceSettings,
  onShowToast,
  installPWA,
  isInstallable
}) => {
  const [activeTab, setActiveTab] = useState<
    'keys' | 'voice' | 'lights' | 'avatar' | 'personality' | 'memory' | 'contacts' | 'automations' | 'permissions' | 'about'
  >('keys');

  // Contacts, Memories, Automations state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [automations, setAutomations] = useState<AutomationCommand[]>([]);

  // Permissions state
  const [permMic, setPermMic] = useState<string>('prompt');
  const [permCam, setPermCam] = useState<string>('prompt');
  const [permLoc, setPermLoc] = useState<string>('prompt');
  const [permNotif, setPermNotif] = useState<string>('default');

  // New item draft states
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('');

  const [newMemoryFact, setNewMemoryFact] = useState('');
  const [newMemoryCat, setNewMemoryCat] = useState<'preference' | 'people' | 'date' | 'general'>('general');

  const [newAutoKeyword, setNewAutoKeyword] = useState('');
  const [newAutoWebhook, setNewAutoWebhook] = useState('');

  // Real voices list for ElevenLabs
  const [elevenVoices, setElevenVoices] = useState<{ voice_id: string; name: string }[]>([]);
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);

  // Load secondary data
  const refreshAll = async () => {
    const [c, m, a] = await Promise.all([getContacts(), getMemories(), getAutomations()]);
    setContacts(c);
    setMemories(m);
    setAutomations(a);

    // Check permissions
    if ('Notification' in window) {
      setPermNotif(Notification.permission);
    }
    if (navigator.permissions) {
      try {
        const mStatus = await navigator.permissions.query({ name: 'microphone' as any });
        setPermMic(mStatus.state);
        const cStatus = await navigator.permissions.query({ name: 'camera' as any });
        setPermCam(cStatus.state);
        const lStatus = await navigator.permissions.query({ name: 'geolocation' as any });
        setPermLoc(lStatus.state);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAll();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Test voice
  const handleTestVoice = async () => {
    const sampleLine = personalitySettings.language === 'en'
      ? "Hi there, I am MONA, your personal AI companion!"
      : "Hi jaan! Main MONA hoon, aapki sweet companion. Kaise ho aap?";
    await speakText(sampleLine, voiceSettings, undefined, undefined, (msg) => onShowToast(msg));
  };

  // Fetch ElevenLabs voices
  const handleFetchElevenVoices = async () => {
    if (!voiceSettings.elevenLabsApiKey) {
      onShowToast('Pehle ElevenLabs API key daaliye!');
      return;
    }
    setIsFetchingVoices(true);
    try {
      const res = await fetch(`/api/tts/elevenlabs/voices?apiKey=${encodeURIComponent(voiceSettings.elevenLabsApiKey)}`);
      const data = await res.json();
      if (data.voices && data.voices.length > 0) {
        setElevenVoices(data.voices);
        onShowToast(`${data.voices.length} ElevenLabs voices mil gayi!`);
      } else {
        onShowToast('Voices load nahi hui: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      onShowToast('Error fetching voices: ' + e.message);
    } finally {
      setIsFetchingVoices(false);
    }
  };

  // Handle 3D model upload
  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.glb') && !file.name.endsWith('.gltf')) {
      onShowToast('Sirf .glb ya .gltf files upload karein!');
      return;
    }
    try {
      await saveModelFile(file);
      onUpdateAvatarSettings({
        ...avatarSettings,
        hasCustomModel: true,
        modelFileName: file.name
      });
      onShowToast(`3D Model "${file.name}" save ho gaya!`);
    } catch (err: any) {
      onShowToast('Model save fail hua: ' + err.message);
    }
  };

  const handleResetModel = async () => {
    await removeModelFile();
    onUpdateAvatarSettings({
      ...avatarSettings,
      hasCustomModel: false,
      modelFileName: undefined
    });
    onShowToast('Default holographic companion reset ho gaya!');
  };

  // Add contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    await saveContact({
      id: 'contact_' + Date.now(),
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relationship: newContactRel.trim() || undefined
    });
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRel('');
    refreshAll();
    onShowToast('Contact save ho gaya!');
  };

  // Add memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryFact.trim()) return;
    await saveMemory({
      id: 'mem_' + Date.now(),
      fact: newMemoryFact.trim(),
      category: newMemoryCat,
      timestamp: Date.now()
    });
    setNewMemoryFact('');
    refreshAll();
    onShowToast('Memory save ho gayi!');
  };

  // Add automation
  const handleAddAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAutoKeyword.trim() || !newAutoWebhook.trim()) return;
    await saveAutomation({
      id: 'auto_' + Date.now(),
      keyword: newAutoKeyword.trim().toLowerCase(),
      webhookUrl: newAutoWebhook.trim(),
      description: 'Custom webhook automation'
    });
    setNewAutoKeyword('');
    setNewAutoWebhook('');
    refreshAll();
    onShowToast('Automation command save ho gaya!');
  };

  // Request permissions
  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setPermMic('granted');
      onShowToast('Microphone permission granted!');
    } catch {
      setPermMic('denied');
      onShowToast('Microphone permission denied.');
    }
  };

  const requestCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setPermCam('granted');
      onShowToast('Camera permission granted!');
    } catch {
      setPermCam('denied');
      onShowToast('Camera permission denied.');
    }
  };

  const requestLoc = () => {
    navigator.geolocation.getCurrentPosition(
      () => {
        setPermLoc('granted');
        onShowToast('Location permission granted!');
      },
      () => {
        setPermLoc('denied');
        onShowToast('Location permission denied.');
      }
    );
  };

  const requestNotif = async () => {
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      setPermNotif(res);
      if (res === 'granted') onShowToast('Notifications permission granted!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5">
      <div className="w-full max-w-lg h-[90vh] flex flex-col rounded-3xl glass-dock border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/70">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Settings & Preferences</span>
            </h2>
            <p className="text-[11px] text-slate-400">Configure MONA AI companion</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation pills (horizontal scrollable) */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-slate-950/40 overflow-x-auto no-scrollbar">
          {[
            { id: 'keys', label: 'API Keys', icon: Key },
            { id: 'voice', label: 'Voice', icon: Volume2 },
            { id: 'lights', label: 'Lights', icon: Palette },
            { id: 'avatar', label: 'Avatar', icon: User },
            { id: 'personality', label: 'Personality', icon: Heart },
            { id: 'memory', label: 'Memory', icon: Brain },
            { id: 'contacts', label: 'Contacts', icon: Phone },
            { id: 'automations', label: 'Automations', icon: Zap },
            { id: 'permissions', label: 'Permissions', icon: Shield },
            { id: 'about', label: 'About & PWA', icon: Info }
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-300">
          {/* TAB: API KEYS */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-200">
                <p className="font-semibold text-xs mb-1">Secure Local Storage</p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Aapke API keys sirf aapke device par localStorage mein store hote hain. Server par default Gemini key pehle se configured hai!
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Gemini API Key (Optional Override)</label>
                <input
                  type="password"
                  value={voiceSettings.geminiApiKey}
                  onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, geminiApiKey: e.target.value })}
                  placeholder="Enter your own Gemini API key..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Gemini Model</label>
                <select
                  value={voiceSettings.geminiModel || 'gemini-3.8-flash'}
                  onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, geminiModel: e.target.value as any })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Recommended: Fast & Low Latency)</option>
                  <option value="gemini-4-argon">Gemini 4 Argon (Pro Reasoning & STEM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">ElevenLabs API Key</label>
                <input
                  type="password"
                  value={voiceSettings.elevenLabsApiKey}
                  onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, elevenLabsApiKey: e.target.value })}
                  placeholder="Enter ElevenLabs API key for ultra-human voice..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Sarvam AI API Key (Indian Languages)</label>
                <input
                  type="password"
                  value={voiceSettings.sarvamApiKey}
                  onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, sarvamApiKey: e.target.value })}
                  placeholder="Enter Sarvam AI key for Hindi voices..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* TAB: VOICE */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">Voice Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'browser', label: 'Browser TTS (Free Fallback)' },
                    { id: 'gemini', label: 'Gemini 3.8 Flash Lite TTS' },
                    { id: 'elevenlabs', label: 'ElevenLabs' },
                    { id: 'sarvam', label: 'Sarvam AI (Hindi)' },
                    { id: 'webhook', label: 'Custom Webhook' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateVoiceSettings({ ...voiceSettings, provider: p.id as VoiceProvider })}
                      className={`p-2.5 rounded-xl border text-left font-medium transition ${
                        voiceSettings.provider === p.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider specific controls */}
              {voiceSettings.provider === 'gemini' && (
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">Gemini Prebuilt Voice</label>
                  <select
                    value={voiceSettings.voiceId || 'Kore'}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, voiceId: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Kore">Kore (Warm, sweet female companion)</option>
                    <option value="Zephyr">Zephyr (Bright, youthful female)</option>
                    <option value="Puck">Puck (Playful, cheerful)</option>
                    <option value="Fenrir">Fenrir (Clear, resonant)</option>
                    <option value="Charon">Charon (Calm, deep)</option>
                  </select>
                </div>
              )}

              {voiceSettings.provider === 'elevenlabs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white">ElevenLabs Voice</label>
                    <button
                      type="button"
                      onClick={handleFetchElevenVoices}
                      disabled={isFetchingVoices}
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingVoices ? 'animate-spin' : ''}`} />
                      Refresh Voices
                    </button>
                  </div>

                  <select
                    value={voiceSettings.voiceId || '21m00Tcm4TlvDq8ikWAM'}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, voiceId: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Default Friendly Female)</option>
                    <option value="EXAVITQu4vr4xnSDxMaL">Bella (Sweet & Expressive)</option>
                    <option value="AZnzlk1XvdvUeBnXmlld">Domi (Warm & Energetic)</option>
                    {elevenVoices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                    ))}
                  </select>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Expressiveness / Stability: {Math.round((voiceSettings.stability || 0.5) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={voiceSettings.stability || 0.5}
                      onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, stability: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {voiceSettings.provider === 'sarvam' && (
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">Sarvam Speaker</label>
                  <select
                    value={voiceSettings.voiceId || 'meera'}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, voiceId: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="meera">Meera (Hindi Female)</option>
                    <option value="pavithra">Pavithra (Natural Female)</option>
                    <option value="arvind">Arvind (Male)</option>
                  </select>
                </div>
              )}

              {voiceSettings.provider === 'webhook' && (
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">Custom Webhook Voice URL</label>
                  <input
                    type="url"
                    value={voiceSettings.webhookUrl || ''}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, webhookUrl: e.target.value })}
                    placeholder="https://n8n.your-domain.com/webhook/tts"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              {/* Sliders: Speed, Pitch */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Speed: {voiceSettings.speed || 1.0}x
                  </label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={voiceSettings.speed || 1.0}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, speed: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Pitch: {voiceSettings.pitch || 1.1}x
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={voiceSettings.pitch || 1.1}
                    onChange={(e) => onUpdateVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>

              {/* Test Voice Button */}
              <button
                type="button"
                onClick={handleTestVoice}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold text-xs shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Test Voice Output
              </button>
            </div>
          )}

          {/* TAB: LIGHTS */}
          {activeTab === 'lights' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">Light Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'rainbow', label: 'Rainbow' },
                    { id: 'breathing', label: 'Breathing' },
                    { id: 'wave', label: 'Wave' },
                    { id: 'audio', label: 'Audio Pulse' },
                    { id: 'mood', label: 'Mood Follow' },
                    { id: 'solid', label: 'Solid Glow' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onUpdateLightSettings({ ...lightSettings, mode: m.id as any })}
                      className={`p-2 rounded-xl border text-center font-medium transition ${
                        lightSettings.mode === m.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lightSettings.primaryColor}
                      onChange={(e) => onUpdateLightSettings({ ...lightSettings, primaryColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-400">{lightSettings.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Secondary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lightSettings.secondaryColor}
                      onChange={(e) => onUpdateLightSettings({ ...lightSettings, secondaryColor: e.target.value })}
                      className="w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-400">{lightSettings.secondaryColor}</span>
                  </div>
                </div>
              </div>

              {/* Sliders: Speed, Brightness, Glow */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Speed: {lightSettings.speed.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={lightSettings.speed}
                  onChange={(e) => onUpdateLightSettings({ ...lightSettings, speed: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Brightness: {Math.round(lightSettings.brightness * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={lightSettings.brightness}
                  onChange={(e) => onUpdateLightSettings({ ...lightSettings, brightness: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Glow Intensity: {lightSettings.glowIntensity.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={lightSettings.glowIntensity}
                  onChange={(e) => onUpdateLightSettings({ ...lightSettings, glowIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-white">Edge Neon Screen Border</span>
                <input
                  type="checkbox"
                  checked={lightSettings.edgeBorder}
                  onChange={(e) => onUpdateLightSettings({ ...lightSettings, edgeBorder: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-white">Floating RGB Particles</span>
                <input
                  type="checkbox"
                  checked={lightSettings.particles}
                  onChange={(e) => onUpdateLightSettings({ ...lightSettings, particles: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* TAB: AVATAR */}
          {activeTab === 'avatar' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">3D Character Model</label>
                <div className="p-3 rounded-2xl glass-panel space-y-2 border border-white/10">
                  <p className="text-[11px] text-slate-400">
                    {avatarSettings.hasCustomModel
                      ? `Custom Model Active: ${avatarSettings.modelFileName || 'avatar.glb'}`
                      : 'Default Futuristic Hologram Companion Active'}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <label className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95">
                      <Upload className="w-4 h-4" /> Upload .glb / .gltf
                      <input type="file" accept=".glb,.gltf" onChange={handleModelUpload} className="hidden" />
                    </label>

                    {avatarSettings.hasCustomModel && (
                      <button
                        type="button"
                        onClick={handleResetModel}
                        className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sliders */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Model Scale: {avatarSettings.scale.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={avatarSettings.scale}
                  onChange={(e) => onUpdateAvatarSettings({ ...avatarSettings, scale: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Vertical Position: {avatarSettings.verticalPosition.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="-2.0"
                  max="1.5"
                  step="0.05"
                  value={avatarSettings.verticalPosition}
                  onChange={(e) => onUpdateAvatarSettings({ ...avatarSettings, verticalPosition: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Camera Distance: {avatarSettings.cameraDistance.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="2.0"
                  max="6.0"
                  step="0.1"
                  value={avatarSettings.cameraDistance}
                  onChange={(e) => onUpdateAvatarSettings({ ...avatarSettings, cameraDistance: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Rotation: {avatarSettings.rotationY}°
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={avatarSettings.rotationY}
                  onChange={(e) => onUpdateAvatarSettings({ ...avatarSettings, rotationY: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-white">Auto Rotate Avatar</span>
                <input
                  type="checkbox"
                  checked={avatarSettings.autoRotate}
                  onChange={(e) => onUpdateAvatarSettings({ ...avatarSettings, autoRotate: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-white">Hologram Cyber Aura Glow</span>
                <input
                  type="checkbox"
                  checked={avatarSettings.hologramEffect}
                  onChange={(e) => onUpdateAvatarSettings({ ...avatarSettings, hologramEffect: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </div>
            </div>
          )}

          {/* TAB: PERSONALITY */}
          {activeTab === 'personality' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">Your Name</label>
                  <input
                    type="text"
                    value={personalitySettings.userName}
                    onChange={(e) => onUpdatePersonalitySettings({ ...personalitySettings, userName: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white mb-1">MONA calls you</label>
                  <input
                    type="text"
                    value={personalitySettings.nickname}
                    onChange={(e) => onUpdatePersonalitySettings({ ...personalitySettings, nickname: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Language</label>
                <select
                  value={personalitySettings.language}
                  onChange={(e) => onUpdatePersonalitySettings({ ...personalitySettings, language: e.target.value as any })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="hinglish">Hinglish (Natural Hindi + English mix)</option>
                  <option value="hi">Hindi</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Personality Sliders */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Playfulness & Teasing: {personalitySettings.playfulness}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={personalitySettings.playfulness}
                  onChange={(e) => onUpdatePersonalitySettings({ ...personalitySettings, playfulness: parseInt(e.target.value, 10) })}
                  className="w-full accent-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Affection & Romance: {personalitySettings.romance}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={personalitySettings.romance}
                  onChange={(e) => onUpdatePersonalitySettings({ ...personalitySettings, romance: parseInt(e.target.value, 10) })}
                  className="w-full accent-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Seriousness: {personalitySettings.seriousness}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={personalitySettings.seriousness}
                  onChange={(e) => onUpdatePersonalitySettings({ ...personalitySettings, seriousness: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Spoken Reply Length</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'short', label: 'Short (1-2 lines)' },
                    { id: 'medium', label: 'Medium (2-3 lines)' },
                    { id: 'detailed', label: 'Detailed' }
                  ].map((len) => (
                    <button
                      key={len.id}
                      type="button"
                      onClick={() => onUpdatePersonalitySettings({ ...personalitySettings, replyLength: len.id as any })}
                      className={`p-2 rounded-xl border text-center font-medium transition ${
                        personalitySettings.replyLength === len.id
                          ? 'border-pink-500 bg-pink-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400'
                      }`}
                    >
                      {len.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-4">
              <form onSubmit={handleAddMemory} className="p-3 rounded-2xl glass-panel space-y-2 border border-white/10">
                <input
                  type="text"
                  value={newMemoryFact}
                  onChange={(e) => setNewMemoryFact(e.target.value)}
                  placeholder="New fact for MONA to remember forever..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={newMemoryCat}
                    onChange={(e) => setNewMemoryCat(e.target.value as any)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <option value="general">General</option>
                    <option value="preference">Preference</option>
                    <option value="people">People</option>
                    <option value="date">Date</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newMemoryFact.trim()}
                    className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs disabled:opacity-50"
                  >
                    Add Memory
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {memories.length === 0 ? (
                  <p className="text-center py-6 text-slate-500 text-xs">Koi memory nahi hai abhi.</p>
                ) : (
                  memories.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl glass-panel border border-white/5">
                      <div>
                        <p className="text-xs text-white">{m.fact}</p>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{m.category}</span>
                      </div>
                      <button
                        onClick={async () => {
                          await deleteMemory(m.id);
                          refreshAll();
                        }}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: CONTACTS */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              <form onSubmit={handleAddContact} className="p-3 rounded-2xl glass-panel space-y-2 border border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Name (e.g. Mummy, Rahul)..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="Phone number (+91...)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={newContactRel}
                    onChange={(e) => setNewContactRel(e.target.value)}
                    placeholder="Relationship (e.g. Mother, Colleague)..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={!newContactName.trim() || !newContactPhone.trim()}
                    className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs disabled:opacity-50"
                  >
                    Save Contact
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl glass-panel border border-white/5">
                    <div>
                      <h4 className="text-xs font-semibold text-white">{c.name}</h4>
                      <p className="text-[11px] text-cyan-300 font-mono">{c.phone}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteContact(c.id);
                        refreshAll();
                      }}
                      className="p-1 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: AUTOMATIONS */}
          {activeTab === 'automations' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Add voice phrases that will trigger an external webhook (e.g. n8n or Home Assistant). MONA will speak the response!
              </p>

              <form onSubmit={handleAddAutomation} className="p-3 rounded-2xl glass-panel space-y-2 border border-white/10">
                <input
                  type="text"
                  value={newAutoKeyword}
                  onChange={(e) => setNewAutoKeyword(e.target.value)}
                  placeholder="Spoken trigger (e.g. 'lights on', 'pc shutdown')..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="url"
                  value={newAutoWebhook}
                  onChange={(e) => setNewAutoWebhook(e.target.value)}
                  placeholder="Webhook URL (https://...)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!newAutoKeyword.trim() || !newAutoWebhook.trim()}
                  className="w-full py-2 rounded-xl bg-purple-600 text-white font-bold text-xs disabled:opacity-50"
                >
                  Save Automation
                </button>
              </form>

              <div className="space-y-2">
                {automations.map((a) => (
                  <div key={a.id} className="p-3 rounded-2xl glass-panel border border-white/5 flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-purple-300">"{a.keyword}"</h4>
                      <p className="text-[10px] text-slate-400 truncate max-w-[240px] mt-0.5">{a.webhookUrl}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteAutomation(a.id);
                        refreshAll();
                      }}
                      className="p-1 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-3">
              {[
                { name: 'Microphone (Voice conversation)', status: permMic, action: requestMic },
                { name: 'Camera (Dekho vision & Flashlight)', status: permCam, action: requestCam },
                { name: 'Location (Live weather & maps)', status: permLoc, action: requestLoc },
                { name: 'Notifications (Reminders & wake alarms)', status: permNotif, action: requestNotif }
              ].map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl glass-panel border border-white/10">
                  <div>
                    <h4 className="text-xs font-semibold text-white">{p.name}</h4>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      p.status === 'granted' ? 'text-emerald-400' : p.status === 'denied' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      Status: {p.status}
                    </span>
                  </div>
                  {p.status !== 'granted' && (
                    <button
                      type="button"
                      onClick={p.action}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs active:scale-95 transition"
                    >
                      Grant
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB: ABOUT & PWA */}
          {activeTab === 'about' && (
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-cyan-500 via-pink-500 to-purple-600 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-950 rounded-3xl flex items-center justify-center font-black text-2xl text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 to-pink-500">
                  M
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">MONA AI Companion</h3>
                <p className="text-xs text-slate-400 mt-0.5">Version 1.0.0 (Android Chrome PWA)</p>
              </div>

              {isInstallable && installPWA && (
                <button
                  type="button"
                  onClick={installPWA}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Smartphone className="w-5 h-5" /> Install MONA on Android Home Screen
                </button>
              )}

              <div className="p-3 rounded-2xl glass-panel text-left space-y-1.5 text-[11px] text-slate-400 border border-white/5">
                <p>• Edge-to-edge full-screen portrait companion</p>
                <p>• Screen Wake Lock keeps display active</p>
                <p>• 3D Character with real-time lip sync & animations</p>
                <p>• Grounded in live web information via Gemini</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
