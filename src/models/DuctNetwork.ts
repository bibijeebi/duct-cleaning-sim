import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  ParticleSystem,
  Texture,
  Color4,
} from '@babylonjs/core';
import { COLORS, BUILDING } from '../utils/constants';
import { RoomConfig, BuildingConfig } from './BuildingGenerator';

export type DuctMaterial = 'rigid' | 'flex' | 'ductboard';

export interface DuctSection {
  id: string;
  material: DuctMaterial;
  debrisLevel: number; // 0.0 clean to 1.0 filthy
  cleaned: boolean;
  type: 'trunk' | 'branch' | 'supply' | 'return';
  mesh: Mesh | null;
  startPos: Vector3;
  endPos: Vector3;
  roomId: string;
}

export interface RegisterInfo {
  id: string;
  type: 'supply' | 'return';
  mesh: Mesh | null;
  roomId: string;
  position: Vector3;
  installed: boolean;
  identified: boolean;
  cleaned: boolean;
}

export interface VAVBoxInfo {
  id: string;
  mesh: Mesh | null;
  position: Vector3;
  roomId: string;
  damperOpen: boolean;
}

export interface AirHandlerInfo {
  bodyMesh: Mesh | null;
  doorMesh: Mesh | null;
  coilMesh: Mesh | null;
  filterMesh: Mesh | null;
  position: Vector3;
  doorOpen: boolean;
  coilsCleaned: boolean;
  filterReplaced: boolean;
}

export class DuctNetwork {
  private _scene: Scene;
  private _meshes: Mesh[] = [];
  private _materials: Map<string, StandardMaterial> = new Map();
  private _arrowSystems: ParticleSystem[] = [];

  sections: DuctSection[] = [];
  registers: RegisterInfo[] = [];
  vavBoxes: VAVBoxInfo[] = [];
  airHandler: AirHandlerInfo;
  airflowVisible: boolean = false;

  constructor(scene: Scene) {
    this._scene = scene;
    this._createMaterials();
    this.airHandler = {
      bodyMesh: null,
      doorMesh: null,
      coilMesh: null,
      filterMesh: null,
      position: Vector3.Zero(),
      doorOpen: false,
      coilsCleaned: false,
      filterReplaced: false,
    };
  }

  private _createMaterials(): void {
    const ductRigid = new StandardMaterial('mat_duct_rigid', this._scene);
    ductRigid.diffuseColor = new Color3(0.7, 0.72, 0.75); // Brighter metallic silver
    ductRigid.specularColor = new Color3(0.5, 0.5, 0.5);
    ductRigid.specularPower = 32;
    this._materials.set('rigid', ductRigid);

    const ductFlex = new StandardMaterial('mat_duct_flex', this._scene);
    ductFlex.diffuseColor = COLORS.DUCT_FLEX;
    ductFlex.specularColor = new Color3(0.1, 0.1, 0.1);
    this._materials.set('flex', ductFlex);

    const ductBoard = new StandardMaterial('mat_duct_board', this._scene);
    ductBoard.diffuseColor = COLORS.DUCT_BOARD;
    ductBoard.specularColor = new Color3(0.05, 0.05, 0.05);
    this._materials.set('ductboard', ductBoard);

    const registerMat = new StandardMaterial('mat_register', this._scene);
    registerMat.diffuseColor = new Color3(0.82, 0.82, 0.85); // Brighter white-ish metal
    registerMat.specularColor = new Color3(0.5, 0.5, 0.55);
    registerMat.specularPower = 24;
    this._materials.set('register', registerMat);

    const supplyTint = new StandardMaterial('mat_supply_tint', this._scene);
    supplyTint.diffuseColor = COLORS.SUPPLY_TINT;
    supplyTint.specularColor = new Color3(0.3, 0.3, 0.3);
    this._materials.set('supply_tint', supplyTint);

    const returnTint = new StandardMaterial('mat_return_tint', this._scene);
    returnTint.diffuseColor = COLORS.RETURN_TINT;
    returnTint.specularColor = new Color3(0.3, 0.3, 0.3);
    this._materials.set('return_tint', returnTint);

    const handlerMat = new StandardMaterial('mat_air_handler', this._scene);
    handlerMat.diffuseColor = new Color3(0.55, 0.57, 0.6);
    handlerMat.specularColor = new Color3(0.35, 0.35, 0.35);
    this._materials.set('air_handler', handlerMat);

    const vavMat = new StandardMaterial('mat_vav', this._scene);
    vavMat.diffuseColor = COLORS.VAV_BOX;
    vavMat.specularColor = new Color3(0.2, 0.2, 0.2);
    this._materials.set('vav', vavMat);

    const coilMat = new StandardMaterial('mat_coil', this._scene);
    coilMat.diffuseColor = new Color3(0.6, 0.4, 0.2);
    coilMat.specularColor = new Color3(0.5, 0.5, 0.3);
    this._materials.set('coil', coilMat);

    const filterMat = new StandardMaterial('mat_filter', this._scene);
    filterMat.diffuseColor = new Color3(0.85, 0.85, 0.8);
    this._materials.set('filter', filterMat);
  }

  /**
   * Generate HVAC system based on system type.
   */
  generate(config: BuildingConfig, ductMaterial: DuctMaterial = 'rigid', systemType: string = 'split'): void {
    if (systemType === 'ptac') {
      this._generatePTAC(config, ductMaterial);
      return;
    }
    this._generateSplitSystem(config, ductMaterial);
  }

  /**
   * Generate PTAC/fan coil wall units for courthouse scenario.
   * Each room gets its own wall-mounted unit with short duct runs.
   */
  private _generatePTAC(config: BuildingConfig, ductMaterial: DuctMaterial): void {
    const rooms = config.rooms.filter(r =>
      r.type === 'office' || r.type === 'courtroom' || r.type === 'lobby'
    );

    let supplyCount = 0;
    let returnCount = 0;

    for (const room of rooms) {
      const floorOffset = (room.floor ?? 0) * config.wallHeight;
      const unitY = floorOffset + 2.0; // Wall-mounted near ceiling

      // PTAC unit on the wall (acts as mini air handler)
      const ptac = MeshBuilder.CreateBox(`ptac_unit_${room.id}`, {
        width: 1.0, height: 0.5, depth: 0.4,
      }, this._scene);
      ptac.position = new Vector3(
        room.x + room.width - 0.2,
        unitY,
        room.z + room.depth / 2,
      );
      const ptacMat = new StandardMaterial(`mat_ptac_${room.id}`, this._scene);
      ptacMat.diffuseColor = COLORS.AIR_HANDLER;
      ptac.material = ptacMat;
      ptac.metadata = { interactive: true, label: `PTAC Unit - ${room.name}` };
      ptac.checkCollisions = true;
      this._meshes.push(ptac);

      // Short supply duct run from PTAC to room center
      const ductY = floorOffset + config.ceilingHeight + 0.15;
      const ductLen = room.width * 0.6;
      const ductMesh = MeshBuilder.CreateBox(`duct_ptac_supply_${room.id}`, {
        width: ductLen,
        height: BUILDING.DUCT_BRANCH_HEIGHT,
        depth: BUILDING.DUCT_BRANCH_WIDTH,
      }, this._scene);
      ductMesh.position = new Vector3(
        room.x + room.width / 2,
        ductY,
        room.z + room.depth / 2,
      );
      ductMesh.material = this._getDuctMaterial(ductMaterial, 0.5 + Math.random() * 0.3);
      ductMesh.metadata = {
        interactive: true,
        label: `Supply Duct - ${room.name}`,
        ductType: 'supply',
        material: ductMaterial,
      };
      this._meshes.push(ductMesh);

      this.sections.push({
        id: `ptac_supply_${room.id}`,
        material: ductMaterial,
        debrisLevel: 0.4 + Math.random() * 0.4,
        cleaned: false,
        type: 'supply',
        mesh: ductMesh,
        startPos: new Vector3(room.x + room.width - 0.5, ductY, room.z + room.depth / 2),
        endPos: new Vector3(room.x + room.width * 0.3, ductY, room.z + room.depth / 2),
        roomId: room.id,
      });

      // Supply register
      const supplyPos = new Vector3(
        room.x + room.width * 0.4,
        floorOffset + config.ceilingHeight - 0.01,
        room.z + room.depth / 2,
      );
      const supplyReg = this._createRegisterMesh(
        `register_supply_${supplyCount}`, supplyPos, 'supply',
      );
      this.registers.push({
        id: `supply_${supplyCount}`,
        type: 'supply',
        mesh: supplyReg,
        roomId: room.id,
        position: supplyPos,
        installed: true,
        identified: false,
        cleaned: false,
      });
      supplyCount++;

      // Return grill (near PTAC unit)
      const returnPos = new Vector3(
        room.x + room.width * 0.7,
        floorOffset + config.ceilingHeight - 0.01,
        room.z + room.depth / 2,
      );
      const returnReg = this._createRegisterMesh(
        `grill_return_${returnCount}`, returnPos, 'return',
      );
      this.registers.push({
        id: `return_${returnCount}`,
        type: 'return',
        mesh: returnReg,
        roomId: room.id,
        position: returnPos,
        installed: true,
        identified: false,
        cleaned: false,
      });

      // Short return duct
      const retDuctMesh = MeshBuilder.CreateBox(`duct_ptac_return_${room.id}`, {
        width: room.width * 0.3,
        height: BUILDING.DUCT_BRANCH_HEIGHT * 0.9,
        depth: BUILDING.DUCT_BRANCH_WIDTH * 1.1,
      }, this._scene);
      retDuctMesh.position = new Vector3(
        room.x + room.width * 0.75,
        ductY,
        room.z + room.depth / 2,
      );
      retDuctMesh.material = this._getDuctMaterial(ductMaterial, 0.6 + Math.random() * 0.2);
      retDuctMesh.metadata = {
        interactive: true,
        label: `Return Duct - ${room.name}`,
        ductType: 'return',
        material: ductMaterial,
      };
      this._meshes.push(retDuctMesh);

      this.sections.push({
        id: `ptac_return_${room.id}`,
        material: ductMaterial,
        debrisLevel: 0.5 + Math.random() * 0.35,
        cleaned: false,
        type: 'return',
        mesh: retDuctMesh,
        startPos: new Vector3(room.x + room.width * 0.6, ductY, room.z + room.depth / 2),
        endPos: new Vector3(room.x + room.width - 0.3, ductY, room.z + room.depth / 2),
        roomId: room.id,
      });

      returnCount++;
    }

    // Create a pseudo air handler entry for the first PTAC unit (for task compatibility)
    const firstRoom = rooms[0];
    if (firstRoom) {
      const floorOffset = (firstRoom.floor ?? 0) * config.wallHeight;
      this.airHandler.position = new Vector3(
        firstRoom.x + firstRoom.width - 0.2,
        floorOffset + 2.0,
        firstRoom.z + firstRoom.depth / 2,
      );
      // PTAC units serve as individual air handlers - use existing PTAC mesh
      const ptacMesh = this._meshes.find(m => m.name === `ptac_unit_${firstRoom.id}`);
      if (ptacMesh) {
        this.airHandler.bodyMesh = ptacMesh as Mesh;
      }
      // Mark coils and filter as accessible via any PTAC interaction
      this.airHandler.doorOpen = true;
    }
  }

  /**
   * Generate the full HVAC system for Scenario 1 (commercial office).
   * Air handler in mechanical room, trunk running east-west above ceiling,
   * branches to each office, supply registers in rooms, return grills in hallway/lobby.
   */
  private _generateSplitSystem(config: BuildingConfig, ductMaterial: DuctMaterial): void {
    const mechRoom = config.rooms.find(r => r.type === 'mechanical');
    if (!mechRoom) return;

    // 1. Air handler in mechanical room
    this._createAirHandler(mechRoom, config);

    // 2. Trunk line from air handler running west above ceiling along hallway
    const hallway = config.rooms.find(r => r.type === 'hallway');
    if (!hallway) return;

    this._createTrunkLine(mechRoom, hallway, config, ductMaterial);

    // 3. Branch ducts to each office with VAV boxes
    const offices = config.rooms.filter(r => r.type === 'office');
    offices.forEach((office, i) => {
      this._createBranchDuct(office, hallway, config, ductMaterial, i);
    });

    // 4. Supply registers in offices (8 total for scenario 1)
    this._createSupplyRegisters(offices);

    // 5. Return grills in hallway and lobby (3 total for scenario 1)
    const lobby = config.rooms.find(r => r.type === 'lobby');
    this._createReturnGrills(hallway, lobby);

    // 6. Return trunk from hallway back to air handler
    this._createReturnTrunk(mechRoom, hallway, config, ductMaterial);
  }

  private _createAirHandler(mechRoom: RoomConfig, config: BuildingConfig): void {
    const pos = new Vector3(
      mechRoom.x + mechRoom.width / 2,
      1.0,
      mechRoom.z + mechRoom.depth / 2
    );
    this.airHandler.position = pos;

    // Main body — larger to be the biggest equipment in the building
    const body = MeshBuilder.CreateBox('air_handler_body', {
      width: 1.8,
      height: 2.2,
      depth: 1.4,
    }, this._scene);
    body.position = pos.clone();
    body.material = this._materials.get('air_handler')!;
    body.checkCollisions = true;
    body.metadata = { interactive: true, label: 'Air Handler' };
    this.airHandler.bodyMesh = body;
    this._meshes.push(body);

    // Panel lines on the air handler body (horizontal seam lines)
    const panelLineMat = new StandardMaterial('mat_ah_panel_line', this._scene);
    panelLineMat.diffuseColor = new Color3(0.35, 0.37, 0.4);
    panelLineMat.specularColor = new Color3(0.1, 0.1, 0.1);
    for (let p = 0; p < 3; p++) {
      // Horizontal panel lines on front
      const hLine = MeshBuilder.CreateBox(`ah_panel_h_${p}`, {
        width: 1.78, height: 0.015, depth: 0.01,
      }, this._scene);
      hLine.position = new Vector3(pos.x, pos.y - 0.6 + p * 0.6, pos.z - 0.71);
      hLine.material = panelLineMat;
      this._meshes.push(hLine);

      // Horizontal panel lines on sides
      const sLine = MeshBuilder.CreateBox(`ah_panel_s_${p}`, {
        width: 0.01, height: 0.015, depth: 1.38,
      }, this._scene);
      sLine.position = new Vector3(pos.x + 0.91, pos.y - 0.6 + p * 0.6, pos.z);
      sLine.material = panelLineMat;
      this._meshes.push(sLine);

      const sLine2 = MeshBuilder.CreateBox(`ah_panel_s2_${p}`, {
        width: 0.01, height: 0.015, depth: 1.38,
      }, this._scene);
      sLine2.position = new Vector3(pos.x - 0.91, pos.y - 0.6 + p * 0.6, pos.z);
      sLine2.material = panelLineMat;
      this._meshes.push(sLine2);
    }
    // Vertical panel line (center seam)
    const vLine = MeshBuilder.CreateBox('ah_panel_v', {
      width: 0.015, height: 2.18, depth: 0.01,
    }, this._scene);
    vLine.position = new Vector3(pos.x, pos.y, pos.z - 0.71);
    vLine.material = panelLineMat;
    this._meshes.push(vLine);

    // Door (front panel, hinged left)
    const door = MeshBuilder.CreateBox('air_handler_door', {
      width: 1.6,
      height: 2.0,
      depth: 0.05,
    }, this._scene);
    door.position = new Vector3(pos.x, pos.y, pos.z - 0.7);
    const doorMat = new StandardMaterial('mat_ah_door', this._scene);
    doorMat.diffuseColor = new Color3(0.48, 0.50, 0.53);
    doorMat.specularColor = new Color3(0.25, 0.25, 0.25);
    door.material = doorMat;
    door.metadata = { interactive: true, label: 'Air Handler Door' };
    this.airHandler.doorMesh = door;
    this._meshes.push(door);

    // Coils (visible when door open — initially hidden behind door)
    const coil = MeshBuilder.CreateBox('coil_evaporator', {
      width: 1.4,
      height: 1.2,
      depth: 0.15,
    }, this._scene);
    coil.position = new Vector3(pos.x, pos.y + 0.2, pos.z - 0.35);
    coil.material = this._materials.get('coil')!;
    coil.metadata = { interactive: true, label: 'Evaporator Coils' };
    coil.isVisible = false; // hidden until door opened
    this.airHandler.coilMesh = coil;
    this._meshes.push(coil);

    // Filter slot
    const filter = MeshBuilder.CreateBox('filter_slot', {
      width: 1.4,
      height: 0.6,
      depth: 0.08,
    }, this._scene);
    filter.position = new Vector3(pos.x, pos.y - 0.5, pos.z - 0.4);
    filter.material = this._materials.get('filter')!;
    filter.metadata = { interactive: true, label: 'Air Filter' };
    filter.isVisible = false; // hidden until door opened
    this.airHandler.filterMesh = filter;
    this._meshes.push(filter);
  }

  /**
   * Open/close air handler door. Reveals coils and filter.
   */
  toggleAirHandlerDoor(): void {
    this.airHandler.doorOpen = !this.airHandler.doorOpen;
    if (this.airHandler.doorMesh) {
      if (this.airHandler.doorOpen) {
        // Swing door open (rotate and offset)
        this.airHandler.doorMesh.rotation.y = -Math.PI / 2;
        this.airHandler.doorMesh.position.x = this.airHandler.position.x - 0.8;
        this.airHandler.doorMesh.position.z = this.airHandler.position.z - 1.0;
      } else {
        this.airHandler.doorMesh.rotation.y = 0;
        this.airHandler.doorMesh.position.x = this.airHandler.position.x;
        this.airHandler.doorMesh.position.z = this.airHandler.position.z - 0.7;
      }
    }
    // Show/hide internal components
    if (this.airHandler.coilMesh) {
      this.airHandler.coilMesh.isVisible = this.airHandler.doorOpen;
    }
    if (this.airHandler.filterMesh) {
      this.airHandler.filterMesh.isVisible = this.airHandler.doorOpen;
    }
  }

  private _createTrunkLine(
    mechRoom: RoomConfig,
    hallway: RoomConfig,
    config: BuildingConfig,
    material: DuctMaterial
  ): void {
    const y = config.ceilingHeight + 0.15; // just above ceiling tiles
    const startX = mechRoom.x;
    const endX = hallway.x;
    const z = hallway.z + hallway.depth / 2;
    const length = Math.abs(startX - endX);

    const trunk = MeshBuilder.CreateBox('duct_trunk_supply', {
      width: length,
      height: BUILDING.DUCT_TRUNK_HEIGHT,
      depth: BUILDING.DUCT_TRUNK_WIDTH,
    }, this._scene);
    trunk.position = new Vector3(
      (startX + endX) / 2,
      y,
      z
    );
    trunk.material = this._getDuctMaterial(material, 0.6);
    trunk.metadata = {
      interactive: true,
      label: 'Supply Trunk Line',
      ductType: 'trunk',
      material,
    };
    this._meshes.push(trunk);

    this.sections.push({
      id: 'trunk_supply',
      material,
      debrisLevel: 0.6,
      cleaned: false,
      type: 'trunk',
      mesh: trunk,
      startPos: new Vector3(startX, y, z),
      endPos: new Vector3(endX, y, z),
      roomId: 'hallway1',
    });
  }

  private _createReturnTrunk(
    mechRoom: RoomConfig,
    hallway: RoomConfig,
    config: BuildingConfig,
    material: DuctMaterial
  ): void {
    const y = config.ceilingHeight + 0.15;
    const startX = mechRoom.x;
    const endX = hallway.x + hallway.width * 0.3; // return trunk shorter
    const z = hallway.z + hallway.depth / 2 + BUILDING.DUCT_TRUNK_WIDTH + 0.1; // offset from supply
    const length = Math.abs(startX - endX);

    const trunk = MeshBuilder.CreateBox('duct_trunk_return', {
      width: length,
      height: BUILDING.DUCT_TRUNK_HEIGHT * 0.9,
      depth: BUILDING.DUCT_TRUNK_WIDTH * 1.2,
    }, this._scene);
    trunk.position = new Vector3(
      (startX + endX) / 2,
      y,
      z
    );
    trunk.material = this._getDuctMaterial(material, 0.75);
    trunk.metadata = {
      interactive: true,
      label: 'Return Trunk Line',
      ductType: 'trunk',
      material,
    };
    this._meshes.push(trunk);

    this.sections.push({
      id: 'trunk_return',
      material,
      debrisLevel: 0.75,
      cleaned: false,
      type: 'return',
      mesh: trunk,
      startPos: new Vector3(endX, y, z),
      endPos: new Vector3(startX, y, z),
      roomId: 'hallway1',
    });
  }

  private _createBranchDuct(
    office: RoomConfig,
    hallway: RoomConfig,
    config: BuildingConfig,
    material: DuctMaterial,
    index: number
  ): void {
    const y = config.ceilingHeight + 0.15;
    const trunkZ = hallway.z + hallway.depth / 2;
    const officeZ = office.z + office.depth / 2;
    const branchX = office.x + office.width / 2;
    const length = Math.abs(officeZ - trunkZ);

    // Branch duct from trunk to office
    const branch = MeshBuilder.CreateBox(`duct_branch_${office.id}`, {
      width: BUILDING.DUCT_BRANCH_WIDTH,
      height: BUILDING.DUCT_BRANCH_HEIGHT,
      depth: length,
    }, this._scene);
    branch.position = new Vector3(
      branchX,
      y,
      (trunkZ + officeZ) / 2
    );
    branch.material = this._getDuctMaterial(material, 0.5 + Math.random() * 0.3);
    branch.metadata = {
      interactive: true,
      label: `Branch Duct - ${office.name || office.id}`,
      ductType: 'branch',
      material,
    };
    this._meshes.push(branch);

    const debrisLevel = 0.4 + Math.random() * 0.4;
    this.sections.push({
      id: `branch_${office.id}`,
      material,
      debrisLevel,
      cleaned: false,
      type: 'branch',
      mesh: branch,
      startPos: new Vector3(branchX, y, trunkZ),
      endPos: new Vector3(branchX, y, officeZ),
      roomId: office.id,
    });

    // VAV box at branch point
    this._createVAVBox(branchX, y, trunkZ, office, index);
  }

  private _createVAVBox(x: number, y: number, z: number, office: RoomConfig, index: number): void {
    const vavSize = 0.35;
    const vavMesh = MeshBuilder.CreateBox(`vav_${office.id}`, {
      width: vavSize,
      height: vavSize * 0.8,
      depth: vavSize,
    }, this._scene);
    vavMesh.position = new Vector3(x, y, z);
    vavMesh.material = this._materials.get('vav')!;
    vavMesh.metadata = {
      interactive: true,
      label: `VAV Box - ${office.name || office.id}`,
    };
    this._meshes.push(vavMesh);

    // Visible damper plate inside VAV
    const damper = MeshBuilder.CreateBox(`vav_damper_${office.id}`, {
      width: vavSize * 0.7,
      height: 0.02,
      depth: vavSize * 0.7,
    }, this._scene);
    damper.position = new Vector3(x, y, z);
    damper.rotation.x = Math.PI * 0.15; // slightly angled
    const damperMat = new StandardMaterial(`mat_damper_${index}`, this._scene);
    damperMat.diffuseColor = new Color3(0.4, 0.42, 0.45);
    damper.material = damperMat;
    this._meshes.push(damper);

    this.vavBoxes.push({
      id: `vav_${office.id}`,
      mesh: vavMesh,
      position: new Vector3(x, y, z),
      roomId: office.id,
      damperOpen: true,
    });
  }

  private _createSupplyRegisters(offices: RoomConfig[]): void {
    // 8 supply registers across offices (2 per first 4 offices or 1 each + extras)
    let regCount = 0;
    for (const office of offices) {
      const registersInRoom = office.width >= 5 ? 2 : 1;
      for (let i = 0; i < registersInRoom && regCount < 8; i++) {
        const x = office.x + (office.width / (registersInRoom + 1)) * (i + 1);
        const z = office.z + office.depth / 2;
        const y = BUILDING.CEILING_HEIGHT - 0.01;

        const reg = this._createRegisterMesh(
          `register_supply_${regCount}`,
          new Vector3(x, y, z),
          'supply'
        );

        this.registers.push({
          id: `supply_${regCount}`,
          type: 'supply',
          mesh: reg,
          roomId: office.id,
          position: new Vector3(x, y, z),
          installed: true,
          identified: false,
          cleaned: false,
        });
        regCount++;
      }
    }
  }

  private _createReturnGrills(hallway: RoomConfig, lobby: RoomConfig | undefined): void {
    // 3 return grills: 2 in hallway, 1 in lobby
    const grillPositions: Array<{ x: number; z: number; roomId: string }> = [];

    // Hallway grills
    grillPositions.push({
      x: hallway.x + hallway.width * 0.3,
      z: hallway.z + hallway.depth / 2,
      roomId: hallway.id,
    });
    grillPositions.push({
      x: hallway.x + hallway.width * 0.7,
      z: hallway.z + hallway.depth / 2,
      roomId: hallway.id,
    });

    // Lobby grill
    if (lobby) {
      grillPositions.push({
        x: lobby.x + lobby.width / 2,
        z: lobby.z + lobby.depth / 2,
        roomId: lobby.id,
      });
    }

    grillPositions.forEach((pos, i) => {
      const y = BUILDING.CEILING_HEIGHT - 0.01;
      const grill = this._createRegisterMesh(
        `grill_return_${i}`,
        new Vector3(pos.x, y, pos.z),
        'return'
      );

      this.registers.push({
        id: `return_${i}`,
        type: 'return',
        mesh: grill,
        roomId: pos.roomId,
        position: new Vector3(pos.x, y, pos.z),
        installed: true,
        identified: false,
        cleaned: false,
      });
    });
  }

  private _createRegisterMesh(name: string, position: Vector3, type: 'supply' | 'return'): Mesh {
    const isReturn = type === 'return';
    const width = isReturn ? BUILDING.REGISTER_WIDTH * 1.5 : BUILDING.REGISTER_WIDTH;
    const depth = isReturn ? BUILDING.REGISTER_DEPTH * 1.5 : BUILDING.REGISTER_DEPTH;

    // Outer frame
    const frame = MeshBuilder.CreateBox(name, {
      width,
      height: BUILDING.REGISTER_THICKNESS,
      depth,
    }, this._scene);
    frame.position = position.clone();
    frame.material = this._materials.get('register')!;
    frame.metadata = {
      interactive: true,
      label: isReturn ? 'Return Grill' : 'Supply Register',
      registerType: type,
    };
    this._meshes.push(frame);

    // Louver slats for supply registers (visual detail)
    if (!isReturn) {
      const slatCount = 4;
      for (let s = 0; s < slatCount; s++) {
        const slat = MeshBuilder.CreateBox(`${name}_slat_${s}`, {
          width: width * 0.85,
          height: 0.005,
          depth: 0.015,
        }, this._scene);
        slat.position = new Vector3(
          position.x,
          position.y - BUILDING.REGISTER_THICKNESS / 2 + 0.005,
          position.z - depth * 0.35 + (s * depth * 0.7 / (slatCount - 1))
        );
        slat.rotation.x = Math.PI * 0.15; // angled louvers
        slat.material = this._materials.get('register')!;
        this._meshes.push(slat);
      }
    } else {
      // Simple grid pattern for return grills
      const barCount = 6;
      for (let b = 0; b < barCount; b++) {
        const bar = MeshBuilder.CreateBox(`${name}_bar_${b}`, {
          width: width * 0.9,
          height: 0.005,
          depth: 0.01,
        }, this._scene);
        bar.position = new Vector3(
          position.x,
          position.y - BUILDING.REGISTER_THICKNESS / 2 + 0.005,
          position.z - depth * 0.4 + (b * depth * 0.8 / (barCount - 1))
        );
        bar.material = this._materials.get('register')!;
        this._meshes.push(bar);
      }
    }

    return frame;
  }

  /**
   * Get material with debris-level visual darkening.
   */
  private _getDuctMaterial(material: DuctMaterial, debrisLevel: number): StandardMaterial {
    const baseMat = this._materials.get(material)!;
    const dirtyMat = new StandardMaterial(`mat_${material}_${debrisLevel.toFixed(2)}`, this._scene);

    // Interpolate between clean and dirty colors
    const clean = baseMat.diffuseColor;
    const dirty = COLORS.DEBRIS_DIRTY;
    const t = Math.min(1, Math.max(0, debrisLevel));
    dirtyMat.diffuseColor = Color3.Lerp(clean, dirty, t * 0.6);
    dirtyMat.specularColor = baseMat.specularColor.clone();

    return dirtyMat;
  }

  /**
   * Apply identification tint to a register (blue=supply, red=return).
   */
  identifyRegister(registerId: string): void {
    const reg = this.registers.find(r => r.id === registerId);
    if (!reg || reg.identified || !reg.mesh) return;

    reg.identified = true;
    const tintKey = reg.type === 'supply' ? 'supply_tint' : 'return_tint';
    reg.mesh.material = this._materials.get(tintKey)!;
  }

  /**
   * Identify all registers at once (for first-survey bonus check).
   */
  identifyAllRegisters(): void {
    for (const reg of this.registers) {
      this.identifyRegister(reg.id);
    }
  }

  /**
   * Remove a register/grill from its position (for cleaning).
   */
  removeRegister(registerId: string): boolean {
    const reg = this.registers.find(r => r.id === registerId);
    if (!reg || !reg.installed || !reg.mesh) return false;

    reg.installed = false;
    reg.mesh.position.y -= 2.5; // drop to floor level
    reg.mesh.position.x += 0.3; // offset slightly
    return true;
  }

  /**
   * Reinstall a register/grill.
   */
  reinstallRegister(registerId: string): boolean {
    const reg = this.registers.find(r => r.id === registerId);
    if (!reg || reg.installed || !reg.mesh) return false;

    reg.installed = true;
    reg.mesh.position = reg.position.clone();
    return true;
  }

  /**
   * Update debris level for a duct section (from cleaning).
   */
  cleanSection(sectionId: string, amount: number): void {
    const section = this.sections.find(s => s.id === sectionId);
    if (!section) return;

    section.debrisLevel = Math.max(0, section.debrisLevel - amount);
    if (section.debrisLevel <= 0.05) {
      section.cleaned = true;
      section.debrisLevel = 0;
    }

    // Update visual
    if (section.mesh) {
      section.mesh.material = this._getDuctMaterial(section.material, section.debrisLevel);
    }
  }

  /**
   * Show airflow direction arrows along duct sections using particle systems.
   */
  showAirflowArrows(): void {
    if (this.airflowVisible) return;
    this.airflowVisible = true;

    for (const section of this.sections) {
      if (!section.mesh) continue;

      const ps = new ParticleSystem(`airflow_${section.id}`, 30, this._scene);
      // Use a procedural emitter — no texture file needed
      ps.createPointEmitter(
        section.endPos.subtract(section.startPos).normalize().scale(0.5),
        section.endPos.subtract(section.startPos).normalize().scale(0.8)
      );
      ps.emitter = section.startPos.add(section.endPos).scale(0.5);
      ps.minSize = 0.04;
      ps.maxSize = 0.08;
      ps.minLifeTime = 0.8;
      ps.maxLifeTime = 1.5;
      ps.emitRate = 15;
      ps.minEmitPower = 0.3;
      ps.maxEmitPower = 0.6;

      // Blue for supply, orange-red for return
      if (section.type === 'supply' || section.type === 'trunk') {
        ps.color1 = new Color4(0.3, 0.5, 1.0, 0.8);
        ps.color2 = new Color4(0.2, 0.4, 0.9, 0.5);
        ps.colorDead = new Color4(0.1, 0.2, 0.5, 0.0);
      } else {
        ps.color1 = new Color4(1.0, 0.5, 0.3, 0.8);
        ps.color2 = new Color4(0.9, 0.4, 0.2, 0.5);
        ps.colorDead = new Color4(0.5, 0.2, 0.1, 0.0);
      }

      ps.start();
      this._arrowSystems.push(ps);
    }
  }

  /**
   * Hide airflow arrows.
   */
  hideAirflowArrows(): void {
    for (const ps of this._arrowSystems) {
      ps.stop();
      ps.dispose();
    }
    this._arrowSystems = [];
    this.airflowVisible = false;
  }

  /**
   * Get register info by mesh name.
   */
  getRegisterByMeshName(name: string): RegisterInfo | undefined {
    return this.registers.find(r => r.mesh?.name === name);
  }

  /**
   * Get duct section by mesh name.
   */
  getSectionByMeshName(name: string): DuctSection | undefined {
    return this.sections.find(s => s.mesh?.name === name);
  }

  /**
   * Check if all return ducts are cleaned (for ordering enforcement).
   */
  get allReturnsCleaned(): boolean {
    return this.sections
      .filter(s => s.type === 'return')
      .every(s => s.cleaned);
  }

  /**
   * Check if all supply ducts are cleaned.
   */
  get allSupplyCleaned(): boolean {
    return this.sections
      .filter(s => s.type === 'supply' || s.type === 'trunk' || s.type === 'branch')
      .every(s => s.cleaned);
  }

  /**
   * Count of identified registers.
   */
  get identifiedCount(): number {
    return this.registers.filter(r => r.identified).length;
  }

  /**
   * Check if all registers reinstalled.
   */
  get allRegistersInstalled(): boolean {
    return this.registers.every(r => r.installed);
  }

  dispose(): void {
    this.hideAirflowArrows();
    for (const mesh of this._meshes) {
      mesh.dispose();
    }
    this._meshes = [];
    for (const mat of this._materials.values()) {
      mat.dispose();
    }
    this._materials.clear();
  }
}
