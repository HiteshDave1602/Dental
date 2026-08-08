import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Lock, Search, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import StepProgress from '../components/StepProgress';
import ToothChart from '../components/ToothChart';
import ScanPreview3D from '../components/ScanPreview3D';
import ResultsViewer3D from '../components/ResultsViewer3D';
// PATHFINDER INTEGRATION: after Step 1 (New Case → Next), the scan-body
// alignment workflow ported from the standalone `pathfinder` app takes over.
import PathfinderWorkflow from '../pathfinder/PathfinderWorkflow';
import { useCaseStore } from '../../store/caseStore';
import { useLibraryData } from '../../hooks/useLibraryData';
import api, { extractErrorMessage, notifyError, notifySuccess, RESOLVED_BASE_URL } from '../../Script/api';

const MB = 1024 * 1024;
const fileSizeInMb = (size) => `${(size / MB).toFixed(2)} MB`;

// ── Step 1 validation ─────────────────────────────────────────────────────────

const validatePatient = (p) => {
  const errors = {};
  if (!p.fullName.trim()) errors.fullName = 'Patient name is required';
  const age = parseInt(p.age, 10);
  if (!p.age.toString().trim()) errors.age = 'Age is required';
  else if (isNaN(age) || age < 1 || age > 120) errors.age = 'Enter a valid age (1–120)';
  if (!p.caseDate) errors.caseDate = 'Case date is required';
  return errors;
};

// ── Small shared UI pieces ────────────────────────────────────────────────────

const FieldError = ({ msg }) =>
  msg ? <p className="text-xs text-rose-600 mt-1">{msg}</p> : null;

const Spinner = () => (
  <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
);

const AlertBanner = ({ msg, variant = 'amber' }) => {
  const colors =
    variant === 'red'
      ? 'border-rose-300 bg-rose-50 text-rose-700'
      : 'border-amber-300 bg-amber-50 text-amber-700';
  return (
    <div className={`text-xs rounded-xl border px-3 py-2 ${colors}`}>{msg}</div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

// The wizard is three steps:
//
//   1. Patient details            -> validates locally and moves to scan upload
//   2. Scan upload + tooth chart  -> assigns libraries and uploads the scan,
//                                    which submits an alignment job server-side
//   3. Alignment review           -> PathfinderWorkflow, scoped to this case
//
// Steps 3-5 of the original design (superimpose / results / download) were
// placeholder UI over a stubbed analysis endpoint. The review workflow covers
// all three with real engine output, so they have been removed.

const EmployeeNewCase = () => {
  const navigate = useNavigate();

  // ── Persistent case state ─────────────────────────────────────────────────
  const {
    currentStep,
    patientData,
    caseId,
    caseRef,
    selectedTeeth,
    activeTooth,
    toothBrandSelections,
    toothAngleSelections,
    toothAssignments,
    setStep,
    setPatientData,
    setCaseCreated,
    toggleTooth,
    setActiveTooth,
    setToothBrand,
    setToothAngle,
    assignLibrary,
    removeAssignment,
    clearTeeth,
    resetCase,
  } = useCaseStore();

  // ── Local (non-persisted) state ───────────────────────────────────────────
  const [patient, setPatient] = useState(patientData);
  const [fieldErrors, setFieldErrors] = useState({});

  const [upload, setUpload] = useState(null);          // File object — can't persist
  const [uploadingToBackend, setUploadingToBackend] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [orthographicMode, setOrthographicMode] = useState(false);

  const [savingFinal, setSavingFinal] = useState(false);
  const [savedRef, setSavedRef] = useState(null);
  const [superimposed, setSuperimposed] = useState(false);

  // ── Analysis (Steps 3–4) — ephemeral, not persisted in caseStore ─────────
  const [caseData, setCaseData] = useState(null);               // api.employee.cases.get(caseId) — for patient_scan_url
  const [analysisResult, setAnalysisResult] = useState(null);    // AnalysisDetailResponse.data
  const [analysisLoading, setAnalysisLoading] = useState(false); // true while calculate() runs
  const [analysisError, setAnalysisError] = useState('');
  const [meshVisibility, setMeshVisibility] = useState({ patientScan: true, scanBody: true, analog: true });
  const [activeResultTooth, setActiveResultTooth] = useState(null);

  // ── Library cascade (Brand → Angle → Libraries) ───────────────────────────
  const {
    brands, brandsLoading, brandsError, fetchBrands,
    angles, anglesLoading, anglesError,
    fetchAnglesForBrand,
    displayedLibraries, selectAngle,
    restoreForTooth,
  } = useLibraryData();

  // Restore cascade when user switches to a different tooth
  const prevActiveTooth = useRef(null);
  useEffect(() => {
    if (activeTooth && activeTooth !== prevActiveTooth.current) {
      prevActiveTooth.current = activeTooth;
      const savedBrand = toothBrandSelections[activeTooth];
      const savedAngle = toothAngleSelections?.[activeTooth] ?? null;
      if (savedBrand) restoreForTooth(savedBrand, savedAngle);
    }
  }, [activeTooth, toothBrandSelections, toothAngleSelections, restoreForTooth]);

  // Fetch brands lazily when entering Step 2
  useEffect(() => {
    if (currentStep === 2) fetchBrands();
  }, [currentStep, fetchBrands]);

  // The step-3 rehydration effect that used to sit here has been removed.
  //
  // It fetched the case and `analysis/{id}/results` on every entry to step 3,
  // but everything it populated (`caseData`, `analysisResult` and the values
  // derived from them) is read by nothing: step 3 returns early into
  // PathfinderWorkflow, which loads its own state from the case's alignment job.
  //
  // Because analysis results only exist AFTER the review is completed, that
  // request 404'd every single time a case reached step 3 — a red 404 in the
  // console and network tab on the normal, healthy path, for data nobody
  // rendered. The handler swallowed the 404 deliberately, so it was noise rather
  // than a fault, but noise that looked exactly like a fault while people were
  // testing.

  // Restore persisted patient data on first mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPatient(patientData); }, []);

  // Sync local patient state → store whenever it changes (avoids setState-in-render)
  useEffect(() => {
    setPatientData(patient);
  }, [patient, setPatientData]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const allAssigned = useMemo(
    () => selectedTeeth.length > 0 && selectedTeeth.every((t) => Boolean(toothAssignments[t])),
    [selectedTeeth, toothAssignments]
  );

  const step1Valid = useMemo(() => {
    const errors = validatePatient(patient);
    return Object.keys(errors).length === 0;
  }, [patient]);

  const canGoToStep3 = Boolean(upload) && selectedTeeth.length > 0 && allAssigned;

  const patientScanUrl = caseData?.patient_scan_url
    ? `${RESOLVED_BASE_URL}${caseData.patient_scan_url}`
    : null;

  const avgFitnessPct = analysisResult?.results?.length
    ? Math.round(
        (analysisResult.results.reduce((sum, r) => sum + (r.fitness_score || 0), 0) / analysisResult.results.length) * 100
      )
    : null;

  // Match each analysis result row to the tooth that was assigned to that
  // vendor's library (results carry `tooth_number`, assigned client-side by
  // the backend when it matched detected instances to teeth).
  const resultByTooth = useMemo(() => {
    const map = {};
    (analysisResult?.results || []).forEach((r) => { map[r.tooth_number] = r; });
    return map;
  }, [analysisResult]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Store sync is handled by the useEffect above — no Zustand calls inside setState
  const handlePatientChange = useCallback((field, value) => {
    setPatient((p) => ({ ...p, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  const handleStep1Next = () => {
    const errors = validatePatient(patient);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setStep(2);
  };

  const onFilePicked = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['stl', 'obj', 'ply'].includes(ext)) {
      notifyError('Only STL, OBJ, PLY files are supported');
      return;
    }
    if (file.size > 500 * MB) {
      notifyError('File exceeds 500 MB limit');
      return;
    }
    setUpload(file);

    // Upload to backend immediately so we don't have to do it at the end
    if (caseId) {
      setUploadingToBackend(true);
      try {
        await api.employee.cases.uploadScan(caseId, file);
      } catch {
        // Non-fatal — user can still proceed; scan can be re-uploaded
      } finally {
        setUploadingToBackend(false);
      }
    }
  };

  const handleBrandSelect = (brand) => {
    if (!activeTooth) return;
    setToothBrand(activeTooth, brand); // also resets angle for this tooth in store
    fetchAnglesForBrand(brand);        // one call → all angles + their libraries loaded
  };

  const handleAngleSelect = (angle) => {
    if (!activeTooth) return;
    const parsed = angle === '' ? null : parseFloat(angle);
    setToothAngle(activeTooth, parsed);
    selectAngle(parsed); // pure client-side filter — no API call
  };

  const handleLibraryAssign = (library) => {
    if (!activeTooth) return;
    // Store full library data including assets so Step 3 (superimpose) has the STL paths
    assignLibrary(activeTooth, {
      company_name: library.company_name,
      library_id: String(library.id),
      angle_alignment: library.angle_alignment,
      manufacturer_id: library.manufacturer_id,
      assets: library.assets ?? [],       // scan_body / analog / angle STL file paths
    });
    notifySuccess(`Library assigned to Tooth ${activeTooth}`);
  };

  const goToStep = (step) => {
    setStep(step);
    if (caseId) {
      api.employee.cases.updateStep(caseId, step).catch(() => {});
    }
  };

  const handleNextFromStep2 = () => {
    if (!canGoToStep3) return;
    setStep(3);
  };

  // The alignment vendor call is async: submitting a job just starts it
  // (status "aligning"/"queued"), and analysis.calculate needs it to reach
  // "awaiting_review" before it can run. On a brand-new case the first
  // calculate() call is what lazily submits the job, so that very call
  // reliably 409s with job_not_ready — poll status and retry once it's ready
  // instead of surfacing that as a hard failure.
  const isJobNotReady = (err) => err?.response?.data?.detail?.code === 'job_not_ready';

  const pollAlignmentUntilReady = async (id, { intervalMs = 2000, timeoutMs = 120000 } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const res = await api.employee.alignment.status(id);
      const status = (res.data?.data || res.data)?.status;
      if (status === 'awaiting_review') return;
      if (status === 'failed') throw new Error('Alignment job failed. Please re-upload the scan and try again.');
    }
    throw new Error('Alignment is taking longer than expected. Please try again shortly.');
  };

  const handleProcessSuperimposition = async () => {
    if (!caseId) return;
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      if (!caseData) {
        const caseRes = await api.employee.cases.get(caseId);
        setCaseData(caseRes.data?.data || caseRes.data);
      }
      let res;
      try {
        res = await api.employee.analysis.calculate(caseId);
      } catch (err) {
        if (!isJobNotReady(err)) throw err;
        await pollAlignmentUntilReady(caseId);
        res = await api.employee.analysis.calculate(caseId);
      }
      setAnalysisResult(res.data?.data || res.data);
      setSuperimposed(true);
      notifySuccess('Superimposition complete');
    } catch (err) {
      setAnalysisError(
        err?.response ? extractErrorMessage(err, 'Superimposition failed. Please try again.') : (err.message || 'Superimposition failed. Please try again.')
      );
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleFinalSave = async () => {
    setSavingFinal(true);
    try {
      const activeCaseId = caseId;

      if (!activeCaseId) {
        // Fallback: create case + upload if user somehow skipped step 1 save
        const res = await api.employee.cases.create({
          patient_name: patient.fullName.trim(),
          patient_age: parseInt(patient.age, 10),
          case_date: patient.caseDate,
          doctor_notes: patient.notes || null,
        });
        const data = res.data?.data || res.data;
        setCaseCreated(data.id, data.case_reference);
        if (upload) {
          await api.employee.cases.uploadScan(data.id, upload).catch(() => {});
        }
      }

      // Persist teeth assignments — normally already synced at the Step 2→3
      // transition (required for analysis.calculate to see them), so only do
      // it here as a fallback for the "skipped step 1" path above. addTeeth
      // isn't idempotent server-side (always inserts), so guard against
      // re-adding rows that already exist.
      const finalCaseId = caseId || activeCaseId;
      const teeth = selectedTeeth.map((tooth) => ({
        tooth_number: tooth,
        library_id: toothAssignments[tooth]?.library_id ?? null,
      }));
      if (teeth.length) {
        const existing = await api.employee.cases.getTeeth(finalCaseId);
        const existingTeeth = existing.data?.data || existing.data || [];
        if (!existingTeeth.length) {
          await api.employee.cases.addTeeth(finalCaseId, teeth);
        }
      }

      await api.employee.cases.updateStep(finalCaseId, 5).catch(() => {});
      setSavedRef(caseRef || 'N/A');
      notifySuccess('Case saved successfully!');
    } catch (err) {
      notifyError(extractErrorMessage(err, 'Failed to save case. Check your subscription limit.'));
    } finally {
      setSavingFinal(false);
    }
  };

  const handleStartNew = () => {
    resetCase();
    setPatient({ fullName: '', age: '', caseDate: new Date().toISOString().split('T')[0], notes: '' });
    setUpload(null);
    setWireframeMode(false);
    setOrthographicMode(false);
    setSavedRef(null);
    setSuperimposed(false);
    setCaseData(null);
    setAnalysisResult(null);
    setAnalysisError('');
    setActiveResultTooth(null);
    setMeshVisibility({ patientScan: true, scanBody: true, analog: true });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentBrandForTooth = activeTooth ? (toothBrandSelections[activeTooth] || '') : '';
  const currentAngleForTooth = activeTooth ? (toothAngleSelections?.[activeTooth] ?? '') : '';
  const assignedForTooth = activeTooth ? toothAssignments[activeTooth] : null;

  // ── STEP 3 — Alignment review ─────────────────────────────────────────────
  // The scan was uploaded in step 2, which submitted an alignment job for this
  // case. The workflow reads that job rather than creating its own, so results
  // are recorded against the case and a refresh resumes instead of restarting.
  if (currentStep >= 3) {
    return (
      <div>
        <StepProgress activeStep={3} />
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="h-10 px-5 rounded-full border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/40"
          >
            ← Back to Scan &amp; Teeth
          </button>
          <div className="text-sm text-[#12344D]/60">
            {caseRef ? <>Case <span className="text-[#12344D] font-semibold">{caseRef}</span></> : null}
            {patient.fullName ? <span className="ml-3">{patient.fullName}</span> : null}
          </div>
        </div>
        <div className="mt-4">
          <PathfinderWorkflow caseId={caseId} onComplete={() => navigate('/my-cases')} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepProgress activeStep={currentStep} />

      {/* ── STEP 1 — Patient Details ─────────────────────────────────────── */}
      {currentStep === 1 && (
        <section className="glass-card p-5 space-y-4">
          <h2 className="employee-heading text-lg text-[#12344D]">Patient Details</h2>

          <div>
            <input
              className={`glass-input h-11 px-3 w-full ${fieldErrors.fullName ? 'border-rose-400/60' : ''}`}
              placeholder="Patient Full Name *"
              value={patient.fullName}
              onChange={(e) => handlePatientChange('fullName', e.target.value)}
            />
            <FieldError msg={fieldErrors.fullName} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <input
                className={`glass-input h-11 px-3 w-full ${fieldErrors.age ? 'border-rose-400/60' : ''}`}
                type="number"
                min="1"
                max="120"
                placeholder="Age *"
                value={patient.age}
                onChange={(e) => handlePatientChange('age', e.target.value)}
              />
              <FieldError msg={fieldErrors.age} />
            </div>
            <div>
              <input
                className="glass-input h-11 px-3 w-full bg-[#f6fbfe] text-[#12344D]/60 cursor-not-allowed"
                value={caseRef || 'Auto-generated on save'}
                readOnly
              />
            </div>
          </div>

          <div>
            <input
              className={`glass-input h-11 px-3 w-full ${fieldErrors.caseDate ? 'border-rose-400/60' : ''}`}
              type="date"
              value={patient.caseDate}
              onChange={(e) => handlePatientChange('caseDate', e.target.value)}
            />
            <FieldError msg={fieldErrors.caseDate} />
          </div>

          <textarea
            className="glass-input px-3 py-2 w-full min-h-28"
            value={patient.notes}
            placeholder="Remarks (optional)"
            onChange={(e) => handlePatientChange('notes', e.target.value)}
          />

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!step1Valid}
              onClick={handleStep1Next}
              title={!step1Valid ? 'Fill all mandatory fields to continue' : ''}
              className="gradient-btn h-10 px-6 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {!step1Valid ? <Lock size={14} /> : <Sparkles size={14} />}
              Next Step →
            </button>
          </div>
        </section>
      )}

      {/* ── STEPS 2–5 DISABLED (replaced by PathfinderWorkflow, see handoff above) ──
          Our original upload / library-assignment / superimpose / results /
          download steps are commented out via the `false &&` guards below.
          They are kept intact for reference / easy rollback. */}

      {/* ── STEP 2 — Upload Scan & Library Assignment ────────────────────── */}
      {currentStep === 2 && (
        <section className="space-y-4">
          {/* Scan upload */}
          <article className="glass-card p-5">
            <h2 className="employee-heading text-lg text-[#12344D]">Upload Patient Scan Data</h2>
            {!upload ? (
              <label className="block mt-4 rounded-2xl border-2 border-dashed border-[#6ab0e3]/60 p-8 text-center bg-[#f6fbfe] cursor-pointer hover:border-[#072ac8] transition-colors">
                <UploadCloud className="mx-auto mt-3 text-[#6ab0e3]" />
                <p className="employee-heading text-[#12344D] mt-3">Drop Your Patient Scan File Here</p>
                <p className="text-sm text-[#12344D]/60 mt-1">STL · PLY · OBJ supported — Max 500 MB</p>
                <span className="gradient-btn inline-flex mt-4 px-5 h-10 items-center text-white font-semibold">
                  Browse Files
                </span>
                <input className="hidden" type="file" accept=".stl,.obj,.ply" onChange={onFilePicked} />
              </label>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                  <div className="text-sm text-emerald-700 flex items-center gap-2">
                    {uploadingToBackend ? <Spinner /> : '✓'} {upload.name} ({fileSizeInMb(upload.size)})
                    {uploadingToBackend && <span className="text-xs text-[#12344D]/60">Uploading…</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUpload(null); setWireframeMode(false); setOrthographicMode(false); }}
                    className="text-rose-600 text-sm hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="rounded-xl border border-[#9cd5ff]/70 bg-[#f6fbfe] h-[380px] relative">
                  <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full border border-[#6ab0e3]/50 bg-[#c1e5ff] text-[#0a2472]">3D Scan Preview</span>
                  <div className="absolute right-3 top-3 z-10 flex gap-2 text-xs">
                    {['Solid', 'Wireframe'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWireframeMode(mode === 'Wireframe')}
                        className={`px-2 py-1 rounded-full ${wireframeMode === (mode === 'Wireframe') ? 'bg-[#072ac8] text-white' : 'border border-[#9cd5ff] text-[#12344D]/80'}`}
                      >
                        {mode}
                      </button>
                    ))}
                    <span className="w-px bg-[#9cd5ff] mx-0.5" />
                    {['Perspective', 'Orthographic'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setOrthographicMode(mode === 'Orthographic')}
                        className={`px-2 py-1 rounded-full ${orthographicMode === (mode === 'Orthographic') ? 'bg-[#072ac8] text-white' : 'border border-[#9cd5ff] text-[#12344D]/80'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <ScanPreview3D file={upload} wireframe={wireframeMode} orthographic={orthographicMode} />
                  <div className="absolute left-3 bottom-3 text-xs text-white">🖱 Drag · Scroll · Right-click to pan</div>
                </div>
              </div>
            )}
          </article>

          {/* Teeth selection & library assignment (only shown once scan is uploaded) */}
          {upload && (
            <article className="space-y-4">
              <div className="glass-card p-4 border-l-4 border-[#072ac8]">
                <h3 className="employee-heading text-[#12344D]">Assign Implant Library to Teeth</h3>
                <p className="text-sm text-[#12344D]/70 mt-1">
                  Click a tooth, choose a brand, then select the matching library entry.
                </p>
              </div>

              <ToothChart
                selectedTeeth={selectedTeeth}
                onToggle={toggleTooth}
                onClear={() => clearTeeth()}
              />

              {selectedTeeth.length > 0 && (
                <div className="glass-card p-4 space-y-4">
                  {/* Tooth tabs */}
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {selectedTeeth.map((tooth) => (
                        <button
                          key={tooth}
                          type="button"
                          onClick={() => {
                            setActiveTooth(tooth);
                            const brand = toothBrandSelections[tooth];
                            if (brand) fetchAnglesForBrand(brand);
                          }}
                          className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                            activeTooth === tooth
                              ? 'bg-[#072ac8] border-[#072ac8] text-white'
                              : 'border-[#9cd5ff] text-[#12344D]/60 hover:border-[#072ac8]'
                          }`}
                        >
                          Tooth {tooth} {toothAssignments[tooth] ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-[#12344D]/60">Active: {activeTooth || 'None'}</span>
                  </div>

                  {!activeTooth && (
                    <AlertBanner msg="Select a tooth above to assign a library." />
                  )}

                  {activeTooth && (
                    <div className="space-y-4">
                      {/* Currently assigned badge */}
                      {assignedForTooth && (
                        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
                          <span className="text-emerald-700">
                            ✓ Assigned: <strong>{assignedForTooth.company_name}</strong> — {assignedForTooth.manufacturer_id || 'N/A'} · {assignedForTooth.angle_alignment}°
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAssignment(activeTooth)}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* Step 1 — Brand */}
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-3 text-[#12344D]/50" />
                          <input className="glass-input h-10 pl-8 pr-3 placeholder:text-[#12344D]/50" placeholder="Search" />
                        </div>

                        {/* Brand dropdown */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[#12344D]/50 uppercase tracking-wide px-1">Brand</label>
                          <select
                            className="glass-input h-10 px-3 min-w-[160px]"
                            value={currentBrandForTooth}
                            onChange={(e) => handleBrandSelect(e.target.value)}
                            disabled={brandsLoading}
                          >
                            <option value="">{brandsLoading ? 'Loading…' : 'Select Brand'}</option>
                            {brands.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        {/* Angle dropdown — shown only after brand selected */}
                        {currentBrandForTooth && (
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-[#12344D]/50 uppercase tracking-wide px-1">
                              Angle Alignment
                            </label>
                            <select
                              className="glass-input h-10 px-3 min-w-[160px]"
                              value={currentAngleForTooth}
                              onChange={(e) => handleAngleSelect(e.target.value)}
                              disabled={anglesLoading}
                            >
                              <option value="">
                                {anglesLoading ? 'Loading…' : 'All Angles'}
                              </option>
                              {angles.map((a) => (
                                <option key={a.angle_alignment} value={a.angle_alignment}>
                                  {a.angle_alignment}° ({a.library_count} {a.library_count === 1 ? 'library' : 'libraries'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {brandsError && <AlertBanner msg={brandsError} />}
                      {anglesError && <AlertBanner msg={anglesError} />}

                      {/* Library cards */}
                      {!currentBrandForTooth && (
                        <p className="text-xs text-[#12344D]/60">① Select a brand → ② choose an angle → ③ pick a library.</p>
                      )}

                      {/* Only show hint when libraries haven't loaded yet */}
                      {currentBrandForTooth && !anglesLoading && displayedLibraries.length === 0 && !anglesError && (
                        <p className="text-xs text-[#12344D]/60">No libraries found. Try a different brand or angle.</p>
                      )}

                      {/* Skeleton while loading angles + libraries from one API call */}
                      {anglesLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-28 rounded-xl border border-[#9cd5ff]/50 bg-[#c1e5ff]/50 animate-pulse" />
                          ))}
                        </div>
                      )}

                      {anglesError && <AlertBanner msg={anglesError} />}

                      {currentAngleForTooth !== '' && !anglesLoading && displayedLibraries.length === 0 && !anglesError && (
                        <p className="text-xs text-[#12344D]/60">No libraries found for this angle.</p>
                      )}

                      {displayedLibraries.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          {displayedLibraries.map((lib) => {
                            const isAssigned = toothAssignments[activeTooth]?.library_id === String(lib.id);
                            return (
                              <button
                                key={lib.id}
                                type="button"
                                onClick={() => handleLibraryAssign(lib)}
                                className={`text-left p-3 rounded-xl border transition-all ${
                                  isAssigned
                                    ? 'border-[#072ac8] bg-[#c1e5ff]/40 shadow-[0_0_15px_rgba(7,42,200,.2)]'
                                    : 'border-[#9cd5ff] hover:border-[#072ac8]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-[#12344D] truncate">{lib.company_name}</p>
                                  <span className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-[#6ab0e3]/50 text-[#0a2472]">Admin</span>
                                </div>
                                <p className="text-xs text-[#12344D]/60 mt-1">
                                  {lib.manufacturer_id || 'N/A'} · {lib.angle_alignment}°
                                </p>
                                {/* All asset filenames */}
                                {lib.assets?.length > 0 && (
                                  <div className="mt-2 space-y-0.5">
                                    {lib.assets.map((asset) => (
                                      <div key={asset.id} className="flex items-center gap-1.5">
                                        <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded border border-[#9cd5ff]/70 text-[#12344D]/50 uppercase tracking-wide">
                                          {asset.asset_type}
                                        </span>
                                        <p className="text-[10px] text-[#12344D]/60 truncate">{asset.file_name}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[11px] text-[#12344D]/50 mt-2">
                                  {isAssigned ? '✓ Assigned' : `Click to assign to Tooth ${activeTooth}`}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assignment Summary */}
                  <div className="glass-card p-3 space-y-2">
                    <h4 className="employee-heading text-sm text-[#12344D]">Assignment Summary</h4>
                    {selectedTeeth.map((tooth) => {
                      const a = toothAssignments[tooth];
                      return (
                        <div key={tooth} className="flex items-center justify-between text-sm">
                          <span className="text-[#12344D]/80">Tooth {tooth}</span>
                          <span className={a ? 'text-[#072ac8] font-semibold' : 'text-amber-600'}>
                            {a ? `${a.company_name} · ${a.manufacturer_id || 'N/A'} ✓` : '[Not assigned]'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          )}
        </section>
      )}

      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goToStep(Math.max(currentStep - 1, 1))}
          disabled={currentStep === 1}
          className="h-10 px-5 rounded-full border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/40 disabled:opacity-40"
        >
          Back
        </button>

        {currentStep === 1 ? null /* Next handled inside step 1 */ : currentStep === 2 ? (
          <div className="text-right">
            <div className="text-xs text-[#12344D]/60 mb-1">
              <span className={upload ? 'text-emerald-600' : 'text-[#12344D]/50'}>☑ Scan uploaded</span>{' · '}
              <span className={selectedTeeth.length > 0 ? 'text-emerald-600' : 'text-[#12344D]/50'}>☑ Teeth selected</span>{' · '}
              <span className={allAssigned ? 'text-emerald-600' : 'text-[#12344D]/50'}>
                ☑ All assigned ({Object.keys(toothAssignments).length}/{selectedTeeth.length})
              </span>
            </div>
            <button
              type="button"
              disabled={!canGoToStep3}
              onClick={handleNextFromStep2}
              title={!canGoToStep3 ? 'Upload scan and assign all teeth to continue' : ''}
              className="h-10 px-5 rounded-full bg-[#072ac8] text-white hover:bg-[#0a2472] disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {!canGoToStep3 ? <Lock size={14} /> : <FileUp size={14} />}
              Next Step →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default EmployeeNewCase;
