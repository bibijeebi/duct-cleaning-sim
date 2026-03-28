import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  StackPanel,
  Control,
  Ellipse,
} from '@babylonjs/gui';
import { GameState, GamePhase, GameTask } from '../systems/GameState';
import { EquipmentSystem } from '../systems/EquipmentSystem';
import { COLORS, UI } from '../utils/constants';

export class HUD {
  private _ui: AdvancedDynamicTexture;
  private _gameState: GameState;
  private _equipSystem: EquipmentSystem;

  // UI elements
  private _phaseText: TextBlock;
  private _scoreText: TextBlock;
  private _timerText: TextBlock;
  private _taskPanel: StackPanel;
  private _taskContainer: Rectangle;
  private _toolIndicator: TextBlock;
  private _toolBg: Rectangle;
  private _promptText: TextBlock;
  private _crosshair: Ellipse;
  private _crosshairInner: Ellipse;
  private _messageText: TextBlock;
  private _messageTimeout: ReturnType<typeof setTimeout> | null = null;

  private _taskLabels: TextBlock[] = [];

  constructor(
    ui: AdvancedDynamicTexture,
    gameState: GameState,
    equipSystem: EquipmentSystem
  ) {
    this._ui = ui;
    this._gameState = gameState;
    this._equipSystem = equipSystem;

    // --- Phase display (top center) ---
    this._phaseText = new TextBlock('hud_phase');
    this._phaseText.text = 'PHASE: PRE-JOB';
    this._phaseText.color = COLORS.TEXT_PRIMARY;
    this._phaseText.fontSize = 18;
    this._phaseText.fontFamily = UI.FONT_FAMILY;
    this._phaseText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._phaseText.paddingTop = '10px';
    this._phaseText.outlineWidth = 2;
    this._phaseText.outlineColor = '#000000';
    this._ui.addControl(this._phaseText);

    // --- Timer (top left) ---
    this._timerText = new TextBlock('hud_timer');
    this._timerText.text = '00:00';
    this._timerText.color = COLORS.TEXT_SECONDARY;
    this._timerText.fontSize = 16;
    this._timerText.fontFamily = UI.FONT_FAMILY;
    this._timerText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._timerText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._timerText.paddingTop = '10px';
    this._timerText.paddingLeft = '15px';
    this._ui.addControl(this._timerText);

    // --- Score (top right) ---
    this._scoreText = new TextBlock('hud_score');
    this._scoreText.text = 'SCORE: 100';
    this._scoreText.color = COLORS.TEXT_PRIMARY;
    this._scoreText.fontSize = 16;
    this._scoreText.fontFamily = UI.FONT_FAMILY;
    this._scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._scoreText.paddingTop = '10px';
    this._scoreText.paddingRight = '15px';
    this._ui.addControl(this._scoreText);

    // --- Task checklist (right side) ---
    this._taskContainer = new Rectangle('hud_taskContainer');
    this._taskContainer.width = '260px';
    this._taskContainer.height = '300px';
    this._taskContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._taskContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._taskContainer.top = '35px';
    this._taskContainer.left = '-10px';
    this._taskContainer.background = '#00000088';
    this._taskContainer.cornerRadius = 4;
    this._taskContainer.thickness = 1;
    this._taskContainer.color = '#333333';
    this._ui.addControl(this._taskContainer);

    const taskTitle = new TextBlock('hud_taskTitle');
    taskTitle.text = 'TASKS';
    taskTitle.color = COLORS.TEXT_PRIMARY;
    taskTitle.fontSize = 12;
    taskTitle.fontFamily = UI.FONT_FAMILY;
    taskTitle.height = '20px';
    taskTitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    taskTitle.paddingTop = '5px';
    this._taskContainer.addControl(taskTitle);

    this._taskPanel = new StackPanel('hud_taskPanel');
    this._taskPanel.width = '240px';
    this._taskPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._taskPanel.paddingTop = '25px';
    this._taskContainer.addControl(this._taskPanel);

    // --- Crosshair (center) ---
    this._crosshair = new Ellipse('hud_crosshair');
    this._crosshair.width = '16px';
    this._crosshair.height = '16px';
    this._crosshair.color = COLORS.TEXT_PRIMARY;
    this._crosshair.thickness = 1;
    this._crosshair.background = 'transparent';
    this._ui.addControl(this._crosshair);

    this._crosshairInner = new Ellipse('hud_crosshairDot');
    this._crosshairInner.width = '4px';
    this._crosshairInner.height = '4px';
    this._crosshairInner.background = COLORS.TEXT_PRIMARY;
    this._crosshairInner.thickness = 0;
    this._ui.addControl(this._crosshairInner);

    // --- Interaction prompt (below center) ---
    this._promptText = new TextBlock('hud_prompt');
    this._promptText.text = '';
    this._promptText.color = COLORS.TEXT_WHITE;
    this._promptText.fontSize = 14;
    this._promptText.fontFamily = UI.FONT_FAMILY;
    this._promptText.top = '50px';
    this._promptText.isVisible = false;
    this._promptText.outlineWidth = 1;
    this._promptText.outlineColor = '#000000';
    this._ui.addControl(this._promptText);

    // --- Current tool indicator (bottom center) ---
    this._toolBg = new Rectangle('hud_toolBg');
    this._toolBg.width = '300px';
    this._toolBg.height = '35px';
    this._toolBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._toolBg.top = '-50px';
    this._toolBg.background = '#000000aa';
    this._toolBg.cornerRadius = 4;
    this._toolBg.thickness = 1;
    this._toolBg.color = '#444444';
    this._ui.addControl(this._toolBg);

    this._toolIndicator = new TextBlock('hud_tool');
    this._toolIndicator.text = 'No Tool';
    this._toolIndicator.color = COLORS.TEXT_SECONDARY;
    this._toolIndicator.fontSize = 13;
    this._toolIndicator.fontFamily = UI.FONT_FAMILY;
    this._toolBg.addControl(this._toolIndicator);

    // --- Message/notification area (bottom center, above tool) ---
    this._messageText = new TextBlock('hud_message');
    this._messageText.text = '';
    this._messageText.color = COLORS.TEXT_PRIMARY;
    this._messageText.fontSize = 14;
    this._messageText.fontFamily = UI.FONT_FAMILY;
    this._messageText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._messageText.top = '-90px';
    this._messageText.isVisible = false;
    this._messageText.outlineWidth = 1;
    this._messageText.outlineColor = '#000000';
    this._ui.addControl(this._messageText);

    // Subscribe to events
    this._gameState.onPhaseChange.add((phase) => this._updatePhase(phase));
    this._gameState.onScoreChange.add((score) => this._updateScore(score));
    this._gameState.onTaskComplete.add(() => this._updateTasks());
    this._equipSystem.onActiveToolChange.add((tool) => {
      this._toolIndicator.text = tool ? `[${this._equipSystem.activeSlotIndex + 1}] ${tool.name}` : 'No Tool';
      this._toolIndicator.color = tool ? COLORS.TEXT_WHITE : COLORS.TEXT_SECONDARY;
    });

    // Initial render
    this._updateTasks();
  }

  private _updatePhase(phase: GamePhase): void {
    this._phaseText.text = `PHASE: ${phase.replace('_', '-')}`;
    this._updateTasks();
  }

  private _updateScore(score: number): void {
    this._scoreText.text = `SCORE: ${score}`;
    if (score < 50) {
      this._scoreText.color = COLORS.TEXT_DANGER;
    } else if (score < 75) {
      this._scoreText.color = '#FFAA44';
    } else {
      this._scoreText.color = COLORS.TEXT_PRIMARY;
    }
  }

  _updateTasks(): void {
    // Clear existing
    for (const label of this._taskLabels) {
      this._taskPanel.removeControl(label);
    }
    this._taskLabels = [];

    const tasks = this._gameState.currentPhaseTasks;
    for (const task of tasks) {
      const label = new TextBlock(`task_${task.id}`);
      label.text = `${task.completed ? '[x]' : '[ ]'} ${task.description}`;
      label.color = task.completed ? '#66AA66' : COLORS.TEXT_WHITE;
      label.fontSize = 11;
      label.fontFamily = UI.FONT_FAMILY;
      label.height = '18px';
      label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      label.paddingLeft = '10px';
      label.resizeToFit = true;
      this._taskPanel.addControl(label);
      this._taskLabels.push(label);
    }
  }

  /**
   * Update the timer display. Call from render loop.
   */
  updateTimer(): void {
    const secs = this._gameState.elapsedSeconds;
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    this._timerText.text = `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Set crosshair to active (green) when hovering interactive target.
   */
  setCrosshairActive(active: boolean): void {
    const color = active ? COLORS.TEXT_SUCCESS : COLORS.TEXT_PRIMARY;
    this._crosshair.color = color;
    this._crosshairInner.background = color;
  }

  /**
   * Show interaction prompt text.
   */
  showPrompt(text: string): void {
    this._promptText.text = text;
    this._promptText.isVisible = true;
  }

  /**
   * Hide interaction prompt.
   */
  hidePrompt(): void {
    this._promptText.isVisible = false;
  }

  /**
   * Show a temporary notification message.
   */
  showMessage(text: string, durationMs: number = 3000): void {
    this._messageText.text = text;
    this._messageText.isVisible = true;
    if (this._messageTimeout) clearTimeout(this._messageTimeout);
    this._messageTimeout = setTimeout(() => {
      this._messageText.isVisible = false;
    }, durationMs);
  }

  /**
   * Show inventory slots at bottom.
   */
  updateInventoryDisplay(): void {
    const inv = this._equipSystem.inventory;
    const active = this._equipSystem.activeSlotIndex;
    if (inv.length === 0) {
      this._toolIndicator.text = 'No Tool';
      this._toolIndicator.color = COLORS.TEXT_SECONDARY;
      return;
    }
    const parts = inv.map((slot, i) => {
      const marker = i === active ? '>' : ' ';
      return `${marker}[${i + 1}] ${slot.equipment.name}${slot.quantity > 1 ? ` x${slot.quantity}` : ''}`;
    });
    this._toolIndicator.text = parts.join('  ');
    this._toolIndicator.color = COLORS.TEXT_WHITE;
  }

  dispose(): void {
    if (this._messageTimeout) clearTimeout(this._messageTimeout);
  }
}
