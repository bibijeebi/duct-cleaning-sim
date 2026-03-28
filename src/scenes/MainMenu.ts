import { Scene } from '@babylonjs/core';

export class MainMenu {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  show(): void {
    // TODO: Title screen, scenario select
  }

  hide(): void {
    // TODO: Hide menu
  }
}
