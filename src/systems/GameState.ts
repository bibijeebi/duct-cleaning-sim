import { Observable } from '@babylonjs/core';
import { SCORING } from '../utils/constants';

export enum GamePhase {
  PRE_JOB = 'PRE_JOB',
  ARRIVAL = 'ARRIVAL',
  SETUP = 'SETUP',
  EXECUTION = 'EXECUTION',
  COMPLETION = 'COMPLETION',
  CLEANUP = 'CLEANUP',
  SCORED = 'SCORED',
}

const PHASE_ORDER: GamePhase[] = [
  GamePhase.PRE_JOB,
  GamePhase.ARRIVAL,
  GamePhase.SETUP,
  GamePhase.EXECUTION,
  GamePhase.COMPLETION,
  GamePhase.CLEANUP,
  GamePhase.SCORED,
];

export interface GameTask {
  id: string;
  phase: GamePhase;
  description: string;
  completed: boolean;
  required: boolean;
}

export interface ScoreEvent {
  points: number;
  reason: string;
  timestamp: number;
}

export interface PhaseTimestamp {
  phase: GamePhase;
  startTime: number;
  endTime: number | null;
}

export class GameState {
  private static _instance: GameState | null = null;

  currentPhase: GamePhase = GamePhase.PRE_JOB;
  score: number = SCORING.STARTING_SCORE;
  tasks: GameTask[] = [];
  scoreHistory: ScoreEvent[] = [];
  phaseTimestamps: PhaseTimestamp[] = [];

  private _startTime: number = 0;
  private _elapsedTime: number = 0;
  private _running: boolean = false;

  // Observables for cross-system communication
  onPhaseChange: Observable<GamePhase> = new Observable<GamePhase>();
  onTaskComplete: Observable<GameTask> = new Observable<GameTask>();
  onScoreChange: Observable<number> = new Observable<number>();
  onProblemTrigger: Observable<string> = new Observable<string>();

  static getInstance(): GameState {
    if (!GameState._instance) {
      GameState._instance = new GameState();
    }
    return GameState._instance;
  }

  static resetInstance(): void {
    GameState._instance = null;
  }

  get elapsedTime(): number {
    if (this._running) {
      return this._elapsedTime + (performance.now() - this._startTime);
    }
    return this._elapsedTime;
  }

  get elapsedSeconds(): number {
    return Math.floor(this.elapsedTime / 1000);
  }

  get currentPhaseTasks(): GameTask[] {
    return this.tasks.filter(t => t.phase === this.currentPhase);
  }

  get currentPhaseComplete(): boolean {
    const required = this.currentPhaseTasks.filter(t => t.required);
    return required.length === 0 || required.every(t => t.completed);
  }

  startTimer(): void {
    if (!this._running) {
      this._startTime = performance.now();
      this._running = true;
    }
  }

  stopTimer(): void {
    if (this._running) {
      this._elapsedTime += performance.now() - this._startTime;
      this._running = false;
    }
  }

  /**
   * Initialize tasks for a scenario. Called at game start.
   */
  initTasks(tasks: GameTask[]): void {
    this.tasks = tasks;
  }

  /**
   * Transition to a new phase. Validates that it's the next phase in sequence.
   * Returns true if transition succeeded.
   */
  transitionTo(phase: GamePhase): boolean {
    const currentIndex = PHASE_ORDER.indexOf(this.currentPhase);
    const targetIndex = PHASE_ORDER.indexOf(phase);

    // Can only go forward one phase at a time
    if (targetIndex !== currentIndex + 1) {
      return false;
    }

    // Check that required tasks in current phase are complete
    if (!this.currentPhaseComplete) {
      return false;
    }

    // End timestamp for current phase
    const currentTimestamp = this.phaseTimestamps.find(
      pt => pt.phase === this.currentPhase && pt.endTime === null
    );
    if (currentTimestamp) {
      currentTimestamp.endTime = performance.now();
    }

    // Set new phase
    this.currentPhase = phase;

    // Start timestamp for new phase
    this.phaseTimestamps.push({
      phase,
      startTime: performance.now(),
      endTime: null,
    });

    this.onPhaseChange.notifyObservers(phase);
    return true;
  }

  /**
   * Mark a task as completed. Fires onTaskComplete event.
   */
  completeTask(taskId: string): boolean {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.completed) {
      return false;
    }

    task.completed = true;
    this.onTaskComplete.notifyObservers(task);
    return true;
  }

  /**
   * Apply a score deduction. Score cannot go below 0.
   */
  applyDeduction(points: number, reason: string): void {
    const deduction = Math.abs(points);
    this.score = Math.max(0, this.score - deduction);
    this.scoreHistory.push({
      points: -deduction,
      reason,
      timestamp: this.elapsedTime,
    });
    this.onScoreChange.notifyObservers(this.score);
  }

  /**
   * Apply a score bonus.
   */
  applyBonus(points: number, reason: string): void {
    const bonus = Math.abs(points);
    this.score += bonus;
    this.scoreHistory.push({
      points: bonus,
      reason,
      timestamp: this.elapsedTime,
    });
    this.onScoreChange.notifyObservers(this.score);
  }

  /**
   * Get letter grade based on current score.
   */
  getLetterGrade(): string {
    const thresholds = SCORING.GRADE_THRESHOLDS;
    for (const [grade, threshold] of Object.entries(thresholds)) {
      if (this.score >= threshold) {
        return grade;
      }
    }
    return 'F';
  }

  /**
   * Get a summary of all deductions and bonuses.
   */
  getScoreSummary(): { deductions: ScoreEvent[]; bonuses: ScoreEvent[] } {
    return {
      deductions: this.scoreHistory.filter(e => e.points < 0),
      bonuses: this.scoreHistory.filter(e => e.points > 0),
    };
  }

  /**
   * Reset everything for a new game.
   */
  reset(): void {
    this.currentPhase = GamePhase.PRE_JOB;
    this.score = SCORING.STARTING_SCORE;
    this.tasks = [];
    this.scoreHistory = [];
    this.phaseTimestamps = [];
    this._elapsedTime = 0;
    this._running = false;
  }

  /**
   * Get tasks for a given scenario ID.
   */
  static getScenarioTasks(scenarioId: string): GameTask[] {
    switch (scenarioId) {
      case 'courthouse':
        return GameState.getScenario2Tasks();
      case 'commercial-office':
      default:
        return GameState.getScenario1Tasks();
    }
  }

  /**
   * Get the default task list for Scenario 1 (Commercial Office).
   */
  static getScenario1Tasks(): GameTask[] {
    return [
      // PRE_JOB
      { id: 'read-ticket', phase: GamePhase.PRE_JOB, description: 'Read job ticket', completed: false, required: true },
      { id: 'select-equipment', phase: GamePhase.PRE_JOB, description: 'Select equipment loadout from van', completed: false, required: true },
      { id: 'vehicle-check', phase: GamePhase.PRE_JOB, description: 'Perform vehicle check', completed: false, required: false },

      // ARRIVAL
      { id: 'enter-building', phase: GamePhase.ARRIVAL, description: 'Enter building', completed: false, required: true },
      { id: 'find-air-handler', phase: GamePhase.ARRIVAL, description: 'Find air handler in mechanical room', completed: false, required: true },
      { id: 'identify-system', phase: GamePhase.ARRIVAL, description: 'Identify HVAC system type', completed: false, required: true },
      { id: 'count-registers', phase: GamePhase.ARRIVAL, description: 'Count supply registers and return grills', completed: false, required: true },
      { id: 'lay-plastic', phase: GamePhase.ARRIVAL, description: 'Lay plastic sheeting under work areas', completed: false, required: true },

      // SETUP
      { id: 'connect-tubing', phase: GamePhase.SETUP, description: 'Connect tubing from negative air machine to trunk line', completed: false, required: true },
      { id: 'run-compressor', phase: GamePhase.SETUP, description: 'Run compressor hose for agitation wand', completed: false, required: true },
      { id: 'position-vacuums', phase: GamePhase.SETUP, description: 'Position portable vacuums at access points', completed: false, required: true },

      // EXECUTION
      { id: 'clean-returns', phase: GamePhase.EXECUTION, description: 'Clean return ducts first (upstream)', completed: false, required: true },
      { id: 'clean-supply', phase: GamePhase.EXECUTION, description: 'Clean supply ducts', completed: false, required: true },
      { id: 'cut-access', phase: GamePhase.EXECUTION, description: 'Cut access holes as needed (every 12ft or at turns)', completed: false, required: false },

      // COMPLETION
      { id: 'patch-holes', phase: GamePhase.COMPLETION, description: 'Patch all access holes to code', completed: false, required: true },
      { id: 'pressure-wash', phase: GamePhase.COMPLETION, description: 'Pressure wash all grills/registers', completed: false, required: true },
      { id: 'clean-coils', phase: GamePhase.COMPLETION, description: 'Clean coils in air handler', completed: false, required: true },
      { id: 'replace-filters', phase: GamePhase.COMPLETION, description: 'Replace filters', completed: false, required: true },
      { id: 'reinstall-registers', phase: GamePhase.COMPLETION, description: 'Reinstall all registers/grills', completed: false, required: true },

      // CLEANUP
      { id: 'pull-plastic', phase: GamePhase.CLEANUP, description: 'Pull plastic sheeting', completed: false, required: true },
      { id: 'sweep-debris', phase: GamePhase.CLEANUP, description: 'Sweep/dustpan all debris', completed: false, required: true },
      { id: 'pack-equipment', phase: GamePhase.CLEANUP, description: 'Pack all equipment', completed: false, required: true },
      { id: 'final-walkthrough', phase: GamePhase.CLEANUP, description: 'Final walkthrough inspection', completed: false, required: true },
    ];
  }

  /**
   * Get the task list for Scenario 2 (Durham County Courthouse).
   */
  static getScenario2Tasks(): GameTask[] {
    return [
      // PRE_JOB
      { id: 'read-ticket', phase: GamePhase.PRE_JOB, description: 'Read job ticket', completed: false, required: true },
      { id: 'select-equipment', phase: GamePhase.PRE_JOB, description: 'Select equipment (portable only!)', completed: false, required: true },
      { id: 'vehicle-check', phase: GamePhase.PRE_JOB, description: 'Perform vehicle check', completed: false, required: false },

      // ARRIVAL
      { id: 'enter-building', phase: GamePhase.ARRIVAL, description: 'Enter courthouse', completed: false, required: true },
      { id: 'find-air-handler', phase: GamePhase.ARRIVAL, description: 'Find PTAC units on each floor', completed: false, required: true },
      { id: 'identify-system', phase: GamePhase.ARRIVAL, description: 'Identify PTAC/fan coil system type', completed: false, required: true },
      { id: 'count-registers', phase: GamePhase.ARRIVAL, description: 'Count registers across all floors', completed: false, required: true },
      { id: 'lay-plastic', phase: GamePhase.ARRIVAL, description: 'Lay plastic sheeting on all floors', completed: false, required: true },

      // SETUP
      { id: 'connect-tubing', phase: GamePhase.SETUP, description: 'Set up portable negative air machine', completed: false, required: true },
      { id: 'run-compressor', phase: GamePhase.SETUP, description: 'Run portable compressor for wand', completed: false, required: true },
      { id: 'position-vacuums', phase: GamePhase.SETUP, description: 'Position portable vacuums per floor', completed: false, required: true },

      // EXECUTION
      { id: 'clean-returns', phase: GamePhase.EXECUTION, description: 'Clean return ducts first (all floors)', completed: false, required: true },
      { id: 'clean-supply', phase: GamePhase.EXECUTION, description: 'Clean supply ducts (all floors)', completed: false, required: true },
      { id: 'cut-access', phase: GamePhase.EXECUTION, description: 'Cut access holes as needed', completed: false, required: false },

      // COMPLETION
      { id: 'patch-holes', phase: GamePhase.COMPLETION, description: 'Patch all access holes to code', completed: false, required: true },
      { id: 'pressure-wash', phase: GamePhase.COMPLETION, description: 'Pressure wash grills/registers', completed: false, required: true },
      { id: 'clean-coils', phase: GamePhase.COMPLETION, description: 'Clean coils in PTAC units', completed: false, required: true },
      { id: 'replace-filters', phase: GamePhase.COMPLETION, description: 'Replace filters in PTAC units', completed: false, required: true },
      { id: 'reinstall-registers', phase: GamePhase.COMPLETION, description: 'Reinstall all registers/grills', completed: false, required: true },

      // CLEANUP
      { id: 'pull-plastic', phase: GamePhase.CLEANUP, description: 'Pull plastic sheeting (all floors)', completed: false, required: true },
      { id: 'sweep-debris', phase: GamePhase.CLEANUP, description: 'Sweep all floors', completed: false, required: true },
      { id: 'pack-equipment', phase: GamePhase.CLEANUP, description: 'Pack equipment back to van', completed: false, required: true },
      { id: 'final-walkthrough', phase: GamePhase.CLEANUP, description: 'Final walkthrough all floors', completed: false, required: true },
    ];
  }
}
