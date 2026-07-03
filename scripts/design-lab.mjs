/* ---------------------------------------------------------------------------
   Design lab: offline solvers used to verify every hand-authored level.
   - light:  enumerates all mirror configurations, counts solutions & near-misses
   - blend:  enumerates all anchor combinations, counts solutions
   - rings:  BFS over ring moves → minimum gestures to solve
   - lock:   BFS + counts how many reachable states open every beam

   Usage: node scripts/design-lab.mjs
   Candidate levels live at the bottom; run after every design tweak.
--------------------------------------------------------------------------- */

/* ---- light ---------------------------------------------------------------- */
// dirs: 0 E, 1 S, 2 W, 3 N
const DIRV = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function traceLight(def, orientations) {
  // orientations: Map key->'/' or '\\'
  const cellAt = new Map(def.cells.map((c) => [`${c.x},${c.y}`, c]));
  const targets = def.cells.filter((c) => c.type === 'target');
  const tIdx = new Map(targets.map((t, i) => [`${t.x},${t.y}`, i]));
  const hits = targets.map(() => []);
  const visited = new Set();

  const walk = (x, y, dir, color) => {
    let cx = x;
    let cy = y;
    let d = dir;
    let col = color;
    for (let g = 0; g < 500; g++) {
      const vk = `${cx},${cy},${d},${col ?? 'w'}`;
      if (visited.has(vk)) return;
      visited.add(vk);
      cx += DIRV[d][0];
      cy += DIRV[d][1];
      if (cx < 0 || cy < 0 || cx >= def.cols || cy >= def.rows) return;
      const cell = cellAt.get(`${cx},${cy}`);
      if (!cell) continue;
      if (cell.type === 'mirror') {
        const o = orientations.get(`${cx},${cy}`);
        d = (o === '/' ? [3, 2, 1, 0] : [1, 0, 3, 2])[d];
      } else if (cell.type === 'target') {
        hits[tIdx.get(`${cx},${cy}`)].push(col ?? 'w');
        return;
      } else if (cell.type === 'block' || cell.type === 'emitter') {
        return;
      } else if (cell.type === 'splitter') {
        walk(cx, cy, (d + 1) % 4, col);
        walk(cx, cy, (d + 3) % 4, col);
        return;
      } else if (cell.type === 'dye') {
        col = cell.color;
      }
    }
  };

  for (const c of def.cells) {
    if (c.type === 'emitter') walk(c.x, c.y, c.dir ?? 0, c.color ?? null);
  }
  return { targets, hits };
}

function lightSatisfied(targets, hits) {
  let sat = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const got = hits[i];
    if (t.need && t.need.length) {
      const set = [...new Set(got)];
      if (
        !set.includes('w') &&
        set.length === t.need.length &&
        t.need.every((c) => set.includes(c))
      )
        sat++;
    } else {
      if (got.length >= (t.hits ?? 1)) sat++;
    }
  }
  return sat;
}

export function analyzeLight(name, def) {
  const mirrors = def.cells.filter((c) => c.type === 'mirror' && !c.locked);
  const lockedM = def.cells.filter((c) => c.type === 'mirror' && c.locked);
  const n = mirrors.length;
  const targets = def.cells.filter((c) => c.type === 'target');
  let solutions = [];
  let nearMisses = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    const orient = new Map();
    mirrors.forEach((m, i) => orient.set(`${m.x},${m.y}`, mask & (1 << i) ? '/' : '\\'));
    lockedM.forEach((m) => orient.set(`${m.x},${m.y}`, m.m));
    const { targets: ts, hits } = traceLight(def, orient);
    const sat = lightSatisfied(ts, hits);
    if (sat === targets.length) solutions.push(mask);
    else if (sat === targets.length - 1) nearMisses++;
  }
  // is the initial state already solved?
  const initMask = mirrors.reduce((acc, m, i) => acc | ((m.m === '/' ? 1 : 0) << i), 0);
  const initSolved = solutions.includes(initMask);
  // flips needed from initial to nearest solution
  const flips = solutions.length
    ? Math.min(...solutions.map((s) => popcount(s ^ initMask)))
    : -1;
  console.log(
    `[light] ${name}: mirrors=${n} configs=${1 << n} solutions=${solutions.length} nearMisses=${nearMisses} initSolved=${initSolved} minFlips=${flips}`
  );
  return { solutions: solutions.length, nearMisses, initSolved, flips };
}

const popcount = (v) => {
  let c = 0;
  while (v) {
    c += v & 1;
    v >>= 1;
  }
  return c;
};

/* ---- blend ----------------------------------------------------------------- */

export function analyzeBlend(name, def) {
  const R = (d) => d.r ?? 130;
  const combos = def.disks.map((d) => d.anchors.length);
  // linked pairs share one index choice
  const groups = [];
  const seen = new Set();
  def.disks.forEach((d, i) => {
    if (seen.has(i)) return;
    if (d.link !== undefined) {
      groups.push([i, d.link]);
      seen.add(i);
      seen.add(d.link);
    } else {
      groups.push([i]);
      seen.add(i);
    }
  });
  let total = 1;
  for (const g of groups) total *= combos[g[0]];

  let solutions = 0;
  let initSolved = false;
  const idxs = new Array(def.disks.length).fill(0);
  const enumerate = (gi) => {
    if (gi === groups.length) {
      const ok = def.sockets.every((s) => {
        const cover = new Set();
        def.disks.forEach((d, di) => {
          const [ax, ay] = d.anchors[idxs[di]];
          if (Math.hypot(s.x - ax, s.y - ay) <= R(d) - 16) cover.add(d.color);
        });
        const needSet = new Set(s.need);
        if (needSet.size !== cover.size) return false;
        for (const c of needSet) if (!cover.has(c)) return false;
        return true;
      });
      if (ok) {
        solutions++;
        if (def.disks.every((d, di) => idxs[di] === d.at)) initSolved = true;
      }
      return;
    }
    const g = groups[gi];
    for (let k = 0; k < combos[g[0]]; k++) {
      for (const di of g) idxs[di] = Math.min(k, combos[di] - 1);
      enumerate(gi + 1);
    }
  };
  enumerate(0);
  console.log(
    `[blend] ${name}: combos=${total} solutions=${solutions} initSolved=${initSolved}`
  );
  return { solutions, initSolved };
}

/* ---- rings / lock ------------------------------------------------------------ */

function ringMoves(rings) {
  // move g = (ring r, turns k): offsets[r]+=k and linked +=k*ratio.
  return rings.map((r, i) => {
    const vec = rings.map(() => 0);
    vec[i] = 1;
    for (const l of r.links ?? []) vec[l.ring] += l.ratio;
    return vec;
  });
}

function applyScramble(rings, steps, scramble) {
  const moves = ringMoves(rings);
  const o = rings.map(() => 0);
  for (const [r, k] of scramble) {
    for (let i = 0; i < o.length; i++) o[i] = (o[i] + moves[r][i] * k + steps * 40) % steps;
  }
  return o;
}

/** BFS: minimum number of gestures (one ring turned any amount) to reach a goal. */
function bfsGestures(startKey, steps, moves, isGoal) {
  const n = moves.length;
  const decode = (key) => key.split(',').map(Number);
  const q = [startKey];
  const dist = new Map([[startKey, 0]]);
  while (q.length) {
    const key = q.shift();
    const o = decode(key);
    const d = dist.get(key);
    if (isGoal(o)) return d;
    for (let r = 0; r < n; r++) {
      for (let k = 1; k < steps; k++) {
        const no = o.map((v, i) => (v + moves[r][i] * k + steps * 40) % steps);
        const nk = no.join(',');
        if (!dist.has(nk)) {
          dist.set(nk, d + 1);
          q.push(nk);
        }
      }
    }
  }
  return -1;
}

export function analyzeRings(name, def) {
  const moves = ringMoves(def.rings);
  const start = applyScramble(def.rings, def.steps, def.scramble);
  const gestures = bfsGestures(
    start.join(','),
    def.steps,
    moves,
    (o) => o.every((v) => v === 0)
  );
  console.log(
    `[rings] ${name}: start=[${start}] minGestures=${gestures} ${gestures === 0 ? '!! ALREADY SOLVED' : ''}`
  );
  return gestures;
}

export function analyzeLock(name, def) {
  const moves = ringMoves(def.rings);
  const start = applyScramble(def.rings, def.steps, def.scramble);
  const opens = (o) =>
    def.beams.every((b) =>
      def.rings.every((ring, j) =>
        ring.channels.includes(((b - o[j]) % def.steps + def.steps) % def.steps)
      )
    );
  const gestures = bfsGestures(start.join(','), def.steps, moves, opens);
  // count reachable solved states (from solved state 0 explore group)
  const n = def.rings.length;
  const all = new Set();
  const q = [new Array(n).fill(0).join(',')];
  all.add(q[0]);
  while (q.length) {
    const o = q.shift().split(',').map(Number);
    for (let r = 0; r < n; r++) {
      const no = o.map((v, i) => (v + moves[r][i] + def.steps) % def.steps);
      const k = no.join(',');
      if (!all.has(k)) {
        all.add(k);
        q.push(k);
      }
    }
  }
  let solvedStates = 0;
  for (const k of all) if (opens(k.split(',').map(Number))) solvedStates++;
  console.log(
    `[lock] ${name}: reachable=${all.size} solvedStates=${solvedStates} start=[${start}] minGestures=${gestures} ${gestures === 0 ? '!! ALREADY SOLVED' : ''}`
  );
  return { gestures, solvedStates };
}

/* ============================================================================
   CANDIDATE LEVELS — keep in sync with src/levels/data.ts
============================================================================ */

// ---- Dawn ----
analyzeRings('dawn-1', {
  steps: 8,
  rings: [{ petals: [] }, { petals: [] }],
  scramble: [
    [0, 3],
    [1, -2],
  ],
});
analyzeRings('dawn-2', {
  steps: 8,
  rings: [{}, {}, {}],
  scramble: [
    [0, 2],
    [1, 5],
    [2, -3],
  ],
});
analyzeRings('dawn-3', {
  steps: 8,
  rings: [{}, { links: [{ ring: 0, ratio: 1 }] }, {}],
  scramble: [
    [1, 3],
    [0, -2],
    [2, 4],
    [1, 1],
  ],
});
analyzeRings('dawn-4', {
  steps: 10,
  rings: [
    { links: [{ ring: 1, ratio: 1 }] },
    { links: [{ ring: 2, ratio: 1 }] },
    { links: [{ ring: 0, ratio: 1 }] },
  ],
  scramble: [
    [0, 3],
    [1, -4],
    [2, 2],
    [0, 1],
  ],
});
analyzeRings('dawn-5', {
  steps: 12,
  rings: [
    {},
    { links: [{ ring: 2, ratio: -1 }] },
    { links: [{ ring: 1, ratio: -1 }] },
    { links: [{ ring: 0, ratio: 1 }] },
  ],
  scramble: [
    [1, 4],
    [3, 5],
    [0, -2],
    [1, 2],
    [3, -1],
  ],
});
analyzeRings('dawn-6', {
  steps: 12,
  rings: [
    {},
    { links: [{ ring: 2, ratio: -1 }] },
    { links: [{ ring: 3, ratio: 1 }] },
    { links: [{ ring: 1, ratio: 1 }] },
    { links: [{ ring: 0, ratio: -1 }, { ring: 2, ratio: 1 }] },
  ],
  scramble: [
    [4, 5],
    [1, -3],
    [2, 4],
    [0, 3],
    [3, -2],
    [4, 1],
  ],
});

// ---- Day ----
analyzeLight('day-4 narrow paths', {
  cols: 7,
  rows: 6,
  cells: [
    { x: 0, y: 0, type: 'emitter', dir: 0 },
    { x: 6, y: 5, type: 'emitter', dir: 2 },
    { x: 5, y: 0, type: 'mirror', m: '/' },
    { x: 5, y: 4, type: 'mirror', m: '\\' },
    { x: 1, y: 4, type: 'mirror', m: '\\', locked: true },
    { x: 1, y: 2, type: 'mirror', m: '\\' },
    { x: 2, y: 5, type: 'mirror', m: '/' },
    { x: 3, y: 2, type: 'target' },
    { x: 2, y: 3, type: 'target' },
    { x: 3, y: 3, type: 'block' },
    { x: 4, y: 3, type: 'block' },
    { x: 2, y: 1, type: 'block' },
    { x: 3, y: 1, type: 'block' },
  ],
});

analyzeLight('day-5 weaving', {
  cols: 7,
  rows: 6,
  cells: [
    { x: 0, y: 1, type: 'emitter', dir: 0 },
    { x: 1, y: 5, type: 'emitter', dir: 3 },
    { x: 2, y: 1, type: 'splitter' },
    { x: 2, y: 0, type: 'mirror', m: '\\' },
    { x: 5, y: 0, type: 'mirror', m: '/' },
    { x: 5, y: 3, type: 'mirror', m: '\\' },
    { x: 2, y: 4, type: 'mirror', m: '/' },
    { x: 1, y: 2, type: 'mirror', m: '\\' },
    { x: 3, y: 2, type: 'mirror', m: '/' },
    { x: 3, y: 3, type: 'target', hits: 2 },
    { x: 5, y: 4, type: 'target' },
    { x: 4, y: 1, type: 'block' },
    { x: 0, y: 3, type: 'block' },
  ],
});

analyzeLight('day-6 high noon', {
  cols: 8,
  rows: 7,
  cells: [
    { x: 0, y: 3, type: 'emitter', dir: 0 },
    { x: 7, y: 0, type: 'emitter', dir: 2 },
    { x: 3, y: 3, type: 'splitter' },
    { x: 4, y: 4, type: 'splitter' },
    { x: 3, y: 1, type: 'mirror', m: '\\' },
    { x: 5, y: 1, type: 'mirror', m: '/' },
    { x: 3, y: 4, type: 'mirror', m: '/', locked: false },
    { x: 4, y: 6, type: 'mirror', m: '\\' },
    { x: 4, y: 0, type: 'mirror', m: '\\' },
    { x: 5, y: 2, type: 'target' },
    { x: 1, y: 6, type: 'target' },
    { x: 4, y: 3, type: 'target', hits: 2 },
    { x: 2, y: 2, type: 'block' },
    { x: 6, y: 5, type: 'block' },
  ],
});

// ---- Unity ----
analyzeLock('unity-1', {
  steps: 12,
  beams: [0, 4, 7],
  rings: [
    { channels: [0, 4, 7] },
    { channels: [0, 4, 7, 9], links: [{ ring: 0, ratio: 1 }] },
    { channels: [0, 2, 4, 7], links: [{ ring: 1, ratio: -1 }] },
  ],
  scramble: [
    [1, 5],
    [2, -4],
    [0, 3],
    [1, -1],
  ],
});

analyzeLock('unity-1 v2 (4 rings)', {
  steps: 12,
  beams: [1, 4, 8, 11],
  rings: [
    { channels: [1, 4, 8, 11] },
    { channels: [1, 4, 8, 11, 6], links: [{ ring: 0, ratio: 1 }] },
    { channels: [1, 4, 8, 11, 2], links: [{ ring: 3, ratio: -1 }] },
    { channels: [1, 4, 8, 11, 9], links: [{ ring: 1, ratio: 1 }] },
  ],
  scramble: [
    [1, 5],
    [2, -4],
    [3, 3],
    [0, -2],
    [2, 2],
  ],
});

analyzeLight('unity-2 colored', {
  cols: 7,
  rows: 6,
  cells: [
    { x: 0, y: 0, type: 'emitter', dir: 0, color: 'r' },
    { x: 0, y: 2, type: 'emitter', dir: 0, color: 'y' },
    { x: 3, y: 5, type: 'emitter', dir: 3, color: 'b' },
    { x: 2, y: 2, type: 'splitter' },
    { x: 3, y: 3, type: 'splitter' },
    { x: 5, y: 0, type: 'mirror', m: '/' },
    { x: 2, y: 1, type: 'mirror', m: '\\' },
    { x: 2, y: 4, type: 'mirror', m: '/' },
    { x: 4, y: 3, type: 'mirror', m: '/' },
    { x: 1, y: 3, type: 'mirror', m: '\\' },
    { x: 5, y: 1, type: 'target', need: ['r', 'y'] },
    { x: 4, y: 4, type: 'target', need: ['y', 'b'] },
    { x: 1, y: 5, type: 'target', need: ['b'] },
  ],
});

analyzeLight('unity-3 alchemy', {
  cols: 8,
  rows: 6,
  cells: [
    { x: 0, y: 1, type: 'emitter', dir: 0, color: 'r' },
    { x: 7, y: 4, type: 'emitter', dir: 2, color: 'b' },
    { x: 2, y: 1, type: 'splitter' },
    { x: 4, y: 4, type: 'splitter' },
    { x: 3, y: 3, type: 'dye', color: 'y' },
    { x: 4, y: 3, type: 'dye', color: 'y' },
    { x: 2, y: 0, type: 'mirror', m: '\\' },
    { x: 5, y: 0, type: 'mirror', m: '/' },
    { x: 2, y: 3, type: 'mirror', m: '/' },
    { x: 4, y: 2, type: 'mirror', m: '\\' },
    { x: 4, y: 5, type: 'mirror', m: '/' },
    { x: 6, y: 5, type: 'mirror', m: '\\' },
    { x: 5, y: 2, type: 'target', need: ['r', 'y'] },
    { x: 6, y: 3, type: 'target', need: ['y', 'b'] },
    { x: 3, y: 1, type: 'block' },
    { x: 6, y: 1, type: 'block' },
    { x: 1, y: 3, type: 'block' },
  ],
});

// ---- Dusk ----
analyzeBlend('dusk-2', {
  disks: [
    { color: 'r', anchors: [[-320, -200], [-90, -60], [-200, 120]], at: 0 },
    { color: 'y', anchors: [[0, -300], [0, 0], [220, -40]], at: 0 },
    { color: 'b', anchors: [[300, -100], [60, 120], [-40, 300]], at: 0 },
  ],
  sockets: [
    { x: 0, y: -60, need: ['r', 'y'] },
    { x: 0, y: 60, need: ['y', 'b'] },
    { x: 150, y: 150, need: ['b'] },
  ],
});

analyzeBlend('dusk-3', {
  disks: [
    { color: 'r', anchors: [[-300, -160], [-75, 0], [0, -120]], at: 0 },
    { color: 'y', anchors: [[300, -160], [75, 0], [140, 100]], at: 0 },
    { color: 'b', anchors: [[0, -140], [0, 220], [-260, 120]], at: 2 },
  ],
  sockets: [
    { x: -150, y: -80, need: ['r'] },
    { x: 150, y: -80, need: ['y'] },
    { x: 0, y: 80, need: ['r', 'y'] },
    { x: 0, y: -200, need: ['b'] },
  ],
});

analyzeBlend('dusk-4', {
  disks: [
    { color: 'r', anchors: [[-320, -60], [-80, 0], [-160, 200]], at: 0, link: 1 },
    { color: 'b', anchors: [[320, -60], [80, 0], [160, 200]], at: 0, link: 0 },
    { color: 'y', anchors: [[0, 320], [0, 140], [-260, -200]], at: 0 },
  ],
  sockets: [
    { x: -80, y: -90, need: ['r'] },
    { x: 80, y: -90, need: ['b'] },
    { x: 0, y: 60, need: ['r', 'y', 'b'] },
  ],
});

analyzeBlend('dusk-5 quiet moon', {
  disks: [
    { color: 'r', anchors: [[-320, 40], [-200, -140], [-60, 40], [60, -180]], at: 0 },
    { color: 'y', anchors: [[-40, -85], [-160, 20], [100, -140], [0, 240]], at: 3 },
    { color: 'b', anchors: [[300, -160], [120, -20], [-20, 180], [240, 140]], at: 0 },
  ],
  sockets: [
    { x: -120, y: -110, need: ['r', 'y'] },
    { x: 40, y: -60, need: ['y', 'b'] },
    { x: -60, y: 100, need: [] }, // the quiet moon: must stay dark
    { x: 200, y: 20, need: ['b'] },
  ],
});

analyzeBlend('dusk-6 last blush', {
  disks: [
    { color: 'r', anchors: [[-320, -180], [-150, -70], [-140, 160]], at: 0 },
    { color: 'y', anchors: [[-60, -300], [-80, -150], [-260, 40]], at: 0 },
    { color: 'b', anchors: [[160, -200], [20, -20], [-160, 80]], at: 0 },
    { color: 'r', anchors: [[120, -160], [235, -50], [340, 120]], at: 0 },
    { color: 'y', anchors: [[20, -40], [80, 90], [200, 200]], at: 0 },
    { color: 'b', anchors: [[300, -140], [165, -30], [60, 220]], at: 0 },
  ],
  sockets: [
    { x: -180, y: -140, need: ['r', 'y'] },
    { x: -60, y: -60, need: ['r', 'y', 'b'] },
    { x: 170, y: -120, need: ['r', 'b'] },
    { x: 300, y: 20, need: ['r'] },
    { x: 160, y: 60, need: ['y', 'b'] },
    { x: -40, y: 200, need: [] },
  ],
});
