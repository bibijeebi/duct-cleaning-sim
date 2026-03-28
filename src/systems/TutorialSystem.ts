import { Scene, AbstractMesh, Color3, HighlightLayer, Observable } from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Button,
  Control,
} from '@babylonjs/gui';
import { GameState, GamePhase } from './GameState';
import { COLORS, UI } from '../utils/constants';

export interface TutorialStep {
  id: string;
  phase: GamePhase;
  title: string;
  description: string;
  targetMeshPrefix: string | null;
  requiredTaskId: string | null;
  autoAdvance: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  // PRE_JOB
  {
    id: 'tut-welcome',
    phase: GamePhase.PRE_JOB,
    title: 'Welcome to Duct Cleaning Simulator',
    description: 'This guided tutorial will walk you through a complete commercial duct cleaning job. Follow the highlighted objectives and glowing targets to learn the proper procedures.',
    targetMeshPrefix: null,
    requiredTaskId: null,
    autoAdvance: false,
  },
  {
    id: 'tut-van',
    phase: GamePhase.PRE_JOB,
    title: 'Select Your Equipment',
    description: 'Walk to the Work Van (the white box ahead) and press E to open the equipment loadout screen. Select all the tools you\'ll need for the job. Tip: use SELECT ALL to grab everything for your first run.',
    targetMeshPrefix: 'van_',
    requiredTaskId: 'select-equipment',
    autoAdvance: true,
  },
  // ARRIVAL
  {
    id: 'tut-enter',
    phase: GamePhase.ARRIVAL,
    title: 'Enter the Building',
    description: 'Walk toward the building entrance (the lobby). Use WASD to move and mouse to look around. Press N to advance to the next phase when ready.',
    targetMeshPrefix: null,
    requiredTaskId: 'enter-building',
    autoAdvance: true,
  },
  {
    id: 'tut-air-handler',
    phase: GamePhase.ARRIVAL,
    title: 'Find the Air Handler',
    description: 'Navigate to the Mechanical Room (east end of the building). The Air Handler is the large gray unit — press E to inspect it. This identifies the system type.',
    targetMeshPrefix: 'air_handler',
    requiredTaskId: 'find-air-handler',
    autoAdvance: true,
  },
  {
    id: 'tut-registers',
    phase: GamePhase.ARRIVAL,
    title: 'Count Registers',
    description: 'Walk through each room and press E on every register and grill you see in the ceilings. Supply registers are smaller with louvers. Return grills are larger with a bar pattern. Identify all of them to count the system.',
    targetMeshPrefix: 'register_',
    requiredTaskId: 'count-registers',
    autoAdvance: true,
  },
  {
    id: 'tut-supply-return',
    phase: GamePhase.ARRIVAL,
    title: 'Supply vs Return',
    description: 'IMPORTANT: After identification, supply registers turn BLUE and return grills turn RED. Supply carries conditioned air TO rooms. Return carries air BACK to the air handler. Always clean returns FIRST (upstream) to avoid recontaminating clean ducts!',
    targetMeshPrefix: null,
    requiredTaskId: null,
    autoAdvance: false,
  },
  {
    id: 'tut-plastic',
    phase: GamePhase.ARRIVAL,
    title: 'Lay Plastic Sheeting',
    description: 'Pick up Plastic Sheeting from the equipment near the van (press E), then use it inside to protect floors under work areas. Skipping this costs 10 points!',
    targetMeshPrefix: 'equipment_',
    requiredTaskId: 'lay-plastic',
    autoAdvance: true,
  },
  // SETUP
  {
    id: 'tut-setup',
    phase: GamePhase.SETUP,
    title: 'Setup Equipment',
    description: 'Connect your negative air machine (squirrel cage) tubing to the trunk line. Run the compressor hose for the agitation wand. Position portable vacuums at access points. Press N to advance when complete.',
    targetMeshPrefix: 'duct_trunk',
    requiredTaskId: null,
    autoAdvance: false,
  },
  // EXECUTION
  {
    id: 'tut-clean-returns',
    phase: GamePhase.EXECUTION,
    title: 'Clean Returns First!',
    description: 'CRITICAL: Clean RETURN ducts first (shown in red). Pick up the Agitation Wand from equipment, then press E on return duct sections to clean them. Cleaning supply first = 15 point penalty!',
    targetMeshPrefix: 'duct_trunk_return',
    requiredTaskId: 'clean-returns',
    autoAdvance: true,
  },
  {
    id: 'tut-clean-supply',
    phase: GamePhase.EXECUTION,
    title: 'Clean Supply Ducts',
    description: 'Now clean the supply trunk and branch ducts. Use the agitation wand on each duct section. The debris percentage will decrease with each cleaning pass. Keep going until all sections are clean.',
    targetMeshPrefix: 'duct_',
    requiredTaskId: 'clean-supply',
    autoAdvance: true,
  },
  // COMPLETION
  {
    id: 'tut-patch',
    phase: GamePhase.COMPLETION,
    title: 'Patch Access Holes',
    description: 'For 1" holes: use pop plugs. For 8" holes: sheet metal patch → screws at corners/sides → mastic around seam → mastic on face → roll insulation → FSK tape (NOT duct tape!). Using duct tape = -10 points.',
    targetMeshPrefix: null,
    requiredTaskId: 'patch-holes',
    autoAdvance: true,
  },
  {
    id: 'tut-pressure-wash',
    phase: GamePhase.COMPLETION,
    title: 'Pressure Wash Grills',
    description: 'Remove all registers/grills (press E on each), take them to the exterior spigot area. Connect garden hose to pressure washer. Spray each grill clean. Scrub stubborn ones with brushes.',
    targetMeshPrefix: null,
    requiredTaskId: 'pressure-wash',
    autoAdvance: true,
  },
  {
    id: 'tut-coils',
    phase: GamePhase.COMPLETION,
    title: 'Clean Coils & Replace Filters',
    description: 'Go to the air handler, open the door. Pick up Coil Cleaner Spray, then press E on the evaporator coils. Also press E on the filter slot to replace the filter. Both are required!',
    targetMeshPrefix: 'air_handler',
    requiredTaskId: 'clean-coils',
    autoAdvance: true,
  },
  {
    id: 'tut-reinstall',
    phase: GamePhase.COMPLETION,
    title: 'Reinstall Registers',
    description: 'Press E on each removed register/grill to reinstall them back in their ceiling positions.',
    targetMeshPrefix: 'register_',
    requiredTaskId: 'reinstall-registers',
    autoAdvance: true,
  },
  // CLEANUP
  {
    id: 'tut-cleanup',
    phase: GamePhase.CLEANUP,
    title: 'Final Cleanup',
    description: 'Pull plastic sheeting, sweep debris with broom/dustpan, pack all equipment back in the van, and do a final walkthrough. Then press N to complete the job and see your scorecard!',
    targetMeshPrefix: null,
    requiredTaskId: null,
    autoAdvance: false,
  },
];

export class TutorialSystem {
  private _scene: Scene;
  private _ui: AdvancedDynamicTexture;
  private _gameState: GameState;
  private _highlight: HighlightLayer;

  private _container: Rectangle;
  private _titleText: TextBlock;
  private _descText: TextBlock;
  private _stepIndicator: TextBlock;
  private _nextBtn: Button;
  private _skipBtn: Button;

  private _currentStepIndex: number = 0;
  private _active: boolean = false;
  private _highlightedMeshes: AbstractMesh[] = [];

  onTutorialEnd: Observable<void> = new Observable();

  constructor(scene: Scene, ui: AdvancedDynamicTexture, gameState: GameState) {
    this._scene = scene;
    this._ui = ui;
    this._gameState = gameState;

    this._highlight = new HighlightLayer('tutorialHighlight', scene);
    this._highlight.blurHorizontalSize = 0.5;
    this._highlight.blurVerticalSize = 0.5;

    // Tutorial overlay panel (bottom-left)
    this._container = new Rectangle('tutorialContainer');
    this._container.width = '420px';
    this._container.height = '200px';
    this._container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._container.left = '15px';
    this._container.top = '-60px';
    this._container.background = '#000000cc';
    this._container.cornerRadius = 6;
    this._container.thickness = 2;
    this._container.color = COLORS.TEXT_PRIMARY;
    this._container.zIndex = 150;
    this._container.isVisible = false;
    this._ui.addControl(this._container);

    // Title
    this._titleText = new TextBlock('tutTitle');
    this._titleText.text = '';
    this._titleText.color = COLORS.TEXT_PRIMARY;
    this._titleText.fontSize = 16;
    this._titleText.fontFamily = UI.FONT_FAMILY;
    this._titleText.height = '28px';
    this._titleText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._titleText.paddingTop = '10px';
    this._titleText.paddingLeft = '15px';
    this._container.addControl(this._titleText);

    // Step indicator
    this._stepIndicator = new TextBlock('tutStep');
    this._stepIndicator.text = '1/15';
    this._stepIndicator.color = COLORS.TEXT_SECONDARY;
    this._stepIndicator.fontSize = 11;
    this._stepIndicator.fontFamily = UI.FONT_FAMILY;
    this._stepIndicator.height = '20px';
    this._stepIndicator.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._stepIndicator.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._stepIndicator.paddingTop = '12px';
    this._stepIndicator.paddingRight = '15px';
    this._container.addControl(this._stepIndicator);

    // Description
    this._descText = new TextBlock('tutDesc');
    this._descText.text = '';
    this._descText.color = COLORS.TEXT_WHITE;
    this._descText.fontSize = 12;
    this._descText.fontFamily = UI.FONT_FAMILY;
    this._descText.textWrapping = true;
    this._descText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._descText.paddingTop = '38px';
    this._descText.paddingLeft = '15px';
    this._descText.paddingRight = '15px';
    this._descText.height = '120px';
    this._container.addControl(this._descText);

    // Next button
    this._nextBtn = Button.CreateSimpleButton('tutNext', 'NEXT >');
    this._nextBtn.width = '80px';
    this._nextBtn.height = '28px';
    this._nextBtn.color = '#000000';
    this._nextBtn.background = COLORS.TEXT_PRIMARY;
    this._nextBtn.fontSize = 12;
    this._nextBtn.fontFamily = UI.FONT_FAMILY;
    this._nextBtn.cornerRadius = 4;
    this._nextBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._nextBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._nextBtn.top = '-10px';
    this._nextBtn.left = '-15px';
    this._nextBtn.onPointerUpObservable.add(() => this._advanceStep());
    this._container.addControl(this._nextBtn);

    // Skip button
    this._skipBtn = Button.CreateSimpleButton('tutSkip', 'SKIP TUTORIAL');
    this._skipBtn.width = '120px';
    this._skipBtn.height = '28px';
    this._skipBtn.color = COLORS.TEXT_SECONDARY;
    this._skipBtn.background = '#333333';
    this._skipBtn.fontSize = 11;
    this._skipBtn.fontFamily = UI.FONT_FAMILY;
    this._skipBtn.cornerRadius = 4;
    this._skipBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._skipBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._skipBtn.top = '-10px';
    this._skipBtn.left = '15px';
    this._skipBtn.onPointerUpObservable.add(() => this.stop());
    this._container.addControl(this._skipBtn);

    // Auto-advance when tasks complete
    this._gameState.onTaskComplete.add((task) => {
      if (!this._active) return;
      const step = TUTORIAL_STEPS[this._currentStepIndex];
      if (step && step.autoAdvance && step.requiredTaskId === task.id) {
        // Small delay so the player sees the completion
        setTimeout(() => this._advanceStep(), 1000);
      }
    });

    // Advance tutorial display when phase changes
    this._gameState.onPhaseChange.add(() => {
      if (!this._active) return;
      this._syncToPhase();
    });
  }

  get isActive(): boolean {
    return this._active;
  }

  start(): void {
    this._active = true;
    this._currentStepIndex = 0;
    this._container.isVisible = true;
    this._showCurrentStep();
  }

  stop(): void {
    this._active = false;
    this._container.isVisible = false;
    this._clearHighlights();
    this.onTutorialEnd.notifyObservers();
  }

  private _advanceStep(): void {
    this._currentStepIndex++;
    if (this._currentStepIndex >= TUTORIAL_STEPS.length) {
      this.stop();
      return;
    }
    this._showCurrentStep();
  }

  private _syncToPhase(): void {
    // Jump to the first step matching the current phase
    const phase = this._gameState.currentPhase;
    for (let i = this._currentStepIndex; i < TUTORIAL_STEPS.length; i++) {
      if (TUTORIAL_STEPS[i].phase === phase) {
        this._currentStepIndex = i;
        this._showCurrentStep();
        return;
      }
    }
  }

  private _showCurrentStep(): void {
    const step = TUTORIAL_STEPS[this._currentStepIndex];
    if (!step) {
      this.stop();
      return;
    }

    this._titleText.text = step.title;
    this._descText.text = step.description;
    this._stepIndicator.text = `${this._currentStepIndex + 1}/${TUTORIAL_STEPS.length}`;

    // Show/hide next button based on autoAdvance
    this._nextBtn.isVisible = !step.autoAdvance;

    // Highlight target meshes
    this._clearHighlights();
    if (step.targetMeshPrefix) {
      const meshes = this._scene.meshes.filter(
        m => m.name.startsWith(step.targetMeshPrefix!)
      );
      for (const mesh of meshes) {
        this._highlight.addMesh(mesh as any, Color3.FromHexString('#FFD700'));
        this._highlightedMeshes.push(mesh);
      }
    }
  }

  private _clearHighlights(): void {
    for (const mesh of this._highlightedMeshes) {
      this._highlight.removeMesh(mesh as any);
    }
    this._highlightedMeshes = [];
  }

  dispose(): void {
    this._clearHighlights();
    this._highlight.dispose();
    this.onTutorialEnd.clear();
  }
}
