import React, { useState } from 'react';
import { Award, Lock, Mail, Eye, EyeOff, ShieldCheck, Sparkles, Server } from 'lucide-react';
import { auth } from '../../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function CaptainLogin({ onLogin }) {
  const [inputVal, setInputVal] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!inputVal || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);

    try {
      const emailLower = inputVal.toLowerCase().trim();
      const userCredential = await signInWithEmailAndPassword(auth, emailLower, password);
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();

      // Store token for API calls
      localStorage.setItem('bni_auth_token', token);

      const payload = {
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
      };

      onLogin && onLogin('captain', payload);
    } catch (firebaseErr) {
      console.error('Captain login error:', firebaseErr.code, firebaseErr.message);
      if (
        firebaseErr.code === 'auth/invalid-credential' ||
        firebaseErr.code === 'auth/user-not-found' ||
        firebaseErr.code === 'auth/wrong-password'
      ) {
        setError('Invalid email or password. Please try again.');
      } else if (firebaseErr.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (firebaseErr.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a moment and try again.');
      } else if (firebaseErr.code === 'auth/api-key-not-valid') {
        setError('Firebase configuration error. Please contact your administrator.');
      } else {
        setError(firebaseErr.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex items-stretch font-sans overflow-hidden">
      
      {/* Left side: Captain theme design */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 relative flex-col justify-between p-12 overflow-hidden select-none">
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Top Brand Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center shadow-lg shadow-brand-red/20">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wider leading-none">BNI CAPTAINS</h1>
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Table Attendance Portal</p>
          </div>
        </div>

        {/* Center Content */}
        <div className="relative z-10 my-auto max-w-md space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-red/10 border border-brand-red/20 rounded-full text-brand-red text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> Live Seating Optimizer
          </div>
          
          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Captain Attendance Log &amp; Seating Verification.
          </h2>
          
          <p className="text-zinc-400 text-body-md font-medium leading-relaxed">
            Quickly check-in members, view category pairings, clear conflicts, and lock round seats directly from your mobile or desktop device.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block">Accuracy</span>
              <span className="text-display-sm text-white font-extrabold block mt-1">99.8%</span>
              <span className="text-[9px] text-emerald-500 font-semibold mt-1 block">Real-time Sync</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest block">Control</span>
              <span className="text-display-sm text-white font-extrabold block mt-1">1-Tap</span>
              <span className="text-[9px] text-zinc-400 font-semibold mt-1 block">Check-in Status</span>
            </div>
          </div>
        </div>

        {/* Bottom Note */}
        <div className="relative z-10 flex items-center justify-center text-[11px] text-zinc-500 font-semibold border-t border-white/[0.06] pt-6">
          <span>Powered by <span className="text-zinc-300 font-bold">Manuen Infotech</span></span>
        </div>

        <div className="absolute top-1/4 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-[100px] pointer-events-none"></div>
      </div>

      {/* Right side: Credentials login panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16 bg-white relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-50 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="w-full max-w-sm space-y-6 relative z-10">
          <div className="space-y-2">
            <div className="lg:hidden w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center mb-6">
              <Award className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-2xl font-black text-zinc-950 tracking-tight">Captain Login</h3>
            <p className="text-body-md text-zinc-500 font-medium">
              Enter your registered Email to access your table.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-brand-red text-body-sm font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0"></span>
                {error}
              </div>
            )}

            {/* Email field */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest" htmlFor="captain-email-input">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  id="captain-email-input"
                  type="email"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={isLoading}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest" htmlFor="captain-password-input">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  id="captain-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            {/* Keep Signed In */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-zinc-300 text-brand-red focus:ring-brand-red outline-none"
                />
                <span className="text-body-sm font-semibold text-zinc-600">Keep me signed in</span>
              </label>
            </div>

            {/* Sign in button */}
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
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Captain Sign In</span>
                </>
              )}
            </button>
          </form>
          
          <p className="text-[10px] text-zinc-450 text-center leading-relaxed font-semibold pt-4">
            Authorized Table Captain access only. All sessions are logged for security audit purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
