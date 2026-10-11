// Ported from nipuntheekshana.com/src/scripts/island.ts @ 64482c5325ceace12c645d1ac5ca211cece46445.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  LineLoop,
  NormalBlending,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  ELEVATION_SCALE,
  LABELS,
  TOWNS,
  buildIsland,
  coastline,
  elevationAt,
  fromScene,
  graticule,
  toScene,
} from './island-model';

type Theme = 'dark' | 'light';

const PALETTES: Record<Theme, { base: string; cool: string; warm: string; hot: string; line: string; grid: string; opacity: number }> = {
  dark: { base: '#6c7f94', cool: '#8a9db2', warm: '#ffb454', hot: '#ffdcaa', line: '#ffb454', grid: '#ffffff', opacity: 1 },
  light: { base: '#8a8378', cool: '#4f5b66', warm: '#c4540a', hot: '#7a2d00', line: '#c4540a', grid: '#000000', opacity: 1 },
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3 uMouse;
  uniform float uMouseActive;
  uniform vec3 uPulse;
  uniform float uPulseStart;

  attribute vec4 aData;

  varying float vDensity;
  varying float vElevation;
  varying float vGlow;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float density = aData.x;
    float elevation = aData.y;
    float rnd = aData.z;
    float sweep = aData.w;

    // Intro: the island assembles from the south coast northwards.
    // At uIntro = 1 even the last point (sweep = 1, rnd = 1) has arrived.
    float t = clamp(uIntro * 1.9 - sweep * 0.6 - rnd * 0.3, 0.0, 1.0);
    float eased = 1.0 - pow(1.0 - t, 3.0);
    p.y = mix(-0.8 - rnd * 0.8, p.y, eased);

    // A slow breath, so the land never looks frozen.
    p.y += sin(uTime * 0.6 + rnd * 6.2831 + p.x * 2.0) * 0.006;

    // A ring of light travelling out from Colombo.
    float d = distance(p.xz, uPulse.xz);
    float phase = fract((uTime - uPulseStart) * 0.09);
    float wave = exp(-pow((d - phase * 5.0) * 5.0, 2.0)) * (1.0 - phase);
    p.y += wave * 0.05;

    // The ground lifts under the pointer.
    float md = distance(p.xz, uMouse.xz);
    float lift = smoothstep(0.6, 0.0, md) * uMouseActive;
    p.y += lift * 0.16 * (0.35 + rnd * 0.65);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.6 + density * 1.5 + elevation * 0.15 + lift * 0.6 + wave * 1.2);
    gl_PointSize = max(size * uPixelRatio / -mv.z, 1.6 * uPixelRatio);

    vDensity = density;
    vElevation = elevation;
    vGlow = wave * 0.9 + lift * 0.3;
    vAlpha = eased * (0.5 + rnd * 0.5);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform vec3 uHot;
  uniform float uOpacity;

  varying float vDensity;
  varying float vElevation;
  varying float vGlow;
  varying float vAlpha;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, r);

    vec3 color = mix(uBase, uCool, clamp(vElevation, 0.0, 0.8));
    color = mix(color, uWarm, smoothstep(0.06, 0.55, vDensity));
    color = mix(color, uHot, clamp(smoothstep(0.6, 1.0, vDensity) * 0.75 + vGlow * 0.5, 0.0, 1.0));

    float alpha = soft * vAlpha * uOpacity * (0.5 + vDensity * 0.6 + vGlow * 0.6);
    gl_FragColor = vec4(color, alpha);
  }
`;

import type { MapLayers, MapSurface, SurfaceOptions } from '../apps/maps/surface';

export type IslandHandle = MapSurface;
export type IslandOptions = SurfaceOptions;

export function mountIsland({ stage, island, labels, framing = 'centered', reducedMotion = false, onReady, onContextLost }: IslandOptions): IslandHandle {
  let reduced = reducedMotion;
  let active = true; let visible = true; let destroyed = false; let contextLost = false;
  let frame = 0; let width = 1; let height = 1; let elapsed = 0; let introElapsed = 0; let last = performance.now();
  let focused = false; let labelsWanted = true;
  let layers: MapLayers = { labels: true, graticule: true, coastline: true };
  let yaw = -0.12; let pitch = 0.72; let zoom = 1;
  let currentYaw = yaw; let currentPitch = pitch; let currentDistance = 7; let distance = 7;
  let drag: { id: number; x: number; y: number } | null = null;
  const touches = new Map<number, Vector2>(); let pinchDistance = 0;
  const target = new Vector3(0, 0, 0.05); const currentTarget = target.clone();
  const callbacks = new Set<() => void>();
  const cleanups: (() => void)[] = [];
  const renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
  const small = stage.clientWidth < 700;
  const pixelRatio = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio); renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.dataset.islandCanvas = '';
  stage.appendChild(renderer.domElement);
  const scene = new Scene(); const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  const data = buildIsland(island, 0.02);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setAttribute('aData', new BufferAttribute(data.attributes, 4));
  const [colomboX, colomboZ] = toScene(79.8612, 6.9271);
  const uniforms = {
    uTime: { value: 0 }, uIntro: { value: reduced ? 1 : 0 }, uPixelRatio: { value: pixelRatio }, uSize: { value: small ? 24 : 20 },
    uMouse: { value: new Vector3(99, 0, 99) }, uMouseActive: { value: 0 },
    uPulse: { value: new Vector3(colomboX, 0, colomboZ) }, uPulseStart: { value: 0 },
    uBase: { value: new Color() }, uCool: { value: new Color() }, uWarm: { value: new Color() }, uHot: { value: new Color() }, uOpacity: { value: 1 },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false });
  scene.add(new Points(geometry, material));
  const lineMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.3 });
  const coast = coastline(island).map(ring => {
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(ring, 3));
    const line = new LineLoop(geometry, lineMaterial); scene.add(line); return line;
  });
  const gridGeometry = new BufferGeometry(); gridGeometry.setAttribute('position', new BufferAttribute(graticule(), 3));
  const gridMaterial = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uOpacity: { value: 0.1 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: `uniform float uPixelRatio; varying float vFade;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = 3.0 * uPixelRatio / -mv.z; vFade = smoothstep(3.6, 1.2, length(position.xz)); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vFade;
      void main() { gl_FragColor = vec4(uColor, uOpacity * vFade); }`, transparent: true, depthWrite: false,
  });
  const grid = new Points(gridGeometry, gridMaterial); scene.add(grid);
  const beaconGeometry = new BufferGeometry(); const beaconBase = elevationAt(79.8612, 6.9271) * ELEVATION_SCALE;
  beaconGeometry.setAttribute('position', new BufferAttribute(new Float32Array([colomboX, beaconBase, colomboZ, colomboX, beaconBase + 0.75, colomboZ]), 3));
  const beaconMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.7 });
  scene.add(new Line(beaconGeometry, beaconMaterial));
  const anchors = TOWNS.filter(([name]) => LABELS.includes(name)).map(([name, lat, lon]) => {
    const el = document.createElement('span'); el.className = `island-label${name === 'Colombo' ? ' island-label--home' : ''}`;
    el.textContent = name; labels?.appendChild(el);
    const [x, z] = toScene(lon, lat);
    return { el, position: new Vector3(x, elevationAt(lon, lat) * ELEVATION_SCALE + (name === 'Colombo' ? 0.75 : 0.03), z) };
  });
  const pointer = new Vector2(); const raycaster = new Raycaster();
  const ground = new Plane(new Vector3(0, 1, 0), -0.08); const hit = new Vector3(); const projected = new Vector3();
  const canRender = () => !destroyed && active && visible && !document.hidden && !contextLost;
  function stop() { cancelAnimationFrame(frame); frame = 0; }
  function requestRender() { if (!frame && canRender()) { last = performance.now(); frame = requestAnimationFrame(loop); } }
  function layout() {
    const halfTan = Math.tan(camera.fov * Math.PI / 360) * 2;
    distance = Math.max(4.7 / halfTan, 3.1 / (halfTan * width / height)) / zoom;
    camera.setViewOffset(width, height, framing === 'wallpaper' ? -width * 0.13 : focused && width / height > 1.15 ? -width * 0.1 : 0, 0, width, height);
  }
  function updateCamera(snap = reduced) {
    const ease = snap ? 1 : 0.08;
    currentYaw += (yaw - currentYaw) * ease; currentPitch += (pitch - currentPitch) * ease;
    currentDistance += (distance - currentDistance) * ease; currentTarget.lerp(target, ease);
    const sway = reduced || focused ? 0 : Math.sin(elapsed * 0.15) * 0.05;
    camera.position.set(currentTarget.x + currentDistance * Math.sin(currentPitch) * Math.sin(currentYaw + sway),
      currentTarget.y + currentDistance * Math.cos(currentPitch), currentTarget.z + currentDistance * Math.sin(currentPitch) * Math.cos(currentYaw + sway));
    camera.lookAt(currentTarget); camera.updateMatrixWorld();
  }
  function toScreen(position: Vector3) {
    projected.copy(position).project(camera);
    return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height };
  }
  function render() {
    updateCamera();
    lineMaterial.opacity = 0.3 * uniforms.uIntro.value;
    coast.forEach(line => { line.visible = layers.coastline; }); grid.visible = layers.graticule;
    beaconMaterial.opacity = labelsWanted && layers.labels ? 0.7 : 0;
    renderer.render(scene, camera);
    if (uniforms.uIntro.value >= 1 && stage.dataset.intro !== 'complete') stage.dataset.intro = 'complete';
    if (labels) labels.hidden = !(labelsWanted && layers.labels);
    for (const { el, position } of anchors) {
      const { x, y } = toScreen(position); el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    stage.dataset.frames = String(Number(stage.dataset.frames ?? 0) + 1);
    callbacks.forEach(callback => callback());
  }
  function loop(now: number) {
    frame = 0; if (!canRender()) return;
    elapsed += Math.min(0.05, (now - last) / 1000); introElapsed += Math.min(1, (now - last) / 1000); last = now;
    uniforms.uTime.value = reduced ? 0 : elapsed; uniforms.uIntro.value = reduced ? 1 : Math.min(1, introElapsed / 2.6);
    render();
    if (!reduced) frame = requestAnimationFrame(loop);
  }
  function resize() {
    const rect = stage.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); camera.aspect = width / height; layout(); camera.updateProjectionMatrix(); requestRender();
  }
  function pick(clientX: number, clientY: number) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return null;
    const [lon, lat] = fromScene(hit.x, hit.z); return { lon, lat };
  }
  function orbit(dYaw: number, dPitch: number) {
    yaw = Math.max(-0.6, Math.min(0.6, yaw + dYaw)); pitch = Math.max(0.5, Math.min(1.2, pitch + dPitch)); requestRender();
  }
  function zoomBy(factor: number) { zoom = Math.max(0.7, Math.min(1.6, zoom * factor)); layout(); requestRender(); }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    touches.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchDistance = a!.distanceTo(b!); }
    else drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    if (touches.size === 2) {
      const [a, b] = [...touches.values()]; const next = a!.distanceTo(b!);
      if (pinchDistance > 0) zoomBy(next / pinchDistance); pinchDistance = next;
    } else if (drag?.id === event.pointerId && !focused) {
      orbit((event.clientX - drag.x) * 0.003, (event.clientY - drag.y) * 0.003);
      drag.x = event.clientX; drag.y = event.clientY;
    }
    if (!reduced && pick(event.clientX, event.clientY)) { uniforms.uMouse.value.copy(hit); uniforms.uMouseActive.value = 1; requestRender(); }
  }
  function pointerUp(event: PointerEvent) { touches.delete(event.pointerId); drag = null; pinchDistance = 0; }
  function pointerLeave() { uniforms.uMouseActive.value = 0; requestRender(); }
  function wheel(event: WheelEvent) { event.preventDefault(); zoomBy(Math.exp(-event.deltaY * 0.001)); }
  function listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(type, handler, options); cleanups.push(() => target.removeEventListener(type, handler, options));
  }
  if (framing !== 'wallpaper') {
    listen(stage, 'pointerdown', pointerDown as EventListener); listen(stage, 'pointermove', pointerMove as EventListener);
    listen(stage, 'pointerup', pointerUp as EventListener); listen(stage, 'pointercancel', pointerUp as EventListener);
    listen(stage, 'lostpointercapture', pointerUp as EventListener); listen(stage, 'pointerleave', pointerLeave);
    listen(stage, 'wheel', wheel as EventListener, { passive: false });
  }
  function applyTheme() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; const palette = PALETTES[theme];
    const accent = getComputedStyle(stage).getPropertyValue('--os-accent').trim() || palette.warm;
    uniforms.uBase.value.set(palette.base); uniforms.uCool.value.set(palette.cool); uniforms.uWarm.value.set(accent); uniforms.uHot.value.set(palette.hot);
    lineMaterial.color.set(accent); beaconMaterial.color.set(accent); gridMaterial.uniforms.uColor!.value.set(palette.grid);
    material.blending = theme === 'dark' ? AdditiveBlending : NormalBlending;
    uniforms.uOpacity.value = theme === 'dark' ? 1 : 1.35; material.needsUpdate = true; requestRender();
  }
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; if (canRender()) requestRender(); else stop(); });
  visibilityObserver.observe(stage);
  listen(document, 'visibilitychange', () => { if (canRender()) requestRender(); else stop(); });
  listen(renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); contextLost = true; stop(); onContextLost?.(); });
  resize(); updateCamera(true); applyTheme();
  // A usable complete frame precedes the poster fade, including reduced-motion loads.
  render(); onReady?.(); requestRender();
  return {
    kind: 'webgl', count: data.count, pick,
    project(lon, lat) { const [x, z] = toScene(lon, lat); return toScreen(new Vector3(x, elevationAt(lon, lat) * ELEVATION_SCALE + 0.02, z)); },
    pulseAt(lon, lat) { const [x, z] = toScene(lon, lat); uniforms.uPulse.value.set(x, 0, z); uniforms.uPulseStart.value = elapsed; requestRender(); },
    setLabels(value) { labelsWanted = value; requestRender(); },
    onFrame(callback) { callbacks.add(callback); return () => { callbacks.delete(callback); }; },
    setActive(value) { active = value; if (value) requestRender(); else stop(); },
    setFocus(value) { focused = value; layout(); requestRender(); },
    setLayers(value) { layers = value; requestRender(); },
    setReducedMotion(value) { reduced = value; if (value) { stop(); uniforms.uIntro.value = 1; uniforms.uMouseActive.value = 0; } requestRender(); },
    orbit, zoom: zoomBy,
    recentre() { yaw = -0.12; pitch = 0.72; zoom = 1; target.set(0, 0, 0.05); layout(); requestRender(); },
    flyTo(lon, lat) { const [x, z] = toScene(lon, lat); target.set(x * 0.45, 0, z * 0.45); zoom = 1.4; layout(); requestRender(); },
    destroy() {
      if (destroyed) return; destroyed = true; stop();
      cleanups.forEach(cleanup => cleanup()); resizeObserver.disconnect(); visibilityObserver.disconnect(); themeObserver.disconnect();
      anchors.forEach(({ el }) => el.remove()); callbacks.clear(); touches.clear();
      // Shared materials are disposed once; every geometry includes coast/grid/beacon.
      const geometries = new Set<BufferGeometry>(); const materials = new Set<ShaderMaterial | LineBasicMaterial>();
      scene.traverse(object => {
        if (object instanceof Points || object instanceof Line) {
          geometries.add(object.geometry);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach(value => materials.add(value as ShaderMaterial | LineBasicMaterial));
        }
      });
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); scene.clear();
      renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete stage.dataset.frames; delete stage.dataset.intro;
    },
  };
}
