import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, Mesh, Observable } from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { PROBLEMS, ProblemDef } from '../data/problems';
import { GameState, GamePhase } from './GameState';
import { COLORS, UI, TIMING } from '../utils/constants';

export interface ActiveProblem {
  def: ProblemDef;
  triggered: boolean;
  resolved: boolean;
  mesh: Mesh | null;
  timeTriggered: number;
}

export interface ProblemEvent {
  problemId: string;
  type: 'triggered' | 'resolved_correct' | 'resolved_incorrect' | 'ignored';
  message: string;
}

export class ProblemSystem {
  private _scene: Scene;
  private _ui: AdvancedDynamicTexture;
  private _gameState: GameState;

  private _activeProblems: ActiveProblem[] = [];
  private _selectedProblems: ProblemDef[] = [];
  private _problemCheckTimer: number = 0;
  private _dialogueVisible: boolean = false;

  // Dialogue UI
  private _dialogueContainer: Rectangle;
  private _dialogueTitle: TextBlock;
  private _dialogueDesc: TextBlock;
  private _dialogueButtonPanel: StackPanel;
  private _currentProblem: ActiveProblem | null = null;

  onProblemEvent: Observable<ProblemEvent> = new Observable();

  constructor(scene: Scene, ui: AdvancedDynamicTexture, gameState: GameState) {
    this._scene = scene;
    this._ui = ui;
    this._gameState = gameState;

    // Dialogue overlay for problem encounters
    this._dialogueContainer = new Rectangle('problemDialogue');
    this._dialogueContainer.width = '450px';
    this._dialogueContainer.height = '280px';
    this._dialogueContainer.cornerRadius = 6;
    this._dialogueContainer.color = COLORS.TEXT_DANGER;
    this._dialogueContainer.thickness = 2;
    this._dialogueContainer.background = '#1a0000ee';
    this._dialogueContainer.zIndex = 250;
    this._dialogueContainer.isVisible = false;
    this._ui.addControl(this._dialogueContainer);

    // Problem title
    this._dialogueTitle = new TextBlock('probTitle');
    this._dialogueTitle.text = '';
    this._dialogueTitle.color = COLORS.TEXT_DANGER;
    this._dialogueTitle.fontSize = 18;
    this._dialogueTitle.fontFamily = UI.FONT_FAMILY;
    this._dialogueTitle.height = '30px';
    this._dialogueTitle.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._dialogueTitle.paddingTop = '15px';
    this._dialogueContainer.addControl(this._dialogueTitle);

    // Problem description
    this._dialogueDesc = new TextBlock('probDesc');
    this._dialogueDesc.text = '';
    this._dialogueDesc.color = COLORS.TEXT_WHITE;
    this._dialogueDesc.fontSize = 13;
    this._dialogueDesc.fontFamily = UI.FONT_FAMILY;
    this._dialogueDesc.textWrapping = true;
    this._dialogueDesc.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._dialogueDesc.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._dialogueDesc.paddingTop = '50px';
    this._dialogueDesc.paddingLeft = '20px';
    this._dialogueDesc.paddingRight = '20px';
    this._dialogueDesc.height = '100px';
    this._dialogueContainer.addControl(this._dialogueDesc);

    // Response buttons
    this._dialogueButtonPanel = new StackPanel('probButtons');
    this._dialogueButtonPanel.width = '400px';
    this._dialogueButtonPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._dialogueButtonPanel.top = '-15px';
    this._dialogueContainer.addControl(this._dialogueButtonPanel);
  }

  /**
   * Select random problems for the scenario. Call at game start.
   */
  initProblems(count: number = 3, scenarioId: string = 'commercial-office'): void {
    // Shuffle and pick
    const available = [...PROBLEMS];
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    this._selectedProblems = available.slice(0, count);
    this._activeProblems = [];
  }

  /**
   * Check if any problems should trigger. Call from render loop or on interval.
   */
  update(deltaTime: number): void {
    this._problemCheckTimer += deltaTime;
    if (this._problemCheckTimer < TIMING.PROBLEM_CHECK_INTERVAL / 1000) return;
    this._problemCheckTimer = 0;

    const phase = this._gameState.currentPhase;

    for (const def of this._selectedProblems) {
      // Check if already triggered
      if (this._activeProblems.some(p => p.def.id === def.id)) continue;

      // Check if this problem should trigger in current phase
      if (def.triggerPhase !== phase) continue;

      // Trigger the problem
      this._triggerProblem(def);
      break; // Only trigger one per check
    }
  }

  private _triggerProblem(def: ProblemDef): void {
    let mesh: Mesh | null = null;

    // Create visual indicator for certain problems
    switch (def.id) {
      case 'fire-damper':
        mesh = this._createFireDamperMesh();
        break;
      case 'dead-animal':
        mesh = this._createDeadAnimalMesh();
        break;
      case 'asbestos-indicators':
        mesh = this._createAsbestosMesh();
        break;
    }

    const problem: ActiveProblem = {
      def,
      triggered: true,
      resolved: false,
      mesh,
      timeTriggered: this._gameState.elapsedTime,
    };

    this._activeProblems.push(problem);
    this._gameState.onProblemTrigger.notifyObservers(def.id);

    this.onProblemEvent.notifyObservers({
      problemId: def.id,
      type: 'triggered',
      message: def.name,
    });

    // Show dialogue
    this._showProblemDialogue(problem);
  }

  private _showProblemDialogue(problem: ActiveProblem): void {
    this._currentProblem = problem;
    this._dialogueVisible = true;

    const urgencyColors: Record<string, string> = {
      low: '#FFAA44',
      medium: '#FF8844',
      high: '#FF4444',
      critical: '#FF0000',
    };

    this._dialogueTitle.text = `[${problem.def.urgency.toUpperCase()}] ${problem.def.name}`;
    this._dialogueTitle.color = urgencyColors[problem.def.urgency] ?? COLORS.TEXT_DANGER;
    this._dialogueDesc.text = problem.def.description;

    // Clear old buttons
    const children = this._dialogueButtonPanel.children.slice();
    for (const child of children) {
      this._dialogueButtonPanel.removeControl(child);
    }

    // Generate response buttons based on problem type
    const responses = this._getResponseOptions(problem.def);
    for (const resp of responses) {
      const btn = Button.CreateSimpleButton(`probBtn_${resp.id}`, resp.text);
      btn.width = '380px';
      btn.height = '32px';
      btn.color = COLORS.TEXT_WHITE;
      btn.fontSize = 12;
      btn.fontFamily = UI.FONT_FAMILY;
      btn.background = resp.correct ? '#2a4a2a' : '#333333';
      btn.cornerRadius = 3;
      btn.thickness = 0;
      btn.paddingTop = '3px';
      btn.onPointerUpObservable.add(() => {
        this._resolveDialogue(problem, resp.correct);
      });
      this._dialogueButtonPanel.addControl(btn);
    }

    this._dialogueContainer.isVisible = true;
  }

  private _getResponseOptions(def: ProblemDef): Array<{ id: string; text: string; correct: boolean }> {
    switch (def.id) {
      case 'fire-damper':
        return [
          { id: 'skip', text: 'Note location, do not disturb, work around it', correct: true },
          { id: 'remove', text: 'Try to remove or open the damper', correct: false },
          { id: 'ignore', text: 'Ignore and continue cleaning through it', correct: false },
        ];
      case 'dead-animal':
        return [
          { id: 'proper', text: 'Put on PPE, bag it carefully, sanitize the area', correct: true },
          { id: 'vacuum', text: 'Vacuum it up with the portable vacuum', correct: false },
          { id: 'leave', text: 'Leave it and clean around it', correct: false },
        ];
      case 'asbestos-indicators':
        return [
          { id: 'stop', text: 'STOP WORK immediately, notify supervisor, evacuate', correct: true },
          { id: 'careful', text: 'Continue carefully, avoiding the suspect material', correct: false },
          { id: 'ignore', text: 'It\'s probably fine, keep working', correct: false },
        ];
      case 'mold-discovery':
        return [
          { id: 'stop', text: 'STOP WORK immediately, notify supervisor', correct: true },
          { id: 'clean', text: 'Try to clean the mold with degreaser', correct: false },
          { id: 'ignore', text: 'Keep cleaning, it\'s just surface mold', correct: false },
        ];
      case 'breaker-trip':
        return [
          { id: 'panel', text: 'Find electrical panel, identify and reset tripped breaker', correct: true },
          { id: 'wait', text: 'Wait for someone else to fix it', correct: false },
          { id: 'skip', text: 'Work without power in that section', correct: false },
        ];
      case 'painted-screws':
        return [
          { id: 'score', text: 'Use scoring knife to cut paint around screw heads', correct: true },
          { id: 'force', text: 'Force the screws out with extra torque', correct: false },
          { id: 'skip', text: 'Skip this register', correct: false },
        ];
      case 'missing-tool':
        return [
          { id: 'van', text: 'Go back to the van to retrieve it', correct: true },
          { id: 'skip', text: 'Try to do without it', correct: false },
          { id: 'borrow', text: 'Ask the building manager for one', correct: false },
        ];
      case 'collapsed-flex':
        return [
          { id: 'report', text: 'Note it and report to supervisor for repair', correct: true },
          { id: 'fix', text: 'Try to re-inflate the collapsed section', correct: false },
          { id: 'ignore', text: 'Ignore it and move on', correct: false },
        ];
      case 'caulked-register':
        return [
          { id: 'score', text: 'Use scoring knife to cut caulk before removing', correct: true },
          { id: 'pry', text: 'Pry it off with a screwdriver', correct: false },
          { id: 'skip', text: 'Leave it in place and skip it', correct: false },
        ];
      case 'stripped-screw':
        return [
          { id: 'extract', text: 'Use extraction bit or pliers to remove', correct: true },
          { id: 'drill', text: 'Drill the screw out completely', correct: false },
          { id: 'skip', text: 'Leave it and skip the register', correct: false },
        ];
      default:
        return [
          { id: 'correct', text: def.correctResponse, correct: true },
          { id: 'ignore', text: 'Ignore the problem', correct: false },
        ];
    }
  }

  private _resolveDialogue(problem: ActiveProblem, correct: boolean): void {
    problem.resolved = true;
    this._dialogueContainer.isVisible = false;
    this._dialogueVisible = false;
    this._currentProblem = null;

    if (correct) {
      if (problem.def.scoreImpactCorrect > 0) {
        this._gameState.applyBonus(problem.def.scoreImpactCorrect, `Correct response: ${problem.def.name}`);
      } else if (problem.def.scoreImpactCorrect < 0) {
        this._gameState.applyDeduction(Math.abs(problem.def.scoreImpactCorrect), `Time penalty: ${problem.def.name}`);
      }
      this.onProblemEvent.notifyObservers({
        problemId: problem.def.id,
        type: 'resolved_correct',
        message: `Correct! ${problem.def.correctResponse}`,
      });
    } else {
      this._gameState.applyDeduction(Math.abs(problem.def.scoreImpactIncorrect), `Wrong response: ${problem.def.name}`);
      this.onProblemEvent.notifyObservers({
        problemId: problem.def.id,
        type: 'resolved_incorrect',
        message: `Incorrect! Should have: ${problem.def.correctResponse}`,
      });
    }

    // Remove visual indicator
    if (problem.mesh) {
      problem.mesh.dispose();
      problem.mesh = null;
    }
  }

  /**
   * Handle interaction with a problem-related mesh.
   */
  handleInteraction(meshName: string): boolean {
    // Fire damper
    if (meshName.startsWith('problem_fire_damper')) {
      const problem = this._activeProblems.find(p => p.def.id === 'fire-damper' && !p.resolved);
      if (problem) {
        this._showProblemDialogue(problem);
        return true;
      }
    }
    // Dead animal
    if (meshName.startsWith('problem_dead_animal')) {
      const problem = this._activeProblems.find(p => p.def.id === 'dead-animal' && !p.resolved);
      if (problem) {
        this._showProblemDialogue(problem);
        return true;
      }
    }
    // Asbestos
    if (meshName.startsWith('problem_asbestos')) {
      const problem = this._activeProblems.find(p => p.def.id === 'asbestos-indicators' && !p.resolved);
      if (problem) {
        this._showProblemDialogue(problem);
        return true;
      }
    }
    return false;
  }

  private _createFireDamperMesh(): Mesh {
    const damper = MeshBuilder.CreateBox('problem_fire_damper', {
      width: 0.5, height: 0.3, depth: 0.5,
    }, this._scene);
    // Place in a duct run area
    damper.position = new Vector3(-3, 3.1, -5);
    const mat = new StandardMaterial('mat_fire_damper', this._scene);
    mat.diffuseColor = new Color3(0.8, 0.2, 0.1); // Red/orange
    damper.material = mat;
    damper.metadata = { interactive: true, label: 'Fire Damper (DO NOT DISTURB)' };
    return damper;
  }

  private _createDeadAnimalMesh(): Mesh {
    const animal = MeshBuilder.CreateBox('problem_dead_animal', {
      width: 0.2, height: 0.1, depth: 0.3,
    }, this._scene);
    // Place inside a duct section
    animal.position = new Vector3(2, 3.05, -2);
    const mat = new StandardMaterial('mat_dead_animal', this._scene);
    mat.diffuseColor = new Color3(0.3, 0.25, 0.15);
    animal.material = mat;
    animal.metadata = { interactive: true, label: 'Something in the duct...' };
    return animal;
  }

  private _createAsbestosMesh(): Mesh {
    const indicator = MeshBuilder.CreateBox('problem_asbestos', {
      width: 1.0, height: 0.1, depth: 1.0,
    }, this._scene);
    // Place on a wall/ceiling
    indicator.position = new Vector3(-7, 2.8, -5);
    const mat = new StandardMaterial('mat_asbestos', this._scene);
    mat.diffuseColor = new Color3(0.7, 0.7, 0.65);
    mat.alpha = 0.8;
    indicator.material = mat;
    indicator.metadata = { interactive: true, label: 'Suspicious Building Material' };
    return indicator;
  }

  get isDialogueVisible(): boolean {
    return this._dialogueVisible;
  }

  get activeProblems(): ReadonlyArray<ActiveProblem> {
    return this._activeProblems;
  }

  dispose(): void {
    for (const problem of this._activeProblems) {
      if (problem.mesh) problem.mesh.dispose();
    }
    this._activeProblems = [];
    this.onProblemEvent.clear();
  }
}
