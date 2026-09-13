import React, { useState } from 'react';
import { Award, User, Mail, Lock, Phone, Building2, Layers, MapPin, Globe, Eye, EyeOff, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { auth } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const BNI_CATEGORIES = [
  "Software Development",
  "Web Design & Development",
  "IT Hardware & Networking",
  "Digital Marketing",
  "Real Estate",
  "Chartered Accountant",
  "Interior Designer",
  "Architect",
  "Civil Contractor",
  "Electrical Contractor",
  "Plumbing & Sanitary",
  "Tiles & Flooring",
  "Modular Kitchen",
  "Furniture",
  "Home Appliances",
  "Solar Energy",
  "Caterer",
  "Restaurant",
  "Bakery & Confectionery",
  "Event Management",
  "Wedding Planner",
  "Photography & Videography",
  "Travel Agent",
  "Hotel & Resorts",
  "Insurance Advisor",
  "Financial Planner",
  "Stock Broker",
  "Mutual Funds Advisor",
  "Banking & Loans",
  "Advocate / Lawyer",
  "Doctor - General Physician",
  "Dentist",
  "Dermatologist",
  "Pharmacy",
  "Diagnostic Lab",
  "Hospital & Healthcare",
  "Ayurveda & Wellness",
  "Fitness & Gym",
  "Yoga Trainer",
  "Boutique & Fashion",
  "Textiles",
  "Jeweller",
  "Footwear",
  "Cosmetics & Beauty",
  "Salon & Spa",
  "Printing & Packaging",
  "Signage & Branding",
  "Advertising Agency",
  "Gifting & Corporate Gifts",
  "Stationery",
  "Automobiles - Cars",
  "Two Wheeler Dealer",
  "Auto Service & Repair",
  "Tyres & Batteries",
  "Packers & Movers",
  "Logistics & Courier",
  "Hardware & Paints",
  "Cement & Building Material",
  "Borewells & Drilling",
  "Pest Control",
  "Housekeeping Services",
  "Security Services",
  "Manpower & Recruitment",
  "Education & Coaching",
  "Play School",
  "Study Abroad Consultant",
  "Mobile & Electronics",
  "CCTV & Security Systems",
  "Agriculture & Seeds",
  "Dairy & Food Products",
  "Organic Foods",
  "Catering Equipment",
  "Aluminium & Glass",
  "Other"
];

export default function SignUp({ onSwitchToLogin, onLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    category: '',
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

    if (!formData.name || !formData.email || !formData.password || !formData.phone || !formData.company || !formData.category || !formData.region || !formData.chapter) {
      setError('Please fill in all required fields.');
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
      let cleanChapter = formData.chapter.trim();
      cleanChapter = cleanChapter.replace(/^BNI\s+/i, '').replace(new RegExp(`^${formData.region.trim()}\\s+`, 'i'), '');

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
        region: formData.region.trim(),
        location: formData.region.trim().toLowerCase(),
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
            Member Registration
          </div>
          
          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Join Your Chapter Conclave &amp; Connect.
          </h2>
          
          <p className="text-zinc-400 text-body-md font-medium leading-relaxed">
            Register your member account to access 1-on-1 meeting schedules, view table seating assignments, and track your referral business.
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

      {/* Right side: Modern Clean White Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 md:p-12 bg-white relative overflow-y-auto">
        <div className="w-full max-w-md space-y-4 relative z-10 my-auto py-4">
          
          {/* Form Header */}
          <div className="space-y-1">
            {/* Mobile logo */}
            <div className="lg:hidden w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center mb-4">
              <Award className="w-5 h-5 text-white" />
            </div>
            
            <h3 className="text-2xl font-black text-zinc-955 tracking-tight">Create Member Account</h3>
            <p className="text-body-md text-zinc-500 font-medium">
              Enter your details to register for BNI Conclaves.
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
                    placeholder="member@bni.com"
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
                    {BNI_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Region & Chapter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Region Text Input */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                  Region <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    placeholder="e.g. Guntur Central"
                    required
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>

              {/* Clean Chapter Name */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-450 font-extrabold uppercase tracking-widest">
                  Chapter Name <span className="text-brand-red">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    name="chapter"
                    value={formData.chapter}
                    onChange={handleChange}
                    placeholder="e.g. Titans / Express"
                    required
                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-body-md font-semibold outline-none focus:border-zinc-800 transition-smooth placeholder-zinc-400 text-zinc-900"
                  />
                </div>
              </div>
            </div>
            <p className="text-[9.5px] text-zinc-400 font-medium -mt-1">
              Enter Region and Chapter separately (do not include "BNI" in chapter name).
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
