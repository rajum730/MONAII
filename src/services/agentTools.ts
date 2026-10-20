import { getContacts, saveNote, saveReminder, saveMemory, getAutomations } from './db';
import { ToolActionPending } from '../types';

let activeTorchTrack: MediaStreamTrack | null = null;
let activeTorchStream: MediaStream | null = null;

// Sound synthesis for timer alarm chime using Web Audio API
export function playChimeSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.3); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.4); // D6

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
  } catch (e) {
    console.warn('Could not play chime:', e);
  }
}

// Resolve contact name or return phone
export async function resolvePhoneContact(nameOrNumber: string): Promise<{ name: string; phone: string }> {
  const contacts = await getContacts();
  const clean = nameOrNumber.toLowerCase().trim();

  const found = contacts.find(c => 
    c.name.toLowerCase().includes(clean) || 
    clean.includes(c.name.toLowerCase()) ||
    (c.relationship && c.relationship.toLowerCase().includes(clean))
  );

  if (found) {
    return { name: found.name, phone: found.phone };
  }

  // If already a phone number or fallback
  const digits = nameOrNumber.replace(/[^0-9+]/g, '');
  return { name: nameOrNumber, phone: digits || nameOrNumber };
}

// Clean phone number for WhatsApp wa.me link
function formatWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    // Default to India country code 91 if 10 digits
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

// Handle flashlight / torch
export async function toggleTorch(enabled: boolean): Promise<boolean> {
  try {
    if (!enabled) {
      if (activeTorchTrack) {
        activeTorchTrack.stop();
        activeTorchTrack = null;
      }
      if (activeTorchStream) {
        activeTorchStream.getTracks().forEach(t => t.stop());
        activeTorchStream = null;
      }
      return true;
    }

    if (!activeTorchStream) {
      activeTorchStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
    }

    const track = activeTorchStream.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && capabilities.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: true }]
        });
        activeTorchTrack = track;
        return true;
      } else {
        throw new Error('Device torch not supported by browser');
      }
    }
    return false;
  } catch (e) {
    console.warn('Torch error:', e);
    return false;
  }
}

// Device Status
export async function getDeviceInfo(): Promise<{
  battery?: number;
  charging?: boolean;
  online: boolean;
  time: string;
}> {
  let batteryLevel: number | undefined;
  let isCharging: boolean | undefined;

  if ('getBattery' in navigator) {
    try {
      const battery: any = await (navigator as any).getBattery();
      batteryLevel = Math.round(battery.level * 100);
      isCharging = battery.charging;
    } catch {
      // ignore
    }
  }

  return {
    battery: batteryLevel,
    charging: isCharging,
    online: navigator.onLine,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };
}

// Share text
export async function shareText(title: string, text: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Copy to clipboard
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Execute Agent Function Call
export async function executeAgentFunctionCall(
  name: string,
  args: any,
  onPendingConfirmation: (action: ToolActionPending) => void,
  onNotifyToast: (msg: string) => void
): Promise<{ resultText?: string }> {
  try {
    switch (name) {
      case 'make_phone_call': {
        const contact = await resolvePhoneContact(args.nameOrNumber);
        const actionUrl = `tel:${contact.phone}`;
        // Ask for confirmation before calling
        onPendingConfirmation({
          id: 'call_' + Date.now(),
          type: 'call',
          title: `Call ${contact.name}`,
          target: contact.phone,
          body: args.reason,
          actionUrl
        });
        return { resultText: `Main ${contact.name} ko call lagane ke liye confirmation screen open kar rahi hoon!` };
      }

      case 'send_sms': {
        const contact = await resolvePhoneContact(args.nameOrNumber);
        const actionUrl = `sms:${contact.phone}?body=${encodeURIComponent(args.message)}`;
        onPendingConfirmation({
          id: 'sms_' + Date.now(),
          type: 'sms',
          title: `Send SMS to ${contact.name}`,
          target: contact.phone,
          body: args.message,
          actionUrl
        });
        return { resultText: `${contact.name} ko SMS bhejne ka draft ready hai. Tap karke send kar lijiye!` };
      }

      case 'send_whatsapp': {
        const contact = await resolvePhoneContact(args.nameOrNumber);
        const cleanNumber = formatWhatsAppNumber(contact.phone);
        const actionUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(args.message)}`;
        onPendingConfirmation({
          id: 'wa_' + Date.now(),
          type: 'whatsapp',
          title: `WhatsApp to ${contact.name}`,
          target: contact.phone,
          body: args.message,
          actionUrl
        });
        return { resultText: `${contact.name} ke liye WhatsApp message ready hai. Bhej doon?` };
      }

      case 'send_email': {
        const actionUrl = `mailto:${args.to}?subject=${encodeURIComponent(args.subject || '')}&body=${encodeURIComponent(args.body || '')}`;
        window.location.href = actionUrl;
        return { resultText: `Email composer open ho gaya hai ${args.to} ke liye.` };
      }

      case 'open_maps': {
        const query = encodeURIComponent(args.query);
        const url = args.navigate
          ? `https://www.google.com/maps/dir/?api=1&destination=${query}`
          : `https://www.google.com/maps/search/?api=1&query=${query}`;
        window.open(url, '_blank');
        return { resultText: `Google Maps mein ${args.query} open kar diya!` };
      }

      case 'search_youtube': {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
        window.open(url, '_blank');
        return { resultText: `YouTube par ${args.query} play kar rahi hoon!` };
      }

      case 'open_website': {
        let url = args.url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          if (url.includes('.') && !url.includes(' ')) {
            url = 'https://' + url;
          } else {
            url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
          }
        }
        window.open(url, '_blank');
        return { resultText: `Website open kar di: ${url}` };
      }

      case 'set_timer': {
        const seconds = Number(args.seconds) || 60;
        const label = args.label || 'Timer';
        const targetTime = Date.now() + seconds * 1000;
        await saveReminder({
          id: 'timer_' + Date.now(),
          title: label,
          timestamp: targetTime,
          type: 'timer',
          durationSeconds: seconds,
          completed: false,
          active: true
        });

        // Request notification permission if needed
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        const mins = Math.floor(seconds / 60);
        const remainingSecs = seconds % 60;
        const timeStr = mins > 0 ? `${mins} minute${remainingSecs ? ` ${remainingSecs} second` : ''}` : `${seconds} second`;
        onNotifyToast(`Timer set: ${timeStr} for ${label}`);
        return { resultText: `Maine ${timeStr} ka "${label}" timer set kar diya hai!` };
      }

      case 'set_reminder': {
        const mins = Number(args.minutesFromNow) || 15;
        const title = args.title || 'Reminder';
        const targetTime = Date.now() + mins * 60 * 1000;
        await saveReminder({
          id: 'rem_' + Date.now(),
          title,
          timestamp: targetTime,
          type: 'reminder',
          completed: false,
          active: true
        });

        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        onNotifyToast(`Reminder set for: ${title}`);
        return { resultText: `Maine yaad rakh liya! ${mins} minute baad main aapko "${title}" yaad dila dungi.` };
      }

      case 'create_note': {
        await saveNote({
          id: 'note_' + Date.now(),
          title: args.title || 'Quick Note',
          content: args.content || '',
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        onNotifyToast(`Note saved: ${args.title}`);
        return { resultText: `Note save ho gaya: "${args.title}". Notes screen par dekh sakte hain!` };
      }

      case 'save_memory': {
        await saveMemory({
          id: 'mem_' + Date.now(),
          fact: args.fact,
          category: (args.category as any) || 'general',
          timestamp: Date.now()
        });
        onNotifyToast(`Saved to memory!`);
        return { resultText: `Maine ye hamesha ke liye yaad rakh liya!` };
      }

      case 'toggle_flashlight': {
        const enabled = Boolean(args.enabled);
        const success = await toggleTorch(enabled);
        if (success) {
          return { resultText: enabled ? 'Flashlight ON ho gayi!' : 'Flashlight OFF kar di.' };
        } else {
          return { resultText: 'Flashlight toggle karne mein problem aayi, device check kijiye.' };
        }
      }

      case 'trigger_automation': {
        const automations = await getAutomations();
        const kw = (args.keyword || '').toLowerCase().trim();
        const match = automations.find(a => kw.includes(a.keyword.toLowerCase()) || a.keyword.toLowerCase().includes(kw));
        if (match) {
          try {
            const res = await fetch('/api/webhook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                webhookUrl: match.webhookUrl,
                payload: { command: kw, timestamp: Date.now() }
              })
            });
            const data = await res.json();
            return { resultText: `Automation command "${match.keyword}" execute ho gaya!` };
          } catch (e: any) {
            return { resultText: `Automation webhook fail ho gaya: ${e.message}` };
          }
        } else {
          return { resultText: `Koi automation command match nahi hua "${args.keyword}" ke liye. Settings mein add kar sakte hain.` };
        }
      }

      default:
        return {};
    }
  } catch (error: any) {
    console.error('Error executing agent function:', error);
    return { resultText: `Action execute nahi ho saka: ${error.message}` };
  }
}
