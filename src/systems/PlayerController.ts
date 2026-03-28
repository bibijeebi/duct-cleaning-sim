import { Scene, FreeCamera } from '@babylonjs/core';

export class PlayerController {
  private _scene: Scene;
  private _camera: FreeCamera | null = null;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  init(): void {
    // TODO: FPS movement, pointer lock, interaction raycasting
  }

  dispose(): void {
    // TODO: Clean up
  }

  get camera(): FreeCamera | null {
    return this._camera;
  }
}
