import {
  BadgePlus,
  Coins,
  FolderKanban,
  LayoutDashboard,
  // Library,
  LogOut,
  Settings,
  WalletCards,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/utils';
import { useEmployee } from '../../context/EmployeeContext';
import { useCaseStore } from '../../store/caseStore';
import pathfinderLogo from '../../assets/images/MY PATHFINDER LOGO.JPG.jpeg';

const menuGroups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'New Case', to: '/new-case', icon: BadgePlus },
      { label: 'My Cases', to: '/my-cases', icon: FolderKanban },
      // { label: 'Library', to: '/library', icon: Library },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Subscription', to: '/subscription', icon: WalletCards },
      // { label: 'Credit History', to: '/credits', icon: Coins },
      // { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

const railItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-case', icon: BadgePlus, label: 'New Case' },
  { to: '/my-cases', icon: FolderKanban, label: 'My Cases' },
  // { to: '/library', icon: Library, label: 'Library' },
  { to: '/subscription', icon: WalletCards, label: 'Subscription' },
  { to: '/credits', icon: Coins, label: 'Credit History' },
];

const EmployeeSidebar = ({ collapsed, mobileOpen = false, onCloseMobile = () => {} }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { employeeUser, logoutEmployee } = useEmployee();
  const displayName = employeeUser?.name || employeeUser?.email || 'User';
  const displayEmail = employeeUser?.email || 'Dental professional';

  const handleNewCase = () => {
    // Always start a brand-new case from Step 1 (Patient Details). Discard the
    // persisted draft — an in-progress case is only resumed explicitly via the
    // Resume action in My Cases / Dashboard, never implicitly from New Case.
    useCaseStore.getState().resetCase();
    navigate('/new-case');
  };

  const showFullMenu = !collapsed || mobileOpen;
  const showRail = collapsed && !mobileOpen;

  return (
    <>
      {/* Semi-transparent backdrop behind the mobile drawer — tapping it closes
          the sidebar. Hidden on lg+ where the sidebar is always visible. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        onClickCapture={onCloseMobile}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] border-r border-white/15 bg-[#2541b2] p-2 transition-transform duration-300 ease-in-out lg:transition-[width,transform]',
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-16' : ''
        )}
      >
      <button
        type="button"
        onClick={onCloseMobile}
        aria-label="Close sidebar"
        title="Close sidebar"
        className="absolute right-3 top-5 z-20 grid h-7 w-7 place-content-center rounded-full border border-white/30 bg-[#2541b2] text-white transition-colors hover:bg-white/20 lg:hidden"
      >
        <X size={15} />
      </button>

      {showRail && (
        <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-white/15 bg-[#2541b2] py-3 text-white shadow-[0_10px_28px_rgba(37,65,178,0.35)]">
          <Link
            to="/dashboard"
            aria-label="MyPathFinder home"
            className="grid h-10 w-10 place-content-center overflow-hidden rounded-xl bg-white transition-colors hover:bg-white/90"
          >
            <img src={pathfinderLogo} alt="" className="h-full w-full object-contain p-0.5" />
          </Link>

          <div className="mt-5 w-full flex-1">
            <div aria-hidden="true" className="h-[22px]" />
            <nav className="space-y-1">
              {railItems.slice(0, 4).map((item) => {
                const active = pathname === item.to;
                const isNewCase = item.to === '/new-case';
                if (isNewCase) {
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={handleNewCase}
                      title={item.label}
                      aria-label={item.label}
                      className={cn(
                        'mx-auto grid h-10 w-10 place-content-center rounded-xl transition-all',
                        active
                          ? 'bg-white/25 text-white shadow-inner'
                          : 'text-white/80 hover:bg-white/20 hover:text-white'
                      )}
                    >
                      <item.icon size={16} />
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    aria-label={item.label}
                    className={cn(
                      'mx-auto grid h-10 w-10 place-content-center rounded-xl transition-all',
                      active
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'text-white/80 hover:bg-white/20 hover:text-white'
                    )}
                  >
                    <item.icon size={16} />
                  </Link>
                );
              })}
            </nav>

            <div aria-hidden="true" className="my-4 h-px bg-white/20" />
            <div aria-hidden="true" className="h-[22px]" />
            {railItems.slice(4).map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  aria-label={item.label}
                  className={cn(
                    'mx-auto grid h-10 w-10 place-content-center rounded-xl transition-all',
                    active
                      ? 'bg-white/25 text-white shadow-inner'
                      : 'text-white/80 hover:bg-white/20 hover:text-white'
                  )}
                >
                  <item.icon size={16} />
                </Link>
              );
            })}
          </div>

          <Link
            to="/settings"
            title="Settings"
            aria-label="Settings"
            className="grid h-10 w-10 place-content-center rounded-xl text-white transition-colors hover:bg-white/20"
          >
            <Settings size={16} />
          </Link>
        </div>
      )}

      <div
        className={cn(
          'min-w-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-3 transition-opacity duration-200',
          showFullMenu ? 'flex opacity-100' : 'hidden opacity-0'
        )}
      >
        <div className="mb-5 flex items-center gap-3 px-1">
          <img src={pathfinderLogo} alt="My Pathfinder" className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-0.5 shadow-md shadow-black/10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{displayName}</p>
            <p className="truncate text-[10px] text-white/65">{displayEmail}</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#c1e5ff] ring-4 ring-white/15" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {menuGroups.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(
                'pb-4',
                groupIndex > 0 && 'border-t border-white/15 pt-4'
              )}
            >
              <p className="flex h-[22px] items-start px-2 text-[10px] font-semibold tracking-wide text-white/55">
                {group.label}
              </p>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  const isNewCase = item.to === '/new-case';
                  if (isNewCase) {
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={handleNewCase}
                        className={cn(
                          'group grid h-10 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-all duration-200 w-full text-left',
                          active
                            ? 'border-white/80 bg-white/90 text-[#12344D] shadow-[0_7px_18px_rgba(106,176,227,0.25)]'
                            : 'border-transparent text-white/80 hover:bg-white/15 hover:text-white'
                        )}
                      >
                        <item.icon
                          size={16}
                          className={cn(
                            'transition-colors',
                            active ? 'text-[#072ac8]' : 'text-white/70 group-hover:text-white'
                          )}
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'group grid h-10 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-all duration-200',
                        active
                          ? 'border-white/80 bg-white/90 text-[#12344D] shadow-[0_7px_18px_rgba(106,176,227,0.25)]'
                          : 'border-transparent text-white/80 hover:bg-white/15 hover:text-white'
                      )}
                    >
                      <item.icon
                        size={16}
                        className={cn(
                          'transition-colors',
                          active ? 'text-[#072ac8]' : 'text-white/70 group-hover:text-white'
                        )}
                      />
                      <span className="min-w-0 truncate">{item.label}</span>
                      {active && (
                        <span className="grid h-5 min-w-5 place-content-center rounded-full bg-[#072ac8] px-1 text-[9px] text-white">
                          0
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-white/15 pt-3">
          <button
            type="button"
            onClick={logoutEmployee}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </aside>
    </>
  );
};

export default EmployeeSidebar;
