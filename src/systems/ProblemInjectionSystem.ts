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
import { PROBLEMS, ProblemDef } from '../data/problems';
import { GameState, GamePhase } from './GameState';
import { COLORS, UI, TIMING } from '../utils/constants';

export type ProblemStatus = 'pending' | 'active' | 'resolved' | 'failed';

export interface ActiveProblem {
  def: ProblemDef;
  status: ProblemStatus;
  triggeredAt: number;
  resolvedAt: number | null;
  indicatorMesh: Mesh | null;
}

export interface ProblemEvent {
  type: 'triggered' | 'resolved' | 'failed' | 'stop_work';
  problemId: string;
  message: string;
}

export class ProblemInjectionSystem {
  private _scene: Scene;
  private _activeProblems: ActiveProblem[] = [];
  private _selectedProblems: ProblemDef[] = [];
  private _triggeredIds: Set<string> = new Set();
  private _meshes: Mesh[] = [];
  private _checkInterval: ReturnType<typeof setInterval> | null = null;
  private _stopWorkActive: boolean = false;

  private _problemUI: AdvancedDynamicTexture | null = null;
  private _problemContainer: Rectangle | null = null;

  // Meshes for specific problems
  private _electricalPanel: Mesh | null = null;
  private _moldIndicator: Mesh | null = null;

  onProblemEvent: Observable<ProblemEvent> = new Observable();

  constructor(scene: Scene) {
    this._scene = scene;
  }

  get isStopWorkActive(): boolean {
    return this._stopWorkActive;
  }

  get activeProblems(): ReadonlyArray<ActiveProblem> {
    return this._activeProblems;
  }

  get isProblemUIOpen(): boolean {
    return this._problemUI !== null;
  }

  /**
   * Initialize: randomly select 2-3 problems for the scenario.
   */
  init(): void {
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const mvpProblems = PROBLEMS.filter(p =>
      ['painted-screws', 'breaker-trip', 'mold-discovery', 'collapsed-flex', 'missing-tool'].includes(p.id)
    );

    // Shuffle and pick
    const shuffled = [...mvpProblems].sort(() => Math.random() - 0.5);
    this._selectedProblems = shuffled.slice(0, count);

    // Always include mold discovery for training (50% chance override)
    if (Math.random() < 0.5 && !this._selectedProblems.find(p => p.id === 'mold-discovery')) {
      const moldDef = mvpProblems.find(p => p.id === 'mold-discovery');
      if (moldDef && this._selectedProblems.length > 0) {
        this._selectedProblems[this._selectedProblems.length - 1] = moldDef;
      }
    }

    // Create environmental elements for problems
    this._createElectricalPanel();

    // Start periodic check for problem triggering
    this._checkInterval = setInterval(() => this._checkTriggers(), TIMING.PROBLEM_CHECK_INTERVAL);

    // Also check on phase changes
    const gs = GameState.getInstance();
    gs.onPhaseChange.add((phase) => this._onPhaseChange(phase));
  }

  private _createElectricalPanel(): void {
    // Electrical panel in hallway for breaker-trip problem
    this._electricalPanel = MeshBuilder.CreateBox('panel_electrical', {
      width: 0.5,
      height: 0.7,
      depth: 0.1,
    }, this._scene);
    this._electricalPanel.position = new Vector3(3, 1.2, -5.9);
    const panelMat = new StandardMaterial('mat_panel', this._scene);
    panelMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
    this._electricalPanel.material = panelMat;
    this._electricalPanel.metadata = {
      interactive: true,
      label: 'Electrical Panel',
    };
    this._meshes.push(this._electricalPanel);
  }

  private _onPhaseChange(phase: GamePhase): void {
    // Trigger problems appropriate for this phase
    for (const prob of this._selectedProblems) {
      if (this._triggeredIds.has(prob.id)) continue;
      if (prob.triggerPhase === phase) {
        // Small delay before triggering
        setTimeout(() => this._triggerProblem(prob), 3000 + Math.random() * 10000);
      }
    }
  }

  private _checkTriggers(): void {
    const gs = GameState.getInstance();
    // Check for problems that match current phase
    for (const prob of this._selectedProblems) {
      if (this._triggeredIds.has(prob.id)) continue;
      if (prob.triggerPhase === gs.currentPhase) {
        // Random chance to trigger
        if (Math.random() < 0.3) {
          this._triggerProblem(prob);
        }
      }
    }
  }

  private _triggerProblem(def: ProblemDef): void {
    if (this._triggeredIds.has(def.id)) return;
    this._triggeredIds.add(def.id);

    const problem: ActiveProblem = {
      def,
      status: 'active',
      triggeredAt: performance.now(),
      resolvedAt: null,
      indicatorMesh: null,
    };

    // Create visual indicator based on problem type
    this._createProblemIndicator(problem);

    this._activeProblems.push(problem);

    if (def.stopWork) {
      this._stopWorkActive = true;
    }

    // Notify
    this.onProblemEvent.notifyObservers({
      type: def.stopWork ? 'stop_work' : 'triggered',
      problemId: def.id,
      message: def.stopWork
        ? `HAZARD ALERT: ${def.name}! STOP WORK IMMEDIATELY!`
        : `PROBLEM: ${def.name} - ${def.description}`,
    });

    // Show problem alert UI
    this._showProblemAlert(problem);
  }

  private _createProblemIndicator(problem: ActiveProblem): void {
    let mesh: Mesh | null = null;

    switch (problem.def.id) {
      case 'painted-screws': {
        // Yellowish highlight on a register area
        mesh = MeshBuilder.CreateBox(`problem_${problem.def.id}`, {
          width: 0.5, height: 0.05, depth: 0.3,
        }, this._scene);
        mesh.position = new Vector3(-7.5, 2.88, -1.5);
        const mat = new StandardMaterial(`mat_prob_${problem.def.id}`, this._scene);
        mat.diffuseColor = new Color3(0.8, 0.7, 0.3);
        mat.alpha = 0.6;
        mesh.material = mat;
        mesh.metadata = { interactive: true, label: 'Painted-Over Screws', problemId: problem.def.id };
        break;
      }

      case 'breaker-trip': {
        // Flashing indicator on electrical panel
        if (this._electricalPanel) {
          const alertMat = new StandardMaterial('mat_breaker_alert', this._scene);
          alertMat.diffuseColor = new Color3(1, 0.2, 0.2);
          alertMat.emissiveColor = new Color3(0.5, 0, 0);
          this._electricalPanel.material = alertMat;
          this._electricalPanel.metadata = {
            ...this._electricalPanel.metadata,
            label: 'Electrical Panel (BREAKER TRIPPED)',
            problemId: problem.def.id,
          };
        }
        break;
      }

      case 'mold-discovery': {
        // Green/black fuzzy patch on duct surface
        mesh = MeshBuilder.CreateBox(`problem_${problem.def.id}`, {
          width: 0.3, height: 0.08, depth: 0.2,
        }, this._scene);
        mesh.position = new Vector3(-3, 3.05, -5);
        const moldMat = new StandardMaterial(`mat_prob_${problem.def.id}`, this._scene);
        moldMat.diffuseColor = new Color3(0.1, 0.25, 0.1);
        moldMat.emissiveColor = new Color3(0, 0.08, 0);
        mesh.material = moldMat;
        mesh.metadata = {
          interactive: true,
          label: 'MOLD GROWTH (HAZARD)',
          problemId: problem.def.id,
        };
        this._moldIndicator = mesh;
        break;
      }

      case 'collapsed-flex': {
        // Deformed duct section
        mesh = MeshBuilder.CreateBox(`problem_${problem.def.id}`, {
          width: 0.4, height: 0.1, depth: 0.4,
        }, this._scene);
        mesh.position = new Vector3(2.5, 3.0, -1.5);
        const flexMat = new StandardMaterial(`mat_prob_${problem.def.id}`, this._scene);
        flexMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
        mesh.material = flexMat;
        mesh.metadata = {
          interactive: true,
          label: 'Collapsed Flex Duct',
          problemId: problem.def.id,
        };
        break;
      }

      case 'missing-tool': {
        // No visual indicator - just a notification
        break;
      }
    }

    if (mesh) {
      problem.indicatorMesh = mesh;
      this._meshes.push(mesh);
    }
  }

  private _showProblemAlert(problem: ActiveProblem): void {
    if (this._problemUI) this._closeProblemUI();

    this._problemUI = AdvancedDynamicTexture.CreateFullscreenUI('problemAlertUI');

    this._problemContainer = new Rectangle('problem_container');
    this._problemContainer.width = '500px';
    this._problemContainer.height = problem.def.stopWork ? '300px' : '250px';
    this._problemContainer.background = problem.def.stopWork ? '#3a0000ee' : '#1a1a1aee';
    this._problemContainer.cornerRadius = 8;
    this._problemContainer.color = problem.def.stopWork ? COLORS.TEXT_DANGER : COLORS.TEXT_PRIMARY;
    this._problemContainer.thickness = 3;
    this._problemContainer.zIndex = 600;
    this._problemUI.addControl(this._problemContainer);

    // Alert icon/header
    const header = new TextBlock('prob_header');
    header.text = problem.def.stopWork ? '!!! HAZARD ALERT !!!' : '-- PROBLEM --';
    header.color = problem.def.stopWork ? COLORS.TEXT_DANGER : COLORS.TEXT_PRIMARY;
    header.fontSize = 20;
    header.fontFamily = UI.FONT_FAMILY;
    header.height = '35px';
    header.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.paddingTop = '15px';
    this._problemContainer.addControl(header);

    // Problem name
    const nameText = new TextBlock('prob_name');
    nameText.text = problem.def.name;
    nameText.color = COLORS.TEXT_WHITE;
    nameText.fontSize = 16;
    nameText.fontFamily = UI.FONT_FAMILY;
    nameText.height = '25px';
    nameText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    nameText.paddingTop = '50px';
    this._problemContainer.addControl(nameText);

    // Description
    const descText = new TextBlock('prob_desc');
    descText.text = problem.def.description;
    descText.color = COLORS.TEXT_SECONDARY;
    descText.fontSize = 13;
    descText.fontFamily = UI.FONT_FAMILY;
    descText.height = '40px';
    descText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    descText.paddingTop = '80px';
    descText.textWrapping = true;
    this._problemContainer.addControl(descText);

    // Required response hint
    const hintText = new TextBlock('prob_hint');
    hintText.text = `Required: ${problem.def.correctResponse}`;
    hintText.color = '#AADDFF';
    hintText.fontSize = 12;
    hintText.fontFamily = UI.FONT_FAMILY;
    hintText.height = '50px';
    hintText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    hintText.paddingTop = '120px';
    hintText.textWrapping = true;
    this._problemContainer.addControl(hintText);

    // Action buttons
    const buttonPanel = new StackPanel('prob_buttons');
    buttonPanel.isVertical = false;
    buttonPanel.height = '40px';
    buttonPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    buttonPanel.paddingBottom = '15px';
    this._problemContainer.addControl(buttonPanel);

    if (problem.def.stopWork) {
      // Stop work button
      const stopBtn = Button.CreateSimpleButton('prob_stop', 'STOP WORK & NOTIFY SUPERVISOR');
      stopBtn.width = '280px';
      stopBtn.height = '32px';
      stopBtn.color = '#000';
      stopBtn.background = COLORS.TEXT_DANGER;
      stopBtn.fontSize = 12;
      stopBtn.fontFamily = UI.FONT_FAMILY;
      stopBtn.cornerRadius = 4;
      stopBtn.onPointerUpObservable.add(() => {
        this._resolveProblem(problem, true);
        this._closeProblemUI();
      });
      buttonPanel.addControl(stopBtn);

      // Ignore button (wrong choice)
      const ignoreBtn = Button.CreateSimpleButton('prob_ignore', 'CONTINUE WORKING');
      ignoreBtn.width = '150px';
      ignoreBtn.height = '32px';
      ignoreBtn.color = COLORS.TEXT_WHITE;
      ignoreBtn.background = '#444444';
      ignoreBtn.fontSize = 12;
      ignoreBtn.fontFamily = UI.FONT_FAMILY;
      ignoreBtn.cornerRadius = 4;
      ignoreBtn.paddingLeft = '10px';
      ignoreBtn.onPointerUpObservable.add(() => {
        this._resolveProblem(problem, false);
        this._closeProblemUI();
      });
      buttonPanel.addControl(ignoreBtn);
    } else {
      // Acknowledge button
      const ackBtn = Button.CreateSimpleButton('prob_ack', 'ACKNOWLEDGE');
      ackBtn.width = '150px';
      ackBtn.height = '32px';
      ackBtn.color = '#000';
      ackBtn.background = COLORS.TEXT_PRIMARY;
      ackBtn.fontSize = 12;
      ackBtn.fontFamily = UI.FONT_FAMILY;
      ackBtn.cornerRadius = 4;
      ackBtn.onPointerUpObservable.add(() => {
        this._closeProblemUI();
        // Non-stop-work problems need to be resolved by interacting with indicator
      });
      buttonPanel.addControl(ackBtn);
    }
  }

  /**
   * Handle interaction with a problem indicator mesh.
   */
  handleProblemInteraction(mesh: AbstractMesh, currentToolId: string | null): boolean {
    const problemId = mesh.metadata?.problemId as string | undefined;
    if (!problemId) return false;

    const problem = this._activeProblems.find(p => p.def.id === problemId && p.status === 'active');
    if (!problem) return false;

    // Check if the player has the right tool/response
    switch (problemId) {
      case 'painted-screws':
        if (currentToolId === 'scoring-knife') {
          this._resolveProblem(problem, true);
          return true;
        }
        this.onProblemEvent.notifyObservers({
          type: 'triggered',
          problemId,
          message: 'Screws are painted over. Use a scoring knife to cut the paint.',
        });
        return true;

      case 'breaker-trip':
        // Interacting with electrical panel resets breaker
        this._resolveProblem(problem, true);
        return true;

      case 'mold-discovery':
        // Should have hit STOP WORK button - interacting directly is wrong
        this.onProblemEvent.notifyObservers({
          type: 'triggered',
          problemId,
          message: 'DO NOT DISTURB MOLD! Stop work and notify supervisor!',
        });
        // Show the alert again
        this._showProblemAlert(problem);
        return true;

      case 'collapsed-flex':
        // Just report it
        this._resolveProblem(problem, true);
        return true;

      case 'missing-tool':
        // Resolved by going back to van
        this._resolveProblem(problem, true);
        return true;
    }

    return false;
  }

  private _resolveProblem(problem: ActiveProblem, correct: boolean): void {
    const gs = GameState.getInstance();

    if (correct) {
      problem.status = 'resolved';
      problem.resolvedAt = performance.now();

      if (problem.def.scoreImpactCorrect > 0) {
        gs.applyBonus(problem.def.scoreImpactCorrect, `Correct response: ${problem.def.name}`);
      } else if (problem.def.scoreImpactCorrect < 0) {
        gs.applyDeduction(Math.abs(problem.def.scoreImpactCorrect), `Problem resolved: ${problem.def.name}`);
      }

      if (problem.def.stopWork) {
        this._stopWorkActive = false;
      }

      this.onProblemEvent.notifyObservers({
        type: 'resolved',
        problemId: problem.def.id,
        message: `Problem resolved: ${problem.def.name}`,
      });

      // Update indicator mesh
      if (problem.indicatorMesh) {
        problem.indicatorMesh.isVisible = false;
      }
      // Reset electrical panel if breaker was the problem
      if (problem.def.id === 'breaker-trip' && this._electricalPanel) {
        const normalMat = new StandardMaterial('mat_panel_normal', this._scene);
        normalMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
        this._electricalPanel.material = normalMat;
        this._electricalPanel.metadata = {
          ...this._electricalPanel.metadata,
          label: 'Electrical Panel',
          problemId: undefined,
        };
      }
    } else {
      problem.status = 'failed';
      problem.resolvedAt = performance.now();

      gs.applyDeduction(
        Math.abs(problem.def.scoreImpactIncorrect),
        `Incorrect response: ${problem.def.name}`
      );

      if (problem.def.stopWork) {
        // Ignoring a stop-work hazard is very bad
        this._stopWorkActive = false; // Allow continuing but with massive penalty
      }

      this.onProblemEvent.notifyObservers({
        type: 'failed',
        problemId: problem.def.id,
        message: `WRONG RESPONSE: ${problem.def.name} - ${Math.abs(problem.def.scoreImpactIncorrect)} points deducted!`,
      });
    }
  }

  /**
   * Force-trigger all remaining problems (for testing or phase end).
   */
  triggerRemaining(): void {
    for (const prob of this._selectedProblems) {
      if (!this._triggeredIds.has(prob.id)) {
        this._triggerProblem(prob);
      }
    }
  }

  private _closeProblemUI(): void {
    if (this._problemUI) {
      this._problemUI.dispose();
      this._problemUI = null;
    }
    this._problemContainer = null;
  }

  dispose(): void {
    this._closeProblemUI();
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
    this.onProblemEvent.clear();
    for (const mesh of this._meshes) {
      mesh.dispose();
    }
    this._meshes = [];
  }
}
