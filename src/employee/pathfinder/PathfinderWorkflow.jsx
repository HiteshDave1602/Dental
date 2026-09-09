import { useState, useCallback, useEffect, useRef } from 'react';
import {
  default as api,
  getAlignmentState, searchAroundPoint,
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
  Button, Card, CardContent, CircularProgress, Alert,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import JobDashboard from './JobDashboard';
import Viewer3D from './Viewer3D';
import theme from './theme';

const READY_STATUSES = new Set(['completed', 'awaiting_review']);
const FAILED_STATUSES = new Set(['failed', 'error']);

// The job-level `status` and the engine's own `engine_status` aren't always in
// sync — a real /viewer response was seen with status: "aligning" while
// engine_status was already "awaiting_review", which left the poll below
// spinning forever even though the engine had finished. engine_status is
// already treated as authoritative for busy/idle elsewhere (the search-around-
// point poll checks `engine_status !== 'searching'`), so check both fields
// here too rather than trusting `status` alone.
const isJobReady = (state) => READY_STATUSES.has(state?.status) || READY_STATUSES.has(state?.engine_status);
const isJobFailed = (state) => FAILED_STATUSES.has(state?.status) || FAILED_STATUSES.has(state?.engine_status);

// Step 4 of the wizard — the ALIGNMENT REVIEW.
//
// The scan has already been uploaded and its alignment job submitted (Step 2),
// and the implant system(s) selected (Step 3). This step is the "detection
// review": confirm the engine found every implant, delete false positives, add
// any it missed via seed-point search, and swap scan bodies if desired. Once
// the detection set is confirmed, the user moves on to Step 5 (Angle Calculation),
// which computes angles for the selected teeth.
function PathfinderApp({ caseId, scanFile, onComplete, requestGo = 0 }) {
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seedPoint, setSeedPoint] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailureReason, setSearchFailureReason] = useState(null);
  const scanUploadRetriedRef = useRef(false);

  const [visibleInstances, setVisibleInstances] = useState({ scene: true });
  const [hoveredInstance] = useState(null);

  const loadState = useCallback(async () => {
    if (!caseId) return null;
    let state = await getAlignmentState(caseId);
    if (!state?.job_id && scanFile && !scanUploadRetriedRef.current) {
      scanUploadRetriedRef.current = true;
      await api.employee.cases.uploadScan(caseId, scanFile);
      await api.employee.cases.updateStep(caseId, 3);
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

  const [searchVendorId, setSearchVendorId] = useState('');

  // The shared top navigation bar's Continue button lands here: advance to the
  // Angle Calculation step, but only once the alignment job is ready for review.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (requestGo && isJobReady(job)) onComplete?.();
  }, [requestGo, job]);

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          bgcolor: '#F0F9FF',
          border: '1px solid',
          borderColor: '#C1E5FF',
          borderRadius: 3,
          py: { xs: 3, sm: 4 },
          overflow: 'hidden',
        }}
      >
      <Container maxWidth="xl">
        <Stack spacing={{ xs: 3, sm: 4 }}>
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

          {(isLoading || (job?.job_id && !isJobReady(job) && !isJobFailed(job))) && (
            <JobDashboard events={[{ type: 'status', stage: 'processing', message: 'Detecting implants in the scan' }]} />
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
                No alignment job yet for this case. Upload a scan to start alignment.
              </Typography>
            </Paper>
          )}

          {/* Results Section */}
          {isJobReady(job) && job.summary && (
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
                      seedPoint={seedPoint}
                      onSeedSelected={handleSeedSelected}
                      analogRotationDrafts={{}}
                    />
                  </Box>

                  {/* Sidebar */}
                  {/* flexShrink: 0 — a scrolling flex column still shrinks its
                      children by default, and Card's overflow: hidden then clips
                      the search button out of view. */}
                  <Stack spacing={{ xs: 2, sm: 3 }} sx={{ overflowY: 'auto', maxHeight: { xs: '500px', sm: '600px', md: '700px' }, pr: { xs: 0, sm: 1 }, '& > *': { flexShrink: 0 } }}>

                    {/* Search for a missed instance */}
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

                          <Stack direction="column" spacing={1}>
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
                              <Button
                                onClick={handleClearSeed}
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
                            <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>{searchFailureReason}</Alert>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Visibility Controls + per-instance rows */}
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
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>Denture Scan</Typography>
                              <Typography variant="caption" color="text.secondary">Primary dental mesh</Typography>
                            </Box>
                          }
                        />
                        {/* {job.summary.instances.map(inst => (
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
                        ))} */}
                      </FormGroup>
                    </Paper>
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
