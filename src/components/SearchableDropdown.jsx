import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function SearchableDropdown({ label, options, value, onChange, placeholder = "Search..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return (options || []).filter(opt =>
      typeof opt === 'string' && opt.trim() !== '' && opt.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const defaultAllLabel = useMemo(() => {
    const l = label.toLowerCase();
    if (l === 'status') return 'All Status';
    if (l === 'category') return 'All Categories';
    if (l === 'availability') return 'All Availabilities';
    if (l === 'business type') return 'All Business Types';
    if (l === 'role') return 'All Roles';
    if (l.endsWith('s') || l.endsWith('x') || l.endsWith('z') || l.endsWith('ch') || l.endsWith('sh')) {
      return `All ${label}es`;
    }
    if (l.endsWith('y')) {
      return `All ${label.slice(0, -1)}ies`;
    }
    return `All ${label}s`;
  }, [label]);

  const selectedLabel = value === 'All' ? defaultAllLabel : value;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setSearch("");
          }}
          className="bg-zinc-55 border border-zinc-200 rounded-lg py-1.5 px-3 text-[11px] font-bold text-zinc-700 focus:outline-none hover:bg-zinc-100 transition-smooth flex items-center justify-between gap-1.5 min-w-[120px] cursor-pointer bg-white"
        >
          <span>{selectedLabel}</span>
          <svg className="w-3 h-3 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="origin-top-left absolute left-0 sm:left-auto sm:right-0 mt-1 min-w-[200px] w-max max-w-[280px] rounded-lg shadow-xl bg-white border border-zinc-150 ring-1 ring-black/5 z-[70] animate-fade-in">
          <div className="p-2 border-b border-zinc-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-[11px] placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-brand-red/50 text-zinc-700 font-semibold"
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1 text-[11px] font-semibold text-zinc-700">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-zinc-400 text-center">No matches</li>
            ) : (
              filteredOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-zinc-50 transition-smooth ${opt === value ? 'bg-red-50/40 text-brand-red font-extrabold' : ''
                      }`}
                  >
                    {opt === 'All' ? defaultAllLabel : opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
