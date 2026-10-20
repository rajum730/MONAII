import { stopSpeaking, isSpeaking } from './tts';

export interface STTCallbacks {
  onInterimResult: (text: string) => void;
  onFinalResult: (text: string) => void;
  onWakeWordDetected?: () => void;
  onError: (error: string) => void;
  onStart: () => void;
  onEnd: () => void;
}

let recognitionInstance: any = null;
let micAudioStream: MediaStream | null = null;
let micAudioContext: AudioContext | null = null;
let micAnalyser: AnalyserNode | null = null;
let isListeningActive = false;
let isHandsFreeMode = false;
let wakeWord = 'hey mona';

// Mic level measurement for glowing audio ring around mic button
export function getMicAudioLevel(): number {
  if (!micAnalyser || !isListeningActive) return 0;
  const data = new Uint8Array(micAnalyser.frequencyBinCount);
  micAnalyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  const avg = sum / data.length;
  return Math.min(1, (avg / 128) * 1.6);
}

// Start Mic audio analyzer for visualizer
async function startMicVisualizer(): Promise<void> {
  try {
    if (!micAudioStream) {
      micAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    if (!micAudioContext || micAudioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      micAudioContext = new AudioCtx();
    }
    if (micAudioContext.state === 'suspended') {
      await micAudioContext.resume();
    }
    if (!micAnalyser) {
      micAnalyser = micAudioContext.createAnalyser();
      micAnalyser.fftSize = 128;
      micAnalyser.smoothingTimeConstant = 0.5;
      const source = micAudioContext.createMediaStreamSource(micAudioStream);
      source.connect(micAnalyser);
    }
  } catch (e) {
    console.warn('Could not initialize mic visualizer:', e);
  }
}

export function stopMicVisualizer(): void {
  if (micAudioStream) {
    micAudioStream.getTracks().forEach(t => t.stop());
    micAudioStream = null;
  }
  if (micAudioContext && micAudioContext.state !== 'closed') {
    micAudioContext.close().catch(() => {});
    micAudioContext = null;
  }
  micAnalyser = null;
}

export function checkSpeechRecognitionSupport(): boolean {
  return typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

export function startListening(
  options: {
    handsFree?: boolean;
    language?: string;
    customWakeWord?: string;
  },
  callbacks: STTCallbacks
): boolean {
  if (!checkSpeechRecognitionSupport()) {
    callbacks.onError('Aapke browser mein Web Speech API support nahi hai. Chrome on Android use kijiye.');
    return false;
  }

  isHandsFreeMode = !!options.handsFree;
  wakeWord = (options.customWakeWord || 'hey mona').toLowerCase().trim();

  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  try {
    if (recognitionInstance) {
      try {
        recognitionInstance.abort();
      } catch {
        // ignore
      }
    }

    recognitionInstance = new SpeechRecognitionClass();
    recognitionInstance.continuous = isHandsFreeMode;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = options.language || 'hi-IN'; // hi-IN handles Hinglish naturally on Android Chrome!

    recognitionInstance.onstart = () => {
      isListeningActive = true;
      startMicVisualizer();
      callbacks.onStart();
    };

    recognitionInstance.onresult = (event: any) => {
      // Barge-in check: if MONA is speaking and user speaks, stop MONA immediately!
      if (isSpeaking()) {
        stopSpeaking();
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();

      if (isHandsFreeMode) {
        // Check for wake word in hands-free mode
        const lower = activeText.toLowerCase();
        if (lower.includes(wakeWord) || lower.includes('mona') || lower.includes('suno mona')) {
          callbacks.onWakeWordDetected?.();
          // Extract message after wake word
          const wakeRegex = new RegExp(`.*?(?:${wakeWord}|mona|suno mona)[,\\s]*`, 'i');
          const commandAfterWake = activeText.replace(wakeRegex, '').trim();
          if (finalTranscript && commandAfterWake) {
            callbacks.onFinalResult(commandAfterWake);
          } else {
            callbacks.onInterimResult(commandAfterWake || 'Listening to you...');
          }
        } else {
          callbacks.onInterimResult(activeText);
        }
      } else {
        // Tap to talk mode
        if (interimTranscript) {
          callbacks.onInterimResult(interimTranscript);
        }
        if (finalTranscript) {
          callbacks.onFinalResult(finalTranscript);
        }
      }
    };

    recognitionInstance.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        callbacks.onError('Microphone permission blocked hai. Browser bar se allow kijiye.');
      } else if (event.error !== 'no-speech') {
        callbacks.onError(`Mic error: ${event.error}`);
      }
    };

    recognitionInstance.onend = () => {
      isListeningActive = false;
      callbacks.onEnd();

      // If continuous hands-free, restart
      if (isHandsFreeMode && recognitionInstance) {
        try {
          recognitionInstance.start();
        } catch {
          // ignore
        }
      }
    };

    recognitionInstance.start();
    return true;
  } catch (err: any) {
    console.error('Failed to start speech recognition:', err);
    callbacks.onError('Microphone start nahi ho saka: ' + (err.message || err));
    return false;
  }
}

export function stopListening(): void {
  isHandsFreeMode = false;
  isListeningActive = false;
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch {
      // ignore
    }
    recognitionInstance = null;
  }
  stopMicVisualizer();
}

export function isListening(): boolean {
  return isListeningActive;
}
