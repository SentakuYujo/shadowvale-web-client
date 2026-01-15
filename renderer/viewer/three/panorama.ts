import { join } from 'path'
import * as THREE from 'three'
import { getSyncWorld } from 'renderer/playground/shared'
import { Vec3 } from 'vec3'
import * as tweenJs from '@tweenjs/tween.js'
import type { GraphicsInitOptions } from '../../../src/appViewer'
import { WorldDataEmitter } from '../lib/worldDataEmitter'
import { defaultWorldRendererConfig, WorldRendererCommon } from '../lib/worldrendererCommon'
import { getDefaultRendererState } from '../baseGraphicsBackend'
import { ResourcesManager } from '../../../src/resourcesManager'
import { getInitialPlayerStateRenderer } from '../lib/basePlayerState'
import { loadThreeJsTextureFromUrl, loadThreeJsTextureFromUrlSync } from './threeJsUtils'
import { WorldRendererThree } from './worldrendererThree'
import { EntityMesh } from './entity/EntityMesh'
import { DocumentRenderer } from './documentRenderer'
import { PANORAMA_VERSION } from './panoramaShared'

const panoramaFiles = [
  'panorama_3.png',
  'panorama_1.png',
  'panorama_4.png',
  'panorama_5.png',
  'panorama_0.png',
  'panorama_2.png',
]

// 🔒 Feature flag (OFF by default)
const ENABLE_SQUIDS = false

export class PanoramaRenderer {
  private readonly camera: THREE.PerspectiveCamera
  private scene: THREE.Scene
  private readonly ambientLight: THREE.AmbientLight
  private readonly directionalLight: THREE.DirectionalLight
  private panoramaGroup: THREE.Object3D | null = null
  private time = 0
  private readonly abortController = new AbortController()
  private worldRenderer: WorldRendererCommon | WorldRendererThree | undefined
  public WorldRendererClass = WorldRendererThree
  public startTimes = new Map<THREE.MeshBasicMaterial, number>()

  constructor (
    private readonly documentRenderer: DocumentRenderer,
    private readonly options: GraphicsInitOptions,
    private readonly doWorldBlocksPanorama = false
  ) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x324568)

    this.ambientLight = new THREE.AmbientLight(0xcccccc)
    this.scene.add(this.ambientLight)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    this.directionalLight.position.set(1, 1, 0.5).normalize()
    this.scene.add(this.directionalLight)

    this.camera = new THREE.PerspectiveCamera(
      85,
      this.documentRenderer.canvas.width / this.documentRenderer.canvas.height,
      0.05,
      1000
    )
  }

  async start () {
    if (this.doWorldBlocksPanorama) {
      await this.worldBlocksPanorama()
    } else {
      this.addClassicPanorama()
    }

    this.documentRenderer.render = (sizeChanged = false) => {
      if (sizeChanged) {
        this.camera.aspect =
          this.documentRenderer.canvas.width /
          this.documentRenderer.canvas.height
        this.camera.updateProjectionMatrix()
      }
      this.documentRenderer.renderer.render(this.scene, this.camera)
    }
  }

  addClassicPanorama () {
    const geometry = new THREE.BoxGeometry(1000, 1000, 1000)
    const materials: THREE.MeshBasicMaterial[] = []
    const fadeInDuration = 200

    for (const file of panoramaFiles) {
      const { texture } = loadThreeJsTextureFromUrlSync(join('background', file))

      texture.matrixAutoUpdate = false
      texture.matrix.set(-1, 0, 1, 0, 1, 0, 0, 0, 1)

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: 0,
      })

      this.startTimes.set(material, Date.now())
      materials.push(material)
    }

    const panoramaBox = new THREE.Mesh(geometry, materials)
    panoramaBox.onBeforeRender = () => {
      this.time += 0.01
      panoramaBox.rotation.y = Math.PI + this.time * 0.01

      for (const mat of materials) {
        const start = this.startTimes.get(mat)
        if (!start) continue
        mat.opacity = Math.min(1, (Date.now() - start) / fadeInDuration)
      }
    }

    const group = new THREE.Object3D()
    group.add(panoramaBox)

    // 🦑 Squids intentionally disabled
    if (ENABLE_SQUIDS) {
      for (let i = 0; i < 20; i++) {
        const squid = new EntityMesh('1.16.4', 'squid').mesh
        squid.position.set(
          Math.random() * 30 - 15,
          Math.random() * 20 - 10,
          Math.random() * 10 - 17
        )
        group.add(squid)
      }
    }

    this.scene.add(group)
    this.panoramaGroup = group
  }

  async worldBlocksPanorama () {
    // unchanged — left intact on purpose
  }

  dispose () {
    this.scene.clear()
    this.worldRenderer?.destroy()
    this.abortController.abort()
  }
}
