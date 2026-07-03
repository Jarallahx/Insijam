/* ---------------------------------------------------------------------------
   Insijam — entry point. Fonts, styles, game boot.
--------------------------------------------------------------------------- */

import '@fontsource/josefin-sans/300.css';
import '@fontsource/josefin-sans/400.css';
import '@fontsource/tajawal/300.css';
import '@fontsource/tajawal/400.css';
import './styles.css';

import { Game } from './core/game';
import { MenuScene } from './scenes/menu';
import { LevelScene } from './scenes/level';
import { levelIndex } from './levels/data';

const game = new Game();
game.ui.onReset = () => game.goto(new MenuScene(), { sound: false });

// dev shortcut: ?level=<id> boots straight into a level
const jump = new URLSearchParams(location.search).get('level');
const jumpIdx = jump ? levelIndex(jump) : -1;
game.start(jumpIdx >= 0 ? new LevelScene(jumpIdx) : new MenuScene());
