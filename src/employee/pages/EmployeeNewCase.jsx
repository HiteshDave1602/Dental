import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Lock, Sparkles, UploadCloud } from 'lucide-react';
import StepProgress from '../components/StepProgress';
import ScanPreview3D from '../components/ScanPreview3D';
import ResultsViewer3D from '../components/ResultsViewer3D';
// PATHFINDER INTEGRATION: after Step 1 (New Case → Next), the scan-body
// alignment workflow ported from the standalone `pathfinder` app takes over.
import PathfinderWorkflow from '../pathfinder/PathfinderWorkflow';
import { useCaseStore } from '../../store/caseStore';
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
//   1. Patient details -> validates locally and moves to scan upload
//   2. Scan upload      -> uploads the scan, which submits an alignment job
//                          server-side (the engine detects implants itself —
//                          no manual tooth/library assignment needed upfront)
//   3. Alignment review -> PathfinderWorkflow, scoped to this case
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
    setStep,
    setPatientData,
    setCaseCreated,
    resetCase,
  } = useCaseStore();

  // ── Local (non-persisted) state ───────────────────────────────────────────
  const [patient, setPatient] = useState(patientData);
  const [fieldErrors, setFieldErrors] = useState({});
  const [creatingCase, setCreatingCase] = useState(false);

  const [upload, setUpload] = useState(null);          // File object — can't persist
  const [scanUploadError, setScanUploadError] = useState('');
  const [savingStep2, setSavingStep2] = useState(false);
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
  const step1Valid = useMemo(() => {
    const errors = validatePatient(patient);
    return Object.keys(errors).length === 0;
  }, [patient]);

  // This button only pushes the selected scan and advances the server-side
  // wizard step; tooth/library assignment is intentionally not posted here.
  const canGoToStep3 = Boolean(upload);
  const step2NextTitle = !caseId
    ? 'Case will be created before upload'
    : !upload
      ? 'Upload a scan to continue'
      : '';

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

  const handleStep1Next = async () => {
    const errors = validatePatient(patient);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    if (caseId) {
      setStep(2);
      api.employee.cases.updateStep(caseId, 2).catch(() => {});
      return;
    }

    setCreatingCase(true);
    try {
      const res = await api.employee.cases.create({
        patient_name: patient.fullName.trim(),
        patient_age: parseInt(patient.age, 10),
        case_date: patient.caseDate,
        doctor_notes: patient.notes || null,
      });
      const data = res.data?.data || res.data;
      setCaseCreated(data.id, data.case_reference);
      await api.employee.cases.updateStep(data.id, 2).catch(() => {});
      setStep(2);
    } catch (err) {
      notifyError(extractErrorMessage(err, 'Failed to create case. Please try again.'));
    } finally {
      setCreatingCase(false);
    }
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
    setScanUploadError('');
  };

  const goToStep = (step) => {
    setStep(step);
    if (caseId) {
      api.employee.cases.updateStep(caseId, step).catch(() => {});
    }
  };

  const handleNextFromStep2 = async () => {
    if (!upload) {
      notifyError('Upload a scan file before continuing.');
      return;
    }
    const errors = validatePatient(patient);
    if (!caseId && Object.keys(errors).length) {
      setFieldErrors(errors);
      notifyError('Complete patient details before continuing.');
      return;
    }

    setSavingStep2(true);
    setScanUploadError('');
    try {
      let activeCaseId = caseId;

      if (!activeCaseId) {
        const res = await api.employee.cases.create({
          patient_name: patient.fullName.trim(),
          patient_age: parseInt(patient.age, 10),
          case_date: patient.caseDate,
          doctor_notes: patient.notes || null,
        });
        const data = res.data?.data || res.data;
        activeCaseId = data.id;
        setCaseCreated(data.id, data.case_reference);
      }

      // The alignment job is submitted server-side when the scan lands — the
      // engine detects implant instances itself, no tooth/library assignment
      // needs to be posted beforehand.
      await api.employee.cases.uploadScan(activeCaseId, upload);
      await api.employee.cases.updateStep(activeCaseId, 3);
      setStep(3);
    } catch (err) {
      notifyError(extractErrorMessage(err, 'Failed to upload scan. Please try again.'));
    } finally {
      setSavingStep2(false);
    }
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

      const finalCaseId = caseId || activeCaseId;
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
          <PathfinderWorkflow caseId={caseId} scanFile={upload} onComplete={() => navigate('/my-cases')} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
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
              disabled={!step1Valid || creatingCase}
              onClick={handleStep1Next}
              title={!step1Valid ? 'Fill all mandatory fields to continue' : ''}
              className="gradient-btn h-10 px-6 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {creatingCase ? <Spinner /> : !step1Valid ? <Lock size={14} /> : <Sparkles size={14} />}
              {creatingCase ? 'Creating...' : 'Next Step →'}
            </button>
          </div>
        </section>
      )}

      {/* ── STEPS 2–5 DISABLED (replaced by PathfinderWorkflow, see handoff above) ──
          Our original upload / library-assignment / superimpose / results /
          download steps are commented out via the `false &&` guards below.
          They are kept intact for reference / easy rollback. */}

      {/* ── STEP 2 — Upload Scan ──────────────────────────────────────────── */}
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
                    ✓ {upload.name} ({fileSizeInMb(upload.size)})
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUpload(null); setWireframeMode(false); setOrthographicMode(false); }}
                    className="text-rose-600 text-sm hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
                {scanUploadError && <AlertBanner msg={scanUploadError} variant="red" />}
                <div className="rounded-xl border border-[#9cd5ff]/70 bg-[#f6fbfe] h-[380px] relative">
                  <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full border border-[#6ab0e3]/50 bg-[#c1e5ff] text-[#0a2472]">3D Scan Preview</span>
                  <div className="absolute right-3 top-3 z-10 flex gap-2 text-xs">
                    {/* {['Solid', 'Wireframe'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWireframeMode(mode === 'Wireframe')}
                        className={`px-2 py-1 rounded-full ${wireframeMode === (mode === 'Wireframe') ? 'bg-[#072ac8] text-white' : 'border border-[#9cd5ff] text-[#12344D]/80'}`}
                      >
                        {mode}
                      </button>
                    ))} */}
                    {/* <span className="w-px bg-[#9cd5ff] mx-0.5" /> */}
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
        </section>
      )}

      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-10 -mx-3 mt-6 flex items-center justify-between gap-3 border-t border-[#9cd5ff]/60 bg-[#FCFDF6]/95 px-3 py-3 pr-20 backdrop-blur sm:-mx-4 sm:px-4 sm:pr-24 lg:-mx-6 lg:px-6">
        <button
          type="button"
          onClick={() => goToStep(Math.max(currentStep - 1, 1))}
          disabled={currentStep === 1}
          className="h-10 shrink-0 px-5 rounded-full border border-[#9cd5ff] text-[#12344D] hover:bg-[#c1e5ff]/40 disabled:opacity-40"
        >
          Back
        </button>

        {currentStep === 1 ? null /* Next handled inside step 1 */ : currentStep === 2 ? (
          <div className="min-w-0 text-right">
            <button
              type="button"
              disabled={savingStep2}
              onClick={handleNextFromStep2}
              title={step2NextTitle}
              className="h-10 max-w-full whitespace-nowrap px-5 rounded-full bg-[#072ac8] text-white hover:bg-[#0a2472] disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {savingStep2 ? <Spinner /> : canGoToStep3 ? <FileUp size={14} /> : <Lock size={14} />}
              {savingStep2 ? 'Saving...' : 'Next Step →'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default EmployeeNewCase;
