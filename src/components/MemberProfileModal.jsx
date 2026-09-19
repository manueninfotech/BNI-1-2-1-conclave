import React from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, Building, Tag, Award, Send, ExternalLink, ShieldCheck } from 'lucide-react';

export default function MemberProfileModal({ member, onClose, onSendReferral, isReferralDisabled = false, referralDisabledReason = '' }) {
  if (!member) return null;

  const initials = (member.name || 'Member')
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const formattedPhone = member.phone || member.mobile || '+91 98765 43210';
  const formattedEmail = member.email || `${member.name.toLowerCase().replace(/\s+/g, '.')}@bni.com`;
  const chapter = member.chapter || 'BNI Chapter';
  const company = member.company || member.businessName || 'Business Partner';
  const category = member.category || member.businessCategory || 'Business Professional';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[80] p-4 sm:p-6 animate-fade-in font-sans">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        
        {/* Header Banner */}
        <div className="relative bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-smooth cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-red text-white border-2 border-white/20 flex items-center justify-center font-black text-xl shadow-lg shrink-0 select-none">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white truncate">{member.name}</h3>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[12px] text-zinc-300 font-semibold truncate mt-0.5">{company}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-red-500/20 border border-red-400/30 text-red-200 text-[9px] font-black uppercase tracking-wider rounded-md">
                  {category}
                </span>
                {member.isCaptain && (
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[9px] font-black uppercase tracking-wider rounded-md">
                    Table Captain
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Key Quick Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Chapter</p>
              <p className="text-[12px] font-bold text-zinc-800 mt-1 truncate">{chapter}</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Table Seating</p>
              <p className="text-[12px] font-bold text-brand-red mt-1">
                {member.tableNumber ? `Table ${member.tableNumber}` : 'Assigned Table'}
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2.5">
            <span className="text-[9.5px] font-black text-zinc-400 uppercase tracking-wider block">Contact Information</span>
            
            <div className="space-y-2 text-[12px] font-semibold text-zinc-700">
              <a
                href={`tel:${formattedPhone.replace(/\s+/g, '')}`}
                className="flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/70 rounded-xl transition-smooth group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-brand-red shrink-0" />
                  <span>{formattedPhone}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" />
              </a>

              <a
                href={`mailto:${formattedEmail}`}
                className="flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/70 rounded-xl transition-smooth group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-brand-red shrink-0" />
                  <span className="truncate max-w-[220px]">{formattedEmail}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700" />
              </a>
            </div>
          </div>

          {/* Business Overview */}
          <div className="space-y-1.5">
            <span className="text-[9.5px] font-black text-zinc-400 uppercase tracking-wider block">Business Profile</span>
            <div className="p-3.5 bg-zinc-50 border border-zinc-200/70 rounded-xl text-[11.5px] text-zinc-650 leading-relaxed font-semibold">
              Specialized in {category} solutions and high-quality services for BNI members and corporate clients. Seated for active business networking.
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center gap-3 shrink-0">
          {onSendReferral && (
            isReferralDisabled ? (
              <button
                disabled
                title={referralDisabledReason || "Referrals are only active during the dedicated Referral Window"}
                className="flex-1 py-2.5 px-4 bg-zinc-200 text-zinc-400 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                Referrals Closed
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onSendReferral(member);
                }}
                className="flex-1 py-2.5 px-4 bg-brand-red hover:bg-red-750 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-smooth flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-red/15"
              >
                <Send className="w-3.5 h-3.5" />
                Send Referral
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-smooth cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
