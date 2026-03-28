import { Scene } from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { COLORS, UI } from '../utils/constants';

export interface MainMenuOptions {
  scenarioId: string;
  tutorialEnabled: boolean;
}

export class MainMenu {
  private _scene: Scene;
  private _ui: AdvancedDynamicTexture;
  private _container: Rectangle;
  private _tutorialEnabled: boolean = true;
  private _onStart: ((options: MainMenuOptions) => void) | null = null;

  constructor(scene: Scene, ui: AdvancedDynamicTexture) {
    this._scene = scene;
    this._ui = ui;

    // Full screen overlay
    this._container = new Rectangle('mainMenuContainer');
    this._container.width = '100%';
    this._container.height = '100%';
    this._container.background = '#0a0a0aee';
    this._container.thickness = 0;
    this._container.zIndex = 500;
    this._container.isVisible = false;
    this._ui.addControl(this._container);

    // Title
    const title = new TextBlock('menuTitle');
    title.text = 'DUCT CLEANING\nSIMULATOR';
    title.color = COLORS.TEXT_PRIMARY;
    title.fontSize = 42;
    title.fontFamily = UI.FONT_FAMILY;
    title.lineSpacing = '8px';
    title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.paddingTop = '80px';
    this._container.addControl(title);

    // Subtitle
    const subtitle = new TextBlock('menuSubtitle');
    subtitle.text = 'Carolina Quality Air Training System';
    subtitle.color = COLORS.TEXT_SECONDARY;
    subtitle.fontSize = 14;
    subtitle.fontFamily = UI.FONT_FAMILY;
    subtitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    subtitle.paddingTop = '190px';
    this._container.addControl(subtitle);

    // Button panel
    const btnPanel = new StackPanel('menuBtnPanel');
    btnPanel.width = '300px';
    btnPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    btnPanel.top = '40px';
    this._container.addControl(btnPanel);

    // Start Scenario 1
    const startBtn = this._createMenuButton('START: Commercial Office', '#FFD700');
    startBtn.onPointerUpObservable.add(() => {
      this._startScenario('commercial-office');
    });
    btnPanel.addControl(startBtn);

    // Tutorial toggle
    const tutBtn = this._createMenuButton('[x] Tutorial Mode', '#AAAAAA');
    tutBtn.onPointerUpObservable.add(() => {
      this._tutorialEnabled = !this._tutorialEnabled;
      const tb = tutBtn.children[0] as TextBlock;
      if (tb) {
        tb.text = `${this._tutorialEnabled ? '[x]' : '[ ]'} Tutorial Mode`;
      }
    });
    btnPanel.addControl(tutBtn);

    // Controls info
    const controls = new TextBlock('menuControls');
    controls.text = 'WASD: Move | Mouse: Look | E: Interact\n1-4: Tools | Tab: Cycle | Q: Drop | N: Next Phase\nF: Airflow | M: Mute';
    controls.color = COLORS.TEXT_SECONDARY;
    controls.fontSize = 11;
    controls.fontFamily = UI.FONT_FAMILY;
    controls.lineSpacing = '4px';
    controls.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    controls.paddingBottom = '40px';
    this._container.addControl(controls);
  }

  private _createMenuButton(text: string, color: string): Button {
    const btn = Button.CreateSimpleButton(`menuBtn_${text}`, text);
    btn.width = '300px';
    btn.height = '45px';
    btn.color = color;
    btn.fontSize = 15;
    btn.fontFamily = UI.FONT_FAMILY;
    btn.background = '#222222';
    btn.cornerRadius = 4;
    btn.thickness = 1;
    btn.paddingTop = '5px';
    btn.paddingBottom = '5px';
    return btn;
  }

  private _startScenario(scenarioId: string): void {
    this.hide();
    if (this._onStart) {
      this._onStart({
        scenarioId,
        tutorialEnabled: this._tutorialEnabled,
      });
    }
  }

  show(onStart?: (options: MainMenuOptions) => void): void {
    this._container.isVisible = true;
    if (onStart) this._onStart = onStart;
  }

  hide(): void {
    this._container.isVisible = false;
  }

  get isVisible(): boolean {
    return this._container.isVisible;
  }
}
