import { Scene } from '@babylonjs/core';

export class EquipmentSystem {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  init(): void {
    // TODO: Inventory, tool selection, equipment interaction
  }

  dispose(): void {
    // TODO: Clean up
  }
}
