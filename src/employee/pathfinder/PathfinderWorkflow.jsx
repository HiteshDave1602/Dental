import { useState, useCallback, useEffect } from 'react';
import {
  getAlignmentState, calculateAngles, placeAngleCorrectors, searchAroundPoint,
  deleteInstance, rotateAnalog, setInstanceVendor, listVendors,
  extractErrorMessage,
} from '../../Script/api';
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
  IconButton, Tooltip,
  FormControl, Select, MenuItem,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import JobDashboard from './JobDashboard';
import ResultsDisplay from './ResultsDisplay';
import Viewer3D from './Viewer3D';
import theme from './theme';

// The scan-body alignment review, for one case.
//
// Originally ported from a standalone app, where it owned the whole lifecycle:
// it uploaded its own mesh and created a job that lived in the middleware's
// memory, disconnected from any case. It now reads the case's alignment job
// (submitted when the scan was uploaded in the wizard), so results are
// recorded against the case and a page refresh resumes where the user left
// off. Wrapped in a scoped MUI ThemeProvider so it themes correctly inside the
// otherwise-Tailwind employee panel.
function PathfinderApp({ caseId, onComplete }) {
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCalculatingAngles, setIsCalculatingAngles] = useState(false);
  const [isPlacingCorrectors, setIsPlacingCorrectors] = useState(false);
  const [seedPoint, setSeedPoint] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailureReason, setSearchFailureReason] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [visibleInstances, setVisibleInstances] = useState({ scene: true });
  const [hoveredInstance, setHoveredInstance] = useState(null);
  // In-progress per-instance analog rotation drafts ({ [index]: deg }).
  // Drives the viewer's live preview while the slider is dragged; cleared on Save.
  const [analogRotationDrafts, setAnalogRotationDrafts] = useState({});

  // Vendors registered on the alignment engine. An instance's scan body can be
  // swapped to any of them, so the per-instance dropdowns list them all. Falls
  // back to [] on error, which hides the dropdowns and leaves read-only vendor
  // captions in place.
  const [allVendors, setAllVendors] = useState([]);
  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    listVendors(caseId)
      .then((v) => { if (!cancelled) setAllVendors(v); })
      .catch(() => { if (!cancelled) setAllVendors([]); });
    return () => { cancelled = true; };
  }, [caseId]);

  // The workflow reads the case's own alignment job rather than creating one:
  // the scan was uploaded earlier in the wizard and a job was submitted then.
  // Because state lives server-side, refreshing the page mid-review restores
  // everything — including angle and corrector results already computed.
  const loadState = useCallback(async () => {
    if (!caseId) return null;
    const state = await getAlignmentState(caseId);
    setJob(state);
    return state;
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    let timer;

    // Detection takes minutes, so poll until the engine settles. The old
    // WebSocket progress channel belonged to the retired /api adapter.
    const tick = async () => {
      try {
        const state = await loadState();
        if (cancelled) return;
        if (state?.status === 'aligning') {
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

  // Whenever the job's instance list changes (alignment completes, search adds
  // one, delete removes one), make sure each instance index has an explicit
  // visibility entry so the sidebar checkbox state matches what the viewer
  // actually renders. Default each instance to visible. Don't clobber any
  // entry the user has explicitly toggled off — only seed missing ones.
  useEffect(() => {
    const indices = job?.summary?.instances?.map(i => i.index) ?? [];
    if (indices.length === 0) return;
    setVisibleInstances(prev => {
      const next = { ...prev };
      let changed = false;
      for (const idx of indices) {
        if (next[idx] === undefined) {
          next[idx] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [job?.summary?.instances]);

  const handleVisibilityChange = (key) => {
    setVisibleInstances(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCalculateAngles = useCallback(async () => {
    if (!caseId || !job || job.status !== 'completed') return;
    if (job.calculateAngles || isCalculatingAngles) return;
    setError(null);
    try {
      setIsCalculatingAngles(true);
      const result = await calculateAngles(caseId);
      setJob(prev => (prev ? { ...prev, calculateAngles: result } : prev));
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to calculate insertion angles'));
    } finally {
      setIsCalculatingAngles(false);
    }
  }, [caseId, job, isCalculatingAngles]);

  // Final step. As well as placing correctors, this records the results
  // against the case's teeth server-side, which is what makes them appear in
  // My Cases — the workflow is no longer a detached tool.
  const handlePlaceAngleCorrectors = useCallback(async () => {
    if (!caseId || !job || job.status !== 'completed') return;
    if (!job.calculateAngles?.instance_results) return;
    if (job.placeCorrectors || isPlacingCorrectors) return;
    setError(null);
    try {
      setIsPlacingCorrectors(true);
      const result = await placeAngleCorrectors(caseId);
      setJob(prev => (prev ? { ...prev, placeCorrectors: result } : prev));
      if (onComplete) onComplete(result);
    } catch (e) {
      setError(extractErrorMessage(e, 'Failed to place angle correctors'));
    } finally {
      setIsPlacingCorrectors(false);
    }
  }, [caseId, job, isPlacingCorrectors, onComplete]);

  const handleSeedSelected = useCallback((point) => {
    setSeedPoint(point);
    setSearchFailureReason(null);
  }, []);

  const handleClearSeed = useCallback(() => {
    setSeedPoint(null);
    setSearchFailureReason(null);
  }, []);

  // Refetch the job from the server after any add/delete on instances. Both
  // calculateAngles and placeCorrectors are *always* dropped — they were
  // computed over the old instance set and are stale by definition once the
  // set changes. The user re-triggers them via the existing buttons.
  const refreshJobAfterMutation = useCallback(async () => {
    const updated = await getAlignmentState(caseId);
    setJob({
      ...updated,
      calculateAngles: null,
      placeCorrectors: null,
    });
  }, [caseId]);

  const handleSearchAroundPoint = useCallback(async (vendorId = null) => {
    if (!seedPoint || !caseId || isSearching) return;
    setError(null);
    setSearchFailureReason(null);
    setIsSearching(true);
    try {
      // The engine runs this asynchronously, so poll until the job leaves the
      // searching state, then reload to see whether an instance was added.
      const before = job?.summary?.instances?.length ?? 0;
      await searchAroundPoint(caseId, seedPoint.x, seedPoint.y, seedPoint.z, null, vendorId);

      let state = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // eslint-disable-next-line no-await-in-loop
        state = await getAlignmentState(caseId);
        if (state?.engine_status !== 'searching') break;
      }

      const after = state?.summary?.instances ?? [];
      if (after.length > before) {
        setJob({ ...state, calculateAngles: null, placeCorrectors: null });
        const added = after[after.length - 1];
        if (added?.index) setVisibleInstances(prev => ({ ...prev, [added.index]: true }));
        setSeedPoint(null);
      } else {
        if (state) setJob(prev => ({ ...state, calculateAngles: prev?.calculateAngles ?? null, placeCorrectors: prev?.placeCorrectors ?? null }));
        setSearchFailureReason('No implant was found at that location. Try clicking closer to the socket.');
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Targeted search failed'));
    } finally {
      setIsSearching(false);
    }
  }, [seedPoint, caseId, isSearching, job]);

  const handleDeleteInstance = useCallback(async (instanceIndex) => {
    if (!caseId || isDeleting) return;
    if (!window.confirm(`Delete instance #${instanceIndex}? Any angle calculations will be invalidated.`)) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteInstance(caseId, instanceIndex);
      await refreshJobAfterMutation();
      // Drop the visibility entry for the removed instance
      setVisibleInstances(prev => {
        const { [instanceIndex]: _, ...rest } = prev;
        return rest;
      });
    } catch (e) {
      setError(extractErrorMessage(e, 'Delete instance failed'));
    } finally {
      setIsDeleting(false);
    }
  }, [caseId, isDeleting, refreshJobAfterMutation]);

  // Replace an instance's SCAN BODY with another vendor's scan body.
  // Scan-body-only + display/export-only: the backend rewrites ONLY
  // aligned_instance_NN.stl (+ scene composite) and stores the override as
  // scan_body_vendor_id — the computation vendor, analog STLs, correctors,
  // and angle_results are all untouched. So — unlike add/delete — do NOT
  // refreshJobAfterMutation (it would clear calculateAngles/placeCorrectors);
  // re-fetch the summary for the updated scan_body_vendor_id and keep the
  // results. The rewritten aligned STL reloads because its cache-buster URL
  // includes the scan-body vendor id.
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

  // Live-preview draft: the slider pushes its in-progress value here on every
  // change so the viewer can rotate the loaded STL in real time (no reload, no
  // backend call). The viewer applies (draft - saved) around the bore axis.
  const handleAnalogDraftChange = useCallback((instanceIndex, deg) => {
    setAnalogRotationDrafts((prev) => {
      if (prev[instanceIndex] === deg) return prev;
      return { ...prev, [instanceIndex]: deg };
    });
  }, []);

  // Save the per-instance analog z-rotation. Does NOT invalidate
  // angle_results or corrector_results (rotation is rotation-invariant for
  // the deviation angle and corrector seating). We update the local job's
  // summary.instances[i].analog_z_rotation_deg in place so the slider's
  // saved value re-syncs and the viewer's cache-buster URL changes.
  const handleRotateAnalog = useCallback(async (instanceIndex, angleDeg) => {
    if (!caseId) throw new Error('No active case');
    const updated = await rotateAnalog(caseId, instanceIndex, angleDeg);
    const savedDeg = (updated?.instances || []).find((i) => i.index === instanceIndex)
      ?.analog_z_rotation_deg ?? angleDeg;
    setJob((prev) => {
      if (!prev?.summary?.instances) return prev;
      const updatedInstances = prev.summary.instances.map((i) =>
        i.index === instanceIndex ? { ...i, analog_z_rotation_deg: savedDeg } : i
      );
      return { ...prev, summary: { ...prev.summary, instances: updatedInstances } };
    });
    // Drop the draft: the baked STL now reflects this angle, so the live-preview
    // delta must return to zero (otherwise it would double-apply on top of the
    // freshly-rewritten mesh).
    setAnalogRotationDrafts((prev) => {
      const { [instanceIndex]: _, ...rest } = prev;
      return rest;
    });
    return { angle_deg: savedDeg };
  }, [caseId]);

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          py: { xs: 3, sm: 4 },
          overflow: 'hidden',
        }}
      >
      <Container maxWidth="xl">
        <Stack spacing={{ xs: 3, sm: 4 }}>
          {/* No upload form here: the scan was uploaded with the case, and a
              job was submitted server-side at that point. */}

          {/* Error Display */}
          {error && (
            <Fade in timeout={300}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 3 },
                  bgcolor: 'error.dark',
                  border: '1px solid',
                  borderColor: 'error.main',
                  borderRadius: 3,
                }}
              >
                <Typography color="error.light" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>⚠️ {error}</Typography>
              </Paper>
            </Fade>
          )}

          {/* Detection in progress. Alignment takes minutes; the state above
              polls until the engine reports instances. */}
          {(isLoading || job?.status === 'aligning') && (
            <JobDashboard events={[{ type: 'status', stage: 'processing', message: 'Detecting implants in the scan' }]} />
          )}

          {job?.status === 'failed' && (
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'error.dark', border: '1px solid', borderColor: 'error.main', borderRadius: 3 }}>
              <Typography color="error.light">
                Alignment failed: {job.error || 'the compute service could not process this scan.'}
              </Typography>
            </Paper>
          )}

          {!isLoading && !job?.job_id && (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <Typography color="text.secondary">
                No alignment job yet for this case. Upload a scan and assign at least one
                tooth to a library mapped to an alignment vendor.
              </Typography>
            </Paper>
          )}

          {/* Results Section */}
          {job?.status === 'completed' && job.summary && (
            <Fade in timeout={800}>
              <Box>
                {/* Main Viewer and Controls */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' },
                    gap: { xs: 2, sm: 3 },
                    minHeight: { xs: '400px', sm: '500px', md: '700px' },
                  }}
                >
                  {/* 3D Viewer */}
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

                  {/* Sidebar with Results and Controls */}
                  <Stack spacing={{ xs: 2, sm: 3 }} sx={{ overflowY: 'auto', maxHeight: { xs: '500px', sm: '600px', md: '700px' }, pr: { xs: 0, sm: 1 } }}>
                    {/* Visibility Controls */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 2, sm: 2.5 },
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 3,
                      }}
                    >
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                        Visibility Controls
                      </Typography>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={visibleInstances['scene']}
                              onChange={() => handleVisibilityChange('scene')}
                              color="primary"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Denture Scan
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Primary dental mesh
                              </Typography>
                            </Box>
                          }
                        />
                        {job.calculateAngles?.insertion_axis_cube_and_analogs_path && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['cube_analogs']}
                                onChange={() => handleVisibilityChange('cube_analogs')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Cube + Analogs
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Combined STL overview
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.calculateAngles?.instance_results && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['use_pure_analog']}
                                onChange={() => handleVisibilityChange('use_pure_analog')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Use Pure Analog
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Show the pure analog (no scan body)
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.calculateAngles?.instance_results?.some((r) => r.mesh_rotation_vis_path) && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['rotation_visualization']}
                                onChange={() => handleVisibilityChange('rotation_visualization')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Rotation Visualization
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Dedicated mesh for previewing the rotation
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.calculateAngles?.reference_plane_path && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['reference_plane']}
                                onChange={() => handleVisibilityChange('reference_plane')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Optimal Insertion Plane (2D)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Calculated reference plane
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.calculateAngles?.reference_plane_cube_path && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['reference_plane_cube']}
                                onChange={() => handleVisibilityChange('reference_plane_cube')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Reference Plane Cube (3D)
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Thicker slab for visibility
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.placeCorrectors?.final_with_correctors_path && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['final_with_correctors']}
                                onChange={() => handleVisibilityChange('final_with_correctors')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Final Mesh with Correctors
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Scene + analogs + cube + correctors
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.placeCorrectors?.instance_correctors?.length > 0 && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['angle_correctors']}
                                onChange={() => handleVisibilityChange('angle_correctors')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Angle Correctors
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Pre-modeled angled abutments per instance
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.placeCorrectors?.instance_correctors?.some((c) => c.head_mesh_path) && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!visibleInstances['corrector_heads']}
                                onChange={() => handleVisibilityChange('corrector_heads')}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Analog Corrector Heads
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Corrector head per instance
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                        {job.summary.instances.map(inst => (
                          <Box
                            key={inst.index}
                            onMouseEnter={() => setHoveredInstance(inst.index)}
                            onMouseLeave={() => setHoveredInstance(null)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderRadius: 1,
                              px: 0.5,
                              transition: 'background-color 120ms',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            <FormControlLabel
                              sx={{ flex: 1, mr: 0 }}
                              control={
                                <Checkbox
                                  checked={!!visibleInstances[inst.index]}
                                  onChange={() => handleVisibilityChange(inst.index)}
                                  sx={{
                                    color: 'secondary.main',
                                    '&.Mui-checked': { color: 'secondary.main' },
                                  }}
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Instance #{inst.index}
                                  </Typography>
                                  {allVendors.length <= 1 && inst.vendor_name && (
                                    <Typography variant="caption" color="text.secondary">
                                      {inst.vendor_name}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            {/* Replace this instance's scan body with ANY registered
                                vendor's (display/export-only — the computation vendor,
                                analog, correctors, and angle results are untouched).
                                Value = the effective scan-body vendor (override or the
                                computation vendor). Sibling of the FormControlLabel (a
                                Select inside the checkbox label would toggle the
                                checkbox on click). */}
                            {allVendors.length > 1 && (
                              <FormControl size="small" sx={{ minWidth: 110, mr: 0.5 }}>
                                <Select
                                  value={inst.scan_body_vendor_id ?? inst.vendor_id ?? ''}
                                  displayEmpty
                                  inputProps={{ 'aria-label': `Scan body vendor for instance ${inst.index}` }}
                                  onChange={(e) => {
                                    const current = inst.scan_body_vendor_id ?? inst.vendor_id;
                                    if (e.target.value && e.target.value !== current) {
                                      handleSetInstanceVendor(inst.index, e.target.value);
                                    }
                                  }}
                                >
                                  {allVendors.map((v) => (
                                    <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                            <Tooltip title={`Delete instance #${inst.index}`}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteInstance(inst.index)}
                                  disabled={!!isDeleting}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        ))}
                      </FormGroup>
                    </Paper>

                    {/* Results Display */}
                    <ResultsDisplay
                      job={job}
                      onInstanceHover={setHoveredInstance}
                      onCalculateAngles={handleCalculateAngles}
                      isCalculatingAngles={isCalculatingAngles}
                      onPlaceAngleCorrectors={handlePlaceAngleCorrectors}
                      isPlacingCorrectors={isPlacingCorrectors}
                      seedPoint={seedPoint}
                      onSearchAroundPoint={handleSearchAroundPoint}
                      onClearSeed={handleClearSeed}
                      isSearching={isSearching}
                      searchFailureReason={searchFailureReason}
                      onRotateAnalog={handleRotateAnalog}
                      onAnalogDraftChange={handleAnalogDraftChange}
                      onSetInstanceVendor={handleSetInstanceVendor}
                      allVendors={allVendors}
                    />
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

export default PathfinderApp;
