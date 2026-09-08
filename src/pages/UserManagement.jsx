import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Search,
    ChevronRight,
    ChevronLeft,
    Users,
    Eye,
    Plus,
} from 'lucide-react';
import { cn } from '../utils/utils';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../Script/api';
import UserDetailModal from '../components/modals/UserDetailModal';
import CreateUserModal from '../components/modals/CreateUserModal';

const PAGE_SIZE = 10;

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const debounceRef = useRef(null);

    const [selectedUserId, setSelectedUserId] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loadUsers = useCallback(async (searchVal, pageNum) => {
        setLoading(true);
        setError('');
        try {
            const params = { page: pageNum, size: PAGE_SIZE };
            if (searchVal) params.search = searchVal;
            const res = await api.admin.listUsers(params);
            const payload = res.data;
            setUsers(payload?.data ?? []);
            setTotal(payload?.total ?? 0);
            setTotalPages(payload?.pages ?? 1);
        } catch (err) {
            setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to load users.');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers('', 1);
    }, [loadUsers]);

    const handleSearchChange = (value) => {
        setSearchTerm(value);
        setPage(1);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => loadUsers(value, 1), 400);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        loadUsers(searchTerm, newPage);
    };

    return (
        <div className="flex-1 bg-[#f8fafc] min-h-screen p-6 lg:p-10 overflow-y-auto custom-scrollbar">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm font-semibold text-slate-400 mb-8">
                <span className="text-slate-600">Admin</span>
                <ChevronRight size={14} />
                <span className="text-slate-900">User Management</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-3">User Management</h1>
                    <p className="text-slate-500 font-medium text-lg">
                        {total > 0 ? `${total.toLocaleString()} registered user${total === 1 ? '' : 's'}` : 'Platform users, plans, and credit balances.'}
                    </p>
                </div>

                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="h-12 px-6 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
                >
                    <Plus size={20} />
                    Create New User
                </Button>
            </div>

            {/* Search */}
            <div className="bg-white p-4 lg:p-6 rounded-[24px] shadow-sm border border-slate-100 mb-8">
                <div className="flex-1 relative">
                    <Input
                        placeholder="Search by name or email..."
                        icon={Search}
                        className="h-12 bg-slate-50/50 border-slate-100 rounded-xl w-full text-[15px]"
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {error ? (
                <div className="mb-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                    {error}
                </div>
            ) : null}

            {/* Users Table */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden mb-10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                        <thead>
                            <tr className="bg-white border-b border-slate-50">
                                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Name & Email</th>
                                <th className="px-4 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Plan</th>
                                <th className="px-4 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Credits</th>
                                <th className="px-4 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Cases</th>
                                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Role</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-8 py-5"><div className="h-4 w-40 bg-slate-100 rounded" /></td>
                                        <td className="px-4 py-5"><div className="h-4 w-16 bg-slate-100 rounded mx-auto" /></td>
                                        <td className="px-4 py-5"><div className="h-4 w-12 bg-slate-100 rounded" /></td>
                                        <td className="px-4 py-5"><div className="h-4 w-8 bg-slate-100 rounded mx-auto" /></td>
                                        <td className="px-8 py-5"><div className="h-4 w-12 bg-slate-100 rounded mx-auto" /></td>
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <Users size={32} strokeWidth={1.5} />
                                            <p className="font-bold text-slate-500">No users found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => { setSelectedUserId(user.id); setShowDetailModal(true); }}>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-bold text-slate-600 border border-white shadow-sm overflow-hidden flex-shrink-0">
                                                    {(user.username || user.email || '?').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-bold text-slate-900 leading-tight truncate">{user.username || 'Unnamed'}</span>
                                                    <span className="text-[12px] font-medium text-slate-400 mt-0.5 truncate">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold capitalize",
                                                user.active_plan && user.active_plan !== 'free' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
                                            )}>
                                                {user.active_plan || 'free'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm font-bold text-slate-900">{Number(user.credits ?? 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-sm font-bold text-slate-700">{user.cases_count ?? 0}</td>
                                        <td className="px-8 py-4 text-center">
                                            <span className={cn(
                                                "text-[11px] px-2.5 py-1 rounded-lg font-bold",
                                                user.is_admin ? "bg-teal-50 text-teal-600" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {user.is_admin ? 'Admin' : 'User'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-5 bg-white border-t border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-slate-400">
                            Page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{totalPages}</span> · {total.toLocaleString()} users
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-40"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
                                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-100 text-slate-400 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-40"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <UserDetailModal
                isOpen={showDetailModal}
                onClose={() => { setShowDetailModal(false); setSelectedUserId(null); }}
                userId={selectedUserId}
            />

            <CreateUserModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreated={() => loadUsers(searchTerm, page)}
            />
        </div>
    );
};

export default UserManagement;
