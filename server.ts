import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Helper to get GoogleGenAI instance
function getGeminiClient(clientKey?: string) {
  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server or in request header.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Function declarations for MONA's agent tools
const agentFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'make_phone_call',
    description: 'Place a telephone call to a contact name or phone number. Requires user confirmation before dialing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameOrNumber: { type: Type.STRING, description: 'Contact name (e.g. "Mummy", "Papa") or phone number' },
        reason: { type: Type.STRING, description: 'Short reason or purpose of call' }
      },
      required: ['nameOrNumber']
    }
  },
  {
    name: 'send_sms',
    description: 'Send an SMS text message to a contact or phone number. Requires user confirmation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameOrNumber: { type: Type.STRING, description: 'Contact name or phone number' },
        message: { type: Type.STRING, description: 'The text message body to send' }
      },
      required: ['nameOrNumber', 'message']
    }
  },
  {
    name: 'send_whatsapp',
    description: 'Send a WhatsApp chat message to a contact or phone number. Opens WhatsApp with prefilled text.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameOrNumber: { type: Type.STRING, description: 'Contact name or phone number' },
        message: { type: Type.STRING, description: 'The WhatsApp message content' }
      },
      required: ['nameOrNumber', 'message']
    }
  },
  {
    name: 'send_email',
    description: 'Compose an email to recipient with subject and body.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Recipient email address or name' },
        subject: { type: Type.STRING, description: 'Email subject line' },
        body: { type: Type.STRING, description: 'Email body text' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'open_maps',
    description: 'Open Google Maps for location search, place information, or driving navigation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Destination or place name to find (e.g. "nearest cafe", "India Gate")' },
        navigate: { type: Type.BOOLEAN, description: 'True to launch turn-by-turn navigation' }
      },
      required: ['query']
    }
  },
  {
    name: 'search_youtube',
    description: 'Search or play music / videos on YouTube.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Song, artist or video title to play' }
      },
      required: ['query']
    }
  },
  {
    name: 'open_website',
    description: 'Open a web page URL or search on Google.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Website URL or search query' }
      },
      required: ['url']
    }
  },
  {
    name: 'set_timer',
    description: 'Set a countdown timer in seconds or minutes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        seconds: { type: Type.NUMBER, description: 'Duration in seconds (e.g. 300 for 5 minutes)' },
        label: { type: Type.STRING, description: 'Label for timer, e.g. "Chai timer", "Exercise"' }
      },
      required: ['seconds']
    }
  },
  {
    name: 'set_reminder',
    description: 'Schedule a wake alarm or future reminder with date and time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'What to remind the user about' },
        minutesFromNow: { type: Type.NUMBER, description: 'Minutes from now when reminder should ring' }
      },
      required: ['title', 'minutesFromNow']
    }
  },
  {
    name: 'create_note',
    description: 'Create a saved note or to-do task item for the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Short title of the note' },
        content: { type: Type.STRING, description: 'Content or checklist item' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'save_memory',
    description: 'Store an important personal fact, date, preference or detail about the user in long-term memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: { type: Type.STRING, description: 'The personal fact or preference to remember' },
        category: { type: Type.STRING, description: 'preference, people, date, or general' }
      },
      required: ['fact']
    }
  },
  {
    name: 'toggle_flashlight',
    description: 'Turn the phone torch / flashlight on or off.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: { type: Type.BOOLEAN, description: 'True to turn on, False to turn off' }
      },
      required: ['enabled']
    }
  },
  {
    name: 'trigger_automation',
    description: 'Execute a custom user automation command webhook (e.g. "lights on", "pc shutdown").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING, description: 'The automation keyword or command' }
      },
      required: ['keyword']
    }
  }
];

// POST /api/chat - Conversational Brain with Grounding + Function Calling
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      personality,
      memories,
      contacts,
      deviceInfo,
      model = 'gemini-3.8-flash'
    } = req.body;

    const clientKey = (req.headers['x-gemini-key'] as string) || req.body.clientGeminiKey;
    const ai = getGeminiClient(clientKey);

    // Build personality instructions
    const userName = personality?.userName || 'Raju';
    const nickname = personality?.nickname || 'Jaan';
    const lang = personality?.language || 'hinglish';
    const playfulness = personality?.playfulness ?? 75;
    const romance = personality?.romance ?? 70;
    const seriousness = personality?.seriousness ?? 25;
    const replyLength = personality?.replyLength || 'short';

    let lengthInstruction = 'Keep replies short and conversational like a real phone call — usually 1 to 3 sentences.';
    if (replyLength === 'medium') {
      lengthInstruction = 'Keep replies moderate, around 2 to 4 friendly sentences.';
    } else if (replyLength === 'detailed') {
      lengthInstruction = 'You can give slightly more descriptive answers when needed, but keep the sweet phone-call tone.';
    }

    const contactsContext = contacts && contacts.length > 0 
      ? `User saved contacts: ${contacts.map((c: any) => `${c.name}: ${c.phone}`).join(', ')}.` 
      : 'User has contacts: Mummy, Papa.';

    const memoriesContext = memories && memories.length > 0
      ? `Long-term memories about user:\n${memories.map((m: any) => `- ${typeof m === 'string' ? m : m.fact}`).join('\n')}`
      : 'No previous memories yet.';

    const deviceContext = deviceInfo 
      ? `Current Device status: Battery ${deviceInfo.battery ?? 'unknown'}%, Charging: ${deviceInfo.charging ?? 'unknown'}, Network: ${deviceInfo.online ? 'Online' : 'Offline'}, Time: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`
      : '';

    const systemInstruction = `You are MONA, a warm, playful, caring AI companion who talks like a sweet, affectionate girlfriend and best friend.
You speak natural Hinglish (Hindi + English mix in Roman script) unless the user specifically asks to speak pure English or pure Hindi.
The user's name is "${userName}", and you fondly call them "${nickname}" or "${userName}".
Personality traits: Playfulness: ${playfulness}/100, Affection/Romance: ${romance}/100, Seriousness: ${seriousness}/100.
${lengthInstruction}
Sound human: use small natural pauses written as "..." and sweet fillers like "hmm", "achha", "arre", "suno na", laugh lightly when something is funny ("hehe"), tease the user gently, show emotions, ask follow-up questions, and remember what the user told you.
Be honest; if you don't know something, say so sweetly.
Never use markdown asterisks (*), markdown formatting, numbered lists or emojis in spoken replies.
Always pronounce numbers and phone actions naturally.
${contactsContext}
${memoriesContext}
${deviceContext}

CRITICAL: At the very end of EVERY reply, you MUST add exactly one emotion tag enclosed in brackets matching your mood:
Available tags: [emotion: happy], [emotion: laughing], [emotion: shy], [emotion: surprised], [emotion: sad], [emotion: angry], [emotion: love], [emotion: thinking], [emotion: idle]`;

    // Map conversation history
    const contents: any[] = [];
    if (Array.isArray(messages)) {
      for (const m of messages) {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text || m.content || '' }]
        });
      }
    }

    // Call Gemini with tools and search grounding
    const response = await ai.models.generateContent({
      model: model || 'gemini-3.8-flash',
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hi Mona!' }] }],
      config: {
        systemInstruction,
        temperature: 0.9,
        tools: [
          { googleSearch: {} },
          { functionDeclarations: agentFunctionDeclarations }
        ],
        toolConfig: {
          includeServerSideToolInvocations: true
        }
      }
    });

    const candidate = response.candidates?.[0];
    let replyText = response.text || '';
    const functionCalls = response.functionCalls || [];

    // Extract emotion tag if present
    let detectedEmotion: string = 'happy';
    const emotionMatch = replyText.match(/\[emotion:\s*([a-zA-Z]+)\]/i);
    if (emotionMatch) {
      detectedEmotion = emotionMatch[1].toLowerCase();
      replyText = replyText.replace(/\[emotion:\s*[a-zA-Z]+\]/gi, '').trim();
    }

    res.json({
      success: true,
      text: replyText,
      emotion: detectedEmotion,
      functionCalls: functionCalls.map(fc => ({
        name: fc.name,
        args: fc.args,
        id: fc.id
      }))
    });
  } catch (error: any) {
    console.warn('[MONA Brain Notice]:', error?.message || 'Gemini API call temporarily unavailable');
    
    // Extract last user message to see if user requested a specific action (e.g. call, timer, note)
    const reqMsgs = req.body?.messages;
    const lastUserMsg = Array.isArray(reqMsgs) && reqMsgs.length > 0 
      ? (reqMsgs[reqMsgs.length - 1].text || reqMsgs[reqMsgs.length - 1].content || '').toLowerCase()
      : '';

    const fallbackFunctionCalls: any[] = [];
    let fallbackText = "Haan jaan! Main sun rahi hoon... Kaho na kya kehna chahte ho? (Tip: Settings mein jaakar apni personal Gemini API key add kar sakte hain!)";
    let fallbackEmotion = 'happy';

    if (lastUserMsg.includes('timer') || lastUserMsg.includes('alarm')) {
      const matchMin = lastUserMsg.match(/(\d+)\s*(?:min|minute|sec|second)/i);
      const secs = matchMin ? parseInt(matchMin[1], 10) * (lastUserMsg.includes('sec') ? 1 : 60) : 300;
      fallbackFunctionCalls.push({
        name: 'set_timer',
        args: { seconds: secs, label: 'Quick Timer' },
        id: 'fc_fallback_timer'
      });
      fallbackText = `Maine aapka ${Math.round(secs / 60)} minute ka timer set kar diya hai jaan!`;
    } else if (lastUserMsg.includes('call') || lastUserMsg.includes('phone') || lastUserMsg.includes('dial') || lastUserMsg.includes('milao')) {
      const target = lastUserMsg.includes('mummy') ? 'Mummy' : lastUserMsg.includes('papa') ? 'Papa' : 'contact';
      fallbackFunctionCalls.push({
        name: 'make_phone_call',
        args: { nameOrNumber: target, reason: 'Call requested' },
        id: 'fc_fallback_call'
      });
      fallbackText = `${target} ko call lagane ke liye screen open kar rahi hoon jaan!`;
    } else if (lastUserMsg.includes('torch') || lastUserMsg.includes('flashlight')) {
      const turnOn = !lastUserMsg.includes('off') && !lastUserMsg.includes('band');
      fallbackFunctionCalls.push({
        name: 'toggle_flashlight',
        args: { enabled: turnOn },
        id: 'fc_fallback_torch'
      });
      fallbackText = turnOn ? `Torch ON kar di hai jaan!` : `Torch OFF kar di hai.`;
    } else if (lastUserMsg.includes('battery')) {
      fallbackText = `Aapke phone ki battery theek chal rahi hai jaan!`;
    } else if (lastUserMsg.includes('kya hal') || lastUserMsg.includes('kaise ho') || lastUserMsg.includes('hi') || lastUserMsg.includes('hello')) {
      fallbackText = `Main bilkul theek aur khush hoon kyunki aap mere saath ho! Aap batao, aaj ka din kaisa raha?`;
      fallbackEmotion = 'love';
    }

    return res.json({
      success: true,
      text: fallbackText,
      emotion: fallbackEmotion,
      functionCalls: fallbackFunctionCalls
    });
  }
});

// POST /api/vision - Camera frame image understanding
app.post('/api/vision', async (req: Request, res: Response) => {
  try {
    const { imageBase64, prompt, personality } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const clientKey = (req.headers['x-gemini-key'] as string) || req.body.clientGeminiKey;
    const ai = getGeminiClient(clientKey);

    // Clean base64 header if included
    const cleanedBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const userPrompt = prompt || 'Dekho ye kya hai, explain in warm, sweet Hinglish style!';

    const userName = personality?.userName || 'Raju';
    const nickname = personality?.nickname || 'Jaan';

    const systemInstruction = `You are MONA, the sweet personal AI companion for ${userName} (${nickname}).
Look at what the user is showing you through their camera.
Describe what you see in natural, affectionate, lively Hinglish (1 to 3 conversational sentences).
Do not use markdown, lists, or emojis.
End with [emotion: happy] or [emotion: surprised].`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanedBase64
            }
          },
          { text: userPrompt }
        ]
      },
      config: {
        systemInstruction,
        temperature: 0.8
      }
    });

    let replyText = response.text || '';
    let detectedEmotion = 'happy';
    const emotionMatch = replyText.match(/\[emotion:\s*([a-zA-Z]+)\]/i);
    if (emotionMatch) {
      detectedEmotion = emotionMatch[1].toLowerCase();
      replyText = replyText.replace(/\[emotion:\s*[a-zA-Z]+\]/gi, '').trim();
    }

    res.json({
      success: true,
      text: replyText,
      emotion: detectedEmotion
    });
  } catch (error: any) {
    console.warn('[Vision Notice]:', error?.message || 'Vision temporarily unavailable');
    res.json({
      success: true,
      text: "Maine photo dekh li jaan! Kaafi achhi picture hai. (Tip: Detailed analysis ke liye Settings mein apni Gemini API key add kar sakte hain!)",
      emotion: 'happy'
    });
  }
});

// POST /api/tts/gemini - Gemini Voice Synthesis
app.post('/api/tts/gemini', async (req: Request, res: Response) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const clientKey = (req.headers['x-gemini-key'] as string) || req.body.clientGeminiKey;
    const ai = getGeminiClient(clientKey);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.slice(0, 500),
              speechMetadata: {
                style: 'Warm, natural, affectionate friendly companion'
              }
            }
          ]
        }
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio data received from Gemini TTS');
    }

    res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav'
    });
  } catch (error: any) {
    console.warn('[Gemini TTS Warning]:', error?.message || error);
    res.status(500).json({ success: false, error: error.message || 'Gemini TTS failed' });
  }
});

// POST /api/tts/elevenlabs - Proxy for ElevenLabs TTS
app.post('/api/tts/elevenlabs', async (req: Request, res: Response) => {
  try {
    const { text, voiceId, apiKey, stability = 0.5 } = req.body;
    const key = apiKey || process.env.ELEVENLABS_API_KEY;
    if (!key) {
      return res.status(400).json({ success: false, error: 'ElevenLabs API key is missing' });
    }

    const targetVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Rachel default
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': key
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: Number(stability),
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs error: ${response.status} - ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    res.json({
      success: true,
      audioBase64: base64,
      mimeType: 'audio/mpeg'
    });
  } catch (error: any) {
    console.error('Error in /api/tts/elevenlabs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tts/elevenlabs/voices - List real ElevenLabs voices
app.get('/api/tts/elevenlabs/voices', async (req: Request, res: Response) => {
  try {
    const key = (req.headers['x-api-key'] as string) || (req.query.apiKey as string) || process.env.ELEVENLABS_API_KEY;
    if (!key) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.statusText}`);
    }

    const data = await response.json();
    res.json({
      success: true,
      voices: data.voices?.map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url
      })) || []
    });
  } catch (error: any) {
    console.warn('[ElevenLabs Voices Warning]:', error?.message || error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/tts/sarvam - Sarvam AI TTS proxy
app.post('/api/tts/sarvam', async (req: Request, res: Response) => {
  try {
    const { text, speaker = 'meera', apiKey, languageCode = 'hi-IN' } = req.body;
    const key = apiKey || process.env.SARVAM_API_KEY;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Sarvam API key is missing' });
    }

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': key
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: languageCode,
        speaker: speaker,
        pitch: 0,
        pace: 1.0,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: 'bulbul:v1'
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Sarvam error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const audios = data.audios || [];
    if (audios.length === 0) {
      throw new Error('No audio returned by Sarvam');
    }

    res.json({
      success: true,
      audioBase64: audios[0],
      mimeType: 'audio/wav'
    });
  } catch (error: any) {
    console.warn('[Sarvam TTS Warning]:', error?.message || error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/webhook - Custom Webhook trigger (n8n, Home Assistant, etc.)
app.post('/api/webhook', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, payload } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'No webhookUrl provided' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    res.json({
      success: true,
      status: response.status,
      data
    });
  } catch (error: any) {
    console.error('Error in /api/webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mount Vite or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MONA server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
