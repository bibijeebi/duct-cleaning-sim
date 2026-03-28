import { Scene } from '@babylonjs/core';

export type DuctMaterial = 'rigid' | 'flex' | 'ductboard';

export interface DuctSection {
  id: string;
  material: DuctMaterial;
  debrisLevel: number;
  cleaned: boolean;
  type: 'trunk' | 'branch' | 'supply' | 'return';
}

export class DuctNetwork {
  private _scene: Scene;
  sections: DuctSection[] = [];

  constructor(scene: Scene) {
    this._scene = scene;
  }

  generate(): void {
    // TODO: Duct layout generation (trunk, branches, VAVs)
  }

  dispose(): void {
    // TODO: Clean up
  }
}
