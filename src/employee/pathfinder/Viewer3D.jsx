import { Suspense, useMemo, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { TrackballControls, Bounds, Center, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Box, Typography, CircularProgress, Stack, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ErrorBoundary } from './ErrorBoundary';
import { assetUrl, assetUrlWithVersion } from '../../Script/api';

// Color used to highlight a mesh on hover (sidebar row hover or anything else
// that sets `isHighlighted={true}`). Change this constant to swap the hover
// hue across the whole viewer.
//
// Alternatives — uncomment one if you prefer a different hover color:
const HOVER_COLOR = '#ffeb3b'; // bright yellow — warm, very visible
// const HOVER_COLOR = '#ffffff'; // pure white — maximum brightness, neutral
// const HOVER_COLOR = '#76ff03'; // lime green — loud, also works
// const HOVER_COLOR = '#00e5ff'; // bright cyan — contrasts pink instances and the light-blue scene

// Live-preview rotation for the analog. Returns the group
// `position` + `quaternion` that rotate geometry by `deltaDeg` around the bore
// axis through `start` with direction (start - end) — matching the backend's
// `T · R_z(θ)` (R_z about the asset's local +z, whose world image is
// normalize(start - end), right-hand rule). `delta = draftDeg - savedDeg`, so
// the already-baked STL (at savedDeg) is rotated to the in-progress draft with
// no reload.
//
// We decompose into position+quaternion (rather than a raw `matrix` with
// matrixAutoUpdate=false) so three.js composes & propagates matrixWorld on the
// default update path — a raw matrix copy does NOT flag matrixWorldNeedsUpdate,
// so it would only show up after some other forced update (e.g. the Save
// reload), which is exactly the "only rotates on Save" bug.
//
// Rotation about a point: M·v = R·v + (p0 - R·p0). So quaternion = R and
// position = p0 - R·p0. Returns identity when there's nothing to apply.
const IDENTITY_ROT = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] };

function buildAxisRotation(start, end, deltaDeg) {
  if (!start || !end || !Number.isFinite(deltaDeg) || Math.abs(deltaDeg) < 1e-6) return IDENTITY_ROT;
  const axis = new THREE.Vector3(start[0] - end[0], start[1] - end[1], start[2] - end[2]);
  if (axis.lengthSq() < 1e-9) return IDENTITY_ROT;
  axis.normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deltaDeg));
  const p0 = new THREE.Vector3(start[0], start[1], start[2]);
  const t = p0.clone().sub(p0.clone().applyQuaternion(q)); // p0 - R·p0
  return { position: [t.x, t.y, t.z], quaternion: [q.x, q.y, q.z, q.w] };
}

function Mesh({ url, color, isVisible, isHighlighted, opacity: customOpacity, onClick }) {
  // Pick the loader by extension, ignoring any query string (e.g. `?v=12.5`
  // cache-busters used when an STL gets rewritten on disk).
  const pathname = url.split('?')[0];
  const loader = pathname.endsWith('.stl') ? STLLoader : PLYLoader;
  const geometry = useLoader(loader, url);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: !pathname.endsWith('.stl'),
    color: isHighlighted ? HOVER_COLOR : color,
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: customOpacity !== undefined ? customOpacity : (isHighlighted ? 1.0 : 0.85),
    emissive: isHighlighted ? HOVER_COLOR : '#000000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  }), [color, isHighlighted, customOpacity, pathname]);

  return <mesh geometry={geometry} material={material} visible={isVisible} castShadow receiveShadow onClick={onClick} />;
}

function SeedPointMarker({ point }) {
  if (!point) return null;
  return (
    <mesh position={[point.x, point.y, point.z]}>
      <sphereGeometry args={[1.5, 24, 24]} />
      <meshStandardMaterial color="#ff5722" emissive="#ff5722" emissiveIntensity={0.8} />
    </mesh>
  );
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#2196F3" wireframe />
    </mesh>
  );
}

export default function Viewer3D({ job, visibleInstances, hoveredInstance, seedPoint, onSeedSelected, analogRotationDrafts = {} }) {
  // Artifact URLs arrive in two forms and must go through `assetUrl`, never
  // string concatenation: the composite and per-instance meshes are relative
  // proxy paths, but `scene` is an absolute signed URL because the compute
  // service fetches that exact URL too. Prefixing the absolute one produced
  // `https://api.example.comhttps//api.example.com/...` and killed the viewer.

  // Projection mode. Orthographic (parallel) avoids size-with-distance
  // distortion, which is preferable for judging alignment/parallelism;
  // perspective looks more naturally 3D. Switching remounts the Canvas (via
  // `key`) so <Bounds fit> reframes correctly for the new camera type.
  const [cameraMode, setCameraMode] = useState('perspective');
  const isOrtho = cameraMode === 'orthographic';

  // Render the user's original scan as the base mesh. Falling back to the
  // composite would also render the scene, but the composite has painted-blue
  // copies of every detected instance baked in, so they'd remain visible
  // even when all instance checkboxes are off.
  const baseScene = job?.artifacts?.scene
    ? assetUrl(job.artifacts.scene)
    : (job?.artifacts?.composite ? assetUrl(job.artifacts.composite) : null);

  if (!baseScene) {
    return (
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={60} thickness={4} />
          <Typography variant="body1" color="text.secondary">
            Preparing 3D viewer...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        position: 'relative',
      }}
    >
      {/* Viewer Label */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          px: 2,
          py: 1,
          borderRadius: 2,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'white' }}>
          3D Alignment Viewer
        </Typography>
      </Box>

      {/* Projection toggle */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          p: 0.5,
        }}
      >
        <ToggleButtonGroup
          value={cameraMode}
          exclusive
          size="small"
          onChange={(_e, v) => v && setCameraMode(v)}
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.25)',
              fontSize: '0.7rem',
              py: 0.25,
              px: 1,
              textTransform: 'none',
            },
            '& .Mui-selected': {
              color: 'white !important',
              bgcolor: 'rgba(33,150,243,0.5) !important',
            },
          }}
        >
          <ToggleButton value="perspective">Perspective</ToggleButton>
          <ToggleButton value="orthographic">Orthographic</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Viewer Controls Help */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 10,
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          px: 2,
          py: 1,
          borderRadius: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: 'white', fontSize: '0.7rem' }}>
          🖱️ Drag to rotate • Scroll to zoom • Right-click to pan
        </Typography>
      </Box>

      <ErrorBoundary>
        <Canvas
          key={cameraMode}
          orthographic={isOrtho}
          camera={isOrtho
            ? { position: [0, 0, 150], zoom: 5, near: 0.1, far: 5000 }
            : { position: [0, 0, 150], fov: 50 }}
          shadows
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}
        >
          {/* Enhanced Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4fc3f7" />
          <spotLight
            position={[0, 50, 0]}
            angle={0.3}
            penumbra={1}
            intensity={0.5}
            castShadow
            color="#ffffff"
          />

          <Suspense fallback={<Loader />}>
            <Bounds fit clip margin={1.2}>
              <Center>
                {/* Contact shadows for better depth perception */}
                <ContactShadows
                  opacity={0.3}
                  scale={100}
                  blur={2}
                  far={50}
                  resolution={256}
                  color="#000000"
                />

                {/* Base scene/denture mesh — also catches clicks for seed-point selection */}
                <Mesh
                  url={baseScene}
                  color="#90caf9"
                  isVisible={visibleInstances['scene']}
                  isHighlighted={false}
                  onClick={onSeedSelected ? (event) => {
                    event.stopPropagation();
                    // event.point is in world coords. The scene mesh is rendered
                    // inside <Center>, which adds a translation. Convert to the
                    // mesh's local frame so the coordinates match the original
                    // scene STL (and the backend's scene buffer).
                    const hitObject = event.intersections?.[0]?.object || event.object;
                    const local = hitObject.worldToLocal(event.point.clone());
                    onSeedSelected({ x: local.x, y: local.y, z: local.z });
                  } : undefined}
                />

                {/* Seed-point marker for user-guided "search around point" */}
                <SeedPointMarker point={seedPoint} />

                {/* Priority cascade: final-with-correctors > cube+analogs > individual analogs */}
                {job?.placeCorrectors?.final_with_correctors_path && visibleInstances['final_with_correctors'] ? (
                  <Mesh
                    key="final-with-correctors"
                    url={assetUrl(job.placeCorrectors.final_with_correctors_path)}
                    color="#ffffff"
                    isVisible={true}
                    isHighlighted={false}
                  />
                ) : job?.calculateAngles?.insertion_axis_cube_and_analogs_path && visibleInstances['cube_analogs'] ? (
                  <Mesh
                    key="cube-analogs"
                    // Cache-buster: this composite is regenerated whenever ANY
                    // per-instance analog rotation is saved. Sum the rotations so
                    // the URL changes on every save without reloading on
                    // unrelated state changes. (Scan-body swaps don't touch it.)
                    url={assetUrlWithVersion(job.calculateAngles.insertion_axis_cube_and_analogs_path, 
                      (job.summary?.instances || []).reduce((s, i) => s + Number(i.analog_z_rotation_deg || 0), 0)
                    )}
                    color="#81d4fa"
                    isVisible={true}
                    isHighlighted={false}
                    opacity={0.6}
                  />
                ) : job?.calculateAngles?.instance_results ? (
                  <>
                    {job.calculateAngles.instance_results.map((res) => {
                      const usePure = !!visibleInstances['use_pure_analog'];
                      // Cache-buster: BOTH analog STLs (pure + with scan body)
                      // are rewritten when the user saves a per-instance
                      // z-rotation — they share one clocking angle. Without this,
                      // useLoader caches by URL and the viewer keeps showing the
                      // old orientation. Keying by the saved rotation makes the
                      // URL change exactly when the file changes.
                      const summaryInst = job.summary?.instances?.find((i) => i.index === res.instance_index);
                      const savedDeg = Number(summaryInst?.analog_z_rotation_deg ?? 0);
                      // Default view = the detailed (with-scan-body) mesh; the
                      // "Use pure analog" toggle switches to the pure analog.
                      // (A scan-body swap does NOT rewrite these analog STLs, so
                      // the rotation angle alone keys the cache.)
                      const url = usePure
                        ? assetUrlWithVersion(res.mesh_path, savedDeg)
                        : assetUrlWithVersion(res.mesh_with_scan_body_path, savedDeg);
                      // Live preview: while the user drags the rotation slider,
                      // App holds the in-progress draft. Rotate the loaded STL
                      // (baked at savedDeg) by (draft - saved) around the bore
                      // axis so it tracks the slider with no reload / no backend
                      // call — applies to whichever analog variant is shown.
                      // Identity matrix when not dragging.
                      const draftDeg = analogRotationDrafts[res.instance_index];
                      const deltaDeg = typeof draftDeg === 'number' ? draftDeg - savedDeg : 0;
                      const { position, quaternion } = buildAxisRotation(res.axis_line_start, res.axis_line_end, deltaDeg);
                      // Optional dedicated rotation-visualization mesh. Independent
                      // layer (its own checkbox), shown in addition to the analog.
                      // Lives in the SAME group so it inherits the live-preview
                      // rotation; only mounted when the layer is on (avoids
                      // fetching the STL otherwise). Baked at savedDeg → same
                      // cache-buster as the analog.
                      const showRotvis = !!visibleInstances['rotation_visualization'] && res.mesh_rotation_vis_path;
                      return (
                        <group key={`analog-grp-${res.instance_index}`} position={position} quaternion={quaternion}>
                          <Mesh
                            key={`analog-${res.instance_index}`}
                            url={url}
                            color="#ff4081"
                            isVisible={visibleInstances[res.instance_index]}
                            isHighlighted={hoveredInstance === res.instance_index}
                          />
                          {showRotvis && (
                            <Mesh
                              key={`rotvis-${res.instance_index}`}
                              url={assetUrlWithVersion(res.mesh_rotation_vis_path, savedDeg)}
                              color="#ffd54f"
                              isVisible={visibleInstances[res.instance_index]}
                              isHighlighted={hoveredInstance === res.instance_index}
                            />
                          )}
                        </group>
                      );
                    })}
                    {job.calculateAngles.reference_plane_path && (
                      <Mesh
                        key="reference-plane"
                        url={assetUrl(job.calculateAngles.reference_plane_path)}
                        color="#4fc3f7"
                        isVisible={!!visibleInstances['reference_plane']}
                        isHighlighted={false}
                      />
                    )}
                    {job.calculateAngles.reference_plane_cube_path && (
                      <Mesh
                        key="reference-plane-cube"
                        url={assetUrl(job.calculateAngles.reference_plane_cube_path)}
                        color="#81d4fa"
                        isVisible={!!visibleInstances['reference_plane_cube']}
                        isHighlighted={false}
                      />
                    )}
                    {job.placeCorrectors?.instance_correctors?.map((c) => (
                      <Mesh
                        key={`corrector-${c.instance_index}`}
                        url={assetUrl(c.mesh_path)}
                        color="#66bb6a"
                        isVisible={!!visibleInstances['angle_correctors']}
                        isHighlighted={false}
                      />
                    ))}
                    {job.placeCorrectors?.instance_correctors?.map((c) => (
                      c.head_mesh_path ? (
                        <Mesh
                          key={`corrector-head-${c.instance_index}`}
                          url={assetUrl(c.head_mesh_path)}
                          color="#5c9ce6"
                          isVisible={!!visibleInstances['corrector_heads']}
                          isHighlighted={false}
                        />
                      ) : null
                    ))}
                  </>
                ) : (
                  job.summary.instances.map((inst, i) => (
                    <Mesh
                      key={inst.index}
                      // aligned_instance_NN.stl is rewritten in place on a
                      // scan-body swap — the effective scan-body vendor id
                      // busts the loader cache.
                      url={assetUrlWithVersion(job.artifacts.instances[i], inst.scan_body_vendor_id ?? inst.vendor_id ?? '')}
                      color="#ff4081"
                      isVisible={visibleInstances[inst.index]}
                      isHighlighted={hoveredInstance === inst.index}
                    />
                  ))
                )}
              </Center>
            </Bounds>
          </Suspense>

          <TrackballControls
            makeDefault
            rotateSpeed={1.0}
            zoomSpeed={1.5}
            panSpeed={0.5}
            staticMoving={true}
            // TrackballControls' orthographic zoom-out is gated by
            // `zoom < maxDistance²`; the default maxDistance=Infinity makes that
            // always true and cancels every zoom-out. Setting maxDistance=0 in
            // ortho mode disables the broken clamp so zoom-out works.
            maxDistance={isOrtho ? 0 : Infinity}
          />
        </Canvas>
      </ErrorBoundary>
    </Paper>
  );
}
