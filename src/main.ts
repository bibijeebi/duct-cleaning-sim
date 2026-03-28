import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core'
import { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui'

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true })

const scene = new Scene(engine)
scene.clearColor = new Color3(0.1, 0.1, 0.12) as any
scene.gravity = new Vector3(0, -9.81 / 60, 0)
scene.collisionsEnabled = true

// FPS Camera
const camera = new FreeCamera('camera', new Vector3(0, 1.7, -5), scene)
camera.attachControl(canvas, true)
camera.applyGravity = true
camera.checkCollisions = true
camera.ellipsoid = new Vector3(0.4, 0.85, 0.4)
camera.speed = 0.3
camera.angularSensibility = 2000
camera.minZ = 0.1
camera.keysUp = [87]    // W
camera.keysDown = [83]  // S
camera.keysLeft = [65]  // A
camera.keysRight = [68] // D

// Lighting
const light = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
light.intensity = 0.8

// Ground
const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene)
ground.checkCollisions = true
const groundMat = new StandardMaterial('groundMat', scene)
groundMat.diffuseColor = new Color3(0.3, 0.3, 0.3)
ground.material = groundMat

// Test walls
const wallMat = new StandardMaterial('wallMat', scene)
wallMat.diffuseColor = new Color3(0.85, 0.82, 0.78)

const walls = [
  { pos: new Vector3(0, 1.5, 10), scale: new Vector3(20, 3, 0.2) },
  { pos: new Vector3(0, 1.5, -10), scale: new Vector3(20, 3, 0.2) },
  { pos: new Vector3(10, 1.5, 0), scale: new Vector3(0.2, 3, 20) },
  { pos: new Vector3(-10, 1.5, 0), scale: new Vector3(0.2, 3, 20) },
]

walls.forEach((w, i) => {
  const wall = MeshBuilder.CreateBox(`wall_${i}`, { width: 1, height: 1, depth: 1 }, scene)
  wall.position = w.pos
  wall.scaling = w.scale
  wall.checkCollisions = true
  wall.material = wallMat
})

// Test interactive object
const register = MeshBuilder.CreateBox('register_supply_01', { width: 0.6, height: 0.05, depth: 0.3 }, scene)
register.position = new Vector3(2, 2.9, 3)
const regMat = new StandardMaterial('regMat', scene)
regMat.diffuseColor = new Color3(0.7, 0.7, 0.75)
register.material = regMat

// HUD
const ui = AdvancedDynamicTexture.CreateFullscreenUI('ui')

const title = new TextBlock()
title.text = 'DUCT CLEANING SIMULATOR'
title.color = '#FFD700'
title.fontSize = 24
title.fontFamily = 'monospace'
title.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP
title.paddingTop = '20px'
ui.addControl(title)

const instructions = new TextBlock()
instructions.text = 'Click to enable mouse look | WASD to move | ESC to release'
instructions.color = '#aaaaaa'
instructions.fontSize = 14
instructions.fontFamily = 'monospace'
instructions.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_BOTTOM
instructions.paddingBottom = '20px'
ui.addControl(instructions)

// Crosshair
const crosshair = new TextBlock()
crosshair.text = '+'
crosshair.color = '#FFD700'
crosshair.fontSize = 20
crosshair.fontFamily = 'monospace'
ui.addControl(crosshair)

// Render loop
engine.runRenderLoop(() => scene.render())
window.addEventListener('resize', () => engine.resize())
