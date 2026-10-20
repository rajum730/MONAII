export type Emotion = 
  | 'idle' 
  | 'happy' 
  | 'laughing' 
  | 'shy' 
  | 'surprised' 
  | 'sad' 
  | 'angry' 
  | 'love' 
  | 'listening' 
  | 'thinking' 
  | 'speaking';

export type LightMode = 
  | 'rainbow' 
  | 'breathing' 
  | 'wave' 
  | 'audio' 
  | 'mood' 
  | 'solid';

export interface LightSettings {
  mode: LightMode;
  primaryColor: string;
  secondaryColor: string;
  speed: number;        // 0.2 to 3.0
  brightness: number;   // 0.1 to 1.0
  glowIntensity: number;// 0.2 to 2.0
  edgeBorder: boolean;
  particles: boolean;
}

export interface AvatarSettings {
  scale: number;            // 0.5 to 2.0
  verticalPosition: number; // -2.0 to 2.0
  cameraDistance: number;   // 2.0 to 6.0
  rotationY: number;        // in degrees
  autoRotate: boolean;
  hologramEffect: boolean;
  hasCustomModel: boolean;
  modelFileName?: string;
}

export type PersonalityLength = 'short' | 'medium' | 'detailed';

export interface PersonalitySettings {
  playfulness: number;     // 0 to 100
  romance: number;         // 0 to 100
  seriousness: number;     // 0 to 100
  replyLength: PersonalityLength;
  userName: string;
  nickname: string;
  language: 'hinglish' | 'hi' | 'en';
  customSystemPrompt?: string;
}

export type VoiceProvider = 'browser' | 'gemini' | 'elevenlabs' | 'sarvam' | 'webhook';

export interface VoiceSettings {
  provider: VoiceProvider;
  voiceId: string;
  speed: number;      // 0.7 to 1.5
  pitch: number;      // 0.8 to 1.4
  stability: number;  // 0.0 to 1.0 (ElevenLabs)
  language: string;   // hi-IN, en-IN
  webhookUrl: string;
  elevenLabsApiKey: string;
  sarvamApiKey: string;
  geminiApiKey: string;
  geminiModel?: 'gemini-3.8-flash' | 'gemini-4-argon';
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReminderItem {
  id: string;
  title: string;
  timestamp: number; // target time in ms
  type: 'timer' | 'reminder';
  durationSeconds?: number;
  completed: boolean;
  active: boolean;
}

export interface MemoryItem {
  id: string;
  fact: string;
  category: 'preference' | 'people' | 'date' | 'general';
  timestamp: number;
}

export interface AutomationCommand {
  id: string;
  keyword: string;
  webhookUrl: string;
  description: string;
}

export interface ToolActionPending {
  id: string;
  type: 'call' | 'sms' | 'whatsapp' | 'email' | 'url';
  title: string;
  target: string;
  body?: string;
  actionUrl: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  cleanedText?: string;
  emotion?: Emotion;
  toolAction?: ToolActionPending;
  timestamp: number;
  isVision?: boolean;
  imageUrl?: string;
}
