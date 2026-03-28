import { AdvancedDynamicTexture } from '@babylonjs/gui';

export class ScoreCard {
  private _ui: AdvancedDynamicTexture;

  constructor(ui: AdvancedDynamicTexture) {
    this._ui = ui;
  }

  show(): void {
    // TODO: End-of-job report
  }

  hide(): void {
    // TODO: Hide scorecard
  }
}
