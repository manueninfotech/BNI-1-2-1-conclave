import React, { useState, useEffect } from 'react';
import { Award, Lock, Eye, EyeOff, ShieldCheck, Sparkles, KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { auth } from '../config/firebase';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';

export default function ResetPassword({ onBackToLogin }) {
  const [oobCode, setOobCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [codeStatus, setCodeStatus] = useState('verifying'); // 'verifying' | 'valid' | 'invalid' | 'success'
  const [errorMessage, setErrorMessage] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Extract oobCode from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');

    if (!code) {
      setCodeStatus('invalid');
      setErrorMessage('No password reset code found in the link. Please check your reset email or request a new link.');
      return;
    }

    setOobCode(code);

    // Verify the action code with Firebase Auth
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        setUserEmail(email);
        setCodeStatus('valid');
      })
      .catch((err) => {
        console.error('Verify reset code error:', err);
        setCodeStatus('invalid');
        if (err.code === 'auth/expired-action-code') {
          setErrorMessage('This password reset link has expired. Reset links are valid for a limited time for your security.');
        } else if (err.code === 'auth/invalid-action-code') {
          setErrorMessage('This password reset link is invalid or has already been used.');
        } else {
          setErrorMessage('Unable to verify reset code. Please request a new password reset link.');
        }
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!password) {
      setFormError('Please enter a new password.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setCodeStatus('success');
    } catch (err) {
      console.error('Confirm password reset error:', err);
      if (err.code === 'auth/weak-password') {
        setFormError('Password is too weak. Please choose a stronger password.');
      } else if (err.code === 'auth/expired-action-code') {
        setCodeStatus('invalid');
        setErrorMessage('This reset link has expired. Please request a new one.');
      } else {
        setFormError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToLogin = () => {
    // Clear reset params from URL
    window.history.pushState({}, '', '/login');
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex items-stretch font-sans overflow-hidden">

      {/* Left side: Premium branding panel */}
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
            Account Security
          </div>

          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Create a New Secure Password.
          </h2>

          <p className="text-zinc-400 text-body-md font-medium leading-relaxed">
            Ensure your account is protected with a strong password. Once updated, you will be able to log into both the web portal and the mobile app immediately.
          </p>

          <div className="pt-2 flex items-center gap-3 text-zinc-400 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Min. 6 Characters</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Encrypted Storage</span>
            </div>
          </div>
        </div>

        {/* Brand footer */}
        <div className="relative z-10 flex items-center justify-between text-[10px] text-zinc-550 font-bold tracking-tight border-t border-zinc-800 pt-5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Security node: Auth-v2</span>
          </div>
          <span>&copy; 2026 BNI Global LLC.</span>
        </div>

        {/* Ambient background glows */}
        <div className="absolute top-1/4 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-10 w-96 h-96 rounded-full bg-red-900/10 blur-[120px] pointer-events-none"></div>
      </div>

      {/* Right side: Password Reset Form Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
        <div className="max-w-[420px] w-full">

          {/* Mobile brand header */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center">
              <Award className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black text-zinc-900 tracking-wider">BNI CONCLAVE</span>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-xl shadow-zinc-200/40 p-7 md:p-8">

            {/* State 1: Verifying code */}
            {codeStatus === 'verifying' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-brand-red flex items-center justify-center mx-auto animate-pulse">
                  <KeyRound className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900">Verifying Reset Link</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-1">Please wait while we validate your security code...</p>
                </div>
              </div>
            )}

            {/* State 2: Invalid or expired code */}
            {codeStatus === 'invalid' && (
              <div className="space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-brand-red flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight">Link Expired or Invalid</h2>
                  <p className="text-xs text-zinc-600 font-medium leading-relaxed mt-2">
                    {errorMessage}
                  </p>
                </div>

                <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Password reset links are single-use and expire after 1 hour. You can request a fresh link on the sign-in page.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleReturnToLogin}
                  className="w-full bg-brand-red hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            )}

            {/* State 3: Password updated successfully */}
            {codeStatus === 'success' && (
              <div className="space-y-6 text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight">Password Reset Complete!</h2>
                  <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                    Your password has been successfully updated. You can now use your new credentials to sign in.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleReturnToLogin}
                  className="w-full bg-brand-red hover:bg-red-700 text-white py-3 rounded-lg text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-brand-red/15"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In Now</span>
                </button>
              </div>
            )}

            {/* State 4: Valid code -> Password input form */}
            {codeStatus === 'valid' && (
              <div>
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-brand-red flex items-center justify-center mb-3">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 tracking-tight">Reset Your Password</h2>
                  {userEmail && (
                    <p className="text-xs text-zinc-500 font-medium mt-1">
                      Account: <strong className="text-zinc-800 font-bold">{userEmail}</strong>
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-brand-red text-xs font-semibold leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-brand-red" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest" htmlFor="new-password">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                        autoFocus
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

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest" htmlFor="confirm-password">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Re-enter password"
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-brand-red hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-bold transition-smooth shadow-md shadow-brand-red/10 cursor-pointer flex items-center justify-center gap-2 mt-4 disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Saving New Password...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={handleReturnToLogin}
                      className="text-xs text-zinc-500 font-bold hover:text-zinc-800 hover:underline cursor-pointer"
                    >
                      Cancel and return to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>

          <p className="text-[10px] text-zinc-450 text-center leading-relaxed font-semibold pt-6">
            BNI 1-to-1 Conclave • Protected by Firebase Enterprise Authentication
          </p>
        </div>
      </div>

    </div>
  );
}
