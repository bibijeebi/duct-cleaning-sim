import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  PointLight,
} from '@babylonjs/core';
import { COLORS, BUILDING } from '../utils/constants';

export interface RoomConfig {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  type: 'office' | 'hallway' | 'mechanical' | 'lobby' | 'restroom' | 'exterior';
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
    const wallMat = new StandardMaterial('mat_wall', this._scene);
    wallMat.diffuseColor = COLORS.WALL_COLOR;
    this._materials.set('wall', wallMat);

    const floorMat = new StandardMaterial('mat_floor', this._scene);
    floorMat.diffuseColor = COLORS.FLOOR_COLOR;
    this._materials.set('floor', floorMat);

    const ceilingMat = new StandardMaterial('mat_ceiling', this._scene);
    ceilingMat.diffuseColor = COLORS.CEILING_COLOR;
    this._materials.set('ceiling', ceilingMat);

    const ceilingTileMat = new StandardMaterial('mat_ceiling_tile', this._scene);
    ceilingTileMat.diffuseColor = COLORS.CEILING_TILE;
    this._materials.set('ceilingTile', ceilingTileMat);

    const mechFloorMat = new StandardMaterial('mat_mech_floor', this._scene);
    mechFloorMat.diffuseColor = COLORS.MECHANICAL_FLOOR;
    this._materials.set('mechFloor', mechFloorMat);

    const parkingMat = new StandardMaterial('mat_parking', this._scene);
    parkingMat.diffuseColor = COLORS.PARKING_LOT;
    this._materials.set('parking', parkingMat);

    const exteriorFloorMat = new StandardMaterial('mat_exterior_floor', this._scene);
    exteriorFloorMat.diffuseColor = new Color3(0.35, 0.35, 0.38);
    this._materials.set('exteriorFloor', exteriorFloorMat);
  }

  generate(config: BuildingConfig): void {
    // Collect all door openings for wall segmentation
    const doorOpenings = this._computeDoorOpenings(config);

    for (const room of config.rooms) {
      if (room.type === 'exterior') {
        this._createExterior(room);
        continue;
      }

      this._createRoomFloor(room, config);
      this._createRoomCeiling(room, config);
      this._createRoomWalls(room, config, doorOpenings);
      this._createCeilingTiles(room, config);
      this._createRoomLighting(room, config);
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

  private _createRoomFloor(room: RoomConfig, _config: BuildingConfig): void {
    const floor = MeshBuilder.CreateGround(
      `floor_${room.id}`,
      { width: room.width, height: room.depth },
      this._scene
    );
    floor.position = new Vector3(
      room.x + room.width / 2,
      0,
      room.z + room.depth / 2
    );
    floor.checkCollisions = true;
    floor.material = room.type === 'mechanical'
      ? this._materials.get('mechFloor')!
      : this._materials.get('floor')!;
    this._meshes.push(floor);
  }

  private _createRoomCeiling(room: RoomConfig, config: BuildingConfig): void {
    const ceiling = MeshBuilder.CreateGround(
      `ceiling_${room.id}`,
      { width: room.width, height: room.depth },
      this._scene
    );
    ceiling.position = new Vector3(
      room.x + room.width / 2,
      config.wallHeight,
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
    doorOpenings: Map<string, Array<{ pos: number; width: number }>>
  ): void {
    const walls: WallSegment[] = [
      { // North wall
        start: new Vector3(room.x, 0, room.z + room.depth),
        end: new Vector3(room.x + room.width, 0, room.z + room.depth),
        roomId: room.id,
        side: 'north',
      },
      { // South wall
        start: new Vector3(room.x, 0, room.z),
        end: new Vector3(room.x + room.width, 0, room.z),
        roomId: room.id,
        side: 'south',
      },
      { // East wall
        start: new Vector3(room.x + room.width, 0, room.z),
        end: new Vector3(room.x + room.width, 0, room.z + room.depth),
        roomId: room.id,
        side: 'east',
      },
      { // West wall
        start: new Vector3(room.x, 0, room.z),
        end: new Vector3(room.x, 0, room.z + room.depth),
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

  private _createCeilingTiles(room: RoomConfig, config: BuildingConfig): void {
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
          config.ceilingHeight,
          room.z + offsetZ + iz * tileSize + tileSize / 2
        );
        tile.material = this._materials.get('ceilingTile')!;
        tile.metadata = { interactive: true, label: 'Ceiling Tile', removable: true };
        this._meshes.push(tile);
      }
    }
  }

  private _createRoomLighting(room: RoomConfig, config: BuildingConfig): void {
    // Place point lights simulating fluorescent fixtures
    const lightsX = Math.max(1, Math.floor(room.width / 4));
    const lightsZ = Math.max(1, Math.floor(room.depth / 4));

    for (let ix = 0; ix < lightsX; ix++) {
      for (let iz = 0; iz < lightsZ; iz++) {
        const light = new PointLight(
          `light_${room.id}_${ix}_${iz}`,
          new Vector3(
            room.x + (ix + 0.5) * (room.width / lightsX),
            config.ceilingHeight - 0.1,
            room.z + (iz + 0.5) * (room.depth / lightsZ)
          ),
          this._scene
        );
        light.intensity = 0.4;
        light.range = Math.max(room.width, room.depth) * 1.2;
        light.diffuse = new Color3(1.0, 0.95, 0.9); // Warm fluorescent
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

    // Van placeholder
    const van = MeshBuilder.CreateBox(
      'van_equipment',
      { width: 2.5, height: 2.0, depth: 5.0 },
      this._scene
    );
    van.position = new Vector3(
      room.x + room.width / 2,
      1.0,
      room.z + room.depth / 2
    );
    const vanMat = new StandardMaterial('mat_van', this._scene);
    vanMat.diffuseColor = COLORS.VAN_COLOR;
    van.material = vanMat;
    van.metadata = { interactive: true, label: 'Work Van' };
    van.checkCollisions = true;
    this._meshes.push(van);
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
