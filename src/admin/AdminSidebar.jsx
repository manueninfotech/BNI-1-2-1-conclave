import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarRange, Users, Settings as SettingsIcon, Wallet, ShieldCheck, LogOut, X } from 'lucide-react';

/**
 * The admin menu. Four places for an admin; a superadmin also gets Revenue
 * and Admins & Regions. Everything about one conclave lives inside that
 * conclave (Conclaves → open one), not in the menu.
 */
export default function AdminSidebar({ base, role, isOpen, onClose, onLogout }) {
  const items = [
    { to: `${base}`, label: 'Home', Icon: Home, end: true },
    { to: `${base}/conclaves`, label: 'Conclaves', Icon: CalendarRange },
    { to: `${base}/people`, label: 'People', Icon: Users },
    ...(role === 'superadmin'
      ? [
          { to: `${base}/revenue`, label: 'Revenue', Icon: Wallet },
          { to: `${base}/admins`, label: 'Admins & Regions', Icon: ShieldCheck },
        ]
      : []),
    { to: `${base}/settings`, label: 'Settings', Icon: SettingsIcon },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-[250px] h-screen flex flex-col pt-4 pb-6 bg-zinc-50 border-r border-red-100 shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-[232px] ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
    >
      <div className="px-4 mb-6 shrink-0 flex items-center justify-center relative">
        <img src="/bni-conclave.png" alt="BNI 121 Conclave" className="h-14 w-auto object-contain" />
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-200 text-zinc-500 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 space-y-1">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-smooth ${
                isActive ? 'bg-brand-red text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2.5 pt-4 border-t border-zinc-200 shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold text-zinc-700 hover:bg-red-50 hover:text-brand-red cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Log out
        </button>
        <p className="pt-3 text-center text-[9.5px] text-zinc-400 font-semibold">
          Powered by <span className="text-zinc-600 font-extrabold">Manuen Infotech</span>
        </p>
      </div>
    </aside>
  );
}
