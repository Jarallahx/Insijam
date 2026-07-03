/* ---------------------------------------------------------------------------
   Localization. Every player-facing word lives here, in English and Arabic.
   The Arabic aims for the register an educated Saudi reader actually uses:
   simple fusha warmed with natural spoken turns — clear, never literary.
--------------------------------------------------------------------------- */

export type Lang = 'en' | 'ar';

type Entry = { en: string; ar: string };

const STRINGS = {
  titleAr: { en: 'انسجام', ar: 'انسجام' },
  titleEn: { en: 'Insijam', ar: 'Insijam' },
  subtitle: { en: 'a journey into harmony', ar: 'رحلة نحو الانسجام' },

  begin: { en: 'begin', ar: 'ابدأ' },
  continue: { en: 'continue', ar: 'كمّل الرحلة' },
  settings: { en: 'settings', ar: 'الإعدادات' },
  back: { en: 'back', ar: 'رجوع' },

  sound: { en: 'sound', ar: 'الصوت' },
  motion: { en: 'motion', ar: 'الحركة' },
  language: { en: 'language', ar: 'اللغة' },
  display: { en: 'display', ar: 'العرض' },
  windowed: { en: 'window', ar: 'نافذة' },
  fullscreen: { en: 'full screen', ar: 'ملء الشاشة' },
  on: { en: 'on', ar: 'تشغيل' },
  off: { en: 'off', ar: 'إيقاف' },
  full: { en: 'full', ar: 'كاملة' },
  reduced: { en: 'calm', ar: 'هادئة' },
  resetJourney: { en: 'begin the journey anew', ar: 'ابدأ من جديد' },
  resetConfirm: { en: 'let everything go?', ar: 'متأكد؟ راح تبدأ من الصفر' },
  yes: { en: 'yes', ar: 'نعم' },
  no: { en: 'no', ar: 'لا' },

  listenAgain: { en: 'listen again', ar: 'اسمعها مرة ثانية' },
  skip: { en: 'let it pass', ar: 'تجاوز اللغز' },
  nudge: { en: 'a nudge', ar: 'تلميح' },
  anotherNudge: { en: 'a little more?', ar: 'تلميح ثاني؟' },
  enough: { en: 'enough', ar: 'يكفي' },

  // credits
  about: { en: 'about', ar: 'عن اللعبة' },
  designedBy: { en: 'Designed by', ar: 'تصميم' },
  creditsName: { en: 'Jarallah Al-Jarallah', ar: 'جارالله الجارالله' },
  creditsNick: { en: '“Lalush”', ar: '«لالوشي»' },

  // chapters
  chDawn: { en: 'Dawn', ar: 'الفجر' },
  chDay: { en: 'Day', ar: 'النهار' },
  chDusk: { en: 'Dusk', ar: 'الغسق' },
  chNight: { en: 'Night', ar: 'الليل' },
  chUnity: { en: 'Harmony', ar: 'الانسجام' },

  // mechanic hints (shown on the first level of each mechanic)
  hintRings: {
    en: 'Turn the rings until every thread meets.',
    ar: 'لفّ الحلقات حتى تتواصل الخيوط كلها.',
  },
  hintBond: {
    en: 'Bonded rings turn together — the arrow shows which way.',
    ar: 'الحلقات المرتبطة تدور مع بعض — والسهم يوريك الاتجاه.',
  },
  hintLight: {
    en: 'Tilt the mirrors and carry the light home.',
    ar: 'حرّك المرايا ووصّل الضوء إلى بيته.',
  },
  hintBlend: {
    en: 'Slide the colors. Where they overlap, new colors are born.',
    ar: 'حرّك الألوان، وإذا تداخلت تطلع ألوان جديدة.',
  },
  hintEcho: {
    en: 'Listen. Then answer the stars in kind.',
    ar: 'اسمع لحن النجوم، وردّده مثل ما سمعته.',
  },
  hintLock: {
    en: 'Old rings, new light. Open the way to the center.',
    ar: 'حلقات تعرفها وضوء جديد — افتح له الطريق إلى المركز.',
  },
  hintColorLight: {
    en: 'Beams that meet, mix. Give each crystal its true color.',
    ar: 'الأشعة إذا التقت في بلورة امتزجت ألوانها. أعطِ كل بلورة لونها الصح.',
  },
  hintColorEcho: {
    en: 'The moon speaks in blended colors. Answer with their parts.',
    ar: 'القمر يتكلم بألوان ممزوجة — جاوب بألوانها الأساسية.',
  },
  hintFinale: {
    en: 'Everything you learned, gathered in one place.',
    ar: 'كل اللي تعلمته يجتمع هنا.',
  },
  hintReverse: {
    en: 'This sky answers backwards.',
    ar: 'هذه السماء تجاوب بالعكس.',
  },
  hintHits: {
    en: 'Some crystals ask for more than one beam.',
    ar: 'بعض البلورات تحتاج أكثر من شعاع.',
  },
  hintDark: {
    en: 'The quiet moon must stay in shadow.',
    ar: 'خلّ القمر الساكن في عتمته.',
  },
  hintDuet: {
    en: 'Some calls are sung by two stars at once.',
    ar: 'أحياناً نجمتان تغنّيان مع بعض.',
  },
  hintDye: {
    en: 'Stained glass changes the color of light passing through.',
    ar: 'الزجاج الملوّن يصبغ أي ضوء يمرّ منه.',
  },

  // ending
  ending1: { en: 'Dawn, day, dusk and night —', ar: '— فجر ونهار وغسق وليل' },
  ending2: { en: 'all along, they were one pattern.', ar: 'كلها كانت من البداية نقشاً واحداً.' },
  ending3: { en: 'Thank you for playing.', ar: 'شكراً لك على هذه الرحلة.' },
  endingTitle: { en: 'انسجام', ar: 'انسجام' },

  // level names ------------------------------------------------------------
  lvDawn1: { en: 'First Light', ar: 'الضوء الأول' },
  lvDawn2: { en: 'Petals', ar: 'بتلات' },
  lvDawn3: { en: 'Held Hands', ar: 'أيادي متشابكة' },
  lvDawn4: { en: 'Round Dance', ar: 'رقصة الدوران' },
  lvDawn5: { en: 'Give and Take', ar: 'أخذ وعطاء' },
  lvDawn6: { en: 'Bloom', ar: 'إزهار' },

  lvDay1: { en: 'One Ray', ar: 'شعاع واحد' },
  lvDay2: { en: 'Crossings', ar: 'تقاطعات' },
  lvDay3: { en: 'Two from One', ar: 'اثنان من واحد' },
  lvDay4: { en: 'Narrow Paths', ar: 'طرق ضيقة' },
  lvDay5: { en: 'Gathering', ar: 'الملتقى' },
  lvDay6: { en: 'High Noon', ar: 'الظهيرة' },

  lvDusk1: { en: 'Ember', ar: 'جمرة' },
  lvDusk2: { en: 'Three Sisters', ar: 'ثلاث أخوات' },
  lvDusk3: { en: 'Kept Apart', ar: 'افتراق' },
  lvDusk4: { en: 'Tied Together', ar: 'مرتبطان' },
  lvDusk5: { en: 'The Quiet Moon', ar: 'القمر الساكن' },
  lvDusk6: { en: 'The Last Blush', ar: 'الوهج الأخير' },

  lvNight1: { en: 'First Words', ar: 'أول الكلام' },
  lvNight2: { en: 'A Longer Song', ar: 'أغنية أطول' },
  lvNight3: { en: 'Mirror', ar: 'مرآة' },
  lvNight4: { en: 'Wandering Stars', ar: 'نجوم حائرة' },
  lvNight5: { en: 'Duet', ar: 'ثنائي' },
  lvNight6: { en: 'Nocturne', ar: 'تهويدة' },

  lvUnity1: { en: 'The Open Way', ar: 'الطريق المفتوح' },
  lvUnity2: { en: 'Colored Light', ar: 'ضوء ملوّن' },
  lvUnity3: { en: 'Alchemy', ar: 'كيمياء الضوء' },
  lvUnity4: { en: 'The Moon Speaks', ar: 'القمر يتكلم' },
  lvUnity5: { en: 'Insijam', ar: 'انسجام' },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function getLang(): Lang {
  return current;
}

export function t(key: StringKey): string {
  return STRINGS[key][current];
}

/** Roman numerals used for chapter numbering (shared across languages). */
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
