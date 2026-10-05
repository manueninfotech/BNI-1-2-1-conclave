import React, { useState } from 'react';
import { Award, Lock, Mail, Eye, EyeOff, ShieldCheck, Sparkles, KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

export default function Login({ onLogin, onSwitchToSignUp }) {
  const [inputVal, setInputVal] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const [authNotice, setAuthNotice] = useState(() => {
    const msg = localStorage.getItem('bni_auth_notice');
    if (msg) {
      localStorage.removeItem('bni_auth_notice');
      return msg;
    }
    return null;
  });

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const targetEmail = forgotEmail.trim();
    if (!targetEmail) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    if (!targetEmail.includes('@') || !targetEmail.includes('.')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    try {
      // 1. Verify with backend whether this account actually exists in Firebase/Firestore
      const defaultBackendUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000/api'
        : 'https://conclave-backend.blackpond-26884e90.centralindia.azurecontainerapps.io/api';
      const apiBase = import.meta.env.VITE_API_URL || defaultBackendUrl;

      const checkResp = await fetch(`${apiBase}/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      }).catch(() => null);

      if (checkResp && checkResp.ok) {
        const checkData = await checkResp.json();
        if (!checkData.exists) {
          setForgotError(checkData.error || 'No account found with this email address. Please make sure you are registered or create an account.');
          setForgotLoading(false);
          return;
        }
      }

      // 2. Dispatch password reset email via Firebase Auth
      await sendPasswordResetEmail(auth, targetEmail);
      setForgotSuccess('A password reset link has been sent to your email. Please check your inbox and spam folder.');
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setForgotError('No account found with this email address. If you registered with mobile only, your default password is your 10-digit mobile number, or you can contact your Conclave Admin.');
      } else if (err.code === 'auth/invalid-email') {
        setForgotError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setForgotError('Too many password reset requests. Please wait a few moments before trying again.');
      } else {
        setForgotError(err.message || 'Failed to send password reset email. Please try again.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!inputVal || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    const rawInput = inputVal.trim();
    const digitsOnly = rawInput.replace(/\D/g, '');
    const isPhoneNumber = digitsOnly.length >= 10 && digitsOnly.length <= 12;

    // Construct candidate login identifiers (handles email and mobile number registrations)
    const candidates = [];
    if (isPhoneNumber) {
      const tenDigit = digitsOnly.slice(-10);
      candidates.push(`91${tenDigit}@bni121.conclave`);
      candidates.push(`${tenDigit}@bni121.conclave`);
    }
    candidates.push(rawInput.toLowerCase());

    const tryLogin = async (candidateIndex) => {
      if (candidateIndex >= candidates.length) {
        setError('Invalid credentials. Please check your email/mobile number and password.');
        setIsLoading(false);
        return;
      }

      const emailToTry = candidates[candidateIndex];
      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailToTry, password);
        const firebaseUser = userCredential.user;
        const token = await firebaseUser.getIdToken();

        // Clear any stale cached sessions from previous user
        localStorage.removeItem('bni_logged_captain');
        localStorage.removeItem('bni_logged_member');
        localStorage.removeItem('bni_logged_admin');
        localStorage.setItem('bni_auth_token', token);

        // Fetch real profile from backend to resolve user role & details
        let backendProfile = null;
        try {
          const defaultBackendUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000/api'
            : 'https://conclave-backend.blackpond-26884e90.centralindia.azurecontainerapps.io/api';
          const apiBase = import.meta.env.VITE_API_URL || defaultBackendUrl;
          const resp = await fetch(`${apiBase}/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            backendProfile = await resp.json();
          }
        } catch (_) {
          /* Network error fallback if offline */
        }

        // Determine user role automatically from backend profile or default
        const rawRole = (backendProfile?.role || 'member').toLowerCase();
        let detectedRole = 'member';
        if (rawRole === 'superadmin') {
          detectedRole = 'superadmin';
        } else if (rawRole === 'admin' || rawRole === 'regional_admin' || rawRole === 'coordinator') {
          detectedRole = 'admin';
        } else if (rawRole === 'captain') {
          detectedRole = 'captain';
        } else {
          detectedRole = 'member';
        }

        let payload = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          email: backendProfile?.email || firebaseUser.email,
          name: backendProfile?.name || firebaseUser.displayName || firebaseUser.email.split('@')[0],
          role: detectedRole,
          ...(backendProfile || {}),
        };

        if (detectedRole === 'admin') {
          payload.region = payload.region || "Guntur Central";
        } else if (detectedRole === 'captain') {
          payload.tableId = payload.tableId || "Table 01";
          payload.chapter = payload.chapter || "Peak Performance";
          payload.category = payload.category || "Financial Services";
        }

        setIsLoading(false);
        onLogin && onLogin(detectedRole, payload);
      } catch (firebaseErr) {
        // If candidate failed and there are remaining candidates, try next candidate
        if (candidateIndex + 1 < candidates.length && (firebaseErr.code === 'auth/invalid-email' || firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/invalid-credential')) {
          return tryLogin(candidateIndex + 1);
        }

        console.error('Authentication Error:', firebaseErr.code, firebaseErr.message);

        // Clear invalid auth token
        localStorage.removeItem('bni_auth_token');

        let userMessage = 'Invalid email/mobile number or password. Please check your credentials and try again.';
        if (firebaseErr.code === 'auth/invalid-email') {
          userMessage = 'Please enter a valid email address or mobile number.';
        } else if (firebaseErr.code === 'auth/user-disabled') {
          userMessage = 'This account has been disabled. Please contact system admin.';
        } else if (firebaseErr.code === 'auth/too-many-requests') {
          userMessage = 'Access temporarily disabled due to repeated failed attempts. Please try again later.';
        }

        setError(userMessage);
        setIsLoading(false);
      }
    };

      const tryResolveAndLogin = async () => {
        try {
          const defaultBackendUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3000/api'
            : 'https://conclave-backend.blackpond-26884e90.centralindia.azurecontainerapps.io/api';
          const apiBase = import.meta.env.VITE_API_URL || defaultBackendUrl;

          const resp = await fetch(`${apiBase}/auth/resolve-identifier`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: rawInput })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.authEmail && !candidates.includes(data.authEmail)) {
              candidates.unshift(data.authEmail);
            }
          }
        } catch (_) {
          /* Fallback */
        }
        tryLogin(0);
      };

      tryResolveAndLogin();
    };

    return (
      <div className="min-h-screen w-full bg-zinc-50 flex items-stretch font-sans overflow-hidden">

        {/* Left side: Premium branding & stats panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 relative flex-col justify-between p-12 overflow-hidden select-none">
          {/* Decorative background grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

          {/* Top brand logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center shadow-lg shadow-brand-red/20">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-wider leading-none">
                BNI CONCLAVE PORTAL
              </h1>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                High-Performance Networking Platform
              </p>
            </div>
          </div>

          {/* Ambient content highlights */}
          <div className="relative z-10 space-y-6 max-w-md my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-brand-red tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              BNI Guntur Chapter
            </div>

            <h2 className="text-3xl font-extrabold text-white leading-tight">
              High-Performance Networking &amp; Seating Assignments.
            </h2>

            <p className="text-zinc-400 text-body-md font-medium leading-relaxed">
              Sign in with your registered account credentials to view your table seating, track round schedules, and connect with fellow chapter members.
            </p>
          </div>

          {/* Brand footer */}
          <div className="relative z-10 flex items-center justify-between text-[10px] text-zinc-550 font-bold tracking-tight border-t border-zinc-800 pt-5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Server cluster node: AP-SOUTH-1</span>
            </div>
            <span>&copy; 2026 BNI Global LLC.</span>
          </div>

          {/* Ambient background glows */}
          <div className="absolute top-1/4 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-10 w-96 h-96 rounded-full bg-red-900/10 blur-[120px] pointer-events-none"></div>
        </div>

        {/* Right side: Modern Unified Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16 bg-white relative">
          {/* Ambient visual glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 rounded-full blur-[60px] pointer-events-none"></div>

          <div className="w-full max-w-sm space-y-6 relative z-10">
            {/* Form Header */}
            <div className="space-y-2">
              {/* Mobile logo */}
              <div className="lg:hidden w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center mb-6">
                <Award className="w-5 h-5 text-white" />
              </div>

              <h3 className="text-2xl font-black text-zinc-955 tracking-tight">Portal Login</h3>
              <p className="text-body-md text-zinc-500 font-medium">
                Enter your account credentials to access your portal.
              </p>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {authNotice && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-xl text-amber-900 text-body-sm font-semibold flex items-start justify-between gap-3 shadow-2xs animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-amber-900">Session Notice</p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-snug">{authNotice}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthNotice(null)}
                    className="text-amber-500 hover:text-amber-900 text-sm font-bold leading-none p-1 cursor-pointer"
                    title="Dismiss"
                  >
                    &times;
                  </button>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-brand-red text-body-sm font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-red shrink-0"></span>
                  <span>{error}</span>
                </div>
              )}

              {/* Email/Mobile Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest" htmlFor="email-input">
                  Email Address / Mobile Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="email-input"
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    disabled={isLoading}
                    placeholder="name@example.com or 10-digit mobile"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest" htmlFor="password-input">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const raw = inputVal.trim();
                      if (raw.includes('@')) {
                        setForgotEmail(raw);
                      }
                      setIsForgotOpen(true);
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="text-[11px] text-brand-red font-bold hover:underline cursor-pointer transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Sign-in Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-red hover:bg-red-700 text-white py-2.5 rounded-lg text-button font-bold transition-smooth shadow-md shadow-brand-red/10 cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Secure Sign In</span>
                  </>
                )}
              </button>
            </form>

            {onSwitchToSignUp && (
              <div className="mt-5 pt-4 border-t border-zinc-100 text-center">
                <p className="text-[11px] text-zinc-500 font-semibold">
                  New member?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToSignUp}
                    className="text-brand-red font-bold hover:underline ml-1 cursor-pointer"
                  >
                    Create Member Account
                  </button>
                </p>
              </div>
            )}

            {/* Terms Footer */}
            <p className="text-[10px] text-zinc-450 text-center leading-relaxed font-semibold pt-4">
              This workspace is monitored for administrative compliance. Unauthorized connection attempts are logged.
            </p>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {isForgotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-md w-full p-6 relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-brand-red shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 leading-tight">Reset Password</h3>
                    <p className="text-xs text-zinc-500 font-medium">Receive instructions to set a new password</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {forgotSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-800 leading-relaxed font-semibold">
                      {forgotSuccess}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                    Click the link in the email to set a new password, then return here to sign in.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotOpen(false);
                      setForgotSuccess('');
                    }}
                    className="w-full bg-zinc-900 hover:bg-black text-white py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                    Enter the email address associated with your BNI member account. We will send you an official reset link.
                  </p>

                  {forgotError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-brand-red text-xs font-semibold leading-relaxed">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-brand-red" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest" htmlFor="forgot-email">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        disabled={forgotLoading}
                        placeholder="e.g. member@domain.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-semibold outline-none focus:border-brand-red focus:bg-white transition-colors placeholder-zinc-400 text-zinc-900"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-lg">
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      <strong className="text-zinc-700">Registered with mobile only?</strong> Your initial password was set to your 10-digit mobile number. You can also reach out to your conclave admin for assistance.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsForgotOpen(false)}
                      disabled={forgotLoading}
                      className="w-1/2 py-2.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-1/2 bg-brand-red hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm"
                    >
                      {forgotLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Send Link</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    );
  }
