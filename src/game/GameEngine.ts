/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LevelConfig, RunStats, Skin } from './types.ts';
import { createEnemyCharacter, createPlayerCharacter, updateCharacterRig, CharacterRig } from './characterModels.ts';
import { canPerformTakedown, hasLineOfSight, isPointInVisionCone, calculateLevelResults, ObstacleBox } from './stealthRules.ts';
import { sound } from './audio.ts';

export interface EngineCallbacks {
  onStatsUpdate: (stats: {
    coinsCollected: number;
    totalCoins: number;
    guardsEliminated: number;
    totalGuards: number;
    alarmsTriggered: number;
    timeSec: number;
    isHidden: boolean;
    isSneaking: boolean;
    canTakedown: boolean;
    smokeBombs: number;
    keycardCollected: boolean;
    objectiveText: string;
  }) => void;
  onVictory: (results: RunStats) => void;
  onDefeat: (reason: string) => void;
}

interface GuardRuntime {
  id: string;
  configType: 'basic' | 'heavy' | 'elite' | 'boss';
  rig: CharacterRig;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  facingAngle: number;
  targetAngle: number;
  state: 'patrol' | 'suspicious' | 'alarmed' | 'eliminated';
  stateTimer: number;
  currentWaypointIdx: number;
  waypoints: { x: number; z: number; waitTime?: number }[];
  waitTimer: number;
  hp: number;
  maxHp: number;
  suspicionLevel: number; // 0 to 1
  alertCooldown: number;
}

interface CoinRuntime {
  id: string;
  pos: THREE.Vector3;
  mesh: THREE.Group;
  collected: boolean;
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class GameEngine {
  private mount: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private isSoftwareGl: boolean;
  private frameId: number = 0;
  private isDestroyed: boolean = false;
  private isPaused: boolean = false;

  private level: LevelConfig;
  private skin: Skin;
  private callbacks: EngineCallbacks;

  // Runtime Game State
  private playerPos: THREE.Vector3 = new THREE.Vector3();
  private playerVel: THREE.Vector3 = new THREE.Vector3();
  private playerFacingAngle: number = 0;
  private playerRig!: CharacterRig;
  private isSneaking: boolean = false;
  private isSprinting: boolean = false;
  private isHidden: boolean = false;
  private takedownTarget: GuardRuntime | null = null;
  private takedownAnimTimer: number = 0;
  private victoryAnimTimer: number = 0;
  private defeatAnimTimer: number = 0;
  private hitstopTimer: number = 0;

  private guards: GuardRuntime[] = [];
  private coins: CoinRuntime[] = [];
  private obstacleBoxes: ObstacleBox[] = [];
  private environmentMeshes: THREE.Object3D[] = [];
  private keycardMesh: THREE.Group | null = null;
  private hasKeycard: boolean = false;
  private gateMesh: THREE.Mesh | null = null;
  private exitMesh: THREE.Group | null = null;

  private smokeBombsCount: number = 2;
  private smokeZones: { pos: THREE.Vector3; radius: number; duration: number }[] = [];

  // Particle System
  private particles: Particle[] = [];
  private particleMesh!: THREE.InstancedMesh;
  private maxParticles = 300;
  private dummyObj = new THREE.Object3D();

  // Stats
  private coinsCollected: number = 0;
  private totalCoins: number = 0;
  private guardsEliminated: number = 0;
  private totalGuards: number = 0;
  private alarmsTriggered: number = 0;
  private gameTime: number = 0;

  // Controls
  private keys: Record<string, boolean> = {};
  private joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  private cameraYaw: number = 0;
  private cameraPitch: number = 0.55;
  private isDraggingCamera: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  constructor(
    mount: HTMLElement,
    level: LevelConfig,
    skin: Skin,
    initialSmokeBombs: number,
    callbacks: EngineCallbacks
  ) {
    this.mount = mount;
    this.level = level;
    this.skin = skin;
    this.smokeBombsCount = initialSmokeBombs;
    this.callbacks = callbacks;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(level.fogColor);
    this.scene.fog = new THREE.Fog(level.fogColor, 20, 52);

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    // Studio Reflection Environment
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {}

    // Lighting
    this.setupLighting();

    // Environment & Entities
    this.buildEnvironment();
    this.setupPlayer();
    this.setupGuards();
    this.setupCoins();
    this.setupKeycardAndExit();
    this.setupParticles();

    // Event listeners
    this.bindEvents();

    // Start loop
    this.tick = this.tick.bind(this);
    this.tick();
  }

  private setupLighting() {
    // Warm key directional light
    const keyLight = new THREE.DirectionalLight(this.level.lightKeyColor, 1.4);
    keyLight.position.set(12, 20, 10);
    keyLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 45;
      keyLight.shadow.camera.left = -20;
      keyLight.shadow.camera.right = 20;
      keyLight.shadow.camera.top = 20;
      keyLight.shadow.camera.bottom = -20;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Cool hemisphere fill light
    const hemiLight = new THREE.HemisphereLight(
      this.level.lightFillColor,
      this.level.groundColor,
      this.level.ambientIntensity
    );
    this.scene.add(hemiLight);

    // Subtle accent point lights
    const accent1 = new THREE.PointLight(this.level.lightFillColor, 1.2, 18);
    accent1.position.set(-10, 3, 0);
    this.scene.add(accent1);

    const accent2 = new THREE.PointLight(this.level.lightKeyColor, 1.2, 18);
    accent2.position.set(10, 3, 0);
    this.scene.add(accent2);
  }

  /**
   * Generates stylized floor texture.
   */
  private createFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    if (this.level.theme === 'desert') {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#fde68a';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 8 + 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.level.theme === 'techvault') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 256, 256);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.strokeRect(32, 32, 192, 192);
    } else if (this.level.theme === 'penthouse') {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#991b1b'; // Red carpet runner
      ctx.fillRect(64, 0, 128, 256);
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 3;
      ctx.strokeRect(66, 0, 124, 256);
    } else {
      // Warehouse & Rooftop stylized grid tiles
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 256, 256);
      ctx.strokeRect(0, 0, 128, 128);
      ctx.strokeRect(128, 128, 128, 128);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  private buildEnvironment() {
    // Main Floor
    const floorGeo = new THREE.PlaneGeometry(36, 22);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createFloorTexture(),
      roughness: 0.7,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // Build Obstacles
    this.obstacleBoxes = [];
    for (const obs of this.level.obstacles) {
      this.obstacleBoxes.push({
        x: obs.x,
        z: obs.z,
        width: obs.width,
        depth: obs.depth,
      });

      const obsGeo = new THREE.BoxGeometry(obs.width, obs.height, obs.depth);
      const obsColor = obs.color ? new THREE.Color(obs.color) : new THREE.Color(0x64748b);
      const obsMat = new THREE.MeshStandardMaterial({
        color: obsColor,
        roughness: obs.type === 'server' ? 0.3 : 0.65,
        metalness: obs.type === 'server' ? 0.4 : 0.1,
      });

      const obsMesh = new THREE.Mesh(obsGeo, obsMat);
      obsMesh.position.set(obs.x, obs.height / 2, obs.z);
      obsMesh.castShadow = !this.isSoftwareGl;
      obsMesh.receiveShadow = !this.isSoftwareGl;

      if (obs.type === 'gate') {
        this.gateMesh = obsMesh;
      }

      // Add cute cartoon prop details
      if (obs.type === 'crate') {
        // Wood crate border slats
        const borderGeo = new THREE.BoxGeometry(obs.width + 0.04, 0.12, obs.depth + 0.04);
        const borderMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });
        const topRim = new THREE.Mesh(borderGeo, borderMat);
        topRim.position.y = obs.height / 2 - 0.06;
        obsMesh.add(topRim);
        const btmRim = new THREE.Mesh(borderGeo, borderMat);
        btmRim.position.y = -obs.height / 2 + 0.06;
        obsMesh.add(btmRim);
      } else if (obs.type === 'server') {
        // Glowing blinking LED lights on server racks!
        const ledGeo = new THREE.BoxGeometry(0.12, 0.08, obs.depth * 0.7);
        const ledMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.8,
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(obs.width / 2 + 0.01, 0.2, 0);
        obsMesh.add(led);
      } else if (obs.type === 'plant') {
        // Stylized potted palm
        const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, obs.height, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(obs.x, obs.height / 2, obs.z);
        trunk.castShadow = !this.isSoftwareGl;
        this.scene.add(trunk);

        // Canopy leaves
        const leavesGeo = new THREE.SphereGeometry(1.2, 10, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.scale.set(1.4, 0.5, 1.4);
        leaves.position.set(obs.x, obs.height, obs.z);
        this.scene.add(leaves);
        continue;
      }

      this.scene.add(obsMesh);
      this.environmentMeshes.push(obsMesh);
    }
  }

  private setupPlayer() {
    this.playerPos.set(this.level.playerSpawn.x, 0, this.level.playerSpawn.z);
    this.playerFacingAngle = this.level.playerSpawn.angle;

    this.playerRig = createPlayerCharacter(this.skin);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerFacingAngle;
    this.scene.add(this.playerRig.root);
  }

  private setupGuards() {
    this.guards = [];
    this.totalGuards = this.level.guards.length;

    for (const cfg of this.level.guards) {
      const rig = createEnemyCharacter(cfg.type);
      const pos = new THREE.Vector3(cfg.spawn.x, 0, cfg.spawn.z);
      rig.root.position.copy(pos);
      rig.root.rotation.y = cfg.facingAngle;
      this.scene.add(rig.root);

      this.guards.push({
        id: cfg.id,
        configType: cfg.type,
        rig,
        pos,
        targetPos: pos.clone(),
        facingAngle: cfg.facingAngle,
        targetAngle: cfg.facingAngle,
        state: 'patrol',
        stateTimer: 0,
        currentWaypointIdx: 0,
        waypoints: cfg.patrol.length > 0 ? cfg.patrol : [{ x: cfg.spawn.x, z: cfg.spawn.z, waitTime: 2 }],
        waitTimer: 0,
        hp: cfg.maxHp || 1,
        maxHp: cfg.maxHp || 1,
        suspicionLevel: 0,
        alertCooldown: 0,
      });
    }
  }

  private setupCoins() {
    this.coins = [];
    this.totalCoins = this.level.coins.length;

    const coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xca8a04,
      emissiveIntensity: 0.35,
    });

    for (const c of this.level.coins) {
      const coinGroup = new THREE.Group();
      const coinMesh = new THREE.Mesh(coinGeo, coinMat);
      coinMesh.rotation.z = Math.PI / 2;
      coinGroup.add(coinMesh);

      // Soft contact shadow beneath coin
      const shadow = createPlayerCharacter(this.skin).contactShadow.clone();
      shadow.scale.set(0.6, 0.6, 0.6);
      coinGroup.add(shadow);

      coinGroup.position.set(c.x, 0.45, c.z);
      this.scene.add(coinGroup);

      this.coins.push({
        id: c.id,
        pos: new THREE.Vector3(c.x, 0.45, c.z),
        mesh: coinGroup,
        collected: false,
      });
    }
  }

  private setupKeycardAndExit() {
    // Keycard if required
    if (this.level.keycard) {
      const cardGroup = new THREE.Group();
      const cardGeo = new THREE.BoxGeometry(0.4, 0.04, 0.26);
      const cardMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.8,
        metalness: 0.5,
      });
      const card = new THREE.Mesh(cardGeo, cardMat);
      cardGroup.add(card);

      const ringGeo = new THREE.RingGeometry(0.5, 0.6, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      cardGroup.add(ring);

      cardGroup.position.set(this.level.keycard.x, 0.35, this.level.keycard.z);
      this.scene.add(cardGroup);
      this.keycardMesh = cardGroup;
    }

    // Exit point (Helicopter or Getaway Van)
    const exitGroup = new THREE.Group();
    exitGroup.position.set(this.level.exitPoint.x, 0, this.level.exitPoint.z);

    if (this.level.exitPoint.icon === 'helicopter') {
      // Stylized Cartoon Helicopter!
      const heliBodyGeo = new THREE.SphereGeometry(1.2, 16, 12);
      const heliMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.2 });
      const heliBody = new THREE.Mesh(heliBodyGeo, heliMat);
      heliBody.scale.set(1.5, 1, 1);
      heliBody.position.y = 1.4;
      exitGroup.add(heliBody);

      // Rotor blade
      const rotorGeo = new THREE.BoxGeometry(3.6, 0.04, 0.2);
      const rotorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
      const rotor = new THREE.Mesh(rotorGeo, rotorMat);
      rotor.name = 'heli_rotor';
      rotor.position.y = 2.45;
      exitGroup.add(rotor);

      // Skids
      const skidGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8);
      const skidMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const skidL = new THREE.Mesh(skidGeo, skidMat);
      skidL.rotation.x = Math.PI / 2;
      skidL.position.set(-0.8, 0.3, 0);
      exitGroup.add(skidL);
      const skidR = new THREE.Mesh(skidGeo, skidMat);
      skidR.rotation.x = Math.PI / 2;
      skidR.position.set(0.8, 0.3, 0);
      exitGroup.add(skidR);
    } else {
      // Stylized Cartoon Getaway Van!
      const vanGeo = new THREE.BoxGeometry(2.4, 1.6, 3.8);
      const vanMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.2 });
      const van = new THREE.Mesh(vanGeo, vanMat);
      van.position.y = 1.1;
      exitGroup.add(van);

      // Headlights
      const lightGeo = new THREE.SphereGeometry(0.18, 10, 10);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xfef08a,
        emissiveIntensity: 0.9,
      });
      const hl1 = new THREE.Mesh(lightGeo, lightMat);
      hl1.position.set(-0.8, 0.8, -1.9);
      exitGroup.add(hl1);
      const hl2 = new THREE.Mesh(lightGeo, lightMat);
      hl2.position.set(0.8, 0.8, -1.9);
      exitGroup.add(hl2);
    }

    // Pulsing Exit Zone Marker
    const zoneGeo = new THREE.RingGeometry(1.6, 1.9, 24);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const zone = new THREE.Mesh(zoneGeo, zoneMat);
    zone.name = 'exit_zone_ring';
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.03;
    exitGroup.add(zone);

    this.scene.add(exitGroup);
    this.exitMesh = exitGroup;
  }

  private setupParticles() {
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.1,
    });
    this.particleMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);

    // Hide all instances initially
    for (let i = 0; i < this.maxParticles; i++) {
      this.dummyObj.position.set(0, -999, 0);
      this.dummyObj.scale.set(0, 0, 0);
      this.dummyObj.updateMatrix();
      this.particleMesh.setMatrixAt(i, this.dummyObj.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  public spawnParticles(
    pos: THREE.Vector3,
    color: number,
    count: number = 12,
    speed: number = 2.5,
    size: number = 0.25
  ) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.5, (Math.random() - 0.5) * 0.4)),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          Math.random() * speed + 1.2,
          (Math.random() - 0.5) * speed
        ),
        color: c,
        size: size * (0.8 + Math.random() * 0.4),
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
      });
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = true;

    if (e.key === 'Control' || e.key.toLowerCase() === 'c') {
      this.isSneaking = !this.isSneaking;
    }
    if (e.key.toLowerCase() === 'e') {
      this.performTakedown();
    }
    if (e.key === ' ' || e.key.toLowerCase() === 'q') {
      this.triggerSmokeBomb();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private onBlur = () => {
    this.keys = {};
    this.isDraggingCamera = false;
  };

  private onResize = () => {
    if (!this.mount || this.isDestroyed) return;
    const w = this.mount.clientWidth || window.innerWidth;
    const h = this.mount.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onPointerDown = (e: PointerEvent) => {
    // Only drag camera if on the right half or not touching UI
    if (e.clientX > window.innerWidth * 0.35) {
      this.isDraggingCamera = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isDraggingCamera) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.cameraYaw -= dx * 0.006;
      this.cameraPitch = Math.max(0.2, Math.min(1.2, this.cameraPitch + dy * 0.005));
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerUp = () => {
    this.isDraggingCamera = false;
  };

  // Mobile / Virtual Joystick input
  public setJoystickInput(x: number, y: number) {
    this.joystickVector = { x, y };
  }

  public toggleSneak(val?: boolean) {
    this.isSneaking = val !== undefined ? val : !this.isSneaking;
  }

  public setSprinting(val: boolean) {
    this.isSprinting = val;
  }

  public triggerSmokeBomb() {
    if (this.smokeBombsCount <= 0 || this.defeatAnimTimer > 0) return;
    this.smokeBombsCount--;
    sound.playSmoke();

    // Spawn smoke cloud
    this.smokeZones.push({
      pos: this.playerPos.clone(),
      radius: 4.5,
      duration: 5.5,
    });

    this.spawnParticles(this.playerPos, 0x94a3b8, 40, 3.5, 0.45);

    // Confuse nearby guards
    for (const g of this.guards) {
      if (g.state !== 'eliminated') {
        const dist = g.pos.distanceTo(this.playerPos);
        if (dist <= 4.5) {
          g.state = 'suspicious';
          g.suspicionLevel = 0.5;
          g.waitTimer = 4.0;
          if (g.rig.alertTextMesh) {
            this.setAlertBillboard(g.rig, '?');
          }
        }
      }
    }
  }

  public performTakedown() {
    if (!this.takedownTarget || this.takedownAnimTimer > 0 || this.defeatAnimTimer > 0) return;

    const guard = this.takedownTarget;
    sound.playTakedown();
    this.takedownAnimTimer = 0.35;
    this.hitstopTimer = 0.06;

    // Face the target
    const angleToTarget = Math.atan2(guard.pos.z - this.playerPos.z, guard.pos.x - this.playerPos.x);
    this.playerFacingAngle = angleToTarget;

    // Deal damage
    guard.hp--;
    if (guard.hp <= 0) {
      guard.state = 'eliminated';
      this.guardsEliminated++;
      if (guard.rig.alertIconGroup) guard.rig.alertIconGroup.visible = false;
      if (guard.rig.visionConeMesh) guard.rig.visionConeMesh.visible = false;
    } else {
      // Stun boss
      guard.state = 'suspicious';
      guard.waitTimer = 2.0;
    }

    // Comic "POOF" particle explosion + star bursts
    this.spawnParticles(guard.pos, 0xffffff, 25, 4.0, 0.35); // White poof
    this.spawnParticles(guard.pos, 0xfacc15, 15, 3.0, 0.25); // Gold stars
  }

  private setAlertBillboard(rig: CharacterRig, symbol: '?' | '!') {
    if (!rig.alertIconGroup || !rig.alertTextMesh) return;
    rig.alertIconGroup.visible = true;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const isAlarm = symbol === '!';
    ctx.fillStyle = isAlarm ? '#ef4444' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(64, 52, 44, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(50, 90);
    ctx.lineTo(64, 116);
    ctx.lineTo(78, 90);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 64, 52);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    (rig.alertTextMesh.material as THREE.MeshBasicMaterial).map = tex;
    (rig.alertTextMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }

  /**
   * Main game tick loop.
   */
  private tick() {
    if (this.isDestroyed) return;

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);

    if (!this.isPaused) {
      this.updateSimulation(delta);
    }

    // Always render
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDestroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(delta: number) {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= delta;
      return;
    }

    this.gameTime += delta;

    // Update smoke zones
    for (let i = this.smokeZones.length - 1; i >= 0; i--) {
      this.smokeZones[i].duration -= delta;
      if (this.smokeZones[i].duration <= 0) {
        this.smokeZones.splice(i, 1);
      }
    }

    // Check if player is inside smoke zone
    const inSmoke = this.smokeZones.some((s) => s.pos.distanceTo(this.playerPos) <= s.radius);

    // Player Movement
    this.updatePlayer(delta, inSmoke);

    // Guard AI
    this.updateGuards(delta, inSmoke);

    // Coins & Objectives
    this.updateCoins(delta);

    // Update Particles
    this.updateParticles(delta);

    // Animated Environment Props
    this.updateEnvironmentProps(delta);

    // Camera follow with smooth exponential damping
    this.updateCamera(delta);

    // UI Stats dispatch
    this.dispatchStats();
  }

  private updatePlayer(delta: number, inSmoke: boolean) {
    if (this.defeatAnimTimer > 0) {
      this.defeatAnimTimer += delta;
      updateCharacterRig(this.playerRig, 'defeat', 1, delta, this.camera);
      return;
    }

    if (this.victoryAnimTimer > 0) {
      this.victoryAnimTimer += delta;
      updateCharacterRig(this.playerRig, 'victory', 1, delta, this.camera);
      return;
    }

    if (this.takedownAnimTimer > 0) {
      this.takedownAnimTimer -= delta;
      updateCharacterRig(this.playerRig, 'takedown', 1, delta, this.camera);
      return;
    }

    // Calculate movement vector from keyboard & joystick
    let mx = 0;
    let mz = 0;

    if (this.keys['w'] || this.keys['arrowup']) mz -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) mz += 1;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;

    // Add joystick
    if (Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1) {
      mx += this.joystickVector.x;
      mz += this.joystickVector.y;
    }

    const inputLen = Math.hypot(mx, mz);
    const isMoving = inputLen > 0.1;

    let baseSpeed = 5.2;
    if (this.isSneaking) {
      baseSpeed = 2.4;
      if (this.skin.id === 'midnight_cat') baseSpeed *= 1.25;
    } else if (this.isSprinting || this.keys['shift']) {
      baseSpeed = 7.5;
      if (this.skin.id === 'crimson_rogue') baseSpeed *= 1.15;
    }

    if (isMoving) {
      // Normalize and orient relative to camera yaw
      const moveAngle = Math.atan2(mz, mx) + this.cameraYaw;
      const vx = Math.cos(moveAngle) * baseSpeed;
      const vz = Math.sin(moveAngle) * baseSpeed;

      // Desired new pos
      const nextX = this.playerPos.x + vx * delta;
      const nextZ = this.playerPos.z + vz * delta;

      // Obstacle collision resolution (cylinder vs boxes)
      const playerRadius = 0.4;
      let finalX = nextX;
      let finalZ = nextZ;

      for (const box of this.obstacleBoxes) {
        // If gate and unlocked, allow pass
        if (box === this.obstacleBoxes.find(b => b === this.level.obstacles.find(o => o.type === 'gate')) && this.hasKeycard) {
          continue;
        }

        const halfW = box.width / 2 + playerRadius;
        const halfD = box.depth / 2 + playerRadius;

        if (
          finalX > box.x - halfW &&
          finalX < box.x + halfW &&
          this.playerPos.z > box.z - halfD &&
          this.playerPos.z < box.z + halfD
        ) {
          finalX = this.playerPos.x; // Block X
        }

        if (
          this.playerPos.x > box.x - halfW &&
          this.playerPos.x < box.x + halfW &&
          finalZ > box.z - halfD &&
          finalZ < box.z + halfD
        ) {
          finalZ = this.playerPos.z; // Block Z
        }
      }

      this.playerPos.x = finalX;
      this.playerPos.z = finalZ;

      // Smooth facing angle interpolation
      this.playerFacingAngle = moveAngle;
      this.playerRig.root.rotation.y = this.playerFacingAngle;

      // Footstep sound
      if (Math.random() < delta * (this.isSneaking ? 2.5 : 5.5)) {
        sound.playFootstep(this.isSneaking);
      }
    }

    this.playerRig.root.position.copy(this.playerPos);

    // Update Cover Status
    this.isHidden = inSmoke;
    if (!this.isHidden) {
      // Check if near any cover prop
      for (const obs of this.level.obstacles) {
        if (obs.isCover) {
          const dist = Math.hypot(this.playerPos.x - obs.x, this.playerPos.z - obs.z);
          if (dist < Math.max(obs.width, obs.depth) * 0.75 + 0.6) {
            this.isHidden = true;
            break;
          }
        }
      }
    }

    // Set rig transparency slightly when hidden to give visual feedback
    const hiddenOpacity = this.isHidden ? 0.75 : 1.0;
    this.playerRig.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.Material;
        mat.transparent = true;
        mat.opacity = hiddenOpacity;
      }
    });

    // Check for takedown targets
    this.takedownTarget = null;
    for (const guard of this.guards) {
      if (guard.state === 'eliminated') continue;
      const isHeavy = guard.configType === 'heavy';
      if (
        canPerformTakedown(
          { x: this.playerPos.x, z: this.playerPos.z },
          { x: guard.pos.x, z: guard.pos.z },
          guard.facingAngle,
          isHeavy,
          2.4
        )
      ) {
        this.takedownTarget = guard;
        break;
      }
    }

    // Update player animation
    const animState = isMoving ? (this.isSneaking ? 'sneak' : this.isSprinting ? 'run' : 'walk') : 'idle';
    updateCharacterRig(this.playerRig, animState, inputLen, delta, this.camera);
  }

  private updateGuards(delta: number, inSmoke: boolean) {
    for (const guard of this.guards) {
      if (guard.state === 'eliminated') {
        updateCharacterRig(guard.rig, 'defeat', 1, delta, this.camera);
        continue;
      }

      guard.stateTimer += delta;

      // 1. Vision & Detection Check
      const distToPlayer = guard.pos.distanceTo(this.playerPos);
      let visionRange = guard.configType === 'elite' ? 9.0 : guard.configType === 'heavy' ? 6.0 : 7.5;
      let visionFov = guard.configType === 'heavy' ? Math.PI * 0.52 : Math.PI * 0.42;

      // If in smoke, guard vision is heavily impaired
      if (inSmoke) {
        visionRange *= 0.25;
      }

      const inCone = isPointInVisionCone(
        { x: guard.pos.x, z: guard.pos.z },
        guard.facingAngle,
        { x: this.playerPos.x, z: this.playerPos.z },
        visionFov,
        visionRange
      );

      const hasLos = inCone && hasLineOfSight(
        { x: guard.pos.x, z: guard.pos.z },
        { x: this.playerPos.x, z: this.playerPos.z },
        this.obstacleBoxes
      );

      // Detection handling
      if (hasLos && (!this.isHidden || distToPlayer < 2.0)) {
        // Spotted!
        guard.suspicionLevel = Math.min(1.0, guard.suspicionLevel + delta * (this.isSneaking ? 1.5 : 3.5));

        if (guard.suspicionLevel >= 0.8) {
          if (guard.state !== 'alarmed') {
            guard.state = 'alarmed';
            this.alarmsTriggered++;
            sound.playAlarm();
            this.setAlertBillboard(guard.rig, '!');
          }
        } else if (guard.state !== 'suspicious' && guard.state !== 'alarmed') {
          guard.state = 'suspicious';
          sound.playSuspicious();
          this.setAlertBillboard(guard.rig, '?');
        }
      } else {
        // Decay suspicion if not seen
        if (guard.state === 'alarmed') {
          guard.alertCooldown += delta;
          if (guard.alertCooldown > 4.5) {
            guard.state = 'suspicious';
            guard.alertCooldown = 0;
            this.setAlertBillboard(guard.rig, '?');
          }
        } else {
          guard.suspicionLevel = Math.max(0, guard.suspicionLevel - delta * 0.5);
          if (guard.suspicionLevel === 0 && guard.state === 'suspicious') {
            guard.state = 'patrol';
            if (guard.rig.alertIconGroup) guard.rig.alertIconGroup.visible = false;
          }
        }
      }

      // Update vision cone color
      if (guard.rig.visionConeMesh) {
        const coneMat = guard.rig.visionConeMesh.material as THREE.MeshBasicMaterial;
        const edgeLine = guard.rig.visionConeMesh.getObjectByName('vision_cone_edge') as THREE.Line;
        const edgeMat = edgeLine ? (edgeLine.material as THREE.LineBasicMaterial) : null;

        if (guard.state === 'alarmed') {
          coneMat.color.setHex(0xef4444); // Red
          if (edgeMat) edgeMat.color.setHex(0xf87171);
        } else if (guard.state === 'suspicious') {
          coneMat.color.setHex(0xf59e0b); // Amber
          if (edgeMat) edgeMat.color.setHex(0xfbbf24);
        } else {
          coneMat.color.setHex(0x10b981); // Emerald Green
          if (edgeMat) edgeMat.color.setHex(0x34d399);
        }
      }

      // 2. Guard Movement & Behaviors
      if (guard.state === 'alarmed') {
        // Chase player!
        const dx = this.playerPos.x - guard.pos.x;
        const dz = this.playerPos.z - guard.pos.z;
        const dist = Math.hypot(dx, dz);
        guard.facingAngle = Math.atan2(dz, dx);
        guard.rig.root.rotation.y = guard.facingAngle;

        const chaseSpeed = guard.configType === 'heavy' ? 3.0 : 4.4;
        if (dist > 1.2) {
          guard.pos.x += Math.cos(guard.facingAngle) * chaseSpeed * delta;
          guard.pos.z += Math.sin(guard.facingAngle) * chaseSpeed * delta;
        } else {
          // Caught player! Game Over!
          this.triggerDefeat(`Spotted by ${guard.configType.toUpperCase()} Guard!`);
        }
        guard.rig.root.position.copy(guard.pos);
        updateCharacterRig(guard.rig, 'run', 1, delta, this.camera);
      } else if (guard.state === 'suspicious') {
        // Paused, investigating sound
        const angleToPlayer = Math.atan2(this.playerPos.z - guard.pos.z, this.playerPos.x - guard.pos.x);
        guard.facingAngle = THREE.MathUtils.damp(guard.facingAngle, angleToPlayer, 4, delta);
        guard.rig.root.rotation.y = guard.facingAngle;
        updateCharacterRig(guard.rig, 'idle', 0.5, delta, this.camera);
      } else {
        // Normal Patrol
        if (guard.waitTimer > 0) {
          guard.waitTimer -= delta;
          // Look around during wait
          guard.facingAngle += Math.sin(guard.stateTimer * 2) * delta * 0.6;
          guard.rig.root.rotation.y = guard.facingAngle;
          updateCharacterRig(guard.rig, 'idle', 1, delta, this.camera);
        } else {
          const wp = guard.waypoints[guard.currentWaypointIdx];
          const dx = wp.x - guard.pos.x;
          const dz = wp.z - guard.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.3) {
            // Reached waypoint
            guard.waitTimer = wp.waitTime || 1.5;
            guard.currentWaypointIdx = (guard.currentWaypointIdx + 1) % guard.waypoints.length;
            updateCharacterRig(guard.rig, 'idle', 1, delta, this.camera);
          } else {
            guard.facingAngle = Math.atan2(dz, dx);
            guard.rig.root.rotation.y = guard.facingAngle;
            const patrolSpeed = guard.configType === 'heavy' ? 1.4 : 2.2;
            guard.pos.x += Math.cos(guard.facingAngle) * patrolSpeed * delta;
            guard.pos.z += Math.sin(guard.facingAngle) * patrolSpeed * delta;
            guard.rig.root.position.copy(guard.pos);
            updateCharacterRig(guard.rig, 'walk', 1, delta, this.camera);
          }
        }
      }
    }
  }

  private updateCoins(delta: number) {
    for (const c of this.coins) {
      if (c.collected) continue;

      // Gentle spin & hover bob
      c.mesh.rotation.y += delta * 3.5;
      c.mesh.position.y = 0.45 + Math.sin(this.gameTime * 3 + c.pos.x) * 0.08;

      const dist = this.playerPos.distanceTo(c.pos);

      // Magnet pull when close
      if (dist < 2.2) {
        c.pos.lerp(this.playerPos, delta * 6);
        c.mesh.position.copy(c.pos);
      }

      // Collect coin
      if (dist < 0.8) {
        c.collected = true;
        c.mesh.visible = false;
        const multiplier = this.skin.id === 'golden_phantom' ? 2 : 1;
        this.coinsCollected += multiplier;
        sound.playCoin();
        this.spawnParticles(c.pos, 0xfacc15, 8, 2.0, 0.15);
      }
    }

    // Keycard pickup
    if (this.keycardMesh && !this.hasKeycard) {
      this.keycardMesh.rotation.y += delta * 2.5;
      const dist = this.playerPos.distanceTo(this.keycardMesh.position);
      if (dist < 1.2) {
        this.hasKeycard = true;
        this.keycardMesh.visible = false;
        sound.playKeycard();
        this.spawnParticles(this.playerPos, 0x38bdf8, 16, 2.5, 0.2);

        // Open gate
        if (this.gateMesh) {
          this.gateMesh.position.y = -3; // Lower into floor
        }
      }
    }

    // Exit check
    if (this.exitMesh && this.defeatAnimTimer === 0 && this.victoryAnimTimer === 0) {
      const dist = this.playerPos.distanceTo(this.exitMesh.position);
      const allGuardsDefeated = this.guardsEliminated >= this.totalGuards;
      const gateCleared = !this.level.keycard || this.hasKeycard;

      if (dist < 2.2 && allGuardsDefeated && gateCleared) {
        this.triggerVictory();
      }
    }
  }

  private updateParticles(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.pos.addScaledVector(p.vel, delta);
      p.vel.y -= 7.5 * delta; // Gravity
    }

    // Update instanced mesh
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        const progress = p.life / p.maxLife;
        const currentScale = p.size * (1 - progress);
        this.dummyObj.position.copy(p.pos);
        this.dummyObj.scale.set(currentScale, currentScale, currentScale);
        this.dummyObj.updateMatrix();
        this.particleMesh.setMatrixAt(i, this.dummyObj.matrix);
        this.particleMesh.setColorAt(i, p.color);
      } else {
        this.dummyObj.position.set(0, -999, 0);
        this.dummyObj.scale.set(0, 0, 0);
        this.dummyObj.updateMatrix();
        this.particleMesh.setMatrixAt(i, this.dummyObj.matrix);
      }
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private updateEnvironmentProps(delta: number) {
    if (this.exitMesh) {
      const rotor = this.exitMesh.getObjectByName('heli_rotor');
      if (rotor) rotor.rotation.y += delta * 18; // Spinning helicopter blades

      const ring = this.exitMesh.getObjectByName('exit_zone_ring');
      if (ring) {
        ring.scale.setScalar(1 + Math.sin(this.gameTime * 4) * 0.08);
      }
    }
  }

  private updateCamera(delta: number) {
    // 3rd person follow offset
    const camDist = 11;
    const offsetX = Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * camDist;
    const offsetZ = Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * camDist;
    const offsetY = Math.sin(this.cameraPitch) * camDist;

    const targetCamPos = new THREE.Vector3(
      this.playerPos.x + offsetX,
      this.playerPos.y + offsetY,
      this.playerPos.z + offsetZ
    );

    // Smooth exponential damping
    this.camera.position.lerp(targetCamPos, 1 - Math.exp(-8 * delta));
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z);
  }

  private triggerVictory() {
    this.victoryAnimTimer = 0.01;
    sound.playVictory();

    const results = calculateLevelResults({
      timeTakenSec: this.gameTime,
      parTimeSec: this.level.parTimeSec,
      coinsCollected: this.coinsCollected,
      totalCoins: this.totalCoins,
      alarmsTriggered: this.alarmsTriggered,
      guardsEliminated: this.guardsEliminated,
      totalGuards: this.totalGuards,
    });

    const runStats: RunStats = {
      levelId: this.level.id,
      timeSec: Math.round(this.gameTime),
      coinsCollected: this.coinsCollected,
      totalCoins: this.totalCoins,
      guardsEliminated: this.guardsEliminated,
      totalGuards: this.totalGuards,
      alarmsTriggered: this.alarmsTriggered,
      stars: results.stars,
      score: results.finalScore,
      stealthBonus: results.stealthBonus,
      timeBonus: results.timeBonus,
    };

    setTimeout(() => {
      this.callbacks.onVictory(runStats);
    }, 1200);
  }

  private triggerDefeat(reason: string) {
    if (this.defeatAnimTimer > 0) return;
    this.defeatAnimTimer = 0.01;
    sound.playDefeat();

    setTimeout(() => {
      this.callbacks.onDefeat(reason);
    }, 1400);
  }

  private dispatchStats() {
    let objective = `Eliminate Guards (${this.guardsEliminated}/${this.totalGuards})`;
    if (this.level.keycard && !this.hasKeycard) {
      objective = 'Retrieve Blue Keycard to Unlock Gate';
    } else if (this.guardsEliminated >= this.totalGuards) {
      objective = `Reach the ${this.level.exitPoint.label}!`;
    }

    this.callbacks.onStatsUpdate({
      coinsCollected: this.coinsCollected,
      totalCoins: this.totalCoins,
      guardsEliminated: this.guardsEliminated,
      totalGuards: this.totalGuards,
      alarmsTriggered: this.alarmsTriggered,
      timeSec: Math.floor(this.gameTime),
      isHidden: this.isHidden,
      isSneaking: this.isSneaking,
      canTakedown: this.takedownTarget !== null,
      smokeBombs: this.smokeBombsCount,
      keycardCollected: this.hasKeycard,
      objectiveText: objective,
    });
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
    this.clock.start();
  }

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);

    this.scene.clear();
    this.renderer.dispose();
    if (this.mount.contains(canvas)) {
      this.mount.removeChild(canvas);
    }
  }
}
