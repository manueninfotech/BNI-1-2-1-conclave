import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, AlertCircle, Sparkles, Building2, Tag, Loader2, Clock } from 'lucide-react';
import { addNotification } from '../utils/notifications';
import { api } from '../services/api';

export default function ReferModal({
  recipient,
  loggedInUser,
  activeConclaveId,
  isReferralOpen = true,
  isTalkingTimeActive,
  disabledReason = 'Referrals are only open during the dedicated Referral Window (after table member speaking concludes).',
  onClose,
  onSuccess
}) {
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check whether referral submission is allowed
  const isAllowed = isTalkingTimeActive !== undefined ? isTalkingTimeActive : isReferralOpen;

  // Lock background scrolling when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAllowed) {
      setError(disabledReason || 'Referral sending is only allowed during the referral exchange window.');
      return;
    }
    if (!description.trim()) {
      setError('Please enter referral opportunity details.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const fromUid = loggedInUser?.uid || loggedInUser?.id || loggedInUser?._originalUid || 'member';
    const toUid = recipient?.uid || recipient?.id || recipient?._originalUid || 'recipient';
    const refId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const conclaveIdToUse = activeConclaveId || 'conc_1784874808479';

    const newReferral = {
      id: refId,
      conclaveId: conclaveIdToUse,
      fromUserId: fromUid,
      fromMemberId: fromUid,
      fromName: loggedInUser?.name || 'BNI Member',
      toUserId: toUid,
      toMemberId: toUid,
      toName: recipient?.name || 'BNI Member',
      notes: description,
      description: description,
      roundNumber: recipient?.roundNumber || 1,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };

    // 1. Save to local storage backup
    try {
      const stored = localStorage.getItem('bni_referrals');
      const referrals = stored ? JSON.parse(stored) : [];
      const updatedList = [newReferral, ...referrals];
      localStorage.setItem('bni_referrals', JSON.stringify(updatedList));
    } catch {}

    // 2. Submit to backend API if active conclave ID is present
    try {
      await api.post(`/conclaves/${conclaveIdToUse}/sync`, {
        referrals: [{
          id: refId,
          fromUserId: fromUid,
          fromName: loggedInUser?.name || 'BNI Member',
          toUserId: toUid,
          toName: recipient?.name || 'BNI Member',
          roundNumber: recipient?.roundNumber || 1,
          notes: description,
          timestamp: new Date().toISOString()
        }]
      });
    } catch (err) {
      console.warn("Backend sync failed for referral (stored locally):", err.message);
    }

    // Push notification to sender's feed
    addNotification(
      'Referral Sent',
      `Submitted referral lead slip for ${recipient?.name || 'Recipient'}.`,
      'success',
      { senderUid: fromUid, targetUid: fromUid, conclaveId: conclaveIdToUse }
    );

    // Push notification to recipient's feed
    if (toUid && toUid !== fromUid) {
      addNotification(
        'New Referral Received',
        `You received a new referral lead slip from ${loggedInUser?.name || 'a member'}.`,
        'info',
        { senderUid: fromUid, targetUid: toUid, conclaveId: conclaveIdToUse }
      );
    }


    setIsSubmitting(false);
    if (onSuccess) {
      onSuccess(`Referral slip submitted for ${recipient?.name || 'Recipient'}!`);
    }
    onClose();
  };

  const recipientInitials = recipient?.name
    ? recipient.name.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase()
    : 'BNI';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[999] flex items-center justify-center p-4 sm:p-6 animate-fade-in font-sans">
      <div className="bg-white border border-zinc-200/80 w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden animate-scale-up text-left flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-150 flex items-center justify-between bg-zinc-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-brand-red shrink-0 shadow-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-body-sm font-black text-zinc-900 leading-tight">Send Referral Slip</h3>
              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Share a warm business lead with your fellow member</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200/70 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[60vh]">
          
          {!isAllowed && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-amber-900 text-[11.5px] font-semibold leading-relaxed shadow-2xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Referrals Inactive</p>
                <p className="text-[10.5px] text-amber-800 mt-0.5">
                  {disabledReason || 'Referrals are only active during the dedicated 30s/person Referral Window after speaking concludes.'}
                </p>
              </div>
            </div>
          )}

          {/* Recipient card summary (pre-filled & locked) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-450 uppercase tracking-widest block">BNI Recipient (Locked)</label>
              <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/60">Verified Member</span>
            </div>

            <div className="p-3.5 border border-zinc-200/80 bg-zinc-50/80 rounded-xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-red to-red-700 text-white rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm shadow-brand-red/20">
                {recipientInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-xs font-black text-zinc-900 truncate leading-snug">{recipient?.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500 font-semibold truncate">
                  <span className="truncate flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-zinc-400 shrink-0" />
                    {recipient?.company || 'BNI Chapter Member'}
                  </span>
                </div>
                {recipient?.category && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-red-50 text-brand-red text-[8.5px] font-black rounded border border-red-100 uppercase tracking-wider">
                    <Tag className="w-2.5 h-2.5" />
                    {recipient.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details / Lead Info */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-450 uppercase tracking-widest block">Lead Opportunity Details</label>
            <div className="relative">
              <textarea
                value={description}
                disabled={!isTalkingTimeActive}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError('');
                }}
                placeholder={isTalkingTimeActive ? "E.g., I have a client looking to redesign their office space, please contact their admin at contact@email.com." : "Referral sending is closed because round talking time has ended."}
                rows="4"
                className={`w-full p-3.5 border rounded-xl text-[12px] font-semibold transition-smooth placeholder-zinc-400 resize-none leading-relaxed shadow-2xs ${
                  !isTalkingTimeActive
                    ? 'border-zinc-200 bg-zinc-100/70 text-zinc-400 cursor-not-allowed'
                    : 'border-zinc-200/90 bg-white text-zinc-800 focus:outline-none focus:border-brand-red focus:ring-3 focus:ring-brand-red/10'
                }`}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 p-3 rounded-xl text-brand-red text-[11px] font-bold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isTalkingTimeActive}
              className={`w-full py-3 rounded-xl text-[11.5px] font-black uppercase tracking-wider transition-smooth flex items-center justify-center gap-2 shadow-xs ${
                !isTalkingTimeActive
                  ? 'bg-zinc-200 text-zinc-400 border border-zinc-250 cursor-not-allowed shadow-none'
                  : 'bg-brand-red hover:bg-red-700 disabled:bg-zinc-300 text-white cursor-pointer shadow-brand-red/15'
              }`}
            >
              {!isTalkingTimeActive ? (
                <span>Referrals Closed</span>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Referral...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Referral Slip</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
