import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, BookOpen, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AddLibraryModal from '../components/modals/AddLibraryModal';
import api from '../Script/api';

const PAGE_SIZE = 12;

// /admin/libraries returns a collection in one of several envelope shapes.
const getCollection = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
};

const LibraryManagement = () => {
    const navigate = useNavigate();
    // The admin token only authorizes /admin/libraries (the paginated
    // /admin/all_libraries + /admin/brands endpoints are employee-scoped and
    // 401 here), so we fetch the full list once and filter/paginate client-side.
    const [allLibraries, setAllLibraries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [page, setPage] = useState(1);
    const [isAddOpen, setIsAddOpen] = useState(false);

    const loadLibraries = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.libraries.list();
            setAllLibraries(getCollection(res.data));
        } catch {
            setError('Could not load libraries. Please try again.');
            setAllLibraries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLibraries();
    }, [loadLibraries]);

    const brands = useMemo(
        () => [...new Set(allLibraries.map((l) => l.company_name).filter(Boolean))].sort(),
        [allLibraries]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allLibraries.filter((l) => {
            if (selectedBrand && l.company_name !== selectedBrand) return false;
            if (!q) return true;
            return `${l.company_name ?? ''} ${l.manufacturer_id ?? ''}`.toLowerCase().includes(q);
        });
    }, [allLibraries, search, selectedBrand]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const libraries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearchChange = (value) => {
        setSearch(value);
        setPage(1);
    };

    const handleBrandChange = (brand) => {
        setSelectedBrand(brand);
        setPage(1);
    };

    const handlePageChange = (newPage) => setPage(newPage);

    return (
        <div className="p-6 lg:p-10">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">Library Management</h1>
                    <p className="text-slate-500 font-medium text-sm lg:text-base">
                        {total > 0 ? `${total} implant librar${total === 1 ? 'y' : 'ies'} registered` : 'Manage implant system libraries'}
                    </p>
                </div>
                <Button
                    onClick={() => setIsAddOpen(true)}
                    className="h-12 px-6 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 w-fit"
                >
                    <Plus size={18} />
                    Add Library
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 lg:gap-4 mb-6">
                <div className="flex-1 lg:w-80 relative min-w-[200px]">
                    <Input
                        placeholder="Search by brand..."
                        icon={Search}
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="bg-white border-slate-100 shadow-sm h-11 lg:h-12 rounded-xl w-full"
                    />
                </div>
                <select
                    value={selectedBrand}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    className="h-11 lg:h-12 px-4 bg-white border border-slate-100 rounded-xl text-slate-700 font-bold text-sm shadow-sm focus:outline-none focus:border-[#0d9488]/40"
                >
                    <option value="">All Brands</option>
                    {brands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
                {(search || selectedBrand) && (
                    <button
                        onClick={() => { setSearch(''); setSelectedBrand(''); setPage(1); }}
                        className="h-11 lg:h-12 px-4 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
                    >
                        Clear
                    </button>
                )}
            </div>

            {error ? (
                <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                    {error}
                </div>
            ) : null}

            {/* Table */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[720px]">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                <th className="px-6 lg:px-8 py-4 lg:py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company</th>
                                <th className="px-6 lg:px-8 py-4 lg:py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manufacturer ID</th>
                                <th className="px-6 lg:px-8 py-4 lg:py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Angle Alignment</th>
                                <th className="px-6 lg:px-8 py-4 lg:py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tolerance</th>
                                <th className="px-6 lg:px-8 py-4 lg:py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Alignment</th>
                                <th className="px-6 lg:px-8 py-4 lg:py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50 animate-pulse">
                                        <td className="px-6 lg:px-8 py-5"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                                        <td className="px-6 lg:px-8 py-5"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                                        <td className="px-6 lg:px-8 py-5"><div className="h-4 w-12 bg-slate-100 rounded mx-auto" /></td>
                                        <td className="px-6 lg:px-8 py-5"><div className="h-4 w-12 bg-slate-100 rounded mx-auto" /></td>
                                        <td className="px-6 lg:px-8 py-5"><div className="h-4 w-16 bg-slate-100 rounded mx-auto" /></td>
                                        <td className="px-6 lg:px-8 py-5"><div className="h-4 w-16 bg-slate-100 rounded ml-auto" /></td>
                                    </tr>
                                ))
                            ) : libraries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <BookOpen size={32} strokeWidth={1.5} />
                                            <p className="font-bold text-slate-500">No libraries found</p>
                                            <p className="text-sm">Add a library to get started.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                libraries.map((lib) => (
                                    <tr
                                        key={lib.id}
                                        onClick={() => navigate(`/library/edit/${lib.id}`, { state: { library: lib } })}
                                        className="group hover:bg-[#eefcfb] hover:shadow-[inset_4px_0_0_0_#0d9488] transition-all border-b border-slate-50 whitespace-nowrap cursor-pointer"
                                    >
                                        <td className="px-6 lg:px-8 py-4 lg:py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-[#eefcfb] flex items-center justify-center text-[#0d9488] font-bold text-sm flex-shrink-0">
                                                    {(lib.company_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-900">{lib.company_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 lg:px-8 py-4 lg:py-5 text-sm font-bold text-slate-600">{lib.manufacturer_id || '—'}</td>
                                        <td className="px-6 lg:px-8 py-4 lg:py-5 text-center">
                                            <span className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-clinical-blue/10 text-clinical-blue">
                                                {(lib.angle_degree ?? lib.angle_alignment) != null ? `${lib.angle_degree ?? lib.angle_alignment}°` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 lg:px-8 py-4 lg:py-5 text-center text-sm font-bold text-slate-600">
                                            {lib.tolerance_degree != null ? `${lib.tolerance_degree}°` : '—'}
                                        </td>
                                        <td className="px-6 lg:px-8 py-4 lg:py-5 text-center">
                                            {/* Whether this library can actually produce an
                                                alignment job. It used to look configured as soon
                                                as it had files and a vendor id, while being unable
                                                to run anything — the failure then surfaced days
                                                later as a dentist's stuck case. */}
                                            {lib.alignment_ready ? (
                                                <span
                                                    title={lib.bundle_version ? `Bundle ${lib.bundle_version.replace('sha256:', '').slice(0, 12)}…` : 'Ready'}
                                                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-bold bg-teal-50 text-teal-700"
                                                >
                                                    <CheckCircle2 size={12} /> Ready
                                                </span>
                                            ) : (
                                                <span
                                                    title={lib.alignment_blocked_reason || 'Cannot align yet'}
                                                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-bold bg-amber-50 text-amber-700"
                                                >
                                                    <AlertTriangle size={12} /> Not ready
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 lg:px-8 py-4 lg:py-5 text-right">
                                            <Link
                                                to={`/library/edit/${lib.id}`}
                                                state={{ library: lib }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0d9488] hover:underline"
                                            >
                                                <Pencil size={14} />
                                                Edit
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-6">
                    <button
                        disabled={page === 1}
                        onClick={() => handlePageChange(page - 1)}
                        className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 grid place-content-center disabled:opacity-40 hover:bg-slate-50 transition-all"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-bold text-slate-500">Page {page} of {totalPages}</span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => handlePageChange(page + 1)}
                        className="h-10 w-10 rounded-xl border border-slate-200 text-slate-500 grid place-content-center disabled:opacity-40 hover:bg-slate-50 transition-all"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            <AddLibraryModal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                onSuccess={loadLibraries}
            />
        </div>
    );
};

export default LibraryManagement;
