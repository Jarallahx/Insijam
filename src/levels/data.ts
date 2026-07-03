/* ---------------------------------------------------------------------------
   The journey itself. 29 hand-authored levels across five chapters.
   Every puzzle was designed backwards from its solution and then verified
   with the offline solvers in scripts/design-lab.mjs — each has exactly one
   solution (ring scrambles are expressed as legal moves, so they are
   solvable by construction). Keep the design lab in sync with this file.
--------------------------------------------------------------------------- */

import type { LevelDef } from '../puzzles/defs';

export const LEVELS: LevelDef[] = [
  /* ---- Chapter I · Dawn — the rings ------------------------------------- */
  {
    id: 'dawn-1',
    chapter: 'dawn',
    name: 'lvDawn1',
    hint: 'hintRings',
    nudge1: {
      en: 'Threads must run from the heart to the buds at the rim, without a break.',
      ar: 'لازم توصل الخيوط من القلب إلى البراعم عند الحافة بدون انقطاع.',
    },
    nudge2: {
      en: "Line each ring's threads up with the short stems on the core first.",
      ar: 'ابدأ بمطابقة خيوط كل حلقة مع السيقان القصيرة اللي عند المركز.',
    },
    puzzle: {
      kind: 'rings',
      steps: 8,
      threads: [0, 2, 3],
      rings: [{ petals: [1, 5, 6] }, { petals: [4, 7, 1] }],
      scramble: [
        [0, 3],
        [1, -2],
      ],
    },
  },
  {
    id: 'dawn-2',
    chapter: 'dawn',
    name: 'lvDawn2',
    nudge1: {
      en: 'Work from the inside out — settle the smallest ring, then grow.',
      ar: 'اشتغل من الداخل للخارج — ثبّت الحلقة الصغيرة أول، وبعدين توسّع.',
    },
    nudge2: {
      en: 'Each ring is independent here. Only the threads matter; petals are decoration.',
      ar: 'كل حلقة مستقلة هنا. المهم الخيوط بس؛ البتلات مجرد زينة.',
    },
    puzzle: {
      kind: 'rings',
      steps: 8,
      threads: [0, 1, 4],
      rings: [{ petals: [2, 5] }, { petals: [3, 6, 7] }, { petals: [2, 5, 6] }],
      scramble: [
        [0, 2],
        [1, 5],
        [2, -3],
      ],
    },
  },
  {
    id: 'dawn-3',
    chapter: 'dawn',
    name: 'lvDawn3',
    hint: 'hintBond',
    nudge1: {
      en: 'Watch the bond: the middle ring carries the inner one with it.',
      ar: 'لاحظ الرابط: الحلقة الوسطى تسحب الداخلية معها.',
    },
    nudge2: {
      en: 'Set the middle ring first — then repair the inner ring alone, and the outer last.',
      ar: 'اضبط الوسطى أول، وبعدها صلّح الداخلية لحالها، والخارجية في الآخر.',
    },
    puzzle: {
      kind: 'rings',
      steps: 8,
      threads: [0, 1, 3],
      rings: [
        { petals: [2, 5, 6] },
        { petals: [4, 6, 7], links: [{ ring: 0, ratio: 1 }] },
        { petals: [2, 4, 7] },
      ],
      scramble: [
        [1, 3],
        [0, -2],
        [2, 4],
        [1, 1],
      ],
    },
  },
  {
    id: 'dawn-4',
    chapter: 'dawn',
    name: 'lvDawn4',
    nudge1: {
      en: 'Every ring pulls the next — the dance goes in a circle.',
      ar: 'كل حلقة تسحب اللي بعدها — الرقصة تدور في دائرة.',
    },
    nudge2: {
      en: "Two turns on different rings can cancel each other's side-effects. Find the pairs.",
      ar: 'لفّتان على حلقتين مختلفتين ممكن تلغي إحداهما أثر الثانية. دوّر على الأزواج.',
    },
    puzzle: {
      kind: 'rings',
      steps: 10,
      threads: [0, 1, 5],
      rings: [
        { petals: [3, 6, 8], links: [{ ring: 1, ratio: 1 }] },
        { petals: [2, 4, 7], links: [{ ring: 2, ratio: 1 }] },
        { petals: [3, 7, 9], links: [{ ring: 0, ratio: 1 }] },
      ],
      scramble: [
        [0, 3],
        [1, -4],
        [2, 2],
        [0, 1],
      ],
    },
  },
  {
    id: 'dawn-5',
    chapter: 'dawn',
    name: 'lvDawn5',
    nudge1: {
      en: 'The two middle rings are yoked in opposition — one gives, the other takes.',
      ar: 'الحلقتان الوسطيتان مربوطتان بالعكس — واحدة تعطي والثانية تأخذ.',
    },
    nudge2: {
      en: 'A single turn of one middle ring can bring both home at once. Then the outer, then the heart.',
      ar: 'لفّة واحدة لإحدى الوسطيتين ممكن ترجّع الاثنتين مكانهما مرة واحدة. بعدها الخارجية، ثم القلب.',
    },
    puzzle: {
      kind: 'rings',
      steps: 12,
      threads: [0, 2, 7],
      rings: [
        { petals: [4, 6, 10] },
        { petals: [3, 5, 9, 11], links: [{ ring: 2, ratio: -1 }] },
        { petals: [4, 8, 10], links: [{ ring: 1, ratio: -1 }] },
        { petals: [1, 5, 9], links: [{ ring: 0, ratio: 1 }] },
      ],
      scramble: [
        [1, 4],
        [3, 5],
        [0, -2],
        [1, 2],
        [3, -1],
      ],
    },
  },
  {
    id: 'dawn-6',
    chapter: 'dawn',
    name: 'lvDawn6',
    nudge1: {
      en: 'Begin where no other hand reaches: which ring does nothing else move?',
      ar: 'ابدأ من الحلقة اللي ما يحرّكها أحد — أي وحدة هي؟',
    },
    nudge2: {
      en: 'The outermost ring answers to no one — settle it first, then unwind the chain it disturbed.',
      ar: 'الحلقة الخارجية ما يسحبها أحد — ثبّتها أول، وبعدين فكّ السلسلة اللي حرّكتها.',
    },
    puzzle: {
      kind: 'rings',
      steps: 12,
      threads: [0, 3, 8],
      rings: [
        { petals: [2, 6, 10] },
        { petals: [1, 5, 9], links: [{ ring: 2, ratio: -1 }] },
        { petals: [3, 7, 11], links: [{ ring: 3, ratio: 1 }] },
        { petals: [2, 8], links: [{ ring: 1, ratio: 1 }] },
        {
          petals: [4, 6, 10],
          links: [
            { ring: 0, ratio: -1 },
            { ring: 2, ratio: 1 },
          ],
        },
      ],
      scramble: [
        [4, 5],
        [1, -3],
        [2, 4],
        [0, 3],
        [3, -2],
        [4, 1],
      ],
    },
  },

  /* ---- Chapter II · Day — the light -------------------------------------- */
  {
    id: 'day-1',
    chapter: 'day',
    name: 'lvDay1',
    hint: 'hintLight',
    nudge1: {
      en: 'The mirror turns when you touch it.',
      ar: 'المرآة تدور إذا لمستها.',
    },
    nudge2: {
      en: 'Tilted the other way, the mirror throws the ray upward into the crystal.',
      ar: 'إذا مالت المرآة للجهة الثانية، رمت الشعاع لفوق نحو البلورة.',
    },
    puzzle: {
      kind: 'light',
      cols: 5,
      rows: 5,
      cells: [
        { x: 0, y: 2, type: 'emitter', dir: 0 },
        { x: 2, y: 2, type: 'mirror', m: '\\' },
        { x: 2, y: 0, type: 'target' },
      ],
    },
  },
  {
    id: 'day-2',
    chapter: 'day',
    name: 'lvDay2',
    nudge1: {
      en: 'Each sun serves one crystal. Follow each ray to its dead end first.',
      ar: 'كل شمس لها بلورة واحدة. تتبّع كل شعاع إلى آخره أول.',
    },
    nudge2: {
      en: 'Both mirrors start out wrong. The rays must cross paths on their way home.',
      ar: 'المرآتان غلط من البداية، والشعاعان لازم يتقاطعان في طريقهما.',
    },
    puzzle: {
      kind: 'light',
      cols: 6,
      rows: 5,
      cells: [
        { x: 0, y: 1, type: 'emitter', dir: 0 },
        { x: 4, y: 0, type: 'emitter', dir: 1 },
        { x: 2, y: 1, type: 'mirror', m: '/' },
        { x: 4, y: 3, type: 'mirror', m: '\\' },
        { x: 2, y: 4, type: 'target' },
        { x: 1, y: 3, type: 'target' },
      ],
    },
  },
  {
    id: 'day-3',
    chapter: 'day',
    name: 'lvDay3',
    nudge1: {
      en: 'The prism splits one ray into two — but lets nothing pass straight through.',
      ar: 'الموشور يشطر الشعاع إلى اثنين — لكن ما يمرّر شيئاً بخط مستقيم.',
    },
    nudge2: {
      en: 'Each branch meets one mirror. Both are lying.',
      ar: 'كل فرع يقابل مرآة واحدة، والاثنتان غلط.',
    },
    puzzle: {
      kind: 'light',
      cols: 6,
      rows: 5,
      cells: [
        { x: 0, y: 2, type: 'emitter', dir: 0 },
        { x: 3, y: 2, type: 'splitter' },
        { x: 3, y: 1, type: 'mirror', m: '\\' },
        { x: 3, y: 3, type: 'mirror', m: '/' },
        { x: 5, y: 1, type: 'target' },
        { x: 5, y: 3, type: 'target' },
      ],
    },
  },
  {
    id: 'day-4',
    chapter: 'day',
    name: 'lvDay4',
    nudge1: {
      en: 'One ray walks a long spiral; the other slips in from the side.',
      ar: 'شعاع يمشي في لولب طويل، والثاني يدخل من الجنب.',
    },
    nudge2: {
      en: 'Start at the first sun and set each mirror in the order the light meets it. The pinned mirror already tells the truth.',
      ar: 'ابدأ من الشمس الأولى واضبط كل مرآة بترتيب وصول الضوء لها. المرآة المثبّتة صادقة أصلاً.',
    },
    puzzle: {
      kind: 'light',
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
    },
  },
  {
    id: 'day-5',
    chapter: 'day',
    name: 'lvDay5',
    hint: 'hintHits',
    nudge1: {
      en: 'A crystal with two pips must be fed twice — from two different directions.',
      ar: 'البلورة اللي عليها علامتان تحتاج شعاعين — من اتجاهين مختلفين.',
    },
    nudge2: {
      en: 'One sun dives straight down into the twin crystal; the prism-chain feeds it again from below.',
      ar: 'شمس تنزل مباشرة على البلورة المزدوجة، وسلسلة الموشورين تطعمها مرة ثانية من تحت.',
    },
    puzzle: {
      kind: 'light',
      cols: 8,
      rows: 7,
      cells: [
        { x: 0, y: 3, type: 'emitter', dir: 0 },
        { x: 7, y: 0, type: 'emitter', dir: 2 },
        { x: 3, y: 3, type: 'splitter' },
        { x: 4, y: 4, type: 'splitter' },
        { x: 3, y: 1, type: 'mirror', m: '\\' },
        { x: 5, y: 1, type: 'mirror', m: '/' },
        { x: 3, y: 4, type: 'mirror', m: '/' },
        { x: 4, y: 6, type: 'mirror', m: '\\' },
        { x: 4, y: 0, type: 'mirror', m: '\\' },
        { x: 5, y: 2, type: 'target' },
        { x: 1, y: 6, type: 'target' },
        { x: 4, y: 3, type: 'target', hits: 2 },
        { x: 2, y: 2, type: 'block' },
        { x: 6, y: 5, type: 'block' },
      ],
    },
  },
  {
    id: 'day-6',
    chapter: 'day',
    name: 'lvDay6',
    nudge1: {
      en: 'Six mirrors, three journeys. Untangle one thread at a time, starting from each sun.',
      ar: 'ست مرايا وثلاث رحلات. فكّ خيطاً واحداً كل مرة، وابدأ من كل شمس.',
    },
    nudge2: {
      en: 'The split ray crosses the whole sky along the top; the second sun climbs and turns twice before striking the twin crystal from the north.',
      ar: 'الشعاع المشطور يعبر السماء كلها من فوق، والشمس الثانية تطلع وتنعطف مرتين قبل ما تضرب البلورة المزدوجة من فوق.',
    },
    puzzle: {
      kind: 'light',
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
    },
  },

  /* ---- Chapter III · Dusk — the colors ------------------------------------ */
  {
    id: 'dusk-1',
    chapter: 'dusk',
    name: 'lvDusk1',
    hint: 'hintBlend',
    nudge1: {
      en: 'Red and gold must both rest on the seal.',
      ar: 'الأحمر والذهبي لازم يجلسان معاً على الخاتم.',
    },
    nudge2: {
      en: 'Bring both disks to their inner stops; the seal drinks from the overlap.',
      ar: 'قرّب القرصين لأقرب نقطتين من الوسط؛ الخاتم يشرب من التداخل.',
    },
    puzzle: {
      kind: 'blend',
      disks: [
        {
          color: 'r',
          anchors: [
            [-280, 0],
            [-60, 0],
          ],
          at: 0,
        },
        {
          color: 'y',
          anchors: [
            [280, 0],
            [60, 0],
          ],
          at: 0,
        },
      ],
      sockets: [{ x: 0, y: 0, need: ['r', 'y'] }],
    },
  },
  {
    id: 'dusk-2',
    chapter: 'dusk',
    name: 'lvDusk2',
    nudge1: {
      en: 'Gold is needed twice — find the one place it can serve both seals.',
      ar: 'الذهبي مطلوب مرتين — دوّر على المكان الوحيد اللي يخدم فيه الخاتمين معاً.',
    },
    nudge2: {
      en: 'Gold sits at the center. Red joins from above; blue leans in and stretches toward its lone seal.',
      ar: 'الذهبي يجلس في النص. الأحمر يجيه من فوق، والأزرق يميل ويمد نحو خاتمه المنفرد.',
    },
    puzzle: {
      kind: 'blend',
      disks: [
        {
          color: 'r',
          anchors: [
            [-320, -200],
            [-90, -60],
            [-200, 120],
          ],
          at: 0,
        },
        {
          color: 'y',
          anchors: [
            [0, -300],
            [0, 0],
            [220, -40],
          ],
          at: 0,
        },
        {
          color: 'b',
          anchors: [
            [300, -100],
            [60, 120],
            [-40, 300],
          ],
          at: 0,
        },
      ],
      sockets: [
        { x: 0, y: -60, need: ['r', 'y'] },
        { x: 0, y: 60, need: ['y', 'b'] },
        { x: 150, y: 150, need: ['b'] },
      ],
    },
  },
  {
    id: 'dusk-3',
    chapter: 'dusk',
    name: 'lvDusk3',
    nudge1: {
      en: 'Some seals ask to be left alone — a pure color, and nothing else.',
      ar: 'بعض الخواتم تبغى لوناً نقياً بس، بدون أي إضافة.',
    },
    nudge2: {
      en: 'The blue disk has exactly one home that touches its seal and nothing else.',
      ar: 'القرص الأزرق له مكان واحد بالضبط يلمس فيه خاتمه ولا يلمس غيره.',
    },
    puzzle: {
      kind: 'blend',
      disks: [
        {
          color: 'r',
          anchors: [
            [-300, -160],
            [-75, 0],
            [0, -120],
          ],
          at: 0,
        },
        {
          color: 'y',
          anchors: [
            [300, -160],
            [75, 0],
            [140, 100],
          ],
          at: 0,
        },
        {
          color: 'b',
          anchors: [
            [0, -140],
            [0, 220],
            [-260, 120],
          ],
          at: 2,
        },
      ],
      sockets: [
        { x: -150, y: -80, need: ['r'] },
        { x: 150, y: -80, need: ['y'] },
        { x: 0, y: 80, need: ['r', 'y'] },
        { x: 0, y: -200, need: ['b'] },
      ],
    },
  },
  {
    id: 'dusk-4',
    chapter: 'dusk',
    name: 'lvDusk4',
    nudge1: {
      en: 'The bound pair moves as one — placing one places the other.',
      ar: 'القرصان المربوطان يتحركان مع بعض — إذا وضعت واحداً انوضع الثاني.',
    },
    nudge2: {
      en: 'Their middle stop lights both pure seals at once; gold completes the trio below.',
      ar: 'وقفتهما الوسطى تضيء الخاتمين النقيين معاً، والذهبي يكمّل الثلاثي تحت.',
    },
    puzzle: {
      kind: 'blend',
      disks: [
        {
          color: 'r',
          anchors: [
            [-320, -60],
            [-80, 0],
            [-160, 200],
          ],
          at: 0,
          link: 1,
        },
        {
          color: 'b',
          anchors: [
            [320, -60],
            [80, 0],
            [160, 200],
          ],
          at: 0,
          link: 0,
        },
        {
          color: 'y',
          anchors: [
            [0, 320],
            [0, 140],
            [-260, -200],
          ],
          at: 0,
        },
      ],
      sockets: [
        { x: -80, y: -90, need: ['r'] },
        { x: 80, y: -90, need: ['b'] },
        { x: 0, y: 60, need: ['r', 'y', 'b'] },
      ],
    },
  },
  {
    id: 'dusk-5',
    chapter: 'dusk',
    name: 'lvDusk5',
    hint: 'hintDark',
    nudge1: {
      en: 'The dark seal is a promise: no light may touch it.',
      ar: 'الخاتم المعتم وعد: ما يلمسه أي ضوء.',
    },
    nudge2: {
      en: 'Gold bridges the two mixed seals from the middle; red keeps to its far corner; blue serves both its seals from between them.',
      ar: 'الذهبي يربط الخاتمين الممزوجين من النص، والأحمر يبقى في زاويته البعيدة، والأزرق يخدم خاتميه من بينهما.',
    },
    puzzle: {
      kind: 'blend',
      disks: [
        {
          color: 'r',
          anchors: [
            [-320, 40],
            [-200, -140],
            [-60, 40],
            [60, -180],
          ],
          at: 0,
        },
        {
          color: 'y',
          anchors: [
            [-40, -85],
            [-160, 20],
            [100, -140],
            [0, 240],
          ],
          at: 3,
        },
        {
          color: 'b',
          anchors: [
            [300, -160],
            [120, -20],
            [-20, 180],
            [240, 140],
          ],
          at: 0,
        },
      ],
      sockets: [
        { x: -120, y: -110, need: ['r', 'y'] },
        { x: 40, y: -60, need: ['y', 'b'] },
        { x: -60, y: 100, need: [] },
        { x: 200, y: 20, need: ['b'] },
      ],
    },
  },
  {
    id: 'dusk-6',
    chapter: 'dusk',
    name: 'lvDusk6',
    nudge1: {
      en: 'Six lights, six vows. Start from the white seal — it needs all three colors at once.',
      ar: 'ستة أضواء وستة عهود. ابدأ من الخاتم الأبيض — يحتاج الألوان الثلاثة كلها مرة واحدة.',
    },
    nudge2: {
      en: "Three disks crowd the white seal's corner; the second red alone can serve both the violet and the lone-red seals.",
      ar: 'ثلاثة أقراص تجتمع عند زاوية الخاتم الأبيض، والأحمر الثاني وحده يقدر يخدم خاتم البنفسجي وخاتم الأحمر معاً.',
    },
    puzzle: {
      kind: 'blend',
      disks: [
        {
          color: 'r',
          anchors: [
            [-320, -180],
            [-150, -70],
            [-140, 160],
          ],
          at: 0,
        },
        {
          color: 'y',
          anchors: [
            [-60, -300],
            [-80, -150],
            [-260, 40],
          ],
          at: 0,
        },
        {
          color: 'b',
          anchors: [
            [160, -200],
            [20, -20],
            [-160, 80],
          ],
          at: 0,
        },
        {
          color: 'r',
          anchors: [
            [120, -160],
            [235, -50],
            [340, 120],
          ],
          at: 0,
        },
        {
          color: 'y',
          anchors: [
            [20, -40],
            [80, 90],
            [200, 200],
          ],
          at: 0,
        },
        {
          color: 'b',
          anchors: [
            [300, -140],
            [165, -30],
            [60, 220],
          ],
          at: 0,
        },
      ],
      sockets: [
        { x: -180, y: -140, need: ['r', 'y'] },
        { x: -60, y: -60, need: ['r', 'y', 'b'] },
        { x: 170, y: -120, need: ['r', 'b'] },
        { x: 300, y: 20, need: ['r'] },
        { x: 160, y: 60, need: ['y', 'b'] },
        { x: -40, y: 200, need: [] },
      ],
    },
  },

  /* ---- Chapter IV · Night — the echo --------------------------------------- */
  {
    id: 'night-1',
    chapter: 'night',
    name: 'lvNight1',
    hint: 'hintEcho',
    nudge1: {
      en: 'Listen once more — the circling button repeats the song.',
      ar: 'اسمعها مرة ثانية — زر الإعادة يعيد اللحن.',
    },
    nudge2: {
      en: 'The stars sing low to high as they sit low to high in the sky.',
      ar: 'النجوم الواطية صوتها غليظ، والعالية صوتها حاد.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [-240, -40],
        [0, -260],
        [240, -40],
        [0, 180],
      ],
      sequence: [[0], [1], [2], [3], [1]],
      mode: 'grow',
      growFrom: 3,
    },
  },
  {
    id: 'night-2',
    chapter: 'night',
    name: 'lvNight2',
    nudge1: {
      en: 'The phrase grows by one each round — but its beginning never changes.',
      ar: 'اللحن يطول نغمة كل جولة — لكن بدايته ما تتغير.',
    },
    nudge2: {
      en: 'Tie the melody to shapes: each note leaps across the sky, rarely to a neighbor.',
      ar: 'اربط اللحن بالشكل: كل نغمة تقفز بعيداً في السماء، ونادراً ما تجي عند جارتها.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [-320, -80],
        [-160, -260],
        [120, -300],
        [320, -120],
        [200, 140],
        [-120, 200],
      ],
      sequence: [[0], [2], [4], [1], [5], [3], [0], [4]],
      mode: 'grow',
      growFrom: 4,
    },
  },
  {
    id: 'night-3',
    chapter: 'night',
    name: 'lvNight3',
    hint: 'hintReverse',
    nudge1: {
      en: 'This sky answers backwards — last heard, first answered.',
      ar: 'هذه السماء تجاوب بالعكس — آخر ما سمعته هو أول ما تجاوب به.',
    },
    nudge2: {
      en: "While it sings, walk the trail backwards in your mind's eye, and begin from where it ends.",
      ar: 'وهي تغني، امشِ على الأثر بالعكس في خيالك، وابدأ من حيث انتهت.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [-300, -60],
        [-120, -240],
        [150, -240],
        [300, -40],
        [0, 120],
      ],
      sequence: [[1], [3], [0], [4], [2], [0]],
      mode: 'reverse',
    },
  },
  {
    id: 'night-4',
    chapter: 'night',
    name: 'lvNight4',
    nudge1: {
      en: 'The stars wander, but the song does not — remember who sang, not where they stood.',
      ar: 'النجوم تلفّ لكن اللحن ما يتغير — احفظ من غنّى، مو مكانه.',
    },
    nudge2: {
      en: 'Anchor each star by its neighbors in the ring, not by its place on the screen.',
      ar: 'ثبّت كل نجمة بجيرانها في الدائرة، مو بمكانها على الشاشة.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [280, 0],
        [140, -242],
        [-140, -242],
        [-280, 0],
        [-140, 242],
        [140, 242],
      ],
      sequence: [[0], [3], [1], [4], [2], [5], [3]],
      mode: 'grow',
      growFrom: 4,
      drift: 0.055,
    },
  },
  {
    id: 'night-5',
    chapter: 'night',
    name: 'lvNight5',
    hint: 'hintDuet',
    nudge1: {
      en: 'Some calls are two stars at once — answer both, in any order.',
      ar: 'بعض النداءات نجمتان مع بعض — جاوب على الاثنتين بأي ترتيب.',
    },
    nudge2: {
      en: 'Every duet is a pair of stars facing each other across the circle.',
      ar: 'كل ثنائي نجمتان متقابلتان عبر الدائرة.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [-330, -60],
        [-160, -280],
        [170, -270],
        [330, -50],
        [160, 190],
        [-170, 200],
      ],
      sequence: [[1], [0, 3], [4], [2, 5], [1, 4], [0]],
      mode: 'grow',
      growFrom: 3,
    },
  },
  {
    id: 'night-6',
    chapter: 'night',
    name: 'lvNight6',
    nudge1: {
      en: 'Backwards again — and this time, the sky itself is turning.',
      ar: 'بالعكس مرة ثانية — وهالمرة السماء نفسها تدور.',
    },
    nudge2: {
      en: 'Sing it forward in your head twice, then let your hand walk it home in reverse.',
      ar: 'رتّل اللحن في راسك مرتين مثل ما سمعته، وبعدين خلّ يدك ترجع به بالعكس.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [-360, -40],
        [-240, -240],
        [-40, -320],
        [180, -280],
        [340, -100],
        [240, 120],
        [20, 200],
        [-220, 160],
      ],
      sequence: [[2], [5], [0], [6], [3], [7], [1]],
      mode: 'reverse',
      drift: 0.04,
    },
  },

  /* ---- Chapter V · Harmony — everything at once ------------------------------ */
  {
    id: 'unity-1',
    chapter: 'unity',
    name: 'lvUnity1',
    hint: 'hintLock',
    nudge1: {
      en: 'A beam passes a ring only through a gap — and all four beams must pass all rings at once.',
      ar: 'الشعاع ما يعبر الحلقة إلا من فجوة — والأشعة الأربعة لازم تعبر كل الحلقات في نفس الوقت.',
    },
    nudge2: {
      en: 'Each ring has the four gaps that match the beams, but only one turning lines all four up together. Mind the bonds.',
      ar: 'كل حلقة فيها الفجوات الأربع المطابقة للأشعة، لكن لفّة وحدة بس تصفّها كلها. وانتبه للروابط.',
    },
    puzzle: {
      kind: 'lock',
      steps: 12,
      // rotated one slot off the vertical so no beam points straight down
      // into the caption band (an equivalent puzzle, shifted whole)
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
    },
  },
  {
    id: 'unity-2',
    chapter: 'unity',
    name: 'lvUnity2',
    hint: 'hintColorLight',
    nudge1: {
      en: "Colors that meet in one crystal, blend. Match each crystal's ring exactly.",
      ar: 'الألوان اللي تلتقي في بلورة وحدة تمتزج. طابق حلقة كل بلورة بالضبط.',
    },
    nudge2: {
      en: 'Yellow splits to serve both mixed crystals; blue splits to feed the green crystal and its own lone crystal.',
      ar: 'الأصفر ينشطر ليخدم البلورتين الممزوجتين، والأزرق ينشطر ليغذي بلورة الأخضر وبلورته المنفردة.',
    },
    puzzle: {
      kind: 'light',
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
    },
  },
  {
    id: 'unity-3',
    chapter: 'unity',
    name: 'lvUnity3',
    hint: 'hintDye',
    nudge1: {
      en: 'Stained glass re-colors any beam that passes through it.',
      ar: 'الزجاج الملوّن يعيد صبغ أي شعاع يمرّ منه.',
    },
    nudge2: {
      en: "Neither sun is gold — gold must be made. Each sun sends one branch through glass to become the other crystal's yellow.",
      ar: 'ما فيه شمس صفراء هنا — الأصفر يُصنع. كل شمس ترسل فرعاً عبر الزجاج ليصير أصفر البلورة الثانية.',
    },
    puzzle: {
      kind: 'light',
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
    },
  },
  {
    id: 'unity-4',
    chapter: 'unity',
    name: 'lvUnity4',
    hint: 'hintColorEcho',
    nudge1: {
      en: 'The moon speaks in mixtures — answer with the parts that make its color.',
      ar: 'القمر يتكلم بالمزيج — وأنت جاوب بالأجزاء اللي تصنع لونه.',
    },
    nudge2: {
      en: 'Orange is red and gold; violet is red and blue; green is gold and blue; white is all three.',
      ar: 'البرتقالي أحمر مع ذهبي، والبنفسجي أحمر مع أزرق، والأخضر ذهبي مع أزرق، والأبيض ثلاثتها كلها.',
    },
    puzzle: {
      kind: 'echo',
      stars: [
        [-260, 60],
        [0, -280],
        [260, 60],
      ],
      colors: ['r', 'y', 'b'],
      sequence: [[0, 1], [1, 2], [2], [0, 2], [0, 1, 2], [1]],
      mode: 'full',
    },
  },
  {
    id: 'unity-5',
    chapter: 'unity',
    name: 'lvUnity5',
    hint: 'hintFinale',
    nudge1: {
      en: 'Everything you have learned, in order: bloom, then light, then song.',
      ar: 'كل اللي تعلمته بالترتيب: إزهار، ثم ضوء، ثم أغنية.',
    },
    nudge2: {
      en: 'The rings first — remember the bonds. Then walk each lens to its crystal. Then answer the theme.',
      ar: 'الحلقات أول — تذكّر الروابط. بعدين وصّل كل عدسة لبلورتها. وفي الآخر جاوب اللحن.',
    },
    puzzle: { kind: 'finale' },
  },
];

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}

/** Linear unlocking: a level opens when the one before it is complete. */
export function isUnlocked(index: number, isCompleted: (id: string) => boolean): boolean {
  if (index <= 0) return true;
  return isCompleted(LEVELS[index - 1].id);
}

export const CHAPTER_OF_LEVEL = (index: number) => LEVELS[index].chapter;
