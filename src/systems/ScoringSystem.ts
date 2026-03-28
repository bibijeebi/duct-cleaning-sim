import { GameState } from './GameState';
import { DEDUCTIONS, BONUSES, calculateLetterGrade } from '../data/scoring';

export interface ScoreBreakdown {
  startingScore: number;
  finalScore: number;
  letterGrade: string;
  deductions: Array<{ rule: string; points: number }>;
  bonuses: Array<{ rule: string; points: number }>;
  totalDeductions: number;
  totalBonuses: number;
}

export class ScoringSystem {
  private _gameState: GameState;

  constructor() {
    this._gameState = GameState.getInstance();
  }

  /**
   * Apply a named deduction from the scoring rules.
   */
  applyNamedDeduction(ruleId: string): void {
    const rule = DEDUCTIONS.find(d => d.id === ruleId);
    if (rule) {
      this._gameState.applyDeduction(Math.abs(rule.points), rule.description);
    }
  }

  /**
   * Apply a named bonus from the scoring rules.
   */
  applyNamedBonus(ruleId: string): void {
    const rule = BONUSES.find(b => b.id === ruleId);
    if (rule) {
      this._gameState.applyBonus(rule.points, rule.description);
    }
  }

  /**
   * Apply a custom deduction not in the predefined rules.
   */
  applyCustomDeduction(points: number, reason: string): void {
    this._gameState.applyDeduction(points, reason);
  }

  /**
   * Apply a custom bonus not in the predefined rules.
   */
  applyCustomBonus(points: number, reason: string): void {
    this._gameState.applyBonus(points, reason);
  }

  /**
   * Get the final letter grade.
   */
  getLetterGrade(): string {
    return calculateLetterGrade(this._gameState.score);
  }

  /**
   * Get a full breakdown of the score for the end-of-job report.
   */
  getBreakdown(): ScoreBreakdown {
    const summary = this._gameState.getScoreSummary();
    return {
      startingScore: 100,
      finalScore: this._gameState.score,
      letterGrade: this.getLetterGrade(),
      deductions: summary.deductions.map(e => ({ rule: e.reason, points: e.points })),
      bonuses: summary.bonuses.map(e => ({ rule: e.reason, points: e.points })),
      totalDeductions: summary.deductions.reduce((sum, e) => sum + e.points, 0),
      totalBonuses: summary.bonuses.reduce((sum, e) => sum + e.points, 0),
    };
  }

  get score(): number {
    return this._gameState.score;
  }
}
