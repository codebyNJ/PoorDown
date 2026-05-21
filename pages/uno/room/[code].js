import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { startHand, endHand, canPlayCard, drawFromDeck } from '../../../lib/games/uno/state';
import { handPoints } from '../../../lib/games/uno/deck';
import GameShell from '../../../components/card-game/GameShell';
import GameHeader from '../../../components/card-game/GameHeader';
import ScoreboardSidebar from '../../../components/card-game/ScoreboardSidebar';
import MyHand from '../../../components/card-game/MyHand';
import OpponentSeat from '../../../components/card-game/OpponentSeat';
import RulesButton from '../../../components/card-game/RulesButton';
import CardTable from '../../../components/card-game/CardTable';
import SeatFan from '../../../components/card-game/SeatFan';
import SoundControl from '../../../components/card-game/SoundControl';
import { playDraw, playYourTurn, playBust, playRoundStart, playRoundEnd } from '../../../lib/sound';

const GAME_COLOR = '#E53935';
const GAME_GLOW = 'rgba(229,57,53,0.4)';
const BG = '#0a0f1e';
const SURFACE = '#0f1729';
const PANEL = '#162037';
const PANEL_DARK = '#080c17';
const PANEL_BORDER = 'rgba(100,130,220,0.25)';
const TEXT = '#e8e4f0';
const TEXT_DIM = '#6070aa';
const GOLD = '#c8983a';

const PLAYER_COLORS = [
  '#FF3B30', '#0A84FF', '#30D158', '#FFD60A',
  '#BF5AF2', '#32D2D0', '#FF9F0A', '#FF375F',
];

const CARD_BG = {
  red: '#C62828', yellow: '#F9A825', green: '#2E7D32', blue: '#1565C0',
};
const COLOR_LABEL = { red: 'Red', yellow: 'Yellow', green: 'Green', blue: 'Blue' };

function mod(n, m) { return ((n % m) + m) % m; }

function cardSymbol(card) {
  if (card.type === 'number') return String(card.value);
  if (card.type === 'skip') return '⊘';
  if (card.type === 'reverse') return '↺';
  if (card.type === 'draw-two') return '+2';
  if (card.type === 'wild') return 'W';
  if (card.type === 'wild-draw-four') return '+4';
  return '?';
}

// ── UnoCard ───────────────────────────────────────────────────────────────────

function UnoCard({ card, playable, onClick, large, small, dimmed, draggable: isDraggable, onDragStart }) {
  const [hov, setHov] = useState(false);
  const w = large ? 96 : small ? 38 : 72;
  const h = large ? 144 : small ? 56 : 108;
  const r = large ? 14 : small ? 8 : 10;
  const isWild = card.type === 'wild' || card.type === 'wild-draw-four';
  const bg = isWild ? '#1a1a2e' : (CARD_BG[card.color] || '#333');
  const sym = cardSymbol(card);
  const symSize = card.type === 'number'
    ? (large ? 50 : small ? 16 : 34)
    : (large ? 32 : small ? 12 : 22);
  const isInteractive = playable || isDraggable;

  return (
    <div
      draggable={isDraggable || false}
      onDragStart={onDragStart}
      onClick={playable ? onClick : undefined}
      onMouseEnter={() => isInteractive && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: w, height: h, borderRadius: r,
        backgroundColor: bg,
        border: `2px solid ${hov && isInteractive ? '#fff' : 'rgba(255,255,255,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: isInteractive ? 'pointer' : 'default',
        opacity: dimmed ? 0.38 : 1,
        transform: hov && isInteractive ? 'translateY(-22px) scale(1.08)' : 'none',
        boxShadow: hov && isInteractive
          ? `0 20px 40px rgba(0,0,0,0.8), 0 0 28px ${bg}99`
          : '0 3px 10px rgba(0,0,0,0.55)',
        transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s, border-color 0.1s',
        flexShrink: 0, position: 'relative', overflow: 'hidden',
        animation: large ? 'cardDrop 0.45s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}
    >
      {isWild && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '50%', backgroundColor: CARD_BG.red }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '50%', backgroundColor: CARD_BG.yellow }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '50%', height: '50%', backgroundColor: CARD_BG.green }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '50%', height: '50%', backgroundColor: CARD_BG.blue }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#1a1a2e', borderRadius: '50%', width: '62%', height: '62%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '900', fontSize: large ? 16 : small ? 7 : 13, color: 'white', textAlign: 'center', lineHeight: 1 }}>
                {card.type === 'wild-draw-four' ? '+4' : 'W'}
              </span>
            </div>
          </div>
        </>
      )}
      {!isWild && (
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '70%', height: '85%', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.13)', transform: 'rotate(-30deg)' }} />
          </div>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '900', fontSize: symSize, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}>
            {sym}
          </span>
        </>
      )}
    </div>
  );
}

// ── Card back ─────────────────────────────────────────────────────────────────

function CardBack({ large, small }) {
  const w = large ? 96 : small ? 38 : 72;
  const h = large ? 144 : small ? 56 : 108;
  return (
    <div style={{
      width: w, height: h, borderRadius: large ? 14 : 8,
      backgroundColor: '#12183a',
      border: `2px solid ${GAME_COLOR}44`,
      backgroundImage: `repeating-linear-gradient(45deg, ${GAME_COLOR}09 0px, ${GAME_COLOR}09 2px, transparent 2px, transparent 10px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 3px 10px rgba(0,0,0,0.55)', flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '900', fontSize: large ? 16 : small ? 7 : 13, color: `${GAME_COLOR}88`, letterSpacing: '1px' }}>UNO</span>
    </div>
  );
}

// ── Other player panel ────────────────────────────────────────────────────────

function OtherPlayer({ player, isActive, color, canCallOut, onCallOut }) {
  const count = player.hand.length;
  return (
    <div style={{
      backgroundColor: isActive ? PANEL : SURFACE,
      border: `2px solid ${isActive ? color : PANEL_BORDER}`,
      borderTop: `4px solid ${color}`,
      borderRadius: 12, padding: '10px 14px', minWidth: 130, flexShrink: 0,
      boxShadow: isActive ? `0 0 20px ${color}55` : '0 4px 12px rgba(0,0,0,0.4)',
      transition: 'border-color 0.25s, box-shadow 0.25s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{player.name}</span>
        {isActive && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0, animation: 'blink 1s infinite' }} />}
        {count === 1 && !canCallOut && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: '800', color: GAME_COLOR, backgroundColor: `${GAME_COLOR}22`, padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>UNO!</span>}
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
        {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
          <CardBack key={i} small />
        ))}
        {count > 6 && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: TEXT_DIM, marginLeft: 2, alignSelf: 'center' }}>+{count - 6}</span>}
        {count === 0 && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: TEXT_DIM }}>No cards</span>}
      </div>
      {canCallOut && (
        <button
          onClick={onCallOut}
          style={{
            marginTop: 8, width: '100%', padding: '5px 0',
            backgroundColor: `${GAME_COLOR}20`,
            border: `1px solid ${GAME_COLOR}88`,
            borderRadius: 6,
            fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: '700',
            color: GAME_COLOR, cursor: 'pointer',
            animation: 'calloutPulse 1.4s ease-in-out infinite',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${GAME_COLOR}40`; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${GAME_COLOR}20`; }}
        >
          Call out! (+2)
        </button>
      )}
    </div>
  );
}

// ── Color chooser ─────────────────────────────────────────────────────────────

function ColorChooser({ onChoose }) {
  const colors = ['red', 'yellow', 'green', 'blue'];
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ backgroundColor: PANEL, border: `1px solid ${PANEL_BORDER}`, borderRadius: 20, padding: '28px 32px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
        <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 18, color: TEXT, margin: '0 0 20px 0' }}>Choose a color</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {colors.map(c => (
            <button
              key={c}
              onClick={() => onChoose(c)}
              style={{
                width: 80, height: 80, borderRadius: 14,
                backgroundColor: CARD_BG[c],
                border: '3px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: '700', color: 'white',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
            >
              {COLOR_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Rules panel ───────────────────────────────────────────────────────────────

const RULES = [
  { title: 'Goal', body: 'Be the first to empty your hand each round. The winner collects points from all other players\' remaining cards. First to 500 cumulative points wins.' },
  { title: 'Setup', body: 'Each player is dealt 7 cards. The top card of the draw pile is flipped to start the discard pile.' },
  { title: 'On your turn', body: 'Play a card by clicking it or dragging it onto the discard pile. The card must match the current color or type. If you can\'t play, draw one card and your turn ends.' },
  { title: 'Matching', body: 'A card can be played if it matches the current color OR the type/value of the top discard card. Wild cards can always be played.' },
  { title: 'Skip ⊘', body: 'The next player in sequence loses their turn.' },
  { title: 'Reverse ↺', body: 'Reverses the direction of play. In a 2-player game it acts like a Skip.' },
  { title: 'Draw Two +2', body: 'The next player must draw 2 cards and loses their turn.' },
  { title: 'Wild W', body: 'Play on any card. You choose the new active color.' },
  { title: 'Wild Draw Four +4', body: 'Play on any card. You choose the new color AND the next player draws 4 and loses their turn.' },
  { title: 'UNO!', body: 'When you reach 1 card, hit the "UNO!" button immediately. If another player spots you haven\'t called it, they can press "Call out!" on your panel — you\'ll draw 2 penalty cards.' },
  { title: 'Scoring', body: 'Number cards = face value · Skip / Reverse / Draw Two = 20 pts · Wild / Wild Draw Four = 50 pts.' },
];

function RulesPanel({ open, onClose }) {
  return (
    <div style={{ position: 'fixed', bottom: 68, right: 20, zIndex: 300, width: 340, maxHeight: open ? '70vh' : 0, overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}>
      <div style={{ backgroundColor: PANEL, border: `1px solid ${GAME_COLOR}55`, borderRadius: '16px 16px 4px 16px', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)', maxHeight: '70vh', overflowY: 'auto', scrollbarWidth: 'thin' }}>
        <div style={{ position: 'sticky', top: 0, backgroundColor: PANEL, padding: '16px 18px 12px', borderBottom: `1px solid ${PANEL_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 16, color: TEXT }}>📖 How to Play</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>×</button>
        </div>
        <div style={{ padding: '14px 18px 20px' }}>
          {RULES.map((r, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: '700', fontSize: 12, color: GAME_COLOR, margin: '0 0 3px 0' }}>{r.title}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT_DIM, margin: 0, lineHeight: 1.65 }}>{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UnoRoom() {
  const router = useRouter();
  const { code } = router.query;

  const [myUuid, setMyUuid] = useState(null);
  const [peers, setPeers] = useState(0);
  const [copied, setCopied] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [showRules, setShowRules] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [gameState, setGameState] = useState({
    phase: 'connecting', players: [], deck: [], discardPile: [],
    currentPlayerIdx: 0, direction: 1, currentColor: null,
    pendingAction: null, cumulativeScores: {}, winner: null,
    winnerUuid: null, roundNum: 0, hostId: null, unoStatus: {},
  });

  const metaRef = useRef(null);
  const yLobbyRef = useRef(null);
  const hasJoinedRef = useRef(false);
  // Tracks last-seen synced state to fire sound effects on transitions
  const soundPrevRef = useRef(null);

  // ── Y.js setup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!code || typeof window === 'undefined') return;

    const stored = localStorage.getItem('poordown_identity');
    const identity = stored ? JSON.parse(stored) : null;
    if (!identity) {
      localStorage.setItem('poordown_redirect', window.location.pathname + window.location.search);
      router.push('/');
      return;
    }
    setMyUuid(identity.uuid);

    const isHost = new URLSearchParams(window.location.search).get('host') === 'true';
    const doc = new Y.Doc();
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:4444';
    const provider = new WebrtcProvider(`poordown-uno-${code}`, doc, {
      signaling: [signalingUrl],
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
      maxConns: 10,
    });

    provider.awareness.setLocalStateField('player', { uuid: identity.uuid });
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values());
      setPeers(states.filter(s => s.player?.uuid && s.player.uuid !== identity.uuid).length);
    });

    const meta = doc.getMap('meta');
    const yLobby = doc.getArray('lobbyPlayers');
    metaRef.current = meta;
    yLobbyRef.current = yLobby;

    if (isHost && !meta.get('hostId')) {
      meta.set('hostId', identity.uuid);
      meta.set('phase', 'lobby');
      meta.set('cumulativeScores', '{}');
      meta.set('roundNum', 0);
    }

    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true;
      const existing = yLobby.toArray();
      if (!existing.find(p => p.uuid === identity.uuid)) {
        yLobby.push([{ uuid: identity.uuid, name: identity.name }]);
      }
    }

    const syncMeta = () => {
      setGameState({
        phase: meta.get('phase') || (isHost ? 'lobby' : 'connecting'),
        players: JSON.parse(meta.get('players') || '[]'),
        deck: JSON.parse(meta.get('deck') || '[]'),
        discardPile: JSON.parse(meta.get('discardPile') || '[]'),
        currentPlayerIdx: meta.get('currentPlayerIdx') ?? 0,
        direction: meta.get('direction') ?? 1,
        currentColor: meta.get('currentColor') || null,
        pendingAction: meta.get('pendingAction') ? JSON.parse(meta.get('pendingAction')) : null,
        cumulativeScores: JSON.parse(meta.get('cumulativeScores') || '{}'),
        winner: meta.get('winner') || null,
        winnerUuid: meta.get('winnerUuid') || null,
        roundNum: meta.get('roundNum') ?? 0,
        hostId: meta.get('hostId') || null,
        unoStatus: JSON.parse(meta.get('unoStatus') || '{}'),
      });
    };

    const syncLobby = () => {
      const all = yLobby.toArray();
      const seen = new Set();
      setLobbyPlayers(all.filter(p => { if (seen.has(p.uuid)) return false; seen.add(p.uuid); return true; }));
    };

    meta.observe(syncMeta);
    yLobby.observe(syncLobby);
    syncMeta();
    syncLobby();

    return () => {
      meta.unobserve(syncMeta);
      yLobby.unobserve(syncLobby);
      provider.destroy();
      doc.destroy();
    };
  }, [code]);

  // Fire sound effects on transitions of the synced game state (all clients react)
  useEffect(() => {
    if (!myUuid) return;
    const { phase, players, discardPile, currentPlayerIdx, pendingAction } = gameState;
    const active = players[currentPlayerIdx];
    const myTurn = !pendingAction && active?.uuid === myUuid;
    const handSizes = {};
    players.forEach(p => { handSizes[p.uuid] = p.hand.length; });
    const snapshot = { phase, discardLen: discardPile.length, myTurn, handSizes };

    const prev = soundPrevRef.current;
    soundPrevRef.current = snapshot;
    if (!prev) return; // skip the first sync (initial load / join)

    let roundJustStarted = false;
    if (prev.phase !== 'playing' && phase === 'playing') {
      playRoundStart();
      roundJustStarted = true;
    } else if (prev.phase === 'playing' && (phase === 'hand-end' || phase === 'game-over')) {
      playRoundEnd();
    }

    if (phase === 'playing' && prev.phase === 'playing') {
      let penalty = false, drew = false;
      for (const p of players) {
        const before = prev.handSizes[p.uuid];
        if (before === undefined) continue;
        const delta = p.hand.length - before;
        if (delta >= 2) penalty = true;       // Draw Two / Draw Four / call-out
        else if (delta >= 1) drew = true;     // single draw
      }
      if (penalty) playBust();
      else if (snapshot.discardLen > prev.discardLen || drew) playDraw();
    }

    if (myTurn && !prev.myTurn && !roundJustStarted) playYourTurn();
  }, [gameState, myUuid]);

  useEffect(() => {
    const refresh = () => {
      const stored = localStorage.getItem('poordown_active_room');
      if (!stored) return;
      try {
        const room = JSON.parse(stored);
        localStorage.setItem('poordown_active_room', JSON.stringify({ ...room, lastSeen: Date.now() }));
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Game logic ───────────────────────────────────────────────────────────────

  const handlePlayCard = useCallback((cardId) => {
    const meta = metaRef.current;
    if (!meta) return;

    let players = JSON.parse(meta.get('players') || '[]');
    let deck = JSON.parse(meta.get('deck') || '[]');
    let discardPile = JSON.parse(meta.get('discardPile') || '[]');
    const currentIdx = meta.get('currentPlayerIdx') ?? 0;
    const direction = meta.get('direction') ?? 1;
    const currentColor = meta.get('currentColor');
    const n = players.length;

    const player = { ...players[currentIdx], hand: [...players[currentIdx].hand] };
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;
    const card = player.hand[cardIdx];

    const topCard = discardPile[discardPile.length - 1];
    if (!canPlayCard(card, topCard, currentColor)) return;

    player.hand.splice(cardIdx, 1);
    discardPile.push(card);
    players[currentIdx] = player;

    if (player.hand.length === 0) {
      meta.set('players', JSON.stringify(players));
      meta.set('discardPile', JSON.stringify(discardPile));
      meta.set('deck', JSON.stringify(deck));
      endHand(meta, players, JSON.parse(meta.get('cumulativeScores') || '{}'));
      return;
    }

    // Player must call UNO manually when reaching 1 card
    if (player.hand.length === 1) {
      const unoStatus = JSON.parse(meta.get('unoStatus') || '{}');
      unoStatus[player.uuid] = false;
      meta.set('unoStatus', JSON.stringify(unoStatus));
    }

    const newColor = card.color || currentColor;
    const nextIdx = mod(currentIdx + direction, n);
    const skipIdx = mod(currentIdx + 2 * direction, n);

    if (card.type === 'skip') {
      meta.set('players', JSON.stringify(players));
      meta.set('discardPile', JSON.stringify(discardPile));
      meta.set('currentColor', newColor);
      meta.set('currentPlayerIdx', skipIdx);
      return;
    }

    if (card.type === 'reverse') {
      const newDir = -direction;
      meta.set('direction', newDir);
      meta.set('currentColor', newColor);
      meta.set('players', JSON.stringify(players));
      meta.set('discardPile', JSON.stringify(discardPile));
      if (n !== 2) meta.set('currentPlayerIdx', mod(currentIdx + newDir, n));
      return;
    }

    if (card.type === 'draw-two') {
      const { drawn, deck: d2, discardPile: dp2 } = drawFromDeck(deck, discardPile, 2);
      players[nextIdx] = { ...players[nextIdx], hand: [...players[nextIdx].hand, ...drawn] };
      meta.set('players', JSON.stringify(players));
      meta.set('discardPile', JSON.stringify(dp2));
      meta.set('deck', JSON.stringify(d2));
      meta.set('currentColor', newColor);
      meta.set('currentPlayerIdx', skipIdx);
      return;
    }

    if (card.type === 'wild' || card.type === 'wild-draw-four') {
      meta.set('players', JSON.stringify(players));
      meta.set('discardPile', JSON.stringify(discardPile));
      meta.set('pendingAction', JSON.stringify({
        type: 'choose-color',
        playerIdx: currentIdx,
        isDrawFour: card.type === 'wild-draw-four',
      }));
      return;
    }

    meta.set('players', JSON.stringify(players));
    meta.set('discardPile', JSON.stringify(discardPile));
    meta.set('currentColor', newColor);
    meta.set('currentPlayerIdx', nextIdx);
  }, []);

  const handleChooseColor = useCallback((color) => {
    const meta = metaRef.current;
    if (!meta) return;
    const pending = JSON.parse(meta.get('pendingAction') || 'null');
    if (!pending || pending.type !== 'choose-color') return;

    const { playerIdx, isDrawFour } = pending;
    const direction = meta.get('direction') ?? 1;
    const n = JSON.parse(meta.get('players') || '[]').length;

    meta.set('currentColor', color);
    meta.set('pendingAction', null);

    const nextIdx = mod(playerIdx + direction, n);
    const skipIdx = mod(playerIdx + 2 * direction, n);

    if (isDrawFour) {
      let players = JSON.parse(meta.get('players') || '[]');
      const { drawn, deck: d2, discardPile: dp2 } = drawFromDeck(
        JSON.parse(meta.get('deck') || '[]'),
        JSON.parse(meta.get('discardPile') || '[]'),
        4
      );
      players[nextIdx] = { ...players[nextIdx], hand: [...players[nextIdx].hand, ...drawn] };
      meta.set('players', JSON.stringify(players));
      meta.set('deck', JSON.stringify(d2));
      meta.set('discardPile', JSON.stringify(dp2));
      meta.set('currentPlayerIdx', skipIdx);
    } else {
      meta.set('currentPlayerIdx', nextIdx);
    }
  }, []);

  const handleDraw = useCallback(() => {
    const meta = metaRef.current;
    if (!meta) return;
    let players = JSON.parse(meta.get('players') || '[]');
    const currentIdx = meta.get('currentPlayerIdx') ?? 0;
    const direction = meta.get('direction') ?? 1;
    const n = players.length;

    const { drawn, deck: d2, discardPile: dp2 } = drawFromDeck(
      JSON.parse(meta.get('deck') || '[]'),
      JSON.parse(meta.get('discardPile') || '[]'),
      1
    );
    if (drawn.length > 0) {
      players[currentIdx] = { ...players[currentIdx], hand: [...players[currentIdx].hand, ...drawn] };
    }
    meta.set('players', JSON.stringify(players));
    meta.set('deck', JSON.stringify(d2));
    meta.set('discardPile', JSON.stringify(dp2));
    meta.set('currentPlayerIdx', mod(currentIdx + direction, n));
  }, []);

  const handleCallUno = useCallback(() => {
    const meta = metaRef.current;
    if (!meta || !myUuid) return;
    const unoStatus = JSON.parse(meta.get('unoStatus') || '{}');
    unoStatus[myUuid] = true;
    meta.set('unoStatus', JSON.stringify(unoStatus));
  }, [myUuid]);

  const handleCallOut = useCallback((targetUuid) => {
    const meta = metaRef.current;
    if (!meta) return;
    const unoStatus = JSON.parse(meta.get('unoStatus') || '{}');
    if (unoStatus[targetUuid]) return;
    let players = JSON.parse(meta.get('players') || '[]');
    const targetIdx = players.findIndex(p => p.uuid === targetUuid);
    if (targetIdx === -1 || players[targetIdx].hand.length !== 1) return;
    const { drawn, deck: d2, discardPile: dp2 } = drawFromDeck(
      JSON.parse(meta.get('deck') || '[]'),
      JSON.parse(meta.get('discardPile') || '[]'),
      2
    );
    players[targetIdx] = { ...players[targetIdx], hand: [...players[targetIdx].hand, ...drawn] };
    unoStatus[targetUuid] = true;
    meta.set('players', JSON.stringify(players));
    meta.set('deck', JSON.stringify(d2));
    meta.set('discardPile', JSON.stringify(dp2));
    meta.set('unoStatus', JSON.stringify(unoStatus));
  }, []);

  const handleStartHand = useCallback(() => {
    const meta = metaRef.current;
    const yLobby = yLobbyRef.current;
    if (!meta || !yLobby) return;
    const all = yLobby.toArray();
    const seen = new Set();
    const unique = all.filter(p => { if (seen.has(p.uuid)) return false; seen.add(p.uuid); return true; });
    startHand(meta, unique);
  }, []);

  const handleNextHand = useCallback(() => {
    const meta = metaRef.current;
    const yLobby = yLobbyRef.current;
    if (!meta || !yLobby) return;
    const all = yLobby.toArray();
    const seen = new Set();
    startHand(meta, all.filter(p => { if (seen.has(p.uuid)) return false; seen.add(p.uuid); return true; }));
  }, []);

  const handlePlayAgain = useCallback(() => {
    const meta = metaRef.current;
    if (!meta) return;
    meta.set('cumulativeScores', '{}');
    meta.set('winner', null);
    meta.set('winnerUuid', null);
    meta.set('roundNum', 0);
    meta.set('nextHandStartIdx', 0);
    meta.set('unoStatus', '{}');
    meta.set('phase', 'lobby');
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/uno/room/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDropOnPile = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) handlePlayCard(cardId);
  }, [handlePlayCard]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const { phase, players, discardPile, currentPlayerIdx, direction, currentColor, pendingAction, cumulativeScores, winner, winnerUuid, roundNum, hostId, unoStatus } = gameState;

  const isHost = myUuid === hostId;
  const myPlayer = players.find(p => p.uuid === myUuid);
  const activePlayer = players[currentPlayerIdx];
  const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isMyTurn = !pendingAction && activePlayer?.uuid === myUuid;
  const isMyPendingColor = pendingAction?.type === 'choose-color' && players[pendingAction.playerIdx]?.uuid === myUuid;
  const winnerPlayer = winner
    ? (players.find(p => p.uuid === winner) || lobbyPlayers.find(p => p.uuid === winner))
    : null;
  const handWinnerPlayer = winnerUuid
    ? (players.find(p => p.uuid === winnerUuid) || lobbyPlayers.find(p => p.uuid === winnerUuid))
    : null;
  const myNeedsUno = myPlayer?.hand.length === 1 && unoStatus[myUuid] === false;

  // ── Header ────────────────────────────────────────────────────────────────────

  const HeaderBar = () => (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 48, paddingLeft: 16, paddingRight: 16, borderBottom: `1px solid ${PANEL_BORDER}`, flexShrink: 0, backgroundColor: PANEL_DARK }}>
      <button onClick={() => router.push('/uno')} style={{ background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4, zIndex: 1 }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>← Leave</button>
      {/* Center logo */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <img src="/assets/uno.svg" alt="" style={{ width: 22 }} />
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 16, color: TEXT }}><span style={{ color: GAME_COLOR }}>U</span>NO</span>
        {roundNum > 0 && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: TEXT_DIM, backgroundColor: SURFACE, padding: '2px 8px', borderRadius: 5, border: `1px solid ${PANEL_BORDER}` }}>Hand {roundNum}</span>}
      </div>
      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: TEXT_DIM, letterSpacing: '1px' }}>{code}</span>
        <button onClick={copyLink} style={{ padding: '4px 10px', border: `1px solid ${copied ? GOLD : PANEL_BORDER}`, borderRadius: 6, backgroundColor: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: 11, color: copied ? GOLD : TEXT_DIM, cursor: 'pointer' }}>{copied ? 'Copied!' : 'Copy link'}</button>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: `${TEXT_DIM}66` }}>{peers === 0 ? '—' : `${peers} other${peers === 1 ? '' : 's'}`}</span>
      </div>
    </div>
  );

  const soundControl = (
    <SoundControl gameColor={GAME_COLOR} panel={PANEL} panelBorder={PANEL_BORDER} textDim={TEXT_DIM} text={TEXT} />
  );

  // ── LOBBY ─────────────────────────────────────────────────────────────────────

  if (phase === 'connecting' || phase === 'lobby') {
    const canStart = isHost && lobbyPlayers.length >= 2;
    return (
      <>
        <Head><title>Room {code} — UNO</title></Head>
        <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', flexDirection: 'column' }}>
          <HeaderBar />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <img src="/assets/uno.svg" alt="" style={{ width: 44, marginBottom: 10, display: 'block', margin: '0 auto 10px', filter: `drop-shadow(0 0 12px ${GAME_GLOW})` }} />
                <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 22, color: TEXT, margin: '0 0 4px 0' }}>
                  {phase === 'connecting' ? 'Connecting...' : 'Waiting for players'}
                </h2>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT_DIM, margin: 0 }}>Share the room code · Need 2–10 players</p>
              </div>

              <div style={{ backgroundColor: PANEL, borderRadius: 16, border: `1px solid ${PANEL_BORDER}`, padding: 20, marginBottom: 12 }}>
                {lobbyPlayers.map((p, i) => (
                  <div key={p.uuid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', backgroundColor: SURFACE, borderRadius: 10, border: `1px solid ${PANEL_BORDER}`, marginBottom: i < lobbyPlayers.length - 1 ? 6 : 0 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: TEXT, fontWeight: p.uuid === myUuid ? '700' : '400', flex: 1 }}>{p.name}</span>
                    {p.uuid === hostId && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: GAME_COLOR, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Host</span>}
                    {p.uuid === myUuid && p.uuid !== hostId && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: TEXT_DIM }}>you</span>}
                  </div>
                ))}
                {lobbyPlayers.length === 0 && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: `${TEXT_DIM}55`, textAlign: 'center', margin: 0 }}>Connecting...</p>}
              </div>

              {isHost ? (
                <button onClick={handleStartHand} disabled={!canStart}
                  style={{ width: '100%', padding: 14, backgroundColor: canStart ? GAME_COLOR : 'rgba(139,128,252,0.12)', color: canStart ? '#fff' : 'rgba(139,128,252,0.35)', border: 'none', borderRadius: 12, fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: '700', cursor: canStart ? 'pointer' : 'not-allowed', boxShadow: canStart ? `0 4px 16px ${GAME_GLOW}` : 'none' }}
                >
                  {canStart ? 'Start Game →' : `Need ${Math.max(0, 2 - lobbyPlayers.length)} more player${lobbyPlayers.length < 1 ? 's' : ''}`}
                </button>
              ) : (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#8c80fc', textAlign: 'center' }}>Waiting for host to start...</p>
              )}
            </div>
          </div>
        </div>
        {soundControl}
      </>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────────

  if (phase === 'playing') {
    const myIdx = players.findIndex(p => p.uuid === myUuid);
    const otherPlayers = myIdx === -1
      ? players.filter(p => p.uuid !== myUuid)
      : [...players.slice(myIdx + 1), ...players.slice(0, myIdx)];

    const unoCssAnimations = `
      @keyframes cardDrop {
        0%   { transform: scale(0.55) translateY(-40px) rotate(-18deg); opacity: 0; }
        60%  { transform: scale(1.1) translateY(4px) rotate(3deg); opacity: 1; }
        80%  { transform: scale(0.97) translateY(-2px) rotate(-1deg); opacity: 1; }
        100% { transform: scale(1) translateY(0) rotate(0deg); opacity: 1; }
      }
      @keyframes deckPulse { 0%, 100% { filter: drop-shadow(0 0 8px ${GAME_GLOW}); } 50% { filter: drop-shadow(0 0 22px ${GAME_GLOW}); } }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
      @keyframes unoPulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 10px ${GAME_GLOW}; }
        50% { transform: scale(1.07); box-shadow: 0 0 32px ${GAME_GLOW}, 0 0 60px ${GAME_GLOW}; }
      }
      @keyframes calloutPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.65; }
      }
    `;

    const unoCenter = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {/* Draw pile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div onClick={isMyTurn ? handleDraw : undefined} style={{ cursor: isMyTurn ? 'pointer' : 'default', position: 'relative' }}>
            <div style={{ position: 'relative', filter: isMyTurn ? `drop-shadow(0 0 18px ${GAME_GLOW})` : 'none', animation: isMyTurn ? 'deckPulse 2.5s ease-in-out infinite' : 'none' }}>
              <CardBack large />
            </div>
            <div style={{ position: 'absolute', bottom: -6, right: -8, backgroundColor: GAME_COLOR, color: '#fff', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: '700', padding: '2px 7px', borderRadius: 10, border: `2px solid ${BG}` }}>
              {gameState.deck.length}
            </div>
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: isMyTurn ? GAME_COLOR : TEXT_DIM, fontWeight: isMyTurn ? '700' : '400' }}>
            {isMyTurn ? '↑ DRAW' : 'DECK'}
          </span>
        </div>

        {/* Turn direction indicator */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${GAME_COLOR}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GAME_COLOR, fontSize: 20, fontWeight: '700', transform: direction === -1 ? 'scaleX(-1)' : 'scaleX(1)', transition: 'transform 0.4s ease', boxShadow: `0 0 12px ${GAME_COLOR}44` }}>
          ↺
        </div>

        {/* Discard pile — drop zone */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}
          onDragOver={isMyTurn ? (e => { e.preventDefault(); setIsDragOver(true); }) : undefined}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={isMyTurn ? handleDropOnPile : undefined}
        >
          {currentColor && (
            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: CARD_BG[currentColor], boxShadow: `0 0 16px ${CARD_BG[currentColor]}`, marginBottom: -4 }} />
          )}
          {topCard && <UnoCard key={topCard.id} card={topCard} large />}
          {!topCard && <div style={{ width: 96, height: 144, borderRadius: 14, border: `2px dashed ${PANEL_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: TEXT_DIM, fontSize: 11 }}>Empty</span></div>}
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: TEXT_DIM }}>
            {currentColor ? COLOR_LABEL[currentColor] : '—'} active
          </span>
          {isDragOver && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `3px dashed ${GAME_COLOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${GAME_COLOR}15` }}>
              <span style={{ color: GAME_COLOR, fontWeight: '700', fontSize: 13 }}>Drop!</span>
            </div>
          )}
        </div>
      </div>
    );

    const unoMyHand = (
      <div style={{ padding: '4px 16px 0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {myPlayer ? (
          <MyHand
            cards={myPlayer.hand}
            isMyTurn={isMyTurn}
            handStyle="fan"
            panelDark={PANEL_DARK}
            panelBorder={PANEL_BORDER}
            textDim={TEXT_DIM}
            renderCard={(card, i, { hovered }) => {
              const playable = isMyTurn && !pendingAction && canPlayCard(card, topCard, currentColor);
              const dimmed = isMyTurn && !pendingAction && !playable;
              return (
                <UnoCard
                  card={card}
                  playable={playable}
                  dimmed={dimmed}
                  onClick={() => handlePlayCard(card.id)}
                  draggable={playable}
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', card.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                />
              );
            }}
          />
        ) : (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: `${TEXT_DIM}55` }}>Connecting...</span>
          </div>
        )}
      </div>
    );

    const unoActionBar = (
      <div style={{ backgroundColor: 'rgba(8,12,20,0.55)', backdropFilter: 'blur(6px)', border: `1px solid ${PANEL_BORDER}`, borderRadius: 999, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.55)' }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isMyTurn && !pendingAction && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: GAME_COLOR, fontWeight: '700' }}>Your turn</span>}
          {!isMyTurn && !pendingAction && activePlayer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: GAME_COLOR, animation: 'blink 1s infinite' }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT_DIM }}><span style={{ color: TEXT, fontWeight: '700' }}>{activePlayer.name}</span> is playing...</span>
            </div>
          )}
          {pendingAction?.type === 'choose-color' && !isMyPendingColor && (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT_DIM }}><span style={{ color: TEXT, fontWeight: '700' }}>{players[pendingAction.playerIdx]?.name}</span> is choosing a color...</span>
          )}
        </div>
        {/* Card count */}
        {myPlayer && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: TEXT_DIM }}>{myPlayer.hand.length} card{myPlayer.hand.length !== 1 ? 's' : ''}</span>}
        {/* Buttons */}
        {isMyTurn && !pendingAction && (
          <button onClick={handleDraw} style={{ padding: '7px 18px', backgroundColor: SURFACE, border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: '600', color: TEXT_DIM, cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.borderColor = TEXT_DIM; e.currentTarget.style.color = TEXT; }} onMouseLeave={e => { e.currentTarget.style.borderColor = PANEL_BORDER; e.currentTarget.style.color = TEXT_DIM; }}>
            Draw Card
          </button>
        )}
        {myNeedsUno && (
          <button onClick={handleCallUno} style={{ padding: '7px 24px', backgroundColor: GAME_COLOR, border: 'none', borderRadius: 8, fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: '900', color: '#fff', cursor: 'pointer', letterSpacing: '2px', animation: 'unoPulse 0.9s ease-in-out infinite', boxShadow: `0 0 24px ${GAME_GLOW}` }}>
            UNO!
          </button>
        )}
        {myPlayer?.hand.length === 1 && unoStatus[myUuid] === true && (
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 14, color: GAME_COLOR }}>UNO called!</span>
        )}
        {isMyTurn && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: `${TEXT_DIM}88` }}>drag or click</span>}
      </div>
    );

    const unoHeader = (
      <GameHeader
        onLeave={() => router.push('/uno')}
        icon={<img src="/assets/uno.svg" alt="" style={{ width: 22 }} />}
        name={<><span style={{ color: GAME_COLOR }}>U</span>NO</>}
        roundLabel={roundNum > 0 ? `Hand ${roundNum}` : null}
        code={code}
        copied={copied}
        onCopy={copyLink}
        peers={peers}
        panelDark={PANEL_DARK}
        panelBorder={PANEL_BORDER}
        text={TEXT}
        textDim={TEXT_DIM}
        gameColor={GAME_COLOR}
        gold={GOLD}
        surface={SURFACE}
      />
    );

    const renderUnoOpponent = (opponent, seatIdx, seatConfig) => {
      const pi = players.findIndex(pl => pl.uuid === opponent.uuid);
      const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
      const isActive = !pendingAction && pi === currentPlayerIdx;
      const canCallOut = opponent.hand.length === 1 && unoStatus[opponent.uuid] === false;
      const avatarSize = seatConfig.avatarSize || 56;
      const fanCardW = seatConfig.fanCardW || 56;
      const fanCardH = seatConfig.fanCardH || 84;

      return (
        <div style={{
          display: 'flex',
          flexDirection: seatConfig.layout === 'col' ? 'column' : seatConfig.layout === 'row' ? 'row' : 'row-reverse',
          alignItems: 'center',
          gap: 8,
        }}>
          <SeatFan count={opponent.hand.length} color={color} fanRotation={seatConfig.fanRotation} cardWidth={fanCardW} cardHeight={fanCardH} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: avatarSize, height: avatarSize, borderRadius: '50%',
              backgroundColor: color,
              border: `3px solid ${isActive ? GAME_COLOR : 'transparent'}`,
              boxShadow: isActive ? `0 0 26px ${GAME_COLOR}99` : '0 2px 10px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isActive ? 'blink 2s ease-in-out infinite' : 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '900', fontSize: Math.round(avatarSize * 0.33), color: '#fff' }}>
                {opponent.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: isActive ? TEXT : TEXT_DIM, fontWeight: isActive ? '700' : '400', textShadow: '0 1px 4px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>
              {opponent.name}
            </span>
            {opponent.hand.length === 1 && unoStatus[opponent.uuid] === false && (
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: '800', color: GAME_COLOR, backgroundColor: `${GAME_COLOR}22`, padding: '2px 6px', borderRadius: 4 }}>UNO!</span>
            )}
            {canCallOut && (
              <button onClick={() => handleCallOut(opponent.uuid)} style={{ padding: '4px 10px', backgroundColor: `${GAME_COLOR}22`, border: `1px solid ${GAME_COLOR}77`, borderRadius: 4, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: '700', color: GAME_COLOR, cursor: 'pointer', animation: 'calloutPulse 1.4s ease-in-out infinite' }}>
                Call out!
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <>
        <Head><title>Room {code} — UNO</title></Head>
        <CardTable
          bg={BG}
          tableColor="#0d4022"
          tableRim="#4a2e0a"
          header={unoHeader}
          opponents={otherPlayers}
          renderOpponent={renderUnoOpponent}
          center={unoCenter}
          myHand={unoMyHand}
          actionBar={unoActionBar}
          overlay={isMyPendingColor ? <ColorChooser onChoose={handleChooseColor} /> : null}
          rulesButton={
            <RulesButton
              open={showRules}
              onToggle={() => setShowRules(v => !v)}
              onClose={() => setShowRules(false)}
              sections={RULES}
              gameColor={GAME_COLOR}
              panel={PANEL}
              panelBorder={PANEL_BORDER}
              textDim={TEXT_DIM}
              text={TEXT}
            />
          }
          cssAnimations={unoCssAnimations}
        />
        {soundControl}
      </>
    );
  }

  // ── HAND END ──────────────────────────────────────────────────────────────────

  if (phase === 'hand-end') {
    const sortedScores = Object.entries(cumulativeScores).sort(([, a], [, b]) => b - a);
    const prevHandPoints = (uuid) => {
      const p = players.find(pl => pl.uuid === uuid);
      if (!p) return 0;
      return players.filter(pl => pl.uuid !== uuid).reduce((s, pl) => s + handPoints(pl.hand), 0);
    };

    return (
      <>
        <Head><title>Hand {roundNum} Over — UNO</title></Head>
        <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', flexDirection: 'column' }}>
          <HeaderBar />
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ maxWidth: 500, width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎴</div>
                <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 28, color: TEXT, margin: '0 0 4px 0' }}>
                  {handWinnerPlayer?.name || '?'} went out!
                </h1>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: TEXT_DIM, margin: 0 }}>
                  +{prevHandPoints(winnerUuid)} points · Hand {roundNum}
                </p>
              </div>

              <div style={{ backgroundColor: PANEL, borderRadius: 14, border: `1px solid ${PANEL_BORDER}`, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ padding: '10px 18px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: '700', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Remaining Cards</p>
                </div>
                {players.map((p, i) => (
                  <div key={p.uuid} style={{ padding: '12px 18px', borderBottom: i < players.length - 1 ? `1px solid ${PANEL_BORDER}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT, fontWeight: p.uuid === myUuid ? '700' : '400', flex: 1 }}>{p.name}</span>
                    {p.hand.length === 0
                      ? <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: '700', color: GAME_COLOR, backgroundColor: `${GAME_COLOR}22`, padding: '2px 8px', borderRadius: 4 }}>UNO OUT</span>
                      : <>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-end' }}>
                            {p.hand.slice(0, 8).map(c => <UnoCard key={c.id} card={c} small />)}
                            {p.hand.length > 8 && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: TEXT_DIM, alignSelf: 'center' }}>+{p.hand.length - 8}</span>}
                          </div>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: '700', color: GOLD, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>+{handPoints(p.hand)}</span>
                        </>
                    }
                  </div>
                ))}
              </div>

              <div style={{ backgroundColor: PANEL, borderRadius: 14, border: `1px solid ${PANEL_BORDER}`, overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '10px 18px', borderBottom: `1px solid ${PANEL_BORDER}` }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: '700', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Race to 500</p>
                </div>
                {sortedScores.map(([uuid, score], i) => {
                  const p = players.find(pl => pl.uuid === uuid) || lobbyPlayers.find(pl => pl.uuid === uuid);
                  const pi = players.findIndex(pl => pl.uuid === uuid);
                  return (
                    <div key={uuid} style={{ padding: '10px 18px', borderBottom: i < sortedScores.length - 1 ? `1px solid ${PANEL_BORDER}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PLAYER_COLORS[pi >= 0 ? pi % PLAYER_COLORS.length : 0] }} />
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: uuid === myUuid ? TEXT : TEXT_DIM, fontWeight: uuid === myUuid ? '700' : '400' }}>{p?.name}</span>
                        </div>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: '700', color: score >= 400 ? GOLD : TEXT }}>{score} <span style={{ fontSize: 10, color: TEXT_DIM, fontWeight: '400' }}>/ 500</span></span>
                      </div>
                      <div style={{ height: 5, backgroundColor: SURFACE, borderRadius: 3 }}>
                        <div style={{ height: 5, backgroundColor: PLAYER_COLORS[pi >= 0 ? pi % PLAYER_COLORS.length : 0], borderRadius: 3, width: `${Math.min(score / 500, 1) * 100}%`, transition: 'width 0.7s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {isHost
                ? <button onClick={handleNextHand} style={{ width: '100%', padding: 14, backgroundColor: GAME_COLOR, color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: '700', cursor: 'pointer', boxShadow: `0 4px 16px ${GAME_GLOW}` }}>Next Hand →</button>
                : <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT_DIM, textAlign: 'center' }}>Waiting for host to start next hand...</p>
              }
            </div>
          </div>
        </div>
        <button onClick={() => setShowRules(v => !v)} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 301, width: 40, height: 40, borderRadius: '50%', backgroundColor: showRules ? GAME_COLOR : PANEL, border: `2px solid ${showRules ? GAME_COLOR : PANEL_BORDER}`, color: showRules ? '#fff' : TEXT_DIM, fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', transition: 'background-color 0.2s' }}>?</button>
        <RulesPanel open={showRules} onClose={() => setShowRules(false)} />
        {soundControl}
        <style>{`
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        `}</style>
      </>
    );
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────────

  if (phase === 'game-over') {
    const sortedScores = Object.entries(cumulativeScores).sort(([, a], [, b]) => b - a);
    return (
      <>
        <Head><title>Game Over — UNO</title></Head>
        <div style={{ minHeight: '100vh', backgroundColor: BG, display: 'flex', flexDirection: 'column' }}>
          <HeaderBar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
            <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
              <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: '800', fontSize: 36, color: GOLD, margin: '0 0 6px 0' }}>{winnerPlayer?.name || '?'}</h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 15, color: TEXT_DIM, margin: '0 0 32px 0' }}>reached 500 in Hand {roundNum}</p>

              <div style={{ backgroundColor: PANEL, borderRadius: 14, border: `1px solid ${PANEL_BORDER}`, overflow: 'hidden', marginBottom: 24 }}>
                {sortedScores.map(([uuid, score], i) => {
                  const p = players.find(pl => pl.uuid === uuid) || lobbyPlayers.find(pl => pl.uuid === uuid);
                  const pi = players.findIndex(pl => pl.uuid === uuid);
                  return (
                    <div key={uuid} style={{ padding: '14px 18px', borderBottom: i < sortedScores.length - 1 ? `1px solid ${PANEL_BORDER}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: '800', color: i === 0 ? GOLD : TEXT_DIM, width: 28, flexShrink: 0, textAlign: 'left' }}>
                        {['🥇', '🥈', '🥉'][i] || `${i + 1}.`}
                      </span>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: PLAYER_COLORS[pi >= 0 ? pi % PLAYER_COLORS.length : 0], flexShrink: 0 }} />
                      <span style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 14, color: TEXT, fontWeight: uuid === myUuid ? '700' : '400', textAlign: 'left' }}>
                        {p?.name}{uuid === myUuid ? ' (you)' : ''}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: '800', color: i === 0 ? GOLD : TEXT, flexShrink: 0 }}>{score}</span>
                    </div>
                  );
                })}
              </div>

              {isHost
                ? <button onClick={handlePlayAgain} style={{ width: '100%', padding: 14, backgroundColor: GAME_COLOR, color: '#fff', border: 'none', borderRadius: 12, fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: '700', cursor: 'pointer', boxShadow: `0 4px 16px ${GAME_GLOW}` }}>Play Again →</button>
                : <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT_DIM }}>Waiting for host to start a new game...</p>
              }
            </div>
          </div>
        </div>
        <button onClick={() => setShowRules(v => !v)} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 301, width: 40, height: 40, borderRadius: '50%', backgroundColor: showRules ? GAME_COLOR : PANEL, border: `2px solid ${showRules ? GAME_COLOR : PANEL_BORDER}`, color: showRules ? '#fff' : TEXT_DIM, fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', transition: 'background-color 0.2s' }}>?</button>
        <RulesPanel open={showRules} onClose={() => setShowRules(false)} />
        {soundControl}
      </>
    );
  }

  return null;
}
