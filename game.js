// ============================================================
// STARTUP — Phase 3: Resources Row & Full Three-Round Game
// ============================================================

// ── Constants ────────────────────────────────────────────────
const GAME_W = 1280;
const GAME_H = 720;

const CARD_W = 110;
const CARD_H = 155;
const SLOT_W = 120;
const SLOT_H = 145;   // reduced from 165 to fit three rows
const CAROUSEL_VISIBLE = 6;

// Row layout positions (top to bottom: Product → Cash → Resources)
const ROW_PROD_Y      = 110;
const ROW_CASH_Y      = 275;
const ROW_RES_Y       = 440;
const ROW_SLOT_X      = 400;   // x of first slot center
const ACTIVATE_TILE_X = 284;   // x of activate tile / row label block

const TURNS_PER_ROUND     = [7, 7, 6, 5];
const BASE_CASH_PER_ROUND = [25, 50, 75, 100];

const COLORS = {
  bg:             0x1a1a2e,
  panel:          0x16213e,
  panelBorder:    0x0f3460,
  slotEmpty:      0x0d1f10,
  slotBorder:     0x2d6a4f,
  productSlotEmpty:    0x1a1430,
  productSlotBorder:   0x5544aa,
  resSlotEmpty:   0x1a1000,
  resSlotBorder:  0xaa7722,
  activateTile:   0x1a472a,
  activateHover:  0x2d6a4f,
  activateActive: 0x40916c,
  resTile:        0x3d2200,
  resTileHover:   0x6b3d00,
  resTileActive:  0xaa6600,
  cardBg:         0x0d1b2a,
  cardPlaced:     0x2b4d6b,
  productCardPlaced:   0x1e1840,
  resCardPlaced:  0x3d2800,
  productAccent:       0xcd84ff,
  resAccent:      0xffaa44,
  typeColors: {
    'Product/Design':        0x6a9eff,
    'Engineering':           0x7bed9f,
    'Sales':                 0xff6b81,
    'Investor':              0xffd32a,
    'C-Suite':               0xe9c46a,
    'Boardmember':           0xcd84ff,
    'Services & Technology': 0x00d2d3,
  }
};

// ============================================================
// BOOT SCENE
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() { this.load.json('cards', 'cards.json'); }

  create() { this.scene.start('GameScene'); }
}

// ============================================================
// GAME SCENE
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    // Always read startup data from settings.data — Phaser sets this on every scene.start()
    // regardless of whether the scene is fully restarted or woken from sleep.
    const carryOver = (this.scene.settings.data && this.scene.settings.data.carryOver)
      ? this.scene.settings.data.carryOver
      : null;

    // Wipe settings.data immediately so a subsequent restart with no data doesn't reuse it.
    this.scene.settings.data = {};

    this.children.removeAll(true);   // destroy any leftover display objects
    this.cardsData = this.cache.json.get('cards').cards;

    if (carryOver) {
      const round = carryOver.round + 1;
      this.state = {
        round,
        turn:         1,
        maxTurns:     TURNS_PER_ROUND[round - 1],
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
      };
    } else {
      // Fresh game — shuffle deck, deal 4 to hand, 2 face-up, rest to draw pile
      const allIds = this.cardsData.map(c => c.id);
      const shuffled = [...allIds].sort(() => Math.random() - 0.5);
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
      };
    }

    this.cardObjects     = {};
    this.slotObjects         = [];
    this.productSlotObjects  = [];
    this.resSlotObjects      = [];
    this.handOffset          = 0;
    this.drawModal       = null;
    this.pendingDrawCount = 0;
    this.triggerModal    = null;

    this.buildLayout();
    this.setupDragHandlers();

    if (carryOver) {
      this.restoreCarryOverState();
      this.refreshBoardOpLabels();
    }

    this.renderHand();
    this.updateHUD();

    if (!carryOver) {
      this.showWelcomeModal();
    }
  }

  // ── Layout ────────────────────────────────────────────────
  buildLayout() {
    const H = this.scale.height;

    // Left panel
    this.add.rectangle(110, H / 2, 220, H, COLORS.panel).setOrigin(0.5, 0.5);
    this.add.rectangle(221, H / 2, 2, H, COLORS.panelBorder).setOrigin(0.5, 0.5);

    // Round / turn
    this.hudRound = this.add.text(110, 50, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudTurnsLabel = this.add.text(110, 68, 'TURNS', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);
    this.buildTurnBoxes(86);

    // Divider after round/turn block
    this.add.rectangle(110, 104, 160, 1, 0x333355).setOrigin(0.5, 0.5);

    // Cash
    this.add.text(110, 120, 'YOUR CASH', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudCash = this.add.text(110, 144, '', {
      fontSize: '24px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Divider
    this.add.rectangle(110, 168, 160, 1, 0x333355).setOrigin(0.5, 0.5);

    // Product multiplier
    this.add.text(110, 182, 'PRODUCT MULT', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);

    this.hudProductMultiplier = this.add.text(110, 206, '0×', {
      fontSize: '28px', fontFamily: 'monospace', color: '#cd84ff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Draw pile counter
    this.add.rectangle(110, 250, 160, 1, 0x333355).setOrigin(0.5, 0.5);
    this.add.text(110, 264, 'DRAW PILE', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);
    this.hudDrawPile = this.add.text(110, 286, '-- cards', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Eye button to preview draw pile
    const eyeBg = this.add.rectangle(110, 308, 80, 20, 0x1a1000)
      .setStrokeStyle(1, 0x664400).setInteractive({ useHandCursor: true });
    const eyeLabel = this.add.text(110, 308, '👁 preview', {
      fontSize: '9px', fontFamily: 'monospace', color: '#886622', align: 'center'
    }).setOrigin(0.5, 0.5);
    eyeBg.on('pointerover', () => { eyeBg.setFillStyle(0x3d2200); eyeLabel.setColor('#ffaa44'); });
    eyeBg.on('pointerout',  () => { eyeBg.setFillStyle(0x1a1000); eyeLabel.setColor('#886622'); });
    eyeBg.on('pointerdown', () => this.showDrawPileViewer());

    // Rows
    this.buildProductRow();
    this.buildCashRow();
    this.buildResourcesRow();

    // Hand area
    this.handLabel = this.add.text(GAME_W / 2, 538, 'YOUR CARDS', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);

    this.handCounter = null;

    const windowW    = CAROUSEL_VISIBLE * (CARD_W + 8) - 8;
    const windowStartX = (GAME_W - windowW) / 2;
    const arrowY     = 638;
    this.arrowLeft  = this.buildArrow(windowStartX - 22, arrowY, '◀');
    this.arrowRight = this.buildArrow(windowStartX + windowW + 22, arrowY, '▶');
  }

  buildArrow(x, y, symbol) {
    const btn = this.add.text(x, y, symbol, {
      fontSize: '28px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5).setInteractive();

    btn.on('pointerover', () => { if (!btn.disabled) btn.setColor('#ffffff'); });
    btn.on('pointerout',  () => { if (!btn.disabled) btn.setColor('#aaaacc'); });
    btn.on('pointerdown', () => {
      if (btn.disabled) return;
      if (symbol === '◀') this.handOffset = Math.max(0, this.handOffset - 1);
      else                this.handOffset = Math.min(this.state.hand.length - CAROUSEL_VISIBLE, this.handOffset + 1);
      this.renderHand();
    });

    return btn;
  }

  buildTurnBoxes(y) {
    const maxTurns = this.state.maxTurns;
    const BOX = 14;
    const GAP = 4;
    const totalW = maxTurns * BOX + (maxTurns - 1) * GAP;
    const startX = 110 - totalW / 2 + BOX / 2;

    this.turnBoxes = [];
    for (let i = 0; i < maxTurns; i++) {
      const x = startX + i * (BOX + GAP);
      const box   = this.add.rectangle(x, y, BOX, BOX, 0x1a1a2e).setStrokeStyle(1, 0x333355);
      const check = this.add.text(x, y, '✓', {
        fontSize: '10px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold'
      }).setOrigin(0.5, 0.5).setVisible(false);
      this.turnBoxes.push({ box, check });
    }
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

    const bg = this.add.rectangle(0, 0, 90, SLOT_H, COLORS.productSlotEmpty)
      .setStrokeStyle(1, COLORS.productSlotBorder);

    const title = this.add.text(0, -SLOT_H / 2 + 18, 'Product', {
      fontSize: '13px', fontFamily: 'monospace', color: '#cd84ff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    const subtitle = this.add.text(0, -SLOT_H / 2 + 36, 'Base: 1×', {
      fontSize: '9px', fontFamily: 'monospace', color: '#9966cc', align: 'center'
    }).setOrigin(0.5, 0.5);

    const btnBg = this.add.rectangle(0, SLOT_H / 2 - 28, 70, 30, 0x3d1a5e)
      .setStrokeStyle(1, COLORS.productSlotBorder);
    const btnText = this.add.text(0, SLOT_H / 2 - 28, 'SHIP', {
      fontSize: '9px', fontFamily: 'monospace', color: '#cd84ff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, title, subtitle, btnBg, btnText]);
    container.tileBg = bg;
    container.btnBg  = btnBg;

    container.setInteractive(
      new Phaser.Geom.Rectangle(-45, -SLOT_H / 2, 90, SLOT_H),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerover', () => {
      if (this.state.phase === 'playing') btnBg.setFillStyle(0x5c2080);
    });
    container.on('pointerout',  () => btnBg.setFillStyle(0x3d1a5e));
    container.on('pointerdown', () => this.onActivateProductClicked());

    this.productActivateTile = container;
  }

  buildProductSlot(x, y, index) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, COLORS.productSlotEmpty)
      .setStrokeStyle(1, COLORS.productSlotBorder);

    const label = this.add.text(0, 8, `SLOT ${index + 1}`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#443366', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, label]);
    container.slotBg    = bg;
    container.slotLabel = label;
    container.slotIndex = index;
    container.cardId    = null;

    const zone = this.add.zone(x, y, SLOT_W, SLOT_H).setRectangleDropZone(SLOT_W, SLOT_H);
    zone.rowType   = 'product';
    zone.slotIndex = index;

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

    const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, COLORS.slotEmpty)
      .setStrokeStyle(1, COLORS.slotBorder);

    const label = this.add.text(0, 8, `SLOT ${index + 1}`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#2d6a4f', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, label]);
    container.slotBg    = bg;
    container.slotLabel = label;
    container.slotIndex = index;
    container.cardId    = null;

    const zone = this.add.zone(x, y, SLOT_W, SLOT_H).setRectangleDropZone(SLOT_W, SLOT_H);
    zone.rowType   = 'cash';
    zone.slotIndex = index;

    return container;
  }

  buildActivateTile(x, y) {
    const container = this.add.container(x, y);

    // Row background (full height, dark — acts as row heading panel)
    const bg = this.add.rectangle(0, 0, 90, SLOT_H, 0x0d1f10)
      .setStrokeStyle(1, 0x2d5a3d);

    // Title
    const title = this.add.text(0, -SLOT_H / 2 + 18, 'Cash', {
      fontSize: '13px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Subtitle
    const subtitle = this.add.text(0, -SLOT_H / 2 + 36, `Base: $${BASE_CASH_PER_ROUND[0]}k`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#52b788', align: 'center'
    }).setOrigin(0.5, 0.5);
    this.cashSubtitle = subtitle;

    // Button
    const btnBg = this.add.rectangle(0, SLOT_H / 2 - 28, 70, 30, COLORS.activateTile)
      .setStrokeStyle(1, 0x40916c);
    const btnText = this.add.text(0, SLOT_H / 2 - 28, 'RAISE $', {
      fontSize: '9px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, title, subtitle, btnBg, btnText]);
    container.tileBg = bg;
    container.btnBg  = btnBg;

    container.setInteractive(
      new Phaser.Geom.Rectangle(-45, -SLOT_H / 2, 90, SLOT_H),
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

    const bg = this.add.rectangle(0, 0, SLOT_W, SLOT_H, COLORS.resSlotEmpty)
      .setStrokeStyle(1, COLORS.resSlotBorder);

    const label = this.add.text(0, 8, `SLOT ${index + 1}`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#443300', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, label]);
    container.slotBg    = bg;
    container.slotLabel = label;
    container.slotIndex = index;
    container.cardId    = null;

    const zone = this.add.zone(x, y, SLOT_W, SLOT_H).setRectangleDropZone(SLOT_W, SLOT_H);
    zone.rowType   = 'resources';
    zone.slotIndex = index;

    return container;
  }

  buildHireTile(x, y) {
    const container = this.add.container(x, y);

    // Row background (full height, dark — acts as row heading panel)
    const bg = this.add.rectangle(0, 0, 90, SLOT_H, 0x1a1000)
      .setStrokeStyle(1, 0x664400);

    // Title
    const title = this.add.text(0, -SLOT_H / 2 + 18, 'Resources', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Subtitle
    const subtitle = this.add.text(0, -SLOT_H / 2 + 36, 'Base: 1 draw', {
      fontSize: '9px', fontFamily: 'monospace', color: '#886622', align: 'center'
    }).setOrigin(0.5, 0.5);

    // Button
    const btnBg = this.add.rectangle(0, SLOT_H / 2 - 28, 70, 30, COLORS.resTile)
      .setStrokeStyle(1, COLORS.resAccent);
    const btnText = this.add.text(0, SLOT_H / 2 - 28, 'RECRUIT', {
      fontSize: '9px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    container.add([bg, title, subtitle, btnBg, btnText]);
    container.tileBg = bg;
    container.btnBg  = btnBg;

    container.setInteractive(
      new Phaser.Geom.Rectangle(-45, -SLOT_H / 2, 90, SLOT_H),
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
  renderHand() {
    Object.values(this.cardObjects).forEach(c => c.destroy());
    this.cardObjects = {};

    const ids   = this.state.hand;
    const handY = 638;

    const maxOffset = Math.max(0, ids.length - CAROUSEL_VISIBLE);
    this.handOffset = Math.min(this.handOffset, maxOffset);

    const visible  = ids.slice(this.handOffset, this.handOffset + CAROUSEL_VISIBLE);
    const windowW  = CAROUSEL_VISIBLE * (CARD_W + 8) - 8;
    const startX   = (GAME_W - windowW) / 2;

    visible.forEach((id, i) => {
      const card = this.cardsData.find(c => c.id === id);
      const x    = startX + i * (CARD_W + 8) + CARD_W / 2;
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
    arrow.setAlpha(enabled ? 1 : 0.2).setColor(enabled ? '#aaaacc' : '#555577');
  }

  // ── Card Visuals ──────────────────────────────────────────
  buildCardVisual(card, x, y, draggable) {
    const container  = this.add.container(x, y);
    container.cardId = card.id;

    const typeColor = COLORS.typeColors[card.type] || 0x888888;

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.cardBg)
      .setStrokeStyle(1, typeColor);
    container.cardBg = bg;

    const bar = this.add.rectangle(0, -CARD_H / 2 + 6, CARD_W, 12, typeColor).setOrigin(0.5, 0.5);
    const typeLabel = this.add.text(0, -CARD_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    const nameText = this.add.text(0, -CARD_H / 2 + 22, card.name, {
      fontSize: '9px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: CARD_W - 10 }
    }).setOrigin(0.5, 0);

    const divider = this.add.rectangle(0, -CARD_H / 2 + 48, CARD_W - 16, 1, 0x33334a).setOrigin(0.5, 0.5);

    const opText = this.add.text(0, -CARD_H / 2 + 58, this.operationLabel(card.operation), {
      fontSize: '20px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0);

    container.add([bg, bar, typeLabel, nameText, divider, opText]);

    if (card.specialEffect) {
      container.add(this.add.text(0, -CARD_H / 2 + 84, this.specialEffectLabel(card.specialEffect), {
        fontSize: '7px', fontFamily: 'monospace', color: '#e9c46a', align: 'center',
        wordWrap: { width: CARD_W - 12 }
      }).setOrigin(0.5, 0));
    }

    const bottomText  = card.triggerEffect ? `⚡ ${this.triggerEffectLabel(card.triggerEffect)}` : `"${card.description}"`;
    const bottomColor = card.triggerEffect ? '#00ffff' : '#888899';
    container.add(this.add.text(0, CARD_H / 2 - 44, bottomText, {
      fontSize: '7px', fontFamily: 'monospace', color: bottomColor,
      fontStyle: card.triggerEffect ? 'bold' : 'italic',
      align: 'center', wordWrap: { width: CARD_W - 12 }
    }).setOrigin(0.5, 0));

    container.add(this.add.text(-CARD_W / 2 + 6, CARD_H / 2 - 16, `$${card.cost * 100}k`, {
      fontSize: '8px', fontFamily: 'monospace', color: '#ff8888'
    }).setOrigin(0, 0.5));

    const valStr = card.baseValue > 0 ? `$${card.baseValue}k` : '—';
    container.add(this.add.text(CARD_W / 2 - 6, CARD_H / 2 - 16, valStr, {
      fontSize: '8px', fontFamily: 'monospace', color: '#80ffaa'
    }).setOrigin(1, 0.5));

    if (draggable) {
      container.setSize(CARD_W, CARD_H);
      container.setInteractive();
      this.input.setDraggable(container);

      container.on('pointerover', () => {
        if (this.state.phase === 'playing') bg.setStrokeStyle(2, 0xffffff);
      });
      container.on('pointerout', () => {
        bg.setStrokeStyle(1, typeColor);
      });
    }

    return container;
  }

  operationLabel(op) {
    if (op.type === 'add')      return op.value < 0 ? `${op.value}` : `+${op.value}`;
    if (op.type === 'multiply') return `×${op.value}`;
    return '?';
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
    if (fx.type === 'gain_cash_per_discard')   return `+$${fx.amount}k per discard`;
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

  // ── Drag & Drop ───────────────────────────────────────────
  setupDragHandlers() {
    this.dragOrigin = null;

    this.input.on('dragstart', (pointer, obj) => {
      if (this.state.phase !== 'playing') return;
      this.dragOrigin = { x: obj.x, y: obj.y };
      this.children.bringToTop(obj);
    });

    this.input.on('drag', (pointer, obj, dragX, dragY) => {
      obj.setPosition(dragX, dragY);
    });

    this.input.on('dragend', (pointer, obj, dropped) => {
      if (!dropped) {
        this.tweens.add({
          targets: obj, x: this.dragOrigin.x, y: this.dragOrigin.y,
          duration: 150, ease: 'Power2'
        });
      }
      this.dragOrigin = null;
    });

    this.input.on('drop', (pointer, obj, zone) => {
      if (zone.slotIndex === undefined) return;
      this.tryPlaceCard(obj.cardId, zone.slotIndex, zone.rowType || 'cash');
    });
  }

  // ── Card Placement ────────────────────────────────────────
  tryPlaceCard(cardId, slotIndex, rowType) {
    const { state } = this;
    if (state.phase !== 'playing') return;

    const card = this.cardsData.find(c => c.id === cardId);
    let effectiveCost = card.cost * 100;
    // Apply costDiscount from board specialEffects
    [...state.cashRow, ...state.productRow, ...state.resourcesRow].filter(Boolean).forEach(bid => {
      const bc = this.cardsData.find(c => c.id === bid);
      if (!bc || !bc.specialEffect) return;
      const effects = Array.isArray(bc.specialEffect) ? bc.specialEffect : [bc.specialEffect];
      effects.forEach(fx => {
        if (fx.type === 'modify_type' && fx.costDiscount && this._typeMatches(card, fx.targetType)) {
          effectiveCost = Math.max(0, effectiveCost - fx.costDiscount * 100);
        }
      });
    });

    const rowArray = rowType === 'product'   ? state.productRow
                   : rowType === 'resources' ? state.resourcesRow
                   : state.cashRow;
    const slotList = rowType === 'product'   ? this.productSlotObjects
                   : rowType === 'resources' ? this.resSlotObjects
                   : this.slotObjects;
    const slot     = slotList[slotIndex];

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
        if (existingRowType !== rowType || existingSlotIdx !== slotIndex) {
          const existingSlotList = existingRowKey === 'cashRow'      ? this.slotObjects
                                 : existingRowKey === 'productRow'  ? this.productSlotObjects
                                 : this.resSlotObjects;
          const existingSlotObj = existingSlotList[existingSlotIdx];
          this.showFloat(existingSlotObj.x, existingSlotObj.y - 90, `REPLACE ${card.role}`, '#ff6b6b');
          this.snapBack(cardId);
          return;
        }
        // Correct slot — discard old card, fall through to placement
        state[existingRowKey][existingSlotIdx] = null;
      }
    }
    // ────────────────────────────────────────────────────────

    if (rowArray[slotIndex] !== null) {
      this.showFloat(slot.x, slot.y - 90, 'SLOT OCCUPIED', '#ff6b6b');
      this.snapBack(cardId);
      return;
    }

    if (state.cash < effectiveCost) {
      this.showFloat(slot.x, slot.y - 90, `NEED $${effectiveCost}k`, '#ff6b6b');
      this.snapBack(cardId);
      return;
    }

    // Commit
    state.cash -= effectiveCost;
    rowArray[slotIndex] = cardId;
    state.hand = state.hand.filter(id => id !== cardId);
    this.handOffset = Math.min(this.handOffset, Math.max(0, state.hand.length - CAROUSEL_VISIBLE));

    if (rowType === 'product')        this.renderProductSlotCard(slotIndex, card);
    else if (rowType === 'resources') this.renderResSlotCard(slotIndex, card);
    else                              this.renderSlotCard(slotIndex, card);

    this.refreshBoardOpLabels();
    this.renderHand();
    this.updateHUD();

    // immediate_play special effect
    if (card.specialEffect && !Array.isArray(card.specialEffect) && card.specialEffect.type === 'immediate_play') {
      // Offer to place another card — just re-enable placement UI
      // For now: show a float label indicating the effect fired
      this.showFloat(740, 400, 'Play another card!', '#80ffaa', 1500);
      // The player can simply take another placement action normally
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
    const typeColor = COLORS.typeColors[card.type] || 0x888888;

    slot.slotLabel.setVisible(false);
    slot.slotBg.setFillStyle(COLORS.cardPlaced)
      .setStrokeStyle(1, typeColor);

    slot.add(this.add.rectangle(0, -SLOT_H / 2 + 6, SLOT_W, 12, typeColor).setOrigin(0.5, 0.5));
    slot.add(this.add.text(0, -SLOT_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5));

    slot.add(this.add.text(0, -SLOT_H / 2 + 22, card.name, {
      fontSize: '8px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: SLOT_W - 12, useAdvancedWrap: true }
    }).setOrigin(0.5, 0));

    const cashOpText = this.add.text(0, 8, this.operationLabel(card.operation), {
      fontSize: '22px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    slot.add(cashOpText);
    slot.opText = cashOpText;

    let yBot = SLOT_H / 2 - 14;
    const dispVal = (card.baseValue || 0) + (this.state.valueBonuses[card.id] || 0);
    if (dispVal > 0) {
      slot.add(this.add.text(0, yBot, `$${dispVal}k`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#80ffaa', align: 'center'
      }).setOrigin(0.5, 0.5));
      yBot -= 14;
    }
    if (card.triggerEffect) {
      slot.add(this.add.text(0, yBot, `⚡ ${this.triggerEffectLabel(card.triggerEffect)}`, {
        fontSize: '6px', fontFamily: 'monospace', color: '#00ffff',
        align: 'center', wordWrap: { width: SLOT_W - 12 }
      }).setOrigin(0.5, 0.5));
      yBot -= 14;
    }
    if (card.specialEffect) {
      slot.add(this.add.text(0, yBot, `★ ${this.specialEffectLabel(card.specialEffect)}`, {
        fontSize: '6px', fontFamily: 'monospace', color: '#e9c46a',
        align: 'center', wordWrap: { width: SLOT_W - 12 }
      }).setOrigin(0.5, 0.5));
    }

    slot.cardId = card.id;
  }

  renderProductSlotCard(slotIndex, card) {
    const slot      = this.productSlotObjects[slotIndex];
    const typeColor = COLORS.typeColors[card.type] || 0x888888;

    slot.slotLabel.setVisible(false);
    slot.slotBg.setFillStyle(COLORS.productCardPlaced)
      .setStrokeStyle(1, COLORS.productAccent);

    slot.add(this.add.rectangle(0, -SLOT_H / 2 + 6, SLOT_W, 12, typeColor).setOrigin(0.5, 0.5));
    slot.add(this.add.text(0, -SLOT_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5));

    slot.add(this.add.text(0, -SLOT_H / 2 + 22, card.name, {
      fontSize: '8px', fontFamily: 'monospace', color: '#ddccff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: SLOT_W - 12, useAdvancedWrap: true }
    }).setOrigin(0.5, 0));

    // Show operation in purple tint (IP context)
    const ipOpText = this.add.text(0, 8, this.operationLabel(card.operation), {
      fontSize: '22px', fontFamily: 'monospace', color: '#cd84ff', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    slot.add(ipOpText);
    slot.opText = ipOpText;

    let yBot = SLOT_H / 2 - 14;
    const dispVal = (card.baseValue || 0) + (this.state.valueBonuses[card.id] || 0);
    if (dispVal > 0) {
      slot.add(this.add.text(0, yBot, `$${dispVal}k`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#cd84ff', align: 'center'
      }).setOrigin(0.5, 0.5));
      yBot -= 14;
    }
    if (card.triggerEffect) {
      slot.add(this.add.text(0, yBot, `⚡ ${this.triggerEffectLabel(card.triggerEffect)}`, {
        fontSize: '6px', fontFamily: 'monospace', color: '#00ffff',
        align: 'center', wordWrap: { width: SLOT_W - 12 }
      }).setOrigin(0.5, 0.5));
      yBot -= 14;
    }
    if (card.specialEffect) {
      slot.add(this.add.text(0, yBot, `★ ${this.specialEffectLabel(card.specialEffect)}`, {
        fontSize: '6px', fontFamily: 'monospace', color: '#e9c46a',
        align: 'center', wordWrap: { width: SLOT_W - 12 }
      }).setOrigin(0.5, 0.5));
    }

    slot.cardId = card.id;
  }

  renderResSlotCard(slotIndex, card) {
    const slot      = this.resSlotObjects[slotIndex];
    const typeColor = COLORS.typeColors[card.type] || 0x888888;

    slot.slotLabel.setVisible(false);
    slot.slotBg.setFillStyle(COLORS.resCardPlaced)
      .setStrokeStyle(1, COLORS.resAccent);

    slot.add(this.add.rectangle(0, -SLOT_H / 2 + 6, SLOT_W, 12, typeColor).setOrigin(0.5, 0.5));
    slot.add(this.add.text(0, -SLOT_H / 2 + 6, card.type.toUpperCase(), {
      fontSize: '7px', fontFamily: 'monospace', color: '#000000', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5));

    slot.add(this.add.text(0, -SLOT_H / 2 + 22, card.name, {
      fontSize: '8px', fontFamily: 'monospace', color: '#ffddaa', fontStyle: 'bold',
      align: 'center', wordWrap: { width: SLOT_W - 12, useAdvancedWrap: true }
    }).setOrigin(0.5, 0));

    const resOpText = this.add.text(0, 8, this.operationLabel(card.operation), {
      fontSize: '22px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    slot.add(resOpText);
    slot.opText = resOpText;

    let yBot = SLOT_H / 2 - 14;
    const dispVal = (card.baseValue || 0) + (this.state.valueBonuses[card.id] || 0);
    if (dispVal > 0) {
      slot.add(this.add.text(0, yBot, `$${dispVal}k`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#ffaa44', align: 'center'
      }).setOrigin(0.5, 0.5));
      yBot -= 14;
    }
    if (card.triggerEffect) {
      slot.add(this.add.text(0, yBot, `⚡ ${this.triggerEffectLabel(card.triggerEffect)}`, {
        fontSize: '6px', fontFamily: 'monospace', color: '#00ffff',
        align: 'center', wordWrap: { width: SLOT_W - 12 }
      }).setOrigin(0.5, 0.5));
      yBot -= 14;
    }
    if (card.specialEffect) {
      slot.add(this.add.text(0, yBot, `★ ${this.specialEffectLabel(card.specialEffect)}`, {
        fontSize: '6px', fontFamily: 'monospace', color: '#e9c46a',
        align: 'center', wordWrap: { width: SLOT_W - 12 }
      }).setOrigin(0.5, 0.5));
    }

    slot.cardId = card.id;
  }

  // ── Board op label refresh ────────────────────────────────
  // Called after every card placement. Re-reads effective ops for all placed
  // cards and updates the operation text on each slot. Gold color = boosted.
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
      slot.opText.setColor(boosted ? '#ffd32a' : '#80ffaa');
    });

    this.productSlotObjects.forEach((slot, i) => {
      const id = this.state.productRow[i];
      if (!id || !slot.opText) return;
      const card = this.cardsData.find(c => c.id === id);
      const eff  = ipOps[id];
      const boosted = Math.round(eff.value * 100) !== Math.round(card.operation.value * 100);
      slot.opText.setText(this.operationLabel(eff));
      slot.opText.setColor(boosted ? '#ffd32a' : '#cd84ff');
    });

    this.resSlotObjects.forEach((slot, i) => {
      const id = this.state.resourcesRow[i];
      if (!id || !slot.opText) return;
      const card = this.cardsData.find(c => c.id === id);
      const eff  = resOps[id];
      const boosted = Math.round(eff.value * 100) !== Math.round(card.operation.value * 100);
      slot.opText.setText(this.operationLabel(eff));
      slot.opText.setColor(boosted ? '#ffd32a' : '#ffaa44');
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
    this.state.phase = 'activating';
    this.runActivationSequence();
  }

  runActivationSequence() {
    const BASE = BASE_CASH_PER_ROUND[this.state.round - 1] ?? 100;
    let payout = BASE;

    const effectiveOps = this._computeActivationOps(this.state.cashRow.filter(Boolean));

    this.activateTile.tileBg.setFillStyle(COLORS.activateActive);
    this.showFloat(this.activateTile.x, this.activateTile.y - 90, `BASE +$${BASE}k`, '#80ffaa', 900);

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

      this.showFloat(slot.x, slot.y - 90, label, '#e9c46a', 900);

      const card = this.cardsData.find(c => c.id === cardId);
      if (card.triggerEffect) {
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
    this.activateTile.tileBg.setFillStyle(COLORS.activateTile);

    const flash = this.add.text(740, ROW_CASH_Y, `+$${payout}k`, {
      fontSize: '52px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold', align: 'center'
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
    this.state.phase = 'activating';
    this.runProductActivationSequence();
  }

  runProductActivationSequence() {
    const BASE = 1;
    let score = BASE;

    const effectiveOps = this._computeActivationOps(this.state.productRow.filter(Boolean));

    this.productActivateTile.tileBg.setFillStyle(0x5c2080);
    this.showFloat(this.productActivateTile.x, this.productActivateTile.y - 90, 'BASE ×1', '#cd84ff', 900);

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

      this.showFloat(slot.x, slot.y - 90, label, '#cd84ff', 900);

      const card = this.cardsData.find(c => c.id === cardId);
      if (card.triggerEffect) {
        // Pass cash (not score) so cash-earning triggers update the bank, not the ship score
        this.showTriggerModal(card, this.state.cash, (updatedCash, pendingDraws) => {
          this.state.cash = updatedCash;
          if (pendingDraws) this.pendingDrawCount += pendingDraws;
          this.updateHUD();
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
    this.productActivateTile.tileBg.setFillStyle(COLORS.productSlotEmpty);

    const flash = this.add.text(740, ROW_PROD_Y, `SHIP +${score}×`, {
      fontSize: '52px', fontFamily: 'monospace', color: '#cd84ff', fontStyle: 'bold', align: 'center'
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
    this.state.phase = 'drawing';
    this.runResActivationSequence();
  }

  runResActivationSequence() {
    const BASE = 1;
    let drawCount = BASE;

    const effectiveOps = this._computeActivationOps(this.state.resourcesRow.filter(Boolean));

    this.hireTile.tileBg.setFillStyle(COLORS.resTileActive);
    this.showFloat(this.hireTile.x, this.hireTile.y - 90, 'BASE +1 draw', '#ffaa44', 900);

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
      this.showFloat(slot.x, slot.y - 90, label, '#ffaa44', 900);

      const card = this.cardsData.find(c => c.id === cardId);
      if (card.triggerEffect) {
        if (card.triggerEffect.type === 'gain_cash') {
          // Pass current cash as payout so the modal shows correct cash values.
          // On resolve, write updated cash back to state; drawCount is unchanged.
          this.showTriggerModal(card, this.state.cash, (updatedCash) => {
            this.state.cash = updatedCash;
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
    this.hireTile.tileBg.setFillStyle(COLORS.resTile);

    const flash = this.add.text(740, ROW_RES_Y, `DRAW ${count}`, {
      fontSize: '52px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold', align: 'center'
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

    const modal = this.add.container(0, 0);
    this.drawModal = modal;

    // Overlay
    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.75));

    // Panel
    modal.add(this.add.rectangle(cx, cy, PW, PH, 0x0d1b2a).setStrokeStyle(2, COLORS.resAccent));

    // Header
    modal.add(this.add.text(cx, cy - PH / 2 + 28, 'CHOOSE A CARD', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    // Draws remaining counter — store ref to update it
    const drawsText = this.add.text(cx, cy - PH / 2 + 52, `${drawsRemaining} draw${drawsRemaining !== 1 ? 's' : ''} remaining`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaacc'
    }).setOrigin(0.5, 0.5);
    modal.add(drawsText);
    modal.drawsText = drawsText;
    modal.drawsRemaining = drawsRemaining;

    // Three columns: face-up card 1, face-up card 2, draw pile
    const cardSlotY = cy + 10;
    const card1X    = cx - 230;
    const card2X    = cx;
    const pileX     = cx + 230;

    this.buildModalCardSlot(modal, card1X, cardSlotY, 0);
    this.buildModalCardSlot(modal, card2X, cardSlotY, 1);
    this.buildModalDrawPile(modal, pileX, cardSlotY);

    // DONE / SKIP button
    const doneBtnY = cy + PH / 2 - 26;
    const doneBg = this.add.rectangle(cx, doneBtnY, 120, 30, 0x1a1a2e)
      .setStrokeStyle(1, 0x555566).setInteractive({ useHandCursor: true });
    const doneLabel = this.add.text(cx, doneBtnY, 'DONE / SKIP', {
      fontSize: '11px', fontFamily: 'monospace', color: '#777788'
    }).setOrigin(0.5, 0.5);
    modal.add([doneBg, doneLabel]);
    doneBg.on('pointerover', () => doneBg.setFillStyle(0x333344));
    doneBg.on('pointerout',  () => doneBg.setFillStyle(0x1a1a2e));
    doneBg.on('pointerdown', () => this.closeDrawModal());
  }

  buildModalDrawPile(modal, x, y) {
    const pileEnabled = this.state.drawPile.length > 0;

    // Stack depth — back cards offset down-right
    for (let i = 3; i >= 1; i--) {
      modal.add(this.add.rectangle(x + i * 4, y + i * 4, CARD_W, CARD_H, 0x0a1520)
        .setStrokeStyle(1, 0x223344));
    }

    // Top card face-down
    const topCard = this.add.rectangle(x, y, CARD_W, CARD_H, 0x0d1b2a)
      .setStrokeStyle(2, pileEnabled ? 0x5566bb : 0x333355);
    modal.add(topCard);

    // Inner border for card-back texture
    modal.add(this.add.rectangle(x, y, CARD_W - 14, CARD_H - 14, 0x0d1b2a)
      .setStrokeStyle(1, pileEnabled ? 0x334477 : 0x222233));

    // Question mark
    modal.add(this.add.text(x, y - 14, '?', {
      fontSize: '38px', fontFamily: 'monospace',
      color: pileEnabled ? '#445588' : '#222233', align: 'center'
    }).setOrigin(0.5, 0.5));

    // DRAW BLIND label at bottom of card
    modal.add(this.add.text(x, y + CARD_H / 2 - 18, 'DRAW BLIND', {
      fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold',
      color: pileEnabled ? '#8899cc' : '#333344', align: 'center'
    }).setOrigin(0.5, 0.5));

    if (pileEnabled) {
      topCard.setInteractive({ useHandCursor: true });
      topCard.on('pointerover', () => topCard.setStrokeStyle(2, 0x99aaee));
      topCard.on('pointerout',  () => topCard.setStrokeStyle(2, 0x5566bb));
      topCard.on('pointerdown', () => this.takeBlindCard(modal));
    }
  }

  buildModalCardSlot(modal, x, y, revealedIndex) {
    const id = this.state.revealedCards[revealedIndex];

    if (!id) {
      modal.add(this.add.rectangle(x, y, CARD_W + 10, CARD_H + 10, 0x111122).setStrokeStyle(1, 0x333344));
      modal.add(this.add.text(x, y, 'EMPTY', {
        fontSize: '9px', fontFamily: 'monospace', color: '#333344'
      }).setOrigin(0.5, 0.5));
      return;
    }

    const card      = this.cardsData.find(c => c.id === id);
    const typeColor = COLORS.typeColors[card.type] || 0x888888;

    // Build full card visual (same as hand carousel) and move it into the modal container
    const cardContainer = this.buildCardVisual(card, x, y, false);
    modal.add(cardContainer);

    // Make interactive with hover highlight + click to take
    cardContainer.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    cardContainer.on('pointerover', () => cardContainer.cardBg.setStrokeStyle(2, 0xffffff));
    cardContainer.on('pointerout',  () => {
      cardContainer.cardBg.setStrokeStyle(1, typeColor);
    });
    cardContainer.on('pointerdown', () => this.takeFaceUpCard(id, revealedIndex, modal));
  }

  showDrawPileViewer() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const PW = 780;
    const PH = 380;

    const modal = this.add.container(0, 0).setDepth(50);

    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.75));
    modal.add(this.add.rectangle(cx, cy, PW, PH, 0x0d1b2a).setStrokeStyle(2, COLORS.resAccent));

    modal.add(this.add.text(cx, cy - PH / 2 + 28, 'AVAILABLE CARDS', {
      fontSize: '15px', fontFamily: 'monospace', color: '#ffaa44', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    modal.add(this.add.text(cx, cy - PH / 2 + 50, 'Activate the Resources row to draw.', {
      fontSize: '9px', fontFamily: 'monospace', color: '#556677', align: 'center'
    }).setOrigin(0.5, 0.5));

    // Same three-column layout as CHOOSE A CARD, but non-interactive
    const cardSlotY = cy + 10;
    const card1X    = cx - 230;
    const card2X    = cx;
    const pileX     = cx + 230;

    // Face-up card 1
    const id0 = this.state.revealedCards[0];
    if (id0) {
      modal.add(this.buildCardVisual(this.cardsData.find(c => c.id === id0), card1X, cardSlotY, false));
    } else {
      modal.add(this.add.rectangle(card1X, cardSlotY, CARD_W, CARD_H, 0x111122).setStrokeStyle(1, 0x333344));
      modal.add(this.add.text(card1X, cardSlotY, 'EMPTY', { fontSize: '9px', fontFamily: 'monospace', color: '#333344' }).setOrigin(0.5, 0.5));
    }

    // Face-up card 2
    const id1 = this.state.revealedCards[1];
    if (id1) {
      modal.add(this.buildCardVisual(this.cardsData.find(c => c.id === id1), card2X, cardSlotY, false));
    } else {
      modal.add(this.add.rectangle(card2X, cardSlotY, CARD_W, CARD_H, 0x111122).setStrokeStyle(1, 0x333344));
      modal.add(this.add.text(card2X, cardSlotY, 'EMPTY', { fontSize: '9px', fontFamily: 'monospace', color: '#333344' }).setOrigin(0.5, 0.5));
    }

    // Draw pile (non-interactive, same visual as buildModalDrawPile)
    const pileEnabled = this.state.drawPile.length > 0;
    for (let i = 3; i >= 1; i--) {
      modal.add(this.add.rectangle(pileX + i * 4, cardSlotY + i * 4, CARD_W, CARD_H, 0x0a1520).setStrokeStyle(1, 0x223344));
    }
    modal.add(this.add.rectangle(pileX, cardSlotY, CARD_W, CARD_H, 0x0d1b2a).setStrokeStyle(2, pileEnabled ? 0x5566bb : 0x333355));
    modal.add(this.add.rectangle(pileX, cardSlotY, CARD_W - 14, CARD_H - 14, 0x0d1b2a).setStrokeStyle(1, pileEnabled ? 0x334477 : 0x222233));
    modal.add(this.add.text(pileX, cardSlotY - 14, '?', {
      fontSize: '38px', fontFamily: 'monospace', color: pileEnabled ? '#445588' : '#222233', align: 'center'
    }).setOrigin(0.5, 0.5));
    modal.add(this.add.text(pileX, cardSlotY + CARD_H / 2 - 18, `${this.state.drawPile.length} cards`, {
      fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold',
      color: pileEnabled ? '#8899cc' : '#333344', align: 'center'
    }).setOrigin(0.5, 0.5));

    // Close button
    const closeY = cy + PH / 2 - 26;
    const closeBg = this.add.rectangle(cx, closeY, 120, 30, 0x1a1a2e)
      .setStrokeStyle(1, 0x555566).setInteractive({ useHandCursor: true });
    modal.add(closeBg);
    modal.add(this.add.text(cx, closeY, 'CLOSE', {
      fontSize: '11px', fontFamily: 'monospace', color: '#777788'
    }).setOrigin(0.5, 0.5));
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x333344));
    closeBg.on('pointerout',  () => closeBg.setFillStyle(0x1a1a2e));
    closeBg.on('pointerdown', () => modal.destroy());
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

    this.hireTile.tileBg.setFillStyle(COLORS.resTile);
    this.state.phase = 'playing';
    this.renderHand();
    this.updateHUD();
    this.advanceTurn();
  }

  // ── Welcome Modal ─────────────────────────────────────────
  showWelcomeModal() {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const PW = 580;
    const PH = 410;

    const modal = this.add.container(0, 0).setDepth(100);

    // Backdrop
    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.75));

    // Panel
    modal.add(this.add.rectangle(cx, cy, PW, PH, 0x0d1b2a).setStrokeStyle(2, 0x00ffff));

    // Header
    modal.add(this.add.text(cx, cy - PH / 2 + 26, 'STARTUP', {
      fontSize: '22px', fontFamily: 'monospace', color: '#00ffff', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));
    modal.add(this.add.text(cx, cy - PH / 2 + 46, 'Where being overvalued is overwhelming fun.', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', fontStyle: 'italic'
    }).setOrigin(0.5, 0.5));

    // Divider
    modal.add(this.add.rectangle(cx, cy - PH / 2 + 62, PW - 60, 1, 0x334455));

    const lines = [
      { text: 'Place cards into the three rows to build your startup.', color: '#aaaacc' },
      { text: 'Some cards affect others, and some have trigger effects that\nfire when activated.', color: '#aaaacc' },
      { text: '', color: '#aaaacc' },
      { text: '⬡  PRODUCT ROW  — activate to ship your product. Each ship\n    adds to your cumulative valuation multiplier.', color: '#cd84ff' },
      { text: '⬡  CASH ROW  — activate to generate money to place cards.', color: '#80ffaa' },
      { text: '⬡  RESOURCES ROW  — activate to draw cards from the deck.', color: '#ffaa44' },
      { text: '', color: '#aaaacc' },
      { text: 'You have three rounds of valuations to scale to $1 billion.', color: '#aaaacc' },
    ];

    let textY = cy - PH / 2 + 80;
    for (const line of lines) {
      if (line.text === '') { textY += 8; continue; }
      modal.add(this.add.text(cx - PW / 2 + 36, textY, line.text, {
        fontSize: '11px', fontFamily: 'monospace', color: line.color,
        wordWrap: { width: PW - 72 }
      }).setOrigin(0, 0));
      textY += line.text.split('\n').length * 16 + 4;
    }

    // Note at bottom
    modal.add(this.add.text(cx, cy + PH / 2 - 88,
      'Note: This is a wireframe prototype — the UI is rough and all cards are placeholders.',
      {
        fontSize: '9px', fontFamily: 'monospace', color: '#556677',
        align: 'center', wordWrap: { width: PW - 60 }
      }).setOrigin(0.5, 0));

    // Copyright
    const copyrightY = cy + PH / 2 - 16;
    modal.add(this.add.text(cx, copyrightY, '© 2026 Andrew Schauer', {
      fontSize: '8px', fontFamily: 'monospace', color: '#334455', align: 'center'
    }).setOrigin(0.5, 0.5));

    // PLAY button — anchored above copyright
    const btnY = copyrightY - 36;
    const playBg = this.add.rectangle(cx, btnY, 160, 38, 0x1a472a)
      .setStrokeStyle(2, 0x40916c)
      .setInteractive({ useHandCursor: true });
    modal.add(playBg);
    modal.add(this.add.text(cx, btnY, 'PLAY', {
      fontSize: '14px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    playBg.on('pointerover', () => playBg.setFillStyle(0x2d6a4f));
    playBg.on('pointerout',  () => playBg.setFillStyle(0x1a472a));
    playBg.on('pointerdown', () => modal.destroy());
  }

  // ── Trigger Effect Modals ─────────────────────────────────
  showTriggerModal(card, payout, resumeCallback) {
    const fx = card.triggerEffect;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const PW = 480;
    const PH = 220;

    // Auto effects — no modal needed
    if (fx.type === 'gain_cash_per_type') {
      const count = this._countBoardCardsOfType(fx.targetType);
      const earned = fx.amount * count;
      if (earned > 0) {
        this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+$${earned}k (${count}×${fx.targetType})`, '#e9c46a', 1200);
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
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+$${fx.value}k val`, '#a8dadc', 1000);
      return resumeCallback(payout, 0);
    }

    if (fx.type === 'boost_op') {
      const matchFn = tc => fx.target === 'Self' ? tc.id === card.id : this._typeMatches(tc, fx.target);
      this._applyPermanentOpBoost(matchFn, fx.value);
      this._reRenderAllSlots();
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `${fx.target}: +${fx.value} op`, '#a8dadc', 1000);
      return resumeCallback(payout, 0);
    }

    if (fx.type === 'self_boost_per_type') {
      const count = this._countBoardCardsOfType(fx.targetType);
      this.state.cardOpBoosts[card.id] = (this.state.cardOpBoosts[card.id] || 0) + fx.value * count;
      this._reRenderAllSlots();
      this.showFloat(card._slotX || 740, card._slotY || ROW_CASH_Y, `+${fx.value * count} op (${count}×${fx.targetType})`, '#a8dadc', 1000);
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
    if (fx.type === 'swap_card') {
      return this._renderSwapCardModal(card, payout, fx, resumeCallback);
    }

    const modal = this.add.container(0, 0);
    this.triggerModal = modal;

    modal.add(this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.60));
    modal.add(this.add.rectangle(cx, cy, PW, PH, 0x0d1b2a).setStrokeStyle(2, 0x00ffff));
    modal.add(this.add.text(cx, cy - PH / 2 + 24, `⚡ ${card.name.toUpperCase()}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#00ffff', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    if (fx.type === 'gain_cash') {
      this._renderGainCashModal(modal, cx, cy, PH, payout, fx, resumeCallback);
    } else if (fx.type === 'spend_cash_draw_resource') {
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

    const acceptBg = this.add.rectangle(cx - 70, btnY, 110, 36,
      hasAccept ? 0x1a472a : 0x111122)
      .setStrokeStyle(1, hasAccept ? 0x40916c : 0x333333);
    if (hasAccept) acceptBg.setInteractive({ useHandCursor: true });
    modal.add(acceptBg);
    modal.add(this.add.text(cx - 70, btnY, 'ACCEPT', {
      fontSize: '12px', fontFamily: 'monospace', color: hasAccept ? '#80ffaa' : '#445544'
    }).setOrigin(0.5, 0.5));
    if (hasAccept) {
      acceptBg.on('pointerover', () => acceptBg.setFillStyle(0x2d6a4f));
      acceptBg.on('pointerout',  () => acceptBg.setFillStyle(0x1a472a));
      acceptBg.on('pointerdown', acceptCallback);
    }

    const skipBg = this.add.rectangle(cx + 70, btnY, 110, 36, 0x1a1a2e)
      .setStrokeStyle(1, 0x555566).setInteractive({ useHandCursor: true });
    modal.add(skipBg);
    modal.add(this.add.text(cx + 70, btnY, 'SKIP', {
      fontSize: '12px', fontFamily: 'monospace', color: '#777788'
    }).setOrigin(0.5, 0.5));
    skipBg.on('pointerover', () => skipBg.setFillStyle(0x333344));
    skipBg.on('pointerout',  () => skipBg.setFillStyle(0x1a1a2e));
    skipBg.on('pointerdown', skipCallback);
  }

  _renderGainCashModal(modal, cx, cy, PH, payout, fx, resumeCallback) {
    modal.add(this.add.text(cx, cy - 20, `Gain +$${fx.amount}k?`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5));

    modal.add(this.add.text(cx, cy + 14,
      `Running total: $${payout}k  →  $${payout + fx.amount}k`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc'
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
        fontSize: '14px', fontFamily: 'monospace', color: '#ffddaa', fontStyle: 'bold',
        align: 'center', wordWrap: { width: 420 }
      }).setOrigin(0.5, 0.5));

    modal.add(this.add.text(cx, cy + 8, `Your cash: $${this.state.cash}k`, {
      fontSize: '12px', fontFamily: 'monospace', color: canAfford ? '#80ffaa' : '#ff6b6b'
    }).setOrigin(0.5, 0.5));

    if (!canAfford) {
      modal.add(this.add.text(cx, cy + 28, 'Not enough cash', {
        fontSize: '10px', fontFamily: 'monospace', color: '#ff6b6b'
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
        fontSize: '13px', fontFamily: 'monospace', color: '#ff6b6b', align: 'center'
      }).setOrigin(0.5, 0.5));
      // SKIP only — no ACCEPT
      const skipBg = this.add.rectangle(cx, cy + PH / 2 - 40, 110, 36, 0x1a1a2e)
        .setStrokeStyle(1, 0x555566).setInteractive({ useHandCursor: true });
      modal.add(skipBg);
      modal.add(this.add.text(cx, cy + PH / 2 - 40, 'SKIP', {
        fontSize: '12px', fontFamily: 'monospace', color: '#777788'
      }).setOrigin(0.5, 0.5));
      skipBg.on('pointerover', () => skipBg.setFillStyle(0x333344));
      skipBg.on('pointerout',  () => skipBg.setFillStyle(0x1a1a2e));
      skipBg.on('pointerdown', () => { modal.destroy(); resumeCallback(payout, 0); });
      return;
    }

    modal.swapState = { phase: 1, selected: null };

    const instrText = this.add.text(cx, cy - PH / 2 + 52, 'Select a C-Suite card to replace', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);
    modal.add(instrText);
    modal.instrText = instrText;

    const rowLabel = { cashRow: 'CASH', productRow: 'PRODUCT', resourcesRow: 'RES' };
    const listStartY = cy - 55;
    const btnH = 26;

    csuiteCards.forEach((entry, idx) => {
      const btnY = listStartY + idx * (btnH + 4);
      const bg = this.add.rectangle(cx, btnY, 340, btnH, 0x2a1a00)
        .setStrokeStyle(1, 0xe9c46a).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx, btnY,
        `[${rowLabel[entry.rowKey]}] Slot ${entry.slotIndex + 1}: ${entry.name}`, {
          fontSize: '11px', fontFamily: 'monospace', color: '#e9c46a'
        }).setOrigin(0.5, 0.5);
      modal.add([bg, lbl]);
      entry.bg = bg;

      bg.on('pointerover', () => { if (modal.swapState.phase === 1) bg.setFillStyle(0x3a2a00); });
      bg.on('pointerout',  () => {
        if (!modal.swapState.selected || modal.swapState.selected !== entry) bg.setFillStyle(0x2a1a00);
      });
      bg.on('pointerdown', () => this._handleSwapPhase1(modal, entry, csuiteCards, cx, cy, PH, payout, resumeCallback));
    });

    // SKIP button
    const skipBg = this.add.rectangle(cx, cy + PH / 2 - 40, 110, 36, 0x1a1a2e)
      .setStrokeStyle(1, 0x555566).setInteractive({ useHandCursor: true });
    modal.add(skipBg);
    modal.add(this.add.text(cx, cy + PH / 2 - 40, 'SKIP', {
      fontSize: '12px', fontFamily: 'monospace', color: '#777788'
    }).setOrigin(0.5, 0.5));
    skipBg.on('pointerover', () => skipBg.setFillStyle(0x333344));
    skipBg.on('pointerout',  () => skipBg.setFillStyle(0x1a1a2e));
    skipBg.on('pointerdown', () => { modal.destroy(); resumeCallback(payout, 0); });
  }

  _renderSpendCashDrawModal(card, payout, fx, resumeCallback) {
    const canAfford = this.state.cash >= fx.cost;
    const overlay = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.55).setDepth(30);
    const box = this.add.rectangle(740, 450, 460, 220, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
    const title = this.add.text(740, 370, `Pay $${fx.cost}k → Draw ${fx.draws} card${fx.draws !== 1 ? 's' : ''}?`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 400 }
    }).setOrigin(0.5).setDepth(32);
    const cashLabel = this.add.text(740, 410, `Cash: $${this.state.cash}k`, {
      fontSize: '16px', fontFamily: 'monospace', color: canAfford ? '#80ffaa' : '#ff6b6b'
    }).setOrigin(0.5).setDepth(32);

    const cleanup = () => { overlay.destroy(); box.destroy(); title.destroy(); cashLabel.destroy(); acceptBtn.destroy(); skipBtn.destroy(); };

    const acceptBtn = this.add.text(680, 490, 'ACCEPT', {
      fontSize: '18px', fontFamily: 'monospace', color: canAfford ? '#80ffaa' : '#888888',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: canAfford });
    if (canAfford) {
      acceptBtn.on('pointerdown', () => {
        this.state.cash -= fx.cost;
        this.updateHUD();
        cleanup();
        resumeCallback(payout, fx.draws);
      });
    }

    const skipBtn = this.add.text(800, 490, 'SKIP', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', () => { cleanup(); resumeCallback(payout, 0); });
  }

  _renderSpendCashBoostOpModal(card, payout, fx, resumeCallback) {
    const canAfford = this.state.cash >= fx.cost;
    const targetLabel = fx.target === 'Self' ? card.name : (fx.scope === 'all' ? `all ${fx.target}` : fx.target);
    const overlay = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.55).setDepth(30);
    const box = this.add.rectangle(740, 450, 500, 240, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
    const title = this.add.text(740, 370, `Pay $${fx.cost}k → ${targetLabel}: +${fx.value} op?`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 460 }
    }).setOrigin(0.5).setDepth(32);
    const cashLabel = this.add.text(740, 415, `Cash: $${this.state.cash}k`, {
      fontSize: '16px', fontFamily: 'monospace', color: canAfford ? '#80ffaa' : '#ff6b6b'
    }).setOrigin(0.5).setDepth(32);

    const cleanup = () => { overlay.destroy(); box.destroy(); title.destroy(); cashLabel.destroy(); acceptBtn.destroy(); skipBtn.destroy(); };

    const acceptBtn = this.add.text(680, 495, 'ACCEPT', {
      fontSize: '18px', fontFamily: 'monospace', color: canAfford ? '#80ffaa' : '#888888',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: canAfford });
    if (canAfford) {
      acceptBtn.on('pointerdown', () => {
        this.state.cash -= fx.cost;
        this.updateHUD();
        // Apply permanent op boost
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

    const skipBtn = this.add.text(800, 495, 'SKIP', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', () => { cleanup(); resumeCallback(payout, 0); });
  }

  _renderTradeDrawModal(card, payout, fx, resumeCallback) {
    const hand = this.state.hand;
    if (hand.length === 0) { return resumeCallback(payout, 0); }

    const PER_PAGE = 5;
    let pageOffset = 0;

    const overlay   = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.6).setDepth(30);
    const box       = this.add.rectangle(740, 450, 700, 380, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
    const title     = this.add.text(740, 310, `Trade a card from hand → draw ${fx.draws}`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    const sub       = this.add.text(740, 345, 'Select a card to discard:', {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(32);
    const pageLabel = this.add.text(740, 496, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#556677'
    }).setOrigin(0.5).setDepth(32);
    const leftArrow  = this.add.text(415, 430, '◀', {
      fontSize: '22px', fontFamily: 'monospace', color: '#aaaacc'
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(1065, 430, '▶', {
      fontSize: '22px', fontFamily: 'monospace', color: '#aaaacc'
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const skipBtn   = this.add.text(740, 540, 'SKIP', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });

    let cardObjs = [];
    const cleanup = () => {
      [overlay, box, title, sub, pageLabel, leftArrow, rightArrow, skipBtn].forEach(o => o.destroy());
      cardObjs.forEach(o => o.destroy());
    };

    const renderPage = () => {
      cardObjs.forEach(o => o.destroy());
      cardObjs = [];
      const page = hand.slice(pageOffset, pageOffset + PER_PAGE);
      const startX = 740 - ((page.length - 1) * 110) / 2;
      page.forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX + i * 110;
        const cy = 430;
        const bg = this.add.rectangle(cx, cy, 100, 130, 0x2a2a3e).setStrokeStyle(1, 0x666666).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 90 } }).setOrigin(0.5).setDepth(33);
        const tp = this.add.text(cx, cy + 40, hc.type, { fontSize: '9px', fontFamily: 'monospace', color: '#aaaaaa', align: 'center' }).setOrigin(0.5).setDepth(33);
        cardObjs.push(bg, nm, tp);
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0x4ecdc4));
        bg.on('pointerout',  () => bg.setStrokeStyle(1, 0x666666));
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

  _renderGainCashPerDiscardModal(card, payout, fx, resumeCallback) {
    const hand = this.state.hand;
    if (hand.length === 0) { return resumeCallback(payout, 0); }

    const PER_PAGE = 5;
    let pageOffset = 0;
    const selected = new Set();

    const overlay    = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.6).setDepth(30);
    const box        = this.add.rectangle(740, 450, 760, 400, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
    const title      = this.add.text(740, 300, `Discard cards → earn $${fx.amount}k each`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    const totalLabel = this.add.text(740, 335, 'Earn: $0k', {
      fontSize: '16px', fontFamily: 'monospace', color: '#80ffaa'
    }).setOrigin(0.5).setDepth(32);
    const pageLabel  = this.add.text(740, 496, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#556677'
    }).setOrigin(0.5).setDepth(32);
    const leftArrow  = this.add.text(380, 430, '◀', {
      fontSize: '22px', fontFamily: 'monospace', color: '#aaaacc'
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(1100, 430, '▶', {
      fontSize: '22px', fontFamily: 'monospace', color: '#aaaacc'
    }).setOrigin(0.5).setDepth(33).setInteractive({ useHandCursor: true });
    const acceptBtn  = this.add.text(680, 545, 'ACCEPT', {
      fontSize: '18px', fontFamily: 'monospace', color: '#80ffaa',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    const skipBtn    = this.add.text(800, 545, 'SKIP', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });

    let cardObjs = [];
    const cleanup = () => {
      [overlay, box, title, totalLabel, pageLabel, leftArrow, rightArrow, acceptBtn, skipBtn].forEach(o => o.destroy());
      cardObjs.forEach(o => o.destroy());
    };

    const updateTotal = () => {
      totalLabel.setText(`Earn: $${selected.size * fx.amount}k`);
    };

    const renderPage = () => {
      cardObjs.forEach(o => o.destroy());
      cardObjs = [];
      const page = hand.slice(pageOffset, pageOffset + PER_PAGE);
      const startX = 740 - ((page.length - 1) * 120) / 2;
      page.forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX + i * 120;
        const cy = 430;
        const isSelected = selected.has(cid);
        const bg = this.add.rectangle(cx, cy, 110, 130, 0x2a2a3e).setStrokeStyle(isSelected ? 3 : 1, isSelected ? 0x80ffaa : 0x666666).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        cardObjs.push(bg, nm);
        bg.on('pointerdown', () => {
          if (selected.has(cid)) selected.delete(cid); else selected.add(cid);
          bg.setStrokeStyle(selected.has(cid) ? 3 : 1, selected.has(cid) ? 0x80ffaa : 0x666666);
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

  _renderSwapCardModal(card, payout, fx, resumeCallback) {
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
      const overlay2 = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.6).setDepth(30);
      const box2 = this.add.rectangle(740, 450, 660, 340, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
      const t2 = this.add.text(740, 330, `Choose ${fx.handType} from hand to place:`, {
        fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', align: 'center'
      }).setOrigin(0.5).setDepth(32);
      const p2objs = [overlay2, box2, t2];

      const startX2 = 740 - ((Math.min(handCandidates.length, 5) - 1) * 120) / 2;
      handCandidates.slice(0, 5).forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX2 + i * 120;
        const cy = 440;
        const bg = this.add.rectangle(cx, cy, 110, 130, 0x2a2a3e, 1).setStrokeStyle(1, 0x666666).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        p2objs.push(bg, nm);
        bg.on('pointerdown', () => {
          // Remove from board
          const targetRow = boardSlot.rowName === 'cash' ? this.state.cashRow
                          : boardSlot.rowName === 'product'   ? this.state.productRow
                          : this.state.resourcesRow;
          targetRow[boardSlot.slotIdx] = cid;
          // Remove from hand
          const handIdx = this.state.hand.indexOf(cid);
          if (handIdx !== -1) this.state.hand.splice(handIdx, 1);
          this.renderHand();
          this._reRenderSlot(boardSlot.rowName, boardSlot.slotIdx);
          p2objs.forEach(o => o.destroy());
          resumeCallback(payout, 0);
        });
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0x4ecdc4));
        bg.on('pointerout',  () => bg.setStrokeStyle(1, 0x666666));
      });

      const skipBtn2 = this.add.text(740, 540, 'SKIP', {
        fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
        backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
      }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
      skipBtn2.on('pointerdown', () => { p2objs.forEach(o => o.destroy()); skipBtn2.destroy(); resumeCallback(payout, 0); });
      p2objs.push(skipBtn2);
    };

    const overlay = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.6).setDepth(30);
    const box = this.add.rectangle(740, 450, 660, 340, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
    const t1 = this.add.text(740, 330, `Choose ${fx.boardType} card on board to swap:`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setDepth(32);
    objs.push(overlay, box, t1);

    const startX = 740 - ((Math.min(boardCandidates.length, 5) - 1) * 120) / 2;
    boardCandidates.slice(0, 5).forEach((slot, i) => {
      const bc = this.cardsData.find(c => c.id === slot.cid);
      const cx = startX + i * 120;
      const cy = 440;
      const bg = this.add.rectangle(cx, cy, 110, 130, 0x2a2a3e, 1).setStrokeStyle(1, 0x666666).setDepth(32).setInteractive({ useHandCursor: true });
      const nm = this.add.text(cx, cy - 30, bc.name, { fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
      objs.push(bg, nm);
      bg.on('pointerdown', () => showPhase2(slot));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0x4ecdc4));
      bg.on('pointerout',  () => bg.setStrokeStyle(1, 0x666666));
    });

    const skipBtn = this.add.text(740, 540, 'SKIP', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', () => { cleanup(); skipBtn.destroy(); resumeCallback(payout, 0); });
    objs.push(skipBtn);
  }

  _renderSpendCashSwapModal(card, payout, fx, resumeCallback) {
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
      const overlay2 = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.6).setDepth(30);
      const box2 = this.add.rectangle(740, 450, 660, 340, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
      const t2 = this.add.text(740, 330, `Choose ${fx.handType} from hand to place:`, {
        fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', align: 'center'
      }).setOrigin(0.5).setDepth(32);
      const p2objs = [overlay2, box2, t2];

      const startX2 = 740 - ((Math.min(handCandidates.length, 5) - 1) * 120) / 2;
      handCandidates.slice(0, 5).forEach((cid, i) => {
        const hc = this.cardsData.find(c => c.id === cid);
        const cx = startX2 + i * 120;
        const cy = 440;
        const bg = this.add.rectangle(cx, cy, 110, 130, 0x2a2a3e, 1).setStrokeStyle(1, 0x666666).setDepth(32).setInteractive({ useHandCursor: true });
        const nm = this.add.text(cx, cy - 30, hc.name, { fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
        p2objs.push(bg, nm);
        bg.on('pointerdown', () => {
          this.state.cash -= fx.cost;
          this.updateHUD();
          // Place hand card in board slot
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
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0x4ecdc4));
        bg.on('pointerout',  () => bg.setStrokeStyle(1, 0x666666));
      });

      const skipBtn2 = this.add.text(740, 540, 'SKIP', {
        fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
        backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
      }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
      skipBtn2.on('pointerdown', () => { p2objs.forEach(o => o.destroy()); skipBtn2.destroy(); resumeCallback(payout, 0); });
      p2objs.push(skipBtn2);
    };

    const overlay = this.add.rectangle(740, 450, 1480, 900, 0x000000, 0.6).setDepth(30);
    const box = this.add.rectangle(740, 450, 660, 340, 0x1a1a2e, 1).setStrokeStyle(2, 0x4ecdc4).setDepth(31);
    const t1 = this.add.text(740, 310, `Pay $${fx.cost}k → choose any board card to swap:`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 600 }
    }).setOrigin(0.5).setDepth(32);
    objs.push(overlay, box, t1);

    const startX = 740 - ((Math.min(boardCandidates.length, 5) - 1) * 120) / 2;
    boardCandidates.slice(0, 5).forEach((slot, i) => {
      const bc = this.cardsData.find(c => c.id === slot.cid);
      const cx = startX + i * 120;
      const cy = 440;
      const bg = this.add.rectangle(cx, cy, 110, 130, 0x2a2a3e, 1).setStrokeStyle(1, 0x666666).setDepth(32).setInteractive({ useHandCursor: true });
      const nm = this.add.text(cx, cy - 30, bc.name, { fontSize: '10px', fontFamily: 'monospace', color: '#ffffff', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5).setDepth(33);
      objs.push(bg, nm);
      bg.on('pointerdown', () => showPhase2(slot));
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0x4ecdc4));
      bg.on('pointerout',  () => bg.setStrokeStyle(1, 0x666666));
    });

    const skipBtn = this.add.text(740, 540, 'SKIP', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ff6b6b',
      backgroundColor: '#1a1a2e', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', () => { cleanup(); skipBtn.destroy(); resumeCallback(payout, 0); });
    objs.push(skipBtn);
  }

  _handleSwapPhase1(modal, csuiteEntry, allCsuite, cx, cy, _PH, payout, resumeCallback) {
    if (modal.swapState.phase !== 1) return;
    modal.swapState.phase = 2;
    modal.swapState.selected = csuiteEntry;

    // Highlight selected C-Suite button
    allCsuite.forEach(e => e.bg.setFillStyle(0x2a1a00));
    csuiteEntry.bg.setFillStyle(0x5a3a00).setStrokeStyle(2, 0xffd32a);

    modal.instrText.setText('Now select a card from your hand to place here');

    // Remove existing C-Suite buttons' interactivity (they've served their purpose)
    allCsuite.forEach(e => e.bg.removeInteractive());

    // Build hand card list
    const handStartY = cy - 55;
    const btnH = 26;
    this.state.hand.forEach((handCardId, idx) => {
      const handCard = this.cardsData.find(c => c.id === handCardId);
      const btnY = handStartY + idx * (btnH + 4);
      const bg = this.add.rectangle(cx + 0, btnY, 340, btnH, 0x001a2a)
        .setStrokeStyle(1, 0x4488aa).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(cx, btnY, `${handCard.name}  ($${handCard.cost * 100}k)`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaccff'
      }).setOrigin(0.5, 0.5);
      modal.add([bg, lbl]);

      bg.on('pointerover', () => bg.setFillStyle(0x002a3a));
      bg.on('pointerout',  () => bg.setFillStyle(0x001a2a));
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
    const COLORS_slotBorder = rowType === 'product'   ? COLORS.productSlotBorder
                            : rowType === 'resources' ? COLORS.resSlotBorder
                            : COLORS.slotBorder;

    // Destroy all children added after the initial [slotBg, slotLabel]
    const excess = slot.list.slice(2);
    excess.forEach(child => child.destroy());

    // Reset slot visual state
    slot.slotBg.setFillStyle(COLORS_slotEmpty).setStrokeStyle(1, COLORS_slotBorder);
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

    const baseTotal       = breakdown.reduce((s, c) => s + c.total, 0);
    const productMultiplier = this.state.productMultiplier;
    const finalTotal      = Math.round(baseTotal * productMultiplier);
    const isEndGame       = this.state.round === TURNS_PER_ROUND.length;

    this.scene.start('ValuationScene', {
      breakdown,
      baseTotal,
      productMultiplier,
      finalTotal,
      finalCash: this.state.cash,
      round:     this.state.round,
      isEndGame,
      carryOver: isEndGame ? null : {
        round:          this.state.round,
        cash:           this.state.cash,
        hand:           [...this.state.hand],
        cashRow:        [...this.state.cashRow],
        productRow:     [...this.state.productRow],
        resourcesRow:   [...this.state.resourcesRow],
        drawPile:       [...this.state.drawPile],
        revealedCards:  [...this.state.revealedCards],
        cardOpBoosts:   { ...this.state.cardOpBoosts },
        valueBonuses:   { ...this.state.valueBonuses },
        productMultiplier: this.state.productMultiplier,
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
        box.setFillStyle(0x1a3a2a).setStrokeStyle(1, 0x40916c);
        check.setVisible(true);
      } else if (i === completed && completed < state.maxTurns) {
        box.setFillStyle(0x0d2a1a).setStrokeStyle(2, 0x80ffaa);
        check.setVisible(false);
      } else {
        box.setFillStyle(0x1a1a2e).setStrokeStyle(1, 0x333355);
        check.setVisible(false);
      }
    });
    this.hudCash.setText(fmtVal(state.cash));
    if (this.cashSubtitle) this.cashSubtitle.setText(`Base: $${BASE_CASH_PER_ROUND[state.round - 1]}k`);

    this.hudProductMultiplier.setText(`${state.productMultiplier}×`);

    if (this.hudDrawPile) this.hudDrawPile.setText(`${state.drawPile.length} cards`);
  }

  // ── Utility ───────────────────────────────────────────────
  showFloat(x, y, text, color = '#ffffff', duration = 800) {
    const t = this.add.text(x, y, text, {
      fontSize: '13px', fontFamily: 'monospace', color, fontStyle: 'bold', align: 'center'
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
            finalCash, round, isEndGame, carryOver } = this.payload;
    const cx = GAME_W / 2;

    this.add.rectangle(cx, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.90);

    // Header
    this.add.text(cx, 60, 'VALUATION', {
      fontSize: '48px', fontFamily: 'monospace', color: '#e9c46a', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, 108, `END OF ROUND ${round}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);

    let y = 148;

    // ── Card breakdown ───────────────────────────────────────
    this.add.text(cx, y, 'CARDS ON BOARD', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555577', align: 'center'
    }).setOrigin(0.5, 0.5);
    y += 26;

    if (breakdown.length === 0) {
      this.add.text(cx, y, '(no cards placed)', {
        fontSize: '13px', fontFamily: 'monospace', color: '#555577', align: 'center'
      }).setOrigin(0.5, 0.5);
      y += 26;
    } else {
      breakdown.forEach(entry => {
        const rowTag   = entry.row === 'product' ? '[PROD] ' : entry.row === 'resources' ? '[RES]  ' : '[CASH] ';
        const tagColor = entry.row === 'product' ? '#9966cc' : entry.row === 'resources' ? '#aa7722' : '#446688';
        this.add.text(cx - 230, y, rowTag, {
          fontSize: '10px', fontFamily: 'monospace', color: tagColor
        }).setOrigin(0, 0.5);

        this.add.text(cx - 185, y, entry.name, {
          fontSize: '12px', fontFamily: 'monospace', color: '#ffffff'
        }).setOrigin(0, 0.5);

        let valStr;
        if (entry.bonus > 0) {
          valStr = `${fmtVal(entry.base)} + ${fmtVal(entry.bonus)} = ${fmtVal(entry.total)}`;
        } else {
          valStr = entry.total > 0 ? fmtVal(entry.total) : '—';
        }
        this.add.text(cx + 230, y, valStr, {
          fontSize: '12px', fontFamily: 'monospace', color: '#80ffaa', align: 'right'
        }).setOrigin(1, 0.5);

        y += 23;
      });
    }

    // Base total subtotal
    y += 6;
    this.add.rectangle(cx, y, 560, 1, 0x333355).setOrigin(0.5, 0.5);
    y += 18;
    this.add.text(cx - 230, y, 'BASE TOTAL', {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaaacc'
    }).setOrigin(0, 0.5);
    this.add.text(cx + 230, y, fmtVal(baseTotal), {
      fontSize: '15px', fontFamily: 'monospace', color: '#aaaacc', align: 'right'
    }).setOrigin(1, 0.5);
    y += 30;

    // ── Product Multiplier ────────────────────────────────────
    this.add.text(cx, y, 'PRODUCT MULTIPLIER', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555577', align: 'center'
    }).setOrigin(0.5, 0.5);
    y += 24;

    this.add.text(cx, y, `${productMultiplier}×`, {
      fontSize: '20px', fontFamily: 'monospace', color: '#cd84ff', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    y += 36;

    // ── Final valuation ───────────────────────────────────────
    this.add.rectangle(cx, y, 560, 2, 0x555577).setOrigin(0.5, 0.5);
    y += 24;

    const calcStr = `${fmtVal(baseTotal)}  ×  ${productMultiplier}×  =`;
    this.add.text(cx, y, calcStr, {
      fontSize: '14px', fontFamily: 'monospace', color: '#aaaacc', align: 'center'
    }).setOrigin(0.5, 0.5);
    y += 30;

    this.add.text(cx, y, fmtVal(finalTotal), {
      fontSize: '42px', fontFamily: 'monospace', color: '#e9c46a', fontStyle: 'bold', align: 'center'
    }).setOrigin(0.5, 0.5);
    y += 52;

    // Result message
    this.add.text(cx, y, this.resultMessage(finalTotal, isEndGame), {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffffff', align: 'center',
      wordWrap: { width: 620 }
    }).setOrigin(0.5, 0.5);
    y += 36;

    // ── Button ────────────────────────────────────────────────
    const btnY   = GAME_H - 60;

    this.add.text(cx, btnY - 40, `Cash remaining: ${fmtVal(finalCash)}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#555577', align: 'center'
    }).setOrigin(0.5, 0.5);
    const btnW   = isEndGame ? 200 : 280;
    const btnLbl = isEndGame ? 'PLAY AGAIN'
                 : `CONTINUE TO ROUND ${round + 1}`;

    const btn = this.add.rectangle(cx, btnY, btnW, 48, 0x1a472a)
      .setStrokeStyle(2, 0x40916c).setInteractive();
    this.add.text(cx, btnY, btnLbl, {
      fontSize: '14px', fontFamily: 'monospace', color: '#80ffaa', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x2d6a4f));
    btn.on('pointerout',  () => btn.setFillStyle(0x1a472a));
    btn.on('pointerdown', () => {
      if (isEndGame) {
        this.scene.start('GameScene');
      } else {
        this.scene.start('GameScene', { carryOver });
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
  scene:           [BootScene, GameScene, ValuationScene],
  parent:          document.body,
};

new Phaser.Game(config);
