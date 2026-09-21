import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      toast.success(data.message || 'If an account exists, a code has been sent.');
      setStep('reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      toast.success(data.message || 'Code resent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { email, code, newPassword });
      toast.success(data.message || 'Password reset successful. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -right-60 w-[600px] h-[600px] bg-white/4 rounded-full blur-3xl" />
        <div className="absolute -bottom-60 -left-60 w-[600px] h-[600px] bg-white/3 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpg" alt="LiveTake"
            className="w-24 h-24 rounded-2xl object-cover mb-4"
            style={{ boxShadow: '0 0 80px rgba(255,255,255,0.12), 0 0 30px rgba(255,255,255,0.06)' }} />
          <p className="text-white/30 text-xs tracking-[0.3em] uppercase">Project Management System</p>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>

          {step === 'request' ? (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Forgot password?</h2>
              <p className="text-white/40 text-sm mb-6">Enter your email and we'll send you a reset code.</p>

              <form onSubmit={requestCode} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input type="email" className="input" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 mt-1 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wider uppercase">
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Enter reset code</h2>
              <p className="text-white/40 text-sm mb-6">
                We sent a code to <span className="text-white/70">{email}</span>. Enter it below with your new password.
              </p>

              <form onSubmit={submitReset} className="space-y-4">
                <div>
                  <label className="label">Reset code</label>
                  <input type="text" inputMode="numeric" className="input tracking-[0.3em] text-center"
                    placeholder="000000" maxLength={6}
                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
                </div>
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input pr-10"
                      placeholder="••••••••" value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input type={showPass ? 'text' : 'password'} className="input"
                    placeholder="••••••••" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 mt-1 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wider uppercase">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button type="button" onClick={resendCode} disabled={resending}
                  className="text-white/40 hover:text-white/70 text-xs transition-colors disabled:opacity-50">
                  {resending ? 'Resending...' : "Didn't get a code? Resend"}
                </button>
              </div>

              <p className="mt-3 text-center text-white/30 text-xs leading-relaxed">
                Still nothing after a few minutes? If you originally signed up with
                "Continue with Google," this account doesn't have a password to reset —{' '}
                <Link to="/login" className="text-white/50 hover:text-white/70 underline underline-offset-2">
                  sign in with Google instead
                </Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}