import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

/**
 * ConfirmDialog — shows a confirmation popup before any destructive or important action.
 *
 * Props:
 *   isOpen       – boolean
 *   onClose      – () => void
 *   onConfirm    – () => void
 *   title        – string
 *   message      – string (supports JSX)
 *   confirmLabel – string  (default "Confirm")
 *   cancelLabel  – string  (default "Cancel")
 *   type         – 'danger' | 'success' | 'warning' | 'info'  (default 'warning')
 *   loading      – boolean (shows spinner on confirm button)
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  type         = 'warning',
  loading      = false,
}) {
  if (!isOpen) return null;

  const configs = {
    danger:  { icon: XCircle,      iconCls: 'text-red-400',    iconBg: 'bg-red-500/20',    btnCls: 'bg-red-500 hover:bg-red-600 text-white'         },
    success: { icon: CheckCircle,  iconCls: 'text-green-400',  iconBg: 'bg-green-500/20',  btnCls: 'bg-green-500 hover:bg-green-600 text-white'     },
    warning: { icon: AlertTriangle,iconCls: 'text-yellow-400', iconBg: 'bg-yellow-500/20', btnCls: 'bg-yellow-500 hover:bg-yellow-600 text-black font-bold' },
    info:    { icon: Info,         iconCls: 'text-blue-400',   iconBg: 'bg-blue-500/20',   btnCls: 'bg-primary hover:bg-primary/80 text-white'       },
  };

  const cfg = configs[type] || configs.warning;
  const Icon = cfg.icon;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          {/* Icon */}
          <div className={`w-14 h-14 ${cfg.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-7 h-7 ${cfg.iconCls}`} />
          </div>

          {/* Title */}
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>

          {/* Message */}
          <p className="text-white/50 text-sm leading-relaxed">{message}</p>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${cfg.btnCls}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Processing...
                </span>
              ) : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
