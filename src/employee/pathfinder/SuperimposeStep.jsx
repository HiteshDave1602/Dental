import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Container,
  Stack,
  Fade,
  FormControl, Select, MenuItem,
  Button, Card, CardContent, CircularProgress, Alert,
  Slider, TextField,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import {
  default as api,
  getAlignmentState, placeAngleCorrectors, searchAroundPoint,
  rotateAnalog, setInstanceVendor, listVendors,
  extractErrorMessage, assetUrl,
} from '../../Script/api';
import { useCaseStore } from '../../store/caseStore';
import JobDashboard from './JobDashboard';
import TeethLibraryPanel from './TeethLibraryPanel';
import Viewer3D from './Viewer3D';
import theme from './theme';

const READY_STATUSES = new Set(['completed', 'awaiting_review']);
const FAILED_STATUSES = new Set(['failed', 'error']);

// The job-level `status` and the engine's own `engine_status` aren't always in
// sync — a real /viewer response was seen with status: "aligning" while
// engine_status was already "awaiting_review", which left the poll below
// spinning forever even though the engine had finished. engine_status is
// already treated as authoritative for busy/idle elsewhere, so check both
// fields here too rather than trusting `status` alone.
const isJobReady = (state) => READY_STATUSES.has(state?.status) || READY_STATUSES.has(state?.engine_status);
const isJobFailed = (state) => FAILED_STATUSES.has(state?.status) || FAILED_STATUSES.has(state?.engine_status);

// Download artifact URLs must be fetched directly (they are signed, expiring
// proxy URLs), never cached.
const fileUrl = (p) => assetUrl(p);

// ── Per-instance analog clocking (same pattern as Pathfinder's ResultsDisplay)
// Local draft + Save button: dragging only updates the preview; Save commits.
function AnalogRotationControl({ instanceIndex, savedDeg, onSave, onDraftChange }) {
  const [draft, setDraft] = useState(savedDeg);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setDraft(savedDeg); }, [savedDeg]);

  useEffect(() => {
    if (!onDraftChange) return;
    const n = typeof draft === 'number' ? draft : Number(draft);
    if (Number.isFinite(n)) onDraftChange(instanceIndex, n);
  }, [draft, instanceIndex, onDraftChange]);

  const dirty = Math.abs(draft - savedDeg) > 1e-6;
  useEffect(() => { if (dirty) setJustSaved(false); }, [dirty]);

  const handleSave = async () => {
    const n = typeof draft === 'number' ? draft : Number(draft);
    if (!Number.isFinite(n)) { setError('Invalid angle'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await onSave(instanceIndex, n);
      if (result && typeof result.angle_deg === 'number') setDraft(result.angle_deg);
      setJustSaved(true);
    } catch (e) {
      setError(extractErrorMessage(e, 'Save failed'));
      setJustSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const buttonProps = saving
    ? { color: 'primary', disabled: true, startIcon: <CircularProgress size={14} color="inherit" /> }
    : justSaved && !dirty
      ? { color: 'success', disabled: true, startIcon: <CheckCircleIcon fontSize="small" /> }
      : { color: 'primary', disabled: !dirty };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">Analog Z Rotation</Typography>
        <Typography variant="caption" color="text.disabled">0&deg; – 360&deg;</Typography>
      </Stack>
      <Slider
        size="small"
        min={0}
        max={360}
        step={0.5}
        value={typeof draft === 'number' ? draft : 0}
        onChange={(_e, v) => setDraft(v)}
        sx={{ width: '100%' }}
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <TextField
          size="small"
          type="number"
          value={draft}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '' || raw === '-') { setDraft(raw); return; }
            const n = Number(raw);
            if (Number.isFinite(n)) setDraft(Math.max(0, Math.min(360, n)));
          }}
          inputProps={{ min: 0, max: 360, step: 0.5 }}
          sx={{ width: 90 }}
        />
        <Button size="small" variant="contained" onClick={handleSave} {...buttonProps} sx={{ minWidth: 72 }}>
          {justSaved && !dirty && !saving ? 'Saved' : 'Save'}
        </Button>
      </Stack>
      {error && <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>{error}</Typography>}
    </Box>
  );
}

// ── The Angle Calculation step ─────────────────────────────────────────────
// Loads the case's alignment job (already detected in Step 4). Lets the user
// pick which detected instances ("teeth") to compute angles for, then runs the
// scoped /angles (and later /correctors) endpoints with instance_indexes.
//
// Layout mirrors the alignment review: 3D viewer + sidebar with:
//   1. Instance selection   (which teeth to calculate — "Calculate Selected
//                            Teeth Angle" only computes these)
//   2. Visibility controls
//   3. Calculate Selected Teeth Angle button
//   4. Angle results + analog rotation + scan-body swap
//   5. Place Angle Correctors (scoped to same selection)
//   6. Teeth assignment (map instances -> tooth numbers)
//   7. Download results + finish
function SuperimposeStep({ caseId, scanFile, onComplete }) {
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlacingCorrectors, setIsPlacingCorrectors] = useState(false);
  const [seedPoint, setSeedPoint] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailureReason, setSearchFailureReason] = useState(null);

  const [visibleInstances, setVisibleInstances] = useState({ scene: true });
  const [hoveredInstance, setHoveredInstance] = useState(null);
  const [analogRotationDrafts, setAnalogRotationDrafts] = useState({});
  const [allVendors, setAllVendors] = useState([]);
  const [searchVendorId, setSearchVendorId] = useState('');

  const toothInstanceMap = useCaseStore((s) => s.toothInstanceMap);
  const patientName = useCaseStore((s) => s.patientData?.fullName ?? '');
  const caseRef = useCaseStore((s) => s.caseRef ?? '');
  const toothAssignments = useCaseStore((s) => s.toothAssignments);

  // Which instances to compute for. There is no separate selection any more:
  // an instance is "selected" exactly when the user has mapped it to a tooth in
  // the Teeth & Library panel, which is the scope the backend /angles and
  // /correctors calls are given.
  const selectedIndexes = useMemo(
    () => Object.keys(toothInstanceMap).map(Number).filter((n) => Number.isFinite(n)),
    [toothInstanceMap]
  );

  // The backend slices its /angles response to the requested instance scope,
  // but the viewer payload can still contain results from an earlier run or a
  // different assignment. Every results-driven section (Deviation card,
  // correctors, summary) is therefore derived from the INTERSECTION of the
  // stored results and the current selection — so only the selected teeth's
  // angles are ever shown.
  const visibleResults = useMemo(
    () => (job?.calculateAngles?.instance_results ?? []).filter((r) => selectedIndexes.includes(r.instance_index)),
    [job?.calculateAngles?.instance_results, selectedIndexes]
  );

  // ── Vendors for scan-body swap dropdowns ─────────────────────────────────
  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    listVendors(caseId)
      .then((v) => { if (!cancelled) setAllVendors(v); })
      .catch(() => { if (!cancelled) setAllVendors([]); });
    return () => { cancelled = true; };
  }, [caseId]);

  // Load the case's alignment job. If the job is missing and a scan file is in
  // memory, retry the upload once (same recovery as Step 4).
  const loadState = useCallback(async () => {
    if (!caseId) return null;
    let state = await getAlignmentState(caseId);
    if (!state?.job_id && scanFile) {
      await api.employee.cases.uploadScan(caseId, scanFile);
      state = await getAlignmentState(caseId);
    }
    setJob(state);
    return state;
  }, [caseId, scanFile]);

  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const state = await loadState();
        if (cancelled) return;
        if (state?.job_id && !isJobReady(state) && !isJobFailed(state)) {
          timer = setTimeout(tick, 4000);
        }
      } catch (e) {
        if (!cancelled) setError(extractErrorMessage(e, 'Could not load the alignment job'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [caseId, loadState]);

  // Default every detected instance to visible. Only seed missing entries;
  // never clobber the user's explicit choice.
  useEffect(() => {
    const indices = job?.summary?.instances?.map((i) => i.index) ?? [];
    if (indices.length === 0) return;
    setVisibleInstances((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const idx of indices) {
        if (next[idx] === undefined) { next[idx] = true; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [job?.summary?.instances]);

  const handleVisibilityChange = (key) => {
    setVisibleInstances((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePlaceAngleCorrectors = useCallback(async () => {
    if (!caseId || !job || !isJobReady(job)) return;
    if (visibleResults.length === 0 || isPlacingCorrectors) return;
    setError(null);
    try {
      setIsPlacingCorrectors(true);
      // Correctors are placed only for the teeth whose angle was computed AND
      // are still in the current selection — never for the whole instance set.
      const scope = visibleResults.map((r) => r.instance_index);
      const result = await placeAngleCorrectors(caseId, scope);
      setJob((prev) => (prev ? { ...prev, placeCorrectors: result } : prev));
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to place angle correctors'));
    } finally {
      setIsPlacingCorrectors(false);
    }
  }, [caseId, job, visibleResults, isPlacingCorrectors]);

  // ── Targeted search / delete (false-positive review) ─────────────────────
  const handleSeedSelected = useCallback((point) => {
    setSeedPoint(point);
    setSearchFailureReason(null);
  }, []);
  const handleClearSeed = useCallback(() => {
    setSeedPoint(null);
    setSearchFailureReason(null);
  }, []);

  const handleSearchAroundPoint = useCallback(async (vendorId = null) => {
    if (!seedPoint || !caseId || isSearching) return;
    setError(null);
    setSearchFailureReason(null);
    setIsSearching(true);
    try {
      const before = job?.summary?.instances?.length ?? 0;
      await searchAroundPoint(caseId, seedPoint.x, seedPoint.y, seedPoint.z, null, vendorId);

      let state = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        state = await getAlignmentState(caseId);
        if (state?.engine_status !== 'searching') break;
      }

      const after = state?.summary?.instances ?? [];
      if (after.length > before) {
        setJob({ ...state, calculateAngles: null, placeCorrectors: null });
        const added = after[after.length - 1];
        if (added?.index !== undefined) {
          // Not auto-selected: a found instance still has to be given a tooth
          // in the Teeth & Library panel before it is computed.
          setVisibleInstances((prev) => ({ ...prev, [added.index]: true }));
        }
        setSeedPoint(null);
      } else {
        if (state) {
          setJob((prev) => ({ ...state, calculateAngles: prev?.calculateAngles ?? null, placeCorrectors: prev?.placeCorrectors ?? null }));
        }
        setSearchFailureReason('No implant was found at that location. Try clicking closer to the socket.');
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Targeted search failed'));
    } finally {
      setIsSearching(false);
    }
  }, [seedPoint, caseId, isSearching, job]);

  // NOTE: per-instance deletion lived in the old "Select Teeth" list, which the
  // tooth-number panel replaced. Removing a wrongly-detected instance is still
  // available one step back, in the Alignment Review step.

  const handleSetInstanceVendor = useCallback(async (instanceIndex, vendorId) => {
    if (!caseId) return;
    setError(null);
    try {
      await setInstanceVendor(caseId, instanceIndex, vendorId);
      const updated = await getAlignmentState(caseId);
      setJob((prev) => ({
        ...updated,
        calculateAngles: prev?.calculateAngles ?? null,
        placeCorrectors: prev?.placeCorrectors ?? null,
      }));
    } catch (e) {
      setError(extractErrorMessage(e, 'Scan-body replacement failed'));
    }
  }, [caseId]);

  const handleRotateAnalog = useCallback(async (instanceIndex, angleDeg) => {
    if (!caseId) throw new Error('No active case');
    const updated = await rotateAnalog(caseId, instanceIndex, angleDeg);
    const savedDeg = (updated?.instances || []).find((i) => i.index === instanceIndex)
      ?.analog_z_rotation_deg ?? angleDeg;
    setJob((prev) => {
      if (!prev?.summary?.instances) return prev;
      return {
        ...prev,
        summary: {
          ...prev.summary,
          instances: prev.summary.instances.map((i) =>
            i.index === instanceIndex ? { ...i, analog_z_rotation_deg: savedDeg } : i
          ),
        },
      };
    });
    setAnalogRotationDrafts((prev) => {
      const { [instanceIndex]: _, ...rest } = prev;
      return rest;
    });
    return { angle_deg: savedDeg };
  }, [caseId]);

  const handleAnalogDraftChange = useCallback((instanceIndex, deg) => {
    setAnalogRotationDrafts((prev) => {
      if (prev[instanceIndex] === deg) return prev;
      return { ...prev, [instanceIndex]: deg };
    });
  }, []);

  // ── Download all results (same ZIP + PDF logic as Step 4) ────────────────
  const [isDownloading, setIsDownloading] = useState(false);

  // Persist the instance → tooth mapping against the case, so the assignments
  // made in the Teeth & Library panel show up in My Cases. Best-effort: the
  // results are already downloaded/computed by the time this runs, so a failure
  // here must not block finishing.
  const saveTeeth = useCallback(() => {
    if (!caseId) return;
    const teeth = Object.entries(toothInstanceMap).map(([instanceIndex, toothNumber]) => ({
      tooth_number: Number(toothNumber),
      instance_index: Number(instanceIndex),
    }));
    if (teeth.length === 0) return;
    api.employee.cases.addTeeth(caseId, teeth).catch(() => {});
  }, [caseId, toothInstanceMap]);

  const handleDownloadAll = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const token = sessionStorage.getItem('employee_token');
      const fetchFile = async (url) => {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
        return res.arrayBuffer();
      };

      if (job.artifacts?.scene) {
        try {
          const data = await fetchFile(fileUrl(job.artifacts.scene));
          const ext = job.artifacts.scene_format === 'stl' ? 'stl' : 'ply';
          zip.file(`denture_scan/scan.${ext}`, data);
        } catch { /* skip missing */ }
      }
      if (job.artifacts?.composite) {
        try { zip.file('global/composite_mesh.ply', await fetchFile(fileUrl(job.artifacts.composite))); } catch { /* skip */ }
      }
      if (job.calculateAngles?.reference_plane_path) {
        try { zip.file('global/reference_plane.stl', await fetchFile(fileUrl(job.calculateAngles.reference_plane_path))); } catch { /* skip */ }
      }
      if (job.calculateAngles?.reference_plane_cube_path) {
        try { zip.file('global/reference_plane_cube.stl', await fetchFile(fileUrl(job.calculateAngles.reference_plane_cube_path))); } catch { /* skip */ }
      }
      if (job.calculateAngles?.insertion_axis_cube_and_analogs_path) {
        try { zip.file('global/insertion_axis_cube_and_analogs.stl', await fetchFile(fileUrl(job.calculateAngles.insertion_axis_cube_and_analogs_path))); } catch { /* skip */ }
      }
      if (job.placeCorrectors?.final_with_correctors_path) {
        try { zip.file('global/final_with_angle_correctors.ply', await fetchFile(fileUrl(job.placeCorrectors.final_with_correctors_path))); } catch { /* skip */ }
      }
      if (job.calculateAngles?.instance_results) {
        for (const r of job.calculateAngles.instance_results) {
          const idx = r.instance_index;
          const tooth = toothInstanceMap[idx];
          const folder = tooth ? `instances/tooth_${tooth}` : `instances/instance_${String(idx).padStart(2, '0')}`;
          const prefix = tooth ? `tooth_${tooth}` : `instance_${String(idx).padStart(2, '0')}`;
          if (r.mesh_path) { try { zip.file(`${folder}/${prefix}_analog.ply`, await fetchFile(fileUrl(r.mesh_path))); } catch { /* skip */ } }
          if (r.mesh_with_scan_body_path) { try { zip.file(`${folder}/${prefix}_analog_with_scan_body.ply`, await fetchFile(fileUrl(r.mesh_with_scan_body_path))); } catch { /* skip */ } }
          if (r.mesh_rotation_vis_path) { try { zip.file(`${folder}/${prefix}_rotation_vis.ply`, await fetchFile(fileUrl(r.mesh_rotation_vis_path))); } catch { /* skip */ } }
        }
      }
      if (job.artifacts?.instances?.length) {
        for (let i = 0; i < job.artifacts.instances.length; i++) {
          const instPath = job.artifacts.instances[i];
          const inst = job.summary?.instances?.[i];
          const idx = inst?.index ?? i;
          const tooth = toothInstanceMap[idx];
          const folder = tooth ? `instances/tooth_${tooth}` : `instances/instance_${String(idx).padStart(2, '0')}`;
          const prefix = tooth ? `tooth_${tooth}` : `instance_${String(idx).padStart(2, '0')}`;
          try { zip.file(`${folder}/${prefix}_aligned.stl`, await fetchFile(fileUrl(instPath))); } catch { /* skip */ }
        }
      }
      if (job.placeCorrectors?.instance_correctors) {
        for (const c of job.placeCorrectors.instance_correctors) {
          const idx = c.instance_index;
          const tooth = toothInstanceMap[idx];
          const folder = tooth ? `instances/tooth_${tooth}` : `instances/instance_${String(idx).padStart(2, '0')}`;
          const prefix = tooth ? `tooth_${tooth}` : `instance_${String(idx).padStart(2, '0')}`;
          if (c.mesh_path) { try { zip.file(`${folder}/${prefix}_angle_corrector.stl`, await fetchFile(fileUrl(c.mesh_path))); } catch { /* skip */ } }
          if (c.head_mesh_path) { try { zip.file(`${folder}/${prefix}_corrector_head.stl`, await fetchFile(fileUrl(c.head_mesh_path))); } catch { /* skip */ } }
        }
      }

      const doc = new jsPDF();
      let y = 15;
      const lineH = 7;
      const pageH = 280;
      const checkPage = () => { if (y > pageH) { doc.addPage(); y = 15; } };

      doc.setFontSize(18);
      doc.text('Alignment Results Report', 105, y, { align: 'center' });
      y += lineH + 4;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Case: ${caseRef || caseId || 'N/A'}`, 14, y);
      y += lineH;
      if (patientName) { doc.text(`Patient: ${patientName}`, 14, y); y += lineH; }
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, y);
      y += lineH;
      doc.text(`Total Implants Detected: ${job.summary?.instances?.length ?? 0}`, 14, y);
      y += lineH + 4;
      doc.setTextColor(0);

      if (Object.keys(toothInstanceMap).length > 0) {
        doc.setFontSize(13);
        doc.text('Tooth Assignments', 14, y);
        y += lineH + 2;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Instance #', 14, y);
        doc.text('Tooth #', 60, y);
        doc.text('Library', 100, y);
        doc.text('Angle', 150, y);
        doc.setFont(undefined, 'normal');
        y += lineH - 2;
        doc.line(14, y, 196, y);
        y += lineH;
        for (const [instIdx, toothNum] of Object.entries(toothInstanceMap)) {
          checkPage();
          const idx = Number(instIdx);
          const inst = job.summary?.instances?.find((i) => i.index === idx);
          const angleResult = job.calculateAngles?.instance_results?.find((r) => r.instance_index === idx);
          const angle = angleResult ? `${Number(angleResult.angle).toFixed(2)}°` : '-';
          // The implant library picked for that tooth in the Teeth & Library
          // panel; falls back to the detected scan-body vendor when the user
          // didn't pick one.
          const lib = toothAssignments[toothNum];
          const libLabel = lib
            ? `${lib.company_name}${lib.angle_alignment != null ? ` · ${lib.angle_alignment}°` : ''}`
            : inst?.vendor_name || inst?.vendor_id || '-';
          doc.text(`#${idx}`, 14, y);
          doc.text(`#${toothNum}`, 60, y);
          doc.text(libLabel, 100, y);
          doc.text(angle, 150, y);
          y += lineH;
        }
        y += lineH;
      }

      if (job.calculateAngles?.instance_results?.length) {
        checkPage();
        doc.setFontSize(13);
        doc.text('Deviation from Optimal Insertion Axis', 14, y);
        y += lineH + 2;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Instance #', 14, y);
        doc.text('Tooth', 60, y);
        doc.text('Vendor', 85, y);
        doc.text('Angle (°)', 140, y);
        doc.setFont(undefined, 'normal');
        y += lineH - 2;
        doc.line(14, y, 196, y);
        y += lineH;
        for (const r of job.calculateAngles.instance_results) {
          checkPage();
          const tooth = toothInstanceMap[r.instance_index];
          const inst = job.summary?.instances?.find((i) => i.index === r.instance_index);
          doc.text(`#${r.instance_index}`, 14, y);
          doc.text(tooth ? `#${tooth}` : '-', 60, y);
          doc.text(inst?.vendor_name || inst?.vendor_id || '-', 85, y);
          doc.text(`${Number(r.angle).toFixed(2)}°`, 140, y);
          y += lineH;
        }
        y += lineH;
      }

      if (job.placeCorrectors?.instance_correctors?.length) {
        checkPage();
        doc.setFontSize(13);
        doc.text('Angle Correctors', 14, y);
        y += lineH + 2;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Instance #', 14, y);
        doc.text('Tooth', 60, y);
        doc.text('Corrector #', 85, y);
        doc.text('Angle (°)', 140, y);
        doc.setFont(undefined, 'normal');
        y += lineH - 2;
        doc.line(14, y, 196, y);
        y += lineH;
        for (const c of job.placeCorrectors.instance_correctors) {
          checkPage();
          const tooth = toothInstanceMap[c.instance_index];
          doc.text(`#${c.instance_index}`, 14, y);
          doc.text(tooth ? `#${tooth}` : '-', 60, y);
          doc.text(String(c.corrector_index).padStart(2, '0'), 85, y);
          doc.text(`${Number(c.angle).toFixed(2)}°`, 140, y);
          y += lineH;
        }
      }

      const pdfBlob = doc.output('blob');
      zip.file('report/angles_labels_report.pdf', pdfBlob);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const { saveAs } = await import('file-saver');
      saveAs(zipBlob, `alignment_results_${caseId || 'case'}.zip`);
      if (caseId) {
        saveTeeth();
        api.employee.cases.update(caseId, { status: 'completed' }).catch(() => {});
      }
      onComplete?.();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ bgcolor: '#F0F9FF', border: '1px solid', borderColor: '#C1E5FF', borderRadius: 3, py: { xs: 3, sm: 4 }, overflow: 'hidden' }}>
        <Container maxWidth="xl">
          <Stack spacing={{ xs: 3, sm: 4 }}>
            {error && (
              <Fade in timeout={300}>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'error.dark', border: '1px solid', borderColor: 'error.main', borderRadius: 3 }}>
                  <Typography color="error.light" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>⚠️ {error}</Typography>
                </Paper>
              </Fade>
            )}

            {(isLoading || (job?.job_id && !isJobReady(job) && !isJobFailed(job))) && (
              <JobDashboard events={[{ type: 'status', stage: 'processing', message: 'Loading alignment results' }]} />
            )}

            {isJobFailed(job) && (
              <Paper elevation={0} sx={{ p: 3, bgcolor: 'error.dark', border: '1px solid', borderColor: 'error.main', borderRadius: 3 }}>
                <Typography color="error.light">
                  Alignment failed: {job.error || 'the compute service could not process this scan.'}
                </Typography>
              </Paper>
            )}

            {!isLoading && !job?.job_id && (
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Typography color="text.secondary">
                  No alignment job yet for this case. Complete the Alignment Review step first.
                </Typography>
              </Paper>
            )}

            {isJobReady(job) && job.summary && (
              <Fade in timeout={800}>
                <Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: { xs: 2, sm: 3 }, minHeight: { xs: '400px', sm: '500px', md: '700px' } }}>
                    <Box sx={{ height: { xs: '400px', sm: '500px', md: '700px' } }}>
                      <Viewer3D
                        job={job}
                        visibleInstances={visibleInstances}
                        hoveredInstance={hoveredInstance}
                        seedPoint={job.calculateAngles?.instance_results ? null : seedPoint}
                        onSeedSelected={job.calculateAngles?.instance_results ? undefined : handleSeedSelected}
                        analogRotationDrafts={analogRotationDrafts}
                      />
                    </Box>

                    {/* The sidebar scrolls, so its children must keep their natural
                        height: as flex items they default to flex-shrink: 1, and MUI's
                        Card clips at overflow: hidden — which silently ate the
                        "Search Around Point" and "Calculate Selected Teeth Angle"
                        buttons, leaving only each card's heading visible. */}
                    <Stack spacing={{ xs: 2, sm: 3 }} sx={{ overflowY: 'auto', maxHeight: { xs: '500px', sm: '600px', md: '700px' }, pr: { xs: 0, sm: 1 }, '& > *': { flexShrink: 0 } }}>
                      {/* 1) Teeth + library selection — the teeth assigned here
                             are the instances the angle calculation runs on. */}
                      <TeethLibraryPanel
                        caseId={caseId}
                        instances={job.summary.instances}
                        onPreviewInstance={setHoveredInstance}
                      />

                      {/* 2) Visibility Controls */}
                      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                          Visibility Controls
                        </Typography>
                        <FormGroup>
                          <FormControlLabel
                            control={<Checkbox checked={visibleInstances['scene']} onChange={() => handleVisibilityChange('scene')} color="primary" />}
                            label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Denture Scan</Typography><Typography variant="caption" color="text.secondary">Primary dental mesh</Typography></Box>}
                          />
                          {job.calculateAngles?.insertion_axis_cube_and_analogs_path && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['cube_analogs']} onChange={() => handleVisibilityChange('cube_analogs')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Cube + Analogs</Typography><Typography variant="caption" color="text.secondary">Combined STL overview</Typography></Box>}
                            />
                          )}
                          {job.calculateAngles?.instance_results && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['use_pure_analog']} onChange={() => handleVisibilityChange('use_pure_analog')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Use Pure Analog</Typography><Typography variant="caption" color="text.secondary">Show the pure analog (no scan body)</Typography></Box>}
                            />
                          )}
                          {job.calculateAngles?.instance_results?.some((r) => r.mesh_rotation_vis_path) && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['rotation_visualization']} onChange={() => handleVisibilityChange('rotation_visualization')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Rotation Visualization</Typography><Typography variant="caption" color="text.secondary">Dedicated mesh for previewing the rotation</Typography></Box>}
                            />
                          )}
                          {job.calculateAngles?.reference_plane_path && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['reference_plane']} onChange={() => handleVisibilityChange('reference_plane')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Optimal Insertion Plane (2D)</Typography><Typography variant="caption" color="text.secondary">Calculated reference plane</Typography></Box>}
                            />
                          )}
                          {job.calculateAngles?.reference_plane_cube_path && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['reference_plane_cube']} onChange={() => handleVisibilityChange('reference_plane_cube')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Reference Plane Cube (3D)</Typography><Typography variant="caption" color="text.secondary">Thicker slab for visibility</Typography></Box>}
                            />
                          )}
                          {job.placeCorrectors?.final_with_correctors_path && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['final_with_correctors']} onChange={() => handleVisibilityChange('final_with_correctors')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Final Mesh with Correctors</Typography><Typography variant="caption" color="text.secondary">Scene + analogs + cube + correctors</Typography></Box>}
                            />
                          )}
                          {job.placeCorrectors?.instance_correctors?.length > 0 && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['angle_correctors']} onChange={() => handleVisibilityChange('angle_correctors')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Angle Correctors</Typography><Typography variant="caption" color="text.secondary">Pre-modeled angled abutments per instance</Typography></Box>}
                            />
                          )}
                          {job.placeCorrectors?.instance_correctors?.some((c) => c.head_mesh_path) && (
                            <FormControlLabel
                              control={<Checkbox checked={!!visibleInstances['corrector_heads']} onChange={() => handleVisibilityChange('corrector_heads')} />}
                              label={<Box><Typography variant="body2" sx={{ fontWeight: 600 }}>Analog Corrector Heads</Typography><Typography variant="caption" color="text.secondary">Corrector head per instance</Typography></Box>}
                            />
                          )}
                        </FormGroup>
                      </Paper>

                      {/* 3) Add a missed instance (before angles calculated) */}
                      {!job.calculateAngles?.instance_results && (
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={1.5}>
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>Add a Missed Instance</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  If alignment missed an instance, click that location in the 3D viewer, then search for it here.
                                </Typography>
                              </Box>
                              {seedPoint ? (
                                <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 2 }}>
                                  <Typography variant="caption" color="text.secondary" display="block">Selected point</Typography>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                    ({seedPoint.x.toFixed(2)}, {seedPoint.y.toFixed(2)}, {seedPoint.z.toFixed(2)})
                                  </Typography>
                                </Paper>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  Click an empty socket in the 3D viewer to set a search point.
                                </Typography>
                              )}
                              {(job.summary?.vendors?.length ?? 0) > 1 && (
                                <FormControl size="small" fullWidth>
                                  <Select
                                    value={searchVendorId}
                                    displayEmpty
                                    disabled={!!isSearching}
                                    onChange={(e) => setSearchVendorId(e.target.value)}
                                    inputProps={{ 'aria-label': 'Vendor to search' }}
                                  >
                                    <MenuItem value="">Auto (best fit across vendors)</MenuItem>
                                    {job.summary.vendors.map((v) => (
                                      <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              <Button
                                onClick={() => handleSearchAroundPoint(searchVendorId || null)}
                                variant="contained"
                                color="primary"
                                fullWidth
                                disabled={!seedPoint || !!isSearching}
                                startIcon={!isSearching ? <SearchIcon /> : null}
                                sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2, fontWeight: 700 }}
                              >
                                {isSearching ? (
                                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                    <CircularProgress size={18} color="inherit" /> Searching…
                                  </Box>
                                ) : ('Search Around Point')}
                              </Button>
                              {seedPoint && (
                                <Button onClick={handleClearSeed} variant="outlined" fullWidth disabled={!!isSearching} sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2 }}>
                                  Clear Selection
                                </Button>
                              )}
                              {searchFailureReason && (
                                <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>{searchFailureReason}</Alert>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      )}

                      {/* 4) Calculate Selected Teeth Angle */}
                      {/* {(!job.calculateAngles?.instance_results || !selectionMatchesCalculated) && (
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={1}>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>Calculations</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {selectedIndexes.length === 0
                                  ? 'Assign at least one tooth number above to calculate its angle.'
                                  : job.calculateAngles?.instance_results && selectedIndexes.length !== calculatedIndexes.size
                                    ? 'Selection changed since the last calculation — recalculate to update the angles.'
                                    : `${selectedIndexes.length} ${selectedIndexes.length === 1 ? 'tooth' : 'teeth'} assigned.`}
                              </Typography>
                            </Stack>
                            <Button
                              onClick={handleCalculateAngles}
                              variant="contained"
                              color="primary"
                              fullWidth
                              disabled={selectedIndexes.length === 0 || !!isCalculatingAngles}
                              startIcon={!isCalculatingAngles ? <SpeedIcon /> : null}
                              sx={{ mt: 1.5, py: { xs: 1, sm: 1.2 }, borderRadius: 2, fontWeight: 700 }}
                            >
                              {isCalculatingAngles ? (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                  <CircularProgress size={18} color="inherit" /> Calculating…
                                </Box>
                              ) : ('Calculate Selected Teeth Angle')}
                            </Button>
                          </CardContent>
                        </Card>
                      )} */}

                      {/* 5) Angle results for the selected teeth */}
                      {visibleResults.length > 0 && (
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={1}>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>Deviation from Optimal Insertion Axis</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Angles indicate tilt relative to the calculated group axis. Showing the {visibleResults.length} selected {visibleResults.length === 1 ? 'tooth' : 'teeth'} only.
                              </Typography>
                            </Stack>
                            <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 1.5 }}>
                              {visibleResults.map((r) => {
                                const summaryInst = job.summary?.instances?.find((i) => i.index === r.instance_index);
                                const savedDeg = Number(summaryInst?.analog_z_rotation_deg ?? 0);
                                return (
                                  <Paper key={r.instance_index} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: 'background.default', width: '100%' }}>
                                    <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                                      <Typography variant="caption" color="text.secondary">Instance #{r.instance_index}</Typography>
                                      <Typography variant="h6" color="primary" sx={{ fontWeight: 800, lineHeight: 1 }}>
                                        {Number(r.angle).toFixed(2)}°
                                      </Typography>
                                    </Stack>
                                    {allVendors.length > 1 ? (
                                      <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                                        <Select
                                          value={summaryInst?.scan_body_vendor_id ?? summaryInst?.vendor_id ?? ''}
                                          displayEmpty
                                          onChange={(e) => {
                                            const current = summaryInst?.scan_body_vendor_id ?? summaryInst?.vendor_id;
                                            if (e.target.value && e.target.value !== current) {
                                              handleSetInstanceVendor(r.instance_index, e.target.value);
                                            }
                                          }}
                                          inputProps={{ 'aria-label': `Scan body for instance ${r.instance_index}` }}
                                        >
                                          {allVendors.map((v) => (
                                            <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    ) : (
                                      summaryInst?.vendor_name && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                          Vendor: {summaryInst.vendor_name}
                                        </Typography>
                                      )
                                    )}
                                    <AnalogRotationControl
                                      instanceIndex={r.instance_index}
                                      savedDeg={savedDeg}
                                      onSave={handleRotateAnalog}
                                      onDraftChange={handleAnalogDraftChange}
                                    />
                                  </Paper>
                                );
                              })}
                            </Stack>
                          </CardContent>
                        </Card>
                      )}

                      {/* 6) Place Angle Correctors (scoped to selection) */}
                      {visibleResults.length > 0 && !job.placeCorrectors?.instance_correctors && (
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Button
                              onClick={handlePlaceAngleCorrectors}
                              variant="contained"
                              color="primary"
                              fullWidth
                              disabled={!!isPlacingCorrectors}
                              sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2, fontWeight: 700 }}
                            >
                              {isPlacingCorrectors ? (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                  <CircularProgress size={18} color="inherit" /> Placing…
                                </Box>
                              ) : ('Place Angle Correctors')}
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      {/* 7) Summary + download / finish
                             (teeth are assigned up front, in the panel above,
                             so the old Phase-C panel that used to sit here is
                             gone — it asked for the same mapping twice.) */}
                      {visibleResults.length > 0 && (
                        <Card elevation={0} sx={{ background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(33, 150, 243, 0.1) 100%)', border: '1px solid', borderColor: 'success.main', borderRadius: 3 }}>
                          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={{ xs: 1.5, sm: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleIcon sx={{ color: 'success.main', fontSize: { xs: 28, sm: 32 } }} />
                                <Typography  className='text-black' variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                                  Analysis Complete!
                                </Typography>
                              </Box>
                              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, textAlign: 'center' }}>
                                <Typography variant="h3" color="primary" sx={{ fontWeight: 700, fontSize: { xs: '2rem', sm: '3rem' } }}>
                                  {visibleResults.length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                  Teeth Angle Calculated
                                </Typography>
                              </Paper>
                              <Button
                                onClick={handleDownloadAll}
                                variant="contained"
                                startIcon={isDownloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
                                fullWidth
                                disabled={isDownloading}
                                sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2, fontWeight: 600 }}
                              >
                                {isDownloading ? 'Packaging Results…' : 'Download All Results'}
                              </Button>
                              <Button
                                onClick={() => { saveTeeth(); onComplete?.(); }}
                                variant="outlined"
                                fullWidth
                                sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2, fontWeight: 600 }}
                              >
                                Finish
                              </Button>
                            </Stack>
                          </CardContent>
                        </Card>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </Fade>
            )}
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default SuperimposeStep;
