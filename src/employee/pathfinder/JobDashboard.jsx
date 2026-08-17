import { useMemo } from 'react';
import { Box, Card, CardContent, Stack, Typography, Fade } from '@mui/material';
import { keyframes } from '@mui/system';

const orbit = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
const orbitReverse = keyframes`from { transform: rotate(360deg); } to { transform: rotate(0deg); }`;
const scan = keyframes`0%, 100% { transform: translateY(-42px); opacity: 0; } 12%, 88% { opacity: 1; } 50% { transform: translateY(42px); opacity: 1; }`;
const breathe = keyframes`0%, 100% { transform: scale(0.94); opacity: 0.35; } 50% { transform: scale(1.06); opacity: 0.8; }`;
const shimmer = keyframes`0% { transform: translateX(-110%); } 100% { transform: translateX(220%); }`;

const stages = ['Preparing scan', 'Reading geometry', 'Aligning surfaces', 'Final review'];

export default function JobDashboard({ events }) {
  const safeEvents = Array.isArray(events) ? events : [];
  const doneEvent = useMemo(() => safeEvents.find((event) => event.type === 'done'), [safeEvents]);
  const progress = Math.min(safeEvents.filter((event) => event.type === 'status').length, stages.length);
  const activeStage = Math.max(0, progress - 1);

  const getStatusMessage = () => {
    if (progress >= 4) return 'Completing your case review';
    if (progress >= 3) return 'Refining the surface alignment';
    if (progress >= 2) return 'Reading scan geometry';
    if (progress >= 1) return 'Processing your scan data';
    return 'Preparing your digital scan';
  };

  if (doneEvent?.status === 'completed') return null;

  return (
    <Fade in timeout={450}>
      <Card elevation={0} sx={{ position: 'relative', overflow: 'hidden', borderRadius: { xs: 3, sm: 4 }, color: '#F6FBFE', background: 'linear-gradient(120deg, #071433 0%, #0A2472 52%, #0C1C4D 100%)', border: '1px solid rgba(156, 213, 255, 0.28)', boxShadow: '0 18px 42px rgba(7, 42, 114, 0.26)', '&::before': { content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 12% 22%, rgba(106, 176, 227, 0.24), transparent 30%), radial-gradient(circle at 85% 85%, rgba(7, 42, 200, 0.42), transparent 34%)' } }}>
        <CardContent sx={{ position: 'relative', p: { xs: 3, sm: 5 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Box aria-hidden="true" sx={{ position: 'relative', width: { xs: 172, sm: 204 }, height: { xs: 172, sm: 204 }, flexShrink: 0 }}>
              <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(156, 213, 255, 0.3)', animation: `${breathe} 3s ease-in-out infinite` }} />
              <Box sx={{ position: 'absolute', inset: 12, borderRadius: '50%', border: '1px dashed rgba(156, 213, 255, 0.54)', animation: `${orbit} 16s linear infinite` }}><Box sx={{ position: 'absolute', top: -4, left: '50%', width: 8, height: 8, borderRadius: '50%', bgcolor: '#9CD5FF', boxShadow: '0 0 16px #9CD5FF', transform: 'translateX(-50%)' }} /></Box>
              <Box sx={{ position: 'absolute', inset: 27, borderRadius: '50%', border: '1px solid rgba(106, 176, 227, 0.46)', animation: `${orbitReverse} 10s linear infinite` }} />
              <Box sx={{ position: 'absolute', inset: 43, overflow: 'hidden', borderRadius: '50%', background: 'radial-gradient(circle at 35% 28%, #2079d1, #072AC8 58%, #07194f)', border: '6px solid rgba(246, 251, 254, 0.92)', boxShadow: 'inset 0 0 28px rgba(156, 213, 255, 0.5), 0 0 0 6px rgba(156, 213, 255, 0.1), 0 12px 30px rgba(0, 0, 0, 0.35)' }}>
                <Typography component="span" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: { xs: '3.1rem', sm: '3.7rem' }, filter: 'drop-shadow(0 5px 7px rgba(0,0,0,.3))' }}>&#129463;</Typography>
                <Box sx={{ position: 'absolute', left: 0, right: 0, height: 2, bgcolor: '#C1E5FF', boxShadow: '0 0 15px 4px rgba(156, 213, 255, 0.7)', animation: `${scan} 2.6s ease-in-out infinite` }} />
              </Box>
            </Box>
            <Box sx={{ width: '100%', maxWidth: 590, textAlign: { xs: 'center', md: 'left' } }}>
              <Typography sx={{ color: '#9CD5FF', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Case analysis in progress</Typography>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 800, letterSpacing: '-0.035em', fontSize: { xs: '1.7rem', sm: '2.15rem' } }}>{getStatusMessage()}</Typography>
              <Typography sx={{ mt: 1.25, color: 'rgba(246, 251, 254, 0.72)', fontSize: { xs: '0.9rem', sm: '1rem' } }}>We’re building a precise 3D view of your patient’s scan. This usually takes just a few moments.</Typography>
              <Box sx={{ mt: 4, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(1, 13, 42, 0.38)', border: '1px solid rgba(156, 213, 255, 0.18)' }}><Box sx={{ height: 7, width: `${Math.max(12, (progress / stages.length) * 100)}%`, borderRadius: 'inherit', position: 'relative', overflow: 'hidden', background: 'linear-gradient(90deg, #159FE8, #9CD5FF)' }}><Box sx={{ position: 'absolute', inset: 0, width: '38%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent)', animation: `${shimmer} 1.8s linear infinite` }} /></Box></Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.25, justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap' }}>
                {stages.map((stage, index) => {
                  const isComplete = progress > index;
                  const isActive = index === activeStage;
                  return <Stack key={stage} direction="row" spacing={0.8} alignItems="center" sx={{ color: isComplete || isActive ? '#F6FBFE' : 'rgba(246, 251, 254, 0.45)' }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isComplete ? '#9CD5FF' : 'rgba(156, 213, 255, 0.28)', boxShadow: isActive ? '0 0 0 5px rgba(156,213,255,.12), 0 0 12px #9CD5FF' : 'none' }} /><Typography sx={{ fontSize: '0.75rem', fontWeight: isActive ? 700 : 500 }}>{stage}</Typography></Stack>;
                })}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  );
}
