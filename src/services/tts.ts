import { VoiceSettings } from '../types';

let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let currentSource: AudioNode | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let isCurrentlySpeaking = false;
let stopRequested = false;

function getAudioContext(): { ctx: AudioContext; analyser: AnalyserNode } {
  if (!audioContext || audioContext.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass();
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return { ctx: audioContext, analyser: analyserNode! };
}

// Split text into natural conversational sentences
export function splitSentences(text: string): string[] {
  // Strip emotion tags like [emotion: happy]
  const clean = text.replace(/\[emotion:\s*[a-zA-Z]+\]/gi, '').trim();
  if (!clean) return [];

  // Split by sentence terminators or natural pauses
  const sentences = clean
    .split(/(?<=[.!?\n])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.length > 0 ? sentences : [clean];
}

// Real-time audio amplitude for lip sync (0.0 to 1.0)
export function getSpeakingAudioLevel(): number {
  if (!isCurrentlySpeaking || !analyserNode) return 0;
  const data = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  const average = sum / data.length;
  // Normalize to 0..1 with slight boost
  return Math.min(1, (average / 128) * 1.4);
}

export function isSpeaking(): boolean {
  return isCurrentlySpeaking;
}

export function stopSpeaking() {
  stopRequested = true;
  isCurrentlySpeaking = false;
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement.src = '';
    } catch {
      // ignore
    }
    currentAudioElement = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

// Play audio via HTMLAudioElement attached to Web Audio Analyser
async function playAudioBufferOrUrl(src: string): Promise<void> {
  if (stopRequested) return;

  const { ctx, analyser } = getAudioContext();
  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.src = src;
  currentAudioElement = audio;

  const source = ctx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(ctx.destination);
  currentSource = source;

  return new Promise((resolve) => {
    audio.onended = () => {
      resolve();
    };
    audio.onerror = () => {
      resolve();
    };
    audio.play().catch(() => {
      resolve();
    });
  });
}

// Browser SpeechSynthesis Fallback
function speakWithBrowserTTS(text: string, voiceSettings: VoiceSettings): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSettings.speed || 1.0;
    utterance.pitch = voiceSettings.pitch || 1.1;

    // Pick best Indian English / Hindi female voice if available
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find(v => v.voiceURI === voiceSettings.voiceId);
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        (v.lang.includes('hi') || v.lang.includes('IN') || v.lang.includes('en-IN')) &&
        (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural'))
      ) || voices.find(v => v.lang.includes('en-IN')) || voices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Connect pseudo lip sync oscillation for browser TTS
    let timer: any = null;
    utterance.onstart = () => {
      // simulate speech level
      let val = 0.5;
      timer = setInterval(() => {
        val = 0.3 + Math.random() * 0.5;
      }, 100);
    };

    utterance.onend = () => {
      if (timer) clearInterval(timer);
      resolve();
    };

    utterance.onerror = () => {
      if (timer) clearInterval(timer);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

// Synthesize single sentence via selected provider
async function speakSentence(sentence: string, voiceSettings: VoiceSettings, onFallbackToast?: (msg: string) => void): Promise<void> {
  if (stopRequested) return;

  const provider = voiceSettings.provider;

  if (provider === 'gemini') {
    try {
      const res = await fetch('/api/tts/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(voiceSettings.geminiApiKey ? { 'x-gemini-key': voiceSettings.geminiApiKey } : {})
        },
        body: JSON.stringify({
          text: sentence,
          voiceName: voiceSettings.voiceId || 'Kore'
        })
      });

      if (!res.ok) throw new Error('Gemini TTS failed');
      const data = await res.json();
      if (!data.audioBase64) throw new Error('No audio returned');

      await playAudioBufferOrUrl(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      return;
    } catch (err: any) {
      console.warn('Gemini TTS error, falling back to browser TTS:', err);
      onFallbackToast?.('Gemini Voice mein issue hua, browser voice use kar rahe hain...');
      await speakWithBrowserTTS(sentence, voiceSettings);
      return;
    }
  }

  if (provider === 'elevenlabs') {
    try {
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sentence,
          voiceId: voiceSettings.voiceId || '21m00Tcm4TlvDq8ikWAM',
          apiKey: voiceSettings.elevenLabsApiKey,
          stability: voiceSettings.stability
        })
      });

      if (!res.ok) throw new Error('ElevenLabs TTS failed');
      const data = await res.json();
      await playAudioBufferOrUrl(`data:audio/mpeg;base64,${data.audioBase64}`);
      return;
    } catch (err: any) {
      console.warn('ElevenLabs TTS error, falling back to browser TTS:', err);
      onFallbackToast?.('ElevenLabs key issue, browser voice switch ho gaya!');
      await speakWithBrowserTTS(sentence, voiceSettings);
      return;
    }
  }

  if (provider === 'sarvam') {
    try {
      const res = await fetch('/api/tts/sarvam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sentence,
          speaker: voiceSettings.voiceId || 'meera',
          apiKey: voiceSettings.sarvamApiKey,
          languageCode: voiceSettings.language || 'hi-IN'
        })
      });

      if (!res.ok) throw new Error('Sarvam TTS failed');
      const data = await res.json();
      await playAudioBufferOrUrl(`data:audio/wav;base64,${data.audioBase64}`);
      return;
    } catch (err: any) {
      console.warn('Sarvam TTS error, falling back:', err);
      onFallbackToast?.('Sarvam AI error, switching to browser voice...');
      await speakWithBrowserTTS(sentence, voiceSettings);
      return;
    }
  }

  if (provider === 'webhook' && voiceSettings.webhookUrl) {
    try {
      const res = await fetch(voiceSettings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence })
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await playAudioBufferOrUrl(url);
      URL.revokeObjectURL(url);
      return;
    } catch (err: any) {
      console.warn('Webhook voice error:', err);
      await speakWithBrowserTTS(sentence, voiceSettings);
      return;
    }
  }

  // Default browser TTS
  await speakWithBrowserTTS(sentence, voiceSettings);
}

// Main Speak Function (Sentence streaming low-latency pipeline)
export async function speakText(
  text: string, 
  voiceSettings: VoiceSettings, 
  onStart?: () => void, 
  onEnd?: () => void,
  onFallbackToast?: (msg: string) => void
): Promise<void> {
  stopSpeaking();
  stopRequested = false;
  isCurrentlySpeaking = true;
  onStart?.();

  const sentences = splitSentences(text);
  for (const sentence of sentences) {
    if (stopRequested) break;
    await speakSentence(sentence, voiceSettings, onFallbackToast);
  }

  isCurrentlySpeaking = false;
  onEnd?.();
}
