export interface ScoreRule {
  id: string;
  description: string;
  points: number;
  type: 'deduction' | 'bonus';
}

export const DEDUCTIONS: ScoreRule[] = [
  { id: 'wrong-order', description: 'Wrong cleaning order (supply before return)', points: -15, type: 'deduction' },
  { id: 'forgot-plastic', description: 'Forgot plastic sheeting', points: -10, type: 'deduction' },
  { id: 'wrong-tool-material', description: 'Wrong tool for material type', points: -10, type: 'deduction' },
  { id: 'aggressive-flex', description: 'Aggressive on flex duct (collapse)', points: -25, type: 'deduction' },
  { id: 'contact-ductboard', description: 'Contact on ductboard (fiber release)', points: -20, type: 'deduction' },
  { id: 'missed-register', description: 'Missed register', points: -5, type: 'deduction' },
  { id: 'bad-patch-screws', description: 'Bad patch - wrong screws', points: -10, type: 'deduction' },
  { id: 'bad-patch-no-mastic', description: 'Bad patch - no mastic', points: -10, type: 'deduction' },
  { id: 'bad-patch-wrong-tape', description: 'Used duct tape instead of FSK tape', points: -10, type: 'deduction' },
  { id: 'no-coil-clean', description: 'Didn\'t clean coils', points: -15, type: 'deduction' },
  { id: 'no-filter-replace', description: 'Didn\'t replace filters', points: -10, type: 'deduction' },
  { id: 'ignored-hazard', description: 'Ignored hazard (mold/asbestos)', points: -30, type: 'deduction' },
  { id: 'forgot-equipment', description: 'Forgot equipment in van (time penalty)', points: -5, type: 'deduction' },
];

export const BONUSES: ScoreRule[] = [
  { id: 'correct-hazard', description: 'Correct hazard protocol', points: 5, type: 'bonus' },
  { id: 'all-registers-first', description: 'All registers identified on first survey', points: 5, type: 'bonus' },
  { id: 'perfect-patch', description: 'Perfect patch (all elements correct)', points: 5, type: 'bonus' },
  { id: 'under-par-time', description: 'Under par time', points: 10, type: 'bonus' },
  { id: 'clean-walkthrough', description: 'Clean final walkthrough', points: 5, type: 'bonus' },
];

export function calculateLetterGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}
