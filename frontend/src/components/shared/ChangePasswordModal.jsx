import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from './index'; // adjust if your shared Modal export path differs
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const reset = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setShowCurrent(false); setShowNew(false);
  };

  const close = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
      toast.success(data.message || 'Password changed successfully');
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current password</label>
          <div className="relative">
            <input type={showCurrent ? 'text' : 'password'} className="input pr-10"
              placeholder="Leave blank if you signed up with Google" value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)} />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">New password</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} className="input pr-10"
              placeholder="••••••••" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <input type={showNew ? 'text' : 'password'} className="input"
            placeholder="••••••••" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} required />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={close} className="btn-ghost flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}