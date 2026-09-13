import React, { useState } from 'react';
import { Award, Lock, Mail, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login({ onLogin, onSwitchToSignUp }) {
  const [inputVal, setInputVal] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

      </div>
    );
  }
