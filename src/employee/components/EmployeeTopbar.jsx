import { Bell, Search } from 'lucide-react';
import { useEmployee } from '../../context/EmployeeContext';

const EmployeeTopbar = ({ title }) => {
  const { employeeUser } = useEmployee();
  const displayName = employeeUser?.name || 'User';

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

        <div className="flex h-10 items-center gap-2 rounded-xl border border-[#9cd5ff] bg-[#f6fbfe] p-1 pr-3">
          <span className="grid h-8 w-8 place-content-center rounded-lg bg-[#072ac8] text-xs font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="max-w-28 truncate text-xs font-bold text-[#12344D]">{displayName}</p>
            <p className="text-[9px] text-[#072ac8]/70">Online</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default EmployeeTopbar;
