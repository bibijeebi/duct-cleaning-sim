import { Scene } from '@babylonjs/core';

export interface RoomConfig {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  type: 'office' | 'hallway' | 'mechanical' | 'lobby' | 'restroom';
}

export interface BuildingConfig {
  rooms: RoomConfig[];
  wallHeight: number;
  ceilingHeight: number;
}

export class BuildingGenerator {
  private _scene: Scene;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  generate(_config: BuildingConfig): void {
    // TODO: Procedural commercial building floor
  }

  dispose(): void {
    // TODO: Clean up generated meshes
  }
}
