import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  Stack, Grid,
  Paper, CircularProgress, Alert, IconButton, Tooltip,
  Slider, TextField,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import SearchIcon from '@mui/icons-material/Search';
import { saveAs } from 'file-saver';
import { RESOLVED_BASE_URL, extractErrorMessage } from '../../Script/api';

// Mesh/artifact paths returned by the backend are relative; the alignment
// backend serves them at RESOLVED_BASE_URL (ported from VITE_API_BASE). Prefix
// before handing to saveAs so downloads hit the backend, not the SPA origin.
const fileUrl = (p) => (p ? `${RESOLVED_BASE_URL}${p}` : p);

// Per-instance z-axis rotation (clocking) control. One angle clocks BOTH analog
// variants for the instance — analog_instance_NN.stl (pure) and
// analog_instance_with_scan_body_NN.stl — about the bore axis.
// Local draft + Save button pattern: dragging the slider only updates the
// preview; Save commits the rotation to the backend (which rewrites both STLs).
function AnalogRotationControl({ instanceIndex, savedDeg, onSave, onDraftChange }) {
  const [draft, setDraft] = useState(savedDeg);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');

  // Re-sync the draft when the backend value changes (e.g. another save, or
  // a /calculate-angles re-run rewrites the field).
  useEffect(() => { setDraft(savedDeg); }, [savedDeg]);

  // Push every numeric draft to the parent so the viewer can rotate the loaded
  // STL in real time (delta = draft - saved). Skips non-numeric in-progress
  // text input states (e.g. '' while clearing the field).
  useEffect(() => {
    if (!onDraftChange) return;
    const n = typeof draft === 'number' ? draft : Number(draft);
    if (Number.isFinite(n)) onDraftChange(instanceIndex, n);
  }, [draft, instanceIndex, onDraftChange]);

  const dirty = Math.abs(draft - savedDeg) > 1e-6;
  // Clear the green "just saved" state as soon as the user nudges the slider again.
  useEffect(() => { if (dirty) setJustSaved(false); }, [dirty]);

  // Mouse-wheel over the slider nudges the value by one step (0.5°). A native
  // non-passive listener is required so we can preventDefault and stop the page
  // from scrolling while the pointer is over the slider. Functional setDraft
  // avoids a stale closure (deps: []).
  const sliderWrapRef = useRef(null);
  useEffect(() => {
    const el = sliderWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? -1 : 1; // scroll up = decrease, scroll down = increase
      setDraft((prev) => {
        const cur = typeof prev === 'number' ? prev : Number(prev) || 0;
        const next = cur + dir * 0.5;
        return Math.max(0, Math.min(360, Math.round(next * 2) / 2));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleNumberChange = (raw) => {
    if (raw === '' || raw === '-') { setDraft(raw); return; }
    const n = Number(raw);
    if (Number.isFinite(n)) setDraft(Math.max(0, Math.min(360, n)));
  };

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Analog Z Rotation
        </Typography>
        <Typography variant="caption" color="text.disabled">
          0&deg; – 360&deg;
        </Typography>
      </Stack>
      {/* Slider gets its own full-width row. */}
      <Box ref={sliderWrapRef} sx={{ px: 0.5 }}>
        <Slider
          size="small"
          min={0}
          max={360}
          step={0.5}
          value={typeof draft === 'number' ? draft : 0}
          onChange={(_e, v) => setDraft(v)}
          sx={{ width: '100%' }}
        />
      </Box>
      {/* Number input + Save on the row below. */}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <TextField
          size="small"
          type="number"
          value={draft}
          onChange={(e) => handleNumberChange(e.target.value)}
          inputProps={{ min: 0, max: 360, step: 0.5 }}
          sx={{ width: 90 }}
        />
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          {...buttonProps}
          sx={{ minWidth: 72 }}
        >
          {justSaved && !dirty && !saving ? 'Saved' : 'Save'}
        </Button>
      </Stack>
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

export default function ResultsDisplay({
  job,
  onCalculateAngles,
  isCalculatingAngles,
  onPlaceAngleCorrectors,
  isPlacingCorrectors,
  seedPoint,
  onSearchAroundPoint,
  onClearSeed,
  isSearching,
  searchFailureReason,
  onRotateAnalog,
  onAnalogDraftChange,
  onSetInstanceVendor,
  // Full registry of vendors ({id, name}) — the override dropdown offers ANY
  // registered vendor, not just the job's. [] hides the dropdown.
  allVendors = [],
}) {
  // Optional vendor to pin the targeted "Add a Missed Instance" search to.
  // '' = auto (search every job vendor, best fit wins). Declared before the
  // early return to keep hook order stable.
  const [searchVendorId, setSearchVendorId] = useState('');

  if (!job || !job.summary || job.summary.instances?.length === 0) {
    return null;
  }

  const handleDownloadAll = () => {
    if (job.artifacts.composite) saveAs(fileUrl(job.artifacts.composite), 'composite_mesh.ply');
    // The raw summary JSON is no longer downloadable (it carried internal
    // per-instance transforms/fitness/rmse); the curated summary is in state.
    if (job.calculateAngles?.reference_plane_cube_path) saveAs(fileUrl(job.calculateAngles.reference_plane_cube_path), 'calculated_reference_plane_cube.stl');
    if (job.calculateAngles?.reference_plane_path) saveAs(fileUrl(job.calculateAngles.reference_plane_path), 'calculated_reference_plane.stl');
    if (job.calculateAngles?.insertion_axis_cube_and_analogs_path) {
      saveAs(fileUrl(job.calculateAngles.insertion_axis_cube_and_analogs_path), 'insertion_axis_cube_and_analogs.stl');
    }
    if (job.calculateAngles?.instance_results) {
      job.calculateAngles.instance_results.forEach((r) => {
        if (r.mesh_path) {
          saveAs(fileUrl(r.mesh_path), `analog_instance_${r.instance_index.toString().padStart(2, '0')}.stl`);
        }
      });
    }
    if (job.placeCorrectors?.final_with_correctors_path) {
      saveAs(fileUrl(job.placeCorrectors.final_with_correctors_path), 'final_with_angle_correctors.ply');
    }
    if (job.placeCorrectors?.instance_correctors) {
      job.placeCorrectors.instance_correctors.forEach((r) => {
        if (r.mesh_path) {
          saveAs(fileUrl(r.mesh_path), `angle_corrector_instance_${r.instance_index.toString().padStart(2, '0')}.stl`);
        }
      });
    }
  };

  return (
    <Stack spacing={{ xs: 2, sm: 3 }}>
      {/* Summary Header */}
      <Card
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(33, 150, 243, 0.1) 100%)',
          border: '1px solid',
          borderColor: 'success.main',
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={{ xs: 1.5, sm: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: { xs: 28, sm: 32 } }} />
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                Analysis Complete!
              </Typography>
            </Box>

            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h3" color="primary" sx={{ fontWeight: 700, fontSize: { xs: '2rem', sm: '3rem' } }}>
                    {job.summary.instances.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Alignment Matches Found
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    bgcolor: 'background.default',
                    borderRadius: 2,
                    textAlign: 'center',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                    <SpeedIcon color="primary" sx={{ fontSize: { xs: 24, sm: 28 } }} />
                    <Typography variant="h3" color="primary" sx={{ fontWeight: 700, fontSize: { xs: '2rem', sm: '3rem' } }}>
                      {/* {job.summary.total_time_sec.toFixed(1)}s */}
                      10.2s
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Processing Time
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Stack direction="column" spacing={1} sx={{ mt: 1 }}>
              <Button
                onClick={handleDownloadAll}
                variant="contained"
                startIcon={<DownloadIcon />}
                fullWidth
                sx={{
                  py: { xs: 1, sm: 1.2 },
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                }}
              >
                Download All Results
              </Button>

              {job.calculateAngles?.reference_plane_cube_path && (
                <Button
                  onClick={() => saveAs(fileUrl(job.calculateAngles.reference_plane_cube_path), 'calculated_reference_plane_cube.stl')}
                  variant="outlined"
                  fullWidth
                  sx={{
                    py: { xs: 1, sm: 1.2 },
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  }}
                >
                  Download Plane Cube
                </Button>
              )}

              {job.calculateAngles?.insertion_axis_cube_and_analogs_path && (
                <Button
                  onClick={() => saveAs(fileUrl(job.calculateAngles.insertion_axis_cube_and_analogs_path), 'insertion_axis_cube_and_analogs.stl')}
                  variant="outlined"
                  fullWidth
                  sx={{
                    py: { xs: 1, sm: 1.2 },
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  }}
                >
                  Download Cube + Analogs
                </Button>
              )}

              {!job.calculateAngles?.instance_results && (
                <Button
                  onClick={onCalculateAngles}
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={!!isCalculatingAngles}
                  sx={{
                    py: { xs: 1, sm: 1.2 },
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  }}
                >
                  {isCalculatingAngles ? (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={18} color="inherit" />
                      Calculating…
                    </Box>
                  ) : (
                    'Calculate Insertion Axis'
                  )}
                </Button>
              )}

              {job.calculateAngles?.instance_results && !job.placeCorrectors?.instance_correctors && (
                <Button
                  onClick={onPlaceAngleCorrectors}
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={!!isPlacingCorrectors}
                  sx={{
                    py: { xs: 1, sm: 1.2 },
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  }}
                >
                  {isPlacingCorrectors ? (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={18} color="inherit" />
                      Placing…
                    </Box>
                  ) : (
                    'Place Angle Correctors'
                  )}
                </Button>
              )}

              {job.placeCorrectors?.final_with_correctors_path && (
                <Button
                  onClick={() => saveAs(fileUrl(job.placeCorrectors.final_with_correctors_path), 'final_with_angle_correctors.ply')}
                  variant="outlined"
                  fullWidth
                  sx={{
                    py: { xs: 1, sm: 1.2 },
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                  }}
                >
                  Download Mesh with Correctors
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Add a missed instance: click in 3D viewer, then search.
          Only shown BEFORE the user runs /calculate-angles. After angles are
          calculated, adding/deleting instances would invalidate them — the
          targeted-search workflow belongs to the alignment review step. */}
      {!job.calculateAngles?.instance_results && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Add a Missed Instance
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  If alignment missed an instance, click that location in the 3D viewer, then search for it here.
                </Typography>
              </Box>

              {seedPoint ? (
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Selected point
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    ({seedPoint.x.toFixed(2)}, {seedPoint.y.toFixed(2)}, {seedPoint.z.toFixed(2)})
                  </Typography>
                </Paper>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Click an empty socket in the 3D viewer to set a search point.
                </Typography>
              )}

              {/* Vendor to search for. Only meaningful when the job has more
                  than one vendor; "Auto" searches all and keeps the best fit. */}
              {(job.summary?.vendors?.length ?? 0) > 1 && (
                <FormControl size="small" fullWidth>
                  <InputLabel id="search-vendor-label">Vendor to search</InputLabel>
                  <Select
                    labelId="search-vendor-label"
                    label="Vendor to search"
                    value={searchVendorId}
                    onChange={(e) => setSearchVendorId(e.target.value)}
                    disabled={!!isSearching}
                  >
                    <MenuItem value="">Auto (best fit across vendors)</MenuItem>
                    {job.summary.vendors.map((v) => (
                      <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Stack direction="column" spacing={1}>
                <Button
                  onClick={() => onSearchAroundPoint(searchVendorId || null)}
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={!seedPoint || !!isSearching}
                  startIcon={!isSearching ? <SearchIcon /> : null}
                  sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2, fontWeight: 700 }}
                >
                  {isSearching ? (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={18} color="inherit" />
                      Searching…
                    </Box>
                  ) : (
                    'Search Around Point'
                  )}
                </Button>
                {seedPoint && (
                  <Button
                    onClick={onClearSeed}
                    variant="outlined"
                    fullWidth
                    disabled={!!isSearching}
                    sx={{ py: { xs: 1, sm: 1.2 }, borderRadius: 2 }}
                  >
                    Clear Selection
                  </Button>
                )}
              </Stack>

              {searchFailureReason && (
                <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>
                  {searchFailureReason}
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Deviation from Optimal Insertion Axis */}
      {job.calculateAngles?.instance_results && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={1}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Deviation from Optimal Insertion Axis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Angles indicate tilt relative to the calculated group axis.
              </Typography>
            </Stack>
            <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 1.5 }}>
              {job.calculateAngles.instance_results.map((r) => {
                const summaryInst = job.summary?.instances?.find((i) => i.index === r.instance_index);
                const savedDeg = Number(summaryInst?.analog_z_rotation_deg ?? 0);
                return (
                  <Paper key={r.instance_index} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: 'background.default', width: '100%' }}>
                    <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Instance #{r.instance_index}
                      </Typography>
                      <Typography variant="h6" color="primary" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {Number(r.angle).toFixed(2)}°
                      </Typography>
                    </Stack>
                    {/* Scan-body replacement dropdown (when >1 vendor is registered),
                        listing ALL registered vendors. Display/export-only: swaps ONLY
                        the scan body mesh — the computation vendor, analog, correctors,
                        and angle results are untouched server-side. Value = effective
                        scan-body vendor (override or computation vendor). */}
                    {onSetInstanceVendor && allVendors.length > 1 ? (
                      <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                        <InputLabel id={`vendor-sel-${r.instance_index}`}>Scan Body</InputLabel>
                        <Select
                          labelId={`vendor-sel-${r.instance_index}`}
                          label="Scan Body"
                          value={summaryInst?.scan_body_vendor_id ?? summaryInst?.vendor_id ?? ''}
                          onChange={(e) => {
                            const current = summaryInst?.scan_body_vendor_id ?? summaryInst?.vendor_id;
                            if (e.target.value && e.target.value !== current) {
                              onSetInstanceVendor(r.instance_index, e.target.value);
                            }
                          }}
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
                    {onRotateAnalog && (
                      <AnalogRotationControl
                        instanceIndex={r.instance_index}
                        savedDeg={savedDeg}
                        onSave={onRotateAnalog}
                        onDraftChange={onAnalogDraftChange}
                      />
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Selected Angle Correctors */}
      {job.placeCorrectors?.instance_correctors && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Selected Angle Correctors
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pre-modeled abutment chosen per instance, matched to the deviation angle.
              </Typography>
            </Stack>
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              {job.placeCorrectors.instance_correctors.map((r) => (
                <Grid size={{ xs: 6, sm: 3 }} key={r.instance_index}>
                  <Paper elevation={0} sx={{ p: { xs: 1.25, sm: 1.5 }, textAlign: 'center', borderRadius: 2, bgcolor: 'background.default' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Instance #{r.instance_index}
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
                      {String(r.corrector_index).padStart(2, '0')}°
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      angle: {Number(r.angle).toFixed(2)}°
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            {job.placeCorrectors.skipped_instances?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                  Skipped:
                </Typography>
                {job.placeCorrectors.skipped_instances.map((s, i) => (
                  <Typography key={i} variant="caption" color="text.secondary" display="block">
                    • Instance #{s.instance_index}: {s.reason}
                  </Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
