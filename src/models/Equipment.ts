import { Scene, Mesh } from '@babylonjs/core';

export class EquipmentModel {
  private _scene: Scene;
  mesh: Mesh | null = null;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  createModel(_type: string): Mesh | null {
    // TODO: 3D representations of tools/equipment
    return null;
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
    }
  }
}
