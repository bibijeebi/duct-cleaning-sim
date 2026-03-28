import { Scene, Observable, AbstractMesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import { EQUIPMENT, EquipmentDef, getToolMaterialResult, DuctMaterialType } from '../data/equipment';
import { GameState } from './GameState';

export interface InventorySlot {
  equipment: EquipmentDef;
  quantity: number;
}

export interface EquipmentInteractionEvent {
  type: 'equip' | 'unequip' | 'use' | 'wrong_tool';
  equipmentId: string;
  message: string;
}

export class EquipmentSystem {
  private _scene: Scene;
  private _loadout: Set<string> = new Set(); // equipment IDs selected from van
  private _inventory: InventorySlot[] = []; // currently carried (max 4)
  private _activeSlot: number = 0; // 0-3
  private _vanEquipmentMeshes: AbstractMesh[] = [];
  private _maxCarry: number = 4;

  onEquipmentChange: Observable<EquipmentInteractionEvent> = new Observable();
  onActiveToolChange: Observable<EquipmentDef | null> = new Observable();
  onLoadoutChange: Observable<string[]> = new Observable();

  constructor(scene: Scene) {
    this._scene = scene;
  }

  /**
   * Create visual equipment items near the van, organized in rows by category.
   * Items laid out behind the van in neat rows.
   */
  createVanEquipment(vanPosition: Vector3): void {
    const categories = [...new Set(EQUIPMENT.map(e => e.category))];
    let rowZ = 0; // each category gets a row

    for (const cat of categories) {
      const items = EQUIPMENT.filter(e => e.category === cat);
      let colX = 0;

      for (const item of items) {
        const size = item.portable ? 0.2 : 0.35;
        const mesh = MeshBuilder.CreateBox(`equipment_${item.id}`, {
          width: size,
          height: size,
          depth: size,
        }, this._scene);
        // Place behind the van in organized rows
        mesh.position = new Vector3(
          vanPosition.x - 2.5 + colX * 0.55,
          size / 2,
          vanPosition.z + 3.5 + rowZ * 0.6
        );

        const mat = new StandardMaterial(`mat_equip_${item.id}`, this._scene);
        mat.diffuseColor = this._getCategoryColor(item.category);
        mat.specularColor = new Color3(0.15, 0.15, 0.15);
        mesh.material = mat;
        mesh.metadata = {
          interactive: true,
          label: item.name,
          equipmentId: item.id,
        };

        this._vanEquipmentMeshes.push(mesh);
        colX++;
        if (colX > 8) {
          colX = 0;
          rowZ++;
        }
      }
      rowZ++;
    }
  }

  private _getCategoryColor(category: string): Color3 {
    switch (category) {
      case 'vacuum': return new Color3(0.3, 0.5, 0.8);
      case 'agitation': return new Color3(0.8, 0.4, 0.2);
      case 'cutting': return new Color3(0.7, 0.7, 0.3);
      case 'patching': return new Color3(0.5, 0.7, 0.5);
      case 'cleaning': return new Color3(0.3, 0.7, 0.8);
      case 'protection': return new Color3(0.8, 0.8, 0.2);
      case 'misc': return new Color3(0.6, 0.6, 0.6);
      default: return new Color3(0.5, 0.5, 0.5);
    }
  }

  /**
   * Toggle an equipment item in the loadout (van selection).
   */
  toggleLoadoutItem(equipmentId: string): boolean {
    const def = EQUIPMENT.find(e => e.id === equipmentId);
    if (!def) return false;

    if (this._loadout.has(equipmentId)) {
      this._loadout.delete(equipmentId);
    } else {
      this._loadout.add(equipmentId);
    }
    this.onLoadoutChange.notifyObservers([...this._loadout]);
    return true;
  }

  /**
   * Select all equipment.
   */
  selectAllLoadout(): void {
    for (const item of EQUIPMENT) {
      this._loadout.add(item.id);
    }
    this.onLoadoutChange.notifyObservers([...this._loadout]);
  }

  /**
   * Confirm loadout selection.
   */
  confirmLoadout(): void {
    const gs = GameState.getInstance();
    gs.completeTask('select-equipment');
  }

  isInLoadout(equipmentId: string): boolean {
    return this._loadout.has(equipmentId);
  }

  get loadoutItems(): string[] {
    return [...this._loadout];
  }

  /**
   * Pick up an equipment item into inventory. Max 4 carried.
   */
  pickUp(equipmentId: string): boolean {
    if (!this._loadout.has(equipmentId)) {
      const gs = GameState.getInstance();
      gs.applyDeduction(5, `Forgot ${equipmentId} in van`);
      return false;
    }

    if (this._inventory.length >= this._maxCarry) {
      return false;
    }

    const def = EQUIPMENT.find(e => e.id === equipmentId);
    if (!def) return false;

    const existing = this._inventory.find(s => s.equipment.id === equipmentId);
    if (existing) {
      existing.quantity++;
    } else {
      this._inventory.push({ equipment: def, quantity: 1 });
    }

    this.onEquipmentChange.notifyObservers({
      type: 'equip',
      equipmentId,
      message: `Picked up ${def.name}`,
    });
    this.onActiveToolChange.notifyObservers(this.activeTool);
    return true;
  }

  /**
   * Drop current tool.
   */
  dropCurrent(): boolean {
    if (this._inventory.length === 0) return false;

    const slot = this._inventory[this._activeSlot];
    if (!slot) return false;

    const name = slot.equipment.name;
    if (slot.quantity > 1) {
      slot.quantity--;
    } else {
      this._inventory.splice(this._activeSlot, 1);
      if (this._activeSlot >= this._inventory.length) {
        this._activeSlot = Math.max(0, this._inventory.length - 1);
      }
    }

    this.onEquipmentChange.notifyObservers({
      type: 'unequip',
      equipmentId: slot.equipment.id,
      message: `Dropped ${name}`,
    });
    this.onActiveToolChange.notifyObservers(this.activeTool);
    return true;
  }

  /**
   * Switch active tool by slot number (1-4 keys → index 0-3).
   */
  switchToSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this._inventory.length) {
      this._activeSlot = slotIndex;
      this.onActiveToolChange.notifyObservers(this.activeTool);
    }
  }

  cycleNext(): void {
    if (this._inventory.length === 0) return;
    this._activeSlot = (this._activeSlot + 1) % this._inventory.length;
    this.onActiveToolChange.notifyObservers(this.activeTool);
  }

  get activeTool(): EquipmentDef | null {
    if (this._inventory.length === 0) return null;
    return this._inventory[this._activeSlot]?.equipment ?? null;
  }

  get activeToolId(): string | null {
    return this.activeTool?.id ?? null;
  }

  get activeSlotIndex(): number {
    return this._activeSlot;
  }

  get inventory(): ReadonlyArray<InventorySlot> {
    return this._inventory;
  }

  get loadoutSize(): number {
    return this._loadout.size;
  }

  checkToolMaterialCompat(toolId: string, material: DuctMaterialType): ReturnType<typeof getToolMaterialResult> {
    return getToolMaterialResult(toolId, material);
  }

  /**
   * Handle interaction with an equipment mesh near the van.
   */
  handleEquipmentInteraction(mesh: AbstractMesh): boolean {
    const equipId = mesh.metadata?.equipmentId as string | undefined;
    if (!equipId) return false;
    this.toggleLoadoutItem(equipId);
    return true;
  }

  dispose(): void {
    this.onEquipmentChange.clear();
    this.onActiveToolChange.clear();
    this.onLoadoutChange.clear();
    for (const mesh of this._vanEquipmentMeshes) {
      mesh.dispose();
    }
    this._vanEquipmentMeshes = [];
  }
}
