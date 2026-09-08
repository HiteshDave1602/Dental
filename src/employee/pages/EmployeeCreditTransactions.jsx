import { useEffect, useState } from 'react';
import { Coins, ArrowUpRight, ArrowDownLeft, Lock, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { extractErrorMessage } from '../../Script/api';

const PAGE_SIZE = 20;

const TYPE_META = {
    grant: { label: 'Granted', color: 'bg-emerald-100 text-emerald-700', icon: undefined, sign: '+' },
    hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-700', icon: Lock, sign: '-' },
    commit: { label: 'Committed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2, sign: '-' },
    revert: { label: 'Reverted', color: 'bg-sky-100 text-sky-700', icon: RotateCcw, sign: '+' },
};

const getTypeMeta = (value, { amount } = {}) => {
    const key = String(value || '').toLowerCase();
    const meta = TYPE_META[key];
    if (meta) return meta;
    if (amount > 0) return TYPE_META.grant;
    return TYPE_META.commit;
};

const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const EmployeeCreditTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const load = async (pageNum) => {
        setLoading(true);
        setError('');
        try {
            const res = await api.employee.credits.transactions({
                page: pageNum,
                size: PAGE_SIZE,
            });
            const payload = res.data?.data ?? res.data ?? {};
            const items = Array.isArray(payload)
                ? payload
                : payload.items || payload.transactions || payload.results || [];
            setTransactions(items);
            setTotal(payload.total ?? payload.pagination?.total ?? items.length);
            setTotalPages(payload.pages ?? payload.pagination?.pages ?? Math.max(1, Math.ceil((payload.total ?? items.length) / PAGE_SIZE)));
        } catch (err) {
            setError(extractErrorMessage(err, 'Failed to load transaction history.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, []);

    return (
        <div className="space-y-5 text-[#12344D]">
            <section className="glass-card p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="grid h-10 w-10 place-content-center rounded-xl bg-[#c1e5ff] text-[#072ac8]">
                        <Coins size={20} />
                    </div>
                    <div>
                        <h2 className="employee-heading text-lg font-bold text-[#12344D]">Credit Transactions</h2>
                        <p className="text-xs text-[#12344D]/60">Full audit trail of your credit movements</p>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-[#9cd5ff]/50 bg-white">
                    {loading ? (
                        <div className="p-10 text-center text-sm text-[#12344D]/60">Loading transactions...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-10 text-center">
                            <Coins size={28} className="mx-auto text-[#12344D]/30" />
                            <p className="mt-3 text-sm text-[#12344D]/60">No credit transactions yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px]">
                                <thead className="bg-[#c1e5ff]/30 text-left text-xs font-semibold uppercase tracking-wider text-[#12344D]/60">
                                    <tr>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, index) => {
                                        const amount = Number(tx.amount ?? 0);
                                        const meta = getTypeMeta(tx.transaction_type ?? tx.type, { amount });
                                        const IconComp = meta.icon;
                                        return (
                                            <tr key={tx.id || `${tx.created_at}-${index}`} className="border-t border-[#9cd5ff]/35 hover:bg-[#c1e5ff]/40 transition-colors">
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
                                                        {IconComp && <IconComp size={12} />}
                                                        {meta.label}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1 text-sm font-bold ${amount > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {amount > 0 ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                                                        {amount > 0 ? '+' : ''}{amount.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-[#12344D]/80">{tx.description || tx.reason || '—'}</td>
                                                <td className="p-4 text-xs text-[#12344D]/60">{formatDate(tx.created_at ?? tx.timestamp)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between gap-4">
                        <p className="text-xs text-[#12344D]/60">
                            Page {page} of {totalPages} · {total.toLocaleString()} transactions
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => { const np = page - 1; setPage(np); load(np); }}
                                className="grid h-8 w-8 place-content-center rounded-lg border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/50 disabled:opacity-40"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                type="button"
                                disabled={page === totalPages}
                                onClick={() => { const np = page + 1; setPage(np); load(np); }}
                                className="grid h-8 w-8 place-content-center rounded-lg border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/50 disabled:opacity-40"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default EmployeeCreditTransactions;
