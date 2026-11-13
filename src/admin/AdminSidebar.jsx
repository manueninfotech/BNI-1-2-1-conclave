import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarRange, Users, Settings as SettingsIcon, Wallet, ShieldCheck, LogOut, X, History } from 'lucide-react';

/**
 * The admin menu. Four places for an admin; a superadmin also gets Revenue
 * and Admins & Regions. Supports desktop collapsible rail (72px / 232px).
 */
export default function AdminSidebar({ base, role, isOpen, onClose, onLogout, isCollapsed, onToggleCollapse }) {
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
    { to: `${base}/activity`, label: 'Activity', Icon: History },
    { to: `${base}/settings`, label: 'Settings', Icon: SettingsIcon },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 h-screen flex flex-col pt-4 pb-5 bg-deep-red border-r border-[#8F0B21] text-white shrink-0 transition-all duration-300 ease-in-out lg:static ${
        isOpen ? 'translate-x-0 shadow-2xl w-[250px]' : '-translate-x-full'
      } lg:translate-x-0 ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[232px]'}`}
    >
      {/* Brand Header */}
      <div className="px-3 mb-5 shrink-0 flex items-center justify-between relative">
        {!isCollapsed ? (
          <div className="flex items-center justify-center w-full px-1">
            <img src="/lockup-horizontal-white.png" alt="1-2-1 Connect" className="h-12 w-auto max-w-[200px] object-contain transition-all" />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <img
              src="/mark-white.png"
              alt="1-2-1 Connect"
              className="w-10 h-10 object-contain transition-all"
              title="1-2-1 Connect"
            />
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-[13px] font-semibold transition-all group relative ${
                isActive ? 'bg-white text-deep-red shadow-sm font-bold' : 'text-white/85 hover:bg-white/12 hover:text-white'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {!isCollapsed && <span className="truncate">{label}</span>}
            {isCollapsed && (
              <div className="hidden group-hover:lg:block absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 text-white text-xs font-bold rounded-md whitespace-nowrap shadow-lg z-50 pointer-events-none">
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer area */}
      <div className="mt-auto px-2 pt-3 border-t border-white/15 shrink-0 space-y-1">
        {/* Logout Button */}
        <button
          onClick={onLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-xl text-[13px] font-semibold text-white/85 hover:bg-white/12 hover:text-white cursor-pointer transition-colors group relative`}
          title={isCollapsed ? "Log out" : undefined}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!isCollapsed && <span className="truncate">Log out</span>}
          {isCollapsed && (
            <div className="hidden group-hover:lg:block absolute left-full ml-3 px-2.5 py-1 bg-zinc-900 text-white text-xs font-bold rounded-md whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Log out
            </div>
          )}
        </button>

        {!isCollapsed && (
          <p className="pt-2 text-center text-[9.5px] text-white/60 font-semibold truncate">
            Powered by <span className="text-white/95 font-extrabold">Manuen Infotech</span>
          </p>
        )}
      </div>
    </aside>
  );
}
