export type EquipmentCategory =
  | 'vacuum'
  | 'agitation'
  | 'cutting'
  | 'patching'
  | 'cleaning'
  | 'protection'
  | 'misc';

export interface EquipmentDef {
  id: string;
  name: string;
  category: EquipmentCategory;
  description: string;
  portable: boolean;
  requiredForPhase: string[];
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'agitation-wand', name: 'Agitation Wand', category: 'agitation', description: 'Snake wand with compressed air heads (forward/reverse)', portable: true, requiredForPhase: ['EXECUTION'] },
  { id: 'portable-vacuum', name: 'Portable Vacuum', category: 'vacuum', description: 'Small unit for catching debris at access points', portable: true, requiredForPhase: ['EXECUTION'] },
  { id: 'negative-air', name: 'Negative Air Machine (Squirrel Cage)', category: 'vacuum', description: 'Gas-powered, 8-10" tubing connection', portable: true, requiredForPhase: ['SETUP', 'EXECUTION'] },
  { id: 'tubing-8-10', name: '8-10" Tubing Sections', category: 'misc', description: 'Quick-connect sections for negative air machine', portable: true, requiredForPhase: ['SETUP'] },
  { id: 'tubing-6', name: '6" Tubing Sections', category: 'misc', description: 'Smaller tubing for branch connections', portable: true, requiredForPhase: ['SETUP'] },
  { id: 'quick-connects', name: 'Quick Connects', category: 'misc', description: 'Connectors for tubing sections', portable: true, requiredForPhase: ['SETUP'] },
  { id: 'duct-tape', name: 'Duct Tape', category: 'misc', description: 'For taping tubing joints (NOT for patching)', portable: true, requiredForPhase: ['SETUP'] },
  { id: 'hole-cutter-8', name: '8" Hole Cutter', category: 'cutting', description: 'For cutting 8" access holes in ductwork', portable: true, requiredForPhase: ['EXECUTION'] },
  { id: 'hole-cutter-1', name: '1" Hole Cutter', category: 'cutting', description: 'For cutting 1" inspection holes', portable: true, requiredForPhase: ['EXECUTION'] },
  { id: 'tin-snips', name: 'Tin Snips', category: 'cutting', description: 'For cutting sheet metal', portable: true, requiredForPhase: ['EXECUTION'] },
  { id: 'screw-gun', name: 'Screw Gun', category: 'patching', description: 'For driving screws into patches', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'sheet-metal-patches', name: 'Sheet Metal Patches', category: 'patching', description: 'Square patches for 8" access holes', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'pop-plugs', name: 'Pop Plugs', category: 'patching', description: 'For sealing 1" holes', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'mastic', name: 'Mastic/Putty', category: 'patching', description: 'Sealant for patch seams and faces', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'fsk-tape', name: 'FSK Tape', category: 'patching', description: 'Foil-faced tape for sealing insulation over patches', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'pressure-washer', name: 'Pressure Washer', category: 'cleaning', description: 'For cleaning grills and registers', portable: false, requiredForPhase: ['COMPLETION'] },
  { id: 'garden-hose', name: 'Garden Hose', category: 'cleaning', description: 'Water supply for pressure washer', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'coil-cleaner', name: 'Coil Cleaner Spray', category: 'cleaning', description: 'Chemical spray for cleaning coils', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'degreaser', name: 'Degreaser/Simple Green', category: 'cleaning', description: 'Diluted degreaser for stubborn buildup', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'brushes', name: 'Brushes', category: 'cleaning', description: 'For scrubbing stubborn grime', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'plastic-sheeting', name: 'Plastic Sheeting Rolls', category: 'protection', description: 'Drop cloths for floor protection', portable: true, requiredForPhase: ['ARRIVAL'] },
  { id: 'ppe-masks', name: 'PPE (Masks)', category: 'protection', description: 'Respiratory protection', portable: true, requiredForPhase: ['EXECUTION'] },
  { id: 'broom-dustpan', name: 'Broom/Dustpan', category: 'misc', description: 'For final cleanup', portable: true, requiredForPhase: ['CLEANUP'] },
  { id: 'gas-can', name: 'Gas Can', category: 'misc', description: 'Fuel for squirrel cage with primer bulb', portable: true, requiredForPhase: ['SETUP'] },
  { id: 'screws', name: 'Screws', category: 'patching', description: 'For securing sheet metal patches', portable: true, requiredForPhase: ['COMPLETION'] },
  { id: 'scoring-knife', name: 'Scoring Knife', category: 'cutting', description: 'For cutting through caulk on registers', portable: true, requiredForPhase: ['EXECUTION'] },
];

export type DuctMaterialType = 'rigid' | 'flex' | 'ductboard';

export interface ToolMaterialResult {
  success: boolean;
  penalty: number;
  message: string;
}

export function getToolMaterialResult(toolId: string, material: DuctMaterialType): ToolMaterialResult {
  if (toolId === 'agitation-wand') {
    switch (material) {
      case 'rigid':
        return { success: true, penalty: 0, message: 'Aggressive agitation effective on rigid metal.' };
      case 'flex':
        return { success: false, penalty: 25, message: 'Too aggressive! Flex duct collapsing!' };
      case 'ductboard':
        return { success: false, penalty: 20, message: 'Contact with ductboard releasing fibers!' };
    }
  }
  return { success: true, penalty: 0, message: '' };
}
