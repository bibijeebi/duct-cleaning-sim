import {
  Scene,
  Observable,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Ellipse,
  Control,
  StackPanel,
  Line,
} from '@babylonjs/gui';
import { DuctSection, DuctMaterial } from '../models/DuctNetwork';
import { COLORS, UI } from '../utils/constants';
import { GameState } from '../systems/GameState';

export interface CleaningResult {
  sectionId: string;
  completed: boolean;
  debrisRemoved: number;
  penalties: Array<{ points: number; reason: string }>;
}

interface DebrisParticle {
  rect: Ellipse;
  x: number;
  y: number;
  attached: boolean;
  vx: number;
  vy: number;
  size: number;
}

const DUCT_VIEW = {
  WIDTH: 800,
  HEIGHT: 200,
  WALL_THICKNESS: 8,
  WAND_HEIGHT: 6,
  DEBRIS_COUNT: 30,
  DEBRIS_MIN_SIZE: 4,
  DEBRIS_MAX_SIZE: 10,
  CLEAN_RADIUS: 60,
  SUCTION_SPEED: 3,
  FLEX_DEFORM_THRESHOLD: 0.7,
  DUCTBOARD_CONTACT_DISTANCE: 25,
} as const;

export class DuctCrossSection {
  private _scene: Scene;
  private _ui: AdvancedDynamicTexture | null = null;
  private _container: Rectangle | null = null;
  private _ductRect: Rectangle | null = null;
  private _wand: Rectangle | null = null;
  private _wandTip: Ellipse | null = null;
  private _progressBar: Rectangle | null = null;
  private _progressFill: Rectangle | null = null;
  private _progressText: TextBlock | null = null;
  private _sectionLabel: TextBlock | null = null;
  private _materialLabel: TextBlock | null = null;
  private _warningText: TextBlock | null = null;
  private _instructionText: TextBlock | null = null;

  private _debris: DebrisParticle[] = [];
  private _sprayParticles: Ellipse[] = [];

  private _currentSection: DuctSection | null = null;
  private _wandX: number = 50; // 0-800 position along duct
  private _wandY: number = 100; // vertical position in duct
  private _isActive: boolean = false;
  private _isForwardHead: boolean = true; // true = forward (pushes debris ahead), false = reverse
  private _isSpraying: boolean = false;
  private _aggressiveness: number = 0; // 0-1, builds up with mouse movement speed
  private _lastMouseX: number = 0;
  private _lastMouseY: number = 0;
  private _suctionEnd: 'left' | 'right' = 'left'; // which end has negative air
  private _flexDeformAmount: number = 0;
  private _flexCollapseWarned: boolean = false;
  private _ductboardContactCount: number = 0;

  private _renderCallback: (() => void) | null = null;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private _mouseHandler: ((e: MouseEvent) => void) | null = null;
  private _mouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private _mouseUpHandler: ((e: MouseEvent) => void) | null = null;

  onComplete: Observable<CleaningResult> = new Observable();
  onExit: Observable<void> = new Observable();

  constructor(scene: Scene) {
    this._scene = scene;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  show(section: DuctSection, suctionEnd: 'left' | 'right' = 'left'): void {
    if (this._isActive) return;
    this._isActive = true;
    this._currentSection = section;
    this._suctionEnd = suctionEnd;
    this._wandX = suctionEnd === 'left' ? 50 : DUCT_VIEW.WIDTH - 50;
    this._wandY = DUCT_VIEW.HEIGHT / 2;
    this._aggressiveness = 0;
    this._flexDeformAmount = 0;
    this._flexCollapseWarned = false;
    this._ductboardContactCount = 0;
    this._isSpraying = false;

    this._createUI();
    this._generateDebris(section);
    this._setupInput();
    this._startRenderLoop();
  }

  hide(): void {
    if (!this._isActive) return;
    this._isActive = false;
    this._teardownInput();
    this._stopRenderLoop();
    this._destroyUI();
    this._currentSection = null;
  }

  private _createUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI('ductCrossUI');

    // Full-screen dark background
    this._container = new Rectangle('dcs_container');
    this._container.width = '100%';
    this._container.height = '100%';
    this._container.background = '#0a0a0aee';
    this._container.thickness = 0;
    this._container.zIndex = 500;
    this._ui.addControl(this._container);

    // Title
    this._sectionLabel = new TextBlock('dcs_sectionLabel');
    this._sectionLabel.text = `DUCT CROSS-SECTION: ${this._currentSection?.id.toUpperCase() || ''}`;
    this._sectionLabel.color = COLORS.TEXT_PRIMARY;
    this._sectionLabel.fontSize = 18;
    this._sectionLabel.fontFamily = UI.FONT_FAMILY;
    this._sectionLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._sectionLabel.paddingTop = '20px';
    this._container.addControl(this._sectionLabel);

    // Material label
    this._materialLabel = new TextBlock('dcs_materialLabel');
    const mat = this._currentSection?.material || 'rigid';
    this._materialLabel.text = `Material: ${mat.toUpperCase()} | Head: ${this._isForwardHead ? 'FORWARD' : 'REVERSE'} (R to toggle)`;
    this._materialLabel.color = COLORS.TEXT_SECONDARY;
    this._materialLabel.fontSize = 13;
    this._materialLabel.fontFamily = UI.FONT_FAMILY;
    this._materialLabel.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._materialLabel.paddingTop = '45px';
    this._container.addControl(this._materialLabel);

    // Duct rectangle (the main view area)
    this._ductRect = new Rectangle('dcs_ductRect');
    this._ductRect.width = `${DUCT_VIEW.WIDTH}px`;
    this._ductRect.height = `${DUCT_VIEW.HEIGHT}px`;
    this._ductRect.background = this._getDuctBgColor();
    this._ductRect.color = '#666666';
    this._ductRect.thickness = DUCT_VIEW.WALL_THICKNESS;
    this._ductRect.cornerRadius = 2;
    this._container.addControl(this._ductRect);

    // Top wall label
    const topWall = new Rectangle('dcs_topWall');
    topWall.width = `${DUCT_VIEW.WIDTH}px`;
    topWall.height = `${DUCT_VIEW.WALL_THICKNESS}px`;
    topWall.background = this._getWallColor();
    topWall.thickness = 0;
    topWall.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._ductRect.addControl(topWall);

    const bottomWall = new Rectangle('dcs_bottomWall');
    bottomWall.width = `${DUCT_VIEW.WIDTH}px`;
    bottomWall.height = `${DUCT_VIEW.WALL_THICKNESS}px`;
    bottomWall.background = this._getWallColor();
    bottomWall.thickness = 0;
    bottomWall.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._ductRect.addControl(bottomWall);

    // Suction indicator (arrow showing airflow direction)
    const suctionArrow = new TextBlock('dcs_suctionArrow');
    suctionArrow.text = this._suctionEnd === 'left'
      ? '<<< SUCTION (Negative Air)'
      : 'SUCTION (Negative Air) >>>';
    suctionArrow.color = '#44AAFF';
    suctionArrow.fontSize = 11;
    suctionArrow.fontFamily = UI.FONT_FAMILY;
    suctionArrow.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    suctionArrow.top = '-25px';
    suctionArrow.textHorizontalAlignment = this._suctionEnd === 'left'
      ? Control.HORIZONTAL_ALIGNMENT_LEFT
      : Control.HORIZONTAL_ALIGNMENT_RIGHT;
    if (this._suctionEnd === 'left') {
      suctionArrow.paddingLeft = '10px';
    } else {
      suctionArrow.paddingRight = '10px';
    }
    this._ductRect.addControl(suctionArrow);

    // Airflow arrows inside duct
    for (let i = 0; i < 5; i++) {
      const arrow = new TextBlock(`dcs_flowArrow_${i}`);
      arrow.text = this._suctionEnd === 'left' ? '>>>' : '<<<';
      arrow.color = '#44AAFF44';
      arrow.fontSize = 16;
      arrow.fontFamily = UI.FONT_FAMILY;
      const xPos = (i + 1) * (DUCT_VIEW.WIDTH / 6) - DUCT_VIEW.WIDTH / 2;
      arrow.left = `${xPos}px`;
      this._ductRect.addControl(arrow);
    }

    // Wand
    this._wand = new Rectangle('dcs_wand');
    this._wand.width = '80px';
    this._wand.height = `${DUCT_VIEW.WAND_HEIGHT}px`;
    this._wand.background = '#CC8844';
    this._wand.thickness = 1;
    this._wand.color = '#AA6622';
    this._wand.cornerRadius = 2;
    this._ductRect.addControl(this._wand);

    // Wand tip (air head)
    this._wandTip = new Ellipse('dcs_wandTip');
    this._wandTip.width = '14px';
    this._wandTip.height = '14px';
    this._wandTip.background = '#DDAA55';
    this._wandTip.color = '#AA8833';
    this._wandTip.thickness = 2;
    this._ductRect.addControl(this._wandTip);

    // Progress bar container
    const progressContainer = new Rectangle('dcs_progressContainer');
    progressContainer.width = `${DUCT_VIEW.WIDTH}px`;
    progressContainer.height = '20px';
    progressContainer.top = `${DUCT_VIEW.HEIGHT / 2 + 30}px`;
    progressContainer.background = '#333333';
    progressContainer.thickness = 1;
    progressContainer.color = '#555555';
    this._container.addControl(progressContainer);

    this._progressFill = new Rectangle('dcs_progressFill');
    this._progressFill.width = '0%';
    this._progressFill.height = '100%';
    this._progressFill.background = '#44AA44';
    this._progressFill.thickness = 0;
    this._progressFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    progressContainer.addControl(this._progressFill);

    this._progressText = new TextBlock('dcs_progressText');
    this._progressText.text = 'Cleanliness: 0%';
    this._progressText.color = COLORS.TEXT_WHITE;
    this._progressText.fontSize = 11;
    this._progressText.fontFamily = UI.FONT_FAMILY;
    progressContainer.addControl(this._progressText);

    // Warning text
    this._warningText = new TextBlock('dcs_warning');
    this._warningText.text = '';
    this._warningText.color = COLORS.TEXT_DANGER;
    this._warningText.fontSize = 16;
    this._warningText.fontFamily = UI.FONT_FAMILY;
    this._warningText.top = `${DUCT_VIEW.HEIGHT / 2 + 60}px`;
    this._warningText.isVisible = false;
    this._container.addControl(this._warningText);

    // Instructions
    this._instructionText = new TextBlock('dcs_instructions');
    this._instructionText.text = 'Mouse: move wand | Click: spray air | R: toggle head direction | ESC: exit';
    this._instructionText.color = COLORS.TEXT_SECONDARY;
    this._instructionText.fontSize = 11;
    this._instructionText.fontFamily = UI.FONT_FAMILY;
    this._instructionText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._instructionText.paddingBottom = '30px';
    this._container.addControl(this._instructionText);
  }

  private _getDuctBgColor(): string {
    const mat = this._currentSection?.material || 'rigid';
    switch (mat) {
      case 'rigid': return '#1a1c1e';
      case 'flex': return '#1a1a20';
      case 'ductboard': return '#1e1a16';
    }
  }

  private _getWallColor(): string {
    const mat = this._currentSection?.material || 'rigid';
    switch (mat) {
      case 'rigid': return '#888890';
      case 'flex': return '#666680';
      case 'ductboard': return '#887766';
    }
  }

  private _generateDebris(section: DuctSection): void {
    if (!this._ductRect) return;
    this._debris = [];

    const count = Math.floor(DUCT_VIEW.DEBRIS_COUNT * section.debrisLevel);
    for (let i = 0; i < count; i++) {
      const size = DUCT_VIEW.DEBRIS_MIN_SIZE + Math.random() * (DUCT_VIEW.DEBRIS_MAX_SIZE - DUCT_VIEW.DEBRIS_MIN_SIZE);
      const x = 30 + Math.random() * (DUCT_VIEW.WIDTH - 60);
      // Debris clings to walls (top or bottom), with some in middle
      const wallBias = Math.random();
      let y: number;
      if (wallBias < 0.35) {
        y = 15 + Math.random() * 30; // near top
      } else if (wallBias < 0.7) {
        y = DUCT_VIEW.HEIGHT - 45 + Math.random() * 30; // near bottom
      } else {
        y = 30 + Math.random() * (DUCT_VIEW.HEIGHT - 60); // middle
      }

      const rect = new Ellipse(`debris_${i}`);
      rect.width = `${size}px`;
      rect.height = `${size * 0.7}px`;
      rect.background = this._getDebrisColor();
      rect.thickness = 0;
      rect.left = `${x - DUCT_VIEW.WIDTH / 2}px`;
      rect.top = `${y - DUCT_VIEW.HEIGHT / 2}px`;
      this._ductRect.addControl(rect);

      this._debris.push({
        rect,
        x,
        y,
        attached: true,
        vx: 0,
        vy: 0,
        size,
      });
    }
  }

  private _getDebrisColor(): string {
    const r = 30 + Math.floor(Math.random() * 40);
    const g = 25 + Math.floor(Math.random() * 30);
    const b = 20 + Math.floor(Math.random() * 20);
    return `rgb(${r},${g},${b})`;
  }

  private _setupInput(): void {
    // Release pointer lock so mouse can control wand
    document.exitPointerLock();

    this._keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this._exitView();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        this._isForwardHead = !this._isForwardHead;
        if (this._materialLabel) {
          this._materialLabel.text = `Material: ${(this._currentSection?.material || 'rigid').toUpperCase()} | Head: ${this._isForwardHead ? 'FORWARD' : 'REVERSE'} (R to toggle)`;
        }
      }
      // Arrow keys for wand control
      const step = 8;
      if (e.key === 'ArrowLeft') this._wandX = Math.max(20, this._wandX - step);
      if (e.key === 'ArrowRight') this._wandX = Math.min(DUCT_VIEW.WIDTH - 20, this._wandX + step);
      if (e.key === 'ArrowUp') this._wandY = Math.max(20, this._wandY - step);
      if (e.key === 'ArrowDown') this._wandY = Math.min(DUCT_VIEW.HEIGHT - 20, this._wandY + step);
    };

    this._mouseHandler = (e: MouseEvent) => {
      // Convert mouse position to duct-relative coordinates
      const canvas = this._scene.getEngine().getRenderingCanvas();
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const canvasCenterX = canvasRect.left + canvasRect.width / 2;
      const canvasCenterY = canvasRect.top + canvasRect.height / 2;

      // Map mouse position relative to duct center
      const relX = e.clientX - canvasCenterX;
      const relY = e.clientY - canvasCenterY;

      // Clamp to duct bounds
      this._wandX = Math.max(20, Math.min(DUCT_VIEW.WIDTH - 20,
        relX + DUCT_VIEW.WIDTH / 2));
      this._wandY = Math.max(20, Math.min(DUCT_VIEW.HEIGHT - 20,
        relY + DUCT_VIEW.HEIGHT / 2));

      // Track aggressiveness based on mouse movement speed
      const dx = e.clientX - this._lastMouseX;
      const dy = e.clientY - this._lastMouseY;
      const speed = Math.sqrt(dx * dx + dy * dy);
      this._aggressiveness = Math.min(1, speed / 30);
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
    };

    this._mouseDownHandler = () => { this._isSpraying = true; };
    this._mouseUpHandler = () => { this._isSpraying = false; };

    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('mousemove', this._mouseHandler);
    document.addEventListener('mousedown', this._mouseDownHandler);
    document.addEventListener('mouseup', this._mouseUpHandler);
  }

  private _teardownInput(): void {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._mouseHandler) document.removeEventListener('mousemove', this._mouseHandler);
    if (this._mouseDownHandler) document.removeEventListener('mousedown', this._mouseDownHandler);
    if (this._mouseUpHandler) document.removeEventListener('mouseup', this._mouseUpHandler);
    this._keyHandler = null;
    this._mouseHandler = null;
    this._mouseDownHandler = null;
    this._mouseUpHandler = null;
  }

  private _startRenderLoop(): void {
    this._renderCallback = () => this._update();
    this._scene.registerBeforeRender(this._renderCallback);
  }

  private _stopRenderLoop(): void {
    if (this._renderCallback) {
      this._scene.unregisterBeforeRender(this._renderCallback);
      this._renderCallback = null;
    }
  }

  private _update(): void {
    if (!this._isActive || !this._currentSection) return;

    this._updateWandPosition();

    if (this._isSpraying) {
      this._updateSpray();
      this._checkMaterialBehavior();
    }

    this._updateDebrisPhysics();
    this._updateProgress();
    this._updateSprayParticles();
  }

  private _updateWandPosition(): void {
    if (!this._wand || !this._wandTip || !this._ductRect) return;

    // Position wand body
    this._wand.left = `${this._wandX - DUCT_VIEW.WIDTH / 2 - 40}px`;
    this._wand.top = `${this._wandY - DUCT_VIEW.HEIGHT / 2}px`;

    // Position wand tip at end
    const tipX = this._isForwardHead
      ? this._wandX + 40
      : this._wandX - 40;
    this._wandTip.left = `${tipX - DUCT_VIEW.WIDTH / 2}px`;
    this._wandTip.top = `${this._wandY - DUCT_VIEW.HEIGHT / 2}px`;
  }

  private _updateSpray(): void {
    if (!this._ductRect) return;

    // Spray direction based on head type
    const sprayDirX = this._isForwardHead ? 1 : -1;
    const tipX = this._isForwardHead ? this._wandX + 40 : this._wandX - 40;

    // Detach debris near spray
    for (const particle of this._debris) {
      if (!particle.attached) continue;

      const dx = particle.x - tipX;
      const dy = particle.y - this._wandY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DUCT_VIEW.CLEAN_RADIUS) {
        particle.attached = false;
        // Give velocity toward suction end
        const suctionDir = this._suctionEnd === 'left' ? -1 : 1;
        particle.vx = sprayDirX * (2 + Math.random() * 3) + suctionDir * 1;
        particle.vy = (Math.random() - 0.5) * 2;
      }
    }

    // Create visual spray particles
    if (Math.random() < 0.4) {
      this._createSprayParticle(tipX, this._wandY, sprayDirX);
    }
  }

  private _createSprayParticle(x: number, y: number, dirX: number): void {
    if (!this._ductRect) return;

    const p = new Ellipse(`spray_${Date.now()}_${Math.random()}`);
    p.width = '3px';
    p.height = '3px';
    p.background = '#AADDFF88';
    p.thickness = 0;
    p.left = `${x - DUCT_VIEW.WIDTH / 2}px`;
    p.top = `${y - DUCT_VIEW.HEIGHT / 2 + (Math.random() - 0.5) * 20}px`;
    this._ductRect.addControl(p);
    this._sprayParticles.push(p);

    // Auto-remove after short time
    setTimeout(() => {
      if (this._ductRect) {
        this._ductRect.removeControl(p);
      }
      const idx = this._sprayParticles.indexOf(p);
      if (idx >= 0) this._sprayParticles.splice(idx, 1);
    }, 300);
  }

  private _updateSprayParticles(): void {
    // Spray particles are auto-removed by timeout, nothing else needed
  }

  private _checkMaterialBehavior(): void {
    if (!this._currentSection) return;

    const mat = this._currentSection.material;
    const distToTop = this._wandY;
    const distToBottom = DUCT_VIEW.HEIGHT - this._wandY;
    const minWallDist = Math.min(distToTop, distToBottom);

    if (mat === 'flex') {
      // Flex duct deforms if too aggressive
      if (this._aggressiveness > DUCT_VIEW.FLEX_DEFORM_THRESHOLD) {
        this._flexDeformAmount += 0.02;

        if (this._flexDeformAmount > 0.5 && !this._flexCollapseWarned) {
          this._flexCollapseWarned = true;
          this._showWarning('WARNING: Flex duct deforming! Reduce aggressiveness!');
        }

        if (this._flexDeformAmount > 1.0) {
          // Collapse! Penalty applied
          const gs = GameState.getInstance();
          gs.applyDeduction(25, 'Aggressive on flex duct (collapse)');
          this._showWarning('FLEX DUCT COLLAPSED! -25 points');
          this._flexDeformAmount = 0.5; // Reset so they can continue
        }

        // Visual: flex duct walls pulse/deform
        if (this._ductRect) {
          const deformColor = `rgb(${102 + Math.floor(this._flexDeformAmount * 80)}, 102, 128)`;
          this._ductRect.color = deformColor;
        }
      } else {
        // Slowly recover
        this._flexDeformAmount = Math.max(0, this._flexDeformAmount - 0.005);
        if (this._ductRect && this._flexDeformAmount === 0) {
          this._ductRect.color = '#666666';
        }
      }
    }

    if (mat === 'ductboard') {
      // Ductboard: contact with walls releases fibers
      if (minWallDist < DUCT_VIEW.DUCTBOARD_CONTACT_DISTANCE) {
        this._ductboardContactCount++;
        if (this._ductboardContactCount === 1) {
          this._showWarning('WARNING: Wand contacting ductboard walls! Use air wash only!');
        }
        if (this._ductboardContactCount > 30) {
          const gs = GameState.getInstance();
          gs.applyDeduction(20, 'Contact on ductboard (fiber release)');
          this._showWarning('FIBER RELEASE! Ductboard damaged! -20 points');
          this._ductboardContactCount = 0; // Reset counter
          // Visual: show fiber particles
          this._createFiberParticles();
        }
      }
    }
  }

  private _createFiberParticles(): void {
    if (!this._ductRect) return;
    for (let i = 0; i < 8; i++) {
      const fiber = new Ellipse(`fiber_${Date.now()}_${i}`);
      fiber.width = '2px';
      fiber.height = '8px';
      fiber.background = '#DDCC9988';
      fiber.thickness = 0;
      fiber.left = `${this._wandX - DUCT_VIEW.WIDTH / 2 + (Math.random() - 0.5) * 40}px`;
      fiber.top = `${this._wandY - DUCT_VIEW.HEIGHT / 2 + (Math.random() - 0.5) * 20}px`;
      fiber.rotation = Math.random() * Math.PI;
      this._ductRect.addControl(fiber);

      setTimeout(() => {
        if (this._ductRect) this._ductRect.removeControl(fiber);
      }, 1500);
    }
  }

  private _showWarning(text: string): void {
    if (!this._warningText) return;
    this._warningText.text = text;
    this._warningText.isVisible = true;
    setTimeout(() => {
      if (this._warningText) this._warningText.isVisible = false;
    }, 3000);
  }

  private _updateDebrisPhysics(): void {
    const suctionX = this._suctionEnd === 'left' ? 0 : DUCT_VIEW.WIDTH;

    for (const particle of this._debris) {
      if (particle.attached) continue;

      // Apply suction force toward suction end
      const dx = suctionX - particle.x;
      const suctionForce = 0.15;
      particle.vx += Math.sign(dx) * suctionForce;

      // Damping
      particle.vx *= 0.97;
      particle.vy *= 0.95;

      // Slight gravity
      particle.vy += 0.05;

      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Bounce off walls
      if (particle.y < 10) { particle.y = 10; particle.vy = Math.abs(particle.vy) * 0.5; }
      if (particle.y > DUCT_VIEW.HEIGHT - 10) { particle.y = DUCT_VIEW.HEIGHT - 10; particle.vy = -Math.abs(particle.vy) * 0.5; }

      // Update visual position
      particle.rect.left = `${particle.x - DUCT_VIEW.WIDTH / 2}px`;
      particle.rect.top = `${particle.y - DUCT_VIEW.HEIGHT / 2}px`;

      // Remove if reached suction end
      if ((this._suctionEnd === 'left' && particle.x < -10) ||
          (this._suctionEnd === 'right' && particle.x > DUCT_VIEW.WIDTH + 10)) {
        particle.rect.isVisible = false;
      }
    }
  }

  private _updateProgress(): void {
    if (!this._currentSection || !this._progressFill || !this._progressText) return;

    const totalDebris = this._debris.length;
    if (totalDebris === 0) return;

    const removedCount = this._debris.filter(d =>
      !d.attached && (!d.rect.isVisible ||
        (this._suctionEnd === 'left' && d.x < -5) ||
        (this._suctionEnd === 'right' && d.x > DUCT_VIEW.WIDTH + 5))
    ).length;

    const cleanliness = totalDebris > 0 ? removedCount / totalDebris : 1;
    const pct = Math.floor(cleanliness * 100);

    this._progressFill.width = `${pct}%`;
    this._progressText.text = `Cleanliness: ${pct}%`;

    if (cleanliness < 0.5) {
      this._progressFill.background = '#AA4444';
    } else if (cleanliness < 0.8) {
      this._progressFill.background = '#AAAA44';
    } else {
      this._progressFill.background = '#44AA44';
    }

    // Section is clean when >= 95%
    if (cleanliness >= 0.95) {
      this._completeSection();
    }
  }

  private _completeSection(): void {
    if (!this._currentSection) return;

    const penalties: Array<{ points: number; reason: string }> = [];
    // Penalties were already applied via GameState during cleaning

    const result: CleaningResult = {
      sectionId: this._currentSection.id,
      completed: true,
      debrisRemoved: this._debris.filter(d => !d.attached).length / Math.max(1, this._debris.length),
      penalties,
    };

    this.onComplete.notifyObservers(result);
    this._showWarning('SECTION CLEAN! Returning to 3D view...');

    setTimeout(() => {
      this.hide();
      this.onExit.notifyObservers();
    }, 1500);
  }

  private _exitView(): void {
    // Calculate partial cleaning
    if (this._currentSection) {
      const totalDebris = this._debris.length;
      const removedCount = this._debris.filter(d => !d.attached && !d.rect.isVisible).length;
      const cleanAmount = totalDebris > 0 ? (removedCount / totalDebris) * this._currentSection.debrisLevel : 0;

      const result: CleaningResult = {
        sectionId: this._currentSection.id,
        completed: false,
        debrisRemoved: cleanAmount,
        penalties: [],
      };
      this.onComplete.notifyObservers(result);
    }

    this.hide();
    this.onExit.notifyObservers();
  }

  private _destroyUI(): void {
    // Clean up spray particles
    this._sprayParticles = [];
    this._debris = [];

    if (this._ui) {
      this._ui.dispose();
      this._ui = null;
    }
    this._container = null;
    this._ductRect = null;
    this._wand = null;
    this._wandTip = null;
    this._progressBar = null;
    this._progressFill = null;
    this._progressText = null;
    this._sectionLabel = null;
    this._materialLabel = null;
    this._warningText = null;
    this._instructionText = null;
  }

  dispose(): void {
    this.hide();
    this.onComplete.clear();
    this.onExit.clear();
  }
}
