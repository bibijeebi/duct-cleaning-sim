import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { GamePhase } from '../systems/GameState';
import { COLORS, UI, TIMING } from '../utils/constants';

const PHASE_INFO: Record<GamePhase, { title: string; objectives: string[] }> = {
  [GamePhase.PRE_JOB]: {
    title: 'PRE-JOB',
    objectives: [
      'Read the job ticket',
      'Select equipment loadout from van',
      'Perform vehicle check',
    ],
  },
  [GamePhase.ARRIVAL]: {
    title: 'ARRIVAL & ASSESSMENT',
    objectives: [
      'Enter the building',
      'Find the air handler in mechanical room',
      'Identify HVAC system type',
      'Count all supply registers and return grills',
      'Lay plastic sheeting under work areas',
    ],
  },
  [GamePhase.SETUP]: {
    title: 'SETUP',
    objectives: [
      'Connect tubing from negative air machine to trunk',
      'Run compressor hose for agitation wand',
      'Position portable vacuums at access points',
    ],
  },
  [GamePhase.EXECUTION]: {
    title: 'EXECUTION',
    objectives: [
      'Clean RETURN ducts FIRST (upstream)',
      'Then clean supply ducts',
      'Cut access holes as needed (every 12ft or at turns)',
    ],
  },
  [GamePhase.COMPLETION]: {
    title: 'COMPLETION',
    objectives: [
      'Patch all access holes to code',
      'Pressure wash all grills/registers',
      'Clean coils in air handler',
      'Replace filters',
      'Reinstall all registers/grills',
    ],
  },
  [GamePhase.CLEANUP]: {
    title: 'CLEANUP',
    objectives: [
      'Pull plastic sheeting',
      'Sweep/dustpan all debris',
      'Pack all equipment',
      'Final walkthrough inspection',
    ],
  },
  [GamePhase.SCORED]: {
    title: 'JOB COMPLETE',
    objectives: ['Review your scorecard'],
  },
};

export class PhaseOverlay {
  private _ui: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _titleText: TextBlock;
  private _objectivePanel: StackPanel;
  private _hideTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    this._container = new Rectangle('phaseOverlayContainer');
    this._container.width = '100%';
    this._container.height = '100%';
    this._container.background = '#000000dd';
    this._container.thickness = 0;
    this._container.isVisible = false;
    this._container.zIndex = 200;
    this._ui.addControl(this._container);

    this._titleText = new TextBlock('phaseOverlayTitle');
    this._titleText.text = '';
    this._titleText.color = COLORS.TEXT_PRIMARY;
    this._titleText.fontSize = 32;
    this._titleText.fontFamily = UI.FONT_FAMILY;
    this._titleText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this._titleText.top = '-60px';
    this._container.addControl(this._titleText);

    const subtitleText = new TextBlock('phaseOverlaySubtitle');
    subtitleText.text = '── OBJECTIVES ──';
    subtitleText.color = COLORS.TEXT_SECONDARY;
    subtitleText.fontSize = 14;
    subtitleText.fontFamily = UI.FONT_FAMILY;
    subtitleText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    subtitleText.top = '-20px';
    this._container.addControl(subtitleText);

    this._objectivePanel = new StackPanel('phaseObjectives');
    this._objectivePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this._objectivePanel.top = '20px';
    this._objectivePanel.width = '400px';
    this._container.addControl(this._objectivePanel);

    const continueText = new TextBlock('phaseContinue');
    continueText.text = 'Press any key to continue...';
    continueText.color = COLORS.TEXT_SECONDARY;
    continueText.fontSize = 12;
    continueText.fontFamily = UI.FONT_FAMILY;
    continueText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    continueText.paddingBottom = '40px';
    this._container.addControl(continueText);
  }

  show(phase: GamePhase, onDismiss?: () => void): void {
    const info = PHASE_INFO[phase];
    if (!info) return;

    this._titleText.text = info.title;

    // Clear objectives
    const children = this._objectivePanel.children.slice();
    for (const child of children) {
      this._objectivePanel.removeControl(child);
    }

    // Add objectives
    for (const obj of info.objectives) {
      const line = new TextBlock();
      line.text = `• ${obj}`;
      line.color = COLORS.TEXT_WHITE;
      line.fontSize = 14;
      line.fontFamily = UI.FONT_FAMILY;
      line.height = '24px';
      line.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      line.resizeToFit = true;
      this._objectivePanel.addControl(line);
    }

    this._container.isVisible = true;

    // Auto-hide after delay OR on key press
    const dismiss = () => {
      this.hide();
      if (onDismiss) onDismiss();
      document.removeEventListener('keydown', keyHandler);
    };

    const keyHandler = () => dismiss();

    // Slight delay before allowing key dismiss (prevent accidental skip)
    setTimeout(() => {
      document.addEventListener('keydown', keyHandler, { once: true });
    }, 500);

    // Auto-dismiss after transition delay
    this._hideTimeout = setTimeout(dismiss, TIMING.PHASE_TRANSITION_DELAY + 2000);
  }

  hide(): void {
    this._container.isVisible = false;
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }
  }

  get isVisible(): boolean {
    return this._container.isVisible;
  }
}
