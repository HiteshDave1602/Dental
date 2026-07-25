import { useState, useCallback, useEffect } from 'react';
import {
  createJob, getJob, calculateAngles, placeAngleCorrectors, searchAroundPoint,
  deleteInstance, rotateAnalog, setInstanceVendor, listCompanyVendors,
  extractErrorMessage,
} from '../../Script/api';
import { useJobWebSocket } from './useJobWebSocket';
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
  Button,
  IconButton, Tooltip,
  FormControl, Select, MenuItem,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import UploadForm from './UploadForm';
import JobDashboard from './JobDashboard';
import ResultsDisplay from './ResultsDisplay';
import Viewer3D from './Viewer3D';
import HeroSection from './HeroSection';
import LoadingScreen from './LoadingScreen';
import theme from './theme';

// Ported from the standalone pathfinder app's App.jsx. Top-level state for the
// scan-body alignment workflow: job lifecycle, visibility toggles, mutation
// handlers, results invalidation rules. Wrapped in a scoped MUI ThemeProvider
// so it themes correctly when embedded in the (Tailwind) employee panel.
function PathfinderApp() {
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [wsEvents, setWsEvents] = useState([]);
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

  // Full registry of vendors ([{id, name, description}]) — NOT job-scoped. An
  // instance's scan body can be reassigned to ANY registered vendor, so the
  // per-instance vendor dropdowns list all of them. Falls back to [] on fetch
  // error, which hides the dropdowns (read-only vendor captions remain).
  const [allVendors, setAllVendors] = useState([]);
  useEffect(() => {
    let cancelled = false;
    listCompanyVendors()
      .then((v) => { if (!cancelled) setAllVendors(v); })
      .catch(() => { if (!cancelled) setAllVendors([]); });
    return () => { cancelled = true; };
  }, []);

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

  // Callback for WebSocket to update state
  const handleWsMessage = useCallback((data) => {
    setWsEvents(prev => [...prev, data]);
    if (data.type === 'done') {
      getJob(jobId).then(setJob);
    }
  }, [jobId]);

  useJobWebSocket(jobId, handleWsMessage);

  const handleSubmit = async ({ scene, vendorIds }) => {
    setIsSubmitting(true);
    setError(null);
    setJob(null);
    setJobId(null);
    setWsEvents([]); // Reset events on new submission
    setVisibleInstances({ scene: true });
    setAnalogRotationDrafts({});

    try {
      const res = await createJob(scene, vendorIds);
      setJobId(res.job_id);
    } catch (err) {
      // extractErrorMessage, not err.message: axios rejects with a generic
      // "Request failed with status code 400", which hides the backend's
      // actual explanation (e.g. which library needs an alignment vendor).
      setError(extractErrorMessage(err, 'Failed to create job'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVisibilityChange = (key) => {
    setVisibleInstances(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setJobId(null);
    setJob(null);
    setWsEvents([]);
    setVisibleInstances({ scene: true });
    setHoveredInstance(null);
    setError(null);
    setIsCalculatingAngles(false);
    setIsPlacingCorrectors(false);
    setSeedPoint(null);
    setIsSearching(false);
    setSearchFailureReason(null);
    setIsDeleting(false);
  };

  const handleCalculateAngles = useCallback(async () => {
    if (!jobId || !job || job.status !== 'completed') return;
    if (job.calculateAngles || isCalculatingAngles) return;
    setError(null);
    let cancelled = false;
    try {
      setIsCalculatingAngles(true);
      const result = await calculateAngles(jobId);
      if (cancelled) return;
      setJob(prev => (prev ? { ...prev, calculateAngles: result } : prev));
    } catch (e) {
      if (!cancelled) setError(extractErrorMessage(e, 'Failed to calculate insertion angles'));
    } finally {
      if (!cancelled) setIsCalculatingAngles(false);
    }
    return () => {
      cancelled = true;
    };
  }, [jobId, job, isCalculatingAngles]);

  const handlePlaceAngleCorrectors = useCallback(async () => {
    if (!jobId || !job || job.status !== 'completed') return;
    if (!job.calculateAngles?.instance_results) return;
    if (job.placeCorrectors || isPlacingCorrectors) return;
    setError(null);
    let cancelled = false;
    try {
      setIsPlacingCorrectors(true);
      const result = await placeAngleCorrectors(jobId);
      if (cancelled) return;
      setJob(prev => (prev ? { ...prev, placeCorrectors: result } : prev));
    } catch (e) {
      if (!cancelled) setError(extractErrorMessage(e, 'Failed to place angle correctors'));
    } finally {
      if (!cancelled) setIsPlacingCorrectors(false);
    }
    return () => {
      cancelled = true;
    };
  }, [jobId, job, isPlacingCorrectors]);

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
    const updated = await getJob(jobId);
    setJob({
      ...updated,
      calculateAngles: null,
      placeCorrectors: null,
    });
  }, [jobId]);

  const handleSearchAroundPoint = useCallback(async (vendorId = null) => {
    if (!seedPoint || !jobId || isSearching) return;
    setError(null);
    setSearchFailureReason(null);
    setIsSearching(true);
    try {
      const result = await searchAroundPoint(jobId, seedPoint.x, seedPoint.y, seedPoint.z, null, vendorId);
      if (result.accepted) {
        await refreshJobAfterMutation();
        // Auto-make the new instance visible
        if (result.instance?.index) {
          setVisibleInstances(prev => ({ ...prev, [result.instance.index]: true }));
        }
        setSeedPoint(null);
      } else {
        setSearchFailureReason(result.reason || 'No instance found at that location.');
      }
    } catch (e) {
      setError(extractErrorMessage(e, 'Targeted search failed'));
    } finally {
      setIsSearching(false);
    }
  }, [seedPoint, jobId, isSearching, refreshJobAfterMutation]);

  const handleDeleteInstance = useCallback(async (instanceIndex) => {
    if (!jobId || isDeleting) return;
    if (!window.confirm(`Delete instance #${instanceIndex}? Any angle calculations will be invalidated.`)) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteInstance(jobId, instanceIndex);
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
  }, [jobId, isDeleting, refreshJobAfterMutation]);

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
    if (!jobId) return;
    setError(null);
    try {
      await setInstanceVendor(jobId, instanceIndex, vendorId);
      const updated = await getJob(jobId);
      setJob((prev) => ({
        ...updated,
        calculateAngles: prev?.calculateAngles ?? null,
        placeCorrectors: prev?.placeCorrectors ?? null,
      }));
    } catch (e) {
      setError(extractErrorMessage(e, 'Scan-body replacement failed'));
    }
  }, [jobId]);

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
    if (!jobId) throw new Error('No active job');
    const result = await rotateAnalog(jobId, instanceIndex, angleDeg);
    setJob((prev) => {
      if (!prev?.summary?.instances) return prev;
      const updatedInstances = prev.summary.instances.map((i) =>
        i.index === instanceIndex ? { ...i, analog_z_rotation_deg: result.angle_deg } : i
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
    return result;
  }, [jobId]);

  return (
    <ThemeProvider theme={theme}>
      {/* Full-screen loading overlay */}
      {isSubmitting && <LoadingScreen />}

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
          {/* Hero Section - shown only when no job is running */}
          {!jobId && <HeroSection />}

          {/* Upload Section */}
          {!jobId && (
            <Fade in timeout={500}>
              <Box>
                <UploadForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
              </Box>
            </Fade>
          )}

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

          {/* Processing Dashboard */}
          {jobId && !job && <JobDashboard events={wsEvents} />}

          {/* Results Section */}
          {job?.status === 'completed' && job.summary && (
            <Fade in timeout={800}>
              <Box>
                {/* Reset Button */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={handleReset}
                    sx={{
                      borderRadius: 2,
                      fontSize: { xs: '0.8rem', sm: '0.875rem' },
                      px: { xs: 2, sm: 3 },
                    }}
                  >
                    Start New Analysis
                  </Button>
                </Box>

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
