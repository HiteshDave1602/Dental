import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
    ChevronRight,
    Info,
    Box,
    FileCode,
    Trash2,
    Download,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AlignmentVendorSelect from '../components/AlignmentVendorSelect';
import api, { RESOLVED_BASE_URL, extractErrorMessage, notifySuccess, notifyError } from '../Script/api';

const ASSET_LABELS = {
    scan_body: { title: 'Scan Body Geometry', subtitle: 'Primary reference for digital impression analysis' },
    analog: { title: 'Analog Interface Geometry', subtitle: 'Interface mapping for physical analog placement' },
    angle: { title: 'Angle Alignment Geometry', subtitle: 'Angle correction reference asset' },
};

const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Library assets used to be linked straight to a public /uploads path. They
// are now behind an admin-only route, so they are fetched with the token and
// saved from the response instead of being opened as a URL.

const UpdateLibrary = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [library, setLibrary] = useState(location.state?.library ?? null);
    const [loading, setLoading] = useState(!location.state?.library);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        company_name: '',
        manufacturer_id: '',
        tolerance_degree: '',
        angle_degree: '',
        alignment_vendor_id: '',
    });
    const [saving, setSaving] = useState(false);

    // Seed the editable fields once the library is available.
    useEffect(() => {
        if (!library) return;
        setForm({
            company_name: library.company_name ?? '',
            manufacturer_id: library.manufacturer_id ?? '',
            tolerance_degree: library.tolerance_degree ?? '',
            angle_degree: library.angle_degree ?? library.angle_alignment ?? '',
            alignment_vendor_id: library.alignment_vendor_id ?? '',
        });
    }, [library]);

    const setField = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));

    const [archiving, setArchiving] = useState(false);

    const handleToggleArchive = async () => {
        const next = !library.is_archived;
        if (next && !window.confirm('Archive this library? It will no longer be selectable for new cases.')) return;
        setArchiving(true);
        try {
            await api.libraries.setArchived(id, next);
            setLibrary((current) => ({ ...current, is_archived: next }));
            notifySuccess(next ? 'Library archived.' : 'Library restored.');
        } catch (err) {
            notifyError(extractErrorMessage(err, 'Failed to update the library.'));
        } finally {
            setArchiving(false);
        }
    };

    const handleDownloadAsset = async (asset) => {
        try {
            const res = await api.libraries.downloadAsset(id, asset.id);
            const url = URL.createObjectURL(res.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = asset.file_name || 'asset';
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            notifyError(extractErrorMessage(err, 'Failed to download asset.'));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = new FormData();
            Object.entries(form).forEach(([key, value]) => {
                // alignment_vendor_id is always sent, including when blank, so a
                // library can be un-mapped from a vendor. Other blank fields are
                // omitted (the API treats absent as "leave unchanged").
                if (key === 'alignment_vendor_id') {
                    payload.append(key, value ?? '');
                } else if (value !== undefined && value !== null && value !== '') {
                    payload.append(key, value);
                }
            });
            await api.libraries.update(id, payload);
            notifySuccess('Library updated.');
            navigate('/library');
        } catch (err) {
            notifyError(extractErrorMessage(err, 'Failed to update library.'));
        } finally {
            setSaving(false);
        }
    };

    // Refetch if arrived without router state (hard refresh / direct link). The
    // per-id endpoint is employee-scoped (401 for admin), so re-use the admin
    // /admin/libraries list and find this library in it.
    useEffect(() => {
        if (library) return;
        api.libraries.list()
            .then((res) => {
                const list = Array.isArray(res.data) ? res.data : res.data?.data ?? res.data?.items ?? [];
                const found = list.find((l) => String(l.id) === String(id));
                if (found) setLibrary(found);
                else setError('Library not found.');
            })
            .catch(() => setError('Could not load this library. Please try again.'))
            .finally(() => setLoading(false));
    }, [id, library]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d9488]" />
            </div>
        );
    }

    if (error || !library) {
        return (
            <div className="p-6 lg:p-10">
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                    {error || 'Library not found.'}
                </div>
                <Button onClick={() => navigate('/library')} className="mt-6 h-11 px-6 rounded-xl font-bold bg-[#0d9488] text-white">
                    Back to Libraries
                </Button>
            </div>
        );
    }

    const assets = Array.isArray(library.assets) ? library.assets : [];

    return (
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto overflow-y-auto h-full scrollbar-hidden">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 mb-8 text-sm font-medium">
                <Link to="/library" className="text-clinical-teal hover:underline">Libraries</Link>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="text-slate-400">Edit Library</span>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="text-slate-900 font-bold">{library.company_name}</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-2xl lg:text-[40px] font-black text-slate-900 tracking-tight leading-none mb-3">Update Library: {library.company_name}</h1>
                    <p className="text-slate-500 font-medium text-base">Manage implant system specifications and STL assets</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => navigate('/library')}
                        variant="outline"
                        className="h-11 px-6 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                        Discard
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="h-11 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Save Updates'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="xl:col-span-2 space-y-8">
                    {/* General Information */}
                    <div className="bg-white rounded-[32px] p-8 lg:p-10 shadow-xl shadow-slate-200/40 border border-slate-50">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="w-10 h-10 bg-clinical-teal/10 rounded-xl flex items-center justify-center text-clinical-teal">
                                <Info size={22} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">General Information</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Company Name</label>
                                <Input value={form.company_name} onChange={setField('company_name')} className="h-14 rounded-2xl bg-slate-50/50 border-slate-100 px-6 font-semibold focus:bg-white" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Manufacturer ID</label>
                                <Input value={form.manufacturer_id} onChange={setField('manufacturer_id')} className="h-14 rounded-2xl bg-slate-50/50 border-slate-100 px-6 font-semibold focus:bg-white" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Tolerance Degree (µm)</label>
                                <Input type="number" value={form.tolerance_degree} onChange={setField('tolerance_degree')} className="h-14 rounded-2xl bg-slate-50/50 border-slate-100 px-6 font-semibold focus:bg-white" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 ml-1">Angle Degree</label>
                                <Input type="number" value={form.angle_degree} onChange={setField('angle_degree')} className="h-14 rounded-2xl bg-slate-50/50 border-slate-100 px-6 font-semibold focus:bg-white" />
                            </div>
                            <div className="md:col-span-2">
                                <AlignmentVendorSelect
                                    value={form.alignment_vendor_id}
                                    onChange={(vendorId) =>
                                        setForm((current) => ({ ...current, alignment_vendor_id: vendorId }))
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* File Assets */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-clinical-teal/10 rounded-xl flex items-center justify-center text-clinical-teal">
                                <Box size={22} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">File Assets (STL)</h2>
                        </div>

                        {assets.length === 0 ? (
                            <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/40 border border-slate-50 text-center text-slate-400 font-medium">
                                No STL assets attached to this library.
                            </div>
                        ) : (
                            assets.map((asset) => {
                                const meta = ASSET_LABELS[asset.asset_type] || { title: asset.asset_type, subtitle: 'Library asset' };
                                return (
                                    <div key={asset.id} className="bg-white rounded-[32px] p-6 lg:p-8 shadow-xl shadow-slate-200/40 border border-slate-50">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-12 h-12 bg-clinical-teal/5 rounded-xl flex items-center justify-center text-clinical-teal">
                                                <Box size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 leading-tight">{meta.title}</h3>
                                                <p className="text-sm font-medium text-slate-400">{meta.subtitle}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50/50 rounded-2xl px-6 py-5 flex items-center justify-between group border border-dashed border-slate-200">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <FileCode size={20} className="text-slate-400 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{asset.file_name}</p>
                                                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                                                        {asset.content_type || 'file'}{asset.size_bytes ? ` • ${formatSize(asset.size_bytes)}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadAsset(asset)}
                                                className="text-clinical-teal font-black text-[12px] flex items-center gap-2 hover:bg-white px-4 py-2 rounded-xl transition-all flex-shrink-0"
                                            >
                                                <Download size={16} />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8 h-fit lg:sticky lg:top-0">
                    <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/40 border border-slate-50">
                        <h2 className="text-lg font-bold text-slate-900 mb-6 font-primary">Library Details</h2>
                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-400 font-medium">Library ID</dt><dd className="font-bold text-slate-700 truncate max-w-[160px]">{library.id}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-400 font-medium">Angle Degree</dt><dd className="font-bold text-slate-700">{library.angle_degree ?? library.angle_alignment ?? '—'}°</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-400 font-medium">Tolerance</dt><dd className="font-bold text-slate-700">{library.tolerance_degree ?? '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-400 font-medium">Assets</dt><dd className="font-bold text-slate-700">{assets.length}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-400 font-medium">Status</dt><dd className="font-bold text-slate-700">{library.is_archived ? 'Archived' : 'Active'}</dd></div>
                        </dl>
                    </div>

                    <div className="bg-rose-50/30 rounded-[32px] p-8 shadow-sm border border-rose-100">
                        <Button
                            variant="ghost"
                            onClick={handleToggleArchive}
                            disabled={archiving}
                            className="w-full h-14 bg-white hover:bg-rose-50 text-rose-600 font-black text-sm lg:text-base border border-rose-100 shadow-sm rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-60"
                        >
                            <Trash2 size={20} />
                            {library.is_archived ? 'Restore Library' : 'Archive Library'}
                        </Button>
                        <p className="text-[11px] text-slate-400 mt-3 text-center">
                            Archiving hides this library from new case assignments. Existing cases keep it.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateLibrary;
