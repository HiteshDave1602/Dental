import React, { useState } from 'react';
import { X, FileUp, File } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api, { extractErrorMessage } from '../../Script/api';
import AlignmentVendorSelect from '../AlignmentVendorSelect';

const AddLibraryModal = ({ isOpen, onClose, onSuccess }) => {
    const [scanBodyFile, setScanBodyFile] = useState(null);
    const [analogFile, setAnalogFile] = useState(null);
    const [angleFiles, setAngleFiles] = useState([]);
    const [outputFiles, setOutputFiles] = useState([]);
    const [formData, setFormData] = useState({
        company_name: '',
        tolerance_degree: '',
        angle_degree: '',
        manufacturer_id: '',
        alignment_vendor_id: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSave = async () => {
        setError('');

        if (!scanBodyFile || !analogFile || !angleFiles.length) {
            setError('Scan body, analog and angle files are required.');
            return;
        }

        setIsSaving(true);

        try {
            const payload = new FormData();

            Object.entries(formData).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    payload.append(key, value);
                }
            });

            payload.append('scan_body_file', scanBodyFile);
            payload.append('analog_file', analogFile);
            payload.append('angle_file', angleFiles[0]);

            const response = await api.libraries.create(payload);

            // Output files aren't part of the create contract — attach them
            // afterwards via the per-library assets endpoint.
            const libraryId = response.data?.id;
            if (libraryId && outputFiles.length) {
                for (const file of outputFiles) {
                    await api.libraries.uploadAsset(libraryId, { file, asset_type: 'output' });
                }
            }

            setFormData({
                company_name: '',
                tolerance_degree: '',
                angle_degree: '',
                manufacturer_id: '',
                alignment_vendor_id: '',
            });
            setScanBodyFile(null);
            setAnalogFile(null);
            setAngleFiles([]);
            setOutputFiles([]);
            setIsSaving(false);

            if (onSuccess) {
                onSuccess(response.data);
            }

            onClose();
        } catch (err) {
            setIsSaving(false);
            setError(extractErrorMessage(err, 'Failed to create library.'));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[520px] max-h-[90vh] flex flex-col bg-white rounded-[20px] shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-6 lg:p-8 flex items-center justify-between border-b border-slate-50 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-900">Add New Implant Library</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Company Name</label>
                            <Input
                                placeholder="e.g. Osstem"
                                value={formData.company_name}
                                onChange={(e) => setFormData((current) => ({ ...current, company_name: e.target.value }))}
                                className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all px-5 text-slate-700 font-medium text-sm"
                                required
                            />
                        </div>
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tolerance Degree</label>
                            <Input
                                placeholder="0.02"
                                value={formData.tolerance_degree}
                                onChange={(e) => setFormData((current) => ({ ...current, tolerance_degree: e.target.value }))}
                                className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all px-5 text-slate-700 font-medium text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Manufacturer ID</label>
                            <Input
                                placeholder="e.g. MFG-001"
                                value={formData.manufacturer_id}
                                onChange={(e) => setFormData((current) => ({ ...current, manufacturer_id: e.target.value }))}
                                className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all px-5 text-slate-700 font-medium text-sm"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Angle Degree</label>
                            <Input
                                placeholder="e.g. 15"
                                value={formData.angle_degree}
                                onChange={(e) => setFormData((current) => ({ ...current, angle_degree: e.target.value }))}
                                className="h-12 bg-white border-slate-200 rounded-lg focus:ring-teal-500/10 focus:border-teal-500 transition-all px-5 text-slate-700 font-medium text-sm"
                                required
                            />
                        </div>
                    </div>

                    <AlignmentVendorSelect
                        value={formData.alignment_vendor_id}
                        onChange={(vendorId) =>
                            setFormData((current) => ({ ...current, alignment_vendor_id: vendorId }))
                        }
                    />

                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Scan Body File (.STL / .OBJ)</label>
                        <div className="group relative border-2 border-dashed border-slate-200 hover:border-teal-500/50 rounded-xl p-6 lg:p-8 transition-all cursor-pointer bg-slate-50/30 hover:bg-teal-50/30">
                            <input
                                type="file"
                                accept=".stl,.obj"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => setScanBodyFile(e.target.files[0])}
                            />
                            {scanBodyFile ? (
                                <div className="flex flex-col items-center justify-center text-center relative z-20">
                                    <div className="w-11 h-11 bg-teal-50 rounded-lg shadow-sm border border-teal-100 flex items-center justify-center text-teal-500 mb-3">
                                        <File size={22} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 mb-1 truncate max-w-full px-4">{scanBodyFile.name}</p>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setScanBodyFile(null); }}
                                        className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-11 h-11 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-teal-500 transition-colors mb-3">
                                        <File size={22} />
                                    </div>
                                    <p className="text-base font-bold text-slate-900 mb-0.5">Click to upload or drag & drop</p>
                                    <p className="text-[12px] font-semibold text-slate-400">Maximum file size 50MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Analog File (.STL / .OBJ)</label>
                        <div className="group relative border-2 border-dashed border-slate-200 hover:border-teal-500/50 rounded-xl p-6 lg:p-8 transition-all cursor-pointer bg-slate-50/30 hover:bg-teal-50/30">
                            <input
                                type="file"
                                accept=".stl,.obj"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => setAnalogFile(e.target.files[0])}
                            />
                            {analogFile ? (
                                <div className="flex flex-col items-center justify-center text-center relative z-20">
                                    <div className="w-11 h-11 bg-teal-50 rounded-lg shadow-sm border border-teal-100 flex items-center justify-center text-teal-500 mb-3">
                                        <FileUp size={22} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 mb-1 truncate max-w-full px-4">{analogFile.name}</p>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnalogFile(null); }}
                                        className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-11 h-11 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-teal-500 transition-colors mb-3">
                                        <FileUp size={22} />
                                    </div>
                                    <p className="text-base font-bold text-slate-900 mb-0.5">Click to upload or drag & drop</p>
                                    <p className="text-[12px] font-semibold text-slate-400">Maximum file size 50MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Angle Alignment File (.STL / .OBJ)</label>
                        <div className="group relative border-2 border-dashed border-slate-200 hover:border-teal-500/50 rounded-xl p-6 lg:p-8 transition-all cursor-pointer bg-slate-50/30 hover:bg-teal-50/30">
                            <input
                                type="file"
                                accept=".stl,.obj"
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => setAngleFiles(e.target.files[0] ? [e.target.files[0]] : [])}
                            />
                            {angleFiles.length ? (
                                <div className="flex flex-col items-center justify-center text-center relative z-20">
                                    <div className="w-11 h-11 bg-teal-50 rounded-lg shadow-sm border border-teal-100 flex items-center justify-center text-teal-500 mb-3">
                                        <FileUp size={22} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 mb-1 truncate max-w-full px-4">{angleFiles[0]?.name}</p>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAngleFiles([]); }}
                                        className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-11 h-11 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-teal-500 transition-colors mb-3">
                                        <FileUp size={22} />
                                    </div>
                                    <p className="text-base font-bold text-slate-900 mb-0.5">Click to upload or drag & drop</p>
                                    <p className="text-[12px] font-semibold text-slate-400">Maximum file size 50MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Output File (.PDF / .STL / .OBJ) (Optional)</label>
                        <div className="group relative border-2 border-dashed border-slate-200 hover:border-teal-500/50 rounded-xl p-6 lg:p-8 transition-all cursor-pointer bg-slate-50/30 hover:bg-teal-50/30">
                            <input
                                type="file"
                                accept=".pdf,.stl,.obj"
                                multiple
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(e) => setOutputFiles(Array.from(e.target.files || []))}
                            />
                            {outputFiles.length ? (
                                <div className="flex flex-col items-center justify-center text-center relative z-20">
                                    <div className="w-11 h-11 bg-teal-50 rounded-lg shadow-sm border border-teal-100 flex items-center justify-center text-teal-500 mb-3">
                                        <FileUp size={22} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900 mb-1 truncate max-w-full px-4">{outputFiles.length} file(s) selected</p>
                                    <p className="text-[11px] font-semibold text-slate-500 mb-1 truncate max-w-full px-4">{outputFiles.map((file) => file.name).join(', ')}</p>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOutputFiles([]); }}
                                        className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                    >
                                        Remove files
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-11 h-11 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-teal-500 transition-colors mb-3">
                                        <FileUp size={22} />
                                    </div>
                                    <p className="text-base font-bold text-slate-900 mb-0.5">Click to upload or drag & drop</p>
                                    <p className="text-[12px] font-semibold text-slate-400">Maximum file size 50MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                            {error}
                        </div>
                    ) : null}
                </div>

                <div className="p-6 lg:p-8 bg-slate-50/50 flex items-center justify-end gap-5 border-t border-slate-50">
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleSave}
                        className="h-12 px-8 bg-[#0d9488] hover:bg-[#0c857a] text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 active:scale-95 transition-all text-sm"
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Library'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AddLibraryModal;
