import { Scene } from '@babylonjs/core';

export class AudioManager {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  playSound(_name: string): void {
    // TODO: Sound effects manager
  }

  stopSound(_name: string): void {
    // TODO: Stop sound
  }

  dispose(): void {
    // TODO: Clean up audio
  }
}
