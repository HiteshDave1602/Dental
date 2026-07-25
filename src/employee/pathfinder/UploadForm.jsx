import { useState, useEffect } from 'react';
import {
  Button, Card, CardContent, Typography, Box, Alert, Stack, Chip,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Checkbox, ListItemText, OutlinedInput,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { listCompanyVendors, extractErrorMessage } from '../../Script/api';

export default function UploadForm({ onSubmit, isSubmitting }) {
  const [sceneFile, setSceneFile] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorsError, setVendorsError] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState({ scene: false });

  useEffect(() => {
    // Runs once on mount; initial state is already { loading: true, error: '' }
    // so no synchronous setState is needed here before the fetch resolves.
    // Presets are the admin library company names (GET /admin/brands) — the
    // same source the rest of the panel uses — not the pathfinder /api/vendors
    // endpoint. Adapt them to the {id, name} shape the selector + createJob
    // (vendorIds) expect.
    let cancelled = false;
    listCompanyVendors()
      .then((list) => {
        if (cancelled) return;
        setVendors(list);
        // Auto-select only when there's a single company (parity with the old
        // single-vendor default). With several, the user picks the ones present.
        if (list.length === 1) setSelectedVendorIds([list[0].id]);
      })
      .catch((e) => {
        if (cancelled) return;
        setVendorsError(extractErrorMessage(e, 'Failed to load company presets.'));
      })
      .finally(() => {
        if (!cancelled) setVendorsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sceneFile) {
      setError('Please upload your denture scan.');
      return;
    }
    if (!selectedVendorIds.length) {
      setError('Please select at least one company.');
      return;
    }
    setError('');
    onSubmit({ scene: sceneFile, vendorIds: selectedVendorIds });
  };

  const handleDrop = (e, setFile, type) => {
    e.preventDefault();
    setDragOver({ ...dragOver, [type]: false });
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(file);
  };

  const handleDragOver = (e, type) => {
    e.preventDefault();
    setDragOver({ ...dragOver, [type]: true });
  };

  const handleDragLeave = (type) => {
    setDragOver({ ...dragOver, [type]: false });
  };

  const FileInput = ({ label, subtitle, file, setFile, type }) => (
    <Box
      onDrop={(e) => handleDrop(e, setFile, type)}
      onDragOver={(e) => handleDragOver(e, type)}
      onDragLeave={() => handleDragLeave(type)}
      sx={{
        border: file ? '2px solid' : '2px dashed',
        borderColor: file ? 'primary.main' : dragOver[type] ? 'primary.light' : 'grey.600',
        bgcolor: dragOver[type] ? 'action.hover' : file ? 'primary.dark' : 'background.paper',
        padding: { xs: 2, sm: 3 },
        borderRadius: 3,
        textAlign: 'center',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: file ? 'primary.dark' : 'action.hover',
          transform: 'translateY(-2px)',
          boxShadow: 3,
        }
      }}
    >
      {file && (
        <CheckCircleIcon
          sx={{
            position: 'absolute',
            top: { xs: 8, sm: 12 },
            right: { xs: 8, sm: 12 },
            color: 'success.main',
            fontSize: { xs: 24, sm: 28 }
          }}
        />
      )}
      <Stack spacing={{ xs: 1, sm: 1.5 }} alignItems="center">
        <Box
          sx={{
            width: { xs: 56, sm: 64 },
            height: { xs: 56, sm: 64 },
            borderRadius: '50%',
            bgcolor: file ? 'primary.main' : 'action.selected',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
        >
          {file ? (
            <InsertDriveFileIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: 'white' }} />
          ) : (
            <CloudUploadIcon sx={{ fontSize: { xs: 28, sm: 32 }, color: 'text.secondary' }} />
          )}
        </Box>
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 0.5, fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
            {subtitle}
          </Typography>
        </Box>
        {file ? (
          <Chip
            label={file.name}
            color="primary"
            variant="outlined"
            sx={{ maxWidth: '100%', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.8125rem' } }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Drag & drop or click to browse
          </Typography>
        )}
        <Button
          component="label"
          variant={file ? 'outlined' : 'contained'}
          size="small"
          startIcon={<CloudUploadIcon />}
          sx={{ mt: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
        >
          {file ? 'Change File' : 'Browse Files'}
          <input
            type="file"
            hidden
            accept=".stl,.ply,.obj"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Button>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
          Supported formats: STL, PLY, OBJ
        </Typography>
      </Stack>
    </Box>
  );

  const VendorSelector = () => (
    <Box
      sx={{
        border: '2px solid',
        borderColor: selectedVendorIds.length ? 'primary.main' : 'grey.600',
        bgcolor: selectedVendorIds.length ? 'primary.dark' : 'background.paper',
        padding: { xs: 2, sm: 3 },
        borderRadius: 3,
        textAlign: 'center',
        transition: 'all 0.3s ease',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack spacing={{ xs: 1.5, sm: 2 }} alignItems="center" sx={{ width: '100%' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Company Presets
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
          Select every implant company present in the scan. Each detected implant
          is matched to its best-fitting company.
        </Typography>

        {vendorsLoading ? (
          <CircularProgress size={32} />
        ) : vendorsError ? (
          <Alert severity="error" sx={{ width: '100%' }}>
            Could not load company presets. Refresh the page to retry.
          </Alert>
        ) : vendors.length === 0 ? (
          <Alert severity="warning" sx={{ width: '100%' }}>
            No companies are configured.
          </Alert>
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel id="vendor-select-label">Companies</InputLabel>
            <Select
              labelId="vendor-select-label"
              multiple
              value={selectedVendorIds}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedVendorIds(typeof v === 'string' ? v.split(',') : v);
              }}
              input={<OutlinedInput label="Companies" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((id) => {
                    const v = vendors.find((x) => x.id === id);
                    return <Chip key={id} size="small" label={v ? v.name : id} />;
                  })}
                </Box>
              )}
            >
              {vendors.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  <Checkbox checked={selectedVendorIds.indexOf(v.id) > -1} />
                  <ListItemText primary={v.name} secondary={v.description || null} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
    </Box>
  );

  const submitDisabled =
    isSubmitting ||
    !sceneFile ||
    vendorsLoading ||
    !!vendorsError ||
    vendors.length === 0 ||
    !selectedVendorIds.length;

  return (
    <Card
      elevation={0}
      sx={{
        background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(156, 39, 176, 0.05) 100%)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 4 } }}>
        <Stack spacing={{ xs: 2.5, sm: 3 }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 1, sm: 2 } }}>
            <Typography variant="h4" component="div" gutterBottom sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}>
              Upload Your Dental Mesh
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 2, sm: 0 } }}>
              Upload your denture scan and pick the matching vendor preset to find precise alignment matches
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2.5, sm: 3 },
                mb: 2,
                alignItems: 'stretch',
              }}
            >
              <Box sx={{ flex: 1 }}>
                {/* Called as a render helper (not <FileInput/>) so it doesn't
                    remount each render and drop the file input's state/focus. */}
                {FileInput({
                  label: 'Denture Scan',
                  subtitle: 'Your primary dental scan',
                  file: sceneFile,
                  setFile: setSceneFile,
                  type: 'scene',
                })}
              </Box>
              <Box sx={{ flex: 1 }}>
                {VendorSelector()}
              </Box>
            </Box>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitDisabled}
              fullWidth
              startIcon={<AutoFixHighIcon />}
              sx={{
                py: { xs: 1.2, sm: 1.5 },
                fontSize: { xs: '0.95rem', sm: '1.1rem' },
                fontWeight: 600,
                borderRadius: 2,
                background: 'linear-gradient(45deg, #2196F3 30%, #9C27B0 90%)',
                boxShadow: '0 3px 10px rgba(33, 150, 243, 0.3)',
                '&:hover': {
                  boxShadow: '0 5px 15px rgba(33, 150, 243, 0.4)',
                },
                '&:disabled': {
                  background: 'grey.700',
                }
              }}
            >
              {isSubmitting ? 'Processing...' : 'Start Alignment Analysis'}
            </Button>
          </form>
        </Stack>
      </CardContent>
    </Card>
  );
}
