import { Engine, Scene, Vector3, HemisphericLight, Color4, KeyboardEventTypes } from '@babylonjs/core'
import { AdvancedDynamicTexture } from '@babylonjs/gui'
import { PHYSICS, COLORS } from './utils/constants'
import { PlayerController } from './systems/PlayerController'
import { GameState, GamePhase } from './systems/GameState'
import { BuildingGenerator, getScenario1Config } from './models/BuildingGenerator'
import { HVACSystem } from './systems/HVACSystem'
import { EquipmentSystem } from './systems/EquipmentSystem'
import { HUD } from './ui/HUD'
import { EquipmentSelect } from './ui/EquipmentSelect'
import { PhaseOverlay } from './ui/PhaseOverlay'
import { ScoreCard } from './ui/ScoreCard'
import { AudioManager } from './utils/audio'

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

// --- HVAC System ---
const hvacSystem = new HVACSystem(scene)
hvacSystem.init(buildingConfig, 'rigid')

// --- Equipment System ---
const equipSystem = new EquipmentSystem(scene)
// Place equipment items near the van (exterior parking area center)
equipSystem.createVanEquipment(new Vector3(0, 0, -15))

// --- UI Layer ---
const ui = AdvancedDynamicTexture.CreateFullscreenUI('gameUI')

// HUD (replaces the old inline UI elements)
const hud = new HUD(ui, gameState, equipSystem)

// Equipment Select overlay
const equipSelect = new EquipmentSelect(ui, equipSystem)

// Phase transition overlay
const phaseOverlay = new PhaseOverlay(ui)

// End-of-job scorecard
const scoreCard = new ScoreCard(ui)

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

// --- Keyboard: tool switching (1-4), Q to drop, Tab to cycle, F for airflow ---
scene.onKeyboardObservable.add((kbInfo) => {
  if (kbInfo.type !== KeyboardEventTypes.KEYDOWN) return
  // Don't process game keys when overlays are open
  if (equipSelect.isVisible || phaseOverlay.isVisible || scoreCard.isVisible) {
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
    const phases = [
      GamePhase.PRE_JOB, GamePhase.ARRIVAL, GamePhase.SETUP,
      GamePhase.EXECUTION, GamePhase.COMPLETION, GamePhase.CLEANUP, GamePhase.SCORED,
    ]
    const currentIdx = phases.indexOf(gameState.currentPhase)
    if (currentIdx < phases.length - 1) {
      const nextPhase = phases[currentIdx + 1]
      if (gameState.transitionTo(nextPhase)) {
        phaseOverlay.show(nextPhase)
        audio.playSound('alert_phase')
        hud.showMessage(`Entering: ${nextPhase.replace('_', ' ')}`)

        if (nextPhase === GamePhase.SCORED) {
          gameState.stopTimer()
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

  // Equipment near van: toggle loadout or pick up
  if (name.startsWith('equipment_')) {
    if (gameState.currentPhase === GamePhase.PRE_JOB) {
      // In pre-job, toggle loadout selection
      equipSystem.handleEquipmentInteraction(mesh)
      const equipId = mesh.metadata?.equipmentId as string
      const isIn = equipSystem.isInLoadout(equipId)
      hud.showMessage(`${mesh.metadata?.label}: ${isIn ? 'SELECTED' : 'REMOVED'}`)
    } else {
      // After pre-job, pick up into inventory
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

  // HVAC interactions (air handler, registers, ducts, coils, filter)
  if (hvacSystem.handleInteraction(mesh, equipSystem.activeToolId)) {
    return
  }

  // Air handler body — also complete tasks
  if (name.startsWith('air_handler')) {
    gameState.completeTask('find-air-handler')
    gameState.completeTask('identify-system')
    hud._updateTasks()
    hud.showMessage('Air handler found — Split system identified')
    return
  }
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

// Sync HUD crosshair with player controller raycast target
scene.registerBeforeRender(() => {
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

  // Footstep audio based on camera movement
  const cam = player.camera
  const velocity = cam.cameraDirection
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
  audio.updateFootsteps(dt, speed > 0.001 && player.isPointerLocked)
})

window.addEventListener('resize', () => engine.resize())
