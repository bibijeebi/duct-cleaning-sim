import { Engine, Scene, Vector3, HemisphericLight, Color4 } from '@babylonjs/core'
import { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui'
import { PHYSICS, COLORS, UI } from './utils/constants'
import { PlayerController } from './systems/PlayerController'
import { GameState, GamePhase } from './systems/GameState'
import { BuildingGenerator, getScenario1Config } from './models/BuildingGenerator'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })

const scene = new Scene(engine)
scene.clearColor = new Color4(0.1, 0.1, 0.12, 1.0)
scene.gravity = new Vector3(0, PHYSICS.GRAVITY, 0)
scene.collisionsEnabled = true

// Ambient light
const light = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
light.intensity = 0.3

// Generate the building
const building = new BuildingGenerator(scene)
building.generate(getScenario1Config())

// Player controller (creates camera, crosshair, pointer lock, raycasting)
const player = new PlayerController(scene, canvas)
player.teleport(new Vector3(0, PHYSICS.PLAYER_HEIGHT, -15)) // Start in parking lot

// Title overlay
const titleUI = AdvancedDynamicTexture.CreateFullscreenUI('titleUI')
const title = new TextBlock('title')
title.text = 'DUCT CLEANING SIMULATOR'
title.color = COLORS.TEXT_PRIMARY
title.fontSize = UI.TITLE_FONT_SIZE
title.fontFamily = UI.FONT_FAMILY
title.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP
title.paddingTop = '20px'
titleUI.addControl(title)

// Phase display
const phaseText = new TextBlock('phaseText')
phaseText.text = 'Phase: PRE-JOB'
phaseText.color = COLORS.TEXT_SECONDARY
phaseText.fontSize = UI.HUD_FONT_SIZE
phaseText.fontFamily = UI.FONT_FAMILY
phaseText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP
phaseText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_LEFT
phaseText.paddingTop = '20px'
phaseText.paddingLeft = '20px'
titleUI.addControl(phaseText)

// Score display
const scoreText = new TextBlock('scoreText')
scoreText.text = 'Score: 100'
scoreText.color = COLORS.TEXT_PRIMARY
scoreText.fontSize = UI.HUD_FONT_SIZE
scoreText.fontFamily = UI.FONT_FAMILY
scoreText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP
scoreText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT
scoreText.paddingTop = '20px'
scoreText.paddingRight = '20px'
titleUI.addControl(scoreText)

// Task list display
const taskText = new TextBlock('taskText')
taskText.text = ''
taskText.color = COLORS.TEXT_SECONDARY
taskText.fontSize = 12
taskText.fontFamily = UI.FONT_FAMILY
taskText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP
taskText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_RIGHT
taskText.textWrapping = true
taskText.width = '300px'
taskText.paddingTop = '50px'
taskText.paddingRight = '20px'
titleUI.addControl(taskText)

// Initialize game state
const gameState = GameState.getInstance()
gameState.initTasks(GameState.getScenario1Tasks())
gameState.startTimer()

// Update task list UI
function updateTaskDisplay(): void {
  const tasks = gameState.currentPhaseTasks
  const lines = tasks.map(t => `${t.completed ? '[x]' : '[ ]'} ${t.description}`)
  taskText.text = lines.join('\n')
}

// Listen for game state changes
gameState.onPhaseChange.add((phase: GamePhase) => {
  phaseText.text = `Phase: ${phase.replace('_', '-')}`
  updateTaskDisplay()
})

gameState.onScoreChange.add((score: number) => {
  scoreText.text = `Score: ${score}`
})

gameState.onTaskComplete.add(() => {
  updateTaskDisplay()
})

// Handle interactions
player.onInteract.add((mesh) => {
  const name = mesh.name

  // Van interaction — mark equipment selected
  if (name.startsWith('van_')) {
    gameState.completeTask('select-equipment')
    gameState.completeTask('vehicle-check')
    gameState.completeTask('read-ticket')
    updateTaskDisplay()
  }

  // Ceiling tile removal
  if (name.startsWith('ceiling_tile_') && mesh.metadata?.removable) {
    mesh.isVisible = false
    mesh.checkCollisions = false
  }

  // Air handler interaction
  if (name.startsWith('air_handler')) {
    gameState.completeTask('find-air-handler')
    gameState.completeTask('identify-system')
    updateTaskDisplay()
  }
})

// Initial task display
updateTaskDisplay()

// Timer display
const timerText = new TextBlock('timerText')
timerText.text = '00:00'
timerText.color = COLORS.TEXT_SECONDARY
timerText.fontSize = UI.HUD_FONT_SIZE
timerText.fontFamily = UI.FONT_FAMILY
timerText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP
timerText.paddingTop = '45px'
titleUI.addControl(timerText)

// Render loop
engine.runRenderLoop(() => {
  scene.render()

  // Update timer
  const secs = gameState.elapsedSeconds
  const mins = Math.floor(secs / 60)
  const s = secs % 60
  timerText.text = `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

window.addEventListener('resize', () => engine.resize())
