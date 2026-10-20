import React from 'react';
import { ToolActionPending } from '../types';
import { Phone, MessageSquare, Send, X, Check } from 'lucide-react';

interface ActionConfirmModalProps {
  action: ToolActionPending | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ActionConfirmModal: React.FC<ActionConfirmModalProps> = ({
  action,
  onConfirm,
  onCancel
}) => {
  if (!action) return null;

  const isCall = action.type === 'call';
  const isWhatsApp = action.type === 'whatsapp';
  const isSMS = action.type === 'sms';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xs rounded-3xl glass-panel border border-white/20 p-5 shadow-2xl text-center space-y-4">
        {/* Type Icon */}
        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center shadow-lg ${
          isCall
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            : isWhatsApp
            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
        }`}>
          {isCall ? (
            <Phone className="w-7 h-7" />
          ) : isWhatsApp ? (
            <Send className="w-7 h-7" />
          ) : (
            <MessageSquare className="w-7 h-7" />
          )}
        </div>

        {/* Content */}
        <div>
          <h3 className="text-base font-bold text-white">{action.title}</h3>
          <p className="text-xs text-slate-400 mt-1">Number / Target: <span className="text-cyan-300 font-medium">{action.target}</span></p>

          {action.body && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 text-left italic">
              "{action.body}"
            </div>
          )}
        </div>

        {/* Confirmation Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-300 text-xs font-semibold hover:bg-white/20 transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-slate-950 text-xs font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 ${
              isCall
                ? 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/30'
                : 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-500/30'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {isCall ? 'Call Now' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
