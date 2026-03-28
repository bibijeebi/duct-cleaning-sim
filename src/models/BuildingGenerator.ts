import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  PointLight,
  DynamicTexture,
  Texture,
  DirectionalLight,
  HemisphericLight,
} from '@babylonjs/core';
import { COLORS, BUILDING } from '../utils/constants';

export interface RoomConfig {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  type: 'office' | 'hallway' | 'mechanical' | 'lobby' | 'restroom' | 'exterior' | 'courtroom' | 'elevator';
  floor?: number;
}

export interface DoorConfig {
  fromRoom: string;
  toRoom: string;
  wallSide: 'north' | 'south' | 'east' | 'west';
  position: number; // 0-1 along wall length
}

export interface BuildingConfig {
  rooms: RoomConfig[];
  doors: DoorConfig[];
  wallHeight: number;
  ceilingHeight: number;
}

interface WallSegment {
  start: Vector3;
  end: Vector3;
  roomId: string;
  side: 'north' | 'south' | 'east' | 'west';
}

export class BuildingGenerator {
  private _scene: Scene;
  private _meshes: Mesh[] = [];
  private _materials: Map<string, StandardMaterial> = new Map();

  constructor(scene: Scene) {
    this._scene = scene;
    this._createMaterials();
  }

  private _createMaterials(): void {
    // Wall: off-white/beige, slight specular for painted drywall look
    const wallMat = new StandardMaterial('mat_wall', this._scene);
    wallMat.diffuseColor = COLORS.WALL_COLOR;
    wallMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this._materials.set('wall', wallMat);

    // Floor: gray with subtle grid texture (commercial carpet tile look)
    const floorMat = new StandardMaterial('mat_floor', this._scene);
    floorMat.diffuseColor = COLORS.FLOOR_COLOR;
    const floorTex = this._createGridTexture('floor_grid', 512, 8,
      '#4d4d4d', '#525252', 1);
    floorMat.diffuseTexture = floorTex;
    floorMat.specularColor = new Color3(0.08, 0.08, 0.08);
    this._materials.set('floor', floorMat);

    // Ceiling: slightly darker than tiles with grid lines (drop ceiling frame)
    const ceilingMat = new StandardMaterial('mat_ceiling', this._scene);
    ceilingMat.diffuseColor = COLORS.CEILING_COLOR;
    ceilingMat.specularColor = new Color3(0.02, 0.02, 0.02);
    this._materials.set('ceiling', ceilingMat);

    // Ceiling tile: individual tiles with visible edge grid
    const ceilingTileMat = new StandardMaterial('mat_ceiling_tile', this._scene);
    const tileTex = this._createGridTexture('tile_grid', 128, 1,
      '#eae9e2', '#d8d6cf', 2);
    ceilingTileMat.diffuseTexture = tileTex;
    ceilingTileMat.specularColor = new Color3(0.03, 0.03, 0.03);
    this._materials.set('ceilingTile', ceilingTileMat);

    // Mechanical room floor: darker concrete
    const mechFloorMat = new StandardMaterial('mat_mech_floor', this._scene);
    mechFloorMat.diffuseColor = COLORS.MECHANICAL_FLOOR;
    const mechTex = this._createGridTexture('mech_grid', 256, 4,
      '#666b66', '#5e635e', 1);
    mechFloorMat.diffuseTexture = mechTex;
    mechFloorMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this._materials.set('mechFloor', mechFloorMat);

    // Parking lot: dark asphalt
    const parkingMat = new StandardMaterial('mat_parking', this._scene);
    parkingMat.diffuseColor = COLORS.PARKING_LOT;
    parkingMat.specularColor = new Color3(0.02, 0.02, 0.02);
    this._materials.set('parking', parkingMat);

    // Exterior floor (sidewalk)
    const exteriorFloorMat = new StandardMaterial('mat_exterior_floor', this._scene);
    exteriorFloorMat.diffuseColor = new Color3(0.35, 0.35, 0.38);
    exteriorFloorMat.specularColor = new Color3(0.03, 0.03, 0.03);
    this._materials.set('exteriorFloor', exteriorFloorMat);

    // Door frame: dark trim
    const doorFrameMat = new StandardMaterial('mat_door_frame', this._scene);
    doorFrameMat.diffuseColor = COLORS.DOOR_FRAME;
    doorFrameMat.specularColor = new Color3(0.1, 0.1, 0.1);
    this._materials.set('doorFrame', doorFrameMat);
  }

  /**
   * Create a procedural grid texture for floors/ceilings.
   */
  private _createGridTexture(
    name: string, size: number, divisions: number,
    fillColor: string, lineColor: string, lineWidth: number
  ): DynamicTexture {
    const tex = new DynamicTexture(name, size, this._scene, true);
    const ctx = tex.getContext();
    const cellSize = size / divisions;

    // Fill background
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, size, size);

    // Draw grid lines
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    for (let i = 0; i <= divisions; i++) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
    tex.update();
    tex.uScale = 1;
    tex.vScale = 1;
    return tex;
  }

  generate(config: BuildingConfig): void {
    // Collect all door openings for wall segmentation
    const doorOpenings = this._computeDoorOpenings(config);

    for (const room of config.rooms) {
      if (room.type === 'exterior') {
        this._createExterior(room);
        continue;
      }

      const floorOffset = (room.floor ?? 0) * config.wallHeight;

      this._createRoomFloor(room, config, floorOffset);
      this._createRoomCeiling(room, config, floorOffset);
      this._createRoomWalls(room, config, doorOpenings, floorOffset);
      this._createCeilingTiles(room, config, floorOffset);
      this._createRoomLighting(room, config, floorOffset);

      // Elevator shaft visual
      if (room.type === 'elevator') {
        this._createElevator(room, config, floorOffset);
      }
    }
  }

  private _computeDoorOpenings(config: BuildingConfig): Map<string, Array<{ pos: number; width: number }>> {
    const openings = new Map<string, Array<{ pos: number; width: number }>>();

    for (const door of config.doors) {
      const room = config.rooms.find(r => r.id === door.fromRoom);
      if (!room) continue;

      const key = `${door.fromRoom}_${door.wallSide}`;
      if (!openings.has(key)) {
        openings.set(key, []);
      }

      const wallLength = (door.wallSide === 'north' || door.wallSide === 'south')
        ? room.width
        : room.depth;
      const doorPos = door.position * wallLength;
      openings.get(key)!.push({ pos: doorPos, width: BUILDING.DOOR_WIDTH });

      // Also add opening for the target room's side
      const targetRoom = config.rooms.find(r => r.id === door.toRoom);
      if (targetRoom) {
        const oppositeSide = this._getOppositeSide(door.wallSide);
        const targetKey = `${door.toRoom}_${oppositeSide}`;
        if (!openings.has(targetKey)) {
          openings.set(targetKey, []);
        }
        const targetWallLength = (oppositeSide === 'north' || oppositeSide === 'south')
          ? targetRoom.width
          : targetRoom.depth;
        const targetDoorPos = door.position * targetWallLength;
        openings.get(targetKey)!.push({ pos: targetDoorPos, width: BUILDING.DOOR_WIDTH });
      }
    }

    return openings;
  }

  private _getOppositeSide(side: 'north' | 'south' | 'east' | 'west'): 'north' | 'south' | 'east' | 'west' {
    switch (side) {
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east': return 'west';
      case 'west': return 'east';
    }
  }

  private _createRoomFloor(room: RoomConfig, _config: BuildingConfig, floorOffset: number = 0): void {
    const floor = MeshBuilder.CreateGround(
      `floor_${room.id}`,
      { width: room.width, height: room.depth },
      this._scene
    );
    floor.position = new Vector3(
      room.x + room.width / 2,
      floorOffset,
      room.z + room.depth / 2
    );
    floor.checkCollisions = true;
    floor.material = room.type === 'mechanical'
      ? this._materials.get('mechFloor')!
      : this._materials.get('floor')!;
    this._meshes.push(floor);
  }

  private _createRoomCeiling(room: RoomConfig, config: BuildingConfig, floorOffset: number = 0): void {
    const ceiling = MeshBuilder.CreateGround(
      `ceiling_${room.id}`,
      { width: room.width, height: room.depth },
      this._scene
    );
    ceiling.position = new Vector3(
      room.x + room.width / 2,
      floorOffset + config.wallHeight,
      room.z + room.depth / 2
    );
    // Flip ceiling to face downward
    ceiling.rotation.x = Math.PI;
    ceiling.material = this._materials.get('ceiling')!;
    this._meshes.push(ceiling);
  }

  private _createRoomWalls(
    room: RoomConfig,
    config: BuildingConfig,
    doorOpenings: Map<string, Array<{ pos: number; width: number }>>,
    floorOffset: number = 0
  ): void {
    const walls: WallSegment[] = [
      { // North wall
        start: new Vector3(room.x, floorOffset, room.z + room.depth),
        end: new Vector3(room.x + room.width, floorOffset, room.z + room.depth),
        roomId: room.id,
        side: 'north',
      },
      { // South wall
        start: new Vector3(room.x, floorOffset, room.z),
        end: new Vector3(room.x + room.width, floorOffset, room.z),
        roomId: room.id,
        side: 'south',
      },
      { // East wall
        start: new Vector3(room.x + room.width, floorOffset, room.z),
        end: new Vector3(room.x + room.width, floorOffset, room.z + room.depth),
        roomId: room.id,
        side: 'east',
      },
      { // West wall
        start: new Vector3(room.x, floorOffset, room.z),
        end: new Vector3(room.x, floorOffset, room.z + room.depth),
        roomId: room.id,
        side: 'west',
      },
    ];

    for (const wall of walls) {
      const key = `${wall.roomId}_${wall.side}`;
      const openings = doorOpenings.get(key) || [];
      this._createWallWithOpenings(wall, openings, config);
    }
  }

  private _createWallWithOpenings(
    wall: WallSegment,
    openings: Array<{ pos: number; width: number }>,
    config: BuildingConfig
  ): void {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const wallLength = Math.sqrt(dx * dx + dz * dz);
    const isXAligned = Math.abs(dx) > Math.abs(dz);

    if (openings.length === 0) {
      // Simple full wall
      this._createWallMesh(wall, wallLength, config.wallHeight, isXAligned);
      return;
    }

    // Sort openings by position
    const sorted = [...openings].sort((a, b) => a.pos - b.pos);

    let cursor = 0;
    for (let i = 0; i < sorted.length; i++) {
      const opening = sorted[i];
      const openStart = opening.pos - opening.width / 2;
      const openEnd = opening.pos + opening.width / 2;

      // Wall segment before this opening
      if (openStart > cursor) {
        const segLen = openStart - cursor;
        const segStart = this._interpolateWall(wall, cursor / wallLength);
        this._createWallSegment(segStart, segLen, config.wallHeight, isXAligned, wall.roomId, i);
      }

      // Wall above door opening
      if (BUILDING.DOOR_HEIGHT < config.wallHeight) {
        const aboveHeight = config.wallHeight - BUILDING.DOOR_HEIGHT;
        const segStart = this._interpolateWall(wall, openStart / wallLength);
        const aboveWall = MeshBuilder.CreateBox(
          `wall_above_door_${wall.roomId}_${wall.side}_${i}`,
          {
            width: isXAligned ? opening.width : BUILDING.WALL_THICKNESS,
            height: aboveHeight,
            depth: isXAligned ? BUILDING.WALL_THICKNESS : opening.width,
          },
          this._scene
        );
        aboveWall.position = new Vector3(
          segStart.x + (isXAligned ? opening.width / 2 : 0),
          BUILDING.DOOR_HEIGHT + aboveHeight / 2,
          segStart.z + (isXAligned ? 0 : opening.width / 2)
        );
        aboveWall.checkCollisions = true;
        aboveWall.material = this._materials.get('wall')!;
        this._meshes.push(aboveWall);

        // Door frame — dark rectangular outline around the opening
        this._createDoorFrame(segStart, opening.width, isXAligned, wall.roomId, wall.side, i);
      }

      cursor = openEnd;
    }

    // Wall after last opening
    if (cursor < wallLength) {
      const segLen = wallLength - cursor;
      const segStart = this._interpolateWall(wall, cursor / wallLength);
      this._createWallSegment(segStart, segLen, config.wallHeight, isXAligned, wall.roomId, sorted.length);
    }
  }

  private _interpolateWall(wall: WallSegment, t: number): Vector3 {
    return new Vector3(
      wall.start.x + (wall.end.x - wall.start.x) * t,
      0,
      wall.start.z + (wall.end.z - wall.start.z) * t
    );
  }

  private _createWallSegment(
    start: Vector3,
    length: number,
    height: number,
    isXAligned: boolean,
    roomId: string,
    index: number
  ): void {
    const wallMesh = MeshBuilder.CreateBox(
      `wall_${roomId}_seg_${index}`,
      {
        width: isXAligned ? length : BUILDING.WALL_THICKNESS,
        height: height,
        depth: isXAligned ? BUILDING.WALL_THICKNESS : length,
      },
      this._scene
    );
    wallMesh.position = new Vector3(
      start.x + (isXAligned ? length / 2 : 0),
      height / 2,
      start.z + (isXAligned ? 0 : length / 2)
    );
    wallMesh.checkCollisions = true;
    wallMesh.material = this._materials.get('wall')!;
    this._meshes.push(wallMesh);
  }

  private _createWallMesh(
    wall: WallSegment,
    length: number,
    height: number,
    isXAligned: boolean
  ): void {
    const mesh = MeshBuilder.CreateBox(
      `wall_${wall.roomId}_${wall.side}`,
      {
        width: isXAligned ? length : BUILDING.WALL_THICKNESS,
        height: height,
        depth: isXAligned ? BUILDING.WALL_THICKNESS : length,
      },
      this._scene
    );
    const cx = (wall.start.x + wall.end.x) / 2;
    const cz = (wall.start.z + wall.end.z) / 2;
    mesh.position = new Vector3(cx, height / 2, cz);
    mesh.checkCollisions = true;
    mesh.material = this._materials.get('wall')!;
    this._meshes.push(mesh);
  }

  private _createDoorFrame(
    segStart: Vector3,
    doorWidth: number,
    isXAligned: boolean,
    roomId: string,
    side: string,
    index: number
  ): void {
    const frameThick = 0.06;
    const frameDepth = BUILDING.WALL_THICKNESS + 0.04;
    const doorH = BUILDING.DOOR_HEIGHT;
    const frameMat = this._materials.get('doorFrame')!;

    // Top header
    const header = MeshBuilder.CreateBox(
      `door_frame_top_${roomId}_${side}_${index}`,
      {
        width: isXAligned ? doorWidth + frameThick * 2 : frameDepth,
        height: frameThick,
        depth: isXAligned ? frameDepth : doorWidth + frameThick * 2,
      },
      this._scene
    );
    header.position = new Vector3(
      segStart.x + (isXAligned ? doorWidth / 2 : 0),
      doorH + frameThick / 2,
      segStart.z + (isXAligned ? 0 : doorWidth / 2)
    );
    header.material = frameMat;
    this._meshes.push(header);

    // Left jamb
    const leftJamb = MeshBuilder.CreateBox(
      `door_frame_left_${roomId}_${side}_${index}`,
      {
        width: isXAligned ? frameThick : frameDepth,
        height: doorH,
        depth: isXAligned ? frameDepth : frameThick,
      },
      this._scene
    );
    leftJamb.position = new Vector3(
      segStart.x + (isXAligned ? -frameThick / 2 : 0),
      doorH / 2,
      segStart.z + (isXAligned ? 0 : -frameThick / 2)
    );
    leftJamb.material = frameMat;
    this._meshes.push(leftJamb);

    // Right jamb
    const rightJamb = MeshBuilder.CreateBox(
      `door_frame_right_${roomId}_${side}_${index}`,
      {
        width: isXAligned ? frameThick : frameDepth,
        height: doorH,
        depth: isXAligned ? frameDepth : frameThick,
      },
      this._scene
    );
    rightJamb.position = new Vector3(
      segStart.x + (isXAligned ? doorWidth + frameThick / 2 : 0),
      doorH / 2,
      segStart.z + (isXAligned ? 0 : doorWidth + frameThick / 2)
    );
    rightJamb.material = frameMat;
    this._meshes.push(rightJamb);
  }

  private _createCeilingTiles(room: RoomConfig, config: BuildingConfig, floorOffset: number = 0): void {
    const tileSize = BUILDING.CEILING_TILE_SIZE;
    const tilesX = Math.floor(room.width / tileSize);
    const tilesZ = Math.floor(room.depth / tileSize);
    const offsetX = (room.width - tilesX * tileSize) / 2;
    const offsetZ = (room.depth - tilesZ * tileSize) / 2;

    for (let ix = 0; ix < tilesX; ix++) {
      for (let iz = 0; iz < tilesZ; iz++) {
        const tile = MeshBuilder.CreateBox(
          `ceiling_tile_${room.id}_${ix}_${iz}`,
          {
            width: tileSize - 0.02,
            height: BUILDING.CEILING_TILE_THICKNESS,
            depth: tileSize - 0.02,
          },
          this._scene
        );
        tile.position = new Vector3(
          room.x + offsetX + ix * tileSize + tileSize / 2,
          floorOffset + config.ceilingHeight,
          room.z + offsetZ + iz * tileSize + tileSize / 2
        );
        tile.material = this._materials.get('ceilingTile')!;
        tile.metadata = { interactive: true, label: 'Ceiling Tile', removable: true };
        this._meshes.push(tile);
      }
    }
  }

  private _createRoomLighting(room: RoomConfig, config: BuildingConfig, floorOffset: number = 0): void {
    // Place point lights simulating fluorescent fixtures — cool blue-white indoor
    const lightsX = Math.max(1, Math.floor(room.width / 4));
    const lightsZ = Math.max(1, Math.floor(room.depth / 4));

    for (let ix = 0; ix < lightsX; ix++) {
      for (let iz = 0; iz < lightsZ; iz++) {
        const light = new PointLight(
          `light_${room.id}_${ix}_${iz}`,
          new Vector3(
            room.x + (ix + 0.5) * (room.width / lightsX),
            floorOffset + config.ceilingHeight - 0.1,
            room.z + (iz + 0.5) * (room.depth / lightsZ)
          ),
          this._scene
        );
        light.intensity = 0.5;
        light.range = Math.max(room.width, room.depth) * 1.5;
        // Cool fluorescent white (slightly blue) for indoor commercial feel
        light.diffuse = new Color3(0.95, 0.97, 1.0);
      }
    }
  }

  private _createExterior(room: RoomConfig): void {
    // Parking lot ground plane
    const parking = MeshBuilder.CreateGround(
      `parking_${room.id}`,
      { width: room.width, height: room.depth },
      this._scene
    );
    parking.position = new Vector3(
      room.x + room.width / 2,
      0,
      room.z + room.depth / 2
    );
    parking.checkCollisions = true;
    parking.material = this._materials.get('parking')!;
    this._meshes.push(parking);

    // Parking space lines
    const lineMat = new StandardMaterial('mat_parking_lines', this._scene);
    lineMat.diffuseColor = new Color3(0.9, 0.9, 0.5);
    lineMat.emissiveColor = new Color3(0.15, 0.15, 0.05);
    for (let i = -2; i <= 2; i++) {
      const line = MeshBuilder.CreateBox(`parking_line_${i}`, {
        width: 0.08, height: 0.005, depth: 4.0,
      }, this._scene);
      line.position = new Vector3(
        room.x + room.width / 2 + i * 2.8,
        0.005,
        room.z + room.depth / 2
      );
      line.material = lineMat;
      this._meshes.push(line);
    }

    // Outdoor directional light (sunlight)
    const sunlight = new DirectionalLight(
      'sunlight',
      new Vector3(-0.5, -1, 0.3),
      this._scene
    );
    sunlight.intensity = 0.8;
    sunlight.diffuse = new Color3(1.0, 0.95, 0.85); // Warm sun

    // Outdoor hemisphere fill light
    const skyLight = new HemisphericLight(
      'sky_hemi',
      new Vector3(0, 1, 0),
      this._scene
    );
    skyLight.intensity = 0.4;
    skyLight.diffuse = new Color3(0.7, 0.8, 1.0);  // Blue sky bounce
    skyLight.groundColor = new Color3(0.3, 0.3, 0.25);

    // Van — elongated box shape sitting on ground
    const vanCenterX = room.x + room.width / 2;
    const vanCenterZ = room.z + room.depth / 2;

    // Van body (main cargo area)
    const vanBody = MeshBuilder.CreateBox('van_equipment', {
      width: 2.2, height: 1.9, depth: 5.5,
    }, this._scene);
    vanBody.position = new Vector3(vanCenterX, 0.95 + 0.15, vanCenterZ);
    const vanMat = new StandardMaterial('mat_van', this._scene);
    vanMat.diffuseColor = COLORS.VAN_COLOR;
    vanMat.specularColor = new Color3(0.15, 0.15, 0.15);
    vanBody.material = vanMat;
    vanBody.metadata = { interactive: true, label: 'Work Van' };
    vanBody.checkCollisions = true;
    this._meshes.push(vanBody);

    // Van cab (front, slightly lower and narrower)
    const vanCab = MeshBuilder.CreateBox('van_cab', {
      width: 2.0, height: 1.5, depth: 1.5,
    }, this._scene);
    vanCab.position = new Vector3(vanCenterX, 0.75 + 0.15, vanCenterZ - 3.2);
    vanCab.material = vanMat;
    vanCab.checkCollisions = true;
    this._meshes.push(vanCab);

    // Van windshield (dark glass)
    const windshield = MeshBuilder.CreateBox('van_windshield', {
      width: 1.8, height: 0.8, depth: 0.05,
    }, this._scene);
    windshield.position = new Vector3(vanCenterX, 1.0 + 0.15, vanCenterZ - 3.95);
    const glassMat = new StandardMaterial('mat_van_glass', this._scene);
    glassMat.diffuseColor = new Color3(0.1, 0.12, 0.15);
    glassMat.specularColor = new Color3(0.4, 0.4, 0.4);
    glassMat.alpha = 0.7;
    windshield.material = glassMat;
    this._meshes.push(windshield);

    // Wheels (4 cylinders)
    const wheelMat = new StandardMaterial('mat_wheel', this._scene);
    wheelMat.diffuseColor = new Color3(0.15, 0.15, 0.15);
    const wheelPositions = [
      new Vector3(vanCenterX - 1.15, 0.25, vanCenterZ - 2.5),
      new Vector3(vanCenterX + 1.15, 0.25, vanCenterZ - 2.5),
      new Vector3(vanCenterX - 1.15, 0.25, vanCenterZ + 1.5),
      new Vector3(vanCenterX + 1.15, 0.25, vanCenterZ + 1.5),
    ];
    wheelPositions.forEach((pos, i) => {
      const wheel = MeshBuilder.CreateCylinder(`van_wheel_${i}`, {
        height: 0.2, diameter: 0.5, tessellation: 12,
      }, this._scene);
      wheel.position = pos;
      wheel.rotation.z = Math.PI / 2;
      wheel.material = wheelMat;
      this._meshes.push(wheel);
    });
  }

  private _createElevator(room: RoomConfig, config: BuildingConfig, floorOffset: number): void {
    // Elevator car visual (interactive box)
    const elevator = MeshBuilder.CreateBox(
      `elevator_${room.id}`,
      { width: room.width * 0.8, height: 2.2, depth: room.depth * 0.8 },
      this._scene
    );
    elevator.position = new Vector3(
      room.x + room.width / 2,
      floorOffset + 1.1,
      room.z + room.depth / 2
    );
    const elevMat = new StandardMaterial(`mat_elevator_${room.id}`, this._scene);
    elevMat.diffuseColor = new Color3(0.5, 0.5, 0.55);
    elevMat.alpha = 0.3;
    elevator.material = elevMat;
    elevator.metadata = {
      interactive: true,
      label: 'Elevator',
      elevatorFloor: room.floor ?? 0,
    };
    this._meshes.push(elevator);

    // Elevator doors (visual indicator)
    const doorFrame = MeshBuilder.CreateBox(
      `elevator_door_${room.id}`,
      { width: 0.05, height: 2.0, depth: room.depth * 0.6 },
      this._scene
    );
    doorFrame.position = new Vector3(
      room.x + room.width - 0.1,
      floorOffset + 1.0,
      room.z + room.depth / 2
    );
    const doorMat = new StandardMaterial(`mat_elev_door_${room.id}`, this._scene);
    doorMat.diffuseColor = new Color3(0.6, 0.6, 0.65);
    doorFrame.material = doorMat;
    doorFrame.metadata = { interactive: true, label: 'Elevator Doors' };
    this._meshes.push(doorFrame);
  }

  dispose(): void {
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

/**
 * Get building config by scenario ID.
 */
export function getScenarioConfig(scenarioId: string): BuildingConfig {
  switch (scenarioId) {
    case 'courthouse':
      return getScenario2Config();
    case 'commercial-office':
    default:
      return getScenario1Config();
  }
}

/**
 * Scenario 1: Commercial Office layout.
 * Single-floor office. Split system. 8 supply registers, 3 return grills.
 */
export function getScenario1Config(): BuildingConfig {
  return {
    wallHeight: BUILDING.WALL_HEIGHT,
    ceilingHeight: BUILDING.CEILING_HEIGHT,
    rooms: [
      // Exterior / parking
      { id: 'exterior', name: 'Parking Lot', x: -15, z: -20, width: 30, depth: 10, type: 'exterior' },

      // Lobby / entrance
      { id: 'lobby', name: 'Lobby', x: -2, z: -10, width: 4, depth: 4, type: 'lobby' },

      // Main hallway running east-west
      { id: 'hallway1', name: 'Main Hallway', x: -10, z: -6, width: 20, depth: 2, type: 'hallway' },

      // Offices along north side of hallway
      { id: 'office1', name: 'Office 1', x: -10, z: -4, width: 5, depth: 5, type: 'office' },
      { id: 'office2', name: 'Office 2', x: -5, z: -4, width: 5, depth: 5, type: 'office' },
      { id: 'office3', name: 'Office 3', x: 0, z: -4, width: 5, depth: 5, type: 'office' },
      { id: 'office4', name: 'Office 4', x: 5, z: -4, width: 5, depth: 5, type: 'office' },

      // Offices along south side of hallway
      { id: 'office5', name: 'Office 5', x: -10, z: -13, width: 5, depth: 5, type: 'office' },
      { id: 'office6', name: 'Office 6', x: -5, z: -13, width: 5, depth: 5, type: 'office' },

      // Restroom
      { id: 'restroom', name: 'Restroom', x: 5, z: -13, width: 5, depth: 5, type: 'restroom' },

      // Mechanical room (larger, at east end)
      { id: 'mechanical', name: 'Mechanical Room', x: 10, z: -6, width: 5, depth: 7, type: 'mechanical' },
    ],
    doors: [
      // Lobby to hallway
      { fromRoom: 'lobby', toRoom: 'hallway1', wallSide: 'north', position: 0.5 },

      // Offices to hallway (south wall of offices = north-adjacent to hallway)
      { fromRoom: 'office1', toRoom: 'hallway1', wallSide: 'south', position: 0.5 },
      { fromRoom: 'office2', toRoom: 'hallway1', wallSide: 'south', position: 0.5 },
      { fromRoom: 'office3', toRoom: 'hallway1', wallSide: 'south', position: 0.5 },
      { fromRoom: 'office4', toRoom: 'hallway1', wallSide: 'south', position: 0.5 },

      // South offices to hallway
      { fromRoom: 'office5', toRoom: 'hallway1', wallSide: 'north', position: 0.5 },
      { fromRoom: 'office6', toRoom: 'hallway1', wallSide: 'north', position: 0.5 },

      // Restroom to hallway
      { fromRoom: 'restroom', toRoom: 'hallway1', wallSide: 'north', position: 0.5 },

      // Mechanical room to hallway
      { fromRoom: 'mechanical', toRoom: 'hallway1', wallSide: 'west', position: 0.3 },
    ],
  };
}

/**
 * Scenario 2: Durham County Courthouse layout.
 * Multi-floor building with PTAC/fan coil wall units.
 * 3 floors with elevator. Portable equipment required (no truck access).
 */
export function getScenario2Config(): BuildingConfig {
  const floors: RoomConfig[] = [];
  const doors: DoorConfig[] = [];

  // Exterior
  floors.push({ id: 'exterior', name: 'Parking Lot', x: -15, z: -25, width: 30, depth: 10, type: 'exterior' });

  for (let f = 0; f < 3; f++) {
    const suffix = `_f${f}`;

    // Lobby / entrance (floor 0 only has exterior entrance)
    floors.push({
      id: `lobby${suffix}`, name: `Lobby F${f + 1}`, x: -3, z: -15, width: 6, depth: 4, type: 'lobby', floor: f,
    });

    // Main hallway
    floors.push({
      id: `hallway${suffix}`, name: `Hallway F${f + 1}`, x: -12, z: -11, width: 24, depth: 2, type: 'hallway', floor: f,
    });

    // Elevator shaft (same position on each floor)
    floors.push({
      id: `elevator${suffix}`, name: `Elevator F${f + 1}`, x: -12, z: -15, width: 3, depth: 3, type: 'elevator', floor: f,
    });

    // Courtrooms (north side) — large rooms
    floors.push({
      id: `courtroom1${suffix}`, name: `Courtroom A F${f + 1}`, x: -12, z: -9, width: 8, depth: 7, type: 'courtroom', floor: f,
    });
    floors.push({
      id: `courtroom2${suffix}`, name: `Courtroom B F${f + 1}`, x: 0, z: -9, width: 8, depth: 7, type: 'courtroom', floor: f,
    });

    // Offices (south side)
    floors.push({
      id: `office1${suffix}`, name: `Office F${f + 1}-1`, x: -8, z: -18, width: 5, depth: 5, type: 'office', floor: f,
    });
    floors.push({
      id: `office2${suffix}`, name: `Office F${f + 1}-2`, x: -3, z: -18, width: 5, depth: 5, type: 'office', floor: f,
    });
    floors.push({
      id: `office3${suffix}`, name: `Office F${f + 1}-3`, x: 4, z: -18, width: 5, depth: 5, type: 'office', floor: f,
    });

    // Restroom
    floors.push({
      id: `restroom${suffix}`, name: `Restroom F${f + 1}`, x: 9, z: -18, width: 3, depth: 5, type: 'restroom', floor: f,
    });

    // Doors
    // Lobby to hallway
    doors.push({ fromRoom: `lobby${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'north', position: 0.5 });
    // Elevator to hallway
    doors.push({ fromRoom: `elevator${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'east', position: 0.5 });
    // Courtrooms to hallway
    doors.push({ fromRoom: `courtroom1${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'south', position: 0.5 });
    doors.push({ fromRoom: `courtroom2${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'south', position: 0.5 });
    // Offices to hallway
    doors.push({ fromRoom: `office1${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'north', position: 0.5 });
    doors.push({ fromRoom: `office2${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'north', position: 0.5 });
    doors.push({ fromRoom: `office3${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'north', position: 0.5 });
    // Restroom to hallway
    doors.push({ fromRoom: `restroom${suffix}`, toRoom: `hallway${suffix}`, wallSide: 'north', position: 0.5 });
  }

  return {
    wallHeight: BUILDING.WALL_HEIGHT,
    ceilingHeight: BUILDING.CEILING_HEIGHT,
    rooms: floors,
    doors,
  };
}
