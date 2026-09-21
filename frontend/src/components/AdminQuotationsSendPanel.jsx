import React, { useState } from 'react';
import { FileText, Upload, Send, CheckCircle, Eye, RefreshCw, XCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/helpers';

/**
 * AdminQuotationSendPanel
 *
 * Drop this anywhere inside the admin's EventDetail (e.g. in the overview
 * tab, after the quotation card). It lets the admin choose whether to expose
 * the built-in system print-view or a custom PDF URL, and tracks the shared
 * state with a Revoke / Update option.
 *
 * Props:
 *   event      — the full event object (must include quotationSharing)
 *   onRefresh  — callback to refetch the event after a change
 */
export default function AdminQuotationSendPanel({ event, onRefresh }) {
  const sharing = event?.quotationSharing ?? {};
  const isShared = sharing.shared === true;

  // When already shared we start in "view" mode; the admin can click "Update"
  // to re-open the edit form.
  const [editing, setEditing] = useState(!isShared);
  const [shareType, setShareType] = useState(sharing.type || 'system');
  const [pdfUrl, setPdfUrl] = useState(sharing.pdfUrl || '');
  const [loading, setLoading] = useState(false);

  // ── Send / update ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (shareType === 'pdf' && !pdfUrl.trim()) {
      toast.error('Please enter a PDF URL');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/events/${event._id}/send-quotation`, {
        shareType,
        pdfUrl: shareType === 'pdf' ? pdfUrl.trim() : '',
      });
      toast.success(isShared ? 'Quotation updated!' : 'Quotation sent to client!');
      setEditing(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send quotation');
    } finally {
      setLoading(false);
    }
  };

  // ── Revoke ───────────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!window.confirm('Revoke client access to this quotation?')) return;
    setLoading(true);
    try {
      await api.put(`/events/${event._id}/send-quotation`, { shareType: 'none' });
      toast.success('Quotation access revoked');
      setEditing(true);
      setShareType('system');
      setPdfUrl('');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke access');
    } finally {
      setLoading(false);
    }
  };

  // ── Preview helper (admin side) ──────────────────────────────────────────────
  const handleAdminPreview = async () => {
    if (sharing.type === 'pdf') {
      window.open(sharing.pdfUrl, '_blank');
      return;
    }
    try {
      const { data } = await api.get(`/quotations?event=${event._id}`);
      const q = data.quotations?.[0] || data.quotation;
      if (!q) { toast.error('No quotation found for this event'); return; }
      sessionStorage.setItem(`qprint_${q._id}`, JSON.stringify(q));
      window.open(`/print/quotation/${q._id}`, '_blank');
    } catch {
      toast.error('Could not load quotation data');
    }
  };

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="section-title">Client Quotation Access</h3>
        {isShared && (
          <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2.5 py-1">
            <CheckCircle className="w-3 h-3" />
            Visible to client
          </span>
        )}
        {!isShared && (
          <span className="flex items-center gap-1.5 text-xs text-white/30 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
            Hidden
          </span>
        )}
      </div>

      {/* ── Already shared — summary card ─────────────────────────────────── */}
      {isShared && !editing && (
        <div className="space-y-3">
          <div className="p-3 bg-green-500/8 border border-green-500/20 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2">
              {sharing.type === 'system'
                ? <FileText className="w-4 h-4 text-green-400" />
                : <Upload className="w-4 h-4 text-green-400" />
              }
              <p className="text-green-400 font-medium text-sm">
                {sharing.type === 'system' ? 'System print view' : 'Custom PDF'} is live
              </p>
            </div>
            {sharing.type === 'pdf' && sharing.pdfUrl && (
              <a
                href={sharing.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-xs underline block truncate"
              >
                {sharing.pdfUrl}
              </a>
            )}
            {sharing.sharedAt && (
              <p className="text-white/25 text-xs">
                Sent {formatDateTime(sharing.sharedAt)}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdminPreview}
              className="flex-1 flex items-center justify-center gap-1.5 btn-ghost text-sm"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              onClick={() => { setShareType(sharing.type || 'system'); setPdfUrl(sharing.pdfUrl || ''); setEditing(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 btn-ghost text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Update
            </button>
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl
                bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium
                hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Revoke
            </button>
          </div>
        </div>
      )}

      {/* ── Edit / send form ──────────────────────────────────────────────── */}
      {editing && (
        <div className="space-y-4">
          {!isShared && (
            <p className="text-white/40 text-sm">
              The client <span className="text-white font-medium">cannot see</span> the quotation until you send it.
            </p>
          )}

          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-white/50 text-xs uppercase tracking-wide">Quotation type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: 'system',
                  label: 'System Quotation',
                  icon: FileText,
                  desc: 'Built-in branded print view',
                },
                {
                  value: 'pdf',
                  label: 'Custom PDF',
                  icon: Upload,
                  desc: 'Paste a Cloudinary / Drive link',
                },
              ].map(({ value, label, icon: Icon, desc }) => {
                const active = shareType === value;
                return (
                  <label
                    key={value}
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border cursor-pointer transition-all
                      ${active
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                  >
                    <input
                      type="radio"
                      name="shareType"
                      value={value}
                      checked={active}
                      onChange={() => setShareType(value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-white/40'}`} />
                      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-white/60'}`}>
                        {label}
                      </span>
                    </div>
                    <span className="text-xs text-white/30">{desc}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* PDF URL */}
          {shareType === 'pdf' && (
            <div className="space-y-1">
              <label className="text-white/50 text-xs">
                PDF URL <span className="text-red-400">*</span>
              </label>
              <input
                className="input w-full"
                type="url"
                placeholder="https://drive.google.com/… or https://res.cloudinary.com/…"
                value={pdfUrl}
                onChange={e => setPdfUrl(e.target.value)}
              />
              <p className="text-white/25 text-xs">
                Ensure the URL is publicly accessible (or shared with the client's email).
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {isShared && (
              <button
                onClick={() => setEditing(false)}
                disabled={loading}
                className="flex-1 btn-ghost text-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={loading || (shareType === 'pdf' && !pdfUrl.trim())}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Saving…' : isShared ? 'Update Quotation' : 'Send Quotation to Client'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}