import React, { useState, useEffect } from 'react';
import { Award, User, Mail, Lock, Phone, Building2, Layers, MapPin, Globe, Eye, EyeOff, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { auth } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { api } from '../services/api';

export default function SignUp({ onSwitchToLogin, onLogin }) {
  const [categoriesList, setCategoriesList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const res = await api.get('/categories').catch(() => null)
          || await api.get('/admin/categories').catch(() => null);
        if (isMounted && res && Array.isArray(res.categories) && res.categories.length > 0) {
          setCategoriesList(res.categories);
        }
      } catch (err) {
        console.warn('Failed to load categories from API, using default list:', err);
      }
    }
    loadCategories();
    return () => { isMounted = false; };
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    category: '',
    membership: '',
    region: '',
    chapter: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password || !formData.phone || !formData.company || !formData.category) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!formData.membership) {
      setError('Choose whether you are a member or guest attendee.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const emailLower = formData.email.trim().toLowerCase();

      // Clean up chapter name: remove any leading "BNI" or region name if accidentally typed
      let cleanChapter = (formData.chapter || '').trim();
      const trimmedRegion = (formData.region || '').trim();
      if (cleanChapter && trimmedRegion) {
        cleanChapter = cleanChapter.replace(/^BNI\s+/i, '').replace(new RegExp(`^${trimmedRegion}\\s+`, 'i'), '');
      } else if (cleanChapter) {
        cleanChapter = cleanChapter.replace(/^BNI\s+/i, '');
      }

      // 1. Create Firebase Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, emailLower, formData.password);
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();

      // Store auth token
      localStorage.setItem('bni_auth_token', token);
      localStorage.removeItem('bni_logged_captain');
      localStorage.removeItem('bni_logged_member');
      localStorage.removeItem('bni_logged_admin');

      // 2. Call backend API /api/me to store member profile in Firestore
      const defaultBackendUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000/api'
        : 'https://conclave-backend.blackpond-26884e90.centralindia.azurecontainerapps.io/api';
      const apiBase = import.meta.env.VITE_API_URL || defaultBackendUrl;

      let rawPhone = formData.phone.trim();
      let digitsOnly = rawPhone.replace(/\D/g, '');
      if (digitsOnly.length === 10) {
        digitsOnly = '91' + digitsOnly;
      }
      const formattedPhone = digitsOnly ? `+${digitsOnly}` : rawPhone;
      const rawMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : rawPhone;
      const syntheticIdentifier = digitsOnly ? `${digitsOnly}@bni121.conclave` : `${rawMobile}@bni121.conclave`;

      const profilePayload = {
        id: firebaseUser.uid,
        name: formData.name.trim(),
        email: emailLower,
        phone: formattedPhone,
        mobile: rawMobile,
        identifier: syntheticIdentifier,
        company: formData.company.trim(),
        businessName: formData.company.trim(),
        category: formData.category.trim(),
        businessCategory: formData.category.trim(),
        membership: formData.membership,
        region: trimmedRegion,
        location: trimmedRegion.toLowerCase(),
        country: 'India',
        chapter: cleanChapter,
        role: 'member'
      };

      try {
        await fetch(`${apiBase}/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(profilePayload)
        });
      } catch (backendErr) {
        console.warn("Backend profile save warning:", backendErr);
      }

      const payload = {
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        ...profilePayload
      };

      setIsLoading(false);
      if (onLogin) {
        onLogin('member', payload);
      }
    } catch (firebaseErr) {
      console.error("Signup error:", firebaseErr);
      setIsLoading(false);
      let userMsg = 'Failed to create account. Please try again.';
      if (firebaseErr.code === 'auth/email-already-in-use') {
        userMsg = 'An account with this email already exists. Please login instead.';
      } else if (firebaseErr.code === 'auth/invalid-email') {
        userMsg = 'Please enter a valid email address.';
      } else if (firebaseErr.code === 'auth/weak-password') {
        userMsg = 'Password should be at least 6 characters.';
      }
      setError(userMsg);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex items-stretch font-sans overflow-hidden">
      
      {/* Left side: Premium branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 relative flex-col justify-between p-12 overflow-hidden select-none">
        {/* Decorative background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Top brand logo */}
        <div className="relative z-10 flex items-center">
          <img src="/lockup-horizontal-white.png" alt="1-2-1 Connect" className="h-12 w-auto object-contain" />
        </div>

        {/* Ambient content highlights */}
        <div className="relative z-10 space-y-6 max-w-md my-auto">
          <div>
            <p className="text-coral text-xs font-bold uppercase tracking-wider mb-2">
              Every table. Every round. Every referral.
            </p>
            <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              Pass business in one tap, right at the table.
            </h2>
          </div>

          <p className="text-zinc-300 text-body-md font-medium leading-relaxed">
            1-2-1 Connect runs your 1-2-1 Connect conclave from your phone: where to sit, who is speaking, when to pass business, and everyone you met, saved when the day is done.
          </p>

          <div className="pt-2">
            <div className="p-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-zinc-300 font-medium leading-relaxed">
              Your table for every round, and where to go next.
            </div>
          </div>
        </div>

        {/* Brand boilerplate footer */}
        <div className="relative z-10 flex flex-col gap-1 text-[11px] text-zinc-400 font-medium border-t border-zinc-800 pt-5">
          <p className="text-zinc-400 leading-normal">
            1-2-1 Connect is a networking app for 1-2-1 Connect conclaves, built by Manuen Infotech in Guntur, Andhra Pradesh. It handles seating, live rounds, referrals and follow-ups for members, guests and organisers, on iPhone and Android. Learn more at <a href="https://manuen.com/conclave" target="_blank" rel="noopener noreferrer" className="text-white font-semibold underline hover:text-coral transition-colors">manuen.com/conclave</a>.
          </p>
        </div>

        {/* Ambient background glows */}
        <div className="absolute top-1/4 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-10 w-96 h-96 rounded-full bg-red-900/10 blur-[120px] pointer-events-none"></div>
      </div>

      {/* Right side: Modern Clean White Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 md:p-12 bg-white relative overflow-y-auto">
        <div className="w-full max-w-md space-y-4 relative z-10 my-auto py-4">
          
          {/* Form Header */}
          <div className="space-y-1">
            {/* Mobile logo */}
            <div className="lg:hidden mb-4">
              <img src="/lockup-horizontal-colour.png" alt="1-2-1 Connect" className="h-8 w-auto object-contain" />
            </div>
            
            <h3 className="text-2xl font-black text-zinc-955 tracking-tight">Create Member Account</h3>
            <p className="text-body-md text-zinc-600 font-medium">
              Structured 1-2-1 networking for 1-2-1 Connect conclaves: your table, referrals, contacts.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-brand-red text-body-sm font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-red shrink-0"></span>
              <span>{error}</span>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                Full Name <span className="text-brand-red">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Rahul Sharma"
                  required
                  className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                />
              </div>
            </div>

            {/* Email & Phone Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                  Email <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="member@121connect.com"
                    required
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                  Phone <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* Company & Category Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                  Company Name <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Acme Tech Ltd"
                    required
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                  Category <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <Layers className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth text-zinc-900 cursor-pointer"
                  >
                    <option value="">Select Category</option>
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Membership Type Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest flex items-center justify-between">
                <span>Membership Status <span className="text-brand-red">*</span></span>
                <span className="text-[10px] font-bold text-zinc-500">
                  {formData.membership === 'BNI' ? '1-2-1 Connect Member' : formData.membership === 'Non-BNI' ? 'Guest Attendee' : 'Please choose'}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100/90 rounded-xl border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, membership: 'BNI' }))}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    formData.membership === 'BNI'
                      ? 'bg-brand-red text-white shadow-sm shadow-red-500/25'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>1-2-1 Connect Member</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, membership: 'Non-BNI' }))}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    formData.membership === 'Non-BNI'
                      ? 'bg-zinc-850 text-white shadow-sm shadow-zinc-900/25'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Guest Attendee</span>
                </button>
              </div>
            </div>

            {/* Region & Chapter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Region Text Input */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest flex items-center justify-between">
                  <span>Region</span>
                  <span className="text-[9.5px] text-zinc-400 font-normal">Optional</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    placeholder={formData.membership === 'BNI' ? 'e.g. Guntur Central' : 'e.g. Guntur / Andhra Pradesh'}
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>

              {/* Chapter Name */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest flex items-center justify-between">
                  <span>Chapter Name</span>
                  <span className="text-[9.5px] text-zinc-400 font-normal">Optional</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="chapter"
                    value={formData.chapter}
                    onChange={handleChange}
                    placeholder={formData.membership === 'BNI' ? 'e.g. Titans / Express' : 'Optional for guests'}
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>
            </div>
            <p className="text-[9.5px] text-zinc-400 font-medium -mt-1">
              {formData.membership === 'Non-BNI'
                ? 'For guest attendees, Region and Chapter are optional.'
                : 'Enter Region and Chapter separately .'}
            </p>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                Password <span className="text-brand-red">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full pl-10 pr-10 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
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

            {/* Submit Button */}
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Register Account</span>
                </>
              )}
            </button>
          </form>

          {/* Switch to Login Link */}
          <div className="mt-4 pt-3 border-t border-zinc-100 text-center">
            <p className="text-[11px] text-zinc-500 font-semibold">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-brand-red font-bold hover:underline ml-1 cursor-pointer"
              >
                Sign In Here
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
