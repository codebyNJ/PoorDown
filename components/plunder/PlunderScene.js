import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Sky } from '@react-three/drei';
import * as THREE from 'three';
import {
  ARENA_RADIUS, SHIP_MAX_SPEED, SHIP_ACCEL, SHIP_TURN_RATE, SHIP_RADIUS,
  CANNON_BALL_SPEED, CANNON_RANGE, DEFAULT_CANNON_COOLDOWN_MS,
  TRIPLE_FAN_ANGLE, MORTAR_FLIGHT_MS, MORTAR_RANGE,
  BOOST_DURATION_MS, BOOST_MULT, SHIELD_DURATION_MS,
  CRATE_PICKUP_RADIUS, PUBLISH_HZ, WEAPONS,
} from '../../lib/games/plunder/constants';

const GLB = (name) => `/kenney_pirate-kit/Models/GLB%20format/${name}.glb`;

// ── Shared cloned GLB ────────────────────────────────────────────────────────
function useGLBClone(name) {
  const { scene } = useGLTF(GLB(name));
  return useMemo(() => {
    const root = scene.clone(true);
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) obj.material = obj.material.clone();
      }
    });
    return root;
  }, [scene]);
}

// ── Ship body ────────────────────────────────────────────────────────────────
function ShipBody({ model, color, dead, shielded }) {
  const root = useGLBClone(model);
  if (dead) return null;
  return (
    <group>
      <primitive object={root} />
      <mesh position={[0, 1.8, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {shielded && (
        <mesh>
          <sphereGeometry args={[2.6, 24, 16]} />
          <meshStandardMaterial
            color="#0A84FF"
            emissive="#0A84FF"
            emissiveIntensity={0.6}
            transparent
            opacity={0.32}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Floating name + lives label ──────────────────────────────────────────────
function FloatingLabel({ text, color, sublabel }) {
  const ref = useRef();
  const { camera } = useThree();
  useFrame(() => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });

  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 80;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(13,13,26,0.88)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8, c.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Inter, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 18, 8);
    if (sublabel) {
      ctx.fillStyle = '#FFD60A';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText(sublabel, 18, 44);
    }
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }, [text, color, sublabel]);

  return (
    <mesh ref={ref} position={[0, 3.4, 0]}>
      <planeGeometry args={[3.6, 0.9]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} />
    </mesh>
  );
}

// ── Peer ship — interpolate to authoritative position ───────────────────────
function PeerShip({ ship }) {
  const ref = useRef();
  const target = useRef({ x: ship.x, z: ship.z, heading: ship.heading });

  useEffect(() => {
    target.current = { x: ship.x, z: ship.z, heading: ship.heading };
  }, [ship.x, ship.z, ship.heading]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const lerp = Math.min(1, delta * 9);
    g.position.x += (target.current.x - g.position.x) * lerp;
    g.position.z += (target.current.z - g.position.z) * lerp;
    g.position.y = Math.sin(performance.now() / 600 + ship.x) * 0.08;
    let dh = target.current.heading - g.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    g.rotation.y += dh * lerp;
  });

  if (!ship.alive) return null;
  const livesText = '♥'.repeat(Math.max(0, ship.lives || 0));
  return (
    <group ref={ref} position={[ship.x, 0, ship.z]} rotation={[0, ship.heading, 0]}>
      <ShipBody model={ship.model} color={ship.color} shielded={ship.shieldUntil > Date.now()} />
      <FloatingLabel text={ship.name} color={ship.color} sublabel={livesText} />
    </group>
  );
}

// ── Local ship: WASD drive, Space fire, simple radial collision ─────────────
function LocalShip({
  myShip, allShips, crates, mines,
  onPublishShip, onFire, onPickupCrate, onPickupMine, onArenaClamp,
}) {
  const ref = useRef();
  const state = useRef({
    x: myShip.x, z: myShip.z, heading: myShip.heading, throttle: 0,
  });
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false });
  const lastSent = useRef(0);
  const lastFire = useRef(0);
  const { camera } = useThree();

  // Sync local state to authoritative state on respawn or major drift
  useEffect(() => {
    const drift = Math.hypot(myShip.x - state.current.x, myShip.z - state.current.z);
    if (!myShip.alive || drift > 8) {
      state.current.x = myShip.x;
      state.current.z = myShip.z;
      state.current.heading = myShip.heading;
      state.current.throttle = 0;
    }
  }, [myShip.alive, myShip.respawnAt, myShip.x, myShip.z, myShip.heading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.current.w = true;
      else if (k === 's' || k === 'arrowdown') keys.current.s = true;
      else if (k === 'a' || k === 'arrowleft') keys.current.a = true;
      else if (k === 'd' || k === 'arrowright') keys.current.d = true;
      else if (k === ' ') { keys.current.space = true; e.preventDefault(); }
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.current.w = false;
      else if (k === 's' || k === 'arrowdown') keys.current.s = false;
      else if (k === 'a' || k === 'arrowleft') keys.current.a = false;
      else if (k === 'd' || k === 'arrowright') keys.current.d = false;
      else if (k === ' ') keys.current.space = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    const s = state.current;
    const now = performance.now();

    if (!myShip.alive) {
      // Looking down at last position from above while dead
      camera.position.x += (myShip.x - camera.position.x) * Math.min(1, delta * 2);
      camera.position.z += (myShip.z + 12 - camera.position.z) * Math.min(1, delta * 2);
      camera.position.y += (28 - camera.position.y) * Math.min(1, delta * 2);
      camera.lookAt(myShip.x, 0.5, myShip.z);
      return;
    }

    const boosted = (myShip.boostUntil || 0) > Date.now();
    const speedMul = boosted ? BOOST_MULT : 1.0;
    const maxSpeed = SHIP_MAX_SPEED * speedMul;

    // Throttle
    const wantedThrottle = (k.w ? 1 : 0) + (k.s ? -0.4 : 0);
    const targetSpeed = wantedThrottle * maxSpeed;
    s.throttle += (targetSpeed - s.throttle) * Math.min(1, delta * SHIP_ACCEL / 4);

    // Turning — full effectiveness with even small speed
    const turnEff = 0.4 + Math.min(0.6, Math.abs(s.throttle) / maxSpeed);
    if (k.a) s.heading += SHIP_TURN_RATE * delta * turnEff;
    if (k.d) s.heading -= SHIP_TURN_RATE * delta * turnEff;

    // Forward
    s.x += Math.sin(s.heading) * s.throttle * delta;
    s.z += Math.cos(s.heading) * s.throttle * delta;

    // Arena boundary — circular
    const distFromCenter = Math.hypot(s.x, s.z);
    if (distFromCenter > ARENA_RADIUS) {
      const nx = s.x / distFromCenter;
      const nz = s.z / distFromCenter;
      s.x = nx * ARENA_RADIUS;
      s.z = nz * ARENA_RADIUS;
      s.throttle *= 0.3;
      onArenaClamp?.();
    }

    // Ship-vs-ship pushback (simple radial)
    for (const other of allShips) {
      if (other.uuid === myShip.uuid || !other.alive) continue;
      const dx = s.x - other.x;
      const dz = s.z - other.z;
      const d = Math.hypot(dx, dz);
      const minDist = SHIP_RADIUS * 2;
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / 2;
        s.x += (dx / d) * push;
        s.z += (dz / d) * push;
        s.throttle *= 0.7;
      }
    }

    // Crate pickup
    for (const crate of crates) {
      if (!crate.alive) continue;
      const dx = crate.x - s.x;
      const dz = crate.z - s.z;
      if (dx * dx + dz * dz < CRATE_PICKUP_RADIUS * CRATE_PICKUP_RADIUS) {
        onPickupCrate?.(crate.id);
        break;
      }
    }

    // Mine collision (any mine, including own — to keep self-mining trivially blockable, we filter own)
    for (const mine of mines) {
      if (!mine.alive || mine.ownerId === myShip.uuid) continue;
      const dx = mine.x - s.x;
      const dz = mine.z - s.z;
      const r = 2.4; // MINE_TRIGGER_RADIUS — kept local for hot loop
      if (dx * dx + dz * dz < r * r) {
        onPickupMine?.(mine.id);
        break;
      }
    }

    // Fire
    if (k.space && now - lastFire.current > DEFAULT_CANNON_COOLDOWN_MS) {
      lastFire.current = now;
      onFire?.({ x: s.x, z: s.z, heading: s.heading });
    }

    // Apply transform
    if (ref.current) {
      ref.current.position.x = s.x;
      ref.current.position.z = s.z;
      ref.current.position.y = Math.sin(now / 600) * 0.08;
      ref.current.rotation.y = s.heading;
    }

    // Camera chase
    const camDist = 17;
    const camHeight = 13;
    const behindX = s.x - Math.sin(s.heading) * camDist;
    const behindZ = s.z - Math.cos(s.heading) * camDist;
    camera.position.x += (behindX - camera.position.x) * Math.min(1, delta * 4);
    camera.position.z += (behindZ - camera.position.z) * Math.min(1, delta * 4);
    camera.position.y += (camHeight - camera.position.y) * Math.min(1, delta * 4);
    camera.lookAt(s.x, 1, s.z);

    // Publish at PUBLISH_HZ
    if (now - lastSent.current > 1000 / PUBLISH_HZ) {
      lastSent.current = now;
      onPublishShip({ x: s.x, z: s.z, heading: s.heading, throttle: s.throttle });
    }
  });

  if (!myShip.alive) return null;
  const livesText = '♥'.repeat(Math.max(0, myShip.lives || 0));
  return (
    <group ref={ref}>
      <ShipBody model={myShip.model} color={myShip.color} shielded={myShip.shieldUntil > Date.now()} />
      <FloatingLabel text={`${myShip.name} (you)`} color={myShip.color} sublabel={livesText} />
    </group>
  );
}

// ── Sea ──────────────────────────────────────────────────────────────────────
function Sea() {
  const ref = useRef();
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(400, 400, 60, 60);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame((stateR3F) => {
    const g = ref.current;
    if (!g) return;
    const t = stateR3F.clock.elapsedTime;
    const pos = g.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x * 0.1 + t) * 0.14 + Math.cos(z * 0.13 + t * 0.9) * 0.14;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    g.geometry.computeVertexNormals();
  });

  return (
    <mesh ref={ref} geometry={geom} receiveShadow>
      <meshStandardMaterial color="#1A6B7A" roughness={0.6} metalness={0.25} />
    </mesh>
  );
}

// ── Arena boundary: ring of rocks + circular guide ──────────────────────────
function ArenaRing() {
  const rock = useGLBClone('rocks-c');
  const rocks = useMemo(() => {
    const out = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      out.push({
        angle,
        rot: Math.random() * Math.PI * 2,
        scale: 2.2 + Math.random() * 0.6,
      });
    }
    return out;
  }, []);

  return (
    <group>
      {rocks.map((r, i) => {
        const clone = rock.clone(true);
        return (
          <primitive
            key={i}
            object={clone}
            position={[Math.sin(r.angle) * (ARENA_RADIUS + 2), 0, Math.cos(r.angle) * (ARENA_RADIUS + 2)]}
            rotation={[0, r.rot, 0]}
            scale={r.scale}
          />
        );
      })}
      {/* Faint arena edge ring on the sea */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.2, ARENA_RADIUS + 0.2, 96]} />
        <meshBasicMaterial color="#FFD60A" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ── Inner obstacles ──────────────────────────────────────────────────────────
function InnerObstacles({ obstacles }) {
  const palm = useGLBClone('palm-detailed-straight');
  const sand = useGLBClone('patch-sand-foliage');
  const rocksA = useGLBClone('rocks-sand-a');
  const wreck = useGLBClone('ship-wreck');

  const items = useMemo(() => obstacles.map((o, i) => ({
    ...o,
    key: i,
    sandClone: sand.clone(true),
    palmClone: palm.clone(true),
    rockClone: rocksA.clone(true),
    wreckClone: wreck.clone(true),
  })), [obstacles, sand, palm, rocksA, wreck]);

  return (
    <group>
      {items.map((o) => (
        <group key={o.key} position={[o.x, 0, o.z]} rotation={[0, o.rot, 0]}>
          <primitive object={o.sandClone} scale={2.8} />
          {o.kind === 'palm' && <primitive object={o.palmClone} scale={1.3} />}
          {o.kind === 'rocks' && <primitive object={o.rockClone} scale={1.5} />}
          {o.kind === 'wreck' && <primitive object={o.wreckClone} scale={1.1} />}
        </group>
      ))}
    </group>
  );
}

// ── Weapon crate (chest) ─────────────────────────────────────────────────────
function CrateItem({ crate }) {
  const chest = useGLBClone('chest');
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = 0.3 + Math.sin(performance.now() / 400 + crate.x) * 0.18;
    ref.current.rotation.y += 0.02;
  });
  const color = WEAPONS[crate.type]?.color || '#FFD60A';
  return (
    <group ref={ref} position={[crate.x, 0.3, crate.z]}>
      <primitive object={chest} scale={1.3} />
      {/* Colored glow ring */}
      <mesh position={[0, 1.4, 0]}>
        <ringGeometry args={[0.55, 0.9, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 0.8, 0]} color={color} intensity={2.5} distance={6} />
    </group>
  );
}

// ── Cannonball ───────────────────────────────────────────────────────────────
function Cannonball({ volley }) {
  const ball = useGLBClone('cannon-ball');
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const t = (Date.now() - volley.startedAt) / 1000;

    if (volley.kind === 'mortar') {
      const dur = MORTAR_FLIGHT_MS / 1000;
      const progress = Math.min(1, t / dur);
      ref.current.position.x = volley.startX + volley.dirX * MORTAR_RANGE * progress;
      ref.current.position.z = volley.startZ + volley.dirZ * MORTAR_RANGE * progress;
      ref.current.position.y = 1.0 + Math.sin(progress * Math.PI) * 12;
    } else {
      const dist = CANNON_BALL_SPEED * t;
      ref.current.position.x = volley.startX + volley.dirX * dist;
      ref.current.position.z = volley.startZ + volley.dirZ * dist;
      ref.current.position.y = 1.0 + Math.sin(Math.min(1, dist / CANNON_RANGE) * Math.PI) * 1.5;
    }
  });
  return (
    <group ref={ref}>
      <primitive object={ball} scale={1.2} />
    </group>
  );
}

// ── Mine ─────────────────────────────────────────────────────────────────────
function MineItem({ mine }) {
  const barrel = useGLBClone('barrel');
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const t = performance.now() / 200;
    const pulse = 0.7 + Math.sin(t + mine.x) * 0.3;
    ref.current.position.y = Math.sin(performance.now() / 600) * 0.05;
    if (ref.current.children[1]) {
      ref.current.children[1].material.opacity = pulse;
    }
  });
  return (
    <group ref={ref} position={[mine.x, 0, mine.z]}>
      <primitive object={barrel} scale={0.9} />
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.3, 16, 12]} />
        <meshStandardMaterial color="#FF3B30" emissive="#FF3B30" emissiveIntensity={1.5} transparent opacity={0.9} />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color="#FF3B30" intensity={1.5} distance={4} />
    </group>
  );
}

// ── Explosion effect (visual only, no game logic) ────────────────────────────
function Explosion({ x, z }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.scale.x += 0.4;
    ref.current.scale.y += 0.4;
    ref.current.scale.z += 0.4;
    if (ref.current.material) {
      ref.current.material.opacity = Math.max(0, ref.current.material.opacity - 0.04);
    }
  });
  return (
    <mesh ref={ref} position={[x, 1.2, z]}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color="#FF9F0A" transparent opacity={0.9} />
    </mesh>
  );
}

// ── Top-level scene ──────────────────────────────────────────────────────────
export default function PlunderScene({
  myShip, peers, allShips,
  obstacles, crates, volleys, mines, explosions,
  onPublishShip, onFire, onPickupCrate, onPickupMine,
}) {
  if (!myShip) return null;

  return (
    <Canvas
      shadows
      camera={{ position: [myShip.x, 14, myShip.z + 16], fov: 55, near: 0.5, far: 800 }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#cbe6ee']} />
      <fog attach="fog" args={['#cbe6ee', 80, 240]} />
      <hemisphereLight intensity={0.6} color="#ffffff" groundColor="#1a4452" />
      <directionalLight
        position={[40, 70, 30]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      <Sky sunPosition={[40, 30, 20]} turbidity={4} rayleigh={1.4} mieCoefficient={0.005} mieDirectionalG={0.7} />

      <Suspense fallback={null}>
        <Sea />
        <ArenaRing />
        <InnerObstacles obstacles={obstacles} />

        {crates.map((c) => c.alive && <CrateItem key={c.id} crate={c} />)}
        {mines.map((m) => m.alive && <MineItem key={m.id} mine={m} />)}
        {volleys.map((v) => <Cannonball key={v.id} volley={v} />)}
        {explosions.map((e) => <Explosion key={e.id} x={e.x} z={e.z} />)}

        <LocalShip
          myShip={myShip}
          allShips={allShips}
          crates={crates}
          mines={mines}
          onPublishShip={onPublishShip}
          onFire={onFire}
          onPickupCrate={onPickupCrate}
          onPickupMine={onPickupMine}
        />

        {peers.map((p) => <PeerShip key={p.uuid} ship={p} />)}
      </Suspense>
    </Canvas>
  );
}

if (typeof window !== 'undefined') {
  [
    'ship-pirate-small', 'ship-pirate-medium', 'ship-pirate-large',
    'ship-small', 'ship-medium', 'ship-large',
    'cannon-ball', 'chest', 'barrel',
    'rocks-c', 'rocks-sand-a',
    'patch-sand-foliage',
    'palm-detailed-straight',
    'ship-wreck',
  ].forEach((n) => useGLTF.preload(GLB(n)));
}
