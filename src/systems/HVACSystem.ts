import { Scene } from '@babylonjs/core';

export class HVACSystem {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  init(): void {
    // TODO: Duct network model, airflow direction, debris state
  }

  dispose(): void {
    // TODO: Clean up
  }
}
