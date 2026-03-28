import { Scene } from '@babylonjs/core';

export class BuildingScene {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  load(): void {
    // TODO: Load 3D walkable environment
  }

  dispose(): void {
    // TODO: Clean up scene
  }
}
