export interface ScenarioConfig {
  id: string;
  name: string;
  difficulty: number;
  description: string;
  systemType: 'split' | 'rtu' | 'ptac' | 'vav';
  supplyRegisters: number;
  returnGrills: number;
  ductMaterial: 'rigid' | 'flex' | 'ductboard' | 'mixed';
  truckAccessible: boolean;
  floors: number;
}

export const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'commercial-office',
    name: 'Commercial Office',
    difficulty: 1,
    description: 'Single-floor office. Split system with air handler in mechanical room.',
    systemType: 'split',
    supplyRegisters: 8,
    returnGrills: 3,
    ductMaterial: 'rigid',
    truckAccessible: true,
    floors: 1,
  },
  {
    id: 'courthouse',
    name: 'Multi-Story Courthouse',
    difficulty: 2,
    description: 'PTAC/fan coil wall units. Short duct runs. Portable equipment required.',
    systemType: 'ptac',
    supplyRegisters: 12,
    returnGrills: 6,
    ductMaterial: 'rigid',
    truckAccessible: false,
    floors: 3,
  },
  {
    id: 'institutional',
    name: 'Industrial/Institutional',
    difficulty: 3,
    description: 'Large RTU on roof. VAV boxes throughout. Mixed materials.',
    systemType: 'vav',
    supplyRegisters: 20,
    returnGrills: 8,
    ductMaterial: 'mixed',
    truckAccessible: true,
    floors: 1,
  },
];
