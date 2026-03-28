import {
  Scene,
  FreeCamera,
  Vector3,
  Ray,
  AbstractMesh,
  PointerEventTypes,
  KeyboardEventTypes,
  Observable,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  TextBlock,
} from '@babylonjs/gui';
import { PHYSICS, COLORS, UI } from '../utils/constants';

export interface InteractionTarget {
  mesh: AbstractMesh;
  distance: number;
}

export class PlayerController {
  private _scene: Scene;
  private _camera: FreeCamera;
  private _canvas: HTMLCanvasElement;
  private _ui: AdvancedDynamicTexture;

  // UI elements
  private _crosshair: TextBlock;
  private _promptText: TextBlock;
  private _instructionText: TextBlock;

  // Interaction state
  private _currentTarget: InteractionTarget | null = null;
  private _pointerLocked: boolean = false;
  private _interactionCooldown: boolean = false;

  // Observables
  onInteract: Observable<AbstractMesh> = new Observable<AbstractMesh>();

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this._scene = scene;
    this._canvas = canvas;

    // Create FPS camera
    this._camera = new FreeCamera('playerCamera', new Vector3(0, PHYSICS.PLAYER_HEIGHT, -5), scene);
    this._camera.attachControl(canvas, true);
    this._camera.applyGravity = true;
    this._camera.checkCollisions = true;
    this._camera.ellipsoid = new Vector3(
      PHYSICS.PLAYER_RADIUS,
      PHYSICS.PLAYER_HEIGHT / 2,
      PHYSICS.PLAYER_RADIUS
    );
    this._camera.speed = PHYSICS.PLAYER_SPEED;
    this._camera.angularSensibility = PHYSICS.PLAYER_ANGULAR_SENSIBILITY;
    this._camera.minZ = PHYSICS.CAMERA_MIN_Z;

    // WASD keys
    this._camera.keysUp = [87];    // W
    this._camera.keysDown = [83];  // S
    this._camera.keysLeft = [65];  // A
    this._camera.keysRight = [68]; // D

    // Create HUD UI
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI('playerUI');

    // Crosshair
    this._crosshair = new TextBlock('crosshair');
    this._crosshair.text = '+';
    this._crosshair.color = COLORS.TEXT_PRIMARY;
    this._crosshair.fontSize = UI.CROSSHAIR_SIZE;
    this._crosshair.fontFamily = UI.FONT_FAMILY;
    this._ui.addControl(this._crosshair);

    // Interaction prompt
    this._promptText = new TextBlock('interactPrompt');
    this._promptText.text = '';
    this._promptText.color = COLORS.TEXT_PRIMARY;
    this._promptText.fontSize = UI.PROMPT_FONT_SIZE;
    this._promptText.fontFamily = UI.FONT_FAMILY;
    this._promptText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
    this._promptText.top = '40px';
    this._promptText.isVisible = false;
    this._ui.addControl(this._promptText);

    // Instructions
    this._instructionText = new TextBlock('instructions');
    this._instructionText.text = 'Click to enable mouse look | WASD to move | ESC to release';
    this._instructionText.color = COLORS.TEXT_SECONDARY;
    this._instructionText.fontSize = UI.PROMPT_FONT_SIZE;
    this._instructionText.fontFamily = UI.FONT_FAMILY;
    this._instructionText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_BOTTOM;
    this._instructionText.paddingBottom = '20px';
    this._ui.addControl(this._instructionText);

    this._setupPointerLock();
    this._setupInteraction();
    this._setupRaycast();
  }

  private _setupPointerLock(): void {
    // Click to enter pointer lock
    this._scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (!this._pointerLocked) {
          this._canvas.requestPointerLock();
        }
      }
    });

    // Track pointer lock state
    const onLockChange = () => {
      this._pointerLocked = document.pointerLockElement === this._canvas;
      this._instructionText.isVisible = !this._pointerLocked;
    };

    document.addEventListener('pointerlockchange', onLockChange);
  }

  private _setupInteraction(): void {
    // E key for interaction
    this._scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'e') {
        if (this._currentTarget && !this._interactionCooldown) {
          this._interactionCooldown = true;
          this.onInteract.notifyObservers(this._currentTarget.mesh);

          // Cooldown to prevent rapid interactions
          setTimeout(() => {
            this._interactionCooldown = false;
          }, 500);
        }
      }
    });
  }

  private _setupRaycast(): void {
    // Raycast from camera center each frame to detect interactive objects
    this._scene.registerBeforeRender(() => {
      this._performRaycast();
    });
  }

  private _performRaycast(): void {
    const ray = new Ray(
      this._camera.position,
      this._camera.getForwardRay().direction,
      PHYSICS.INTERACTION_DISTANCE
    );

    const hit = this._scene.pickWithRay(ray, (mesh) => {
      // Only pick meshes that have a name starting with known interactive prefixes
      return this._isInteractive(mesh);
    });

    if (hit?.pickedMesh && hit.distance <= PHYSICS.INTERACTION_DISTANCE) {
      this._currentTarget = {
        mesh: hit.pickedMesh,
        distance: hit.distance,
      };
      this._crosshair.color = COLORS.TEXT_SUCCESS;
      this._promptText.text = `Press E to interact [${this._getInteractionLabel(hit.pickedMesh)}]`;
      this._promptText.isVisible = true;
    } else {
      this._currentTarget = null;
      this._crosshair.color = COLORS.TEXT_PRIMARY;
      this._promptText.isVisible = false;
    }
  }

  private _isInteractive(mesh: AbstractMesh): boolean {
    const name = mesh.name;
    return (
      name.startsWith('register_') ||
      name.startsWith('grill_') ||
      name.startsWith('duct_') ||
      name.startsWith('air_handler') ||
      name.startsWith('vav_') ||
      name.startsWith('equipment_') ||
      name.startsWith('van_') ||
      name.startsWith('ceiling_tile_') ||
      name.startsWith('door_') ||
      name.startsWith('panel_') ||
      name.startsWith('spigot_') ||
      name.startsWith('filter_') ||
      name.startsWith('coil_') ||
      mesh.metadata?.interactive === true
    );
  }

  private _getInteractionLabel(mesh: AbstractMesh): string {
    const name = mesh.name;
    if (name.startsWith('register_supply')) return 'Supply Register';
    if (name.startsWith('register_return') || name.startsWith('grill_')) return 'Return Grill';
    if (name.startsWith('duct_')) return 'Ductwork';
    if (name.startsWith('air_handler')) return 'Air Handler';
    if (name.startsWith('vav_')) return 'VAV Box';
    if (name.startsWith('equipment_')) return 'Equipment';
    if (name.startsWith('van_')) return 'Van';
    if (name.startsWith('ceiling_tile_')) return 'Ceiling Tile';
    if (name.startsWith('door_')) return 'Door';
    if (name.startsWith('panel_')) return 'Electrical Panel';
    if (name.startsWith('spigot_')) return 'Water Spigot';
    if (name.startsWith('filter_')) return 'Air Filter';
    if (name.startsWith('coil_')) return 'Coils';
    if (mesh.metadata?.label) return mesh.metadata.label as string;
    return 'Object';
  }

  get camera(): FreeCamera {
    return this._camera;
  }

  get currentTarget(): InteractionTarget | null {
    return this._currentTarget;
  }

  get ui(): AdvancedDynamicTexture {
    return this._ui;
  }

  get isPointerLocked(): boolean {
    return this._pointerLocked;
  }

  /**
   * Teleport the player to a position.
   */
  teleport(position: Vector3): void {
    this._camera.position = position.clone();
  }

  dispose(): void {
    this.onInteract.clear();
    this._ui.dispose();
  }
}
