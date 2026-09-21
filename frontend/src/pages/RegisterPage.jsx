import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [role, setRole] = useState('client'); // 'client' | 'freelancer'
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'verify' | 'pending'
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const { register, loginWithGoogle, verifyEmail, resendVerification } = useAuthStore();
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);

  const goToRoleHome = (user) => {
    setTimeout(() => {
      if (user.role === 'admin') navigate('/admin', { replace: true });
      else if (user.role === 'client') navigate('/client', { replace: true });
      else navigate('/freelancer', { replace: true });
    }, 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await register({ ...form, role });
      if (result?.needsVerification) {
        toast.success('Check your email for a verification code');
        setStep('verify');
      } else {
        toast.success('Account created!');
        goToRoleHome(result);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const result = await verifyEmail(form.email, code);
      if (result?.pending) {
        setStep('pending');
      } else {
        toast.success(`Welcome, ${result.name}!`);
        goToRoleHome(result);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired code');
    } finally { setVerifying(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification(form.email);
      toast.success('New code sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code');
    } finally { setResending(false); }
  };

  const handleGoogleResponse = async (response) => {
    try {
      // role is only used server-side if this Google account is signing up for the first time;
      // existing accounts keep whatever role they already have. Google accounts skip the
      // OTP step entirely since Google has already verified the person owns the inbox —
      // but a new freelancer signup still needs admin approval before they can log in.
      const user = await loginWithGoogle(response.credential, role);
      toast.success(`Welcome, ${user.name}!`);
      goToRoleHome(user);
    } catch (err) {
      if (err.response?.data?.pending) {
        setStep('pending');
        return;
      }
      toast.error(err.response?.data?.message || 'Google sign-up failed');
    }
  };

  // Load the Google Identity Services script and render the button
  useEffect(() => {
    if (step !== 'form') return; // only show Google sign-up on the initial form
    if (!GOOGLE_CLIENT_ID) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not set — Google sign-in is disabled.');
      return;
    }

    const initializeGoogle = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: Math.max(200, Math.min(336, Math.floor(googleBtnRef.current.parentElement.offsetWidth))),
        shape: 'pill',
        text: 'signup_with',
      });
    };

    if (window.google) {
      initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.body.appendChild(script);

    return () => {
      // Don't remove the script on unmount — the login page may reuse it
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, step]); // re-init so the Google callback closes over the latest selected role

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden px-4 py-8 sm:px-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -right-60 w-[600px] h-[600px] bg-white/4 rounded-full blur-3xl" />
        <div className="absolute -bottom-60 -left-60 w-[600px] h-[600px] bg-white/3 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <img src="/logo.jpg" alt="LiveTake"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover mb-4"
            style={{ boxShadow: '0 0 80px rgba(255,255,255,0.12), 0 0 30px rgba(255,255,255,0.06)' }} />
          <p className="text-white/30 text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] uppercase text-center">Project Management System</p>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 sm:p-7 backdrop-blur-sm">
          {step === 'form' ? (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Create Account</h2>
              <p className="text-white/40 text-sm mb-6">Register as a client or freelancer</p>

              {/* Role toggle */}
              <div className="flex gap-2 mb-5 bg-white/[0.03] border border-white/10 rounded-xl p-1">
                {['client', 'freelancer'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      role === r
                        ? 'bg-white text-black'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {r === 'client' ? 'Client' : 'Freelancer'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Firstname, Lastname' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
                  { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+63 900 000 0000' },
                  { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
                ].map(({ key, label, type, placeholder }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type={type} className="input" placeholder={placeholder}
                      value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} required />
                  </div>
                ))}
                <button type="submit" disabled={loading}
                  className="w-full py-3 mt-1 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 text-sm tracking-wider uppercase">
                  {loading ? 'Creating account...' : `Create ${role === 'client' ? 'Client' : 'Freelancer'} Account`}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Google Sign-Up button gets rendered into this div by Google's script */}
              <div className="flex justify-center w-full overflow-hidden">
                <div ref={googleBtnRef} />
              </div>
              <p className="text-white/25 text-[11px] text-center mt-3">
                Signing up as <span className="text-white/50 font-semibold">{role === 'client' ? 'Client' : 'Freelancer'}</span> — switch above before continuing with Google.
              </p>

              <div className="mt-5 pt-5 border-t border-white/10 text-center">
                <p className="text-white/40 text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-white font-semibold hover:text-white/70 transition-colors">Sign in</Link>
                </p>
              </div>
            </>
          ) : step === 'verify' ? (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Check your email</h2>
              <p className="text-white/40 text-sm mb-6">
                We sent a 6-digit code to <span className="text-white/70 font-medium">{form.email}</span>
              </p>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="label">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input text-center tracking-[0.5em] text-lg font-bold"
                    placeholder="000000"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={verifying || code.length < 6}
                  className="w-full py-3 mt-1 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 text-sm tracking-wider uppercase">
                  {verifying ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-white/10 text-center">
                <p className="text-white/40 text-sm">
                  Didn't get it?{' '}
                  <button type="button" onClick={handleResend} disabled={resending}
                    className="text-white font-semibold hover:text-white/70 transition-colors disabled:opacity-50">
                    {resending ? 'Sending...' : 'Resend code'}
                  </button>
                </p>
                <button type="button" onClick={() => setStep('form')}
                  className="text-white/30 text-xs mt-3 hover:text-white/60 transition-colors">
                  ← Back to registration
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center text-center py-2">
                <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Account pending approval</h2>
                <p className="text-white/40 text-sm mb-6 leading-relaxed">
                  Your email is verified and your freelancer account has been created.
                  An admin needs to review and approve it before you can sign in.
                  We'll notify you at <span className="text-white/70 font-medium">{form.email}</span> once approved.
                </p>
                <Link to="/login"
                  className="w-full py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/15 transition-all text-sm tracking-wider uppercase text-center">
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}