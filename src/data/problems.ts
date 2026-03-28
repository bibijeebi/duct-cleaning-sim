export interface ProblemDef {
  id: string;
  name: string;
  description: string;
  triggerPhase: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  correctResponse: string;
  scoreImpactCorrect: number;
  scoreImpactIncorrect: number;
  stopWork: boolean;
}

export const PROBLEMS: ProblemDef[] = [
  {
    id: 'painted-screws',
    name: 'Painted-Over Screws',
    description: 'Register screws are painted over and won\'t turn with standard driver.',
    triggerPhase: 'EXECUTION',
    urgency: 'low',
    correctResponse: 'Use scoring knife to cut paint around screw heads before removing.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -5,
    stopWork: false,
  },
  {
    id: 'breaker-trip',
    name: 'Breaker Trip',
    description: 'Circuit breaker trips while running equipment. Power lost to section.',
    triggerPhase: 'EXECUTION',
    urgency: 'medium',
    correctResponse: 'Find electrical panel, identify tripped breaker, reset it.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -10,
    stopWork: false,
  },
  {
    id: 'mold-discovery',
    name: 'Mold Discovery',
    description: 'Visible mold growth found inside ductwork during cleaning.',
    triggerPhase: 'EXECUTION',
    urgency: 'critical',
    correctResponse: 'STOP WORK immediately. Notify supervisor. Do not disturb mold.',
    scoreImpactCorrect: 5,
    scoreImpactIncorrect: -30,
    stopWork: true,
  },
  {
    id: 'collapsed-flex',
    name: 'Collapsed Flex Duct',
    description: 'A section of flex duct has collapsed and is blocking airflow.',
    triggerPhase: 'EXECUTION',
    urgency: 'medium',
    correctResponse: 'Note the collapsed section. Report to supervisor for repair.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -10,
    stopWork: false,
  },
  {
    id: 'missing-tool',
    name: 'Missing Tool',
    description: 'A needed tool was left in the van.',
    triggerPhase: 'EXECUTION',
    urgency: 'low',
    correctResponse: 'Go back to van to retrieve the tool. Time penalty applies.',
    scoreImpactCorrect: -5,
    scoreImpactIncorrect: -5,
    stopWork: false,
  },
  {
    id: 'asbestos-indicators',
    name: 'Asbestos-Era Building Indicators',
    description: 'Building materials suggest possible asbestos contamination.',
    triggerPhase: 'ARRIVAL',
    urgency: 'critical',
    correctResponse: 'STOP WORK immediately. Notify supervisor. Evacuate work area.',
    scoreImpactCorrect: 5,
    scoreImpactIncorrect: -30,
    stopWork: true,
  },
  {
    id: 'dead-animal',
    name: 'Dead Animal in Ductwork',
    description: 'Decomposing animal found during duct inspection.',
    triggerPhase: 'EXECUTION',
    urgency: 'high',
    correctResponse: 'Use PPE, carefully remove with bag, sanitize area.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -10,
    stopWork: false,
  },
  {
    id: 'fire-damper',
    name: 'Fire Damper Encountered',
    description: 'Fire damper found in duct run. Must not be disturbed.',
    triggerPhase: 'EXECUTION',
    urgency: 'medium',
    correctResponse: 'Do not disturb. Note location. Work around it.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -15,
    stopWork: false,
  },
  {
    id: 'caulked-register',
    name: 'Caulked Register',
    description: 'Register is caulked to ceiling. Standard removal won\'t work.',
    triggerPhase: 'EXECUTION',
    urgency: 'low',
    correctResponse: 'Use scoring knife to cut caulk before removing register.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -5,
    stopWork: false,
  },
  {
    id: 'stripped-screw',
    name: 'Stripped Screw Head',
    description: 'Screw head is stripped and won\'t grip with standard bit.',
    triggerPhase: 'EXECUTION',
    urgency: 'low',
    correctResponse: 'Use extraction bit or pliers to remove stripped screw.',
    scoreImpactCorrect: 0,
    scoreImpactIncorrect: -5,
    stopWork: false,
  },
];
