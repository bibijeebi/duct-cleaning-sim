import { Scene } from '@babylonjs/core';

export class PressureWashSystem {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  init(): void {
    // TODO: Grill cleaning sub-task
  }

  dispose(): void {
    // TODO: Clean up
  }
}
