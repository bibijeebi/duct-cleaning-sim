import { AdvancedDynamicTexture } from '@babylonjs/gui';

export class PhaseOverlay {
  private _ui: AdvancedDynamicTexture;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;
  }

  show(_phaseName: string): void {
    // TODO: Phase transition screens
  }

  hide(): void {
    // TODO: Hide overlay
  }
}
