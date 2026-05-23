import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { nanoid } from 'nanoid';
import {
  PLAYER_COLORS, SHIP_MODELS,
  ARENA_RADIUS, SPAWN_RADIUS, OBSTACLE_COUNT,
  LIVES_PER_PLAYER, RESPAWN_DELAY_MS, COUNTDOWN_MS, POST_KILL_HOLD_MS,
  CANNON_BALL_SPEED, CANNON_RANGE, HIT_RADIUS,
  MORTAR_FLIGHT_MS, MORTAR_RANGE, MORTAR_SPLASH,
  MINE_LIFETIME_MS, MINE_TRIGGER_RADIUS,
  TRIPLE_FAN_ANGLE,
  BOOST_DURATION_MS, SHIELD_DURATION_MS,
  CRATE_TYPES, CRATE_MAX, CRATE_SPAWN_INTERVAL_MS,
  WEAPONS, PHASE,
} from '../../../lib/games/plunder/constants';
import {
  playCannon, playMortar, playExplosion, playPickup, playSink, playBoost,
  playShield, playMineDrop, playCountdown, playGo, playGameOver,
} from '../../../lib/games/plunder/sounds';
import PlunderHUD from '../../../components/plunder/PlunderHUD';

const GAME_COLOR = '#1A6B7A';
const GAME_GLOW = 'rgba(26,107,122,0.4)';

const PlunderScene = dynamic(() => import('../../../components/plunder/PlunderScene'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#cbe6ee', color: '#0d3a44',
      fontFamily: 'Inter, sans-serif', fontSize: 16,
    }}>
      Loading the arena...
    </div>
  ),
});

// ── Map seed (deterministic obstacles per match) ────────────────────────────
function seedRng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateObstacles(seedStr) {
  const rng = seedRng(seedStr);
  const kinds = ['palm', 'rocks', 'wreck'];
  const obs = [];
  for (let i = 0; i < OBSTACLE_COUNT; i++) {
    const angle = (i / OBSTACLE_COUNT) * Math.PI * 2 + rng() * 0.4;
    const r = ARENA_RADIUS * 0.35 + rng() * ARENA_RADIUS * 0.15;
    obs.push({
      kind: kinds[Math.floor(rng() * kinds.length)],
      x: Math.sin(angle) * r,
      z: Math.cos(angle) * r,
      rot: rng() * Math.PI * 2,
    });
  }
  return obs;
}

function spawnPositionForIndex(idx, total) {
  const angle = (idx / Math.max(1, total)) * Math.PI * 2;
  return {
    x: Math.sin(angle) * SPAWN_RADIUS,
    z: Math.cos(angle) * SPAWN_RADIUS,
    heading: Math.atan2(-Math.sin(angle), -Math.cos(angle)),
  };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function PlunderRoom() {
  const router = useRouter();
  const { code } = router.query;

  const [identity, setIdentity] = useState(null);
  const [peerCount, setPeerCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const [ships, setShips] = useState({});
  const [crates, setCrates] = useState([]);
  const [volleys, setVolleys] = useState([]);
  const [mines, setMines] = useState([]);
  const [obstacles, setObstacles] = useState([]);
  const [meta, setMeta] = useState({
    phase: PHASE.LOBBY, hostId: null, winnerId: null,
    matchStartedAt: 0, countdownEndsAt: 0,
  });
  const [now, setNow] = useState(Date.now());
  const [explosions, setExplosions] = useState([]);

  const docRef = useRef(null);
  const providerRef = useRef(null);
  const shipsMapRef = useRef(null);
  const cratesMapRef = useRef(null);
  const volleysMapRef = useRef(null);
  const minesMapRef = useRef(null);
  const metaMapRef = useRef(null);

  // Scene refs (HUD minimap reads from these)
  const myUuidRef = useRef(null);
  const sceneShipsRef = useRef({});
  const sceneCratesRef = useRef([]);
  const sceneMinesRef = useRef([]);

  // Sound transition tracking
  const prevAliveRef = useRef({});
  const prevWeaponRef = useRef({});
  const lastCountdownStepRef = useRef(0);
  const playedGameOverRef = useRef(false);

  // ── Y.js setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code || typeof window === 'undefined') return;

    const stored = localStorage.getItem('poordown_identity');
    const ident = stored ? JSON.parse(stored) : null;
    if (!ident) {
      localStorage.setItem('poordown_redirect', window.location.pathname + window.location.search);
      router.push('/');
      return;
    }
    setIdentity(ident);
    myUuidRef.current = ident.uuid;

    const isHostQuery = new URLSearchParams(window.location.search).get('host') === 'true';
    const doc = new Y.Doc();
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:4444';
    const provider = new WebrtcProvider(`poordown-plunder-${code}`, doc, {
      signaling: [signalingUrl],
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
      maxConns: 8,
    });

    docRef.current = doc;
    providerRef.current = provider;
    provider.awareness.setLocalStateField('player', { uuid: ident.uuid, name: ident.name });

    const yShips = doc.getMap('ships');
    const yCrates = doc.getMap('crates');
    const yVolleys = doc.getMap('volleys');
    const yMines = doc.getMap('mines');
    const yMeta = doc.getMap('meta');
    shipsMapRef.current = yShips;
    cratesMapRef.current = yCrates;
    volleysMapRef.current = yVolleys;
    minesMapRef.current = yMines;
    metaMapRef.current = yMeta;

    if (isHostQuery && !yMeta.get('hostId')) {
      yMeta.set('hostId', ident.uuid);
      yMeta.set('phase', PHASE.LOBBY);
      yMeta.set('winnerId', null);
      yMeta.set('mapSeed', `${code}:1`);
      yMeta.set('matchNumber', 1);
    }

    // Seed self ship (lobby slot — alive=false until match starts)
    const seedShip = () => {
      if (yShips.get(ident.uuid)) return;
      const joinOrder = yShips.size;
      const spawn = spawnPositionForIndex(joinOrder, 8);
      yShips.set(ident.uuid, {
        uuid: ident.uuid,
        name: ident.name,
        color: PLAYER_COLORS[joinOrder % PLAYER_COLORS.length],
        model: SHIP_MODELS[joinOrder % SHIP_MODELS.length],
        x: spawn.x, z: spawn.z, heading: spawn.heading, throttle: 0,
        lives: LIVES_PER_PLAYER,
        kills: 0,
        alive: false,
        weapon: 'default',
        weaponUses: 0,
        boostUntil: 0,
        shieldUntil: 0,
        respawnAt: 0,
        joinOrder,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      });
    };
    seedShip();

    const syncShips = () => {
      const snap = {};
      yShips.forEach((v, k) => { snap[k] = v; });
      sceneShipsRef.current = snap;
      setShips(snap);
    };
    const syncCrates = () => {
      const list = Array.from(yCrates.values());
      sceneCratesRef.current = list;
      setCrates(list);
    };
    const syncVolleys = () => {
      // Filter old volleys client-side too (host prunes but lag is possible)
      const cutoff = Date.now() - 4000;
      setVolleys(Array.from(yVolleys.values()).filter((v) => v.startedAt > cutoff));
    };
    const syncMines = () => {
      const list = Array.from(yMines.values());
      sceneMinesRef.current = list;
      setMines(list);
    };
    const syncMeta = () => {
      const m = {
        phase: yMeta.get('phase') || PHASE.LOBBY,
        hostId: yMeta.get('hostId') || null,
        winnerId: yMeta.get('winnerId') || null,
        matchStartedAt: yMeta.get('matchStartedAt') || 0,
        countdownEndsAt: yMeta.get('countdownEndsAt') || 0,
        mapSeed: yMeta.get('mapSeed') || `${code}:1`,
        matchNumber: yMeta.get('matchNumber') || 1,
      };
      setMeta(m);
      setObstacles(generateObstacles(m.mapSeed));
    };

    yShips.observe(syncShips);
    yCrates.observe(syncCrates);
    yVolleys.observe(syncVolleys);
    yMines.observe(syncMines);
    yMeta.observe(syncMeta);
    syncShips(); syncCrates(); syncVolleys(); syncMines(); syncMeta();

    const onAwareness = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const online = states.filter((s) => s.player?.uuid).length;
      setPeerCount(Math.max(0, online - 1));
    };
    provider.awareness.on('change', onAwareness);

    const tickInt = setInterval(() => setNow(Date.now()), 200);

    return () => {
      clearInterval(tickInt);
      yShips.unobserve(syncShips);
      yCrates.unobserve(syncCrates);
      yVolleys.unobserve(syncVolleys);
      yMines.unobserve(syncMines);
      yMeta.unobserve(syncMeta);
      provider.awareness.off('change', onAwareness);
      try {
        if (yShips.get(ident.uuid)) yShips.delete(ident.uuid);
      } catch {}
      provider.destroy();
      doc.destroy();
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sound transitions (all clients) ──────────────────────────────────────
  useEffect(() => {
    const prevAlive = prevAliveRef.current;
    const prevWeapon = prevWeaponRef.current;
    for (const s of Object.values(ships)) {
      const pAlive = prevAlive[s.uuid];
      const pWeapon = prevWeapon[s.uuid];
      if (pAlive !== undefined && pAlive === true && s.alive === false) playSink();
      if (pWeapon && pWeapon === 'default' && s.weapon && s.weapon !== 'default') {
        playPickup();
      }
      // Boost/shield activation sound — only when the active player picks it up
      if (s.weapon === 'boost' && (s.boostUntil || 0) > Date.now() && pWeapon !== 'boost') {
        // Note: weapon resets to default after activation, so this catches the moment.
      }
      prevAlive[s.uuid] = s.alive;
      prevWeapon[s.uuid] = s.weapon;
    }
  }, [ships]);

  // Game-over sound
  useEffect(() => {
    if (meta.phase === PHASE.GAME_OVER && !playedGameOverRef.current) {
      playedGameOverRef.current = true;
      playGameOver();
    } else if (meta.phase !== PHASE.GAME_OVER) {
      playedGameOverRef.current = false;
    }
  }, [meta.phase]);

  // Countdown beeps
  useEffect(() => {
    if (meta.phase !== PHASE.COUNTDOWN) { lastCountdownStepRef.current = 0; return; }
    const remaining = Math.max(0, meta.countdownEndsAt - now);
    const step = Math.ceil(remaining / 1000);
    if (step !== lastCountdownStepRef.current && step > 0) {
      lastCountdownStepRef.current = step;
      playCountdown();
    }
  }, [meta.phase, meta.countdownEndsAt, now]);

  // GO sound when countdown finishes
  const prevPhaseRef = useRef(null);
  useEffect(() => {
    if (prevPhaseRef.current === PHASE.COUNTDOWN && meta.phase === PHASE.PLAYING) {
      playGo();
    }
    prevPhaseRef.current = meta.phase;
  }, [meta.phase]);

  // ── Host tick loop ────────────────────────────────────────────────────────
  const isHost = identity && meta.hostId === identity.uuid;
  useEffect(() => {
    if (!isHost) return;
    const yMeta = metaMapRef.current;
    const yShips = shipsMapRef.current;
    const yCrates = cratesMapRef.current;
    const yVolleys = volleysMapRef.current;
    const yMines = minesMapRef.current;
    if (!yMeta || !yShips || !yCrates || !yVolleys || !yMines) return;

    let lastCrateSpawn = Date.now();

    const tick = () => {
      const tNow = Date.now();
      const phase = yMeta.get('phase');

      // Countdown → Playing
      if (phase === PHASE.COUNTDOWN && tNow >= (yMeta.get('countdownEndsAt') || 0)) {
        yMeta.set('phase', PHASE.PLAYING);
        yMeta.set('matchStartedAt', tNow);
        // Wake up all ships
        yShips.forEach((s, sid) => {
          yShips.set(sid, { ...s, alive: true });
        });
      }

      if (phase !== PHASE.PLAYING) return;

      // ── Process volleys ───────────────────────────────────────────────────
      yVolleys.forEach((v, vid) => {
        if (v.processed) return;
        const flightSec = (tNow - v.startedAt) / 1000;

        if (v.kind === 'mortar') {
          // Mortar lands after MORTAR_FLIGHT_MS, splash radius MORTAR_SPLASH
          if (tNow - v.startedAt >= MORTAR_FLIGHT_MS) {
            const landX = v.startX + v.dirX * MORTAR_RANGE;
            const landZ = v.startZ + v.dirZ * MORTAR_RANGE;
            // Splash
            yShips.forEach((target, tid) => {
              if (tid === v.ownerId) return;
              if (!target.alive) return;
              if ((target.shieldUntil || 0) > tNow) return;
              const dx = target.x - landX;
              const dz = target.z - landZ;
              if (dx * dx + dz * dz < MORTAR_SPLASH * MORTAR_SPLASH) {
                killShip(yShips, target, v.ownerId, tNow);
              }
            });
            yVolleys.set(vid, { ...v, processed: true, landX, landZ });
            // Trigger explosion locally on all clients via a meta event
            broadcastExplosion(landX, landZ);
          }
          return;
        }

        // Straight cannonball
        const dist = CANNON_BALL_SPEED * flightSec;
        if (dist > CANNON_RANGE) {
          yVolleys.set(vid, { ...v, processed: true });
          return;
        }
        const bx = v.startX + v.dirX * dist;
        const bz = v.startZ + v.dirZ * dist;
        yShips.forEach((target, tid) => {
          if (tid === v.ownerId) return;
          if (!target.alive) return;
          if ((target.shieldUntil || 0) > tNow) return;
          const dx = target.x - bx;
          const dz = target.z - bz;
          if (dx * dx + dz * dz < HIT_RADIUS * HIT_RADIUS) {
            killShip(yShips, target, v.ownerId, tNow);
            yVolleys.set(vid, { ...v, processed: true, hitId: tid });
            broadcastExplosion(bx, bz);
          }
        });
      });

      // Prune old volleys
      yVolleys.forEach((v, vid) => {
        if (tNow - v.startedAt > 4000) yVolleys.delete(vid);
      });

      // ── Mines: check ship collisions ──────────────────────────────────────
      yMines.forEach((mine, mid) => {
        if (!mine.alive) return;
        if (tNow - mine.plantedAt > MINE_LIFETIME_MS) {
          yMines.set(mid, { ...mine, alive: false });
          return;
        }
        yShips.forEach((target, tid) => {
          if (tid === mine.ownerId) return;
          if (!target.alive) return;
          if ((target.shieldUntil || 0) > tNow) return;
          const dx = target.x - mine.x;
          const dz = target.z - mine.z;
          if (dx * dx + dz * dz < MINE_TRIGGER_RADIUS * MINE_TRIGGER_RADIUS) {
            killShip(yShips, target, mine.ownerId, tNow);
            yMines.set(mid, { ...mine, alive: false });
            broadcastExplosion(mine.x, mine.z);
          }
        });
      });

      // Prune dead mines after 2 sec
      yMines.forEach((mine, mid) => {
        if (!mine.alive && tNow - (mine.plantedAt + MINE_LIFETIME_MS) > 2000) {
          yMines.delete(mid);
        }
      });

      // ── Respawn ───────────────────────────────────────────────────────────
      yShips.forEach((s, sid) => {
        if (!s.alive && s.respawnAt && tNow >= s.respawnAt && (s.lives || 0) > 0) {
          const idx = s.joinOrder || 0;
          const total = Math.max(yShips.size, 1);
          const spawn = spawnPositionForIndex(idx, total);
          yShips.set(sid, {
            ...s, alive: true,
            x: spawn.x, z: spawn.z, heading: spawn.heading, throttle: 0,
            weapon: 'default', weaponUses: 0,
            boostUntil: 0,
            shieldUntil: tNow + 2000, // brief spawn-protect
            respawnAt: 0,
          });
        }
      });

      // ── End game check ────────────────────────────────────────────────────
      let remaining = 0;
      let lastAliveId = null;
      yShips.forEach((s) => {
        if ((s.lives || 0) > 0) { remaining++; lastAliveId = s.uuid; }
      });
      if (remaining <= 1 && yShips.size > 1) {
        yMeta.set('winnerId', lastAliveId);
        yMeta.set('phase', PHASE.GAME_OVER);
      }

      // ── Crate spawning ────────────────────────────────────────────────────
      let aliveCrates = 0;
      yCrates.forEach((c) => { if (c.alive) aliveCrates++; });
      if (aliveCrates < CRATE_MAX && tNow - lastCrateSpawn > CRATE_SPAWN_INTERVAL_MS) {
        lastCrateSpawn = tNow;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * (ARENA_RADIUS * 0.7);
        const id = nanoid(8);
        yCrates.set(id, {
          id,
          type: CRATE_TYPES[Math.floor(Math.random() * CRATE_TYPES.length)],
          x: Math.sin(angle) * r,
          z: Math.cos(angle) * r,
          alive: true,
          spawnedAt: tNow,
        });
      }

      // Prune picked-up crates after a moment
      yCrates.forEach((c, id) => {
        if (!c.alive && tNow - (c.pickedAt || 0) > 2000) yCrates.delete(id);
      });
    };

    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: kill a ship + score the killer ───────────────────────────────
  function killShip(yShips, victim, killerId, tNow) {
    const newLives = Math.max(0, (victim.lives || 0) - 1);
    yShips.set(victim.uuid, {
      ...victim,
      alive: false,
      lives: newLives,
      respawnAt: newLives > 0 ? tNow + RESPAWN_DELAY_MS : 0,
    });
    if (killerId && killerId !== victim.uuid) {
      const killer = yShips.get(killerId);
      if (killer) {
        yShips.set(killerId, {
          ...killer,
          kills: (killer.kills || 0) + 1,
        });
      }
    }
  }

  // ── Explosion broadcast — write to meta with timestamp, local clients render
  function broadcastExplosion(x, z) {
    const yMeta = metaMapRef.current;
    if (!yMeta) return;
    yMeta.set('lastExplosion', { id: nanoid(6), x, z, at: Date.now() });
  }

  // Local explosion render on every "lastExplosion" change
  useEffect(() => {
    const yMeta = metaMapRef.current;
    if (!yMeta) return;
    const handler = () => {
      const e = yMeta.get('lastExplosion');
      if (!e) return;
      setExplosions((prev) => [...prev, e].slice(-8));
      playExplosion();
      setTimeout(() => {
        setExplosions((prev) => prev.filter((x) => x.id !== e.id));
      }, 700);
    };
    yMeta.observe(handler);
    return () => yMeta.unobserve(handler);
  }, [meta.hostId]); // re-binds once meta is ready

  // ── Publish own ship motion ──────────────────────────────────────────────
  const publishShip = useCallback((delta) => {
    const yShips = shipsMapRef.current;
    if (!yShips || !identity) return;
    const prev = yShips.get(identity.uuid);
    if (!prev || !prev.alive) return;
    yShips.set(identity.uuid, {
      ...prev,
      x: delta.x, z: delta.z, heading: delta.heading, throttle: delta.throttle,
      updatedAt: Date.now(),
    });
  }, [identity]);

  // ── Fire current weapon ───────────────────────────────────────────────────
  const fire = useCallback(({ x, z, heading }) => {
    const yShips = shipsMapRef.current;
    const yVolleys = volleysMapRef.current;
    const yMines = minesMapRef.current;
    if (!yShips || !yVolleys || !yMines || !identity) return;
    const me = yShips.get(identity.uuid);
    if (!me || !me.alive) return;

    const weapon = me.weapon || 'default';
    const dirX = Math.sin(heading);
    const dirZ = Math.cos(heading);

    if (weapon === 'default') {
      const id = nanoid(8);
      yVolleys.set(id, {
        id, kind: 'cannon', ownerId: identity.uuid,
        startedAt: Date.now(),
        startX: x + dirX * 1.5, startZ: z + dirZ * 1.5,
        dirX, dirZ,
      });
      playCannon();
      return;
    }

    if (weapon === 'triple') {
      const startedAt = Date.now();
      for (let i = -1; i <= 1; i++) {
        const a = heading + i * TRIPLE_FAN_ANGLE;
        const id = nanoid(8);
        yVolleys.set(id, {
          id, kind: 'cannon', ownerId: identity.uuid,
          startedAt: startedAt + (i + 1) * 12,
          startX: x + Math.sin(a) * 1.5, startZ: z + Math.cos(a) * 1.5,
          dirX: Math.sin(a), dirZ: Math.cos(a),
        });
      }
      playCannon();
      consumeWeapon(me);
      return;
    }

    if (weapon === 'mortar') {
      const id = nanoid(8);
      yVolleys.set(id, {
        id, kind: 'mortar', ownerId: identity.uuid,
        startedAt: Date.now(),
        startX: x, startZ: z,
        dirX, dirZ,
      });
      playMortar();
      consumeWeapon(me);
      return;
    }

    if (weapon === 'mine') {
      const id = nanoid(8);
      // Drop the mine behind the ship
      yMines.set(id, {
        id, ownerId: identity.uuid,
        x: x - dirX * 2.2, z: z - dirZ * 2.2,
        plantedAt: Date.now(),
        alive: true,
      });
      playMineDrop();
      consumeWeapon(me);
      return;
    }

    if (weapon === 'boost') {
      yShips.set(identity.uuid, {
        ...me,
        boostUntil: Date.now() + BOOST_DURATION_MS,
        weapon: 'default', weaponUses: 0,
      });
      playBoost();
      return;
    }

    if (weapon === 'shield') {
      yShips.set(identity.uuid, {
        ...me,
        shieldUntil: Date.now() + SHIELD_DURATION_MS,
        weapon: 'default', weaponUses: 0,
      });
      playShield();
      return;
    }
  }, [identity]);

  // Helper for consuming a weapon-use (decrements ammo, reverts to default on 0)
  const consumeWeapon = useCallback((me) => {
    const yShips = shipsMapRef.current;
    if (!yShips || !identity) return;
    const newUses = (me.weaponUses || 1) - 1;
    if (newUses <= 0) {
      yShips.set(identity.uuid, { ...me, weapon: 'default', weaponUses: 0 });
    } else {
      yShips.set(identity.uuid, { ...me, weaponUses: newUses });
    }
  }, [identity]);

  // ── Pickup crate ──────────────────────────────────────────────────────────
  const pickupCrate = useCallback((crateId) => {
    const yCrates = cratesMapRef.current;
    const yShips = shipsMapRef.current;
    if (!yCrates || !yShips || !identity) return;
    const crate = yCrates.get(crateId);
    if (!crate || !crate.alive) return;
    const me = yShips.get(identity.uuid);
    if (!me || !me.alive) return;
    // Mark crate consumed (local race is fine — Y.js will reconcile)
    yCrates.set(crateId, { ...crate, alive: false, pickedAt: Date.now(), pickedBy: identity.uuid });
    const weapon = crate.type;
    yShips.set(identity.uuid, {
      ...me,
      weapon,
      weaponUses: WEAPONS[weapon]?.uses || 1,
    });
    playPickup();
  }, [identity]);

  // ── Mine hit on self ─────────────────────────────────────────────────────
  // (Mines are resolved on the host. Local detection just informs the host fast;
  // host re-validates. Here we just no-op — host owns mine damage.)
  const onMineContact = useCallback(() => { /* host handles */ }, []);

  // ── Host actions ─────────────────────────────────────────────────────────
  const startMatch = useCallback(() => {
    const yMeta = metaMapRef.current;
    const yShips = shipsMapRef.current;
    const yCrates = cratesMapRef.current;
    const yVolleys = volleysMapRef.current;
    const yMines = minesMapRef.current;
    if (!yMeta || !yShips || !yCrates || !yVolleys || !yMines) return;
    if (!isHost) return;

    // Clear ephemerals
    yCrates.forEach((_, id) => yCrates.delete(id));
    yVolleys.forEach((_, id) => yVolleys.delete(id));
    yMines.forEach((_, id) => yMines.delete(id));

    // Reset all ships
    const shipsArr = Array.from(yShips.entries()).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
    shipsArr.forEach(([sid, s], idx) => {
      const spawn = spawnPositionForIndex(idx, shipsArr.length);
      yShips.set(sid, {
        ...s,
        joinOrder: idx,
        x: spawn.x, z: spawn.z, heading: spawn.heading, throttle: 0,
        lives: LIVES_PER_PLAYER,
        kills: 0,
        alive: false, // becomes true when countdown ends
        weapon: 'default', weaponUses: 0,
        boostUntil: 0, shieldUntil: 0,
        respawnAt: 0,
      });
    });

    const newMatchNum = (yMeta.get('matchNumber') || 0) + 1;
    yMeta.set('matchNumber', newMatchNum);
    yMeta.set('mapSeed', `${code}:${newMatchNum}:${Date.now()}`);
    yMeta.set('winnerId', null);
    yMeta.set('countdownEndsAt', Date.now() + COUNTDOWN_MS);
    yMeta.set('phase', PHASE.COUNTDOWN);
  }, [isHost, code]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const me = identity ? ships[identity.uuid] : null;
  const peerShips = useMemo(
    () => Object.values(ships).filter((s) => s.uuid !== identity?.uuid),
    [ships, identity]
  );
  const allShipsList = useMemo(() => Object.values(ships), [ships]);
  const winnerShip = meta.winnerId ? ships[meta.winnerId] : null;

  const copyRoomLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/plunder/room/${code}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const inMatch = meta.phase === PHASE.COUNTDOWN || meta.phase === PHASE.PLAYING || meta.phase === PHASE.GAME_OVER;
  const countdownLeft = Math.max(0, meta.countdownEndsAt - now);
  const countdownStep = Math.ceil(countdownLeft / 1000);

  return (
    <>
      <Head>
        <title>{`Pirate Smash · ${code || ''}`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#cbe6ee' }}>
        {/* 3D scene */}
        {identity && me && inMatch && (
          <PlunderScene
            myShip={me}
            peers={peerShips}
            allShips={allShipsList}
            obstacles={obstacles}
            crates={crates}
            volleys={volleys}
            mines={mines}
            explosions={explosions}
            onPublishShip={publishShip}
            onFire={fire}
            onPickupCrate={pickupCrate}
            onPickupMine={onMineContact}
          />
        )}

        {/* Lobby view */}
        {meta.phase === PHASE.LOBBY && (
          <LobbyView
            code={code}
            players={Object.values(ships)}
            isHost={isHost}
            onStart={startMatch}
            onLeave={() => router.push('/plunder')}
          />
        )}

        {/* HUD (in-match only) */}
        {inMatch && me && (
          <PlunderHUD
            me={me}
            ships={ships}
            myUuid={identity.uuid}
            shipsRef={sceneShipsRef}
            myUuidRef={myUuidRef}
            cratesRef={sceneCratesRef}
            minesRef={{ current: mines }}
          />
        )}

        {/* Top bar */}
        {inMatch && (
          <div style={{
            position: 'absolute', top: 12, left: 16, display: 'flex', gap: 8, zIndex: 10,
          }}>
            <button
              onClick={() => router.push('/plunder')}
              style={pillBtn}
            >
              ← Leave
            </button>
            <button onClick={copyRoomLink} style={{ ...pillBtn, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2 }}>
              {copied ? 'COPIED ✓' : code}
            </button>
            <div style={{ ...pillBtn, cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: '#30D158', boxShadow: '0 0 6px #30D158' }} />
              {peerCount === 0 ? 'Solo' : `+${peerCount}`}
            </div>
          </div>
        )}

        {/* Controls hint */}
        {meta.phase === PHASE.PLAYING && me?.alive && (
          <div style={{
            position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(13,13,26,0.75)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#ffffff', fontFamily: 'Inter, sans-serif', fontSize: 12,
            padding: '8px 14px', borderRadius: 10, backdropFilter: 'blur(8px)',
            display: 'flex', gap: 12, zIndex: 5, alignItems: 'center', pointerEvents: 'none',
          }}>
            <KeyHint label="W A S D" desc="Drive" />
            <KeyHint label="Space" desc="Fire weapon" />
            <KeyHint label="Crates" desc="Drive over to grab" />
          </div>
        )}

        {/* Countdown overlay */}
        {meta.phase === PHASE.COUNTDOWN && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 15, pointerEvents: 'none',
          }}>
            <div style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 200,
              color: '#FFD60A',
              textShadow: '0 6px 24px rgba(255,214,10,0.5), 0 0 60px rgba(255,214,10,0.8)',
              animation: 'countdown-pop 1s ease-out',
            }} key={countdownStep}>
              {countdownStep || 'GO!'}
            </div>
            <style jsx>{`
              @keyframes countdown-pop {
                0%   { transform: scale(0.5); opacity: 0; }
                30%  { transform: scale(1.2); opacity: 1; }
                100% { transform: scale(1); opacity: 0.9; }
              }
            `}</style>
          </div>
        )}

        {/* Death overlay */}
        {meta.phase === PHASE.PLAYING && me && !me.alive && (me.lives || 0) > 0 && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 15, pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center', color: '#ffffff', fontFamily: 'Nunito, sans-serif' }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: '#FF3B30', textShadow: '0 4px 24px rgba(255,59,48,0.5)' }}>
                Sunk
              </div>
              <div style={{ fontSize: 18, marginTop: 6, fontFamily: 'Inter, sans-serif', color: '#cbe6ee' }}>
                {'♥'.repeat(me.lives)} left · Respawn in {Math.max(0, Math.ceil((me.respawnAt - now) / 1000))}s
              </div>
            </div>
          </div>
        )}

        {/* Eliminated overlay */}
        {meta.phase === PHASE.PLAYING && me && (me.lives || 0) <= 0 && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 15, pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center', color: '#ffffff', fontFamily: 'Nunito, sans-serif' }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: '#8c80fc' }}>
                Eliminated
              </div>
              <div style={{ fontSize: 16, marginTop: 4, fontFamily: 'Inter, sans-serif', color: '#cbe6ee' }}>
                Spectating until match ends.
              </div>
            </div>
          </div>
        )}

        {/* Game over */}
        {meta.phase === PHASE.GAME_OVER && (
          <GameOverView
            winnerShip={winnerShip}
            ships={ships}
            myUuid={identity?.uuid}
            isHost={isHost}
            onRematch={startMatch}
            onLeave={() => router.push('/plunder')}
          />
        )}
      </div>
    </>
  );
}

const pillBtn = {
  background: 'rgba(13,13,26,0.75)',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#ffffff',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  fontSize: 13,
  padding: '8px 14px',
  borderRadius: 10,
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
};

function KeyHint({ label, desc }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
        padding: '2px 7px', borderRadius: 5, fontSize: 11,
        textAlign: 'center', whiteSpace: 'nowrap',
      }}>{label}</span>
      <span style={{ color: '#cbe6ee', fontSize: 12 }}>{desc}</span>
    </span>
  );
}

// ── Lobby ────────────────────────────────────────────────────────────────────
function LobbyView({ code, players, isHost, onStart, onLeave }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #b8e0e8 0%, #5fa6b8 40%, #d8c391 70%, #c8a96a 100%)',
      overflow: 'hidden', fontFamily: 'Inter, sans-serif',
    }}>
      <img src="/kenney_pirate-kit/Previews/palm-detailed-bend.png" alt="" style={{
        position: 'absolute', bottom: 0, left: -30, width: 200, opacity: 0.95,
      }} />
      <img src="/kenney_pirate-kit/Previews/palm-detailed-straight.png" alt="" style={{
        position: 'absolute', bottom: 0, right: -30, width: 200, opacity: 0.95, transform: 'scaleX(-1)',
      }} />

      <div style={{
        position: 'relative', zIndex: 2,
        background: '#1e1e38',
        borderRadius: 24, padding: 36, maxWidth: 520, width: 'min(92vw, 520px)',
        border: `1px solid ${GAME_COLOR}66`,
        boxShadow: `0 12px 48px rgba(0,0,0,0.5)`,
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
          <img src="/kenney_pirate-kit/Previews/ship-pirate-medium.png" alt="" style={{ width: 56 }} />
          <h1 style={{
            fontFamily: 'Nunito, sans-serif', fontSize: 36, fontWeight: 800,
            color: '#ffffff', margin: 0,
          }}>
            Pirate <span style={{ color: GAME_COLOR }}>Smash</span>
          </h1>
        </div>
        <p style={{ color: '#8c80fc', fontSize: 14, margin: '0 0 22px 0' }}>
          3 lives. Last ship floating wins. Grab crates for weapons.
        </p>

        <div style={{
          background: '#0d0d1a', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left',
        }}>
          <div style={{ fontSize: 11, color: '#8c80fc', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
            Captains aboard ({players.length})
          </div>
          {players.map((p) => (
            <div key={p.uuid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: p.color }} />
              <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, flex: 1 }}>{p.name}</span>
            </div>
          ))}
          {players.length === 0 && (
            <span style={{ color: '#cbe6ee', fontSize: 13, opacity: 0.7 }}>Waiting…</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {isHost ? (
            <button
              onClick={onStart}
              disabled={players.length < 1}
              style={{
                padding: '14px 28px', background: GAME_COLOR, color: '#ffffff',
                border: 'none', borderRadius: 12,
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16,
                cursor: players.length < 1 ? 'not-allowed' : 'pointer',
                opacity: players.length < 1 ? 0.6 : 1,
                boxShadow: `0 6px 20px ${GAME_GLOW}`,
              }}>
              ⚔ Deploy Fleet
            </button>
          ) : (
            <div style={{
              padding: '14px 28px', background: 'rgba(255,255,255,0.06)',
              color: '#cbe6ee', borderRadius: 12,
              fontFamily: 'Inter, sans-serif', fontSize: 14,
            }}>
              Waiting for the captain to start…
            </div>
          )}
          <button
            onClick={onLeave}
            style={{
              padding: '14px 22px', background: '#0d0d1a',
              color: '#cbe6ee', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>
            Leave
          </button>
        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(203,230,236,0.55)' }}>
          Share room code <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#ffffff', letterSpacing: 2, marginLeft: 2 }}>{code}</span>
        </div>
      </div>
    </div>
  );
}

// ── Game-over ────────────────────────────────────────────────────────────────
function GameOverView({ winnerShip, ships, myUuid, isHost, onRematch, onLeave }) {
  const sorted = Object.values(ships).sort((a, b) => (b.kills || 0) - (a.kills || 0));
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(13,13,26,0.86)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 20, backdropFilter: 'blur(4px)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#1e1e38', borderRadius: 22, padding: 36,
        maxWidth: 520, width: 'min(92vw, 520px)',
        border: `1px solid ${GAME_COLOR}66`,
        boxShadow: `0 12px 40px rgba(0,0,0,0.6)`,
        textAlign: 'center',
      }}>
        <img src="/kenney_pirate-kit/Previews/flag-pirate-high-pennant.png" alt="" style={{ width: 80, marginBottom: 6, filter: 'drop-shadow(0 6px 12px rgba(255,214,10,0.4))' }} />
        <div style={{
          fontFamily: 'Nunito, sans-serif', fontSize: 32, fontWeight: 800,
          color: '#FFD60A', marginBottom: 4,
        }}>
          Match Over
        </div>
        {winnerShip ? (
          <>
            <div style={{ color: '#cbe6ee', fontSize: 14, marginBottom: 4 }}>Last ship floating:</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ width: 14, height: 14, borderRadius: 7, background: winnerShip.color }} />
              <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 22, color: '#ffffff' }}>
                {winnerShip.name}{winnerShip.uuid === myUuid && ' (you!)'}
              </span>
            </div>
          </>
        ) : (
          <div style={{ color: '#cbe6ee', marginBottom: 18 }}>No survivors.</div>
        )}

        <div style={{ background: '#0d0d1a', borderRadius: 12, padding: 14, marginBottom: 20 }}>
          {sorted.map((p, i) => (
            <div key={p.uuid} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
              fontSize: 14,
            }}>
              <span style={{ width: 22, textAlign: 'right', color: '#8c80fc', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {i + 1}.
              </span>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: p.color }} />
              <span style={{ flex: 1, textAlign: 'left', color: '#ffffff' }}>{p.name}</span>
              <span style={{ color: '#cbe6ee', width: 50, textAlign: 'right', fontFamily: 'JetBrains Mono' }}>
                {p.kills || 0} KOs
              </span>
              <span style={{ color: '#FF3B30', width: 40, textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                {'♥'.repeat(Math.max(0, p.lives || 0))}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {isHost && (
            <button
              onClick={onRematch}
              style={{
                padding: '12px 24px', background: GAME_COLOR, color: '#ffffff',
                border: 'none', borderRadius: 12,
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15,
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${GAME_GLOW}`,
              }}>
              Rematch →
            </button>
          )}
          <button
            onClick={onLeave}
            style={{
              padding: '12px 24px', background: '#0d0d1a', color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12,
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
