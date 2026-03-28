import { GameState } from './GameState';

export class ScoringSystem {
  private _gameState: GameState;

  constructor() {
    this._gameState = GameState.getInstance();
  }

  applyDeduction(_points: number, _reason: string): void {
    // TODO: Points, deductions, bonuses, final grade
  }

  applyBonus(_points: number, _reason: string): void {
    // TODO: Apply bonus
  }

  getFinalGrade(): string {
    // TODO: Calculate letter grade A-F
    return 'F';
  }

  get score(): number {
    return this._gameState.score;
  }
}
