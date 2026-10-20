import React, { useState, useEffect } from 'react';
import { NoteItem, ReminderItem } from '../types';
import { getNotes, saveNote, deleteNote, getReminders, deleteReminder } from '../services/db';
import { X, Plus, Trash2, Check, Clock, AlertCircle, Calendar } from 'lucide-react';

interface NotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const NotesDrawer: React.FC<NotesDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'reminders'>('notes');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  // New Note Form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  // New Timer/Reminder Form
  const [remTitle, setRemTitle] = useState('');
  const [remMinutes, setRemMinutes] = useState('10');
  const [showAddReminder, setShowAddReminder] = useState(false);

  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadData = async () => {
    const [n, r] = await Promise.all([getNotes(), getReminders()]);
    setNotes(n);
    setReminders(r);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Live timer tick for remaining seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const note: NoteItem = {
      id: 'note_' + Date.now(),
      title: newTitle.trim(),
      content: newContent.trim(),
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveNote(note);
    setNewTitle('');
    setNewContent('');
    setShowAddNote(false);
    loadData();
  };

  const handleToggleNote = async (note: NoteItem) => {
    const updated = { ...note, completed: !note.completed, updatedAt: Date.now() };
    await saveNote(updated);
    loadData();
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    loadData();
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    const mins = Math.max(1, parseInt(remMinutes, 10) || 5);
    const item: ReminderItem = {
      id: 'rem_' + Date.now(),
      title: remTitle.trim(),
      timestamp: Date.now() + mins * 60 * 1000,
      type: mins <= 60 ? 'timer' : 'reminder',
      completed: false,
      active: true
    };
    const { saveReminder } = await import('../services/db');
    await saveReminder(item);
    setRemTitle('');
    setShowAddReminder(false);
    loadData();
  };

  const handleDeleteReminder = async (id: string) => {
    await deleteReminder(id);
    loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-auto h-[80vh] flex flex-col rounded-t-3xl glass-dock shadow-2xl border-t border-white/10 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-900/60">
          {/* Tab buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'notes'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Notes & To-Do ({notes.length})
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'reminders'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timers & Alarms ({reminders.length})
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'notes' ? (
            <>
              {/* Add Note Button */}
              {!showAddNote ? (
                <button
                  onClick={() => setShowAddNote(true)}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-98"
                >
                  <Plus className="w-4 h-4" /> Naya Note / Task banayein
                </button>
              ) : (
                <form onSubmit={handleCreateNote} className="p-3 rounded-2xl glass-panel space-y-2 border border-amber-500/30">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Note Title / Task..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Details or notes (optional)..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddNote(false)}
                      className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle.trim()}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 disabled:opacity-50"
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              )}

              {/* Notes List */}
              {notes.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Koi notes nahi hain. MONA ko bole: "Mera note save karo..."
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`flex items-start justify-between p-3 rounded-2xl glass-panel border transition ${
                      note.completed ? 'border-white/5 opacity-60' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 pr-2">
                      <button
                        onClick={() => handleToggleNote(note)}
                        className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                          note.completed
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-500 hover:border-amber-400'
                        }`}
                      >
                        {note.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div>
                        <h4 className={`text-sm font-medium ${note.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                          {note.title}
                        </h4>
                        {note.content && (
                          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{note.content}</p>
                        )}
                        <span className="text-[10px] text-slate-500 block mt-1">
                          {new Date(note.updatedAt).toLocaleDateString()} {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {/* Add Timer / Reminder Button */}
              {!showAddReminder ? (
                <button
                  onClick={() => setShowAddReminder(true)}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-98"
                >
                  <Plus className="w-4 h-4" /> Naya Timer ya Wake Reminder lagayein
                </button>
              ) : (
                <form onSubmit={handleCreateReminder} className="p-3 rounded-2xl glass-panel space-y-2 border border-cyan-500/30">
                  <input
                    type="text"
                    value={remTitle}
                    onChange={(e) => setRemTitle(e.target.value)}
                    placeholder="Reminder label (e.g. Chai, Meeting, Medicine)..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Minutes:</span>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={remMinutes}
                      onChange={(e) => setRemMinutes(e.target.value)}
                      className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddReminder(false)}
                      className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!remTitle.trim()}
                      className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 disabled:opacity-50"
                    >
                      Set Timer
                    </button>
                  </div>
                </form>
              )}

              {/* Reminders list */}
              {reminders.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Koi active timers nahi hain. MONA ko bole: "5 minute ka timer lagao"
                </div>
              ) : (
                reminders.map((rem) => {
                  const remainingMs = rem.timestamp - currentTime;
                  const isExpired = remainingMs <= 0;
                  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
                  const mins = Math.floor(remainingSec / 60);
                  const secs = remainingSec % 60;

                  return (
                    <div
                      key={rem.id}
                      className={`flex items-center justify-between p-3 rounded-2xl glass-panel border ${
                        isExpired ? 'border-red-500/30 bg-red-950/20' : 'border-cyan-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isExpired ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                        }`}>
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white">{rem.title}</h4>
                          <span className={`text-xs font-semibold ${isExpired ? 'text-red-400' : 'text-cyan-400'}`}>
                            {isExpired ? '🔔 Time Completed!' : `Remaining: ${mins}m ${secs < 10 ? '0' : ''}${secs}s`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
