import { useEffect, useRef } from 'react';
import { WEAPONS, ARENA_RADIUS } from '../../lib/games/plunder/constants';

// ── Minimap ──────────────────────────────────────────────────────────────────
function Minimap({ shipsRef, myUuidRef, cratesRef, minesRef }) {
  const canvasRef = useRef();
  useEffect(() => {
    let raf;
    const draw = () => {
      const c = canvasRef.current;
      if (!c) { raf = requestAnimationFrame(draw); return; }
      const ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      const toMap = (x, z) => ({
        mx: ((x + ARENA_RADIUS) / (ARENA_RADIUS * 2)) * W,
        my: H - ((z + ARENA_RADIUS) / (ARENA_RADIUS * 2)) * H,
      });

      ctx.fillStyle = '#0a3038';
      ctx.fillRect(0, 0, W, H);

      // Arena ring
      ctx.strokeStyle = '#FFD60A55';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, W / 2 - 4, 0, Math.PI * 2);
      ctx.stroke();

      // Crates
      const crates = cratesRef.current || [];
      for (const c2 of crates) {
        if (!c2.alive) continue;
        const { mx, my } = toMap(c2.x, c2.z);
        ctx.fillStyle = WEAPONS[c2.type]?.color || '#FFD60A';
        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mines
      const mines = minesRef.current || [];
      for (const m of mines) {
        if (!m.alive) continue;
        const { mx, my } = toMap(m.x, m.z);
        ctx.fillStyle = '#FF3B30';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
      }

      // Ships
      const ships = shipsRef.current || {};
      const myUuid = myUuidRef.current;
      for (const s of Object.values(ships)) {
        if (!s.alive) continue;
        const { mx, my } = toMap(s.x, s.z);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(mx, my, s.uuid === myUuid ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (s.uuid === myUuid) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [shipsRef, myUuidRef, cratesRef, minesRef]);

  return (
    <div style={{
      background: 'rgba(13,13,26,0.75)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: 12,
      padding: 8,
      backdropFilter: 'blur(8px)',
    }}>
      <canvas ref={canvasRef} width={160} height={160} style={{ display: 'block', borderRadius: 8 }} />
    </div>
  );
}

// ── Weapon slot ──────────────────────────────────────────────────────────────
function WeaponSlot({ weapon, uses }) {
  if (!weapon || weapon === 'default') {
    return (
      <div style={{
        background: 'rgba(13,13,26,0.85)',
        border: '1.5px solid rgba(255,255,255,0.18)',
        borderRadius: 14, padding: '10px 14px',
        backdropFilter: 'blur(8px)', minWidth: 200,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>⚓</div>
        <div>
          <div style={{ fontSize: 10, color: '#8c80fc', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Weapon</div>
          <div style={{ fontSize: 14, color: '#ffffff', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Bow Cannon</div>
        </div>
      </div>
    );
  }
  const w = WEAPONS[weapon];
  return (
    <div style={{
      background: 'rgba(13,13,26,0.92)',
      border: `2px solid ${w.color}`,
      borderRadius: 14, padding: '10px 14px',
      backdropFilter: 'blur(8px)', minWidth: 200,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 0 20px ${w.color}55`,
      animation: 'weapon-pulse 1.4s ease-in-out infinite',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8,
        background: `${w.color}33`,
        border: `1px solid ${w.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 18, color: w.color,
      }}>{uses}</div>
      <div>
        <div style={{ fontSize: 10, color: w.color, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          {uses === 1 ? '1 shot left' : `${uses} shots`}
        </div>
        <div style={{ fontSize: 14, color: '#ffffff', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{w.label}</div>
      </div>
      <style jsx>{`
        @keyframes weapon-pulse {
          0%, 100% { box-shadow: 0 0 20px ${w.color}55; }
          50%      { box-shadow: 0 0 32px ${w.color}88; }
        }
      `}</style>
    </div>
  );
}

// ── Player roster (top right) ────────────────────────────────────────────────
function PlayerRoster({ ships, myUuid }) {
  const list = Object.values(ships)
    .sort((a, b) => (b.kills || 0) - (a.kills || 0));
  return (
    <div style={{
      background: 'rgba(13,13,26,0.78)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: 12, padding: '10px 12px',
      backdropFilter: 'blur(8px)', minWidth: 180,
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ fontSize: 10, color: '#8c80fc', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>
        Captains
      </div>
      {list.map((s) => (
        <div key={s.uuid} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
          opacity: (s.lives || 0) > 0 ? 1 : 0.4,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, flexShrink: 0 }} />
          <span style={{
            fontSize: 13, color: s.uuid === myUuid ? '#FFD60A' : '#ffffff',
            fontWeight: s.uuid === myUuid ? 700 : 500, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: (s.lives || 0) <= 0 ? 'line-through' : 'none',
          }}>
            {s.name}
          </span>
          <span style={{ color: '#FF3B30', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
            {'♥'.repeat(Math.max(0, s.lives || 0))}
          </span>
          <span style={{ color: '#FFD60A', fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 700, width: 18, textAlign: 'right' }}>
            {s.kills || 0}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PlunderHUD({
  me, ships, myUuid,
  shipsRef, myUuidRef, cratesRef, minesRef,
}) {
  if (!me) return null;
  return (
    <>
      {/* Bottom-left: weapon slot */}
      <div style={{ position: 'absolute', bottom: 70, left: 16, zIndex: 5 }}>
        <WeaponSlot weapon={me.weapon || 'default'} uses={me.weaponUses || 0} />
      </div>

      {/* Bottom-right: minimap + roster */}
      <div style={{
        position: 'absolute', bottom: 70, right: 16, zIndex: 5,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
      }}>
        <Minimap
          shipsRef={shipsRef}
          myUuidRef={myUuidRef}
          cratesRef={cratesRef}
          minesRef={minesRef}
        />
        <PlayerRoster ships={ships} myUuid={myUuid} />
      </div>
    </>
  );
}
