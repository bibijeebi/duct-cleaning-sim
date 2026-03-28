import { Scene, AbstractMesh, Observable } from '@babylonjs/core';
import { DuctNetwork, DuctSection, RegisterInfo } from '../models/DuctNetwork';
import { BuildingConfig } from '../models/BuildingGenerator';
import { DuctMaterialType, getToolMaterialResult } from '../data/equipment';
import { GameState } from './GameState';

export interface HVACInteractionEvent {
  type: 'register_remove' | 'register_reinstall' | 'register_identify'
    | 'duct_inspect' | 'air_handler_door' | 'coil_clean' | 'filter_replace';
  targetId: string;
  success: boolean;
  message: string;
}

export class HVACSystem {
  private _scene: Scene;
  private _ductNetwork: DuctNetwork;
  private _registersIdentifiedFirstPass: boolean = false;
  private _supplyCleanedBeforeReturn: boolean = false;

  onInteraction: Observable<HVACInteractionEvent> = new Observable();

  constructor(scene: Scene) {
    this._scene = scene;
    this._ductNetwork = new DuctNetwork(scene);
  }

  get ductNetwork(): DuctNetwork {
    return this._ductNetwork;
  }

  /**
   * Initialize the HVAC system for a given building config.
   */
  init(config: BuildingConfig, ductMaterial: DuctMaterialType = 'rigid'): void {
    this._ductNetwork.generate(config, ductMaterial);
  }

  /**
   * Handle interaction with an HVAC-related mesh.
   * Returns true if the mesh was handled.
   */
  handleInteraction(mesh: AbstractMesh, currentToolId: string | null): boolean {
    const name = mesh.name;

    // Air handler door
    if (name === 'air_handler_door') {
      this._ductNetwork.toggleAirHandlerDoor();
      this.onInteraction.notifyObservers({
        type: 'air_handler_door',
        targetId: 'air_handler',
        success: true,
        message: this._ductNetwork.airHandler.doorOpen ? 'Air handler door opened.' : 'Air handler door closed.',
      });
      return true;
    }

    // Air handler body
    if (name === 'air_handler_body') {
      // Open door if closed
      if (!this._ductNetwork.airHandler.doorOpen) {
        this._ductNetwork.toggleAirHandlerDoor();
        this.onInteraction.notifyObservers({
          type: 'air_handler_door',
          targetId: 'air_handler',
          success: true,
          message: 'Air handler door opened.',
        });
      }
      return true;
    }

    // Coil cleaning
    if (name === 'coil_evaporator') {
      if (currentToolId === 'coil-cleaner') {
        this._ductNetwork.airHandler.coilsCleaned = true;
        this.onInteraction.notifyObservers({
          type: 'coil_clean',
          targetId: 'coil',
          success: true,
          message: 'Coils cleaned with coil cleaner spray.',
        });
        const gs = GameState.getInstance();
        gs.completeTask('clean-coils');
      } else {
        this.onInteraction.notifyObservers({
          type: 'coil_clean',
          targetId: 'coil',
          success: false,
          message: 'Need coil cleaner spray to clean coils.',
        });
      }
      return true;
    }

    // Filter replacement
    if (name === 'filter_slot') {
      this._ductNetwork.airHandler.filterReplaced = true;
      this.onInteraction.notifyObservers({
        type: 'filter_replace',
        targetId: 'filter',
        success: true,
        message: 'Filter replaced.',
      });
      const gs = GameState.getInstance();
      gs.completeTask('replace-filters');
      return true;
    }

    // Supply register interaction
    if (name.startsWith('register_supply')) {
      return this._handleRegisterInteraction(name, currentToolId);
    }

    // Return grill interaction
    if (name.startsWith('grill_return')) {
      return this._handleRegisterInteraction(name, currentToolId);
    }

    // Duct inspection/cleaning
    if (name.startsWith('duct_')) {
      return this._handleDuctInteraction(name, currentToolId);
    }

    return false;
  }

  private _handleRegisterInteraction(meshName: string, _currentToolId: string | null): boolean {
    const reg = this._ductNetwork.getRegisterByMeshName(meshName);
    if (!reg) return false;

    if (!reg.identified) {
      // First interaction: identify the register
      this._ductNetwork.identifyRegister(reg.id);
      this.onInteraction.notifyObservers({
        type: 'register_identify',
        targetId: reg.id,
        success: true,
        message: `${reg.type === 'supply' ? 'Supply register' : 'Return grill'} identified.`,
      });

      // Check if all identified on first pass
      if (this._ductNetwork.identifiedCount === this._ductNetwork.registers.length) {
        if (!this._registersIdentifiedFirstPass) {
          this._registersIdentifiedFirstPass = true;
          const gs = GameState.getInstance();
          gs.completeTask('count-registers');
        }
      }
      return true;
    }

    // Toggle remove/reinstall
    if (reg.installed) {
      this._ductNetwork.removeRegister(reg.id);
      this.onInteraction.notifyObservers({
        type: 'register_remove',
        targetId: reg.id,
        success: true,
        message: `${reg.type === 'supply' ? 'Supply register' : 'Return grill'} removed.`,
      });
    } else {
      this._ductNetwork.reinstallRegister(reg.id);
      this.onInteraction.notifyObservers({
        type: 'register_reinstall',
        targetId: reg.id,
        success: true,
        message: `${reg.type === 'supply' ? 'Supply register' : 'Return grill'} reinstalled.`,
      });

      // Check if all reinstalled
      if (this._ductNetwork.allRegistersInstalled) {
        const gs = GameState.getInstance();
        gs.completeTask('reinstall-registers');
      }
    }
    return true;
  }

  private _handleDuctInteraction(meshName: string, currentToolId: string | null): boolean {
    const section = this._ductNetwork.getSectionByMeshName(meshName);
    if (!section) return false;

    // If player has agitation wand, attempt cleaning
    if (currentToolId === 'agitation-wand') {
      const result = getToolMaterialResult('agitation-wand', section.material);
      if (!result.success) {
        // Wrong tool for material — apply penalty
        const gs = GameState.getInstance();
        gs.applyDeduction(result.penalty, result.message);
      }

      // Check ordering: supply before return is wrong
      if ((section.type === 'supply' || section.type === 'branch' || section.type === 'trunk')
        && !this._ductNetwork.allReturnsCleaned) {
        if (!this._supplyCleanedBeforeReturn) {
          this._supplyCleanedBeforeReturn = true;
          const gs = GameState.getInstance();
          gs.applyDeduction(15, 'Wrong cleaning order: supply before return');
        }
      }

      this._ductNetwork.cleanSection(section.id, 0.3);
      this.onInteraction.notifyObservers({
        type: 'duct_inspect',
        targetId: section.id,
        success: true,
        message: `Cleaning ${section.id} - debris: ${(section.debrisLevel * 100).toFixed(0)}%`,
      });

      // Check completion
      this._checkCleaningCompletion();
      return true;
    }

    // Default: inspect
    this.onInteraction.notifyObservers({
      type: 'duct_inspect',
      targetId: section.id,
      success: true,
      message: `Duct: ${section.material} ${section.type}, debris: ${(section.debrisLevel * 100).toFixed(0)}%`,
    });
    return true;
  }

  private _checkCleaningCompletion(): void {
    const gs = GameState.getInstance();
    if (this._ductNetwork.allReturnsCleaned) {
      gs.completeTask('clean-returns');
    }
    if (this._ductNetwork.allSupplyCleaned) {
      gs.completeTask('clean-supply');
    }
  }

  /**
   * Show airflow direction visualization.
   */
  showAirflow(): void {
    this._ductNetwork.showAirflowArrows();
  }

  /**
   * Hide airflow visualization.
   */
  hideAirflow(): void {
    this._ductNetwork.hideAirflowArrows();
  }

  dispose(): void {
    this.onInteraction.clear();
    this._ductNetwork.dispose();
  }
}
