import { useEffect, useRef, useState } from 'react';
import { Bell, Search, User, Crown, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEmployee } from '../../context/EmployeeContext';

const EmployeeTopbar = ({ title }) => {
  const { employeeUser, logoutEmployee } = useEmployee();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = employeeUser?.name || 'User';
  const displayEmail = employeeUser?.email || '';
  const displayPlan = employeeUser?.plan || 'Free';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-3 z-10 mx-3 mt-3 flex h-[76px] items-center justify-between rounded-2xl border border-[#9cd5ff] bg-white px-4 shadow-[0_10px_30px_rgba(37,65,178,0.20)] sm:px-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6ab0e3]">
          MyPathFinder
        </p>
        <h1 className="employee-heading text-xl font-bold tracking-tight text-[#072ac8]">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        <label className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-[#9cd5ff] bg-[#f6fbfe] px-3 text-[#6ab0e3] transition-all focus-within:border-[#6ab0e3] focus-within:bg-white lg:flex">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search workspace"
            className="min-w-0 flex-1 bg-transparent text-xs text-[#12344D] outline-none placeholder:text-[#12344D]/45"
          />
        </label>

        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-content-center rounded-xl border border-[#9cd5ff] bg-[#f6fbfe] text-[#072ac8] transition-all hover:border-[#0a2472] hover:bg-[#0a2472] hover:text-white"
        >
          <Bell size={16} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#6ab0e3] ring-2 ring-[#c1e5ff]" />
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 items-center gap-2 rounded-xl border border-[#9cd5ff] bg-[#f6fbfe] p-1 pr-3 transition-all hover:border-[#0a2472] hover:bg-white"
          >
            <span className="grid h-8 w-8 place-content-center rounded-lg bg-[#072ac8] text-xs font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="max-w-28 truncate text-xs font-bold text-[#12344D]">{displayName}</p>
              <p className="text-[9px] text-[#072ac8]/70">Online</p>
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-2xl border border-[#9cd5ff] bg-white shadow-[0_16px_40px_rgba(10,36,114,0.25)]"
            >
              <div className="border-b border-[#9cd5ff]/40 bg-[#f6fbfe] px-4 py-3">
                <p className="truncate text-sm font-bold text-[#12344D]">{displayName}</p>
                {displayEmail && (
                  <p className="mt-0.5 truncate text-xs text-[#12344D]/55">{displayEmail}</p>
                )}
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#c1e5ff] px-2 py-0.5 text-[10px] font-semibold text-[#0a2472] border border-[#6ab0e3]">
                  <Crown size={10} />
                  {displayPlan}
                </span>
              </div>

              <div className="p-1.5">
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#12344D] transition-colors hover:bg-[#c1e5ff]/50"
                >
                  <User size={16} className="text-[#072ac8]" />
                  My Profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logoutEmployee}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default EmployeeTopbar;