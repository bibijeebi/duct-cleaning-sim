import { AdvancedDynamicTexture } from '@babylonjs/gui';

export class HUD {
  private _ui: AdvancedDynamicTexture;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;
  }

  init(): void {
    // TODO: Task list, score, current tool overlay
  }

  update(): void {
    // TODO: Update HUD elements
  }

  dispose(): void {
    // TODO: Clean up
  }
}
