import {
  Scene,
  Observable,
  AbstractMesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { GameState } from './GameState';
import { DuctSection } from '../models/DuctNetwork';
import { COLORS, UI, BUILDING } from '../utils/constants';

export type HoleSize = 'small' | 'large'; // 1" or 8"

export interface AccessHole {
  id: string;
  sectionId: string;
  size: HoleSize;
  position: Vector3;
  mesh: Mesh | null;
  patched: boolean;
  patchSteps: PatchStep[];
}

export type PatchStepType =
  | 'pop_plug'          // For 1" holes
  | 'place_patch'       // Place sheet metal patch
  | 'drive_screws'      // Screw at corners/sides
  | 'mastic_seam'       // Mastic around seam
  | 'mastic_face'       // Mastic on patch face
  | 'roll_insulation'   // Roll insulation back
  | 'apply_fsk_tape';   // FSK tape over insulation

export interface PatchStep {
  type: PatchStepType;
  completed: boolean;
  requiredTool: string;
}

const SMALL_PATCH_STEPS: PatchStep[] = [
  { type: 'pop_plug', completed: false, requiredTool: 'pop-plugs' },
];

const LARGE_PATCH_STEPS: PatchStep[] = [
  { type: 'place_patch', completed: false, requiredTool: 'sheet-metal-patches' },
  { type: 'drive_screws', completed: false, requiredTool: 'screw-gun' },
  { type: 'mastic_seam', completed: false, requiredTool: 'mastic' },
  { type: 'mastic_face', completed: false, requiredTool: 'mastic' },
  { type: 'roll_insulation', completed: false, requiredTool: '' }, // No specific tool
  { type: 'apply_fsk_tape', completed: false, requiredTool: 'fsk-tape' },
];

const STEP_LABELS: Record<PatchStepType, string> = {
  'pop_plug': 'Insert Pop Plug',
  'place_patch': 'Place Sheet Metal Patch',
  'drive_screws': 'Drive Screws (corners & sides)',
  'mastic_seam': 'Apply Mastic Around Seam',
  'mastic_face': 'Apply Mastic on Patch Face',
  'roll_insulation': 'Roll Insulation Back Over Patch',
  'apply_fsk_tape': 'Apply FSK Tape Over Insulation',
};

export interface PatchingEvent {
  type: 'hole_cut' | 'patch_step' | 'patch_complete' | 'patch_error';
  holeId: string;
  message: string;
}

export class PatchingSystem {
  private _scene: Scene;
  private _holes: AccessHole[] = [];
  private _meshes: Mesh[] = [];
  private _activePatchUI: AdvancedDynamicTexture | null = null;
  private _activePatchContainer: Rectangle | null = null;
  private _activeHole: AccessHole | null = null;

  onPatchEvent: Observable<PatchingEvent> = new Observable();

  constructor(scene: Scene) {
    this._scene = scene;
  }

  get holes(): ReadonlyArray<AccessHole> {
    return this._holes;
  }

  get unpatchedCount(): number {
    return this._holes.filter(h => !h.patched).length;
  }

  get allPatched(): boolean {
    return this._holes.length > 0 && this._holes.every(h => h.patched);
  }

  /**
   * Cut an access hole in a duct section.
   */
  cutHole(section: DuctSection, size: HoleSize, currentToolId: string): boolean {
    // Validate tool
    const requiredTool = size === 'small' ? 'hole-cutter-1' : 'hole-cutter-8';
    if (currentToolId !== requiredTool) {
      this.onPatchEvent.notifyObservers({
        type: 'patch_error',
        holeId: '',
        message: `Need ${size === 'small' ? '1" hole cutter' : '8" hole cutter'} to cut this hole.`,
      });
      return false;
    }

    // Create hole at section midpoint
    const holePos = section.startPos.add(section.endPos).scale(0.5);
    holePos.y -= 0.1; // slightly below duct

    const holeId = `hole_${section.id}_${this._holes.length}`;
    const holeSize = size === 'small' ? BUILDING.ACCESS_HOLE_SMALL : BUILDING.ACCESS_HOLE_LARGE;

    // Create hole mesh (dark circle on duct)
    const holeMesh = MeshBuilder.CreateDisc(holeId, {
      radius: holeSize,
      tessellation: 16,
    }, this._scene);
    holeMesh.position = holePos.clone();
    holeMesh.position.y -= 0.05;
    holeMesh.rotation.x = Math.PI / 2;
    const holeMat = new StandardMaterial(`mat_${holeId}`, this._scene);
    holeMat.diffuseColor = new Color3(0.05, 0.05, 0.05);
    holeMesh.material = holeMat;
    holeMesh.metadata = {
      interactive: true,
      label: `Access Hole (${size === 'small' ? '1"' : '8"'}) - ${section.id}`,
      holeId,
    };
    this._meshes.push(holeMesh);

    const steps = size === 'small'
      ? SMALL_PATCH_STEPS.map(s => ({ ...s }))
      : LARGE_PATCH_STEPS.map(s => ({ ...s }));

    const hole: AccessHole = {
      id: holeId,
      sectionId: section.id,
      size,
      position: holePos,
      mesh: holeMesh,
      patched: false,
      patchSteps: steps,
    };

    this._holes.push(hole);

    this.onPatchEvent.notifyObservers({
      type: 'hole_cut',
      holeId,
      message: `${size === 'small' ? '1"' : '8"'} access hole cut in ${section.id}.`,
    });

    return true;
  }

  /**
   * Handle interaction with an access hole mesh.
   * Opens the patching UI for the hole.
   */
  handleHoleInteraction(mesh: AbstractMesh, currentToolId: string | null): boolean {
    const holeId = mesh.metadata?.holeId as string | undefined;
    if (!holeId) return false;

    const hole = this._holes.find(h => h.id === holeId);
    if (!hole || hole.patched) {
      this.onPatchEvent.notifyObservers({
        type: 'patch_error',
        holeId: holeId || '',
        message: hole?.patched ? 'This hole is already patched.' : 'Hole not found.',
      });
      return true;
    }

    // For small holes with pop plugs, just do it directly if holding the right tool
    if (hole.size === 'small' && currentToolId === 'pop-plugs') {
      hole.patchSteps[0].completed = true;
      hole.patched = true;
      this._updateHoleMesh(hole);
      this.onPatchEvent.notifyObservers({
        type: 'patch_complete',
        holeId,
        message: 'Pop plug inserted. 1" hole sealed.',
      });
      this._checkAllPatched();
      return true;
    }

    // For large holes, show patching UI
    if (hole.size === 'large') {
      this._showPatchingUI(hole, currentToolId);
      return true;
    }

    // Wrong tool for small hole
    this.onPatchEvent.notifyObservers({
      type: 'patch_error',
      holeId,
      message: 'Need pop plugs to seal 1" holes.',
    });
    return true;
  }

  /**
   * Try to advance a patch step with the currently held tool.
   */
  advancePatchStep(holeId: string, currentToolId: string | null): boolean {
    const hole = this._holes.find(h => h.id === holeId);
    if (!hole || hole.patched) return false;

    // Find the next incomplete step
    const nextStep = hole.patchSteps.find(s => !s.completed);
    if (!nextStep) return false;

    // Check if using duct tape instead of FSK tape
    if (nextStep.type === 'apply_fsk_tape' && currentToolId === 'duct-tape') {
      // Allow it but apply penalty
      nextStep.completed = true;
      const gs = GameState.getInstance();
      gs.applyDeduction(10, 'Used duct tape instead of FSK tape');
      this.onPatchEvent.notifyObservers({
        type: 'patch_step',
        holeId,
        message: 'Applied duct tape instead of FSK tape! -10 points',
      });
    } else if (nextStep.requiredTool && currentToolId !== nextStep.requiredTool) {
      // Wrong tool
      this.onPatchEvent.notifyObservers({
        type: 'patch_error',
        holeId,
        message: `Need ${nextStep.requiredTool} for: ${STEP_LABELS[nextStep.type]}`,
      });
      return false;
    } else {
      nextStep.completed = true;
      this.onPatchEvent.notifyObservers({
        type: 'patch_step',
        holeId,
        message: `Completed: ${STEP_LABELS[nextStep.type]}`,
      });
    }

    // Check if all steps done
    if (hole.patchSteps.every(s => s.completed)) {
      hole.patched = true;
      this._updateHoleMesh(hole);
      this.onPatchEvent.notifyObservers({
        type: 'patch_complete',
        holeId,
        message: 'Patch complete! Hole sealed to code.',
      });

      // Check if patch was perfect (all steps done in order, no penalties)
      const gs = GameState.getInstance();
      const hadErrors = gs.scoreHistory.some(e =>
        e.reason.includes('duct tape') || e.reason.includes('Bad patch')
      );
      if (!hadErrors && hole.size === 'large') {
        gs.applyBonus(5, 'Perfect patch (all elements correct)');
      }

      this._checkAllPatched();
    }

    return true;
  }

  /**
   * Check if a step was skipped (out of order).
   */
  checkSkippedSteps(holeId: string, attemptedStep: PatchStepType): boolean {
    const hole = this._holes.find(h => h.id === holeId);
    if (!hole) return false;

    const stepIndex = hole.patchSteps.findIndex(s => s.type === attemptedStep);
    if (stepIndex < 0) return false;

    // Check if any prior step is incomplete
    for (let i = 0; i < stepIndex; i++) {
      if (!hole.patchSteps[i].completed) {
        const gs = GameState.getInstance();
        gs.applyDeduction(10, `Bad patch - skipped step: ${STEP_LABELS[hole.patchSteps[i].type]}`);
        // Auto-complete skipped step
        hole.patchSteps[i].completed = true;
        return true;
      }
    }
    return false;
  }

  private _showPatchingUI(hole: AccessHole, currentToolId: string | null): void {
    if (this._activePatchUI) this._closePatchingUI();

    this._activeHole = hole;
    this._activePatchUI = AdvancedDynamicTexture.CreateFullscreenUI('patchingUI');

    this._activePatchContainer = new Rectangle('patch_container');
    this._activePatchContainer.width = '450px';
    this._activePatchContainer.height = '400px';
    this._activePatchContainer.background = '#1a1a1aee';
    this._activePatchContainer.cornerRadius = 8;
    this._activePatchContainer.color = COLORS.TEXT_PRIMARY;
    this._activePatchContainer.thickness = 2;
    this._activePatchContainer.zIndex = 400;
    this._activePatchUI.addControl(this._activePatchContainer);

    // Title
    const title = new TextBlock('patch_title');
    title.text = `PATCHING: ${hole.id}`;
    title.color = COLORS.TEXT_PRIMARY;
    title.fontSize = 18;
    title.fontFamily = UI.FONT_FAMILY;
    title.height = '35px';
    title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.paddingTop = '10px';
    this._activePatchContainer.addControl(title);

    const subtitle = new TextBlock('patch_subtitle');
    subtitle.text = '8" Access Hole - Complete all steps in order';
    subtitle.color = COLORS.TEXT_SECONDARY;
    subtitle.fontSize = 12;
    subtitle.fontFamily = UI.FONT_FAMILY;
    subtitle.height = '25px';
    subtitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    subtitle.paddingTop = '40px';
    this._activePatchContainer.addControl(subtitle);

    // Steps panel
    const stepsPanel = new StackPanel('patch_steps');
    stepsPanel.width = '410px';
    stepsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    stepsPanel.paddingTop = '75px';
    this._activePatchContainer.addControl(stepsPanel);

    for (let i = 0; i < hole.patchSteps.length; i++) {
      const step = hole.patchSteps[i];
      const isNext = !step.completed && hole.patchSteps.slice(0, i).every(s => s.completed);

      const stepBtn = Button.CreateSimpleButton(`patch_step_${i}`, '');
      stepBtn.width = '400px';
      stepBtn.height = '35px';
      stepBtn.cornerRadius = 3;
      stepBtn.thickness = 1;
      stepBtn.paddingTop = '3px';
      stepBtn.paddingBottom = '3px';

      if (step.completed) {
        stepBtn.background = '#2a4a2a';
        stepBtn.color = '#66AA66';
      } else if (isNext) {
        stepBtn.background = '#3a3a2a';
        stepBtn.color = COLORS.TEXT_PRIMARY;
      } else {
        stepBtn.background = '#2a2a2a';
        stepBtn.color = '#666666';
      }

      const label = step.completed ? '[DONE]' : isNext ? '[NEXT]' : '[    ]';
      const toolHint = step.requiredTool ? ` (${step.requiredTool})` : '';
      const textBlock = stepBtn.children[0] as TextBlock;
      if (textBlock) {
        textBlock.text = `${label} ${STEP_LABELS[step.type]}${toolHint}`;
        textBlock.fontSize = 12;
        textBlock.fontFamily = UI.FONT_FAMILY;
      }

      if (isNext) {
        stepBtn.onPointerUpObservable.add(() => {
          this.advancePatchStep(hole.id, currentToolId);
          this._closePatchingUI();
          if (!hole.patched) {
            this._showPatchingUI(hole, currentToolId);
          }
        });
      }

      stepsPanel.addControl(stepBtn);
    }

    // Close button
    const closeBtn = Button.CreateSimpleButton('patch_close', 'CLOSE (ESC)');
    closeBtn.width = '150px';
    closeBtn.height = '30px';
    closeBtn.color = COLORS.TEXT_WHITE;
    closeBtn.background = '#444444';
    closeBtn.fontSize = 13;
    closeBtn.fontFamily = UI.FONT_FAMILY;
    closeBtn.cornerRadius = 4;
    closeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeBtn.paddingBottom = '15px';
    closeBtn.onPointerUpObservable.add(() => this._closePatchingUI());
    this._activePatchContainer.addControl(closeBtn);

    // ESC handler
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this._closePatchingUI();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  private _closePatchingUI(): void {
    if (this._activePatchUI) {
      this._activePatchUI.dispose();
      this._activePatchUI = null;
    }
    this._activePatchContainer = null;
    this._activeHole = null;
  }

  get isPatchUIOpen(): boolean {
    return this._activePatchUI !== null;
  }

  private _updateHoleMesh(hole: AccessHole): void {
    if (!hole.mesh) return;
    if (hole.patched) {
      // Change hole mesh appearance to show patch
      const patchMat = new StandardMaterial(`mat_patched_${hole.id}`, this._scene);
      if (hole.size === 'small') {
        patchMat.diffuseColor = new Color3(0.5, 0.5, 0.55); // Pop plug color
      } else {
        patchMat.diffuseColor = new Color3(0.7, 0.7, 0.72); // Sheet metal color
      }
      hole.mesh.material = patchMat;
      hole.mesh.metadata = {
        ...hole.mesh.metadata,
        label: `Patched Hole (${hole.size === 'small' ? '1"' : '8"'})`,
      };
    }
  }

  private _checkAllPatched(): void {
    if (this.allPatched) {
      const gs = GameState.getInstance();
      gs.completeTask('patch-holes');
    }
  }

  init(): void {
    // System ready
  }

  dispose(): void {
    this._closePatchingUI();
    this.onPatchEvent.clear();
    for (const mesh of this._meshes) {
      mesh.dispose();
    }
    this._meshes = [];
  }
}
