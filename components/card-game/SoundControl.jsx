import { useState, useEffect, useRef } from 'react';
import { isMuted, getVolume, setVolume, toggleMuted } from '../../lib/sound';

export default function SoundControl({ gameColor, panel, panelBorder, textDim, text }) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(0.6);
  const wrapRef = useRef(null);

  useEffect(() => {
    setMuted(isMuted());
    setVol(getVolume());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const effectiveOff = muted || vol === 0;
  const icon = effectiveOff ? '🔇' : vol < 0.34 ? '🔈' : vol < 0.67 ? '🔉' : '🔊';

  const onSlide = (e) => {
    const v = Number(e.target.value) / 100;
    setVolume(v);
    setVol(v);
    if (v > 0) setMuted(false);
  };

  const onToggleMute = () => setMuted(toggleMuted());

  return (
    <div ref={wrapRef} style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 301 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 50, left: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: panel, border: `1px solid ${panelBorder}`,
          borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
        }}>
          <button
            onClick={onToggleMute}
            title={muted ? 'Unmute' : 'Mute'}
            style={{ background: 'none', border: 'none', color: textDim, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            {effectiveOff ? '🔇' : '🔊'}
          </button>
          <input
            type="range" min={0} max={100}
            value={Math.round((muted ? 0 : vol) * 100)}
            onChange={onSlide}
            style={{ width: 110, accentColor: gameColor, cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: text, width: 30, textAlign: 'right' }}>
            {Math.round((muted ? 0 : vol) * 100)}
          </span>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        title="Sound"
        style={{
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: open ? gameColor : panel,
          border: `2px solid ${open ? gameColor : panelBorder}`,
          color: open ? '#fff' : textDim, fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', transition: 'background-color 0.2s, border-color 0.2s',
        }}
      >
        {icon}
      </button>
    </div>
  );
}
