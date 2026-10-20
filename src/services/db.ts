import { Contact, NoteItem, ReminderItem, MemoryItem, AutomationCommand, ChatMessage } from '../types';

const DB_NAME = 'mona_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store 3D model
      if (!db.objectStoreNames.contains('avatarModel')) {
        db.createObjectStore('avatarModel', { keyPath: 'id' });
      }

      // Store Contacts
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }

      // Store Notes & Tasks
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }

      // Store Reminders
      if (!db.objectStoreNames.contains('reminders')) {
        db.createObjectStore('reminders', { keyPath: 'id' });
      }

      // Store Long Term Memories
      if (!db.objectStoreNames.contains('memories')) {
        db.createObjectStore('memories', { keyPath: 'id' });
      }

      // Store Chat History
      if (!db.objectStoreNames.contains('chat_history')) {
        db.createObjectStore('chat_history', { keyPath: 'id' });
      }

      // Store Automations
      if (!db.objectStoreNames.contains('automations')) {
        db.createObjectStore('automations', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Model Storage
export async function saveModelFile(file: File): Promise<string> {
  const db = await getDB();
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('avatarModel', 'readwrite');
    const store = tx.objectStore('avatarModel');
    const req = store.put({
      id: 'current_model',
      name: file.name,
      type: file.type,
      size: file.size,
      data: buffer,
      updatedAt: Date.now()
    });
    req.onsuccess = () => resolve(file.name);
    req.onerror = () => reject(req.error);
  });
}

export async function getModelFile(): Promise<{ name: string; data: ArrayBuffer } | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('avatarModel', 'readonly');
    const store = tx.objectStore('avatarModel');
    const req = store.get('current_model');
    req.onsuccess = () => {
      if (req.result && req.result.data) {
        resolve({ name: req.result.name, data: req.result.data });
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeModelFile(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('avatarModel', 'readwrite');
    const store = tx.objectStore('avatarModel');
    const req = store.delete('current_model');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Contacts
export async function getContacts(): Promise<Contact[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readonly');
    const store = tx.objectStore('contacts');
    const req = store.getAll();
    req.onsuccess = () => {
      const contacts: Contact[] = req.result || [];
      if (contacts.length === 0) {
        // Seed default friendly contacts
        const defaults: Contact[] = [
          { id: '1', name: 'Mummy', phone: '+919876543210', relationship: 'Mother' },
          { id: '2', name: 'Papa', phone: '+919876543211', relationship: 'Father' },
          { id: '3', name: 'Best Friend', phone: '+919876543212', relationship: 'Friend' },
        ];
        defaults.forEach(c => saveContact(c));
        resolve(defaults);
      } else {
        resolve(contacts);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveContact(contact: Contact): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');
    const req = store.put(contact);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Notes & To-Do
export async function getNotes(): Promise<NoteItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    const req = store.getAll();
    req.onsuccess = () => {
      const notes: NoteItem[] = req.result || [];
      notes.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(notes);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveNote(note: NoteItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    const req = store.put(note);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Reminders & Timers
export async function getReminders(): Promise<ReminderItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readonly');
    const store = tx.objectStore('reminders');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReminder(item: ReminderItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Long-Term Memories
export async function getMemories(): Promise<MemoryItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('memories', 'readonly');
    const store = tx.objectStore('memories');
    const req = store.getAll();
    req.onsuccess = () => {
      const mems: MemoryItem[] = req.result || [];
      mems.sort((a, b) => b.timestamp - a.timestamp);
      resolve(mems);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveMemory(item: MemoryItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('memories', 'readwrite');
    const store = tx.objectStore('memories');
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('memories', 'readwrite');
    const store = tx.objectStore('memories');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Chat History
export async function getChatHistory(): Promise<ChatMessage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat_history', 'readonly');
    const store = tx.objectStore('chat_history');
    const req = store.getAll();
    req.onsuccess = () => {
      const list: ChatMessage[] = req.result || [];
      list.sort((a, b) => a.timestamp - b.timestamp);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat_history', 'readwrite');
    const store = tx.objectStore('chat_history');
    const req = store.put(msg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearChatHistory(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chat_history', 'readwrite');
    const store = tx.objectStore('chat_history');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Automations
export async function getAutomations(): Promise<AutomationCommand[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('automations', 'readonly');
    const store = tx.objectStore('automations');
    const req = store.getAll();
    req.onsuccess = () => {
      const list: AutomationCommand[] = req.result || [];
      if (list.length === 0) {
        const defaults: AutomationCommand[] = [
          { id: '1', keyword: 'lights on', webhookUrl: 'https://httpbin.org/post', description: 'Turn on room ambient lights via home automation' },
          { id: '2', keyword: 'pc shutdown', webhookUrl: 'https://httpbin.org/post', description: 'Trigger remote PC shutdown' }
        ];
        defaults.forEach(a => saveAutomation(a));
        resolve(defaults);
      } else {
        resolve(list);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveAutomation(item: AutomationCommand): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('automations', 'readwrite');
    const store = tx.objectStore('automations');
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAutomation(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('automations', 'readwrite');
    const store = tx.objectStore('automations');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
