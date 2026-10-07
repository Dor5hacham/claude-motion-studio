import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  bg: '#0b0b10',
  coral: '#ff5a36',
  amber: '#ffb020',
  cyan: '#2bc4e6',
  violet: '#7a5cff',
  cream: '#f4efe6',
};
const DISPLAY = 'Bahnschrift, "Segoe UI", sans-serif';
const MONO = '"Cascadia Mono", Consolas, monospace';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Slow drifting colour blobs behind everything.
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const blob = (color: string, x: number, y: number, r: number, phase: number) => {
    const dx = Math.sin(frame / 40 + phase) * 60;
    const dy = Math.cos(frame / 55 + phase) * 40;
    return (
      <div
        style={{
          position: 'absolute',
          left: x + dx - r,
          top: y + dy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}55 0%, ${color}00 70%)`,
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      {blob(C.violet, 200, 160, 420, 0)}
      {blob(C.coral, 1120, 600, 380, 2)}
      {blob(C.cyan, 900, 80, 300, 4)}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(244,239,230,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(244,239,230,0.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </AbsoluteFill>
  );
};

// One word that springs up from behind a mask.
const Word: React.FC<{ text: string; delay: number; color?: string }> = ({ text, delay, color = C.cream }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: 6 }}>
      <span
        style={{
          display: 'inline-block',
          transform: `translateY(${interpolate(s, [0, 1], [110, 0])}%) rotate(${interpolate(s, [0, 1], [8, 0])}deg)`,
          color,
        }}
      >
        {text}&nbsp;
      </span>
    </span>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bar = spring({ frame: frame - 18, fps, config: { damping: 18 } });
  const exit = interpolate(frame, [52, 68], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        paddingLeft: 120,
        opacity: 1 - exit,
        transform: `translateY(${-exit * 120}px) scale(${1 - exit * 0.08})`,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 6, color: C.amber, marginBottom: 18 }}>
        <Word text="WEEKLY REPORT" delay={0} color={C.amber} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 112, lineHeight: 1.0, letterSpacing: -2 }}>
        <Word text="Your" delay={4} />
        <Word text="week" delay={9} />
        <br />
        <Word text="in" delay={14} />
        <Word text="numbers." delay={19} color={C.coral} />
      </div>
      <div
        style={{
          marginTop: 26,
          height: 8,
          width: 360,
          borderRadius: 4,
          background: `linear-gradient(90deg, ${C.coral}, ${C.amber})`,
          transform: `scaleX(${bar})`,
          transformOrigin: 'left',
        }}
      />
    </AbsoluteFill>
  );
};

type CardProps = {
  index: number;
  label: string;
  value: number;
  format: (v: number) => string;
  delta: string;
  accent: string;
  chart: 'line' | 'bars' | 'ring';
};

const Sparkline: React.FC<{ progress: number; color: string }> = ({ progress, color }) => {
  const pts = [8, 14, 11, 22, 19, 30, 27, 41, 38, 52, 60];
  const w = 300;
  const h = 80;
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (pts.length - 1)) * w} ${h - (p / 60) * h}`)
    .join(' ');
  const len = 520;
  return (
    <svg width={w} height={h + 6} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.35} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#spark)" opacity={progress} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
      />
    </svg>
  );
};

const Bars: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  const { fps } = useVideoConfig();
  const vals = [0.35, 0.5, 0.42, 0.66, 0.58, 0.8, 1];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 86 }}>
      {vals.map((v, i) => {
        const s = spring({ frame: frame - 14 - i * 3, fps, config: { damping: 12, stiffness: 140 } });
        return (
          <div
            key={i}
            style={{
              width: 30,
              height: 86 * v * s,
              borderRadius: 6,
              background: i === vals.length - 1 ? color : `${color}66`,
            }}
          />
        );
      })}
    </div>
  );
};

const Ring: React.FC<{ progress: number; color: string }> = ({ progress, color }) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={96} height={96} viewBox="0 0 96 96">
      <circle cx={48} cy={48} r={r} stroke="rgba(244,239,230,0.12)" strokeWidth={10} fill="none" />
      <circle
        cx={48}
        cy={48}
        r={r}
        stroke={color}
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - 0.87 * progress)}
        transform="rotate(-90 48 48)"
      />
    </svg>
  );
};

const StatCard: React.FC<CardProps> = ({ index, label, value, format, delta, accent, chart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - index * 7;
  const enter = spring({ frame: local, fps, config: { damping: 15, stiffness: 110, mass: 0.9 } });
  const exit = interpolate(frame, [100 + index * 5, 118 + index * 5], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  const count = interpolate(local, [6, 50], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const chip = spring({ frame: local - 34, fps, config: { damping: 10, stiffness: 160 } });

  return (
    <div
      style={{
        width: 340,
        height: 360,
        borderRadius: 28,
        padding: 30,
        boxSizing: 'border-box',
        background: 'linear-gradient(160deg, rgba(244,239,230,0.08), rgba(244,239,230,0.02))',
        border: '1px solid rgba(244,239,230,0.12)',
        boxShadow: `0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(244,239,230,0.08)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: enter * (1 - exit),
        transform: `translateY(${interpolate(enter, [0, 1], [140, 0]) + exit * 160}px) scale(${interpolate(
          enter,
          [0, 1],
          [0.88, 1],
        )}) rotate(${(1 - enter) * (index - 1) * 4}deg)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: 'rgba(244,239,230,0.6)' }}>{label}</div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 17,
            color: C.bg,
            background: accent,
            borderRadius: 999,
            padding: '5px 12px',
            transform: `scale(${chip})`,
          }}
        >
          {delta}
        </div>
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: -2,
          color: C.cream,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {format(value * count)}
      </div>
      <div style={{ height: 96, display: 'flex', alignItems: 'flex-end' }}>
        {chart === 'line' && <Sparkline progress={interpolate(local, [12, 56], [0, 1], clamp)} color={accent} />}
        {chart === 'bars' && <Bars frame={local} color={accent} />}
        {chart === 'ring' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring progress={interpolate(local, [10, 56], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })} color={accent} />
            <div style={{ fontFamily: DISPLAY, fontSize: 20, color: 'rgba(244,239,230,0.7)', lineHeight: 1.3 }}>
              of goal
              <br />
              reached
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Cards: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 36 }}>
    <StatCard
      index={0}
      label="VIEWS"
      value={1.24}
      format={(v) => `${v.toFixed(2)}M`}
      delta="+38%"
      accent={C.coral}
      chart="line"
    />
    <StatCard
      index={1}
      label="NEW FOLLOWERS"
      value={8420}
      format={(v) => Math.round(v).toLocaleString('en-US')}
      delta="+12%"
      accent={C.amber}
      chart="bars"
    />
    <StatCard
      index={2}
      label="WATCH TIME"
      value={87}
      format={(v) => `${Math.round(v)}%`}
      delta="+9 pts"
      accent={C.cyan}
      chart="ring"
    />
  </AbsoluteFill>
);

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ring = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const sub = interpolate(frame, [18, 32], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          border: `3px solid ${C.violet}`,
          opacity: (1 - ring) * 0.9,
          transform: `scale(${0.2 + ring * 1.4})`,
        }}
      />
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 96, letterSpacing: -2, textAlign: 'center' }}>
        <Word text="Built" delay={2} />
        <Word text="with" delay={6} />
        <Word text="React." delay={10} color={C.violet} />
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 22,
          letterSpacing: 4,
          color: 'rgba(244,239,230,0.65)',
          marginTop: 10,
          opacity: sub,
          transform: `translateY(${(1 - sub) * 14}px)`,
        }}
      >
        rendered frame by frame with Remotion
      </div>
    </AbsoluteFill>
  );
};

const Chrome: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = frame / (durationInFrames - 1);
  const secs = (frame / fps).toFixed(2).padStart(5, '0');
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 34,
          right: 44,
          fontFamily: MONO,
          fontSize: 16,
          letterSpacing: 2,
          color: 'rgba(244,239,230,0.45)',
        }}
      >
        {`00:${secs}  F${String(frame).padStart(3, '0')}`}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: 'rgba(244,239,230,0.08)' }}>
        <div
          style={{
            height: '100%',
            width: `${p * 100}%`,
            background: `linear-gradient(90deg, ${C.coral}, ${C.amber}, ${C.cyan}, ${C.violet})`,
            backgroundSize: '1280px 100%',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const StatReel: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Background />
    <Sequence durationInFrames={72}>
      <Title />
    </Sequence>
    <Sequence from={62} durationInFrames={132}>
      <Cards />
    </Sequence>
    <Sequence from={176}>
      <Outro />
    </Sequence>
    <Chrome />
  </AbsoluteFill>
);
