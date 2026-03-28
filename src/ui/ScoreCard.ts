import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  StackPanel,
  ScrollViewer,
  Control,
} from '@babylonjs/gui';
import { GameState, ScoreEvent } from '../systems/GameState';
import { calculateLetterGrade } from '../data/scoring';
import { COLORS, UI } from '../utils/constants';

export class ScoreCard {
  private _ui: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _gradeText: TextBlock;
  private _scoreText: TextBlock;
  private _timeText: TextBlock;
  private _detailPanel: StackPanel;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;

    this._container = new Rectangle('scoreCardContainer');
    this._container.width = '500px';
    this._container.height = '550px';
    this._container.cornerRadius = 8;
    this._container.color = COLORS.TEXT_PRIMARY;
    this._container.thickness = 2;
    this._container.background = '#1a1a1aee';
    this._container.isVisible = false;
    this._container.zIndex = 300;
    this._ui.addControl(this._container);

    // Header
    const header = new TextBlock('scHeader');
    header.text = '═══ JOB REPORT ═══';
    header.color = COLORS.TEXT_PRIMARY;
    header.fontSize = 22;
    header.fontFamily = UI.FONT_FAMILY;
    header.height = '40px';
    header.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.paddingTop = '15px';
    this._container.addControl(header);

    // Letter grade (big)
    this._gradeText = new TextBlock('scGrade');
    this._gradeText.text = 'A';
    this._gradeText.color = COLORS.TEXT_PRIMARY;
    this._gradeText.fontSize = 64;
    this._gradeText.fontFamily = UI.FONT_FAMILY;
    this._gradeText.height = '80px';
    this._gradeText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._gradeText.top = '50px';
    this._container.addControl(this._gradeText);

    // Score number
    this._scoreText = new TextBlock('scScore');
    this._scoreText.text = 'Final Score: 100';
    this._scoreText.color = COLORS.TEXT_WHITE;
    this._scoreText.fontSize = 18;
    this._scoreText.fontFamily = UI.FONT_FAMILY;
    this._scoreText.height = '30px';
    this._scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._scoreText.top = '130px';
    this._container.addControl(this._scoreText);

    // Time
    this._timeText = new TextBlock('scTime');
    this._timeText.text = 'Time: 00:00';
    this._timeText.color = COLORS.TEXT_SECONDARY;
    this._timeText.fontSize = 14;
    this._timeText.fontFamily = UI.FONT_FAMILY;
    this._timeText.height = '25px';
    this._timeText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._timeText.top = '158px';
    this._container.addControl(this._timeText);

    // Divider
    const divider = new TextBlock('scDivider');
    divider.text = '────────────────────────';
    divider.color = COLORS.TEXT_SECONDARY;
    divider.fontSize = 12;
    divider.fontFamily = UI.FONT_FAMILY;
    divider.height = '20px';
    divider.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    divider.top = '180px';
    this._container.addControl(divider);

    // Scrollable detail panel
    const scroll = new ScrollViewer('scScroll');
    scroll.width = '460px';
    scroll.height = '300px';
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    scroll.top = '200px';
    scroll.barSize = 8;
    scroll.barColor = COLORS.TEXT_PRIMARY;
    this._container.addControl(scroll);

    this._detailPanel = new StackPanel('scDetails');
    this._detailPanel.width = '440px';
    scroll.addControl(this._detailPanel);

    // Dismiss text
    const dismissText = new TextBlock('scDismiss');
    dismissText.text = 'Press ESC to close';
    dismissText.color = COLORS.TEXT_SECONDARY;
    dismissText.fontSize = 11;
    dismissText.fontFamily = UI.FONT_FAMILY;
    dismissText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    dismissText.paddingBottom = '10px';
    this._container.addControl(dismissText);
  }

  show(): void {
    const gs = GameState.getInstance();
    const grade = calculateLetterGrade(gs.score);
    const summary = gs.getScoreSummary();

    // Grade color
    if (gs.score >= 90) {
      this._gradeText.color = '#44FF44';
    } else if (gs.score >= 70) {
      this._gradeText.color = COLORS.TEXT_PRIMARY;
    } else if (gs.score >= 50) {
      this._gradeText.color = '#FFAA44';
    } else {
      this._gradeText.color = COLORS.TEXT_DANGER;
    }

    this._gradeText.text = grade;
    this._scoreText.text = `Final Score: ${gs.score}`;

    const secs = gs.elapsedSeconds;
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    this._timeText.text = `Time: ${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    // Clear details
    const children = this._detailPanel.children.slice();
    for (const child of children) {
      this._detailPanel.removeControl(child);
    }

    // Deductions section
    if (summary.deductions.length > 0) {
      this._addSectionHeader('DEDUCTIONS');
      for (const evt of summary.deductions) {
        this._addDetailLine(`${evt.points} - ${evt.reason}`, COLORS.TEXT_DANGER);
      }
    } else {
      this._addSectionHeader('DEDUCTIONS');
      this._addDetailLine('None! Perfect execution.', '#66AA66');
    }

    // Bonuses section
    if (summary.bonuses.length > 0) {
      this._addSectionHeader('BONUSES');
      for (const evt of summary.bonuses) {
        this._addDetailLine(`+${evt.points} - ${evt.reason}`, '#44FF44');
      }
    }

    // Task completion summary
    this._addSectionHeader('TASKS');
    const completedTasks = gs.tasks.filter(t => t.completed).length;
    const totalTasks = gs.tasks.length;
    this._addDetailLine(`${completedTasks}/${totalTasks} tasks completed`, COLORS.TEXT_WHITE);

    const incomplete = gs.tasks.filter(t => !t.completed && t.required);
    for (const task of incomplete) {
      this._addDetailLine(`  MISSED: ${task.description}`, '#FFAA44');
    }

    this._container.isVisible = true;
  }

  private _addSectionHeader(text: string): void {
    const header = new TextBlock();
    header.text = `── ${text} ──`;
    header.color = COLORS.TEXT_PRIMARY;
    header.fontSize = 13;
    header.fontFamily = UI.FONT_FAMILY;
    header.height = '22px';
    header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.paddingTop = '8px';
    this._detailPanel.addControl(header);
  }

  private _addDetailLine(text: string, color: string): void {
    const line = new TextBlock();
    line.text = text;
    line.color = color;
    line.fontSize = 12;
    line.fontFamily = UI.FONT_FAMILY;
    line.height = '18px';
    line.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    line.resizeToFit = true;
    this._detailPanel.addControl(line);
  }

  hide(): void {
    this._container.isVisible = false;
  }

  get isVisible(): boolean {
    return this._container.isVisible;
  }
}
