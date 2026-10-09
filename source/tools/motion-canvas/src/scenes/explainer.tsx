/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

import {
  Circle,
  Code,
  LezerHighlighter,
  Line,
  Node,
  Rect,
  Txt,
  blur,
  lines,
  word,
  makeScene2D,
} from '@motion-canvas/2d';
import {
  DEFAULT,
  all,
  createRef,
  createRefArray,
  createSignal,
  delay,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  linear,
  sequence,
  waitFor,
} from '@motion-canvas/core';
import {HighlightStyle} from '@codemirror/language';
import {tags as t} from '@lezer/highlight';
import {parser} from '@lezer/javascript';

// Palette
const INK = '#0b0b10';
const PANEL = '#13131b';
const CORAL = '#ff5a36';
const AMBER = '#ffb020';
const CYAN = '#2bc4e6';
const VIOLET = '#7a5cff';
const CREAM = '#f4efe6';
const MONO = 'Cascadia Mono';
const DISPLAY = 'Bahnschrift';

// Syntax colors mapped onto the reel palette.
const style = HighlightStyle.define([
  {tag: t.keyword, color: CORAL},
  {tag: [t.function(t.variableName), t.function(t.propertyName)], color: CYAN},
  {tag: t.definition(t.variableName), color: CREAM},
  {tag: t.typeName, color: VIOLET},
  {tag: t.propertyName, color: CYAN},
  {tag: t.variableName, color: CREAM},
  {tag: [t.punctuation, t.bracket, t.operator], color: '#f4efe699'},
  {tag: t.string, color: AMBER},
  {tag: t.lineComment, color: '#f4efe666'},
]);
const highlighter = new LezerHighlighter(parser.configure({dialect: 'ts'}), style);

const BEFORE = `async function loadUsers(ids: string[]) {
  const users = [];
  for (const id of ids) {
    users.push(await fetchUser(id));
  }
  return users;
}`;

const AFTER = `async function loadUsers(ids: string[]) {
  // fire every request at once
  return Promise.all(ids.map(fetchUser));
}`;

// Network timeline geometry (inside the right panel)
const TRACK_X = -110; // left edge of the time axis
const UNIT = 100; // px per 120 ms request
const ROW_Y = [-60, 0, 60];
const BAR_COLORS = [CORAL, AMBER, CYAN];

export default makeScene2D(function* (view) {
  view.fill(INK);

  const code = createRef<Code>();
  const codePanel = createRef<Rect>();
  const netPanel = createRef<Rect>();
  const bars = createRefArray<Rect>();
  const playhead = createRef<Line>();
  const mode = createRef<Txt>();
  const badge = createRef<Rect>();
  const glowA = createRef<Circle>();
  const glowB = createRef<Circle>();
  const total = createSignal(0);
  const head = createSignal(0);

  view.add(
    <>
      <Circle ref={glowA} size={560} x={-520} y={-300} fill={VIOLET} opacity={0.32} filters={[blur(120)]} />
      <Circle ref={glowB} size={480} x={560} y={330} fill={CORAL} opacity={0.22} filters={[blur(120)]} />

      <Txt x={-590} y={-292} offset={[-1, 0]} text={'CODE EXPLAINER  /  ASYNC TS'} fontFamily={MONO} fontSize={15} letterSpacing={4} fill={AMBER} />
      <Txt x={-592} y={-246} offset={[-1, 0]} fontFamily={DISPLAY} fontWeight={700} fontSize={46} fill={CREAM}>
        {'Sequential awaits  →  '}
      </Txt>
      <Txt x={-150} y={-246} offset={[-1, 0]} fontFamily={DISPLAY} fontWeight={700} fontSize={46} fill={CYAN} text={'Promise.all'} />

      {/* Code panel */}
      <Rect ref={codePanel} x={-227} y={45} width={730} height={400} radius={18} fill={PANEL} stroke={'#f4efe61f'} lineWidth={1.5} shadowColor={'#00000099'} shadowBlur={60} shadowOffsetY={24}>
        <Circle x={-335} y={-176} size={12} fill={CORAL} />
        <Circle x={-315} y={-176} size={12} fill={AMBER} />
        <Circle x={-295} y={-176} size={12} fill={CYAN} />
        <Txt x={-265} y={-176} offset={[-1, 0]} text={'users.ts'} fontFamily={MONO} fontSize={14} fill={'#f4efe680'} />
        <Line points={[[-365, -152], [365, -152]]} stroke={'#f4efe617'} lineWidth={1} />
        <Code
          ref={code}
          x={-335}
          y={-122}
          offset={[-1, -1]}
          fontFamily={MONO}
          fontSize={26}
          lineHeight={43}
          highlighter={highlighter}
          code={BEFORE}
        />
      </Rect>

      {/* Network timeline panel */}
      <Rect ref={netPanel} x={378} y={45} width={420} height={400} radius={18} fill={PANEL} stroke={'#f4efe61f'} lineWidth={1.5} shadowColor={'#00000099'} shadowBlur={60} shadowOffsetY={24}>
        <Txt x={-180} y={-160} offset={[-1, 0]} text={'NETWORK'} fontFamily={MONO} fontSize={14} letterSpacing={3} fill={'#f4efe680'} />
        <Txt ref={mode} x={180} y={-160} offset={[1, 0]} text={'SEQUENTIAL'} fontFamily={MONO} fontSize={14} letterSpacing={3} fill={AMBER} />
        {ROW_Y.map((y, i) => (
          <Node>
            <Txt x={-180} y={y - 2} offset={[-1, 0]} text={`user ${i + 1}`} fontFamily={MONO} fontSize={15} fill={'#f4efe6b3'} />
            <Rect x={TRACK_X} y={y} offset={[-1, 0]} width={UNIT * 3} height={26} radius={7} fill={'#f4efe60d'} />
            <Rect ref={bars} x={TRACK_X + i * UNIT} y={y} offset={[-1, 0]} width={0} height={26} radius={7} fill={BAR_COLORS[i]} />
          </Node>
        ))}
        {[0, 1, 2, 3].map(i => (
          <Node>
            <Line points={[[TRACK_X + i * UNIT, 96], [TRACK_X + i * UNIT, 104]]} stroke={'#f4efe64d'} lineWidth={1.5} />
            <Txt x={TRACK_X + i * UNIT} y={120} text={`${i * 120}`} fontFamily={MONO} fontSize={12} fill={'#f4efe666'} />
          </Node>
        ))}
        <Line points={[[TRACK_X, 100], [TRACK_X + UNIT * 3, 100]]} stroke={'#f4efe633'} lineWidth={1.5} />
        <Line ref={playhead} x={() => TRACK_X + head()} points={[[0, -96], [0, 100]]} stroke={CREAM} lineWidth={2} lineDash={[4, 5]} opacity={0} />
        <Txt x={-180} y={162} offset={[-1, 0]} text={'total'} fontFamily={MONO} fontSize={16} fill={'#f4efe680'} />
        <Txt x={180} y={160} offset={[1, 0]} text={() => `${Math.round(total())} ms`} fontFamily={DISPLAY} fontWeight={700} fontSize={40} fill={CREAM} />
      </Rect>

      <Rect ref={badge} x={512} y={-188} width={170} height={52} radius={26} fill={CORAL} scale={0} rotation={-6} shadowColor={'#ff5a3680'} shadowBlur={30}>
        <Txt text={'3x faster'} fontFamily={DISPLAY} fontWeight={700} fontSize={26} fill={INK} />
      </Rect>
    </>,
  );

  // Slow ambient drift under everything.
  yield glowA().position([-380, -220], 7.5, linear);
  yield glowB().position([420, 260], 7.5, linear);

  // Panels rise in.
  codePanel().opacity(0).y(85);
  netPanel().opacity(0).y(85);
  yield* all(
    codePanel().opacity(1, 0.6, easeOutCubic),
    codePanel().y(45, 0.7, easeOutCubic),
    delay(0.12, all(netPanel().opacity(1, 0.6, easeOutCubic), netPanel().y(45, 0.7, easeOutCubic))),
  );

  // 1. Highlight the loop that awaits one request at a time.
  yield* code().selection(lines(2, 4), 0.5);

  // 2. Requests run back to back: the playhead sweeps 360 ms.
  playhead().opacity(1);
  yield* all(
    head(UNIT * 3, 1.5, linear),
    total(360, 1.5, linear),
    sequence(0.5, ...bars.map(b => b.width(UNIT - 4, 0.5, linear))),
  );
  yield* waitFor(0.25);

  // 3. Morph the code into the parallel version; reset the timeline.
  yield* all(
    code().selection(DEFAULT, 0.4),
    code().code(AFTER, 1.0, easeInOutCubic),
    mode().text('PARALLEL', 0.6),
    mode().fill(CYAN, 0.6),
    head(0, 0.6, easeInOutCubic),
    total(0, 0.6, easeInOutCubic),
    ...bars.map(b => all(b.width(0, 0.4, easeInOutCubic), b.x(TRACK_X, 0.6, easeInOutCubic))),
  );

  // 4. Highlight Promise.all, then all three requests fire together.
  yield* code().selection(word(2, 9, 31), 0.5);
  yield* all(
    head(UNIT, 0.6, linear),
    total(120, 0.6, linear),
    ...bars.map(b => b.width(UNIT - 4, 0.6, linear)),
  );

  // 5. Payoff badge, then let the result breathe.
  yield* all(badge().scale(1, 0.5, easeOutBack), badge().rotation(4, 0.5, easeOutCubic));
  yield* waitFor(0.9);
  yield* all(code().selection(DEFAULT, 0.6), badge().rotation(0, 0.6));
  yield* waitFor(0.55);
});
