import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';

/**
 * Creates simple 3D representations of equipment items for display near the van.
 */
export class EquipmentModel {
  private _scene: Scene;
  mesh: Mesh | null = null;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  createModel(type: string, position: Vector3): Mesh | null {
    const mat = new StandardMaterial(`mat_model_${type}`, this._scene);

    switch (type) {
      case 'agitation-wand': {
        // Long thin cylinder
        const wand = MeshBuilder.CreateCylinder(`model_${type}`, {
          height: 1.5, diameter: 0.04,
        }, this._scene);
        wand.position = position;
        wand.rotation.z = Math.PI / 2;
        mat.diffuseColor = new Color3(0.7, 0.7, 0.7);
        wand.material = mat;
        this.mesh = wand;
        return wand;
      }
      case 'portable-vacuum': {
        const vac = MeshBuilder.CreateCylinder(`model_${type}`, {
          height: 0.5, diameter: 0.35,
        }, this._scene);
        vac.position = position;
        mat.diffuseColor = new Color3(0.3, 0.3, 0.8);
        vac.material = mat;
        this.mesh = vac;
        return vac;
      }
      case 'negative-air': {
        const nag = MeshBuilder.CreateBox(`model_${type}`, {
          width: 0.6, height: 0.5, depth: 0.8,
        }, this._scene);
        nag.position = position;
        mat.diffuseColor = new Color3(0.6, 0.2, 0.2);
        nag.material = mat;
        this.mesh = nag;
        return nag;
      }
      case 'pressure-washer': {
        const pw = MeshBuilder.CreateBox(`model_${type}`, {
          width: 0.4, height: 0.6, depth: 0.5,
        }, this._scene);
        pw.position = position;
        mat.diffuseColor = new Color3(0.8, 0.6, 0.1);
        pw.material = mat;
        this.mesh = pw;
        return pw;
      }
      default: {
        // Generic small box for other tools
        const box = MeshBuilder.CreateBox(`model_${type}`, {
          width: 0.15, height: 0.15, depth: 0.15,
        }, this._scene);
        box.position = position;
        mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
        box.material = mat;
        this.mesh = box;
        return box;
      }
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }
  }
}
