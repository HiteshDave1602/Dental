import { Alert, Box, Stack, Typography } from '@mui/material';

// Instances the engine wants a person to check before relying on them
// (summary.instances[].warnings: [{code, message}]). The engine's message is
// the explanation, so it is shown as-is. Hovering an entry previews that
// instance in the 3D viewer. Renders nothing when no instance is flagged.
function InstanceWarnings({ instances = [], onPreviewInstance }) {
  const flagged = instances.filter((i) => i.warnings?.length);
  if (flagged.length === 0) return null;

  return (
    <Alert severity="warning" sx={{ borderRadius: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {flagged.length === 1 ? '1 instance needs checking' : `${flagged.length} instances need checking`}
      </Typography>
      <Stack spacing={1}>
        {flagged.map((inst) => (
          <Box
            key={inst.index}
            onMouseEnter={() => onPreviewInstance?.(inst.index)}
            onMouseLeave={() => onPreviewInstance?.(null)}
            sx={{ cursor: 'default' }}
          >
            {inst.warnings.map((w, k) => (
              <Typography key={w.code ?? k} variant="body2">
                <strong>Instance #{inst.index}:</strong> {w.message}
              </Typography>
            ))}
          </Box>
        ))}
      </Stack>
    </Alert>
  );
}

export default InstanceWarnings;
