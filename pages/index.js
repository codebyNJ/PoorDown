import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import IdentityModal from '../components/ui/IdentityModal';

const GAMES = [
  {
    id: 'monopoly',
    name: 'Monopoly',
    asset: '/assets/coin.svg',
    description: 'Buy properties, collect rent, and bankrupt your friends.',
    color: '#4a4aff',
    glow: 'rgba(74,74,255,0.35)',
    available: true,
  },
  {
    id: 'ludo',
    name: 'Ludo',
    asset: '/assets/controller.svg',
    description: 'Race your tokens home before your opponents.',
    color: '#ff4d56',
    glow: 'rgba(255,77,86,0.35)',
    available: false,
  },
  {
    id: 'fifty-second-test',
    name: 'The 50 Second Test',
    asset: '/assets/cd.svg',
    description: "Roll a die. Draw from a 52-card deck. That's it.",
    color: '#03deca',
    glow: 'rgba(3,222,202,0.35)',
    available: true,
  },
  {
    id: 'codenames',
    name: 'Codenames',
    asset: '/assets/diamond.svg',
    description: 'Two teams. 25 words. Give one-word clues to find your agents before they do.',
    color: '#f143ae',
    glow: 'rgba(241,67,174,0.35)',
    available: true,
  },
  {
    id: 'flip-7',
    name: 'Flip 7',
    asset: '/assets/flip7.svg',
    description: 'Press your luck. Collect 7 unique numbers. Bust and score zero. First to 200 wins.',
    color: '#FF6B35',
    glow: 'rgba(255,107,53,0.35)',
    available: true,
  },
  {
    id: 'uno',
    name: 'UNO',
    asset: '/assets/uno.svg',
    description: 'Match colors and numbers. Play your last card to win. First to 500 points takes it all.',
    color: '#E53935',
    glow: 'rgba(229,57,53,0.35)',
    available: true,
  },
  {
    id: 'plunder',
    name: 'Pirate Smash',
    asset: '/kenney_pirate-kit/Previews/ship-pirate-medium.png',
    description: '3D arena ship-battler. 3 lives, weapon crates, last ship floating wins. Up to 6 captains.',
    color: '#1A6B7A',
    glow: 'rgba(26,107,122,0.45)',
    available: true,
  },
];

const TOKEN_ICONS = {
  hat: '🎩', car: '🚗', dog: '🐶', iron: '🧲',
  ship: '🚢', boot: '👟', thimble: '🪡', wheelbarrow: '🛒',
};

const FLOATING_ASSETS = [
  { src: '/assets/arcade.svg', style: { top: '8%', left: '4%', width: 72, opacity: 0.12, transform: 'rotate(-15deg)' } },
  { src: '/assets/gameboy.svg', style: { top: '15%', right: '5%', width: 64, opacity: 0.1, transform: 'rotate(12deg)' } },
  { src: '/assets/mushroom.svg', style: { top: '55%', left: '2%', width: 52, opacity: 0.1, transform: 'rotate(8deg)' } },
  { src: '/assets/vr.svg', style: { top: '72%', right: '3%', width: 68, opacity: 0.1, transform: 'rotate(-10deg)' } },
  { src: '/assets/heart_bar.svg', style: { top: '38%', right: '6%', width: 56, opacity: 0.08, transform: 'rotate(5deg)' } },
  { src: '/assets/blue_plus.svg', style: { top: '88%', left: '8%', width: 40, opacity: 0.12, transform: 'rotate(-5deg)' } },
  { src: '/assets/yellow_plus.svg', style: { top: '25%', left: '8%', width: 36, opacity: 0.1, transform: 'rotate(20deg)' } },
  { src: '/assets/purple_plus.svg', style: { top: '80%', right: '8%', width: 38, opacity: 0.1, transform: 'rotate(-18deg)' } },
];

export default function Home() {
  const router = useRouter();
  const [identity, setIdentity] = useState(null);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('poordown_identity');
    if (stored) {
      try {
        setIdentity(JSON.parse(stored));
      } catch {
        setShowIdentityModal(true);
      }
    } else {
      setShowIdentityModal(true);
    }
    try {
      const room = JSON.parse(localStorage.getItem('poordown_active_room'));
      if (room) {
        if (!room.lastSeen || Date.now() - room.lastSeen > 60 * 60 * 1000) {
          localStorage.removeItem('poordown_active_room');
        } else {
          setActiveRoom(room);
        }
      }
    } catch {}
  }, []);

  const handleIdentityComplete = (newIdentity) => {
    setIdentity(newIdentity);
    setShowIdentityModal(false);
    const redirect = localStorage.getItem('poordown_redirect');
    if (redirect) {
      localStorage.removeItem('poordown_redirect');
      router.push(redirect);
    }
  };

  return (
    <>
      <Head>
        <title>PoorDown - Online Board Games</title>
        <meta name="description" content="Play Monopoly, Ludo and more with friends online. Free, no account needed." />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </Head>

      <IdentityModal isOpen={showIdentityModal} onComplete={handleIdentityComplete} />

      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0d0d1a',
          padding: '60px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative floating assets */}
        {FLOATING_ASSETS.map((asset, i) => (
          <img
            key={i}
            src={asset.src}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', pointerEvents: 'none', userSelect: 'none', ...asset.style }}
          />
        ))}

        {/* Ambient glow blobs */}
        <div style={{ position: 'absolute', top: '-80px', left: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,74,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '-100px', width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(241,67,174,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '16px', position: 'relative', zIndex: 1 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
            <img src="/assets/gameboy_1.svg" alt="" aria-hidden="true" style={{ width: 48, opacity: 0.9 }} />
            <h1
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontSize: '64px',
                fontWeight: '800',
                color: '#ffffff',
                margin: 0,
                letterSpacing: '-2px',
              }}
            >
              Poor<span style={{ color: '#f143ae' }}>Down</span>
            </h1>
            <img src="/assets/gameboy_1.svg" alt="" aria-hidden="true" style={{ width: 48, opacity: 0.9, transform: 'scaleX(-1)' }} />
          </div>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '18px',
              color: '#8c80fc',
              margin: 0,
            }}
          >
            Pick a game and play with friends — no account needed.
          </p>
        </motion.div>

        {/* Identity chip */}
        {identity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              backgroundColor: '#1e1e38',
              borderRadius: '100px',
              padding: '6px 14px 6px 10px',
              border: '1px solid rgba(139,128,252,0.2)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {identity.token && (
              <span style={{ fontSize: '16px', lineHeight: 1 }}>
                {TOKEN_ICONS[identity.token] ?? '🎩'}
              </span>
            )}
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#8c80fc' }}>
              Playing as
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
              {identity.name}
            </span>
            <button
              onClick={() => setShowIdentityModal(true)}
              title="Change name"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '13px',
                color: '#8c80fc',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f143ae')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8c80fc')}
            >
              ✏️
            </button>
          </motion.div>
        )}

        {/* Active room chip */}
        {activeRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '10px',
              backgroundColor: '#1e1e38',
              borderRadius: '100px',
              padding: '6px 8px 6px 14px',
              border: '1px solid rgba(139,128,252,0.2)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#8c80fc' }}>
              {activeRoom.gameName}
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: '700', color: '#ffffff', letterSpacing: '1.5px' }}>
              {activeRoom.roomCode}
            </span>
            <button
              onClick={() => router.push(`/${activeRoom.gameId}/room/${activeRoom.roomCode}${activeRoom.isHost ? '?host=true' : ''}`)}
              style={{
                background: '#4a4aff',
                border: 'none',
                borderRadius: '100px',
                cursor: 'pointer',
                padding: '4px 12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: '700',
                color: 'white',
                lineHeight: 1.4,
              }}
            >
              Resume →
            </button>
            <button
              onClick={() => { localStorage.removeItem('poordown_active_room'); setActiveRoom(null); }}
              title="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px 2px 0',
                fontSize: '14px',
                color: 'rgba(139,128,252,0.5)',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4d56')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(139,128,252,0.5)')}
            >
              ×
            </button>
          </motion.div>
        )}

        {/* Game cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
            maxWidth: '860px',
            width: '100%',
            marginTop: '56px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {GAMES.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
              onClick={() => game.available && router.push(`/${game.id}`)}
              whileHover={game.available ? { y: -6, boxShadow: `0 20px 60px ${game.glow}` } : {}}
              whileTap={game.available ? { scale: 0.98 } : {}}
              style={{
                backgroundColor: '#1e1e38',
                borderRadius: '20px',
                padding: '36px 28px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: `1px solid rgba(139,128,252,0.15)`,
                cursor: game.available ? 'pointer' : 'default',
                opacity: game.available ? 1 : 0.5,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Card glow accent line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: game.available ? game.color : 'rgba(139,128,252,0.2)', borderRadius: '20px 20px 0 0' }} />

              {!game.available && (
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    backgroundColor: 'rgba(139,128,252,0.15)',
                    color: '#8c80fc',
                    fontSize: '10px',
                    fontWeight: '700',
                    fontFamily: 'Inter, sans-serif',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    border: '1px solid rgba(139,128,252,0.2)',
                  }}
                >
                  Coming Soon
                </div>
              )}

              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: game.color + '22',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px',
                  border: `1px solid ${game.color}33`,
                }}
              >
                <img src={game.asset} alt={game.name} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              </div>

              <h2
                style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 8px 0',
                }}
              >
                {game.name}
              </h2>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: '#8c80fc',
                  margin: '0 0 20px 0',
                  lineHeight: '1.6',
                }}
              >
                {game.description}
              </p>

              {game.available && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    backgroundColor: game.color,
                    color: 'white',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: `0 4px 16px ${game.glow}`,
                  }}
                >
                  Play Now →
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <footer
          style={{
            marginTop: '80px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            color: 'rgba(139,128,252,0.5)',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Open Source • Built with Next.js • No servers, no accounts
        </footer>
      </div>
    </>
  );
}
