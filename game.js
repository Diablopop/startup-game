// ============================================================
// STARTUP — Phase 3: Resources Row & Full Three-Round Game
// ============================================================

// ── Constants ────────────────────────────────────────────────
const FONT_UI        = '"Cabin", sans-serif';
const FONT_BOARD     = '"Roboto Condensed", monospace';
const FONT_CARD_NAME = '"Roboto", sans-serif';
const GAME_W = 1280;
const GAME_H = 720;
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function tryFullscreen() {
  const el = document.documentElement;
  const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (rfs) {
    rfs.call(el).catch(() => {});
  } else {
    window.scrollTo(0, 1);
  }
}

const CARD_W = 110;
const CARD_H = 155;
const SLOT_W = 120;
const SLOT_H = 145;   // reduced from 165 to fit three rows
const CAROUSEL_VISIBLE = 6;
const CAROUSEL_SLIDE_MS = 180;    // carousel scroll animation duration — adjust to taste
const CAROUSEL_EXIT_SLIDE = true; // set true to zip exiting cards off-screen; false = fade in place

// Row layout positions (top to bottom: Product → Cash → Resources)
const ROW_PROD_Y      = 95;
const ROW_CASH_Y      = 260;
const ROW_RES_Y       = 425;
const ROW_SLOT_X      = 473;   // x of first slot center
const ACTIVATE_TILE_X = 353;   // x of activate tile / row label block

const TURNS_PER_ROUND     = [7, 7, 6, 5];
const BASE_CASH_PER_ROUND = [25, 50, 75, 100];
const MAX_COST_PER_ROUND  = [1, 2, Infinity, Infinity];

// Value bonus per card when Round 4 goal is met (in $k)
const GOAL_R4_VALUE_BONUS = 50;

// ── Bonus Goals ────────────────────────────────────────────
// Each round has a pool of goals; one is randomly selected at round start.
// check() receives a snapshot object; progressText() returns live progress or null.
const ROUND_GOALS = [
  // Round 1
  [
    {
      id: 'r1_play4', desc: 'Play 4 cards',
      check: s => s.cardsPlacedThisRound >= 4,
      progressText: s => `${s.cardsPlacedThisRound} / 4`,
      rewardType: 'csuite',
    },
    {
      id: 'r1_val200', desc: 'Reach $200k valuation',
      check: s => s.finalValuation >= 200,
      progressText: null,   // valuation computed at end only
      rewardType: 'csuite',
    },
    {
      id: 'r1_3types', desc: 'Play 3 different card types',
      check: s => s.typesPlacedCount >= 3,
      progressText: s => `${s.typesPlacedCount} / 3`,
      rewardType: 'csuite',
    },
  ],
  // Round 2
  [
    {
      id: 'r2_10hand', desc: 'Collect 10 cards in hand',
      check: s => s.peakHandSize >= 10,
      progressText: s => `${s.peakHandSize} / 10`,
      rewardType: 'csuite',
    },
    {
      id: 'r2_600cash', desc: 'Bank $600k cash',
      check: s => s.peakCash >= 600,
      progressText: s => `${fmtVal(s.peakCash)} / $600k`,
      rewardType: 'csuite',
    },
    {
      id: 'r2_val500', desc: 'Reach $500k valuation',
      check: s => s.finalValuation >= 500,
      progressText: null,
      rewardType: 'csuite',
    },
    {
      id: 'r2_4same', desc: 'Play 4 cards of the same type',
      check: s => s.maxSameTypePlaced >= 4,
      progressText: s => `${s.maxSameTypePlaced} / 4`,
      rewardType: 'csuite',
    },
  ],
  // Round 3
  [
    {
      id: 'r3_ship3', desc: 'Ship a product 3 times',
      check: s => s.timesShippedThisRound >= 3,
      progressText: s => `${s.timesShippedThisRound} / 3`,
      rewardType: 'csuite',
    },
    {
      id: 'r3_val2m', desc: 'Reach $2M valuation',
      check: s => s.finalValuation >= 2000,
      progressText: null,
      rewardType: 'csuite',
    },
    {
      id: 'r3_fill1', desc: 'Fill a row with 5 cards',
      check: s => s.fullRowCount >= 1,
      progressText: s => `${s.fullRowCount} / 1`,
      rewardType: 'csuite',
    },
  ],
  // Round 4
  [
    {
      id: 'r4_ship4', desc: 'Ship a product 4 times',
      check: s => s.timesShippedThisRound >= 4,
      progressText: s => `${s.timesShippedThisRound} / 4`,
      rewardType: 'value_bonus',
    },
    {
      id: 'r4_2csuite', desc: 'Play 2 C-Suite cards',
      check: s => s.csuiteCountOnBoard >= 2,
      progressText: s => `${s.csuiteCountOnBoard} / 2`,
      rewardType: 'value_bonus',
    },
    {
      id: 'r4_fill2', desc: 'Fill 2 rows with 5 cards',
      check: s => s.fullRowCount >= 2,
      progressText: s => `${s.fullRowCount} / 2`,
      rewardType: 'value_bonus',
    },
  ],
];

const COLORS = {
  // ── Board structure ──────────────────────────────────────────
  bg:             0xfffbf3,
  panel:          0xfdedcd,
  sceneBg:            0x0F555A,  // universal background for all non-gameboard scenes
  sceneBtnPrimary:    0xffffff,  // primary button fill (white)
  sceneBtnPrimaryHov: 0xe0e0e0,  // primary button hover (light gray)
  sceneBtnSecondHov:  0x1a6e74,  // secondary button hover (lighter teal)
  divider:        0x4f4f4f,   // HUD panel dividers, turn box borders

  // ── Board UI — buttons, slots, overlays ──────────────────────
  buttonHover:      0xf0e8dc,  // skip/done/close button hover
  buttonHoverDark:  0x333333,  // accept/action button hover (on dark bg)
  buttonDisabled:   0xcccccc,  // disabled button fill
  slotDisabled:     0xf5f5f5,  // empty/disabled card slot in modals
  cardBackLight:    0xf0debb,  // draw pile card back, light variant
  cardBackFill:     0x0A2D30,  // face-down card fill (deal animation)
  typeColorDefault: 0x888888,  // fallback when card type has no color entry
  scrollTrackBg:    0x1a1a2e,  // scroll box background in valuation
  scrollThumb:      0x666688,  // scroll thumb in valuation
  csuiteButtonBg:   0x001a2a,  // C-Suite trade interface button bg
  csuiteButtonStroke: 0x4488aa, // C-Suite button stroke
  csuiteButtonHover:  0x002a3a, // C-Suite button hover

  // ── Cash row ─────────────────────────────────────────────────
  slotEmpty:      0xe2edd7,
  activateTile:   0x41922d,
  activateHover:  0x357524,
  activateActive: 0xe2edd7,

  // ── Product row ──────────────────────────────────────────────
  productSlotEmpty:    0xf2e3f2,
  productTile:         0x6c02b5,  // SHIP button bg
  productTileBtnHover: 0x5a0299,  // SHIP button mouse-hover (darker)
  productTileHover:    0xf2e3f2,  // SHIP tile activation highlight

  // ── Resources row ────────────────────────────────────────────
  resSlotEmpty:   0xebdfce,
  resTile:        0x895d27,
  resTileHover:   0x724e20,
  resTileActive:  0xebdfce,

  // ── Cards ────────────────────────────────────────────────────
  cardBg:           0xffffff,
  cardPlaced:       0xffffff,
  productCardPlaced: 0xffffff,
  resCardPlaced:    0xffffff,
  cardDivider:      0xd1d1d1,  // divider line inside card visuals
  popupDivider:     0xd1d1d1,  // dividers inside card info popup

  // ── Card type colors ─────────────────────────────────────────
  typeColors: {
    'Product/Design':        0x6a9eff,
    'Engineering':           0xc4e538,
    'Sales':                 0xff6b81,
    'Investor':              0xffd32a,
    'C-Suite':               0x4C4C4C,
    'Boardmember':           0xfd84ff,
    'Services/Tech':         0x00d2d3,
  },

  // Per-type overrides for the label text on the type bar (defaults to text.onType)
  typeTextColors: {
    'C-Suite': '#ffffff',
  },

  // ── Text palette ─────────────────────────────────────────────
  text: {
    primary:    '#ffffff',  // scene titles, modal headers
    secondary:  '#4f4f4f',  // HUD labels, secondary info
    value:      '#4f4f4f',  // numeric values (HUD totals)
    muted:      '#555577',  // dimmed section headers, less-important labels
    disabled:   '#333344',  // slot placeholders, empty/unavailable states
    positive:   '#80ffaa',  // cash ops, can-afford, enabled actions, bonus notices
    cardOp:     '#1b4923',  // operation text on card face
    cardValue:  '#919191',  // card value ($Xk, bottom-right of card)
    negative:   '#ff6b6b',  // error floats: row full, need cash, wrong row
    negLight:   '#b71010',  // softer negative: unaffordable card cost indicator
    gold:       '#ffa109',  // special effects ★, valuation total, trigger floats
    boost:      '#ffa109',  // boosted op color (modified by a special effect)
    cyan:       '#0bbcbc',  // trigger effects ⚡, trigger float messages
    purple:     '#6c02b5',  // product row op label, product multiplier HUD
    onType:     '#000000',  // text on colored type bar
    cashSub:    '#41922d',  // cash row heading, subtitle, and slot labels
    resSub:     '#895d27',  // resources row heading, subtitle, and slot labels
    productSub: '#6c02b5',  // product row subtitle + product valuation row tag
    hint:       '#556677',  // hint text in modals and subtitles
    bonusTurn:  '#a33596',  // bonus turn effect icon + label
  },
};

// ── Utility functions ───────────────────────────────────────
function operationLabel(op) {
  if (op.type === 'add')      return op.value < 0 ? `${op.value}` : `+${op.value}`;
  if (op.type === 'multiply') return `\u00d7${op.value}`;
  return '?';
}

// ── Scene transition helpers ────────────────────────────────
function fadeToScene(scene, targetKey, data = {}, duration = 400) {
  scene.cameras.main.fadeOut(duration, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => {
    scene.scene.start(targetKey, data);
  });
}

// Iris transition using a persistent overlay scene that survives scene switches.
// Call irisTransition(scene, target, data) — it handles close + open seamlessly.
// floatingCardData: optional array of { card, x, y } — cards rebuilt in IrisOverlay so they
// appear to float above the iris wipe and persist until the new scene is fully visible.
function irisTransition(scene, targetKey, data = {}, closeDuration = 400, openDuration = 500, floatingCardData = null) {
  const overlay = scene.scene.get('IrisOverlay');
  overlay.runTransition(targetKey, data, closeDuration, openDuration, scene, floatingCardData);
}

// Build a card face visual — used by RoundTitleScene deal animation and IrisOverlayScene
// floating card effect. Mirrors the full card render in RoundTitleScene exactly.
function buildDealCardVisual(scene, card, x, y) {
  const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;
  const container = scene.add.container(x, y);

  const faceGfx = scene.add.graphics();
  faceGfx.fillStyle(COLORS.cardBg);
  faceGfx.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
  faceGfx.lineStyle(1, typeColor);
  faceGfx.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);

  const barGfx = scene.add.graphics();
  barGfx.fillStyle(typeColor);
  barGfx.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 12, { tl: 5, tr: 5, bl: 0, br: 0 });

  const typeLabel = scene.add.text(0, -CARD_H / 2 + 6, card.type.toUpperCase(), {
    fontSize: '7px', fontFamily: FONT_BOARD, color: COLORS.typeTextColors[card.type] || COLORS.text.onType, fontStyle: 'bold'
  }).setOrigin(0.5);

  const nameText = scene.add.text(0, -CARD_H / 2 + 42, card.name, {
    fontSize: '11px', fontFamily: FONT_CARD_NAME, color: '#000000', fontStyle: 'bold',
    align: 'center', wordWrap: { width: CARD_W - 10 }
  }).setOrigin(0.5);

  const divider = scene.add.rectangle(0, -CARD_H / 2 + 72, CARD_W - 16, 1, COLORS.cardDivider).setOrigin(0.5);

  const opText = scene.add.text(0, -CARD_H / 2 + 82, operationLabel(card.operation), {
    fontSize: '20px', fontFamily: FONT_BOARD, color: COLORS.text.cardOp, fontStyle: 'bold'
  }).setOrigin(0.5, 0);

  container.add([faceGfx, barGfx, typeLabel, nameText, divider, opText]);

  const icons = [];
  if (card.specialEffect) icons.push({ symbol: '\u2605', color: COLORS.text.gold });
  if (card.bonusTurn)     icons.push({ symbol: '+',     color: COLORS.text.bonusTurn });
  if (card.triggerEffect) icons.push({ symbol: '\u26a1', color: COLORS.text.cyan });
  if (icons.length > 0) {
    const iconY = -CARD_H / 2 + 118;
    const spacing = 20;
    const totalW = (icons.length - 1) * spacing;
    icons.forEach((ic, j) => {
      container.add(scene.add.text(-totalW / 2 + j * spacing, iconY, ic.symbol, {
        fontSize: '16px', fontFamily: FONT_BOARD, color: ic.color
      }).setOrigin(0.5));
    });
  }

  const canAfford = card.cost * 100 <= 75;
  container.add(scene.add.text(-CARD_W / 2 + 6, CARD_H / 2 - 16, `$${card.cost * 100}k`, {
    fontSize: '11px', fontFamily: FONT_BOARD, color: canAfford ? COLORS.text.cashSub : COLORS.text.negLight
  }).setOrigin(0, 0.5));

  const valStr = card.baseValue > 0 ? `$${card.baseValue}k` : '\u2014';
  container.add(scene.add.text(CARD_W / 2 - 6, CARD_H / 2 - 16, valStr, {
    fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.cardValue
  }).setOrigin(1, 0.5));

  return container;
}

// ============================================================
// IRIS OVERLAY SCENE — persistent scene that draws iris wipe on top of everything
// ============================================================
class IrisOverlayScene extends Phaser.Scene {
  constructor() { super({ key: 'IrisOverlay' }); }

  create() {
    // Full-screen black rectangle, hidden until needed
    this.overlay = this.add.graphics();
    this.overlay.setDepth(9999);
    this.overlay.setVisible(false);
  }

  drawIris(radius) {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.overlay.clear();

    if (radius <= 0) {
      // Fully closed — solid black
      this.overlay.fillStyle(0x000000, 1);
      this.overlay.fillRect(0, 0, GAME_W, GAME_H);
      return;
    }

    // Draw black border with circular cutout using even-odd fill via canvas
    // We draw 4 rects around the circle to approximate the mask
    const r = radius;
    this.overlay.fillStyle(0x000000, 1);

    // Top strip
    this.overlay.fillRect(0, 0, GAME_W, Math.max(0, cy - r));
    // Bottom strip
    this.overlay.fillRect(0, Math.min(GAME_H, cy + r), GAME_W, Math.max(0, GAME_H - (cy + r)));
    // Left strip
    this.overlay.fillRect(0, Math.max(0, cy - r), Math.max(0, cx - r), r * 2);
    // Right strip
    this.overlay.fillRect(Math.min(GAME_W, cx + r), Math.max(0, cy - r), Math.max(0, GAME_W - (cx + r)), r * 2);

    // Fill the corners around the circle with small wedge segments
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * Math.PI * 2;
      const a2 = ((i + 1) / steps) * Math.PI * 2;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r;
      const y2 = cy + Math.sin(a2) * r;

      // For each segment, fill the rectangular corner area outside the arc
      // We'll use a different approach: draw the circle border region with triangles
      // extending to the bounding box edges
      const bx1 = cx + Math.cos(a1) * (r + GAME_W);
      const by1 = cy + Math.sin(a1) * (r + GAME_H);
      const bx2 = cx + Math.cos(a2) * (r + GAME_W);
      const by2 = cy + Math.sin(a2) * (r + GAME_H);

      this.overlay.beginPath();
      this.overlay.moveTo(x1, y1);
      this.overlay.lineTo(bx1, by1);
      this.overlay.lineTo(bx2, by2);
      this.overlay.lineTo(x2, y2);
      this.overlay.closePath();
      this.overlay.fillPath();
    }
  }

  runTransition(targetKey, data, closeDuration, openDuration, callingScene, floatingCardData = null) {
    const maxR = Math.sqrt((GAME_W / 2) ** 2 + (GAME_H / 2) ** 2);
    this.scene.bringToTop();
    this.overlay.setVisible(true);

    // Build floating card copies above the iris mask (depth 10000 > overlay's 9999)
    // so they appear to survive the wipe while everything else closes around them.
    let floatingContainers = [];
    if (floatingCardData) {
      floatingCardData.forEach(({ card, x, y }) => {
        const c = buildDealCardVisual(this, card, x, y);
        c.setDepth(10000);
        floatingContainers.push(c);
      });
    }

    const progress = { r: maxR };

    // Phase 1: Iris close
    this.tweens.add({
      targets: progress,
      r: 0,
      duration: closeDuration,
      ease: 'Quad.easeIn',
      onUpdate: () => this.drawIris(progress.r),
      onComplete: () => {
        // Screen is solid black — safe to switch scenes
        this.drawIris(0);

        // Switch the underlying scene
        callingScene.scene.start(targetKey, data);

        // Phase 2: Iris open (after a brief delay for the new scene to render)
        this.time.delayedCall(50, () => {
          const openProgress = { r: 0 };
          this.tweens.add({
            targets: openProgress,
            r: maxR,
            duration: openDuration,
            ease: 'Quad.easeOut',
            onUpdate: () => this.drawIris(openProgress.r),
            onComplete: () => {
              this.overlay.clear();
              this.overlay.setVisible(false);
              // Hard-cut: GameScene hand cards are now visible at identical positions
              floatingContainers.forEach(c => c.destroy());
              floatingContainers = [];
            }
          });
        });
      }
    });
  }
}

// ============================================================
// BOOT SCENE
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() { this.load.json('cards', 'cards.json'); }

  create() {
    // Launch the persistent iris overlay (runs in parallel, always on top)
    this.scene.launch('IrisOverlay');
    this.scene.start('WelcomeScene');
  }
}

// ============================================================
// WELCOME SCENE
// ============================================================
class WelcomeScene extends Phaser.Scene {
  constructor() { super({ key: 'WelcomeScene' }); }

  create() {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    // Background
    this.cameras.main.setBackgroundColor(COLORS.sceneBg);
    this.add.rectangle(cx, cy, GAME_W, GAME_H, COLORS.sceneBg);

    // Attribution
    this.add.text(cx, cy - 264, "Andrew Schauer's", {
      fontSize: '16px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
    }).setOrigin(0.5, 0.5);

    // Large title
    this.add.text(cx, cy - 200, ' STARTUP ', {
      fontSize: '120px',
      fontFamily: '"Londrina Solid", sans-serif',
      color: COLORS.text.primary,
      align: 'center',
      padding: { right: 16 },
      shadow: { offsetX: -3, offsetY: 3, blur: 0, color: '#000000', fill: true },
    }).setOrigin(0.5, 0.5);

    // Tagline
    const taglines = [
      'Where being overvalued is the whole point.',
      'Ship fast. Scale faster. Clear it with regulators later.',
      'Change the world... and your bank account.',
      'Move fast and play cards.',
      'Get hyped for hype.',
      'Think about the social implications after the IPO.',
      'Call it AI if you want investors.',
      'Entrepreneurs can live with their parents, right?',
      'Solve a problem no one has.',
      'Your work-life balance is due for disruption.',
    ];
    const tagline = taglines[Math.floor(Math.random() * taglines.length)];
    this.add.text(cx, cy - 118, tagline, {
      fontSize: '20px',
      fontFamily: FONT_UI,
      color: COLORS.text.primary,
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5, 0.5);

    // PLAY GAME button (primary — white fill, black text)
    const playBtn = this.add.rectangle(cx, cy, 220, 52, COLORS.sceneBtnPrimary)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy, 'PLAY GAME', {
      fontSize: '18px', fontFamily: FONT_UI, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    playBtn.on('pointerover', () => playBtn.setFillStyle(COLORS.sceneBtnPrimaryHov));
    playBtn.on('pointerout',  () => playBtn.setFillStyle(COLORS.sceneBtnPrimary));
    playBtn.on('pointerdown', () => fadeToScene(this, 'RoundTitleScene', { round: 1, carryOver: null, dealCards: true }));

    // HOW TO PLAY button (secondary — white stroke, teal fill, white text)
    const tutBtn = this.add.rectangle(cx, cy + 72, 220, 52, COLORS.sceneBg)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 72, 'HOW TO PLAY', {
      fontSize: '18px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    tutBtn.on('pointerover', () => tutBtn.setFillStyle(COLORS.sceneBtnSecondHov));
    tutBtn.on('pointerout',  () => tutBtn.setFillStyle(COLORS.sceneBg));
    tutBtn.on('pointerdown', () => this.scene.start('TutorialScene'));

    // Disclaimer
    this.add.text(cx, GAME_H - 56,
      'Prototype build — expect rough edges and placeholder art.', {
        fontSize: '10px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5, 0.5);

    // Copyright
    this.add.text(cx, GAME_H - 36, '© 2026 Andrew Schauer', {
      fontSize: '10px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
    }).setOrigin(0.5, 0.5);

    // Mobile: fullscreen tap prompt
    if (IS_MOBILE) {
      const fsOverlay = this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.7)
        .setDepth(100).setInteractive();
      const fsText = this.add.text(cx, cy, 'TAP TO START', {
        fontSize: '28px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(101);
      fsOverlay.on('pointerdown', () => {
        tryFullscreen();
        fsOverlay.destroy();
        fsText.destroy();
      });
    }
  }
}

// ============================================================
// TUTORIAL SCENE
// ============================================================
class TutorialScene extends Phaser.Scene {
  constructor() { super({ key: 'TutorialScene' }); }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.sceneBg);
    this.currentPage = 1;
    this.pageObjects = [];
    this.cardsData = this.cache.json.get('cards').cards;
    this._buildPage(this.currentPage);
  }

  _clearPage() {
    this.pageObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
    this.pageObjects = [];
  }

  _buildPage(page) {
    this._clearPage();
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    // Background
    const bg = this.add.rectangle(cx, cy, GAME_W, GAME_H, COLORS.sceneBg);
    this.pageObjects.push(bg);

    if (page === 1) this._buildPage1(cx);
    if (page === 2) this._buildPage2(cx);
    if (page === 3) this._buildPage3(cx);

    this._buildNavBar(page);
  }

  _buildPage1(cx) {
    let y = 40;

    // Title
    this.pageObjects.push(
      this.add.text(cx, y, ' HOW TO PLAY ', {
        fontSize: '48px', fontFamily: '"Londrina Solid", sans-serif', color: COLORS.text.primary, align: 'center', padding: { right: 16 },
        shadow: { offsetX: -3, offsetY: 3, blur: 0, color: '#000000', fill: true },
      }).setOrigin(0.5, 0)
    );
    y += 68;

    // YOUR GOAL
    this.pageObjects.push(
      this.add.text(cx - 380, y, 'YOUR GOAL', {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
      }).setOrigin(0, 0)
    );
    y += 20;
    this.pageObjects.push(
      this.add.text(cx - 380, y,
        'Build the most valuable startup in 4 rounds. Each round gives you a limited number of turns to grow your company.', {
          fontSize: '14px', fontFamily: FONT_UI, color: COLORS.text.primary,
          wordWrap: { width: 760 }
        }).setOrigin(0, 0)
    );
    y += 46;

    // ACTIONS
    this.pageObjects.push(
      this.add.text(cx - 380, y, 'EACH TURN, PICK ONE ACTION:', {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
      }).setOrigin(0, 0)
    );
    y += 24;

    const actions = [
      { label: 'PLACE A CARD', desc: 'Drag a card from your hand into the first open spot in any row. Placing a card requires cash.' },
      { label: 'RAISE $', desc: 'Activate your Cash row to generate funding. The base payout starts small and grows each round.' },
      { label: 'RECRUIT', desc: 'Activate your Resources row to draw more cards into your hand.' },
      { label: 'SHIP', desc: 'Activate your Product row to ship your product. Each ship adds to a cumulative product multiplier used at valuation.' },
    ];

    actions.forEach(a => {
      this.pageObjects.push(
        this.add.text(cx - 356, y, a.label, {
          fontSize: '12px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
        }).setOrigin(0, 0)
      );
      this.pageObjects.push(
        this.add.text(cx - 356, y + 18, a.desc, {
          fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary,
          wordWrap: { width: 736 }
        }).setOrigin(0, 0)
      );
      y += 52;
    });
    y += 10;

    // ROWS
    this.pageObjects.push(
      this.add.text(cx - 380, y, 'ROWS', {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
      }).setOrigin(0, 0)
    );
    y += 20;
    this.pageObjects.push(
      this.add.text(cx - 380, y,
        'Placed cards trigger left to right when you activate that row. Each card\'s operation modifies the row\'s running score.', {
          fontSize: '14px', fontFamily: FONT_UI, color: COLORS.text.primary,
          wordWrap: { width: 760 }
        }).setOrigin(0, 0)
    );
    y += 46;

    // VALUATION
    this.pageObjects.push(
      this.add.text(cx - 380, y, 'VALUATION', {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
      }).setOrigin(0, 0)
    );
    y += 20;
    this.pageObjects.push(
      this.add.text(cx - 380, y,
        'At the end of each round, your startup is valued: the value of all placed cards × your product multiplier. If you never ship, your valuation is $0.', {
          fontSize: '14px', fontFamily: FONT_UI, color: COLORS.text.primary,
          wordWrap: { width: 760 }
        }).setOrigin(0, 0)
    );
  }

  _buildPage2(cx) {
    // Example card data (id 60 — "Ketamine Cowboy")
    const exCard = this.cardsData.find(c => c.id === 60);

    // Title
    this.pageObjects.push(
      this.add.text(cx, 40, ' UNDERSTANDING CARDS ', {
        fontSize: '48px', fontFamily: '"Londrina Solid", sans-serif', color: COLORS.text.primary, align: 'center', padding: { right: 16 },
        shadow: { offsetX: -3, offsetY: 3, blur: 0, color: '#000000', fill: true },
      }).setOrigin(0.5, 0)
    );

    // Subtitle
    this.pageObjects.push(
      this.add.text(cx, 108, 'Press and hold a card to see its details.', {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold', align: 'center'
      }).setOrigin(0.5, 0)
    );

    // ── Card display — drawn at 2× native dimensions for crisp rendering ──
    const S = 2; // display scale — all dimensions doubled, no container scaling
    const cW = CARD_W * S;
    const cH = CARD_H * S;
    const cardX = cx - 270;
    const cardY = GAME_H / 2;

    const typeColor = COLORS.typeColors[exCard.type] || COLORS.typeColorDefault;

    const container = this.add.container(cardX, cardY);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.cardBg);
    bg.fillRoundedRect(-cW / 2, -cH / 2, cW, cH, 5 * S);
    bg.lineStyle(1, typeColor);
    bg.strokeRoundedRect(-cW / 2, -cH / 2, cW, cH, 5 * S);

    // Type bar
    const bar = this.add.graphics();
    bar.fillStyle(typeColor);
    bar.fillRoundedRect(-cW / 2, -cH / 2, cW, 12 * S, { tl: 5 * S, tr: 5 * S, bl: 0, br: 0 });

    // Type label
    const typeLabel = this.add.text(0, -cH / 2 + 6 * S, exCard.type.toUpperCase(), {
      fontSize: `${7 * S}px`, fontFamily: FONT_BOARD, color: COLORS.typeTextColors[exCard.type] || COLORS.text.onType, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Name
    const nameText = this.add.text(0, -cH / 2 + 42 * S, exCard.name, {
      fontSize: `${11 * S}px`, fontFamily: FONT_CARD_NAME, color: '#000000', fontStyle: 'bold',
      align: 'center', wordWrap: { width: cW - 10 * S }
    }).setOrigin(0.5, 0.5);

    // Divider
    const divider = this.add.rectangle(0, -cH / 2 + 72 * S, cW - 16 * S, 1, COLORS.cardDivider).setOrigin(0.5, 0.5);

    // Operation
    const opLabel = exCard.operation.type === 'multiply'
      ? `×${exCard.operation.value}`
      : (exCard.operation.value < 0 ? `${exCard.operation.value}` : `+${exCard.operation.value}`);
    const opText = this.add.text(0, -cH / 2 + 82 * S, opLabel, {
      fontSize: `${20 * S}px`, fontFamily: FONT_BOARD, color: COLORS.text.cardOp, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0);

    container.add([bg, bar, typeLabel, nameText, divider, opText]);

    // Effect icons — ★ for special/bonus-turn, ⚡ for trigger
    const icons = [];
    if (exCard.specialEffect) icons.push({ symbol: '★', color: COLORS.text.gold });
    if (exCard.bonusTurn)     icons.push({ symbol: '+', color: COLORS.text.bonusTurn });
    if (exCard.triggerEffect) icons.push({ symbol: '⚡', color: COLORS.text.cyan });
    if (icons.length > 0) {
      const iconY   = -cH / 2 + 118 * S;
      const spacing = 20 * S;
      const startIconX = -((icons.length - 1) * spacing) / 2;
      icons.forEach((icon, i) => {
        container.add(this.add.text(startIconX + i * spacing, iconY, icon.symbol, {
          fontSize: `${18 * S}px`, fontFamily: FONT_BOARD, color: icon.color, align: 'center'
        }).setOrigin(0.5, 0.5));
      });
    }

    // Cost
    container.add(this.add.text(-cW / 2 + 6 * S, cH / 2 - 16 * S, `$${exCard.cost * 100}k`, {
      fontSize: `${11 * S}px`, fontFamily: FONT_BOARD, color: COLORS.text.negLight
    }).setOrigin(0, 0.5));

    // Value
    const valStr = exCard.baseValue > 0 ? `$${exCard.baseValue}k` : '—';
    container.add(this.add.text(cW / 2 - 6 * S, cH / 2 - 16 * S, valStr, {
      fontSize: `${11 * S}px`, fontFamily: FONT_BOARD, color: COLORS.text.cardValue
    }).setOrigin(1, 0.5));

    this.pageObjects.push(container);

    // ── Labels panel (right side, vertically aligned with card) ──
    const labelX = cx - 120;
    let labelY = cardY - CARD_H;

    const labelDefs = [
      { label: 'TYPE',              desc: 'There are 7 types of cards. Card effects may help or hinder different types.' },
      { label: 'NAME',              desc: "The card's identity — every card brings something different." },
      { label: 'OPERATOR (OP)',     desc: "When a row activates, each card's op modifies the row's running score left to right." },
      { label: '★ SPECIAL EFFECT', desc: 'A persistent bonus that applies as long as the card is on the board.' },
      { label: '⚡\uFE0E TRIGGER EFFECT', desc: 'An effect that fires in sequence when its row is activated.' },
      { label: 'COST (RED OR GREEN)', desc: 'The cash required to place this card. Green if you can afford it.' },
      { label: 'VALUE (IN SILVER)', desc: "How much a card is worth for your startup's valuation." },
    ];

    labelDefs.forEach(def => {
      const lbl = this.add.text(labelX, labelY, def.label, {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
      }).setOrigin(0, 0);
      const desc = this.add.text(labelX, labelY + 18, def.desc, {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary,
        wordWrap: { width: 500 }
      }).setOrigin(0, 0);

      this.pageObjects.push(lbl, desc);

      labelY += 18 + desc.height + 14;
    });

  }

  _buildPage3(cx) {
    let y = 40;

    // Title
    this.pageObjects.push(
      this.add.text(cx, y, " WHAT'S AHEAD ", {
        fontSize: '48px', fontFamily: '"Londrina Solid", sans-serif', color: COLORS.text.primary, align: 'center', padding: { right: 16 },
        shadow: { offsetX: -3, offsetY: 3, blur: 0, color: '#000000', fill: true },
      }).setOrigin(0.5, 0)
    );
    y += 68;

    // Subtitle
    this.pageObjects.push(
      this.add.text(cx, y, "This prototype is actively in development. Here's what's coming:", {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold', align: 'center'
      }).setOrigin(0.5, 0)
    );
    y += 36;

    const features = [
      {
        label: 'BOARD MEETINGS  (coming soon)',
        desc: 'Between rounds, spend cash on strategic upgrades — extend your runway, pivot out weak cards, or hire powerful advisors.',
      },
      {
        label: 'ECONOMIC EVENTS  (coming soon)',
        desc: 'Random market shifts between rounds that change the playing field — boom times, downturns, and industry disruptions.',
      },
      {
        label: '...AND MORE',
        desc: 'Story elements, game art, card art, and additional card effects are all on the roadmap.',
      },
    ];

    features.forEach(f => {
      this.pageObjects.push(
        this.add.text(cx - 380, y, f.label, {
          fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold'
        }).setOrigin(0, 0)
      );
      y += 22;
      this.pageObjects.push(
        this.add.text(cx - 380, y, f.desc, {
          fontSize: '14px', fontFamily: FONT_UI, color: COLORS.text.primary,
          wordWrap: { width: 760 }
        }).setOrigin(0, 0)
      );
      y += 56;
    });

    // CTA lead-in
    y += 10;
    this.pageObjects.push(
      this.add.text(cx, y, 'Ready to build your startup?', {
        fontSize: '16px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5, 0)
    );
    y += 40;

    // PLAY GAME button (primary — white fill, black text)
    const playBtn = this.add.rectangle(cx, y + 24, 220, 52, COLORS.sceneBtnPrimary)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, y + 24, 'PLAY GAME', {
      fontSize: '18px', fontFamily: FONT_UI, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    playBtn.on('pointerover', () => playBtn.setFillStyle(COLORS.sceneBtnPrimaryHov));
    playBtn.on('pointerout',  () => playBtn.setFillStyle(COLORS.sceneBtnPrimary));
    playBtn.on('pointerdown', () => fadeToScene(this, 'RoundTitleScene', { round: 1, carryOver: null, dealCards: true }));
    this.pageObjects.push(playBtn);
  }

  _buildNavBar(page) {
    const navY = GAME_H - 36;
    const cx = GAME_W / 2;

    // Page indicator
    const indicator = this.add.text(cx, navY, `${page} / 3`, {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
    }).setOrigin(0.5, 0.5);
    this.pageObjects.push(indicator);

    // BACK button (secondary — white stroke, teal fill, white text)
    const backBg = this.add.rectangle(80, navY, 130, 40, COLORS.sceneBg)
      .setStrokeStyle(1, 0xffffff).setInteractive({ useHandCursor: true });
    const backLbl = this.add.text(80, navY, '← BACK', {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary
    }).setOrigin(0.5, 0.5);
    backBg.on('pointerover', () => backBg.setFillStyle(COLORS.sceneBtnSecondHov));
    backBg.on('pointerout',  () => backBg.setFillStyle(COLORS.sceneBg));
    backBg.on('pointerdown', () => {
      if (page === 1) {
        this.scene.start('WelcomeScene');
      } else {
        this.currentPage -= 1;
        this._buildPage(this.currentPage);
      }
    });
    this.pageObjects.push(backBg, backLbl);

    // NEXT button (primary — white fill, black text)
    if (page < 3) {
      const nextBg = this.add.rectangle(GAME_W - 80, navY, 130, 40, COLORS.sceneBtnPrimary)
        .setInteractive({ useHandCursor: true });
      const nextLbl = this.add.text(GAME_W - 80, navY, 'NEXT →', {
        fontSize: '13px', fontFamily: FONT_UI, color: '#000000'
      }).setOrigin(0.5, 0.5);
      nextBg.on('pointerover', () => nextBg.setFillStyle(COLORS.sceneBtnPrimaryHov));
      nextBg.on('pointerout',  () => nextBg.setFillStyle(COLORS.sceneBtnPrimary));
      nextBg.on('pointerdown', () => {
        this.currentPage += 1;
        this._buildPage(this.currentPage);
      });
      this.pageObjects.push(nextBg, nextLbl);
    }
  }
}

// ============================================================
// ROUND TITLE SCENE
// ============================================================
class RoundTitleScene extends Phaser.Scene {
  constructor() { super({ key: 'RoundTitleScene' }); }

  create() {
    const { round, carryOver, dealCards } = this.scene.settings.data || {};
    this.scene.settings.data = {};

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor(COLORS.sceneBg);
    this.children.removeAll(true);

    const cx = GAME_W / 2;
    const cardsData = this.cache.json.get('cards').cards;

    // Count cards available this round
    const maxCost = MAX_COST_PER_ROUND[(round || 1) - 1];
    const totalCards = cardsData.filter(c => c.cost <= maxCost).length;

    // Turn count
    const baseTurns = TURNS_PER_ROUND[(round || 1) - 1];
    const bonusTurns = carryOver ? (carryOver.totalBonusTurns ?? 0) : 0;
    const totalTurns = baseTurns + bonusTurns;
    const bonusLabel = bonusTurns > 0 ? ` (+${bonusTurns} bonus)` : '';

    // ── Layout ──────────────────────────────────────────────
    // "ROUND X"
    this.add.text(cx, 270, ` ROUND ${round || 1} `, {
      fontSize: '72px', fontFamily: '"Londrina Solid", sans-serif', color: COLORS.text.primary, padding: { right: 16 },
      shadow: { offsetX: -3, offsetY: 3, blur: 0, color: '#000000', fill: true },
    }).setOrigin(0.5);

    // Deck label
    const deckLabel = maxCost !== Infinity
      ? (maxCost <= 1
        ? `Garage deck \u2014 ${totalCards} cards, up to $100k`
        : `Seed deck \u2014 ${totalCards} cards, up to $${maxCost * 100}k`)
      : (round >= 4
        ? `Full deck \u2014 all cards unlocked`
        : `All cards except C-Suite cards unlocked`);
    this.add.text(cx, 322, deckLabel, {
      fontSize: '16px', fontFamily: FONT_UI, color: COLORS.text.primary
    }).setOrigin(0.5);

    // Turn count
    this.add.text(cx, 344, `${totalTurns} Turns${bonusLabel}`, {
      fontSize: '16px', fontFamily: FONT_UI, color: COLORS.text.primary
    }).setOrigin(0.5);

    // ── Select bonus goal for this round ────────────────────
    const goalPool = ROUND_GOALS[(round || 1) - 1] || [];
    const selectedGoal = goalPool.length > 0
      ? goalPool[Math.floor(Math.random() * goalPool.length)]
      : null;

    if (selectedGoal) {
      // Goal display
      this.add.text(cx, 416, 'STRETCH GOAL', {
        fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5);

      this.add.text(cx, 437, selectedGoal.desc, {
        fontSize: '16px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5);

      const rewardLabel = selectedGoal.rewardType === 'csuite' ? 'Reward: C-Suite card' : `Reward: +$${GOAL_R4_VALUE_BONUS}k to every card`;
      this.add.text(cx, 460, rewardLabel, {
        fontSize: '12px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5);
    }

    // ── Deal animation (round 1 only) ───────────────────────
    if (dealCards && !carryOver) {
      // Build filtered deck for round 1
      const eligibleIds = cardsData.filter(c => c.cost <= MAX_COST_PER_ROUND[0]).map(c => c.id);
      const shuffled = [...eligibleIds].sort(() => Math.random() - 0.5);

      const hand = shuffled.slice(0, 4);
      const revealedCards = shuffled.slice(4, 6);
      const drawPile = shuffled.slice(6);

      // Pre-built state to pass to GameScene
      this.preBuiltState = {
        round:        1,
        turn:         1,
        maxTurns:     TURNS_PER_ROUND[0],
        cash:         75,
        hand,
        cashRow:        [null, null, null, null, null],
        productRow:     [null, null, null, null, null],
        resourcesRow:   [null, null, null, null, null],
        drawPile,
        revealedCards,
        phase:          'playing',
        cardOpBoosts:   {},
        valueBonuses:   {},
        productMultiplier: 0,
        totalBonusTurns: 0,
        freePlay: false,
        freePlayRow: null,
        goalValueBonusApplied: false,
      };

      // "Dealing your opening hand..."
      this.add.text(322, 610, 'Dealing your\nopening hand\u2026', {
        fontSize: '14px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'italic', align: 'left'
      }).setOrigin(0, 0.5);

      // Card placeholders — positioned to match the hand carousel in GameScene
      const cardSpacing = CARD_W + 8;
      const windowW     = CAROUSEL_VISIBLE * (CARD_W + 8) - 8;
      const carouselStartX = (GAME_W - windowW) / 2 + 33;
      const cardsTotalW = 4 * cardSpacing - 8;
      const startX = carouselStartX + (windowW - cardsTotalW) / 2 + CARD_W / 2;
      const cardY = 623;

      const placeholders = [];
      for (let i = 0; i < 4; i++) {
        const x = startX + i * cardSpacing;

        // Card back (placeholder)
        const back = this.add.container(x, cardY);
        const backGfx = this.add.graphics();
        backGfx.fillStyle(COLORS.cardBackFill);
        backGfx.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
        const backText = this.add.text(0, 0, '?', {
          fontSize: '36px', fontFamily: FONT_BOARD, color: '#0F555A', fontStyle: 'bold'
        }).setOrigin(0.5);
        back.add([backGfx, backText]);

        // Card face (hidden initially)
        const card = cardsData.find(c => c.id === hand[i]);
        const face = this.add.container(x, cardY);
        face.setScale(0, 1);

        const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;

        // Rounded background
        const faceGfx = this.add.graphics();
        faceGfx.fillStyle(COLORS.cardBg);
        faceGfx.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
        faceGfx.lineStyle(1, typeColor);
        faceGfx.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);

        // Type bar (rounded top corners)
        const barGfx = this.add.graphics();
        barGfx.fillStyle(typeColor);
        barGfx.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 12, { tl: 5, tr: 5, bl: 0, br: 0 });

        const typeLabel = this.add.text(0, -CARD_H / 2 + 6, card.type.toUpperCase(), {
          fontSize: '7px', fontFamily: FONT_BOARD, color: COLORS.typeTextColors[card.type] || COLORS.text.onType, fontStyle: 'bold'
        }).setOrigin(0.5);

        const nameText = this.add.text(0, -CARD_H / 2 + 42, card.name, {
          fontSize: '11px', fontFamily: FONT_CARD_NAME, color: '#000000', fontStyle: 'bold',
          align: 'center', wordWrap: { width: CARD_W - 10 }
        }).setOrigin(0.5);

        const divider = this.add.rectangle(0, -CARD_H / 2 + 72, CARD_W - 16, 1, COLORS.cardDivider)
          .setOrigin(0.5);

        const opText = this.add.text(0, -CARD_H / 2 + 82, operationLabel(card.operation), {
          fontSize: '20px', fontFamily: FONT_BOARD, color: COLORS.text.cardOp, fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        face.add([faceGfx, barGfx, typeLabel, nameText, divider, opText]);

        // Effect icons
        const icons = [];
        if (card.specialEffect) icons.push({ symbol: '\u2605', color: COLORS.text.gold });
        if (card.bonusTurn)     icons.push({ symbol: '+', color: COLORS.text.bonusTurn });
        if (card.triggerEffect)                   icons.push({ symbol: '\u26a1', color: COLORS.text.cyan });
        if (icons.length > 0) {
          const iconY = -CARD_H / 2 + 118;
          const spacing = 20;
          const totalW = (icons.length - 1) * spacing;
          icons.forEach((ic, j) => {
            face.add(this.add.text(-totalW / 2 + j * spacing, iconY, ic.symbol, {
              fontSize: '16px', fontFamily: FONT_BOARD, color: ic.color
            }).setOrigin(0.5));
          });
        }

        // Cost (bottom-left, green if affordable with starting cash)
        const startingCash = 75;
        const canAfford = card.cost * 100 <= startingCash;
        face.add(this.add.text(-CARD_W / 2 + 6, CARD_H / 2 - 16, `$${card.cost * 100}k`, {
          fontSize: '11px', fontFamily: FONT_BOARD, color: canAfford ? COLORS.text.cashSub : COLORS.text.negLight
        }).setOrigin(0, 0.5));

        // Value (bottom-right)
        const valStr = card.baseValue > 0 ? `$${card.baseValue}k` : '\u2014';
        face.add(this.add.text(CARD_W / 2 - 6, CARD_H / 2 - 16, valStr, {
          fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.cardValue
        }).setOrigin(1, 0.5));

        placeholders.push({ back, face });
      }

      // Stagger-reveal each card
      for (let i = 0; i < 4; i++) {
        const delay = 800 + i * 600;
        const { back, face } = placeholders[i];

        this.time.delayedCall(delay, () => {
          // Flip back out
          this.tweens.add({
            targets: back,
            scaleX: 0,
            duration: 150,
            ease: 'Quad.easeIn',
            onComplete: () => {
              back.setVisible(false);
              // Flip face in
              this.tweens.add({
                targets: face,
                scaleX: 1,
                duration: 150,
                ease: 'Quad.easeOut',
              });
            }
          });
        });
      }

      // After all cards revealed, iris-close then iris-open on GameScene.
      // Pass floating card data so IrisOverlay keeps the cards visible above the wipe.
      const totalDelay = 800 + 3 * 600 + 300 + 1500; // last card flip + pause
      this.time.delayedCall(totalDelay, () => {
        const floatingCardData = hand.map((id, i) => ({
          card: cardsData.find(c => c.id === id),
          x:    startX + i * cardSpacing,
          y:    cardY,
        }));
        irisTransition(this, 'GameScene', { preBuiltState: this.preBuiltState, currentGoal: selectedGoal }, 400, 500, floatingCardData);
      });

    } else {
      // ── Rounds 2+ (no card deal) — auto-advance after delay ──────────
      this.time.delayedCall(4000, () => {
        irisTransition(this, 'GameScene', { carryOver, currentGoal: selectedGoal });
      });
    }
  }
}

// ============================================================
// GAME SCENE
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    // Read startup data from settings.data — Phaser sets this on every scene.start()
    const preBuilt = this.scene.settings.data?.preBuiltState || null;
    const carryOver = this.scene.settings.data?.carryOver || null;
    const incomingGoal = this.scene.settings.data?.currentGoal || null;

    // Wipe settings.data immediately so a subsequent restart with no data doesn't reuse it.
    this.scene.settings.data = {};

    this.children.removeAll(true);   // destroy any leftover display objects
    this.cardsData = this.cache.json.get('cards').cards;

    if (preBuilt) {
      // State pre-built by RoundTitleScene (round 1 card deal)
      this.state = { ...preBuilt };
    } else if (carryOver) {
      const round = carryOver.round + 1;
      this.state = {
        round,
        turn:         1,
        maxTurns:     TURNS_PER_ROUND[round - 1] + (carryOver.totalBonusTurns ?? 0),
        cash:         carryOver.cash,
        hand:         [...carryOver.hand],
        cashRow:        [...carryOver.cashRow],
        productRow:     [...carryOver.productRow],
        resourcesRow:   [...carryOver.resourcesRow],
        drawPile:       [...carryOver.drawPile],
        revealedCards:  [...carryOver.revealedCards],
        phase:          'playing',
        cardOpBoosts:   { ...(carryOver.cardOpBoosts || {}) },
        valueBonuses:   { ...(carryOver.valueBonuses || {}) },
        productMultiplier: carryOver.productMultiplier,
        totalBonusTurns: carryOver.totalBonusTurns ?? 0,
        freePlay: false,
        freePlayRow: null,
        goalValueBonusApplied: false,
      };

      // Inject newly eligible cards into the draw pile when cost threshold increases
      const prevMaxCost = MAX_COST_PER_ROUND[round - 2];
      const currMaxCost = MAX_COST_PER_ROUND[round - 1];
      if (currMaxCost > prevMaxCost) {
        const inGame = new Set([
          ...this.state.hand,
          ...this.state.cashRow.filter(Boolean),
          ...this.state.productRow.filter(Boolean),
          ...this.state.resourcesRow.filter(Boolean),
          ...this.state.drawPile,
          ...this.state.revealedCards,
        ]);
        const newCards = this.cardsData
          .filter(c => c.cost > prevMaxCost && c.cost <= currMaxCost && !inGame.has(c.id))
          .filter(c => round <= 3 ? c.type !== 'C-Suite' : true)   // C-Suites withheld until Round 4
          .map(c => c.id);
        this.state.drawPile.push(...newCards);
        this.state.drawPile.sort(() => Math.random() - 0.5);
      }

      // Round 4: inject C-Suite cards that were withheld from earlier rounds
      if (round === 4) {
        const inGame = new Set([
          ...this.state.hand,
          ...this.state.cashRow.filter(Boolean),
          ...this.state.productRow.filter(Boolean),
          ...this.state.resourcesRow.filter(Boolean),
          ...this.state.drawPile,
          ...this.state.revealedCards,
        ]);
        const csuiteCards = this.cardsData
          .filter(c => c.type === 'C-Suite' && !inGame.has(c.id))
          .map(c => c.id);
        if (csuiteCards.length > 0) {
          this.state.drawPile.push(...csuiteCards);
          this.state.drawPile.sort(() => Math.random() - 0.5);
        }
      }
    } else {
      // Fresh game — shuffle cost-eligible deck, deal 4 to hand, 2 face-up, rest to draw pile
      const maxCost = MAX_COST_PER_ROUND[0];
      const eligibleIds = this.cardsData.filter(c => c.cost <= maxCost).map(c => c.id);
      const shuffled = [...eligibleIds].sort(() => Math.random() - 0.5);
      this.state = {
        round:        1,
        turn:         1,
        maxTurns:     TURNS_PER_ROUND[0],
        cash:         75,
        hand:         shuffled.slice(0, 4),
        cashRow:        [null, null, null, null, null],
        productRow:     [null, null, null, null, null],
        resourcesRow:   [null, null, null, null, null],
        drawPile:       shuffled.slice(6),
        revealedCards:  shuffled.slice(4, 6),
        phase:          'playing',
        cardOpBoosts:   {},
        valueBonuses:   {},
        productMultiplier: 0,
        totalBonusTurns: 0,
        freePlay: false,
        freePlayRow: null,
        goalValueBonusApplied: false,
      };
    }

    // ── Goal tracking (reset each round) ──────────────────────
    this.state.currentGoal          = incomingGoal;
    this.state.goalMet              = false;
    this.state.cardsPlacedThisRound = 0;
    this.state.typesPlacedThisRound = new Set();
    this.state.typePlacedCounts     = new Map();
    this.state.timesShippedThisRound = 0;
    this.state.peakHandSize         = this.state.hand.length;
    this.state.peakCash             = this.state.cash;

    this.cardObjects     = {};
    this.slotObjects         = [];
    this.productSlotObjects  = [];
    this.resSlotObjects      = [];
    this.handOffset          = 0;
    this.drawModal           = null;
    this.pendingDrawCount    = 0;
    this.triggerModal        = null;
    this.drawPileViewerModal = null;

    this.buildLayout();
    this.setupDragHandlers();

    if (carryOver) {
      this.restoreCarryOverState();
      this.refreshBoardOpLabels();
    this.refreshBoardValueLabels();
    }

    this.renderHand();
    this.updateHUD();

  }

  // ── Layout ────────────────────────────────────────────────
  buildLayout() {
    // Left panel — top aligns with product row slots, bottom aligns with hand cards
    const panelTop = ROW_PROD_Y - SLOT_H / 2;
    const panelBot = 623 + CARD_H / 2;
    const panelH   = panelBot - panelTop;
    const panelCY  = (panelTop + panelBot) / 2;
    this.add.rectangle(137, panelCY + 6, 240, panelH, 0x000000).setAlpha(0.6).setOrigin(0.5, 0.5);
    this.add.rectangle(140, panelCY, 240, panelH, COLORS.panel).setOrigin(0.5, 0.5);

    // Round / turn
    this.hudRound = this.add.text(140, 50, '', {
      fontSize: '18px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudTurnsLabel = this.add.text(140, 84, 'TURNS', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);
    this.buildTurnBoxes(102);

    // Divider after round/turn block
    this.add.rectangle(140, 120, 180, 1, COLORS.divider).setOrigin(0.5, 0.5);

    // Team Value (sum of all card baseValues on board)
    this.add.text(140, 136, 'TEAM VALUE', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudTeamValue = this.add.text(140, 160, '$0k', {
      fontSize: '24px', fontFamily: FONT_BOARD, color: COLORS.text.value, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Divider
    this.add.rectangle(140, 184, 180, 1, COLORS.divider).setOrigin(0.5, 0.5);

    // Product multiplier
    this.add.text(140, 198, 'PRODUCT MULT', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudProductMultiplier = this.add.text(140, 222, '0×', {
      fontSize: '28px', fontFamily: FONT_BOARD, color: COLORS.text.purple, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // ── Bottom section of rail ────────────────────────────────

    // Cash (in cost red)
    this.add.text(140, GAME_H - 200, 'YOUR CASH', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudCash = this.add.text(140, GAME_H - 176, '', {
      fontSize: '24px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Divider
    this.add.rectangle(140, GAME_H - 152, 180, 1, COLORS.divider).setOrigin(0.5, 0.5);

    // Draw pile counter
    this.add.text(140, GAME_H - 136, 'DRAW PILE', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);
    this.hudDrawPile = this.add.text(140, GAME_H - 114, '-- cards', {
      fontSize: '18px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Eye button to preview draw pile
    const eyeBg = this.add.rectangle(140, GAME_H - 78, 96, 36, COLORS.panel)
      .setStrokeStyle(1, 0x895d27).setInteractive({ useHandCursor: true });
    this.add.text(140, GAME_H - 78, '👁 PREVIEW', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, align: 'center'
    }).setOrigin(0.5, 0.5);
    eyeBg.on('pointerover', () => eyeBg.setFillStyle(COLORS.cardBackLight));
    eyeBg.on('pointerout',  () => eyeBg.setFillStyle(COLORS.panel));
    eyeBg.on('pointerdown', () => this.showDrawPileViewer());

    // Rows
    this.buildProductRow();
    this.buildCashRow();
    this.buildResourcesRow();

    // Hand area
    this.handLabel = this.add.text(GAME_W / 2 + 33, 523, 'YOUR CARDS', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);

    this.handCounter = null;

    const windowW    = CAROUSEL_VISIBLE * (CARD_W + 8) - 8;
    const windowStartX = (GAME_W - windowW) / 2 + 33;
    const arrowY     = 623;
    this.arrowLeft  = this.buildArrow(windowStartX - 22, arrowY, '◀');
    this.arrowRight = this.buildArrow(windowStartX + windowW + 22, arrowY, '▶');

    // ── Goal panel (right of rows) ──────────��─────────────────
    this.buildGoalPanel();
  }

  buildArrow(x, y, symbol) {
    const btn = this.add.text(x, y, symbol, {
      fontSize: '28px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5).setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-22, -22, 44, 44),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    btn.on('pointerover', () => { if (!btn.disabled) btn.setColor(COLORS.text.primary); });
    btn.on('pointerout',  () => { if (!btn.disabled) btn.setColor(COLORS.text.secondary); });
    btn.on('pointerdown', () => {
      if (btn.disabled) return;
      if (symbol === '◀') this.scrollHand(-1);
      else                this.scrollHand(+1);
    });

    return btn;
  }

  buildGoalPanel() {
    const goal = this.state.currentGoal;
    // Initialize refs even if no goal, so updateGoalPanel doesn't error
    this.goalPanelBg   = null;
    this.goalCheckbox  = null;
    this.goalCheckText = null;

    if (!goal) return;

    // Position: right of the last slot column, top aligned with the HUD turn label
    const panelX = GAME_W - 110;
    const panelY = 130;
    const panelW = 180;
    const panelH = 120;

    // "STRETCH GOAL" header
    this.add.text(panelX, panelY - panelH / 2 + 14, 'STRETCH GOAL', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, align: 'center'
    }).setOrigin(0.5, 0.5);

    // Checkbox + description row
    const checkY = panelY - 28;
    const checkSize = 16;

    // Checkbox — centered on the first line of the description text
    const cbCenterY = checkY + checkSize / 2;
    const cbBg = this.add.rectangle(panelX - panelW / 2 + 20, cbCenterY, checkSize, checkSize, 0xffffff)
      .setStrokeStyle(1, 0x4f4f4f).setOrigin(0.5, 0.5);
    this.goalCheckbox = cbBg;

    // Checkmark (hidden until goal met)
    this.goalCheckText = this.add.text(panelX - panelW / 2 + 20, cbCenterY, '', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    if (this.state.goalMet) {
      this.goalCheckText.setText('✓');
    }

    // Goal description — top of text aligned at checkY; wraps downward
    const descText = this.add.text(panelX - panelW / 2 + 36, checkY, goal.desc, {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.secondary,
      wordWrap: { width: panelW - 48 }
    }).setOrigin(0, 0);

    // Reward label — below the full description block
    const rewardStr = goal.rewardType === 'csuite' ? 'Reward: C-Suite card' : 'Reward: Value bonus';
    this.add.text(panelX - panelW / 2 + 36, checkY + descText.height + 8, rewardStr, {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.secondary
    }).setOrigin(0, 0);
  }

  buildTurnBoxes(y) {
    const maxTurns = this.state.maxTurns;
    const BOX = 14;
    const GAP = 4;
    const totalW = maxTurns * BOX + (maxTurns - 1) * GAP;
    const startX = 140 - totalW / 2 + BOX / 2;

    this.turnBoxes = [];
    for (let i = 0; i < maxTurns; i++) {
      const x = startX + i * (BOX + GAP);
      const box   = this.add.rectangle(x, y, BOX, BOX, 0xffffff);
      const check = this.add.text(x, y, '✓', {
        fontSize: '10px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, fontStyle: 'bold'
      }).setOrigin(0.5, 0.5).setVisible(false);
      this.turnBoxes.push({ box, check });
    }
  }

  rebuildTurnBoxes() {
    this.turnBoxes.forEach(({ box, check }) => {
      box.destroy();
      check.destroy();
    });
    this.turnBoxes = [];
    this.buildTurnBoxes(102);
  }

  // ── Product Row (active, top) ────────────────────────────
  buildProductRow() {
    const rowY   = ROW_PROD_Y;
    const startX = ROW_SLOT_X;

    this.buildProductActivateTile(ACTIVATE_TILE_X, rowY);

    this.productSlotObjects = [];
    for (let i = 0; i < 5; i++) {
      const x = startX + i * (SLOT_W + 8);
      this.productSlotObjects.push(this.buildProductSlot(x, rowY, i));
    }
  }

  buildProductActivateTile(x, y) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 104, SLOT_H, 0x000000, 0);

    const title = this.add.text(0, -40, 'Product', {
      fontSize: '16px', fontFamily: FONT_BOARD, color: COLORS.text.purple, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    const subtitle = this.add.text(0, -18, 'Base: 1×', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.productSub, align: 'center'
    }).setOrigin(0.5, 0.5);

    const btnBg = this.add.rectangle(0, 20, 96, 36, COLORS.productTile);
    const btnText = this.add.text(0, 20, 'SHIP', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.primary, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, title, subtitle, btnBg, btnText]);
    container.tileBg = bg;
    container.btnBg  = btnBg;

    container.setInteractive(
      new Phaser.Geom.Rectangle(-52, -SLOT_H / 2, 104, SLOT_H),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerover', () => {
      if (this.state.phase === 'playing') btnBg.setFillStyle(COLORS.productTileBtnHover);
    });
    container.on('pointerout',  () => btnBg.setFillStyle(COLORS.productTile));
    container.on('pointerdown', () => this.onActivateProductClicked());

    this.productActivateTile = container;
  }

  buildProductSlot(x, y, index) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, COLORS.productSlotEmpty);

    const label = this.add.text(0, SLOT_H / 2 - 20, `SLOT ${index + 1}`, {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.purple, align: 'center'
    }).setOrigin(0.5, 1);

    container.add([bg, label]);
    container.slotBg    = bg;
    container.slotLabel = label;
    container.slotIndex = index;
    container.cardId    = null;

    const zone = this.add.zone(x, y, SLOT_W, SLOT_H).setRectangleDropZone(SLOT_W, SLOT_H);
    zone.rowType   = 'product';
    zone.slotIndex = index;
    zone.on('pointerdown', (pointer) => {
      if (!container.cardId) return;
      const card = this.cardsData.find(c => c.id === container.cardId);
      if (!card) return;
      this._holdOriginX = pointer.x;
      this._holdOriginY = pointer.y;
      this._holdTimer = this.time.delayedCall(300, () => {
        this._holdTimer = null;
        this.showCardInfoPopup(card, container.x, container.y, SLOT_H);
      });
    });

    return container;
  }

  // ── Cash Row (active, bottom) ─────────────────────────────
  buildCashRow() {
    const rowY   = ROW_CASH_Y;
    const startX = ROW_SLOT_X;

    // 5 slots
    this.slotObjects = [];
    for (let i = 0; i < 5; i++) {
      const x = startX + i * (SLOT_W + 8);
      this.slotObjects.push(this.buildSlot(x, rowY, i));
    }

    // Activation tile
    this.buildActivateTile(ACTIVATE_TILE_X, rowY);
  }

  buildSlot(x, y, index) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, COLORS.slotEmpty);

    const label = this.add.text(0, SLOT_H / 2 - 20, `SLOT ${index + 1}`, {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub, align: 'center'
    }).setOrigin(0.5, 1);

    container.add([bg, label]);
    container.slotBg    = bg;
    container.slotLabel = label;
    container.slotIndex = index;
    container.cardId    = null;

    const zone = this.add.zone(x, y, SLOT_W, SLOT_H).setRectangleDropZone(SLOT_W, SLOT_H);
    zone.rowType   = 'cash';
    zone.slotIndex = index;
    zone.on('pointerdown', (pointer) => {
      if (!container.cardId) return;
      const card = this.cardsData.find(c => c.id === container.cardId);
      if (!card) return;
      this._holdOriginX = pointer.x;
      this._holdOriginY = pointer.y;
      this._holdTimer = this.time.delayedCall(300, () => {
        this._holdTimer = null;
        this.showCardInfoPopup(card, container.x, container.y, SLOT_H);
      });
    });

    return container;
  }

  buildActivateTile(x, y) {
    const container = this.add.container(x, y);

    // Row background (full height, dark — acts as row heading panel)
    const bg = this.add.rectangle(0, 0, 104, SLOT_H, 0x000000, 0);

    // Title
    const title = this.add.text(0, -40, 'Cash', {
      fontSize: '16px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Subtitle
    const subtitle = this.add.text(0, -18, `Base: $${BASE_CASH_PER_ROUND[0]}k`, {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub, align: 'center'
    }).setOrigin(0.5, 0.5);
    this.cashSubtitle = subtitle;

    // Button
    const btnBg = this.add.rectangle(0, 20, 96, 36, COLORS.activateTile);
    const btnText = this.add.text(0, 20, 'RAISE $', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.primary, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, title, subtitle, btnBg, btnText]);
    container.tileBg = bg;
    container.btnBg  = btnBg;

    container.setInteractive(
      new Phaser.Geom.Rectangle(-52, -SLOT_H / 2, 104, SLOT_H),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerover', () => {
      if (this.state.phase === 'playing') btnBg.setFillStyle(COLORS.activateHover);
    });
    container.on('pointerout',  () => btnBg.setFillStyle(COLORS.activateTile));
    container.on('pointerdown', () => this.onActivateClicked());

    this.activateTile = container;
  }

  // ── Resources Row (active, draws cards) ───────────────────
  buildResourcesRow() {
    const rowY   = ROW_RES_Y;
    const startX = ROW_SLOT_X;

    // 5 slots
    this.resSlotObjects = [];
    for (let i = 0; i < 5; i++) {
      const x = startX + i * (SLOT_W + 8);
      this.resSlotObjects.push(this.buildResSlot(x, rowY, i));
    }

    // HIRE activation tile
    this.buildHireTile(ACTIVATE_TILE_X, rowY);
  }

  buildResSlot(x, y, index) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, COLORS.resSlotEmpty);

    const label = this.add.text(0, SLOT_H / 2 - 20, `SLOT ${index + 1}`, {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, align: 'center'
    }).setOrigin(0.5, 1);

    container.add([bg, label]);
    container.slotBg    = bg;
    container.slotLabel = label;
    container.slotIndex = index;
    container.cardId    = null;

    const zone = this.add.zone(x, y, SLOT_W, SLOT_H).setRectangleDropZone(SLOT_W, SLOT_H);
    zone.rowType   = 'resources';
    zone.slotIndex = index;
    zone.on('pointerdown', (pointer) => {
      if (!container.cardId) return;
      const card = this.cardsData.find(c => c.id === container.cardId);
      if (!card) return;
      this._holdOriginX = pointer.x;
      this._holdOriginY = pointer.y;
      this._holdTimer = this.time.delayedCall(300, () => {
        this._holdTimer = null;
        this.showCardInfoPopup(card, container.x, container.y, SLOT_H);
      });
    });

    return container;
  }

  buildHireTile(x, y) {
    const container = this.add.container(x, y);

    // Row background (full height, dark — acts as row heading panel)
    const bg = this.add.rectangle(0, 0, 104, SLOT_H, 0x000000, 0);

    // Title
    const title = this.add.text(0, -40, 'Resources', {
      fontSize: '16px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Subtitle
    const subtitle = this.add.text(0, -18, 'Base: 1 draw', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, align: 'center'
    }).setOrigin(0.5, 1);

    // Button
    const btnBg = this.add.rectangle(0, 20, 96, 36, COLORS.resTile);
    const btnText = this.add.text(0, 20, 'RECRUIT', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.primary, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, title, subtitle, btnBg, btnText]);
    container.tileBg = bg;
    container.btnBg  = btnBg;

    container.setInteractive(
      new Phaser.Geom.Rectangle(-52, -SLOT_H / 2, 104, SLOT_H),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerover', () => {
      if (this.state.phase === 'playing') btnBg.setFillStyle(COLORS.resTileHover);
    });
    container.on('pointerout',  () => btnBg.setFillStyle(COLORS.resTile));
    container.on('pointerdown', () => this.onHireClicked());

    this.hireTile = container;
  }

  // ── Carry-over state restore ──────────────────────────────
  restoreCarryOverState() {
    this.state.cashRow.forEach((id, i) => {
      if (id) this.renderSlotCard(i, this.cardsData.find(c => c.id === id));
    });
    this.state.productRow.forEach((id, i) => {
      if (id) this.renderProductSlotCard(i, this.cardsData.find(c => c.id === id));
    });
    this.state.resourcesRow.forEach((id, i) => {
      if (id) this.renderResSlotCard(i, this.cardsData.find(c => c.id === id));
    });
  }

  // ── Hand Rendering ────────────────────────────────────────
  scrollHand(delta) {
    const ids = this.state.hand;
    const maxOffset = Math.max(0, ids.length - CAROUSEL_VISIBLE);
    const newOffset = Math.max(0, Math.min(maxOffset, this.handOffset + delta));
    if (newOffset === this.handOffset) return;

    // Lock arrows for the duration of the animation
    this.setArrowState(this.arrowLeft,  false);
    this.setArrowState(this.arrowRight, false);

    const windowW   = CAROUSEL_VISIBLE * (CARD_W + 8) - 8;
    const startX    = (GAME_W - windowW) / 2 + 33;
    const handY     = 623;
    const slotX     = i => startX + i * (CARD_W + 8) + CARD_W / 2;
    const slideLeft = delta > 0;  // cards move left when scrolling right

    const oldVisible = ids.slice(this.handOffset, this.handOffset + CAROUSEL_VISIBLE);
    const newVisible = ids.slice(newOffset,        newOffset        + CAROUSEL_VISIBLE);

    const exiting  = oldVisible.filter(id => !newVisible.includes(id));
    const staying  = oldVisible.filter(id =>  newVisible.includes(id));
    const entering = newVisible.filter(id => !oldVisible.includes(id));

    const exitX  = slideLeft ? startX - CARD_W               : startX + windowW + CARD_W;
    const enterX = slideLeft ? startX + windowW + CARD_W / 2 : startX - CARD_W / 2;

    // Slide exiting cards off screen and destroy
    exiting.forEach(id => {
      const obj = this.cardObjects[id];
      if (!obj) return;
      this.tweens.add({
        targets: obj, alpha: 0,
        ...(CAROUSEL_EXIT_SLIDE ? { x: exitX } : {}),
        duration: CAROUSEL_SLIDE_MS, ease: 'Quad.easeInOut',
        onComplete: () => obj.destroy()
      });
      delete this.cardObjects[id];
    });

    // Slide staying cards to their new slot positions
    staying.forEach(id => {
      this.tweens.add({
        targets: this.cardObjects[id],
        x: slotX(newVisible.indexOf(id)),
        duration: CAROUSEL_SLIDE_MS, ease: 'Quad.easeInOut',
      });
    });

    // Spawn entering cards off-screen and slide them in
    entering.forEach(id => {
      const card = this.cardsData.find(c => c.id === id);
      const obj  = this.buildCardVisual(card, enterX, handY, true);
      obj.setAlpha(0);
      this.cardObjects[id] = obj;
      this.tweens.add({
        targets: obj,
        x: slotX(newVisible.indexOf(id)), alpha: 1,
        duration: CAROUSEL_SLIDE_MS, ease: 'Quad.easeInOut',
      });
    });

    // Commit new offset and restore UI after animation completes
    this.handOffset = newOffset;
    this.time.delayedCall(CAROUSEL_SLIDE_MS, () => {
      const canLeft  = this.handOffset > 0;
      const canRight = this.handOffset < maxOffset;
      this.setArrowState(this.arrowLeft,  canLeft);
      this.setArrowState(this.arrowRight, canRight);
      if (ids.length > CAROUSEL_VISIBLE) {
        const from = this.handOffset + 1;
        const to   = Math.min(this.handOffset + CAROUSEL_VISIBLE, ids.length);
        this.handLabel.setText(`YOUR CARDS (${from}–${to} of ${ids.length})`);
      }
    });
  }

  renderHand() {
    Object.values(this.cardObjects).forEach(c => c.destroy());
    this.cardObjects = {};

    const ids   = this.state.hand;
    const handY = 623;

    const maxOffset = Math.max(0, ids.length - CAROUSEL_VISIBLE);
    this.handOffset = Math.min(this.handOffset, maxOffset);

    const visible  = ids.slice(this.handOffset, this.handOffset + CAROUSEL_VISIBLE);
    const windowW  = CAROUSEL_VISIBLE * (CARD_W + 8) - 8;
    const startX   = (GAME_W - windowW) / 2 + 33;
    const cardsTotalW = visible.length * (CARD_W + 8) - 8;
    const drawStartX  = ids.length < CAROUSEL_VISIBLE
      ? startX + (windowW - cardsTotalW) / 2
      : startX;

    visible.forEach((id, i) => {
      const card = this.cardsData.find(c => c.id === id);
      const x    = drawStartX + i * (CARD_W + 8) + CARD_W / 2;
      this.cardObjects[id] = this.buildCardVisual(card, x, handY, true);
    });

    const canLeft  = this.handOffset > 0;
    const canRight = this.handOffset < maxOffset;
    this.setArrowState(this.arrowLeft,  canLeft);
    this.setArrowState(this.arrowRight, canRight);

    if (ids.length > CAROUSEL_VISIBLE) {
      const from = this.handOffset + 1;
      const to   = Math.min(this.handOffset + CAROUSEL_VISIBLE, ids.length);
      this.handLabel.setText(`YOUR CARDS (${from}–${to} of ${ids.length})`);
    } else {
      this.handLabel.setText('YOUR CARDS');
    }
  }

  setArrowState(arrow, enabled) {
    arrow.disabled = !enabled;
    arrow.setAlpha(enabled ? 1 : 0.2).setColor(enabled ? COLORS.text.secondary : COLORS.text.muted);
  }

  // ── Card Visuals ──────────────────────────────────────────
  buildCardVisual(card, x, y, draggable) {
    const container  = this.add.container(x, y);
    container.cardId = card.id;

    const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;

    const shadow = draggable ? (() => {
      const s = this.add.graphics();
      s.fillStyle(0x000000, 0.6);
      s.fillRoundedRect(-CARD_W / 2 - 3, -CARD_H / 2 + 6, CARD_W, CARD_H, 5);
      return s;
    })() : null;

    const bg = this.add.graphics();
    const drawBg = (strokeW, strokeC) => {
      bg.clear();
      bg.fillStyle(COLORS.cardBg);
      bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
      bg.lineStyle(strokeW, strokeC);
      bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
    };
    drawBg(1, typeColor);
    bg.setStrokeStyle = (w, c) => drawBg(w, c);
    container.cardBg = bg;

    const bar = this.add.graphics();
    bar.fillStyle(typeColor);
    bar.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 12, { tl: 5, tr: 5, bl: 0, br: 0 });
    const typeLabel = this.add.text(0, -CARD_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: FONT_BOARD, color: COLORS.typeTextColors[card.type] || COLORS.text.onType, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    const nameText = this.add.text(0, -CARD_H / 2 + 42, card.name, {
      fontSize: '11px', fontFamily: FONT_CARD_NAME, color: '#000000', fontStyle: 'bold',
      align: 'center', wordWrap: { width: CARD_W - 10 }
    }).setOrigin(0.5, 0.5);

    const divider = this.add.rectangle(0, -CARD_H / 2 + 72, CARD_W - 16, 1, COLORS.cardDivider).setOrigin(0.5, 0.5);

    const opText = this.add.text(0, -CARD_H / 2 + 82, this.operationLabel(card.operation), {
      fontSize: '20px', fontFamily: FONT_BOARD, color: COLORS.text.cardOp, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0);

    container.add([...(shadow ? [shadow] : []), bg, bar, typeLabel, nameText, divider, opText]);

    // Effect icons — ★ for special/bonus-turn effects, ⚡ for trigger effects
    const icons = [];
    if (card.specialEffect) icons.push({ symbol: '★', color: COLORS.text.gold });
    if (card.bonusTurn)     icons.push({ symbol: '+', color: COLORS.text.bonusTurn });
    if (card.triggerEffect)                   icons.push({ symbol: '⚡', color: COLORS.text.cyan });
    if (icons.length > 0) {
      const iconY   = -CARD_H / 2 + 118;
      const spacing = 20;
      const startX  = -((icons.length - 1) * spacing) / 2;
      icons.forEach((icon, i) => {
        container.add(this.add.text(startX + i * spacing, iconY, icon.symbol, {
          fontSize: '18px', fontFamily: FONT_BOARD, color: icon.color, align: 'center'
        }).setOrigin(0.5, 0.5));
      });
    }

    const effectiveCost = this.getEffectiveCost ? this.getEffectiveCost(card) : card.cost * 100;
    const canAfford = this.state && this.state.cash >= effectiveCost;
    container.add(this.add.text(-CARD_W / 2 + 6, CARD_H / 2 - 16, `$${card.cost * 100}k`, {
      fontSize: '11px', fontFamily: FONT_BOARD, color: canAfford ? COLORS.text.cashSub : COLORS.text.negLight
    }).setOrigin(0, 0.5));

    const valStr = card.baseValue > 0 ? `$${card.baseValue}k` : '—';
    container.add(this.add.text(CARD_W / 2 - 6, CARD_H / 2 - 16, valStr, {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.cardValue
    }).setOrigin(1, 0.5));

    if (draggable) {
      container.setSize(CARD_W, CARD_H);
      container.setInteractive();
      this.input.setDraggable(container);

      container.on('pointerover', () => {
        if (this.state.phase === 'playing') bg.setStrokeStyle(2, 0x000000);
      });
      container.on('pointerout', () => {
        bg.setStrokeStyle(1, typeColor);
      });
      container.on('pointerdown', (pointer) => {
        this._holdOriginX = pointer.x;
        this._holdOriginY = pointer.y;
        this._holdTimer = this.time.delayedCall(300, () => {
          this._holdTimer = null;
          this.showCardInfoPopup(card, container.x, container.y, CARD_H);
        });
      });
    }

    return container;
  }

  operationLabel(op) {
    return operationLabel(op);
  }

  specialEffectLabel(fx) {
    const labelOne = (f) => {
      if (f.type === 'immediate_play') return 'Play another card now';
      if (f.type !== 'modify_type') return '';
      const target = f.targetRole || f.targetType || '?';
      const parts = [];
      if (f.operationBonus) {
        const b = f.operationBonus;
        parts.push(b.type === 'multiply'
          ? `×${b.value} ${target} ops`
          : `${b.value >= 0 ? '+' : ''}${b.value} to ${target} ops`);
      }
      if (f.valueBonus)      parts.push(`${f.valueBonus >= 0 ? '+' : ''}$${Math.abs(f.valueBonus)}k ${target} val`);
      if (f.valueMultiplier) parts.push(`×${f.valueMultiplier} ${target} val`);
      if (f.costDiscount)    parts.push(`-$${f.costDiscount}k ${target} cost`);
      return parts.join(' ') || '';
    };
    if (Array.isArray(fx)) return fx.map(labelOne).filter(Boolean).join('\n');
    return labelOne(fx);
  }

  triggerEffectLabel(fx) {
    if (!fx) return '';
    if (fx.type === 'gain_cash')               return `+$${fx.amount}k on trigger`;
    if (fx.type === 'gain_cash_per_type')      return `+$${fx.amount}k per ${fx.targetType}`;
    if (fx.type === 'gain_cash_per_discard')        return `+$${fx.amount}k per discard`;
    if (fx.type === 'gain_self_value_per_discard')  return `+$${fx.amount}k self value per discard`;
    if (fx.type === 'draw')                    return `Draw ${fx.count} card${fx.count !== 1 ? 's' : ''}`;
    if (fx.type === 'spend_cash_draw_resource')return `Pay $${fx.cost}k → draw ${fx.draws}`;
    if (fx.type === 'spend_cash_draw')         return `Pay $${fx.cost}k → draw ${fx.draws}`;
    if (fx.type === 'spend_cash_boost_op')     return `Pay $${fx.cost}k → ${fx.target} +${fx.value} op`;
    if (fx.type === 'spend_cash_swap')         return `Pay $${fx.cost}k → swap for ${fx.handType}`;
    if (fx.type === 'boost_op')                return `${fx.target}: +${fx.value} op`;
    if (fx.type === 'boost_value')             return `${fx.target}: +$${fx.value}k val`;
    if (fx.type === 'trade_draw')              return `Trade 1 card → draw ${fx.draws}`;
    if (fx.type === 'swap_csuite')             return `Swap a C-Suite card`;
    if (fx.type === 'swap_card')               return `Swap ${fx.boardType} → ${fx.handType}`;
    if (fx.type === 'self_boost_per_type')     return `+${fx.value} op per ${fx.targetType}`;
    return 'trigger effect';
  }

  // ── Card Info Popup (press & hold) ────────────────────────
  showCardInfoPopup(card, worldX, worldY, cardH = CARD_H) {
    this.hideCardInfoPopup();

    const PW  = 240;
    const PAD = 14;
    const typeColor    = COLORS.typeColors[card.type] || COLORS.typeColorDefault;
    const typeColorHex = '#' + typeColor.toString(16).padStart(6, '0');

    // Build all text objects first so we can measure their actual heights
    const typeText = this.add.text(0, 0, card.type.toUpperCase(), {
      fontSize: '10px', fontFamily: FONT_BOARD, color: typeColorHex, align: 'center'
    }).setOrigin(0.5, 0);

    const nameText = this.add.text(0, 0, card.name, {
      fontSize: '17px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold',
      align: 'center', wordWrap: { width: PW - PAD * 2 }
    }).setOrigin(0.5, 0);

    const descText = this.add.text(0, 0, card.description, {
      fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.secondary, fontStyle: 'italic',
      align: 'center', wordWrap: { width: PW - PAD * 2 }
    }).setOrigin(0.5, 0);

    let specialText = null, bonusText = null, triggerText = null;
    if (card.specialEffect) {
      specialText = this.add.text(0, 0, `★ ${this.specialEffectLabel(card.specialEffect)}`, {
        fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.gold,
        align: 'center', wordWrap: { width: PW - PAD * 2 }
      }).setOrigin(0.5, 0);
    }
    if (card.bonusTurn) {
      bonusText = this.add.text(0, 0, '+ +1 Bonus Turn on placement', {
        fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.bonusTurn, align: 'center'
      }).setOrigin(0.5, 0);
    }
    if (card.triggerEffect) {
      triggerText = this.add.text(0, 0, `⚡ ${this.triggerEffectLabel(card.triggerEffect)}`, {
        fontSize: '12px', fontFamily: FONT_BOARD, color: COLORS.text.cyan,
        align: 'center', wordWrap: { width: PW - PAD * 2 }
      }).setOrigin(0.5, 0);
    }

    // Measure total content height
    const TOP_PAD = 14, BOTTOM_PAD = 14, DIV_H = 1;
    const GAP_AFTER_TYPE = 6, GAP_AFTER_NAME = 10, GAP_AFTER_DIV = 8, GAP_AFTER_SECTION = 8;

    let contentH = typeText.height + GAP_AFTER_TYPE
                 + nameText.height + GAP_AFTER_NAME
                 + DIV_H + GAP_AFTER_DIV
                 + descText.height;
    if (specialText)  contentH += GAP_AFTER_SECTION + DIV_H + GAP_AFTER_DIV + specialText.height;
    if (bonusText)    contentH += GAP_AFTER_SECTION + DIV_H + GAP_AFTER_DIV + bonusText.height;
    if (triggerText)  contentH += GAP_AFTER_SECTION + DIV_H + GAP_AFTER_DIV + triggerText.height;

    const PH = TOP_PAD + contentH + BOTTOM_PAD;

    // Position: above card by default, flip below if too close to top edge
    const gap        = 8;
    const cardTopY   = worldY - cardH / 2;
    let popupCenterY = cardTopY - gap - PH / 2;
    if (popupCenterY - PH / 2 < 4) {
      popupCenterY = worldY + cardH / 2 + gap + PH / 2;
    }
    const popupCenterX = Math.max(PW / 2 + 5, Math.min(GAME_W - PW / 2 - 5, worldX));

    const popup = this.add.container(popupCenterX, popupCenterY).setDepth(200);
    popup.add(this.add.rectangle(-3, 6, PW, PH, 0x000000).setAlpha(0.6));
    popup.add(this.add.rectangle(0, 0, PW, PH, 0xffffff).setStrokeStyle(2, typeColor));

    // Layout: place items top-to-bottom starting from -PH/2 + TOP_PAD
    let y = -PH / 2 + TOP_PAD;

    typeText.setPosition(0, y); popup.add(typeText);
    y += typeText.height + GAP_AFTER_TYPE;

    nameText.setPosition(0, y); popup.add(nameText);
    y += nameText.height + GAP_AFTER_NAME;

    popup.add(this.add.rectangle(0, y, PW - 20, DIV_H, COLORS.popupDivider).setOrigin(0.5, 0));
    y += DIV_H + GAP_AFTER_DIV;

    descText.setPosition(0, y); popup.add(descText);
    y += descText.height;

    if (specialText) {
      y += GAP_AFTER_SECTION;
      popup.add(this.add.rectangle(0, y, PW - 20, DIV_H, COLORS.popupDivider).setOrigin(0.5, 0));
      y += DIV_H + GAP_AFTER_DIV;
      specialText.setPosition(0, y); popup.add(specialText);
      y += specialText.height;
    }

    if (bonusText) {
      y += GAP_AFTER_SECTION;
      popup.add(this.add.rectangle(0, y, PW - 20, DIV_H, COLORS.popupDivider).setOrigin(0.5, 0));
      y += DIV_H + GAP_AFTER_DIV;
      bonusText.setPosition(0, y); popup.add(bonusText);
      y += bonusText.height;
    }

    if (triggerText) {
      y += GAP_AFTER_SECTION;
      popup.add(this.add.rectangle(0, y, PW - 20, DIV_H, COLORS.popupDivider).setOrigin(0.5, 0));
      y += DIV_H + GAP_AFTER_DIV;
      triggerText.setPosition(0, y); popup.add(triggerText);
    }

    this.cardInfoPopup = popup;
    popup._popupH = PH;
    popup._cardH  = cardH;
  }

  hideCardInfoPopup() {
    if (this.cardInfoPopup) { this.cardInfoPopup.destroy(); this.cardInfoPopup = null; }
  }

  // ── Drag & Drop ───────────────────────────────────────────
  setupDragHandlers() {
    this.dragOrigin = null;

    // ── Hold-to-inspect infrastructure ──────────────────────
    // These three listeners are shared by all cards (hand + slots).
    // Each card's pointerdown sets _holdTimer / _holdOrigin; these clean up.
    this.input.on('pointermove', (pointer) => {
      if (this._holdTimer) {
        const dx = pointer.x - this._holdOriginX;
        const dy = pointer.y - this._holdOriginY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          this._holdTimer.remove();
          this._holdTimer = null;
        }
      }
    });

    this.input.on('pointerup', () => {
      if (this._holdTimer) { this._holdTimer.remove(); this._holdTimer = null; }
      this.hideCardInfoPopup();
    });

    this.input.on('dragstart', (_pointer, obj) => {
      if (this.state.phase !== 'playing') return;
      if (this._holdTimer) { this._holdTimer.remove(); this._holdTimer = null; }
      this.dragOrigin = { x: obj.x, y: obj.y };
      this.children.bringToTop(obj);
    });

    this.input.on('drag', (_pointer, obj, dragX, dragY) => {
      obj.setPosition(dragX, dragY);
      if (this.cardInfoPopup) {
        const PW = 240;
        const PH = this.cardInfoPopup._popupH;
        const cH = this.cardInfoPopup._cardH;
        const gap = 8;
        let py = dragY - cH / 2 - gap - PH / 2;
        if (py - PH / 2 < 4) py = dragY + cH / 2 + gap + PH / 2;
        const px = Math.max(PW / 2 + 5, Math.min(GAME_W - PW / 2 - 5, dragX));
        this.cardInfoPopup.setPosition(px, py);
      }
    });

    this.input.on('dragend', (_pointer, obj, dropped) => {
      if (!dropped) {
        this.tweens.add({
          targets: obj, x: this.dragOrigin.x, y: this.dragOrigin.y,
          duration: 150, ease: 'Power2'
        });
      }
      this.dragOrigin = null;
    });

    this.input.on('drop', (_pointer, obj, zone) => {
      if (zone.slotIndex === undefined) return;
      this.tryPlaceCard(obj.cardId, zone.slotIndex, zone.rowType || 'cash');
    });
  }

  // ── Card Placement ────────────────────────────────────────
  tryPlaceCard(cardId, _slotIndex, rowType) {
    const { state } = this;
    if (state.phase !== 'playing') return;

    // Enforce row restriction during free play
    if (state.freePlay && rowType !== state.freePlayRow) {
      this.snapBack(cardId);
      this.showFloat(this.cameras.main.width / 2, 200, 'PLAY TO SAME ROW', COLORS.text.negative);
      return;
    }

    const card = this.cardsData.find(c => c.id === cardId);
    const effectiveCost = this.getEffectiveCost(card);

    const rowArray = rowType === 'product'   ? state.productRow
                   : rowType === 'resources' ? state.resourcesRow
                   : state.cashRow;
    const slotList = rowType === 'product'   ? this.productSlotObjects
                   : rowType === 'resources' ? this.resSlotObjects
                   : this.slotObjects;

    // Resolve the target slot: always the leftmost empty slot, not the dropped slot.
    // C-Suite replacements are the one exception — they target the existing role's slot.
    let targetSlotIndex = rowArray.indexOf(null);

    // ── Role enforcement for C-Suite cards ──────────────────
    if (card.role) {
      const rowKeys = ['cashRow', 'productRow', 'resourcesRow'];
      let existingRowKey = null, existingSlotIdx = null;
      for (const key of rowKeys) {
        const idx = state[key].findIndex(id => {
          if (!id) return false;
          const c = this.cardsData.find(c => c.id === id);
          return c.role === card.role;
        });
        if (idx !== -1) { existingRowKey = key; existingSlotIdx = idx; break; }
      }

      if (existingRowKey) {
        const existingRowType = existingRowKey === 'cashRow'    ? 'cash'
                              : existingRowKey === 'productRow' ? 'product' : 'resources';
        if (existingRowType !== rowType) {
          // Must replace in the same row as the existing role card
          const existingSlotList = existingRowKey === 'cashRow'     ? this.slotObjects
                                 : existingRowKey === 'productRow' ? this.productSlotObjects
                                 : this.resSlotObjects;
          const existingSlotObj = existingSlotList[existingSlotIdx];
          this.showFloat(existingSlotObj.x, existingSlotObj.y - 90, `REPLACE ${card.role}`, COLORS.text.negative);
          this.snapBack(cardId);
          return;
        }
        // Same row — target the existing role's slot directly (override next-slot logic)
        targetSlotIndex = existingSlotIdx;
        state[existingRowKey][existingSlotIdx] = null;
      }
    }
    // ────────────────────────────────────────────────────────

    const slot = slotList[targetSlotIndex] || slotList[0];

    if (targetSlotIndex === -1) {
      this.showFloat(slot.x, slot.y - 90, 'ROW FULL', COLORS.text.negative);
      this.snapBack(cardId);
      return;
    }

    if (state.cash < effectiveCost) {
      this.showFloat(slot.x, slot.y - 90, `NEED $${effectiveCost}k`, COLORS.text.negative);
      this.snapBack(cardId);
      return;
    }

    // Commit
    state.cash -= effectiveCost;
    rowArray[targetSlotIndex] = cardId;
    state.hand = state.hand.filter(id => id !== cardId);
    this.handOffset = Math.min(this.handOffset, Math.max(0, state.hand.length - CAROUSEL_VISIBLE));

    // Goal tracking: card placement
    state.cardsPlacedThisRound++;
    state.typesPlacedThisRound.add(card.type);
    state.typePlacedCounts.set(card.type, (state.typePlacedCounts.get(card.type) || 0) + 1);

    this._reRenderSlot(rowType, targetSlotIndex);

    this.refreshBoardOpLabels();
    this.refreshBoardValueLabels();
    this.renderHand();
    this.updateHUD();
    this.checkGoalProgress();

    // Consume free play flag if this placement is using it
    if (state.freePlay) {
      state.freePlay = false;
      state.freePlayRow = null;
      this.clearFreePlayBanner();
    }

    // immediate_play: grant a free card placement to the same row (skip advanceTurn this turn)
    const fx = card.specialEffect && !Array.isArray(card.specialEffect) ? card.specialEffect : null;
    if (fx && fx.type === 'immediate_play') {
      state.freePlay = true;
      state.freePlayRow = rowType;
      this.showFreePlayBanner(rowType);
      if (card.bonusTurn) {
        state.totalBonusTurns++;
        state.maxTurns++;
        this.rebuildTurnBoxes();
        this.updateHUD();
        this.showBonusTurnNotice('+1 TURN');
      }
      return; // skip advanceTurn — player gets a free action
    }

    // Bonus turn on placement
    if (card.bonusTurn) {
      state.totalBonusTurns++;
      state.maxTurns++;
      this.rebuildTurnBoxes();
      this.updateHUD();
      this.showBonusTurnNotice('+1 TURN');
    }

    this.advanceTurn();
  }

  snapBack(cardId) {
    const obj = this.cardObjects[cardId];
    if (obj && this.dragOrigin) {
      this.tweens.add({
        targets: obj, x: this.dragOrigin.x, y: this.dragOrigin.y,
        duration: 150, ease: 'Power2'
      });
    }
  }

  renderSlotCard(slotIndex, card) {
    const slot      = this.slotObjects[slotIndex];
    const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;

    slot.slotLabel.setVisible(false);
    slot.slotBg.setFillStyle(COLORS.cardPlaced)
      .setStrokeStyle(1, typeColor);

    slot.add(this.add.rectangle(0, -SLOT_H / 2 + 6, SLOT_W, 12, typeColor).setOrigin(0.5, 0.5));
    slot.add(this.add.text(0, -SLOT_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: FONT_BOARD, color: COLORS.typeTextColors[card.type] || COLORS.text.onType, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5));

    slot.add(this.add.text(0, -SLOT_H / 2 + 22, card.name, {
      fontSize: '8px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold',
      align: 'center', wordWrap: { width: SLOT_W - 12, useAdvancedWrap: true }
    }).setOrigin(0.5, 0));

    const cashOpText = this.add.text(0, 8, this.operationLabel(card.operation), {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    slot.add(cashOpText);
    slot.opText = cashOpText;

    const dispVal = (card.baseValue || 0) + (this.state.valueBonuses[card.id] || 0);
    const valText = this.add.text(0, SLOT_H / 2 - 14, dispVal > 0 ? `$${dispVal}k` : '', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.cardValue, align: 'center'
    }).setOrigin(0.5, 0.5);
    valText.setVisible(dispVal > 0);
    slot.add(valText);
    slot.valText = valText;

    const slotIcons = [];
    if (card.specialEffect) slotIcons.push({ symbol: '★', color: COLORS.text.gold });
    if (card.bonusTurn)     slotIcons.push({ symbol: '+', color: COLORS.text.bonusTurn });
    if (card.triggerEffect)                   slotIcons.push({ symbol: '⚡', color: COLORS.text.cyan });
    if (slotIcons.length > 0) {
      const startX = -((slotIcons.length - 1) * 22) / 2;
      slotIcons.forEach((icon, i) => {
        slot.add(this.add.text(startX + i * 22, 32, icon.symbol, {
          fontSize: '18px', fontFamily: FONT_BOARD, color: icon.color, align: 'center'
        }).setOrigin(0.5, 0.5));
      });
    }

    slot.cardId = card.id;
  }

  renderProductSlotCard(slotIndex, card) {
    const slot      = this.productSlotObjects[slotIndex];
    const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;

    slot.slotLabel.setVisible(false);
    slot.slotBg.setFillStyle(COLORS.productCardPlaced)
      .setStrokeStyle(1, typeColor);

    slot.add(this.add.rectangle(0, -SLOT_H / 2 + 6, SLOT_W, 12, typeColor).setOrigin(0.5, 0.5));
    slot.add(this.add.text(0, -SLOT_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: FONT_BOARD, color: COLORS.typeTextColors[card.type] || COLORS.text.onType, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5));

    slot.add(this.add.text(0, -SLOT_H / 2 + 22, card.name, {
      fontSize: '8px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold',
      align: 'center', wordWrap: { width: SLOT_W - 12, useAdvancedWrap: true }
    }).setOrigin(0.5, 0));

    const ipOpText = this.add.text(0, 8, this.operationLabel(card.operation), {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.purple, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    slot.add(ipOpText);
    slot.opText = ipOpText;

    const dispVal = (card.baseValue || 0) + (this.state.valueBonuses[card.id] || 0);
    const valText = this.add.text(0, SLOT_H / 2 - 14, dispVal > 0 ? `$${dispVal}k` : '', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.cardValue, align: 'center'
    }).setOrigin(0.5, 0.5);
    valText.setVisible(dispVal > 0);
    slot.add(valText);
    slot.valText = valText;

    const slotIcons = [];
    if (card.specialEffect) slotIcons.push({ symbol: '★', color: COLORS.text.gold });
    if (card.bonusTurn)     slotIcons.push({ symbol: '+', color: COLORS.text.bonusTurn });
    if (card.triggerEffect)                   slotIcons.push({ symbol: '⚡', color: COLORS.text.cyan });
    if (slotIcons.length > 0) {
      const startX = -((slotIcons.length - 1) * 22) / 2;
      slotIcons.forEach((icon, i) => {
        slot.add(this.add.text(startX + i * 22, 32, icon.symbol, {
          fontSize: '18px', fontFamily: FONT_BOARD, color: icon.color, align: 'center'
        }).setOrigin(0.5, 0.5));
      });
    }

    slot.cardId = card.id;
  }

  renderResSlotCard(slotIndex, card) {
    const slot      = this.resSlotObjects[slotIndex];
    const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;

    slot.slotLabel.setVisible(false);
    slot.slotBg.setFillStyle(COLORS.resCardPlaced)
      .setStrokeStyle(1, typeColor);

    slot.add(this.add.rectangle(0, -SLOT_H / 2 + 6, SLOT_W, 12, typeColor).setOrigin(0.5, 0.5));
    slot.add(this.add.text(0, -SLOT_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: FONT_BOARD, color: COLORS.typeTextColors[card.type] || COLORS.text.onType, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5));

    slot.add(this.add.text(0, -SLOT_H / 2 + 22, card.name, {
      fontSize: '8px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold',
      align: 'center', wordWrap: { width: SLOT_W - 12, useAdvancedWrap: true }
    }).setOrigin(0.5, 0));

    const resOpText = this.add.text(0, 8, this.operationLabel(card.operation), {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    slot.add(resOpText);
    slot.opText = resOpText;

    const dispVal = (card.baseValue || 0) + (this.state.valueBonuses[card.id] || 0);
    const valText = this.add.text(0, SLOT_H / 2 - 14, dispVal > 0 ? `$${dispVal}k` : '', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.cardValue, align: 'center'
    }).setOrigin(0.5, 0.5);
    valText.setVisible(dispVal > 0);
    slot.add(valText);
    slot.valText = valText;

    const slotIcons = [];
    if (card.specialEffect) slotIcons.push({ symbol: '★', color: COLORS.text.gold });
    if (card.bonusTurn)     slotIcons.push({ symbol: '+', color: COLORS.text.bonusTurn });
    if (card.triggerEffect)                   slotIcons.push({ symbol: '⚡', color: COLORS.text.cyan });
    if (slotIcons.length > 0) {
      const startX = -((slotIcons.length - 1) * 22) / 2;
      slotIcons.forEach((icon, i) => {
        slot.add(this.add.text(startX + i * 22, 32, icon.symbol, {
          fontSize: '18px', fontFamily: FONT_BOARD, color: icon.color, align: 'center'
        }).setOrigin(0.5, 0.5));
      });
    }

    slot.cardId = card.id;
  }

  // ── Board op label refresh ────────────────────────────────
  // Called after every card placement. Re-reads effective ops for all placed
  // cards and updates the operation text on each slot. Gold color = boosted.
  refreshBoardValueLabels() {
    // Compute live valueBonus from all modify_type specialEffects on board
    const allIds = [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow].filter(Boolean);
    const liveBonuses = {};

    // Start from any accumulated state bonuses (from trigger effects)
    Object.entries(this.state.valueBonuses).forEach(([id, v]) => { liveBonuses[id] = v; });

    // Add passive valueBonus from specialEffect modify_type cards on board
    allIds.forEach(id => {
      const card = this.cardsData.find(c => c.id === id);
      if (!card || !card.specialEffect) return;
      const effects = Array.isArray(card.specialEffect) ? card.specialEffect : [card.specialEffect];
      effects.forEach(fx => {
        if (fx.type !== 'modify_type' || !fx.valueBonus) return;
        allIds.forEach(tid => {
          if (tid === id) return;
          const tc = this.cardsData.find(c => c.id === tid);
          if (tc && this._typeMatches(tc, fx.targetType, id)) {
            liveBonuses[tid] = (liveBonuses[tid] || 0) + fx.valueBonus;
          }
        });
      });
    });

    // Update displayed values on all slot cards
    const updateSlots = (slotObjects, rowArray) => {
      slotObjects.forEach((slot, i) => {
        const id = rowArray[i];
        if (!id) return;
        const card = this.cardsData.find(c => c.id === id);
        if (!card) return;
        const bonus = liveBonuses[id] || 0;
        const dispVal = card.baseValue + bonus;
        if (slot.valText) {
          if (dispVal > 0) {
            slot.valText.setText(`$${dispVal}k`);
            slot.valText.setColor(bonus > 0 ? COLORS.text.boost : COLORS.text.value);
            slot.valText.setVisible(true);
          } else {
            slot.valText.setVisible(false);
          }
        }
      });
    };

    updateSlots(this.slotObjects, this.state.cashRow);
    updateSlots(this.productSlotObjects, this.state.productRow);
    updateSlots(this.resSlotObjects, this.state.resourcesRow);

    // Store for HUD team value calculation
    this._liveBonuses = liveBonuses;
  }

  refreshBoardOpLabels() {
    const cashIds = this.state.cashRow.filter(Boolean);
    const productIds = this.state.productRow.filter(Boolean);
    const resIds     = this.state.resourcesRow.filter(Boolean);
    const cashOps    = this.getModifiedOps(cashIds);
    const ipOps      = this.getModifiedOps(productIds);
    const resOps  = this.getModifiedOps(resIds);

    this.slotObjects.forEach((slot, i) => {
      const id = this.state.cashRow[i];
      if (!id || !slot.opText) return;
      const card = this.cardsData.find(c => c.id === id);
      const eff  = cashOps[id];
      const boosted = Math.round(eff.value * 100) !== Math.round(card.operation.value * 100);
      slot.opText.setText(this.operationLabel(eff));
      slot.opText.setColor(boosted ? COLORS.text.boost : COLORS.text.cashSub);
    });

    this.productSlotObjects.forEach((slot, i) => {
      const id = this.state.productRow[i];
      if (!id || !slot.opText) return;
      const card = this.cardsData.find(c => c.id === id);
      const eff  = ipOps[id];
      const boosted = Math.round(eff.value * 100) !== Math.round(card.operation.value * 100);
      slot.opText.setText(this.operationLabel(eff));
      slot.opText.setColor(boosted ? COLORS.text.boost : COLORS.text.purple);
    });

    this.resSlotObjects.forEach((slot, i) => {
      const id = this.state.resourcesRow[i];
      if (!id || !slot.opText) return;
      const card = this.cardsData.find(c => c.id === id);
      const eff  = resOps[id];
      const boosted = Math.round(eff.value * 100) !== Math.round(card.operation.value * 100);
      slot.opText.setText(this.operationLabel(eff));
      slot.opText.setColor(boosted ? COLORS.text.boost : COLORS.text.resSub);
    });
  }

  // ── Turn Management ───────────────────────────────────────
  advanceTurn() {
    this.state.turn++;
    this.updateHUD();

    if (this.state.turn > this.state.maxTurns) {
      this.state.phase = 'valuation';
      this.time.delayedCall(500, () => this.triggerValuation());
    }
  }

  // ── Cash Row Activation ───────────────────────────────────
  onActivateClicked() {
    if (this.state.phase !== 'playing') return;
    if (this.state.freePlay) { this.state.freePlay = false; this.state.freePlayRow = null; this.clearFreePlayBanner(); }
    this.state.phase = 'activating';
    this.runActivationSequence();
  }

  runActivationSequence() {
    const BASE = BASE_CASH_PER_ROUND[this.state.round - 1] ?? 100;
    let payout = BASE;

    const effectiveOps = this._computeActivationOps(this.state.cashRow.filter(Boolean));

    this.activateTile.tileBg.setFillStyle(COLORS.activateActive);
    this.showFloat(this.activateTile.x, this.activateTile.y - 90, `BASE +$${BASE}k`, COLORS.text.cashSub, 900);

    const STEP_DELAY = 700;

    const processCard = (index) => {
      if (index >= 5) {
        this.finalizePayout(payout);
        return;
      }

      const cardId = this.state.cashRow[index];
      if (cardId === null) { processCard(index + 1); return; }

      const slot = this.slotObjects[index];
      this.tweens.add({
        targets: slot.slotBg, alpha: 0.3, yoyo: true, duration: 220,
        onComplete: () => slot.slotBg.setAlpha(1)
      });

      const op     = effectiveOps[cardId];
      const before = payout;

      if (op.type === 'add')      payout += op.value * BASE;
      else if (op.type === 'multiply') payout = Math.round(payout * op.value);

      const diff  = payout - before;
      const label = op.type === 'multiply' ? `×${op.value}  →  $${payout}k` : `+$${diff}k`;

      this.showFloat(slot.x, slot.y - 90, label, COLORS.text.cashSub, 900);

      const card = this.cardsData.find(c => c.id === cardId);
      if (card.triggerEffect) {
        card._slotX = slot.x;
        card._slotY = slot.y;
        this.showTriggerModal(card, payout, (updatedPayout, pendingDraws) => {
          payout = updatedPayout;
          if (pendingDraws) this.pendingDrawCount += pendingDraws;
          this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
        });
      } else {
        this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
      }
    };

    this.time.delayedCall(600, () => processCard(0));
  }

  // ─── Type-matching helper ────────────────────────────────────────────────────
  _typeMatches(card, targetType, sourceCardId = null) {
    if (!targetType) return false;
    if (targetType === 'All cards') return true;
    if (targetType === 'All other cards') return sourceCardId ? card.id !== sourceCardId : true;
    const norm = t => t === 'Prod/Design' ? 'Product/Design'
                     : t === 'Board'      ? 'Boardmember'
                     : t;
    return norm(card.type) === norm(targetType) || card.role === targetType;
  }

  getEffectiveCost(card) {
    let cost = card.cost * 100;
    if (!this.state) return cost;
    [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow].filter(Boolean).forEach(bid => {
      const bc = this.cardsData.find(c => c.id === bid);
      if (!bc || !bc.specialEffect) return;
      const effects = Array.isArray(bc.specialEffect) ? bc.specialEffect : [bc.specialEffect];
      effects.forEach(fx => {
        if (fx.type === 'modify_type' && fx.costDiscount && this._typeMatches(card, fx.targetType)) {
          cost = Math.max(0, cost - fx.costDiscount * 100);
        }
      });
    });
    return cost;
  }

  _countBoardCardsOfType(targetType) {
    return [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow]
      .filter(id => {
        if (!id) return false;
        const c = this.cardsData.find(x => x.id === id);
        return c && this._typeMatches(c, targetType);
      }).length;
  }

  _applyPermanentOpBoost(matchFn, value) {
    [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow]
      .filter(Boolean)
      .forEach(id => {
        const c = this.cardsData.find(x => x.id === id);
        if (c && matchFn(c)) {
          this.state.cardOpBoosts[id] = (this.state.cardOpBoosts[id] || 0) + value;
        }
      });
  }

  _applyBoostValue(matchFn, value) {
    [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow]
      .filter(Boolean)
      .forEach(id => {
        const c = this.cardsData.find(x => x.id === id);
        if (c && matchFn(c)) {
          this.state.valueBonuses[id] = (this.state.valueBonuses[id] || 0) + value;
        }
      });
  }

  // Returns modified operations for targetIds, applying modify_type bonuses from
  // ALL cards on the board (all rows), per GDD §4.1 cross-row scope.
  getModifiedOps(targetIds) {
    const allBoardIds = [
      ...this.state.cashRow.filter(Boolean),
      ...this.state.productRow.filter(Boolean),
      ...this.state.resourcesRow.filter(Boolean),
    ];

    const ops = {};

    // Re-initialize cleanly
    targetIds.forEach(id => {
      const card = this.cardsData.find(c => c.id === id);
      ops[id] = { type: card.operation.type, value: card.operation.value };
    });

    // Apply passive specialEffect modify_type bonuses from all board cards
    allBoardIds.forEach(id => {
      const card = this.cardsData.find(c => c.id === id);
      if (!card.specialEffect) return;
      const effects = Array.isArray(card.specialEffect) ? card.specialEffect : [card.specialEffect];
      effects.forEach(fx => {
        if (fx.type !== 'modify_type' || !fx.operationBonus) return;
        targetIds.forEach(tid => {
          const tc = this.cardsData.find(c => c.id === tid);
          if (!this._typeMatches(tc, fx.targetType, id)) return;
          const b = fx.operationBonus;
          if (b.type === 'multiply') ops[tid].value *= b.value;
          else if (b.type === 'add')  ops[tid].value += b.value;
        });
      });
    });

    // Apply permanent op boosts from spend_cash_boost_op (additive on top of base op)
    targetIds.forEach(id => {
      if (this.state.cardOpBoosts[id]) {
        ops[id].value += this.state.cardOpBoosts[id];
      }
    });

    return ops;
  }

  // Extends getModifiedOps with trigger boost_op / self_boost_per_type pre-pass
  // for cards in the row being activated this turn.
  _computeActivationOps(rowCardIds) {
    const ops = this.getModifiedOps(rowCardIds);

    // Scan trigger effects in the activating row for boost_op / self_boost_per_type
    rowCardIds.forEach(sourceId => {
      const src = this.cardsData.find(c => c.id === sourceId);
      if (!src || !src.triggerEffect) return;
      const fx = src.triggerEffect;

      if (fx.type === 'boost_op') {
        // Apply to matching cards in the row
        rowCardIds.forEach(tid => {
          const tc = this.cardsData.find(c => c.id === tid);
          if (fx.target === 'Self') {
            if (tid === sourceId) ops[tid].value += fx.value;
          } else if (this._typeMatches(tc, fx.target)) {
            ops[tid].value += fx.value;
          }
        });
      }

      if (fx.type === 'self_boost_per_type') {
        const count = this._countBoardCardsOfType(fx.targetType);
        ops[sourceId].value += fx.value * count;
      }
    });

    return ops;
  }

  computeEffectiveOperations() {
    return this._computeActivationOps(this.state.cashRow.filter(Boolean));
  }

  finalizePayout(payout) {
    this.state.cash += payout;
    this.activateTile.tileBg.setFillStyle(0x000000, 0);

    const flash = this.add.text(740, ROW_CASH_Y, `+$${payout}k`, {
      fontSize: '52px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5).setAlpha(0);

    this.tweens.add({
      targets: flash, alpha: 1, scaleX: 1.15, scaleY: 1.15, duration: 280, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: flash, alpha: 0, y: flash.y - 50, duration: 700, delay: 500,
          onComplete: () => flash.destroy()
        });
      }
    });

    this.updateHUD();
    this.renderHand();
    this.checkGoalProgress();

    if (this.pendingDrawCount > 0) {
      const draws = this.pendingDrawCount;
      this.pendingDrawCount = 0;
      this.state.phase = 'drawing';
      this.showDrawModal(draws);
      // closeDrawModal() calls advanceTurn()
    } else {
      this.state.phase = 'playing';
      this.advanceTurn();
    }
  }

  // ── Product Row (Ship) ───────────────────────────────────
  onActivateProductClicked() {
    if (this.state.phase !== 'playing') return;
    if (this.state.freePlay) { this.state.freePlay = false; this.state.freePlayRow = null; this.clearFreePlayBanner(); }
    this.state.phase = 'activating';
    this.runProductActivationSequence();
  }

  runProductActivationSequence() {
    const BASE = 1;
    let score = BASE;

    const effectiveOps = this._computeActivationOps(this.state.productRow.filter(Boolean));

    this.productActivateTile.tileBg.setFillStyle(COLORS.productTileHover);
    this.showFloat(this.productActivateTile.x, this.productActivateTile.y - 90, 'BASE ×1', COLORS.text.purple, 900);

    const STEP_DELAY = 700;

    const processCard = (index) => {
      if (index >= 5) {
        this.finalizeProductActivation(score);
        return;
      }

      const cardId = this.state.productRow[index];
      if (cardId === null) { processCard(index + 1); return; }

      const slot = this.productSlotObjects[index];
      this.tweens.add({
        targets: slot.slotBg, alpha: 0.3, yoyo: true, duration: 220,
        onComplete: () => slot.slotBg.setAlpha(1)
      });

      const op = effectiveOps[cardId];

      if (op.type === 'add')           score = Math.round((score + op.value) * 100) / 100;
      else if (op.type === 'multiply') score = Math.round(score * op.value * 100) / 100;

      const label = op.type === 'multiply'
        ? `×${op.value}  →  ×${score}`
        : `+${op.value}  →  ×${score}`;

      this.showFloat(slot.x, slot.y - 90, label, COLORS.text.purple, 900);

      const card = this.cardsData.find(c => c.id === cardId);
      if (card.triggerEffect) {
        card._slotX = slot.x;
        card._slotY = slot.y;
        // Pass cash (not score) so cash-earning triggers update the bank, not the ship score
        // Capture cashBefore so we can apply a delta; modals that directly mutate state.cash
        // (e.g. spend_cash_boost_op) return the original payout unchanged, so delta = 0 and
        // the direct mutation is preserved. Gain effects return payout + earned, delta > 0.
        const cashBefore = this.state.cash;
        this.showTriggerModal(card, this.state.cash, (updatedCash, pendingDraws) => {
          this.state.cash += (updatedCash - cashBefore);
          if (pendingDraws) this.pendingDrawCount += pendingDraws;
          this.updateHUD();
          this.renderHand();
          this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
        });
      } else {
        this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
      }
    };

    this.time.delayedCall(600, () => processCard(0));
  }

  finalizeProductActivation(score) {
    this.state.productMultiplier = Math.round((this.state.productMultiplier + score) * 100) / 100;
    this.state.timesShippedThisRound++;
    this.productActivateTile.tileBg.setFillStyle(0x000000, 0);

    const flash = this.add.text(740, ROW_PROD_Y, `SHIP +${score}×`, {
      fontSize: '52px', fontFamily: FONT_BOARD, color: COLORS.text.purple, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5).setAlpha(0);

    this.tweens.add({
      targets: flash, alpha: 1, scaleX: 1.15, scaleY: 1.15, duration: 280, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: flash, alpha: 0, y: flash.y - 50, duration: 700, delay: 500,
          onComplete: () => flash.destroy()
        });
      }
    });

    this.updateHUD();
    this.checkGoalProgress();

    if (this.pendingDrawCount > 0) {
      const draws = this.pendingDrawCount;
      this.pendingDrawCount = 0;
      this.state.phase = 'drawing';
      this.showDrawModal(draws);
    } else {
      this.state.phase = 'playing';
      this.advanceTurn();
    }
  }

  // ── Resources Row (Hire / Draw) ───────────────────────────
  onHireClicked() {
    if (this.state.phase !== 'playing') return;
    if (this.state.freePlay) { this.state.freePlay = false; this.state.freePlayRow = null; this.clearFreePlayBanner(); }
    this.state.phase = 'drawing';
    this.runResActivationSequence();
  }

  runResActivationSequence() {
    const BASE = 1;
    let drawCount = BASE;

    const effectiveOps = this._computeActivationOps(this.state.resourcesRow.filter(Boolean));

    this.hireTile.tileBg.setFillStyle(COLORS.resTileActive);
    this.showFloat(this.hireTile.x, this.hireTile.y - 90, 'BASE +1 draw', COLORS.text.resSub, 900);

    const STEP_DELAY = 700;

    const processCard = (index) => {
      if (index >= 5) {
        this.finalizeDrawCount(drawCount);
        return;
      }

      const cardId = this.state.resourcesRow[index];
      if (cardId === null) { processCard(index + 1); return; }

      const slot = this.resSlotObjects[index];
      this.tweens.add({
        targets: slot.slotBg, alpha: 0.3, yoyo: true, duration: 220,
        onComplete: () => slot.slotBg.setAlpha(1)
      });

      const op     = effectiveOps[cardId];
      const before = drawCount;

      if (op.type === 'add')      drawCount = drawCount + op.value;
      else if (op.type === 'multiply') drawCount = drawCount * op.value;

      const diff  = drawCount - before;
      const label = op.type === 'multiply'
        ? `×${op.value}  →  ${drawCount} draws`
        : `+${diff} draw`;
      this.showFloat(slot.x, slot.y - 90, label, COLORS.text.resSub, 900);

      const card = this.cardsData.find(c => c.id === cardId);
      if (card.triggerEffect) {
        card._slotX = slot.x;
        card._slotY = slot.y;
        const CASH_TRIGGER_TYPES = ['gain_cash', 'gain_cash_per_type', 'gain_cash_per_discard'];
        if (CASH_TRIGGER_TYPES.includes(card.triggerEffect.type)) {
          // Cash-earning triggers: pass state.cash as payout, write delta back on resolve.
          const cashBefore = this.state.cash;
          this.showTriggerModal(card, this.state.cash, (updatedCash) => {
            this.state.cash += (updatedCash - cashBefore);
            this.updateHUD();
            this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
          });
        } else {
          // spend_cash_draw_resource: pendingDraws returned by modal go directly into drawCount.
          // swap_csuite: payout passed through unchanged, no draw change.
          this.showTriggerModal(card, drawCount, (_updatedValue, pendingDraws) => {
            if (pendingDraws) drawCount += pendingDraws;
            this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
          });
        }
      } else {
        this.time.delayedCall(STEP_DELAY, () => processCard(index + 1));
      }
    };

    this.time.delayedCall(600, () => processCard(0));
  }

  finalizeDrawCount(drawCount) {
    const count = Math.max(1, Math.round(drawCount));
    this.hireTile.tileBg.setFillStyle(0x000000, 0);

    const flash = this.add.text(740, ROW_RES_Y, `DRAW ${count}`, {
      fontSize: '52px', fontFamily: FONT_BOARD, color: COLORS.text.resSub, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5).setAlpha(0);

    this.tweens.add({
      targets: flash, alpha: 1, scaleX: 1.15, scaleY: 1.15, duration: 280, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: flash, alpha: 0, y: flash.y - 50, duration: 700, delay: 500,
          onComplete: () => { flash.destroy(); this.showDrawModal(count); }
        });
      }
    });
  }

  showDrawModal(drawsRemaining) {
    if (this.drawModal) this.drawModal.destroy();

    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const PW = 780;
    const PH = 380;

    const modal = this.add.container(0, 0).setDepth(50);
    this.drawModal = modal;

    // Overlay
    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.60));

    // Panel shadow + panel
    modal.add(this.add.rectangle(cx - 3, cy + 5, PW, PH, 0x000000, 0.60));
    modal.add(this.add.rectangle(cx, cy, PW, PH, COLORS.bg));

    // Header
    modal.add(this.add.text(cx, cy - PH / 2 + 28, 'CHOOSE A CARD', {
      fontSize: '18px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    // Draws remaining counter — store ref to update it
    const drawsText = this.add.text(cx, cy - PH / 2 + 52, `${drawsRemaining} draw${drawsRemaining !== 1 ? 's' : ''} remaining`, {
      fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5, 0.5);
    modal.add(drawsText);
    modal.drawsText = drawsText;
    modal.drawsRemaining = drawsRemaining;

    // Three columns: face-up card 1, face-up card 2, draw pile
    const cardSlotY = cy - 20;
    const card1X    = cx - 230;
    const card2X    = cx;
    const pileX     = cx + 230;

    this.buildModalCardSlot(modal, card1X, cardSlotY, 0);
    this.buildModalCardSlot(modal, card2X, cardSlotY, 1);
    this.buildModalDrawPile(modal, pileX, cardSlotY);

    // DONE / SKIP button
    const doneBtnY = cy + PH / 2 - 26;
    const doneBg = this.add.rectangle(cx, doneBtnY, 96, 36, COLORS.bg)
      .setStrokeStyle(1, 0x000000).setInteractive({ useHandCursor: true });
    const doneLabel = this.add.text(cx, doneBtnY, 'DONE / SKIP', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5, 0.5);
    modal.add([doneBg, doneLabel]);
    doneBg.on('pointerover', () => doneBg.setFillStyle(COLORS.buttonHover));
    doneBg.on('pointerout',  () => doneBg.setFillStyle(COLORS.bg));
    doneBg.on('pointerdown', () => this.closeDrawModal());
  }

  buildModalDrawPile(modal, x, y) {
    const pileEnabled = this.state.drawPile.length > 0;

    // Stack depth — back cards offset down-right
    for (let i = 3; i >= 1; i--) {
      const g = this.add.graphics({ x: x + i * 4, y: y + i * 4 });
      g.fillStyle(COLORS.cardBackLight);
      g.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
      g.lineStyle(1, 0xd1d1d1);
      g.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
      modal.add(g);
    }

    // Top card face-down
    const topCard = this.add.graphics({ x, y });
    const drawTop = (strokeW, strokeC) => {
      topCard.clear();
      topCard.fillStyle(pileEnabled ? 0xfdedcd : COLORS.slotDisabled);
      topCard.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
      topCard.lineStyle(strokeW, strokeC);
      topCard.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
    };
    drawTop(2, pileEnabled ? 0x4f4f4f : 0xd1d1d1);
    topCard.setStrokeStyle = (w, c) => drawTop(w, c);
    modal.add(topCard);

    // Inner border for card-back texture
    const innerG = this.add.graphics({ x, y });
    innerG.lineStyle(1, pileEnabled ? 0x4f4f4f : 0xd1d1d1);
    innerG.strokeRoundedRect(-(CARD_W - 14) / 2, -(CARD_H - 14) / 2, CARD_W - 14, CARD_H - 14, 3);
    modal.add(innerG);

    // Question mark
    modal.add(this.add.text(x, y - 14, '?', {
      fontSize: '38px', fontFamily: FONT_BOARD,
      color: pileEnabled ? '#4f4f4f' : '#d1d1d1', align: 'center'
    }).setOrigin(0.5, 0.5));

    // DRAW BLIND label at bottom of card
    modal.add(this.add.text(x, y + CARD_H / 2 - 18, 'DRAW BLIND', {
      fontSize: '8px', fontFamily: FONT_BOARD, fontStyle: 'bold',
      color: pileEnabled ? '#4f4f4f' : '#d1d1d1', align: 'center'
    }).setOrigin(0.5, 0.5));

    if (pileEnabled) {
      topCard.setInteractive(
        new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
        Phaser.Geom.Rectangle.Contains
      );
      topCard.on('pointerover', () => topCard.setStrokeStyle(2, 0x000000));
      topCard.on('pointerout',  () => topCard.setStrokeStyle(2, 0x4f4f4f));
      topCard.on('pointerdown', () => this.takeBlindCard(modal));
    }
  }

  buildModalCardSlot(modal, x, y, revealedIndex) {
    const id = this.state.revealedCards[revealedIndex];

    if (!id) {
      modal.add(this.add.rectangle(x, y, CARD_W + 10, CARD_H + 10, 0xebdfce).setStrokeStyle(0));
      modal.add(this.add.text(x, y, 'EMPTY', {
        fontSize: '9px', fontFamily: FONT_BOARD, color: '#895d27'
      }).setOrigin(0.5, 0.5));
      return;
    }

    const card      = this.cardsData.find(c => c.id === id);
    const typeColor = COLORS.typeColors[card.type] || COLORS.typeColorDefault;

    // Build full card visual (same as hand carousel) and move it into the modal container
    const cardContainer = this.buildCardVisual(card, x, y, false);
    modal.add(cardContainer);

    // Effect text below card
    this.addModalCardEffectText(modal, card, x, y);

    // Make interactive with hover highlight + click to take
    cardContainer.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    cardContainer.on('pointerover', () => cardContainer.cardBg.setStrokeStyle(2, 0xffffff));
    cardContainer.on('pointerout',  () => {
      cardContainer.cardBg.setStrokeStyle(1, typeColor);
    });
    cardContainer.on('pointerdown', () => this.takeFaceUpCard(id, revealedIndex, modal));
  }

  addModalCardEffectText(modal, card, x, cardCenterY) {
    let lineY = cardCenterY + CARD_H / 2 + 10;
    const addLine = (textObj) => {
      textObj.setPosition(x, lineY).setOrigin(0.5, 0);
      modal.add(textObj);
      lineY += textObj.height + 4;
    };
    if (card.specialEffect) {
      addLine(this.add.text(0, 0, `★ ${this.specialEffectLabel(card.specialEffect)}`, {
        fontSize: '10px', fontFamily: FONT_BOARD, color: COLORS.text.gold,
        align: 'center', wordWrap: { width: 180 }
      }));
    }
    if (card.bonusTurn) {
      addLine(this.add.text(0, 0, '+ +1 Bonus Turn', {
        fontSize: '10px', fontFamily: FONT_BOARD, color: COLORS.text.bonusTurn, align: 'center'
      }));
    }
    if (card.triggerEffect) {
      addLine(this.add.text(0, 0, `⚡ ${this.triggerEffectLabel(card.triggerEffect)}`, {
        fontSize: '10px', fontFamily: FONT_BOARD, color: COLORS.text.cyan,
        align: 'center', wordWrap: { width: 180 }
      }));
    }
  }

  showDrawPileViewer() {
    if (this.drawPileViewerModal) return;

    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const PW = 780;
    const PH = 380;

    const modal = this.add.container(0, 0).setDepth(50);
    this.drawPileViewerModal = modal;

    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.60));
    modal.add(this.add.rectangle(cx - 3, cy + 5, PW, PH, 0x000000, 0.60));
    modal.add(this.add.rectangle(cx, cy, PW, PH, COLORS.bg));

    modal.add(this.add.text(cx, cy - PH / 2 + 28, 'AVAILABLE CARDS', {
      fontSize: '15px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    modal.add(this.add.text(cx, cy - PH / 2 + 50, 'Activate the Resources row to draw.', {
      fontSize: '9px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
    }).setOrigin(0.5, 0.5));

    // Same three-column layout as CHOOSE A CARD, but non-interactive
    const cardSlotY = cy - 20;
    const card1X    = cx - 230;
    const card2X    = cx;
    const pileX     = cx + 230;

    // Face-up card 1
    const id0 = this.state.revealedCards[0];
    if (id0) {
      const card0 = this.cardsData.find(c => c.id === id0);
      modal.add(this.buildCardVisual(card0, card1X, cardSlotY, false));
      this.addModalCardEffectText(modal, card0, card1X, cardSlotY);
    } else {
      modal.add(this.add.rectangle(card1X, cardSlotY, CARD_W, CARD_H, COLORS.slotDisabled).setStrokeStyle(1, 0xd1d1d1));
      modal.add(this.add.text(card1X, cardSlotY, 'EMPTY', { fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.disabled }).setOrigin(0.5, 0.5));
    }

    // Face-up card 2
    const id1 = this.state.revealedCards[1];
    if (id1) {
      const card1 = this.cardsData.find(c => c.id === id1);
      modal.add(this.buildCardVisual(card1, card2X, cardSlotY, false));
      this.addModalCardEffectText(modal, card1, card2X, cardSlotY);
    } else {
      modal.add(this.add.rectangle(card2X, cardSlotY, CARD_W, CARD_H, COLORS.slotDisabled).setStrokeStyle(1, 0xd1d1d1));
      modal.add(this.add.text(card2X, cardSlotY, 'EMPTY', { fontSize: '9px', fontFamily: FONT_BOARD, color: COLORS.text.disabled }).setOrigin(0.5, 0.5));
    }

    // Draw pile (non-interactive, same visual as buildModalDrawPile)
    const pileEnabled = this.state.drawPile.length > 0;
    for (let i = 3; i >= 1; i--) {
      modal.add(this.add.rectangle(pileX + i * 4, cardSlotY + i * 4, CARD_W, CARD_H, COLORS.cardBackLight).setStrokeStyle(1, 0xd1d1d1));
    }
    modal.add(this.add.rectangle(pileX, cardSlotY, CARD_W, CARD_H, pileEnabled ? 0xfdedcd : COLORS.slotDisabled).setStrokeStyle(2, pileEnabled ? 0x4f4f4f : 0xd1d1d1));
    modal.add(this.add.rectangle(pileX, cardSlotY, CARD_W - 14, CARD_H - 14, pileEnabled ? 0xfdedcd : COLORS.slotDisabled).setStrokeStyle(1, pileEnabled ? 0x4f4f4f : 0xd1d1d1));
    modal.add(this.add.text(pileX, cardSlotY - 14, '?', {
      fontSize: '38px', fontFamily: FONT_BOARD, color: pileEnabled ? '#4f4f4f' : '#d1d1d1', align: 'center'
    }).setOrigin(0.5, 0.5));
    modal.add(this.add.text(pileX, cardSlotY + CARD_H / 2 - 18, `${this.state.drawPile.length} cards`, {
      fontSize: '8px', fontFamily: FONT_BOARD, fontStyle: 'bold',
      color: pileEnabled ? '#4f4f4f' : COLORS.text.disabled, align: 'center'
    }).setOrigin(0.5, 0.5));

    // Close button
    const closeY = cy + PH / 2 - 26;
    const closeBg = this.add.rectangle(cx, closeY, 96, 36, COLORS.bg)
      .setStrokeStyle(1, 0x000000).setInteractive({ useHandCursor: true });
    modal.add(closeBg);
    modal.add(this.add.text(cx, closeY, 'CLOSE', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5, 0.5));
    closeBg.on('pointerover', () => closeBg.setFillStyle(COLORS.buttonHover));
    closeBg.on('pointerout',  () => closeBg.setFillStyle(COLORS.bg));
    closeBg.on('pointerdown', () => { modal.destroy(); this.drawPileViewerModal = null; });
  }

  takeFaceUpCard(cardId, revealedIndex, modal) {
    this.state.hand.push(cardId);
    this.state.revealedCards[revealedIndex] = null;

    modal.drawsRemaining -= 1;
    if (modal.drawsRemaining <= 0) {
      this.closeDrawModal();
    } else {
      modal.drawsText.setText(`${modal.drawsRemaining} draw${modal.drawsRemaining !== 1 ? 's' : ''} remaining`);
      // Rebuild card slots to reflect removed card
      this.showDrawModal(modal.drawsRemaining);
    }
  }

  takeBlindCard(modal) {
    if (this.state.drawPile.length === 0) return;
    const cardId = this.state.drawPile.shift();
    this.state.hand.push(cardId);

    modal.drawsRemaining -= 1;
    if (modal.drawsRemaining <= 0) {
      this.closeDrawModal();
    } else {
      this.showDrawModal(modal.drawsRemaining);
    }
  }

  closeDrawModal() {
    if (this.drawModal) {
      this.drawModal.destroy();
      this.drawModal = null;
    }

    // Refill revealed cards from draw pile
    for (let i = 0; i < 2; i++) {
      if (this.state.revealedCards[i] === null && this.state.drawPile.length > 0) {
        this.state.revealedCards[i] = this.state.drawPile.shift();
      }
    }

    this.hireTile.tileBg.setFillStyle(0x000000, 0);
    this.state.phase = 'playing';
    this.renderHand();
    this.updateHUD();
    this.checkGoalProgress();
    this.advanceTurn();
  }

  // ── Trigger Effect Modals ─────────────────────────────────
  showTriggerModal(card, payout, resumeCallback) {
    const fx = card.triggerEffect;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const PW = 480;
    const PH = 220;

    // Auto effects — no modal needed
    if (fx.type === 'gain_cash') {
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+$${fx.amount}k`, COLORS.text.cyan, 1200);
      return resumeCallback(payout + fx.amount, 0);
    }

    if (fx.type === 'gain_cash_per_type') {
      const count = this._countBoardCardsOfType(fx.targetType);
      const earned = fx.amount * count;
      if (earned > 0) {
        this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+$${earned}k (${count}×${fx.targetType})`, COLORS.text.cyan, 1200);
      }
      return resumeCallback(payout + earned, 0);
    }

    if (fx.type === 'draw') {
      return resumeCallback(payout, fx.count);
    }

    if (fx.type === 'boost_value') {
      const matchFn = tc => fx.target === 'Self' ? tc.id === card.id : this._typeMatches(tc, fx.target);
      this._applyBoostValue(matchFn, fx.value);
      this._reRenderAllSlots();
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+$${fx.value}k val`, COLORS.text.cyan, 1000);
      return resumeCallback(payout, 0);
    }

    if (fx.type === 'boost_op') {
      const matchFn = tc => fx.target === 'Self' ? tc.id === card.id : this._typeMatches(tc, fx.target);
      this._applyPermanentOpBoost(matchFn, fx.value);
      this._reRenderAllSlots();
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `${fx.target}: +${fx.value} op`, COLORS.text.cyan, 1000);
      return resumeCallback(payout, 0);
    }

    if (fx.type === 'self_boost_per_type') {
      const count = this._countBoardCardsOfType(fx.targetType);
      this.state.cardOpBoosts[card.id] = (this.state.cardOpBoosts[card.id] || 0) + fx.value * count;
      this._reRenderAllSlots();
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+${fx.value * count} op (${count}×${fx.targetType})`, COLORS.text.cyan, 1000);
      return resumeCallback(payout, 0);
    }

    // Modal-based effects
    if (fx.type === 'spend_cash_draw') {
      return this._renderSpendCashDrawModal(card, payout, fx, resumeCallback);
    }
    if (fx.type === 'spend_cash_boost_op') {
      return this._renderSpendCashBoostOpModal(card, payout, fx, resumeCallback);
    }
    if (fx.type === 'spend_cash_swap') {
      return this._renderSpendCashSwapModal(card, payout, fx, resumeCallback);
    }
    if (fx.type === 'trade_draw') {
      return this._renderTradeDrawModal(card, payout, fx, resumeCallback);
    }
    if (fx.type === 'gain_cash_per_discard') {
      return this._renderGainCashPerDiscardModal(card, payout, fx, resumeCallback);
    }
    if (fx.type === 'gain_self_value_per_discard') {
      return this._renderGainSelfValuePerDiscardModal(card, payout, fx, resumeCallback);
    }
    if (fx.type === 'swap_card') {
      return this._renderSwapCardModal(card, payout, fx, resumeCallback);
    }

    const modal = this.add.container(0, 0);
    this.triggerModal = modal;

    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.60));
    modal.add(this.add.rectangle(cx - 3, cy + 5, PW, PH, 0x000000, 0.60));
    modal.add(this.add.rectangle(cx, cy, PW, PH, COLORS.bg));
    modal.add(this.add.text(cx, cy - PH / 2 + 24, `⚡ ${card.name.toUpperCase()}`, {
      fontSize: '13px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    if (fx.type === 'spend_cash_draw_resource') {
      this._renderSpendCashModal(modal, cx, cy, PH, payout, fx, resumeCallback);
    } else if (fx.type === 'swap_csuite') {
      this._renderSwapCsuiteModal(modal, cx, cy, PH, payout, fx, resumeCallback);
    } else {
      this._addModalButtons(modal, cx, cy + PH / 2 - 40,
        null, () => { modal.destroy(); resumeCallback(payout, 0); });
    }
  }

  _addModalButtons(modal, cx, btnY, acceptCallback, skipCallback) {
    const hasAccept = acceptCallback !== null;

    const acceptBg = this.add.rectangle(cx + 70, btnY, 96, 36, hasAccept ? 0x000000 : COLORS.buttonDisabled);
    if (hasAccept) acceptBg.setInteractive({ useHandCursor: true });
    modal.add(acceptBg);
    modal.add(this.add.text(cx + 70, btnY, 'ACCEPT', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: hasAccept ? '#ffffff' : '#999999'
    }).setOrigin(0.5, 0.5));
    if (hasAccept) {
      acceptBg.on('pointerover', () => acceptBg.setFillStyle(COLORS.buttonHoverDark));
      acceptBg.on('pointerout',  () => acceptBg.setFillStyle(0x000000));
      acceptBg.on('pointerdown', acceptCallback);
    }

    const skipBg = this.add.rectangle(cx - 70, btnY, 96, 36, COLORS.bg)
      .setStrokeStyle(1, 0x000000).setInteractive({ useHandCursor: true });
    modal.add(skipBg);
    modal.add(this.add.text(cx - 70, btnY, 'SKIP', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5, 0.5));
    skipBg.on('pointerover', () => skipBg.setFillStyle(COLORS.buttonHover));
    skipBg.on('pointerout',  () => skipBg.setFillStyle(COLORS.bg));
    skipBg.on('pointerdown', skipCallback);
  }

  _renderGainCashModal(modal, cx, cy, PH, payout, fx, resumeCallback) {
    modal.add(this.add.text(cx, cy - 20, `Gain +$${fx.amount}k?`, {
      fontSize: '18px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    modal.add(this.add.text(cx, cy + 14,
      `Running total: $${payout}k  →  $${payout + fx.amount}k`, {
        fontSize: '11px', fontFamily: FONT_BOARD, color: '#000000'
      }).setOrigin(0.5, 0.5));

    this._addModalButtons(modal, cx, cy + PH / 2 - 40,
      () => { modal.destroy(); resumeCallback(payout + fx.amount, 0); },
      () => { modal.destroy(); resumeCallback(payout, 0); }
    );
  }

  _renderSpendCashModal(modal, cx, cy, PH, payout, fx, resumeCallback) {
    const canAfford = this.state.cash >= fx.cost;

    modal.add(this.add.text(cx, cy - 30,
      `Pay $${fx.cost}k to draw ${fx.draws} resource card${fx.draws !== 1 ? 's' : ''}?`, {
        fontSize: '14px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold',
        align: 'center', wordWrap: { width: 420 }
      }).setOrigin(0.5, 0.5));

    modal.add(this.add.text(cx, cy + 8, `Your cash: $${this.state.cash}k`, {
      fontSize: '12px', fontFamily: FONT_BOARD, color: canAfford ? COLORS.text.cashSub : COLORS.text.negative
    }).setOrigin(0.5, 0.5));

    if (!canAfford) {
      modal.add(this.add.text(cx, cy + 28, 'Not enough cash', {
        fontSize: '10px', fontFamily: FONT_BOARD, color: COLORS.text.negative
      }).setOrigin(0.5, 0.5));
    }

    this._addModalButtons(modal, cx, cy + PH / 2 - 40,
      canAfford ? () => {
        this.state.cash -= fx.cost;
        this.updateHUD();
        modal.destroy();
        resumeCallback(payout, fx.draws);
      } : null,
      () => { modal.destroy(); resumeCallback(payout, 0); }
    );
  }

  _renderSwapCsuiteModal(modal, cx, cy, PH, payout, _fx, resumeCallback) {
    // Scan all rows for C-Suite cards
    const csuiteCards = [];
    const rowKeys = ['cashRow', 'productRow', 'resourcesRow'];
    rowKeys.forEach(rowKey => {
      this.state[rowKey].forEach((id, i) => {
        if (!id) return;
        const c = this.cardsData.find(c => c.id === id);
        if (c.type === 'C-Suite') csuiteCards.push({ rowKey, slotIndex: i, cardId: id, name: c.name });
      });
    });

    if (csuiteCards.length === 0) {
      modal.add(this.add.text(cx, cy - 10, 'No C-Suite cards on the board', {
        fontSize: '13px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
      }).setOrigin(0.5, 0.5));
      // SKIP only — no ACCEPT
      const skipBg = this.add.rectangle(cx, cy + PH / 2 - 40, 96, 36, COLORS.bg)
        .setStrokeStyle(1, 0x000000).setInteractive({ useHandCursor: true });
      modal.add(skipBg);
      modal.add(this.add.text(cx, cy + PH / 2 - 40, 'SKIP', {
        fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
      }).setOrigin(0.5, 0.5));
      skipBg.on('pointerover', () => skipBg.setFillStyle(COLORS.buttonHover));
      skipBg.on('pointerout',  () => skipBg.setFillStyle(COLORS.bg));
      skipBg.on('pointerdown', () => { modal.destroy(); resumeCallback(payout, 0); });
      return;
    }

    modal.swapState = { phase: 1, selected: null };

    const instrText = this.add.text(cx, cy - PH / 2 + 52, 'Select a C-Suite card to replace', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
    }).setOrigin(0.5, 0.5);
    modal.add(instrText);
    modal.instrText = instrText;

    const rowLabel = { cashRow: 'CASH', productRow: 'PRODUCT', resourcesRow: 'RES' };
    const listStartY = cy - 55;
    const btnH = 26;

    csuiteCards.forEach((entry, idx) => {
      const btnY = listStartY + idx * (btnH + 4);
      const bg = this.add.rectangle(cx, btnY, 340, btnH, 0xffffff)
        .setStrokeStyle(1, 0xd1d1d1).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx, btnY,
        `[${rowLabel[entry.rowKey]}] Slot ${entry.slotIndex + 1}: ${entry.name}`, {
          fontSize: '11px', fontFamily: FONT_BOARD, color: '#000000'
        }).setOrigin(0.5, 0.5);
      modal.add([bg, lbl]);
      entry.bg = bg;

      bg.on('pointerover', () => { if (modal.swapState.phase === 1) bg.setFillStyle(0xf0f0f0); });
      bg.on('pointerout',  () => {
        if (!modal.swapState.selected || modal.swapState.selected !== entry) bg.setFillStyle(0xffffff);
      });
      bg.on('pointerdown', () => this._handleSwapPhase1(modal, entry, csuiteCards, cx, cy, PH, payout, resumeCallback));
    });

    // SKIP button
    const skipBg = this.add.rectangle(cx, cy + PH / 2 - 40, 96, 36, COLORS.bg)
      .setStrokeStyle(1, 0x000000).setInteractive({ useHandCursor: true });
    modal.add(skipBg);
    modal.add(this.add.text(cx, cy + PH / 2 - 40, 'SKIP', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5, 0.5));
    skipBg.on('pointerover', () => skipBg.setFillStyle(COLORS.buttonHover));
    skipBg.on('pointerout',  () => skipBg.setFillStyle(COLORS.bg));
    skipBg.on('pointerdown', () => { modal.destroy(); resumeCallback(payout, 0); });
  }

  _renderSpendCashDrawModal(_card, payout, fx, resumeCallback) {
    const canAfford = this.state.cash >= fx.cost;
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow  = this.add.rectangle(637, 365, 460, 220, 0x000000, 0.60).setDepth(30);
    const box = this.add.rectangle(640, 360, 460, 220, COLORS.bg).setDepth(31);
    const title = this.add.text(640, 280, `Pay $${fx.cost}k → Draw ${fx.draws} card${fx.draws !== 1 ? 's' : ''}?`, {
      fontSize: '20px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 400 }
    }).setOrigin(0.5).setDepth(32);
    const cashLabel = this.add.text(640, 320, `Cash: $${this.state.cash}k`, {
      fontSize: '16px', fontFamily: FONT_BOARD, color: canAfford ? COLORS.text.cashSub : COLORS.text.negative
    }).setOrigin(0.5).setDepth(32);

    const cleanup = () => { overlay.destroy(); shadow.destroy(); box.destroy(); title.destroy(); cashLabel.destroy(); acceptBtn.destroy(); skipBtn.destroy(); };

    const acceptBtn = this.add.rectangle(700, 400, 96, 36, canAfford ? 0x000000 : COLORS.buttonDisabled).setDepth(32);
    const acceptLabel = this.add.text(700, 400, 'ACCEPT', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: canAfford ? '#ffffff' : '#999999'
    }).setOrigin(0.5).setDepth(33);
    if (canAfford) {
      acceptBtn.setInteractive({ useHandCursor: true });
      acceptBtn.on('pointerover', () => acceptBtn.setFillStyle(COLORS.buttonHoverDark));
      acceptBtn.on('pointerout',  () => acceptBtn.setFillStyle(0x000000));
      acceptBtn.on('pointerdown', () => {
        this.state.cash -= fx.cost;
        this.updateHUD();
        cleanup(); acceptLabel.destroy();
        resumeCallback(payout, fx.draws);
      });
    }

    const skipBtn = this.add.rectangle(580, 400, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(580, 400, 'SKIP', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));
    skipBtn.on('pointerdown', () => { cleanup(); acceptLabel.destroy(); skipLabel.destroy(); resumeCallback(payout, 0); });
  }

  _renderSpendCashBoostOpModal(card, payout, fx, resumeCallback) {
    const canAfford = this.state.cash >= fx.cost;
    const targetLabel = fx.target === 'Self' ? card.name : (fx.scope === 'all' ? `all ${fx.target}` : fx.target);
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow  = this.add.rectangle(637, 365, 500, 240, 0x000000, 0.60).setDepth(30);
    const box = this.add.rectangle(640, 360, 500, 240, COLORS.bg).setDepth(31);
    const title = this.add.text(640, 280, `Pay $${fx.cost}k → ${targetLabel}: +${fx.value} op?`, {
      fontSize: '20px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 460 }
    }).setOrigin(0.5).setDepth(32);
    const cashLabel = this.add.text(640, 325, `Cash: $${this.state.cash}k`, {
      fontSize: '16px', fontFamily: FONT_BOARD, color: canAfford ? COLORS.text.cashSub : COLORS.text.negative
    }).setOrigin(0.5).setDepth(32);

    const cleanup = () => { overlay.destroy(); shadow.destroy(); box.destroy(); title.destroy(); cashLabel.destroy(); acceptBtn.destroy(); acceptLabel.destroy(); skipBtn.destroy(); skipLabel.destroy(); };

    const acceptBtn = this.add.rectangle(700, 405, 96, 36, canAfford ? 0x000000 : COLORS.buttonDisabled).setDepth(32);
    const acceptLabel = this.add.text(700, 405, 'ACCEPT', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: canAfford ? '#ffffff' : '#999999'
    }).setOrigin(0.5).setDepth(33);
    if (canAfford) {
      acceptBtn.setInteractive({ useHandCursor: true });
      acceptBtn.on('pointerover', () => acceptBtn.setFillStyle(COLORS.buttonHoverDark));
      acceptBtn.on('pointerout',  () => acceptBtn.setFillStyle(0x000000));
      acceptBtn.on('pointerdown', () => {
        this.state.cash -= fx.cost;
        this.updateHUD();
        if (fx.target === 'Self') {
          this.state.cardOpBoosts[card.id] = (this.state.cardOpBoosts[card.id] || 0) + fx.value;
        } else {
          const matchFn = tc => this._typeMatches(tc, fx.target) || tc.role === fx.target;
          [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow]
            .filter(Boolean)
            .forEach(id => {
              const tc = this.cardsData.find(c => c.id === id);
              if (tc && matchFn(tc)) {
                this.state.cardOpBoosts[id] = (this.state.cardOpBoosts[id] || 0) + fx.value;
              }
            });
        }
        this._reRenderAllSlots();
        cleanup();
        resumeCallback(payout, 0);
      });
    }

    const skipBtn = this.add.rectangle(580, 405, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(580, 405, 'SKIP', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));
    skipBtn.on('pointerdown', () => { cleanup(); resumeCallback(payout, 0); });
  }

  _renderTradeDrawModal(_card, payout, fx, resumeCallback) {
    const hand = this.state.hand;
    if (hand.length === 0) { return resumeCallback(payout, 0); }

    const PER_PAGE = 5;
    let pageOffset = 0;

    const overlay   = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow    = this.add.rectangle(637, 365, 700, 380, 0x000000, 0.60).setDepth(30);
    const box       = this.add.rectangle(640, 360, 700, 380, COLORS.bg).setDepth(31);
    const title     = this.add.text(640, 220, `Trade a card from hand → draw ${fx.draws}`, {
      fontSize: '20px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    const sub       = this.add.text(640, 255, 'Select a card to discard:', {
      fontSize: '14px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5).setDepth(32);
    const pageLabel = this.add.text(640, 406, '', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.hint
    }).setOrigin(0.5).setDepth(32);
    const leftArrow  = this.add.text(315, 340, '◀', {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.secondary
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(965, 340, '▶', {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.secondary
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const skipBtn   = this.add.rectangle(640, 450, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(640, 450, 'SKIP', {
      fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000'
    }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));

    let cardObjs = [];
    const cleanup = () => {
      [overlay, shadow, box, title, sub, pageLabel, leftArrow, rightArrow, skipBtn, skipLabel].forEach(o => o.destroy());
      cardObjs.forEach(o => o.destroy());
    };

    const renderPage = () => {
      cardObjs.forEach(o => o.destroy());
      cardObjs = [];
      const page = hand.slice(pageOffset, pageOffset + PER_PAGE);
      const startX = 640 - ((page.length - 1) * 110) / 2;
      page.forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX + i * 110;
        const cy = 340;
        const bg = this.add.rectangle(cx, cy, 100, 130, 0xffffff).setStrokeStyle(1, 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 90 } }).setOrigin(0.5).setDepth(33);
        const tp = this.add.text(cx, cy + 40, hc.type, { fontSize: '9px', fontFamily: FONT_BOARD, color: '#4f4f4f', align: 'center' }).setOrigin(0.5).setDepth(33);
        cardObjs.push(bg, nm, tp);
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0x000000));
        bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xd1d1d1));
        bg.on('pointerdown', () => {
          const idx = this.state.hand.indexOf(cid);
          if (idx !== -1) this.state.hand.splice(idx, 1);
          this.renderHand();
          cleanup();
          resumeCallback(payout, fx.draws);
        });
      });
      const hasMore = hand.length > PER_PAGE;
      pageLabel.setText(hasMore ? `${pageOffset + 1}–${Math.min(pageOffset + PER_PAGE, hand.length)} of ${hand.length}` : '');
      leftArrow.setAlpha(pageOffset > 0 ? 1 : 0.2);
      rightArrow.setAlpha(pageOffset + PER_PAGE < hand.length ? 1 : 0.2);
    };

    leftArrow.on('pointerdown',  () => { if (pageOffset > 0) { pageOffset -= PER_PAGE; renderPage(); } });
    rightArrow.on('pointerdown', () => { if (pageOffset + PER_PAGE < hand.length) { pageOffset += PER_PAGE; renderPage(); } });
    skipBtn.on('pointerdown', () => { cleanup(); resumeCallback(payout, 0); });

    renderPage();
  }

  _renderGainCashPerDiscardModal(_card, payout, fx, resumeCallback) {
    const hand = this.state.hand;
    if (hand.length === 0) { return resumeCallback(payout, 0); }

    const PER_PAGE = 5;
    let pageOffset = 0;
    const selected = new Set();

    const overlay    = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow     = this.add.rectangle(637, 365, 760, 400, 0x000000, 0.60).setDepth(30);
    const box        = this.add.rectangle(640, 360, 760, 400, COLORS.bg).setDepth(31);
    const title      = this.add.text(640, 210, `Discard cards → earn $${fx.amount}k each`, {
      fontSize: '20px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    const totalLabel = this.add.text(640, 245, 'Earn: $0k', {
      fontSize: '16px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub
    }).setOrigin(0.5).setDepth(32);
    const pageLabel  = this.add.text(640, 406, '', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.hint
    }).setOrigin(0.5).setDepth(32);
    const leftArrow  = this.add.text(280, 340, '◀', {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.secondary
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(1000, 340, '▶', {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.secondary
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const acceptBtn  = this.add.rectangle(700, 455, 96, 36, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const acceptLabel = this.add.text(700, 455, 'ACCEPT', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#ffffff' }).setOrigin(0.5).setDepth(33);
    acceptBtn.on('pointerover', () => acceptBtn.setFillStyle(COLORS.buttonHoverDark));
    acceptBtn.on('pointerout',  () => acceptBtn.setFillStyle(0x000000));
    const skipBtn    = this.add.rectangle(580, 455, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel  = this.add.text(580, 455, 'SKIP', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000' }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));

    let cardObjs = [];
    const cleanup = () => {
      [overlay, shadow, box, title, totalLabel, pageLabel, leftArrow, rightArrow, acceptBtn, acceptLabel, skipBtn, skipLabel].forEach(o => o.destroy());
      cardObjs.forEach(o => o.destroy());
    };

    const updateTotal = () => {
      totalLabel.setText(`Earn: $${selected.size * fx.amount}k`);
    };

    const renderPage = () => {
      cardObjs.forEach(o => o.destroy());
      cardObjs = [];
      const page = hand.slice(pageOffset, pageOffset + PER_PAGE);
      const startX = 640 - ((page.length - 1) * 120) / 2;
      page.forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX + i * 120;
        const cy = 340;
        const isSelected = selected.has(cid);
        const bg = this.add.rectangle(cx, cy, 110, 130, 0xffffff).setStrokeStyle(isSelected ? 3 : 1, isSelected ? 0x000000 : 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        cardObjs.push(bg, nm);
        bg.on('pointerdown', () => {
          if (selected.has(cid)) selected.delete(cid); else selected.add(cid);
          bg.setStrokeStyle(selected.has(cid) ? 3 : 1, selected.has(cid) ? 0x000000 : 0xd1d1d1);
          updateTotal();
        });
      });
      const hasMore = hand.length > PER_PAGE;
      pageLabel.setText(hasMore ? `${pageOffset + 1}–${Math.min(pageOffset + PER_PAGE, hand.length)} of ${hand.length}` : '');
      leftArrow.setAlpha(pageOffset > 0 ? 1 : 0.2);
      rightArrow.setAlpha(pageOffset + PER_PAGE < hand.length ? 1 : 0.2);
    };

    leftArrow.on('pointerdown',  () => { if (pageOffset > 0) { pageOffset -= PER_PAGE; renderPage(); } });
    rightArrow.on('pointerdown', () => { if (pageOffset + PER_PAGE < hand.length) { pageOffset += PER_PAGE; renderPage(); } });
    acceptBtn.on('pointerdown', () => {
      const earned = selected.size * fx.amount;
      selected.forEach(cid => {
        const idx = this.state.hand.indexOf(cid);
        if (idx !== -1) this.state.hand.splice(idx, 1);
      });
      this.renderHand();
      cleanup();
      resumeCallback(payout + earned, 0);
    });
    skipBtn.on('pointerdown', () => { cleanup(); resumeCallback(payout, 0); });

    renderPage();
  }

  _renderGainSelfValuePerDiscardModal(card, payout, fx, resumeCallback) {
    const hand = this.state.hand;
    if (hand.length === 0) { return resumeCallback(payout, 0); }

    const PER_PAGE = 5;
    let pageOffset = 0;
    const selected = new Set();

    const overlay    = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow     = this.add.rectangle(637, 365, 760, 400, 0x000000, 0.60).setDepth(30);
    const box        = this.add.rectangle(640, 360, 760, 400, COLORS.bg).setDepth(31);
    const title      = this.add.text(640, 210, `Discard cards → earn +$${fx.amount}k to your value each`, {
      fontSize: '20px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    const totalLabel = this.add.text(640, 245, 'Value gained: $0k', {
      fontSize: '16px', fontFamily: FONT_BOARD, color: COLORS.text.cashSub
    }).setOrigin(0.5).setDepth(32);
    const pageLabel  = this.add.text(640, 406, '', {
      fontSize: '11px', fontFamily: FONT_BOARD, color: COLORS.text.hint
    }).setOrigin(0.5).setDepth(32);
    const leftArrow  = this.add.text(280, 340, '◀', {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.secondary
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(1000, 340, '▶', {
      fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.secondary
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const acceptBtn   = this.add.rectangle(700, 455, 96, 36, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const acceptLabel = this.add.text(700, 455, 'ACCEPT', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#ffffff' }).setOrigin(0.5).setDepth(33);
    acceptBtn.on('pointerover', () => acceptBtn.setFillStyle(COLORS.buttonHoverDark));
    acceptBtn.on('pointerout',  () => acceptBtn.setFillStyle(0x000000));
    const skipBtn   = this.add.rectangle(580, 455, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(580, 455, 'SKIP', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000' }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));

    let cardObjs = [];
    const cleanup = () => {
      [overlay, shadow, box, title, totalLabel, pageLabel, leftArrow, rightArrow, acceptBtn, acceptLabel, skipBtn, skipLabel].forEach(o => o.destroy());
      cardObjs.forEach(o => o.destroy());
    };

    const updateTotal = () => {
      totalLabel.setText(`Value gained: $${selected.size * fx.amount}k`);
    };

    const renderPage = () => {
      cardObjs.forEach(o => o.destroy());
      cardObjs = [];
      const page = hand.slice(pageOffset, pageOffset + PER_PAGE);
      const startX = 640 - ((page.length - 1) * 120) / 2;
      page.forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX + i * 120;
        const cy = 340;
        const isSelected = selected.has(cid);
        const bg = this.add.rectangle(cx, cy, 110, 130, 0xffffff).setStrokeStyle(isSelected ? 3 : 1, isSelected ? 0x000000 : 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        cardObjs.push(bg, nm);
        bg.on('pointerdown', () => {
          if (selected.has(cid)) selected.delete(cid); else selected.add(cid);
          bg.setStrokeStyle(selected.has(cid) ? 3 : 1, selected.has(cid) ? 0x000000 : 0xd1d1d1);
          updateTotal();
        });
      });
      const hasMore = hand.length > PER_PAGE;
      pageLabel.setText(hasMore ? `${pageOffset + 1}–${Math.min(pageOffset + PER_PAGE, hand.length)} of ${hand.length}` : '');
      leftArrow.setAlpha(pageOffset > 0 ? 1 : 0.2);
      rightArrow.setAlpha(pageOffset + PER_PAGE < hand.length ? 1 : 0.2);
    };

    leftArrow.on('pointerdown',  () => { if (pageOffset > 0) { pageOffset -= PER_PAGE; renderPage(); } });
    rightArrow.on('pointerdown', () => { if (pageOffset + PER_PAGE < hand.length) { pageOffset += PER_PAGE; renderPage(); } });
    acceptBtn.on('pointerdown', () => {
      const gained = selected.size * fx.amount;
      selected.forEach(cid => {
        const idx = this.state.hand.indexOf(cid);
        if (idx !== -1) this.state.hand.splice(idx, 1);
      });
      // Add value bonus to this card (self)
      if (gained > 0) {
        this.state.valueBonuses[card.id] = (this.state.valueBonuses[card.id] || 0) + gained;
        this._reRenderAllSlots();
        this.showFloat(card._slotX || GAME_W - 110, card._slotY || ROW_CASH_Y, `+$${gained}k val`, COLORS.text.gold, 1200);
      }
      this.renderHand();
      cleanup();
      resumeCallback(payout, 0);
    });
    skipBtn.on('pointerdown', () => { cleanup(); resumeCallback(payout, 0); });

    renderPage();
  }

  _renderSwapCardModal(_card, payout, fx, resumeCallback) {
    // Phase 1: select board card of boardType to remove
    // Phase 2: select hand card of handType to place in that slot
    const allRows = [
      { row: this.state.cashRow, rowName: 'cash' },
      { row: this.state.productRow, rowName: 'product' },
      { row: this.state.resourcesRow, rowName: 'resources' }
    ];

    const boardCandidates = [];
    allRows.forEach(({ row, rowName }) => {
      row.forEach((cid, slotIdx) => {
        if (!cid) return;
        const bc = this.cardsData.find(c => c.id === cid);
        if (bc && this._typeMatches(bc, fx.boardType)) {
          boardCandidates.push({ cid, rowName, slotIdx });
        }
      });
    });

    const handCandidates = this.state.hand.filter(cid => {
      const hc = this.cardsData.find(c => c.id === cid);
      return hc && this._typeMatches(hc, fx.handType);
    });

    if (boardCandidates.length === 0 || handCandidates.length === 0) {
      return resumeCallback(payout, 0);
    }

    const objs = [];
    const cleanup = () => objs.forEach(o => o.destroy());

    const showPhase2 = (boardSlot) => {
      cleanup();
      const overlay2 = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
      const shadow2  = this.add.rectangle(637, 365, 660, 340, 0x000000, 0.60).setDepth(30);
      const box2 = this.add.rectangle(640, 360, 660, 340, COLORS.bg).setDepth(31);
      const t2 = this.add.text(640, 240, `Choose ${fx.handType} from hand to place:`, {
        fontSize: '18px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
      }).setOrigin(0.5).setDepth(32);
      const p2objs = [overlay2, shadow2, box2, t2];

      const startX2 = 640 - ((Math.min(handCandidates.length, 5) - 1) * 120) / 2;
      handCandidates.slice(0, 5).forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX2 + i * 120;
        const cy = 350;
        const bg = this.add.rectangle(cx, cy, 110, 130, 0xffffff).setStrokeStyle(1, 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        p2objs.push(bg, nm);
        bg.on('pointerdown', () => {
          const targetRow = boardSlot.rowName === 'cash' ? this.state.cashRow
                          : boardSlot.rowName === 'product'   ? this.state.productRow
                          : this.state.resourcesRow;
          targetRow[boardSlot.slotIdx] = cid;
          const handIdx = this.state.hand.indexOf(cid);
          if (handIdx !== -1) this.state.hand.splice(handIdx, 1);
          this.renderHand();
          this._reRenderSlot(boardSlot.rowName, boardSlot.slotIdx);
          p2objs.forEach(o => o.destroy());
          resumeCallback(payout, 0);
        });
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0x000000));
        bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xd1d1d1));
      });

      const skipBtn2 = this.add.rectangle(640, 450, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
      const skipLabel2 = this.add.text(640, 450, 'SKIP', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000' }).setOrigin(0.5).setDepth(33);
      skipBtn2.on('pointerover', () => skipBtn2.setFillStyle(COLORS.buttonHover));
      skipBtn2.on('pointerout',  () => skipBtn2.setFillStyle(COLORS.bg));
      skipBtn2.on('pointerdown', () => { p2objs.forEach(o => o.destroy()); skipBtn2.destroy(); skipLabel2.destroy(); resumeCallback(payout, 0); });
      p2objs.push(skipBtn2, skipLabel2);
    };

    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow  = this.add.rectangle(637, 365, 660, 340, 0x000000, 0.60).setDepth(30);
    const box = this.add.rectangle(640, 360, 660, 340, COLORS.bg).setDepth(31);
    const t1 = this.add.text(640, 240, `Choose ${fx.boardType} card on board to swap:`, {
      fontSize: '18px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    objs.push(overlay, shadow, box, t1);

    const startX = 640 - ((Math.min(boardCandidates.length, 5) - 1) * 120) / 2;
    boardCandidates.slice(0, 5).forEach((slot, i) => {
      const bc = this.cardsData.find(c => c.id === slot.cid);
      const cx = startX + i * 120;
      const cy = 350;
      const bg = this.add.rectangle(cx, cy, 110, 130, 0xffffff).setStrokeStyle(1, 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
      const nm = this.add.text(cx, cy - 30, bc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
      objs.push(bg, nm);
      bg.on('pointerdown', () => showPhase2(slot));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0x000000));
      bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xd1d1d1));
    });

    const skipBtn = this.add.rectangle(640, 450, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(640, 450, 'SKIP', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000' }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));
    skipBtn.on('pointerdown', () => { cleanup(); skipBtn.destroy(); skipLabel.destroy(); resumeCallback(payout, 0); });
    objs.push(skipBtn, skipLabel);
  }

  _renderSpendCashSwapModal(_card, payout, fx, resumeCallback) {
    const canAfford = this.state.cash >= fx.cost;
    const handCandidates = this.state.hand.filter(cid => {
      const hc = this.cardsData.find(c => c.id === cid);
      return hc && (fx.handType === 'any' || this._typeMatches(hc, fx.handType));
    });

    if (!canAfford || handCandidates.length === 0) {
      return resumeCallback(payout, 0);
    }

    const allRows = [
      { row: this.state.cashRow, rowName: 'cash' },
      { row: this.state.productRow, rowName: 'product' },
      { row: this.state.resourcesRow, rowName: 'resources' }
    ];
    const boardCandidates = [];
    allRows.forEach(({ row, rowName }) => {
      row.forEach((cid, slotIdx) => {
        if (!cid) return;
        const bc = this.cardsData.find(c => c.id === cid);
        if (bc && (fx.boardType === 'any' || this._typeMatches(bc, fx.boardType))) {
          boardCandidates.push({ cid, rowName, slotIdx });
        }
      });
    });

    if (boardCandidates.length === 0) {
      return resumeCallback(payout, 0);
    }

    const objs = [];
    const cleanup = () => objs.forEach(o => o.destroy());

    const showPhase2 = (boardSlot) => {
      cleanup();
      const overlay2 = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
      const shadow2  = this.add.rectangle(637, 365, 660, 340, 0x000000, 0.60).setDepth(30);
      const box2 = this.add.rectangle(640, 360, 660, 340, COLORS.bg).setDepth(31);
      const t2 = this.add.text(640, 240, `Choose ${fx.handType} from hand to place:`, {
        fontSize: '18px', fontFamily: FONT_BOARD, color: '#000000', align: 'center'
      }).setOrigin(0.5).setDepth(32);
      const p2objs = [overlay2, shadow2, box2, t2];

      const startX2 = 640 - ((Math.min(handCandidates.length, 5) - 1) * 120) / 2;
      handCandidates.slice(0, 5).forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX2 + i * 120;
        const cy = 350;
        const bg = this.add.rectangle(cx, cy, 110, 130, 0xffffff).setStrokeStyle(1, 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        p2objs.push(bg, nm);
        bg.on('pointerdown', () => {
          this.state.cash -= fx.cost;
          this.updateHUD();
          const targetRow = boardSlot.rowName === 'cash' ? this.state.cashRow
                          : boardSlot.rowName === 'product'   ? this.state.productRow
                          : this.state.resourcesRow;
          targetRow[boardSlot.slotIdx] = cid;
          const handIdx = this.state.hand.indexOf(cid);
          if (handIdx !== -1) this.state.hand.splice(handIdx, 1);
          this.renderHand();
          this._reRenderSlot(boardSlot.rowName, boardSlot.slotIdx);
          p2objs.forEach(o => o.destroy());
          resumeCallback(payout, 0);
        });
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0x000000));
        bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xd1d1d1));
      });

      const skipBtn2 = this.add.rectangle(640, 450, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
      const skipLabel2 = this.add.text(640, 450, 'SKIP', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000' }).setOrigin(0.5).setDepth(33);
      skipBtn2.on('pointerover', () => skipBtn2.setFillStyle(COLORS.buttonHover));
      skipBtn2.on('pointerout',  () => skipBtn2.setFillStyle(COLORS.bg));
      skipBtn2.on('pointerdown', () => { p2objs.forEach(o => o.destroy()); skipBtn2.destroy(); skipLabel2.destroy(); resumeCallback(payout, 0); });
      p2objs.push(skipBtn2, skipLabel2);
    };

    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.60).setDepth(30);
    const shadow  = this.add.rectangle(637, 365, 660, 340, 0x000000, 0.60).setDepth(30);
    const box = this.add.rectangle(640, 360, 660, 340, COLORS.bg).setDepth(31);
    const t1 = this.add.text(640, 220, `Pay $${fx.cost}k → choose any board card to swap:`, {
      fontSize: '18px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 600 }
    }).setOrigin(0.5).setDepth(32);
    objs.push(overlay, shadow, box, t1);

    const startX = 640 - ((Math.min(boardCandidates.length, 5) - 1) * 120) / 2;
    boardCandidates.slice(0, 5).forEach((slot, i) => {
      const bc = this.cardsData.find(c => c.id === slot.cid);
      const cx = startX + i * 120;
      const cy = 350;
      const bg = this.add.rectangle(cx, cy, 110, 130, 0xffffff).setStrokeStyle(1, 0xd1d1d1).setDepth(32).setInteractive({ useHandCursor: true });
      const nm = this.add.text(cx, cy - 30, bc.name, { fontSize: '10px', fontFamily: FONT_BOARD, color: '#000000', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
      objs.push(bg, nm);
      bg.on('pointerdown', () => showPhase2(slot));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0x000000));
      bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xd1d1d1));
    });

    const skipBtn = this.add.rectangle(640, 450, 96, 36, COLORS.bg).setStrokeStyle(1, 0x000000).setDepth(32).setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(640, 450, 'SKIP', { fontSize: '12px', fontFamily: FONT_BOARD, color: '#000000' }).setOrigin(0.5).setDepth(33);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(COLORS.buttonHover));
    skipBtn.on('pointerout',  () => skipBtn.setFillStyle(COLORS.bg));
    skipBtn.on('pointerdown', () => { cleanup(); skipBtn.destroy(); skipLabel.destroy(); resumeCallback(payout, 0); });
    objs.push(skipBtn, skipLabel);
  }

  _handleSwapPhase1(modal, csuiteEntry, allCsuite, cx, cy, _PH, payout, resumeCallback) {
    if (modal.swapState.phase !== 1) return;
    modal.swapState.phase = 2;
    modal.swapState.selected = csuiteEntry;

    // Highlight selected C-Suite button
    allCsuite.forEach(e => e.bg.setFillStyle(0xffffff));
    csuiteEntry.bg.setFillStyle(0xf0f0f0).setStrokeStyle(2, 0x000000);

    modal.instrText.setText('Now select a card from your hand to place here');

    // Remove existing C-Suite buttons' interactivity (they've served their purpose)
    allCsuite.forEach(e => e.bg.removeInteractive());

    // Build hand card list
    const handStartY = cy - 55;
    const btnH = 26;
    this.state.hand.forEach((handCardId, idx) => {
      const handCard = this.cardsData.find(c => c.id === handCardId);
      const btnY = handStartY + idx * (btnH + 4);
      const bg = this.add.rectangle(cx + 0, btnY, 340, btnH, COLORS.csuiteButtonBg)
        .setStrokeStyle(1, COLORS.csuiteButtonStroke).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx, btnY, `${handCard.name}  ($${handCard.cost * 100}k)`, {
        fontSize: '11px', fontFamily: FONT_BOARD, color: '#aaccff'
      }).setOrigin(0.5, 0.5);
      modal.add([bg, lbl]);

      bg.on('pointerover', () => bg.setFillStyle(COLORS.csuiteButtonHover));
      bg.on('pointerout',  () => bg.setFillStyle(COLORS.csuiteButtonBg));
      bg.on('pointerdown', () => {
        this._executeSwap(modal, csuiteEntry, handCardId, payout, resumeCallback);
      });
    });
  }

  _executeSwap(modal, csuiteEntry, handCardId, payout, resumeCallback) {
    // Place hand card into the C-Suite's slot
    this.state[csuiteEntry.rowKey][csuiteEntry.slotIndex] = handCardId;
    // Remove hand card from hand
    this.state.hand = this.state.hand.filter(id => id !== handCardId);
    // C-Suite is discarded (removed from all state — already overwritten above)

    const rowType = csuiteEntry.rowKey === 'cashRow'      ? 'cash'
                  : csuiteEntry.rowKey === 'productRow'   ? 'product'
                  : 'resources';
    this._reRenderSlot(rowType, csuiteEntry.slotIndex);
    this.refreshBoardOpLabels();
    this.refreshBoardValueLabels();
    this.renderHand();
    this.updateHUD();

    modal.destroy();
    this.triggerModal = null;
    resumeCallback(payout, 0);
  }

  _reRenderAllSlots() {
    ['cash', 'product', 'resources'].forEach(rowType => {
      for (let i = 0; i < 5; i++) this._reRenderSlot(rowType, i);
    });
    this.refreshBoardOpLabels();
    this.refreshBoardValueLabels();
  }

  _reRenderSlot(rowType, slotIndex) {
    const slotList   = rowType === 'product'   ? this.productSlotObjects
                     : rowType === 'resources' ? this.resSlotObjects
                     : this.slotObjects;
    const renderFn   = rowType === 'product'   ? (i, c) => this.renderProductSlotCard(i, c)
                     : rowType === 'resources' ? (i, c) => this.renderResSlotCard(i, c)
                     : (i, c) => this.renderSlotCard(i, c);
    const rowArray   = rowType === 'product'   ? this.state.productRow
                     : rowType === 'resources' ? this.state.resourcesRow
                     : this.state.cashRow;

    const slot = slotList[slotIndex];
    const COLORS_slotEmpty  = rowType === 'product'   ? COLORS.productSlotEmpty
                            : rowType === 'resources' ? COLORS.resSlotEmpty
                            : COLORS.slotEmpty;

    // Destroy all children added after the initial [slotBg, slotLabel]
    const excess = slot.list.slice(2);
    excess.forEach(child => child.destroy());

    // Reset slot visual state
    slot.slotBg.setFillStyle(COLORS_slotEmpty).setStrokeStyle(0);
    slot.slotLabel.setVisible(true);
    slot.opText = null;
    slot.cardId = null;

    const id = rowArray[slotIndex];
    if (id) {
      const card = this.cardsData.find(c => c.id === id);
      renderFn(slotIndex, card);
    }
  }

  // ── Valuation ─────────────────────────────────────────────
  triggerValuation() {
    const cashIds    = this.state.cashRow.filter(Boolean);
    const productIds = this.state.productRow.filter(Boolean);
    const resIds     = this.state.resourcesRow.filter(Boolean);
    const allIds     = [...cashIds, ...productIds, ...resIds];

    // Apply valueMultiplier from specialEffects on board (e.g., Agentic Overlord)
    allIds.forEach(sid => {
      const sc = this.cardsData.find(c => c.id === sid);
      if (!sc || !sc.specialEffect) return;
      const effs = Array.isArray(sc.specialEffect) ? sc.specialEffect : [sc.specialEffect];
      effs.forEach(fx => {
        if (fx.type === 'modify_type' && fx.valueMultiplier) {
          allIds.forEach(tid => {
            const tc = this.cardsData.find(c => c.id === tid);
            if (tc && this._typeMatches(tc, fx.targetType, sid)) {
              this.state.valueBonuses[tid] = (this.state.valueBonuses[tid] || 0) + tc.baseValue * (fx.valueMultiplier - 1);
            }
          });
        }
      });
    });

    // Tier 2 value bonuses (cross-row) — from specialEffect valueBonus and accumulated state.valueBonuses
    const valueBonuses = { ...this.state.valueBonuses };
    allIds.forEach(id => {
      const card = this.cardsData.find(c => c.id === id);
      if (!card.specialEffect) return;
      const effects = Array.isArray(card.specialEffect) ? card.specialEffect : [card.specialEffect];
      effects.forEach(fx => {
        if (fx.type !== 'modify_type') return;
        allIds.forEach(tid => {
          const tc = this.cardsData.find(c => c.id === tid);
          if (this._typeMatches(tc, fx.targetType, id) && fx.valueBonus > 0)
            valueBonuses[tid] = (valueBonuses[tid] || 0) + fx.valueBonus;
        });
      });
    });

    const breakdown = allIds.map(id => {
      const card  = this.cardsData.find(c => c.id === id);
      const bonus = valueBonuses[id] || 0;
      const row   = cashIds.includes(id) ? 'cash' : productIds.includes(id) ? 'product' : 'resources';
      return { name: card.name, base: card.baseValue, bonus, total: card.baseValue + bonus, row };
    });

    let baseTotal         = breakdown.reduce((s, c) => s + c.total, 0);
    const productMultiplier = this.state.productMultiplier;
    let finalTotal        = Math.round(baseTotal * productMultiplier);
    const isEndGame       = this.state.round === TURNS_PER_ROUND.length;

    // ── Goal evaluation ──────────────────────────────────────
    const goal    = this.state.currentGoal;
    let goalMet   = this.state.goalMet;  // may already be true from mid-round check
    let goalRewardCard = null;
    let goalValueBonus = 0;

    if (goal && !goalMet) {
      const snapshot = this.buildGoalSnapshot(finalTotal);
      goalMet = goal.check(snapshot);
    }

    if (goal && goalMet) {
      if (goal.rewardType === 'csuite') {
        // Pick a random C-Suite whose role is not already on the board
        const boardIds = new Set(allIds);
        const boardRoles = new Set();
        boardIds.forEach(id => {
          const c = this.cardsData.find(c => c.id === id);
          if (c && c.role) boardRoles.add(c.role);
        });
        const available = this.cardsData.filter(c =>
          c.type === 'C-Suite' && !boardRoles.has(c.role)
        );
        if (available.length > 0) {
          goalRewardCard = available[Math.floor(Math.random() * available.length)];
        }
      } else if (goal.rewardType === 'value_bonus') {
        if (this.state.goalValueBonusApplied) {
          // Bonus already applied to state.valueBonuses mid-round — baseTotal already includes it.
          // No lump-sum addition needed; no separate GOAL BONUS line in ValuationScene.
        } else {
          // r4_val900m path: valuation-only goal, bonus not yet applied.
          // Apply to valueBonuses for per-card display consistency, and add lump sum to baseTotal.
          goalValueBonus = GOAL_R4_VALUE_BONUS * allIds.length;
          allIds.forEach(id => {
            this.state.valueBonuses[id] = (this.state.valueBonuses[id] || 0) + GOAL_R4_VALUE_BONUS;
          });
          baseTotal += goalValueBonus;
          finalTotal = Math.round(baseTotal * productMultiplier);
        }
      }
    }

    // Build carryOver hand (include C-Suite reward if earned)
    const carryHand = [...this.state.hand];
    if (goalRewardCard) carryHand.push(goalRewardCard.id);

    irisTransition(this, 'ValuationScene', {
      breakdown,
      baseTotal,
      productMultiplier,
      finalTotal,
      finalCash: this.state.cash,
      round:     this.state.round,
      isEndGame,
      // Goal result data
      goal,
      goalMet,
      goalRewardCard,
      goalValueBonus,
      carryOver: isEndGame ? null : {
        round:          this.state.round,
        cash:           this.state.cash,
        hand:           carryHand,
        cashRow:        [...this.state.cashRow],
        productRow:     [...this.state.productRow],
        resourcesRow:   [...this.state.resourcesRow],
        drawPile:       [...this.state.drawPile],
        revealedCards:  [...this.state.revealedCards],
        cardOpBoosts:   { ...this.state.cardOpBoosts },
        valueBonuses:   { ...this.state.valueBonuses },
        productMultiplier: this.state.productMultiplier,
        totalBonusTurns: this.state.totalBonusTurns ?? 0,
        freePlay: false,
        freePlayRow: null,
      },
    });
  }

  // ── HUD ───────────────────────────────────────────────────
  updateHUD() {
    const { state } = this;
    this.hudRound.setText(`ROUND ${state.round} / ${TURNS_PER_ROUND.length}`);
    this.hudTurnsLabel.setText(`${state.maxTurns} TURNS`);

    const completed = Math.min(state.turn - 1, state.maxTurns);
    this.turnBoxes.forEach(({ box, check }, i) => {
      if (i < completed) {
        box.setFillStyle(0xffffff).setStrokeStyle(1, 0x4f4f4f);
        check.setVisible(true);
      } else if (i === completed && completed < state.maxTurns) {
        box.setFillStyle(0xffffff).setStrokeStyle(1, 0x000000);
        check.setVisible(false);
      } else {
        box.setFillStyle(0xffffff).setStrokeStyle(0);
        check.setVisible(false);
      }
    });
    this.hudCash.setText(fmtVal(state.cash));
    if (this.cashSubtitle) this.cashSubtitle.setText(`Base: $${BASE_CASH_PER_ROUND[state.round - 1]}k`);

    // Goal tracking: peak values
    if (state.cash > state.peakCash) state.peakCash = state.cash;
    if (state.hand.length > state.peakHandSize) state.peakHandSize = state.hand.length;

    this.hudProductMultiplier.setText(`${state.productMultiplier}×`);

    if (this.hudDrawPile) this.hudDrawPile.setText(`${state.drawPile.length} cards`);

    // Team value: sum of all card baseValues (+ live bonuses) on board
    const allBoardIds = [...state.cashRow, ...state.productRow, ...state.resourcesRow];
    const bonuses = this._liveBonuses || state.valueBonuses;
    let teamVal = 0;
    allBoardIds.forEach(id => {
      const card = this.cardsData.find(c => c.id === id);
      if (card) teamVal += card.baseValue + (bonuses[id] || 0);
    });
    if (this.hudTeamValue) this.hudTeamValue.setText(fmtVal(teamVal));
  }

  // ── Goal tracking ────────────────────────────────────────
  buildGoalSnapshot(finalValuation) {
    const s = this.state;

    // Count cards currently on the board by type (all rounds)
    const boardIds = [...s.cashRow, ...s.productRow, ...s.resourcesRow].filter(id => id !== null);
    const boardTypeCounts = new Map();
    for (const id of boardIds) {
      const card = this.cardsData.find(c => c.id === id);
      if (card) boardTypeCounts.set(card.type, (boardTypeCounts.get(card.type) || 0) + 1);
    }
    const maxSameTypeOnBoard = boardTypeCounts.size > 0 ? Math.max(...boardTypeCounts.values()) : 0;

    const csuiteCountOnBoard = boardTypeCounts.get('C-Suite') || 0;

    return {
      cardsPlacedThisRound: s.cardsPlacedThisRound,
      typesPlacedCount:     s.typesPlacedThisRound.size,
      maxSameTypePlaced:    maxSameTypeOnBoard,
      timesShippedThisRound: s.timesShippedThisRound,
      peakHandSize:         s.peakHandSize,
      peakCash:             s.peakCash,
      finalValuation:       finalValuation ?? 0,
      fullRowCount:         [s.cashRow, s.productRow, s.resourcesRow]
                              .filter(row => row.every(slot => slot !== null)).length,
      csuiteCountOnBoard,
    };
  }

  checkGoalProgress() {
    const goal = this.state.currentGoal;
    if (!goal || this.state.goalMet) return;

    // Skip valuation-based goals (can only evaluate at end of round)
    if (!goal.progressText) return;

    const snapshot = this.buildGoalSnapshot(0);
    if (goal.check(snapshot)) {
      this.state.goalMet = true;
      this.onGoalAchieved();
    }

    // Update progress display
    this.updateGoalPanel();
  }

  onGoalAchieved() {
    if (!this.goalCheckbox) return;

    // Show checkmark
    this.goalCheckText.setText('✓');

    // Float text
    const panelX = GAME_W - 110;
    const panelY = 70;
    this.showFloat(panelX, panelY, 'GOAL MET!', COLORS.text.positive);

    // For value_bonus goals, apply the per-card bonus immediately to the board
    const goal = this.state.currentGoal;
    if (goal && goal.rewardType === 'value_bonus') {
      this.time.delayedCall(600, () => this._applyGoalValueBonus());
    }
  }

  _applyGoalValueBonus() {
    const allIds = [...this.state.cashRow, ...this.state.productRow, ...this.state.resourcesRow].filter(Boolean);
    allIds.forEach(id => {
      this.state.valueBonuses[id] = (this.state.valueBonuses[id] || 0) + GOAL_R4_VALUE_BONUS;
    });
    this.state.goalValueBonusApplied = true;
    this._reRenderAllSlots();
    this.updateHUD();
    this.showFloat(GAME_W - 110, 70, `+$${GOAL_R4_VALUE_BONUS}k to every card!`, COLORS.text.gold, 2000);
  }

  updateGoalPanel() {
    // Progress text removed — checkbox is the only progress indicator
  }

  // ── Utility ───────────────────────────────────────────────
  showBonusTurnNotice(text) {
    const notice = this.add.text(
      this.cameras.main.width / 2, 120,
      text,
      { fontSize: '22px', fontFamily: FONT_BOARD, color: COLORS.text.bonusTurn, fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: notice,
      alpha: 0,
      y: 90,
      duration: 1800,
      ease: 'Power2',
      onComplete: () => notice.destroy()
    });
  }

  showFreePlayBanner(rowType) {
    if (this.freePlayBanner) this.freePlayBanner.destroy();
    const rowLabel = rowType === 'product' ? 'PRODUCT' : rowType === 'resources' ? 'RESOURCES' : 'CASH';
    const rowY     = rowType === 'product' ? ROW_PROD_Y : rowType === 'resources' ? ROW_RES_Y : ROW_CASH_Y;
    const slot4X = ROW_SLOT_X + 3 * (SLOT_W + 8);
    this.freePlayBanner = this.add.text(
      slot4X, rowY,
      `PLAY ANOTHER CARD TO ${rowLabel} ROW`,
      { fontSize: '16px', fontFamily: FONT_BOARD, color: '#000000', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(100);
  }

  clearFreePlayBanner() {
    if (this.freePlayBanner) {
      this.freePlayBanner.destroy();
      this.freePlayBanner = null;
    }
  }

  showFloat(x, y, text, color = COLORS.text.primary, duration = 800) {
    const t = this.add.text(x, y, text, {
      fontSize: '13px', fontFamily: FONT_BOARD, color, fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: t, y: y - 35, alpha: 0, duration, ease: 'Power2',
      onComplete: () => t.destroy()
    });
  }
}

// ============================================================
// VALUATION SCENE
// ============================================================
function fmtVal(kVal) {
  if (kVal >= 1000000) {
    const b = Math.round(kVal / 100000) / 10;
    return `$${b}b`;
  }
  if (kVal >= 1000) {
    const m = Math.round(kVal / 100) / 10;
    return `$${m}m`;
  }
  return `$${kVal.toLocaleString()}k`;
}

class ValuationScene extends Phaser.Scene {
  constructor() { super({ key: 'ValuationScene' }); }

  init(data) { this.payload = data; }

  create() {
    const { breakdown, baseTotal, productMultiplier, finalTotal,
            round, isEndGame, carryOver,
            goal, goalMet, goalRewardCard, goalValueBonus } = this.payload;
    const cx = GAME_W / 2;

    this.cameras.main.setBackgroundColor(COLORS.sceneBg);
    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, COLORS.sceneBg);

    // Header
    this.add.text(cx, 60, isEndGame ? ' FINAL VALUATION ' : ' VALUATION ', {
      fontSize: '72px', fontFamily: '"Londrina Solid", sans-serif', color: COLORS.text.primary, align: 'center', padding: { right: 16 },
      shadow: { offsetX: -3, offsetY: 3, blur: 0, color: '#000000', fill: true },
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, 108, `END OF ROUND ${round}`, {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
    }).setOrigin(0.5, 0.5);

    // ── Card breakdown (scrollable box) ──────────────────────
    const BOX_X = cx - 280;
    const BOX_Y = 140;
    const BOX_W = 560;
    const BOX_H = 200;
    const ROW_H = 23;
    const PAD_TOP = 30;  // space for header inside box
    const PAD_BOTTOM = 8;

    // Box background (game board color)
    this.add.rectangle(cx, BOX_Y + BOX_H / 2, BOX_W, BOX_H, COLORS.scrollTrackBg)
      .setStrokeStyle(1, COLORS.divider);

    // Header inside box
    this.add.text(cx, BOX_Y + 14, 'CARDS ON BOARD', {
      fontSize: '11px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
    }).setOrigin(0.5, 0.5);

    // Build list items in a container (positions relative to container origin)
    const listContainer = this.add.container(0, 0);
    let ly = 0;

    if (breakdown.length === 0) {
      listContainer.add(this.add.text(cx, ly, '(no cards placed)', {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5, 0));
      ly += 26;
    } else {
      breakdown.forEach(entry => {
        const rowTag   = entry.row === 'product' ? '[PROD] ' : entry.row === 'resources' ? '[RES]  ' : '[CASH] ';
        listContainer.add(this.add.text(cx - 230, ly, rowTag, {
          fontSize: '10px', fontFamily: FONT_UI, color: COLORS.text.primary
        }).setOrigin(0, 0));

        listContainer.add(this.add.text(cx - 185, ly, entry.name, {
          fontSize: '12px', fontFamily: FONT_UI, color: COLORS.text.primary
        }).setOrigin(0, 0));

        let valStr;
        if (entry.bonus > 0) {
          valStr = `${fmtVal(entry.base)} + ${fmtVal(entry.bonus)} = ${fmtVal(entry.total)}`;
        } else {
          valStr = entry.total > 0 ? fmtVal(entry.total) : '—';
        }
        listContainer.add(this.add.text(cx + 230, ly, valStr, {
          fontSize: '12px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'right'
        }).setOrigin(1, 0));

        ly += ROW_H;
      });
    }

    const listContentH = ly;
    const listAreaTop = BOX_Y + PAD_TOP;
    const listAreaH = BOX_H - PAD_TOP - PAD_BOTTOM;
    listContainer.y = listAreaTop;

    // Mask to clip list to the box area
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillRect(BOX_X, listAreaTop, BOX_W, listAreaH);
    listContainer.setMask(new Phaser.Display.Masks.GeometryMask(this, maskShape));

    // Scrollbar + scroll input (only if content overflows)
    const needsScroll = listContentH > listAreaH;
    if (needsScroll) {
      const maxScroll = listContentH - listAreaH;
      const trackX = BOX_X + BOX_W - 8;
      const trackH = listAreaH - 8;
      const trackTop = listAreaTop + 4;
      const thumbH = Math.max(20, (listAreaH / listContentH) * trackH);

      // Scrollbar track
      this.add.rectangle(trackX, trackTop + trackH / 2, 4, trackH, COLORS.divider).setOrigin(0.5, 0.5);

      // Scrollbar thumb
      const thumb = this.add.rectangle(trackX, trackTop + thumbH / 2, 4, thumbH, COLORS.scrollThumb).setOrigin(0.5, 0.5);

      const scrollList = (dy) => {
        listContainer.y = Phaser.Math.Clamp(
          listContainer.y - dy, listAreaTop - maxScroll, listAreaTop
        );
        const scrollPct = (listAreaTop - listContainer.y) / maxScroll;
        thumb.y = trackTop + thumbH / 2 + scrollPct * (trackH - thumbH);
      };

      // Interactive hit zone over the box for drag + wheel input
      const hitZone = this.add.rectangle(cx, BOX_Y + BOX_H / 2, BOX_W, BOX_H, 0x000000, 0)
        .setInteractive();

      // Drag to scroll
      this.input.setDraggable(hitZone);
      hitZone.on('drag', (_pointer, _dragX, _dragY, _dropped) => {});
      this.input.on('drag', (_pointer, gameObject, _dragX, _dragY) => {
        if (gameObject !== hitZone) return;
      });
      let lastDragY = 0;
      hitZone.on('pointerdown', (pointer) => { lastDragY = pointer.y; });
      hitZone.on('pointermove', (pointer) => {
        if (!pointer.isDown) return;
        const dy = lastDragY - pointer.y;
        lastDragY = pointer.y;
        scrollList(dy);
      });

      // Mouse wheel scroll (via the canvas element directly)
      this.game.canvas.addEventListener('wheel', (e) => {
        if (this.scene.isActive()) {
          scrollList(e.deltaY * 0.5);
          e.preventDefault();
        }
      }, { passive: false });
    }

    // ── Fixed bottom section ──────────────────────────────────
    let y = BOX_Y + BOX_H + 14;

    // Base total subtotal
    this.add.text(cx - 230, y, 'BASE TOTAL', {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary
    }).setOrigin(0, 0.5);
    // Show base total without goal bonus first, then goal bonus line if applicable
    const baseTotalBeforeGoal = goalValueBonus ? baseTotal - goalValueBonus : baseTotal;
    this.add.text(cx + 230, y, fmtVal(baseTotalBeforeGoal), {
      fontSize: '15px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'right'
    }).setOrigin(1, 0.5);
    y += 22;

    // Goal value bonus line (Round 4 reward)
    if (goalValueBonus > 0) {
      this.add.text(cx - 230, y, `STRETCH GOAL BONUS (+$${GOAL_R4_VALUE_BONUS}k × ${breakdown.length} cards)`, {
        fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.positive
      }).setOrigin(0, 0.5);
      this.add.text(cx + 230, y, `+${fmtVal(goalValueBonus)}`, {
        fontSize: '15px', fontFamily: FONT_UI, color: COLORS.text.positive, align: 'right'
      }).setOrigin(1, 0.5);
      y += 22;
    } else {
      y += 4;
    }

    // ── Product Multiplier ────────────────────────────────────
    this.add.text(cx - 230, y, 'PRODUCT MULTIPLIER', {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary
    }).setOrigin(0, 0.5);
    this.add.text(cx + 230, y, `×   ${productMultiplier}`, {
      fontSize: '15px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'right'
    }).setOrigin(1, 0.5);
    y += 22;

    // ── Final valuation ───────────────────────────────────────
    this.add.rectangle(cx, y, 560, 2, 0xffffff).setOrigin(0.5, 0.5);
    y += 30;

    this.add.text(cx - 230, y, isEndGame ? 'FINAL VALUATION' : `ROUND ${round} VALUATION`, {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary
    }).setOrigin(0, 0.5);
    this.add.text(cx + 230, y, fmtVal(finalTotal), {
      fontSize: '36px', fontFamily: FONT_UI, color: COLORS.text.primary, fontStyle: 'bold', align: 'right'
    }).setOrigin(1, 0.5);
    y += 30;

    // Result message
    this.add.text(cx, GAME_H - 114, this.resultMessage(finalTotal, isEndGame), {
      fontSize: '13px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center',
      wordWrap: { width: 620 }
    }).setOrigin(0.5, 0.5);

    // ── Goal results ─────────────────────────────────────────
    if (goal) {
      y += 20;

      const headingColor = goalMet ? '#75FFA3' : '#DD7B7B';
      const headingLabel = goalMet ? 'STRETCH GOAL HIT!' : 'STRETCH GOAL MISSED';
      this.add.text(cx, y, headingLabel, {
        fontSize: '11px', fontFamily: FONT_BOARD, color: headingColor, align: 'center'
      }).setOrigin(0.5, 0.5);
      y += 21;

      const descText = this.add.text(cx, y, goal.desc, {
        fontSize: '18px', fontFamily: FONT_UI, color: COLORS.text.primary, align: 'center'
      }).setOrigin(0.5, 0.5);
      if (!goalMet) {
        const lineW = descText.width;
        this.add.rectangle(cx, y, lineW, 2, 0xffffff).setOrigin(0.5, 0.5);
      }
      y += 25;

      const rewardColor = goalMet ? '#75FFA3' : '#DD7B7B';
      let rewardText;
      if (!goalMet) {
        rewardText = 'No reward';
      } else if (goalRewardCard) {
        rewardText = `Reward: ${goalRewardCard.name}`;
      } else {
        rewardText = `Reward: +$${GOAL_R4_VALUE_BONUS}k to every card`;
      }
      this.add.text(cx, y, rewardText, {
        fontSize: '12px', fontFamily: FONT_UI, color: rewardColor, align: 'center'
      }).setOrigin(0.5, 0.5);
    }

    // ── Button ────────────────────────────────────────────────
    const btnY   = GAME_H - 64;

    const btnW   = isEndGame ? 200 : 280;
    const btnLbl = isEndGame ? 'PLAY AGAIN'
                 : `CONTINUE TO ROUND ${round + 1}`;

    const btn = this.add.rectangle(cx, btnY, btnW, 44, COLORS.sceneBtnPrimary)
      .setInteractive();
    this.add.text(cx, btnY, btnLbl, {
      fontSize: '14px', fontFamily: FONT_UI, color: '#000000', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    btn.on('pointerover', () => btn.setFillStyle(COLORS.sceneBtnPrimaryHov));
    btn.on('pointerout',  () => btn.setFillStyle(COLORS.sceneBtnPrimary));
    btn.on('pointerdown', () => {
      if (isEndGame) {
        fadeToScene(this, 'WelcomeScene', {});
      } else {
        fadeToScene(this, 'RoundTitleScene', { round: round + 1, carryOver, dealCards: false });
      }
    });
  }

  resultMessage(val, isEndGame) {
    const suffix = isEndGame ? ' Final score.' : '';
    if (val >= 1000000) return `${fmtVal(val)}. Unicorn territory.${suffix}`;
    if (val >= 500000)  return `${fmtVal(val)}. You're finally popular at parties.${suffix}`;
    if (val >= 100000)  return `${fmtVal(val)}. Technically not a failure.${suffix}`;
    if (val >= 10000)   return `${fmtVal(val)}. Someone's writing a check. They'll regret it later.${suffix}`;
    if (val >= 5000)    return `${fmtVal(val)}. Enough to hire your friends and disappoint them.${suffix}`;
    if (val >= 1000)    return `${fmtVal(val)}. Interesting idea. Terrible execution.${suffix}`;
    if (val >= 500)     return `${fmtVal(val)}. Your parents are excited. VCs are not.${suffix}`;
    return `${fmtVal(val)}. At least you can put "Founder" on your LinkedIn.${suffix}`;
  }
}

// ============================================================
// PHASER CONFIG — must come after all scene class definitions
// ============================================================
const config = {
  type:            Phaser.AUTO,
  width:           GAME_W,
  height:          GAME_H,
  backgroundColor: COLORS.bg,
  scene:           [BootScene, IrisOverlayScene, WelcomeScene, TutorialScene, RoundTitleScene, GameScene, ValuationScene],
  parent:          document.body,
  roundPixels: true,
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

Promise.all([
  document.fonts.load('48px "Londrina Solid"'),
  document.fonts.load('16px "Cabin"'),
  document.fonts.load('16px "Roboto"'),
  document.fonts.load('16px "Roboto Condensed"'),
]).then(() => {
  const game = new Phaser.Game(config);

  if (IS_MOBILE) {
    const refreshScale = () => {
      setTimeout(() => {
        if (window.visualViewport) {
          document.body.style.height = window.visualViewport.height + 'px';
        }
        game.scale.refresh();
      }, 100);
    };
    window.addEventListener('resize', refreshScale);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', refreshScale);
    }
  }
});
