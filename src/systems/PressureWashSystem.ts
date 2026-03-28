import {
  Scene,
  Observable,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  AbstractMesh,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { RegisterInfo } from '../models/DuctNetwork';
import { GameState } from './GameState';
import { COLORS, UI } from '../utils/constants';

export interface WashableGrill {
  registerId: string;
  type: 'supply' | 'return';
  cleanliness: number; // 0 = dirty, 1 = clean
  stubborn: boolean; // needs brush combo
  atWashStation: boolean;
}

export interface WashEvent {
  type: 'grill_added' | 'grill_washed' | 'grill_complete' | 'coil_cleaned' | 'setup_step' | 'error';
  targetId: string;
  message: string;
}

type WashSetupStep = 'lay_tarp' | 'connect_hose' | 'check_gas' | 'ready';

export class PressureWashSystem {
  private _scene: Scene;
  private _grills: WashableGrill[] = [];
  private _setupStep: WashSetupStep = 'lay_tarp';
  private _isSetup: boolean = false;
  private _coilsCleaned: boolean = false;

  private _washStationPos: Vector3 = new Vector3(-5, 0, -18); // near exterior/spigot
  private _spigotMesh: Mesh | null = null;
  private _tarpMesh: Mesh | null = null;
  private _washerMesh: Mesh | null = null;
  private _meshes: Mesh[] = [];

  private _washUI: AdvancedDynamicTexture | null = null;
  private _washContainer: Rectangle | null = null;

  onWashEvent: Observable<WashEvent> = new Observable();

  constructor(scene: Scene) {
    this._scene = scene;
  }

  get isSetup(): boolean {
    return this._isSetup;
  }

  get grills(): ReadonlyArray<WashableGrill> {
    return this._grills;
  }

  get allGrillsCleaned(): boolean {
    return this._grills.length > 0 && this._grills.every(g => g.cleanliness >= 0.95);
  }

  get isWashUIOpen(): boolean {
    return this._washUI !== null;
  }

  /**
   * Initialize the wash station area with spigot and space for pressure washer.
   */
  init(): void {
    // Spigot on exterior wall
    this._spigotMesh = MeshBuilder.CreateBox('spigot_exterior', {
      width: 0.15,
      height: 0.2,
      depth: 0.1,
    }, this._scene);
    this._spigotMesh.position = new Vector3(
      this._washStationPos.x,
      0.8,
      this._washStationPos.z
    );
    const spigotMat = new StandardMaterial('mat_spigot', this._scene);
    spigotMat.diffuseColor = new Color3(0.5, 0.5, 0.55);
    this._spigotMesh.material = spigotMat;
    this._spigotMesh.metadata = {
      interactive: true,
      label: 'Water Spigot',
    };
    this._meshes.push(this._spigotMesh);
  }

  /**
   * Add a removed register/grill to the wash queue.
   */
  addGrill(register: RegisterInfo): void {
    if (this._grills.find(g => g.registerId === register.id)) return;

    // Random stubbornness
    const stubborn = Math.random() < 0.3;

    this._grills.push({
      registerId: register.id,
      type: register.type,
      cleanliness: 0,
      stubborn,
      atWashStation: false,
    });

    this.onWashEvent.notifyObservers({
      type: 'grill_added',
      targetId: register.id,
      message: `${register.type === 'supply' ? 'Supply register' : 'Return grill'} added to wash queue.`,
    });
  }

  /**
   * Handle interaction with wash station area (spigot).
   */
  handleSpigotInteraction(currentToolId: string | null): boolean {
    if (!this._isSetup) {
      return this._advanceSetup(currentToolId);
    }

    // If setup is complete, show wash UI
    this._showWashUI(currentToolId);
    return true;
  }

  /**
   * Handle interaction with pressure washer mesh.
   */
  handleWasherInteraction(currentToolId: string | null): boolean {
    if (!this._isSetup) {
      this.onWashEvent.notifyObservers({
        type: 'error',
        targetId: '',
        message: 'Set up wash station first. Interact with spigot.',
      });
      return true;
    }
    this._showWashUI(currentToolId);
    return true;
  }

  private _advanceSetup(currentToolId: string | null): boolean {
    switch (this._setupStep) {
      case 'lay_tarp':
        if (currentToolId !== 'plastic-sheeting') {
          this.onWashEvent.notifyObservers({
            type: 'error',
            targetId: '',
            message: 'Need plastic sheeting to lay tarp under wash area.',
          });
          return true;
        }
        // Create tarp visual
        this._tarpMesh = MeshBuilder.CreateGround('wash_tarp', {
          width: 3,
          height: 3,
        }, this._scene);
        this._tarpMesh.position = new Vector3(
          this._washStationPos.x + 1.5,
          0.01,
          this._washStationPos.z
        );
        const tarpMat = new StandardMaterial('mat_tarp', this._scene);
        tarpMat.diffuseColor = new Color3(0.2, 0.3, 0.5);
        tarpMat.alpha = 0.7;
        this._tarpMesh.material = tarpMat;
        this._meshes.push(this._tarpMesh);

        this._setupStep = 'connect_hose';
        this.onWashEvent.notifyObservers({
          type: 'setup_step',
          targetId: 'tarp',
          message: 'Tarp laid. Now connect garden hose to spigot.',
        });
        return true;

      case 'connect_hose':
        if (currentToolId !== 'garden-hose') {
          this.onWashEvent.notifyObservers({
            type: 'error',
            targetId: '',
            message: 'Need garden hose to connect to spigot.',
          });
          return true;
        }
        this._setupStep = 'check_gas';
        this.onWashEvent.notifyObservers({
          type: 'setup_step',
          targetId: 'hose',
          message: 'Hose connected. Now check gas on pressure washer.',
        });
        return true;

      case 'check_gas':
        if (currentToolId !== 'gas-can') {
          this.onWashEvent.notifyObservers({
            type: 'error',
            targetId: '',
            message: 'Need gas can to check/fill pressure washer.',
          });
          return true;
        }
        // Create pressure washer visual
        this._washerMesh = MeshBuilder.CreateBox('washer_pressure', {
          width: 0.6,
          height: 0.5,
          depth: 0.4,
        }, this._scene);
        this._washerMesh.position = new Vector3(
          this._washStationPos.x + 0.5,
          0.25,
          this._washStationPos.z + 0.5
        );
        const washerMat = new StandardMaterial('mat_washer', this._scene);
        washerMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
        this._washerMesh.material = washerMat;
        this._washerMesh.metadata = {
          interactive: true,
          label: 'Pressure Washer',
        };
        this._meshes.push(this._washerMesh);

        this._setupStep = 'ready';
        this._isSetup = true;
        this.onWashEvent.notifyObservers({
          type: 'setup_step',
          targetId: 'gas',
          message: 'Pressure washer ready! Interact with spigot or washer to clean grills.',
        });
        return true;

      default:
        return false;
    }
  }

  private _showWashUI(currentToolId: string | null): void {
    if (this._washUI) this._closeWashUI();

    this._washUI = AdvancedDynamicTexture.CreateFullscreenUI('washUI');

    this._washContainer = new Rectangle('wash_container');
    this._washContainer.width = '500px';
    this._washContainer.height = '450px';
    this._washContainer.background = '#1a1a1aee';
    this._washContainer.cornerRadius = 8;
    this._washContainer.color = COLORS.TEXT_PRIMARY;
    this._washContainer.thickness = 2;
    this._washContainer.zIndex = 400;
    this._washUI.addControl(this._washContainer);

    // Title
    const title = new TextBlock('wash_title');
    title.text = 'PRESSURE WASH STATION';
    title.color = COLORS.TEXT_PRIMARY;
    title.fontSize = 18;
    title.fontFamily = UI.FONT_FAMILY;
    title.height = '35px';
    title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.paddingTop = '10px';
    this._washContainer.addControl(title);

    // Grill list with wash buttons
    const grillPanel = new StackPanel('wash_grills');
    grillPanel.width = '460px';
    grillPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    grillPanel.paddingTop = '55px';
    this._washContainer.addControl(grillPanel);

    if (this._grills.length === 0) {
      const noGrills = new TextBlock('wash_nogrills');
      noGrills.text = 'No grills removed for washing yet.';
      noGrills.color = COLORS.TEXT_SECONDARY;
      noGrills.fontSize = 13;
      noGrills.fontFamily = UI.FONT_FAMILY;
      noGrills.height = '30px';
      grillPanel.addControl(noGrills);
    }

    for (const grill of this._grills) {
      const row = new StackPanel(`wash_row_${grill.registerId}`);
      row.isVertical = false;
      row.height = '35px';
      row.width = '450px';
      grillPanel.addControl(row);

      const label = new TextBlock(`wash_label_${grill.registerId}`);
      const cleanPct = Math.floor(grill.cleanliness * 100);
      const statusText = cleanPct >= 95 ? 'CLEAN' : `${cleanPct}%`;
      label.text = `${grill.type === 'supply' ? 'Supply' : 'Return'} ${grill.registerId} [${statusText}]${grill.stubborn ? ' (stubborn)' : ''}`;
      label.color = cleanPct >= 95 ? '#44FF44' : COLORS.TEXT_WHITE;
      label.fontSize = 12;
      label.fontFamily = UI.FONT_FAMILY;
      label.width = '300px';
      label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      row.addControl(label);

      if (grill.cleanliness < 0.95) {
        const washBtn = Button.CreateSimpleButton(`wash_btn_${grill.registerId}`, 'SPRAY');
        washBtn.width = '70px';
        washBtn.height = '28px';
        washBtn.color = '#000';
        washBtn.background = '#44AAFF';
        washBtn.fontSize = 11;
        washBtn.fontFamily = UI.FONT_FAMILY;
        washBtn.cornerRadius = 3;
        washBtn.onPointerUpObservable.add(() => {
          this._washGrill(grill, currentToolId);
          this._closeWashUI();
          this._showWashUI(currentToolId);
        });
        row.addControl(washBtn);

        if (grill.stubborn && grill.cleanliness > 0.5 && grill.cleanliness < 0.95) {
          const brushBtn = Button.CreateSimpleButton(`brush_btn_${grill.registerId}`, 'BRUSH');
          brushBtn.width = '70px';
          brushBtn.height = '28px';
          brushBtn.color = '#000';
          brushBtn.background = '#FFAA44';
          brushBtn.fontSize = 11;
          brushBtn.fontFamily = UI.FONT_FAMILY;
          brushBtn.cornerRadius = 3;
          brushBtn.onPointerUpObservable.add(() => {
            this._brushGrill(grill, currentToolId);
            this._closeWashUI();
            this._showWashUI(currentToolId);
          });
          row.addControl(brushBtn);
        }
      }
    }

    // Coil cleaning section
    const divider = new TextBlock('wash_divider');
    divider.text = '── COIL CLEANING ──';
    divider.color = COLORS.TEXT_SECONDARY;
    divider.fontSize = 12;
    divider.fontFamily = UI.FONT_FAMILY;
    divider.height = '30px';
    divider.paddingTop = '10px';
    grillPanel.addControl(divider);

    const coilStatus = new TextBlock('wash_coilstatus');
    coilStatus.text = this._coilsCleaned
      ? 'Coils: CLEANED'
      : 'Coils: Need coil cleaner + degreaser';
    coilStatus.color = this._coilsCleaned ? '#44FF44' : COLORS.TEXT_WHITE;
    coilStatus.fontSize = 12;
    coilStatus.fontFamily = UI.FONT_FAMILY;
    coilStatus.height = '25px';
    grillPanel.addControl(coilStatus);

    // Close button
    const closeBtn = Button.CreateSimpleButton('wash_close', 'CLOSE (ESC)');
    closeBtn.width = '150px';
    closeBtn.height = '30px';
    closeBtn.color = COLORS.TEXT_WHITE;
    closeBtn.background = '#444444';
    closeBtn.fontSize = 13;
    closeBtn.fontFamily = UI.FONT_FAMILY;
    closeBtn.cornerRadius = 4;
    closeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeBtn.paddingBottom = '15px';
    closeBtn.onPointerUpObservable.add(() => this._closeWashUI());
    this._washContainer.addControl(closeBtn);

    // ESC handler
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this._closeWashUI();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  private _washGrill(grill: WashableGrill, _currentToolId: string | null): void {
    const washAmount = grill.stubborn ? 0.15 : 0.3;
    grill.cleanliness = Math.min(1, grill.cleanliness + washAmount);

    // Stubborn grills cap at 70% with spray alone
    if (grill.stubborn && grill.cleanliness > 0.7) {
      grill.cleanliness = Math.min(0.7, grill.cleanliness);
    }

    this.onWashEvent.notifyObservers({
      type: 'grill_washed',
      targetId: grill.registerId,
      message: `Sprayed ${grill.registerId}: ${Math.floor(grill.cleanliness * 100)}% clean${grill.stubborn && grill.cleanliness >= 0.7 ? ' (needs brush)' : ''}`,
    });

    if (grill.cleanliness >= 0.95) {
      this.onWashEvent.notifyObservers({
        type: 'grill_complete',
        targetId: grill.registerId,
        message: `${grill.registerId} fully cleaned!`,
      });
      this._checkAllCleaned();
    }
  }

  private _brushGrill(grill: WashableGrill, currentToolId: string | null): void {
    if (currentToolId !== 'brushes') {
      this.onWashEvent.notifyObservers({
        type: 'error',
        targetId: grill.registerId,
        message: 'Need brushes to scrub stubborn grime.',
      });
      return;
    }

    grill.cleanliness = Math.min(1, grill.cleanliness + 0.3);

    this.onWashEvent.notifyObservers({
      type: 'grill_washed',
      targetId: grill.registerId,
      message: `Brushed ${grill.registerId}: ${Math.floor(grill.cleanliness * 100)}% clean`,
    });

    if (grill.cleanliness >= 0.95) {
      this.onWashEvent.notifyObservers({
        type: 'grill_complete',
        targetId: grill.registerId,
        message: `${grill.registerId} fully cleaned!`,
      });
      this._checkAllCleaned();
    }
  }

  private _checkAllCleaned(): void {
    if (this.allGrillsCleaned) {
      const gs = GameState.getInstance();
      gs.completeTask('pressure-wash');
    }
  }

  /**
   * Clean coils (called from air handler interaction with coil cleaner + degreaser).
   */
  markCoilsCleaned(): void {
    this._coilsCleaned = true;
    this.onWashEvent.notifyObservers({
      type: 'coil_cleaned',
      targetId: 'coils',
      message: 'Coils cleaned with coil cleaner and degreaser.',
    });
    const gs = GameState.getInstance();
    gs.completeTask('clean-coils');
  }

  private _closeWashUI(): void {
    if (this._washUI) {
      this._washUI.dispose();
      this._washUI = null;
    }
    this._washContainer = null;
  }

  dispose(): void {
    this._closeWashUI();
    this.onWashEvent.clear();
    for (const mesh of this._meshes) {
      mesh.dispose();
    }
    this._meshes = [];
  }
}
