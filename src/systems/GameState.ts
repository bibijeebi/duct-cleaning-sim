import { Observable } from '@babylonjs/core';

export enum GamePhase {
  PRE_JOB = 'PRE_JOB',
  ARRIVAL = 'ARRIVAL',
  SETUP = 'SETUP',
  EXECUTION = 'EXECUTION',
  COMPLETION = 'COMPLETION',
  CLEANUP = 'CLEANUP',
  SCORED = 'SCORED',
}

export interface GameTask {
  id: string;
  phase: GamePhase;
  description: string;
  completed: boolean;
}

export class GameState {
  private static _instance: GameState | null = null;

  currentPhase: GamePhase = GamePhase.PRE_JOB;
  score: number = 100;
  tasks: GameTask[] = [];
  elapsedTime: number = 0;

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

  transitionTo(_phase: GamePhase): void {
    // TODO: Phase transition logic with prerequisite checks
  }

  completeTask(_taskId: string): void {
    // TODO: Mark task complete, fire event
  }

  applyDeduction(_points: number, _reason: string): void {
    // TODO: Apply score deduction
  }

  applyBonus(_points: number, _reason: string): void {
    // TODO: Apply score bonus
  }
}
