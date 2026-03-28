import { Scene } from '@babylonjs/core';

export class DuctCrossSection {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  show(): void {
    // TODO: 2D overlay for inside-duct cleaning view
  }

  hide(): void {
    // TODO: Hide overlay
  }
}
