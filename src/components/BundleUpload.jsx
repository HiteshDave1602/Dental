import React, { useRef, useState } from 'react';
import { Archive, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Vendor bundle picker.
 *
 * A bundle is the complete CAD asset set for one implant system as a single
 * .zip — roughly 87 files. It is what makes a library usable; the older
 * per-file uploads collected three files and could never produce a runnable
 * vendor, which is why a library could look configured and still fail every
 * job.
 *
 * The alignment service validates the archive before it is accepted, so
 * rejection is normal and informative rather than exceptional. Its message
 * names the offending asset, so it is shown verbatim instead of being
 * flattened into "upload failed".
 */
const BundleUpload = ({ file, onChange, status, message, report, disabled }) => {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const pick = (candidate) => {
        if (!candidate) return;
        if (!candidate.name.toLowerCase().endsWith('.zip')) {
            onChange(null, 'A bundle must be a .zip archive.');
            return;
        }
        onChange(candidate, '');
    };

    const borderClass = dragging
        ? 'border-teal-500 bg-teal-50/40'
        : status === 'error'
            ? 'border-rose-300 bg-rose-50/30'
            : status === 'valid'
                ? 'border-teal-300 bg-teal-50/20'
                : 'border-slate-200 hover:border-teal-500/50 bg-slate-50/30 hover:bg-teal-50/30';

    return (
        <div className="space-y-2.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                Vendor Bundle (.ZIP)
            </label>

            <div
                className={`group relative border-2 border-dashed rounded-xl p-6 transition-all ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                } ${borderClass}`}
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (!disabled) pick(e.dataTransfer.files?.[0]);
                }}
                onClick={() => !disabled && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".zip"
                    disabled={disabled}
                    className="hidden"
                    onChange={(e) => pick(e.target.files?.[0])}
                />

                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-11 h-11 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center mb-3">
                        {status === 'uploading'
                            ? <Loader2 size={22} className="text-teal-500 animate-spin" />
                            : status === 'valid'
                                ? <CheckCircle2 size={22} className="text-teal-500" />
                                : status === 'error'
                                    ? <AlertTriangle size={22} className="text-rose-500" />
                                    : <Archive size={22} className="text-slate-400 group-hover:text-teal-500 transition-colors" />}
                    </div>

                    {file ? (
                        <>
                            <p className="text-sm font-bold text-slate-900 mb-1 truncate max-w-full px-4">{file.name}</p>
                            <p className="text-[12px] font-semibold text-slate-400">
                                {(file.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-base font-bold text-slate-900 mb-0.5">
                                Click to upload or drag &amp; drop
                            </p>
                            <p className="text-[12px] font-semibold text-slate-400">
                                The implant system's complete asset set, as one .zip
                            </p>
                        </>
                    )}
                </div>
            </div>

            {status === 'uploading' && (
                <p className="text-[12px] font-semibold text-slate-500 px-1">
                    Validating with the alignment service — it unpacks and loads the whole
                    archive, so this takes a moment.
                </p>
            )}

            {status === 'valid' && report && (
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2.5">
                    <p className="text-[12px] font-bold text-teal-800">
                        Accepted — {report.vendor_id}
                        {report.corrector_count ? `, ${report.corrector_count} correctors` : ''}
                    </p>
                    {report.bundle_version && (
                        <p className="text-[11px] font-mono text-teal-700/80 mt-0.5 truncate">
                            {report.bundle_version.replace('sha256:', '').slice(0, 16)}…
                        </p>
                    )}
                </div>
            )}

            {status === 'error' && message && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5">
                    {/* Verbatim: the service names the missing or unusable asset, which
                        is the only thing that makes this fixable. */}
                    <p className="text-[12px] font-semibold text-rose-700">{message}</p>
                </div>
            )}
        </div>
    );
};

export default BundleUpload;
