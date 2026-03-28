import { Engine, Scene, Vector3, HemisphericLight, Color4, KeyboardEventTypes } from '@babylonjs/core'
import { AdvancedDynamicTexture } from '@babylonjs/gui'
import { PHYSICS, COLORS, BUILDING } from './utils/constants'
import { PlayerController } from './systems/PlayerController'
import { GameState, GamePhase } from './systems/GameState'
import { BuildingGenerator, getScenario1Config } from './models/BuildingGenerator'
import { HVACSystem } from './systems/HVACSystem'
import { EquipmentSystem } from './systems/EquipmentSystem'
import { ScoringSystem } from './systems/ScoringSystem'
import { PatchingSystem } from './systems/PatchingSystem'
import { PressureWashSystem } from './systems/PressureWashSystem'
import { ProblemInjectionSystem } from './systems/ProblemInjectionSystem'
import { DuctCrossSection } from './scenes/DuctCrossSection'
import { HUD } from './ui/HUD'
import { EquipmentSelect } from './ui/EquipmentSelect'
import { PhaseOverlay } from './ui/PhaseOverlay'
import { ScoreCard } from './ui/ScoreCard'
import { AudioManager } from './utils/audio'
import { TutorialSystem } from './systems/TutorialSystem'
import { MainMenu } from './scenes/MainMenu'
import { ProblemSystem } from './systems/ProblemSystem'

// --- Engine & Scene ---
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })

const scene = new Scene(engine)
scene.clearColor = new Color4(0.1, 0.1, 0.12, 1.0)
scene.gravity = new Vector3(0, PHYSICS.GRAVITY, 0)
scene.collisionsEnabled = true

const light = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
light.intensity = 0.3

// --- Building ---
const buildingConfig = getScenario1Config()
const building = new BuildingGenerator(scene)
building.generate(buildingConfig)

// --- Player ---
const player = new PlayerController(scene, canvas)
player.teleport(new Vector3(0, PHYSICS.PLAYER_HEIGHT, -15))

// --- Game State ---
const gameState = GameState.getInstance()
gameState.initTasks(GameState.getScenario1Tasks())
gameState.startTimer()

// --- Scoring System ---
const scoringSystem = new ScoringSystem()

// --- HVAC System ---
const hvacSystem = new HVACSystem(scene)
hvacSystem.init(buildingConfig, 'rigid')

// --- Equipment System ---
const equipSystem = new EquipmentSystem(scene)
equipSystem.createVanEquipment(new Vector3(0, 0, -15))

// --- Patching System ---
const patchingSystem = new PatchingSystem(scene)
patchingSystem.init()

// --- Pressure Wash System ---
const pressureWashSystem = new PressureWashSystem(scene)
pressureWashSystem.init()

// --- Problem Injection System ---
const problemInjection = new ProblemInjectionSystem(scene)
problemInjection.init()

// --- Duct Cross-Section (2D cleaning view) ---
const ductCrossSection = new DuctCrossSection(scene)

// --- UI Layer ---
const ui = AdvancedDynamicTexture.CreateFullscreenUI('gameUI')

const hud = new HUD(ui, gameState, equipSystem)
const equipSelect = new EquipmentSelect(ui, equipSystem)
const phaseOverlay = new PhaseOverlay(ui)
const scoreCard = new ScoreCard(ui)

// Problem injection system
const problemSystem = new ProblemSystem(scene, ui, gameState)
problemSystem.initProblems(3)

// Problem event feedback → HUD
problemSystem.onProblemEvent.add((event) => {
  if (event.type === 'triggered') {
    hud.showMessage(`PROBLEM: ${event.message}`, 5000)
    audio.playSound('alert_problem')
  } else if (event.type === 'resolved_correct') {
    hud.showMessage(event.message, 4000)
    audio.playSound('alert_success')
  } else if (event.type === 'resolved_incorrect') {
    hud.showMessage(event.message, 4000)
    audio.playSound('alert_error')
  }
  hud._updateTasks()
})

// Tutorial system
const tutorial = new TutorialSystem(scene, ui, gameState)

// Main menu
const mainMenu = new MainMenu(scene, ui)
mainMenu.show((options) => {
  if (options.tutorialEnabled) {
    tutorial.start()
  }
})

// --- Audio ---
const audio = new AudioManager(scene)

// Start ambient on first user interaction (browser autoplay policy)
const startAudioOnce = () => {
  audio.startAmbient()
  document.removeEventListener('click', startAudioOnce)
  document.removeEventListener('keydown', startAudioOnce)
}
document.addEventListener('click', startAudioOnce)
document.addEventListener('keydown', startAudioOnce)

// --- Show initial phase overlay ---
phaseOverlay.show(GamePhase.PRE_JOB)

// Track plastic sheeting placement and cleaning order
let plasticLaid = false
let enteredBuilding = false
let tubingConnected = false
let compressorRunning = false
let vacuumsPositioned = false

// --- Helper: check if any overlay is blocking input ---
function isOverlayBlocking(): boolean {
  return equipSelect.isVisible
    || phaseOverlay.isVisible
    || scoreCard.isVisible
    || ductCrossSection.isActive
    || patchingSystem.isPatchUIOpen
    || pressureWashSystem.isWashUIOpen
    || problemInjection.isProblemUIOpen
}

// --- Keyboard: tool switching, phase advance, etc. ---
scene.onKeyboardObservable.add((kbInfo) => {
  if (kbInfo.type !== KeyboardEventTypes.KEYDOWN) return

  // Don't process game keys when overlays are open
  if (mainMenu.isVisible || isOverlayBlocking() || problemSystem.isDialogueVisible) {
    // ESC closes scorecard
    if (kbInfo.event.key === 'Escape' && scoreCard.isVisible) {
      scoreCard.hide()
    }
    return
  }

  const key = kbInfo.event.key

  // Tool slots 1-4
  if (key >= '1' && key <= '4') {
    equipSystem.switchToSlot(parseInt(key) - 1)
    hud.updateInventoryDisplay()
  }

  // Tab: cycle tools
  if (key === 'Tab') {
    kbInfo.event.preventDefault()
    equipSystem.cycleNext()
    hud.updateInventoryDisplay()
  }

  // Q: drop current tool
  if (key === 'q' || key === 'Q') {
    equipSystem.dropCurrent()
    hud.updateInventoryDisplay()
  }

  // M: toggle mute
  if (key === 'm' || key === 'M') {
    const muted = audio.toggleMute()
    hud.showMessage(muted ? 'Audio muted' : 'Audio unmuted')
  }

  // F: toggle airflow arrows
  if (key === 'f' || key === 'F') {
    if (hvacSystem.ductNetwork.airflowVisible) {
      hvacSystem.hideAirflow()
      hud.showMessage('Airflow arrows hidden')
    } else {
      hvacSystem.showAirflow()
      hud.showMessage('Airflow direction shown')
    }
  }

  // N: advance to next phase
  if (key === 'n' || key === 'N') {
    // Block phase advance during stop work
    if (problemInjection.isStopWorkActive) {
      hud.showMessage('STOP WORK is active! Resolve hazard first!')
      return
    }

    const phases = [
      GamePhase.PRE_JOB, GamePhase.ARRIVAL, GamePhase.SETUP,
      GamePhase.EXECUTION, GamePhase.COMPLETION, GamePhase.CLEANUP, GamePhase.SCORED,
    ]
    const currentIdx = phases.indexOf(gameState.currentPhase)
    if (currentIdx < phases.length - 1) {
      const nextPhase = phases[currentIdx + 1]

      // Check for end-of-phase scoring
      if (gameState.currentPhase === GamePhase.COMPLETION) {
        // Check for unpatched holes
        if (patchingSystem.unpatchedCount > 0) {
          scoringSystem.applyCustomDeduction(10 * patchingSystem.unpatchedCount, 'Unpatched access holes')
        }
        // Check if coils cleaned
        if (!hvacSystem.ductNetwork.airHandler.coilsCleaned) {
          scoringSystem.applyNamedDeduction('no-coil-clean')
        }
        // Check if filters replaced
        if (!hvacSystem.ductNetwork.airHandler.filterReplaced) {
          scoringSystem.applyNamedDeduction('no-filter-replace')
        }
        // Check missed registers
        const unidentified = hvacSystem.ductNetwork.registers.filter(r => !r.identified).length
        if (unidentified > 0) {
          for (let i = 0; i < unidentified; i++) {
            scoringSystem.applyNamedDeduction('missed-register')
          }
        }
      }

      if (gameState.currentPhase === GamePhase.CLEANUP) {
        // Check plastic sheeting removed
        if (!plasticLaid) {
          scoringSystem.applyNamedDeduction('forgot-plastic')
        }
        // Clean walkthrough bonus
        const uncompleted = gameState.tasks.filter(t => t.required && !t.completed).length
        if (uncompleted === 0) {
          scoringSystem.applyNamedBonus('clean-walkthrough')
        }
      }

      if (gameState.transitionTo(nextPhase)) {
        phaseOverlay.show(nextPhase)
        audio.playSound('alert_phase')
        hud.showMessage(`Entering: ${nextPhase.replace('_', ' ')}`)

        if (nextPhase === GamePhase.SCORED) {
          gameState.stopTimer()
          // Par time bonus (under 15 minutes)
          if (gameState.elapsedSeconds < 900) {
            scoringSystem.applyNamedBonus('under-par-time')
          }
          scoreCard.show()
        }
      } else {
        hud.showMessage('Complete required tasks before advancing')
      }
    }
  }
})

// --- Interactions ---
player.onInteract.add((mesh) => {
  const name = mesh.name

  // Block interactions during stop work (except problem resolution)
  if (problemInjection.isStopWorkActive) {
    const problemId = mesh.metadata?.problemId as string | undefined
    if (problemId) {
      problemInjection.handleProblemInteraction(mesh, equipSystem.activeToolId)
      return
    }
    hud.showMessage('STOP WORK is active! Resolve hazard first!')
    return
  }

  // Check for problem indicators first
  if (mesh.metadata?.problemId) {
    if (problemInjection.handleProblemInteraction(mesh, equipSystem.activeToolId)) {
      return
    }
  }

  // Equipment near van: toggle loadout or pick up
  if (name.startsWith('equipment_')) {
    if (gameState.currentPhase === GamePhase.PRE_JOB) {
      equipSystem.handleEquipmentInteraction(mesh)
      const equipId = mesh.metadata?.equipmentId as string
      const isIn = equipSystem.isInLoadout(equipId)
      hud.showMessage(`${mesh.metadata?.label}: ${isIn ? 'SELECTED' : 'REMOVED'}`)
    } else {
      const equipId = mesh.metadata?.equipmentId as string
      if (equipSystem.pickUp(equipId)) {
        hud.showMessage(`Picked up: ${mesh.metadata?.label}`)
        hud.updateInventoryDisplay()
      } else {
        hud.showMessage('Hands full! Drop something first (Q)')
      }
    }
    return
  }

  // Van interaction — open equipment select screen in PRE_JOB
  if (name.startsWith('van_')) {
    if (gameState.currentPhase === GamePhase.PRE_JOB) {
      equipSelect.show(() => {
        hud.showMessage('Loadout confirmed!')
        gameState.completeTask('read-ticket')
        gameState.completeTask('vehicle-check')
        hud._updateTasks()
      })
    }
    return
  }

  // Ceiling tile removal
  if (name.startsWith('ceiling_tile_') && mesh.metadata?.removable) {
    mesh.isVisible = false
    mesh.checkCollisions = false
    hud.showMessage('Ceiling tile removed')
    return
  }

  // Access hole patching interaction
  if (mesh.metadata?.holeId) {
    patchingSystem.handleHoleInteraction(mesh, equipSystem.activeToolId)
    return
  }

  // Spigot interaction (pressure wash station)
  if (name.startsWith('spigot_')) {
    pressureWashSystem.handleSpigotInteraction(equipSystem.activeToolId)
    return
  }

  // Pressure washer mesh
  if (name === 'washer_pressure') {
    pressureWashSystem.handleWasherInteraction(equipSystem.activeToolId)
    return
  }

  // Electrical panel
  if (name.startsWith('panel_')) {
    if (mesh.metadata?.problemId) {
      problemInjection.handleProblemInteraction(mesh, equipSystem.activeToolId)
    } else {
      hud.showMessage('Electrical panel - no issues.')
    }
    return
  }

  // HVAC interactions — special handling for duct cleaning mechanic
  if (name.startsWith('duct_') && equipSystem.activeToolId === 'agitation-wand') {
    const section = hvacSystem.ductNetwork.getSectionByMeshName(name)
    if (section) {
      // Check if there's a removed register or access hole providing entry
      const hasAccess = _checkDuctAccess(section.id)
      if (hasAccess) {
        // Switch to 2D cross-section view
        ductCrossSection.show(section, 'left')
        hud.showMessage('Entering duct cross-section view...')
        return
      } else {
        hud.showMessage('Need access point! Remove a register or cut an access hole first.')
        return
      }
    }
  }

  // Duct interaction with hole cutter — cut access holes
  if (name.startsWith('duct_') && (equipSystem.activeToolId === 'hole-cutter-1' || equipSystem.activeToolId === 'hole-cutter-8')) {
    const section = hvacSystem.ductNetwork.getSectionByMeshName(name)
    if (section) {
      const size = equipSystem.activeToolId === 'hole-cutter-1' ? 'small' as const : 'large' as const
      if (patchingSystem.cutHole(section, size, equipSystem.activeToolId)) {
        gameState.completeTask('cut-access')
        hud._updateTasks()
      }
      return
    }
  }

  // Register/grill interactions
  if (name.startsWith('register_') || name.startsWith('grill_')) {
    const reg = hvacSystem.ductNetwork.getRegisterByMeshName(name)

    // When removing a register, add it to pressure wash queue
    if (reg && reg.installed && reg.identified) {
      hvacSystem.handleInteraction(mesh, equipSystem.activeToolId)
      // After removal, add to wash queue
      const updatedReg = hvacSystem.ductNetwork.getRegisterByMeshName(name)
      if (updatedReg && !updatedReg.installed) {
        pressureWashSystem.addGrill(updatedReg)
      }
      return
    }

    // Default HVAC interaction
    if (hvacSystem.handleInteraction(mesh, equipSystem.activeToolId)) {
      return
    }
  }

  // General HVAC interactions (air handler, coils, filter)
  if (hvacSystem.handleInteraction(mesh, equipSystem.activeToolId)) {
    return
  }

  // Problem-related mesh interaction
  if (name.startsWith('problem_')) {
    if (problemSystem.handleInteraction(name)) return
  }

  // PTAC unit interaction — count as air handler found
  if (name.startsWith('ptac_unit_')) {
    gameState.completeTask('find-air-handler')
    gameState.completeTask('identify-system')
    hud._updateTasks()
    hud.showMessage('PTAC unit found — Fan coil system identified')
    return
  }

  // Elevator interaction — teleport between floors
  if (name.startsWith('elevator_')) {
    const currentFloor = mesh.metadata?.elevatorFloor as number ?? 0;
    const targetFloor = (currentFloor + 1) % 3;
    const floorY = targetFloor * BUILDING.WALL_HEIGHT + PHYSICS.PLAYER_HEIGHT
    player.teleport(new Vector3(player.camera.position.x, floorY, player.camera.position.z))
    hud.showMessage(`Elevator: moved to floor ${targetFloor + 1}`)
    audio.playSound('alert_phase')
    return
  }

  // Air handler body — complete tasks
  if (name.startsWith('air_handler')) {
    gameState.completeTask('find-air-handler')
    gameState.completeTask('identify-system')
    hud._updateTasks()
    hud.showMessage('Air handler found — Split system identified')
    return
  }

  // --- Phase-specific contextual interactions ---

  // ARRIVAL: Lay plastic sheeting
  if (gameState.currentPhase === GamePhase.ARRIVAL && equipSystem.activeToolId === 'plastic-sheeting') {
    if (!plasticLaid) {
      plasticLaid = true
      gameState.completeTask('lay-plastic')
      hud._updateTasks()
      hud.showMessage('Plastic sheeting laid under work areas.')
    }
    return
  }

  // ARRIVAL: Enter building detection (when player is inside building bounds)
  if (gameState.currentPhase === GamePhase.ARRIVAL && !enteredBuilding) {
    const pos = player.camera.position
    if (pos.z > -14) { // Inside building area
      enteredBuilding = true
      gameState.completeTask('enter-building')
      hud._updateTasks()
      hud.showMessage('Entered building.')
    }
  }

  // SETUP: Connect tubing (interact with negative air machine + trunk duct)
  if (gameState.currentPhase === GamePhase.SETUP) {
    if (equipSystem.activeToolId === 'tubing-8-10' && !tubingConnected) {
      tubingConnected = true
      gameState.completeTask('connect-tubing')
      hud._updateTasks()
      hud.showMessage('Tubing connected from negative air machine to trunk line.')
    }
    if (equipSystem.activeToolId === 'agitation-wand' && !compressorRunning) {
      compressorRunning = true
      gameState.completeTask('run-compressor')
      hud._updateTasks()
      hud.showMessage('Compressor hose connected for agitation wand.')
    }
    if (equipSystem.activeToolId === 'portable-vacuum' && !vacuumsPositioned) {
      vacuumsPositioned = true
      gameState.completeTask('position-vacuums')
      hud._updateTasks()
      hud.showMessage('Portable vacuums positioned at access points.')
    }
  }

  // CLEANUP: Various cleanup tasks
  if (gameState.currentPhase === GamePhase.CLEANUP) {
    if (equipSystem.activeToolId === 'plastic-sheeting') {
      gameState.completeTask('pull-plastic')
      hud._updateTasks()
      hud.showMessage('Plastic sheeting pulled up.')
    }
    if (equipSystem.activeToolId === 'broom-dustpan') {
      gameState.completeTask('sweep-debris')
      hud._updateTasks()
      hud.showMessage('Debris swept up.')
    }
  }
})

// --- Helper: check if a duct section has an access point ---
function _checkDuctAccess(sectionId: string): boolean {
  // Check for removed registers connected to this section
  const section = hvacSystem.ductNetwork.sections.find(s => s.id === sectionId)
  if (!section) return false

  // Check registers in the same room or connected
  const roomRegisters = hvacSystem.ductNetwork.registers.filter(r =>
    r.roomId === section.roomId && !r.installed
  )
  if (roomRegisters.length > 0) return true

  // Check for cut access holes on this section
  const holes = patchingSystem.holes.filter(h => h.sectionId === sectionId && !h.patched)
  if (holes.length > 0) return true

  return false
}

// --- Duct Cross-Section Events ---
ductCrossSection.onComplete.add((result) => {
  // Apply cleaning to the actual duct network
  const section = hvacSystem.ductNetwork.sections.find(s => s.id === result.sectionId)
  if (section) {
    const cleanAmount = result.debrisRemoved * section.debrisLevel
    hvacSystem.ductNetwork.cleanSection(section.id, cleanAmount)

    if (result.completed) {
      hud.showMessage(`${result.sectionId} fully cleaned!`)
    } else {
      hud.showMessage(`Partial cleaning: ${result.sectionId} - ${Math.floor((1 - section.debrisLevel) * 100)}% clean`)
    }

    // Check cleaning order: returns before supply
    if ((section.type === 'supply' || section.type === 'trunk' || section.type === 'branch')
      && !hvacSystem.ductNetwork.allReturnsCleaned) {
      gameState.applyDeduction(15, 'Wrong cleaning order: supply before return')
      hud.showMessage('PENALTY: Clean return ducts before supply! -15 pts')
    }

    // Update task completion
    if (hvacSystem.ductNetwork.allReturnsCleaned) {
      gameState.completeTask('clean-returns')
    }
    if (hvacSystem.ductNetwork.allSupplyCleaned) {
      gameState.completeTask('clean-supply')
    }
    hud._updateTasks()
  }
})

ductCrossSection.onExit.add(() => {
  hud.showMessage('Returned to 3D view.')
})

// --- Patching System Events ---
patchingSystem.onPatchEvent.add((event) => {
  hud.showMessage(event.message)
  hud._updateTasks()
})

// --- Pressure Wash System Events ---
pressureWashSystem.onWashEvent.add((event) => {
  hud.showMessage(event.message)
  hud._updateTasks()
})

// --- Problem Injection Events ---
problemInjection.onProblemEvent.add((event) => {
  if (event.type === 'stop_work') {
    hud.showMessage(event.message, 10000) // Show longer for critical alerts
  } else {
    hud.showMessage(event.message, 5000)
  }
  hud._updateTasks()
})

// HVAC interaction feedback → HUD messages + audio
hvacSystem.onInteraction.add((event) => {
  hud.showMessage(event.message)
  hud._updateTasks()
  // Play contextual sounds
  if (event.type === 'duct_inspect' && event.success) {
    audio.playSound('wand_blast')
    audio.playSound('debris_rattle')
  } else if (event.type === 'coil_clean' && event.success) {
    audio.playSound('pressure_washer')
  } else if (event.type === 'register_remove' || event.type === 'register_reinstall') {
    audio.playSound('screw_gun')
  }
})

// Equipment change feedback
equipSystem.onEquipmentChange.add((event) => {
  hud.showMessage(event.message)
})

// --- Auto-detect entering building ---
scene.registerBeforeRender(() => {
  // Check if player entered building during ARRIVAL phase
  if (gameState.currentPhase === GamePhase.ARRIVAL && !enteredBuilding) {
    const pos = player.camera.position
    if (pos.z > -14) {
      enteredBuilding = true
      gameState.completeTask('enter-building')
      hud._updateTasks()
      hud.showMessage('Entered building.')
    }
  }

  // Pack equipment task (during CLEANUP, interact near van)
  if (gameState.currentPhase === GamePhase.CLEANUP) {
    const pos = player.camera.position
    if (pos.z < -14) {
      gameState.completeTask('pack-equipment')
      gameState.completeTask('final-walkthrough')
      hud._updateTasks()
    }
  }
})

// Sync HUD crosshair with player controller raycast target
scene.registerBeforeRender(() => {
  // Don't update crosshair during 2D overlay
  if (ductCrossSection.isActive) {
    hud.setCrosshairActive(false)
    hud.hidePrompt()
    return
  }

  const target = player.currentTarget
  if (target) {
    hud.setCrosshairActive(true)
    hud.showPrompt(`Press E to interact [${target.mesh.metadata?.label || target.mesh.name}]`)
  } else {
    hud.setCrosshairActive(false)
    hud.hidePrompt()
  }
})

// --- Render Loop ---
let lastTime = performance.now()
engine.runRenderLoop(() => {
  const now = performance.now()
  const dt = (now - lastTime) / 1000
  lastTime = now

  scene.render()
  hud.updateTimer()

  // Problem system check
  problemSystem.update(dt)

  // Footstep audio based on camera movement
  const cam = player.camera
  const velocity = cam.cameraDirection
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
  audio.updateFootsteps(dt, speed > 0.001 && player.isPointerLocked)
})

window.addEventListener('resize', () => engine.resize())
