/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { EnemyType, Skin } from './types.ts';

// Shared geometries to conserve memory and optimize draw performance
const headGeo = new THREE.SphereGeometry(0.38, 20, 16);
const hoodGeo = new THREE.SphereGeometry(0.42, 20, 16);
const torsoGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.55, 16);
const heavyTorsoGeo = new THREE.BoxGeometry(0.7, 0.7, 0.45);
const limbGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.38, 12);
const bootGeo = new THREE.BoxGeometry(0.16, 0.14, 0.24);
const eyeGeo = new THREE.SphereGeometry(0.1, 14, 12);
const pupilGeo = new THREE.SphereGeometry(0.055, 12, 10);
const shineGeo = new THREE.SphereGeometry(0.025, 8, 8);
const beltGeo = new THREE.TorusGeometry(0.27, 0.04, 10, 20);
const buckleGeo = new THREE.BoxGeometry(0.1, 0.08, 0.04);
const capGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.14, 16);
const visorGeo = new THREE.BoxGeometry(0.3, 0.03, 0.16);

export interface CharacterRig {
  root: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  scarf?: THREE.Mesh;
  eyes: THREE.Group[];
  alertIconGroup?: THREE.Group;
  alertTextMesh?: THREE.Mesh;
  visionConeMesh?: THREE.Mesh;
  contactShadow: THREE.Mesh;
  animTimer: number;
  blinkTimer: number;
}

/**
 * Creates a soft radial contact shadow disc for clear grounding.
 */
function createContactShadow(radius: number = 0.45): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015; // slightly above floor to prevent Z-fighting
  return mesh;
}

/**
 * Builds the Stylized 3D Cartoon Assassin (Player).
 */
export function createPlayerCharacter(skin: Skin): CharacterRig {
  const root = new THREE.Group();
  root.name = 'player_character';

  const contactShadow = createContactShadow(0.5);
  root.add(contactShadow);

  // Materials
  const hoodMat = new THREE.MeshStandardMaterial({
    color: skin.hoodColor,
    roughness: 0.75,
    metalness: 0.1,
  });
  const suitMat = new THREE.MeshStandardMaterial({
    color: skin.suitColor,
    roughness: 0.65,
    metalness: 0.15,
  });
  const skinToneMat = new THREE.MeshStandardMaterial({
    color: 0xffdfc4, // stylized anime/cartoon peach skin
    roughness: 0.5,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: skin.scarfColor,
    roughness: 0.4,
    metalness: 0.1,
  });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeIrisMat = new THREE.MeshStandardMaterial({
    color: skin.eyeColor,
    emissive: skin.accentGlow ? skin.eyeColor : 0x000000,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.85,
    roughness: 0.25,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    roughness: 0.8,
  });

  // Torso Node
  const torso = new THREE.Group();
  torso.position.y = 0.52;
  root.add(torso);

  const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  // Belt & Buckle
  const beltMesh = new THREE.Mesh(beltGeo, bootMat);
  beltMesh.rotation.x = Math.PI / 2;
  beltMesh.position.y = -0.15;
  torso.add(beltMesh);

  const buckleMesh = new THREE.Mesh(buckleGeo, goldMat);
  buckleMesh.position.set(0, -0.15, 0.27);
  torso.add(buckleMesh);

  // Head Node (Oversized stylized chibi head)
  const head = new THREE.Group();
  head.position.y = 0.42;
  torso.add(head);

  // Inner face skin & eyes anchor
  const faceMesh = new THREE.Mesh(headGeo, skinToneMat);
  faceMesh.position.set(0, 0, 0.05);
  faceMesh.scale.set(0.9, 0.9, 0.9);
  head.add(faceMesh);

  // Assassin Hood (covers back, sides, top, leaving eye aperture)
  const hoodMesh = new THREE.Mesh(hoodGeo, hoodMat);
  hoodMesh.position.set(0, 0.04, -0.06);
  hoodMesh.scale.set(1.05, 1.1, 1.08);
  hoodMesh.castShadow = true;
  head.add(hoodMesh);

  // Lower face mask
  const maskGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.22, 16);
  const maskMesh = new THREE.Mesh(maskGeo, hoodMat);
  maskMesh.position.set(0, -0.11, 0.09);
  head.add(maskMesh);

  // Large expressive anime/cartoon eyes that pop clearly!
  const eyes: THREE.Group[] = [];
  [-0.13, 0.13].forEach((xOffset) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(xOffset, 0.06, 0.34); // position proudly at the front aperture

    // Eye white with gentle glow
    const eyeWhite = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eyeWhite.scale.set(1.0, 1.3, 0.35);
    eyeGroup.add(eyeWhite);

    // Vibrant Iris
    const iris = new THREE.Mesh(
      eyeGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(skin.eyeColor) })
    );
    iris.scale.set(0.72, 0.95, 0.25);
    iris.position.z = 0.03;
    eyeGroup.add(iris);

    // Dark Pupil
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.045;
    eyeGroup.add(pupil);

    // Cute sparkling highlight shine dots
    const shine1 = new THREE.Mesh(shineGeo, shineMat);
    shine1.position.set(0.025, 0.04, 0.055);
    eyeGroup.add(shine1);

    const shine2 = new THREE.Mesh(shineGeo, shineMat);
    shine2.scale.set(0.5, 0.5, 0.5);
    shine2.position.set(-0.02, -0.03, 0.055);
    eyeGroup.add(shine2);

    head.add(eyeGroup);
    eyes.push(eyeGroup);
  });

  // Flowing Scarf / Capelet at neck
  const scarfGeo = new THREE.BoxGeometry(0.18, 0.45, 0.04);
  const scarf = new THREE.Mesh(scarfGeo, scarfMat);
  scarf.position.set(0.08, -0.15, -0.22);
  scarf.rotation.x = 0.3;
  torso.add(scarf);

  // Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.3, 0.2, 0);
  const leftArmMesh = new THREE.Mesh(limbGeo, suitMat);
  leftArmMesh.position.y = -0.18;
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.3, 0.2, 0);
  const rightArmMesh = new THREE.Mesh(limbGeo, suitMat);
  rightArmMesh.position.y = -0.18;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);
  torso.add(rightArm);

  // Gloves
  const gloveGeo = new THREE.SphereGeometry(0.1, 10, 10);
  const leftGlove = new THREE.Mesh(gloveGeo, bootMat);
  leftGlove.position.y = -0.34;
  leftArm.add(leftGlove);

  const rightGlove = new THREE.Mesh(gloveGeo, bootMat);
  rightGlove.position.y = -0.34;
  rightArm.add(rightGlove);

  // Legs & Boots
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, -0.25, 0);
  const leftLegMesh = new THREE.Mesh(limbGeo, suitMat);
  leftLegMesh.position.y = -0.12;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);

  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.25, 0.04);
  leftBoot.castShadow = true;
  leftLeg.add(leftBoot);
  torso.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, -0.25, 0);
  const rightLegMesh = new THREE.Mesh(limbGeo, suitMat);
  rightLegMesh.position.y = -0.12;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);

  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0, -0.25, 0.04);
  rightBoot.castShadow = true;
  rightLeg.add(rightBoot);
  torso.add(rightLeg);

  return {
    root,
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    scarf,
    eyes,
    contactShadow,
    animTimer: 0,
    blinkTimer: 3,
  };
}

/**
 * Creates 3D Alert Billboard Icon ("?", "!", or Stun Stars).
 */
function createAlertBillboard(): { group: THREE.Group; textMesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.position.y = 1.6;
  group.visible = false;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Draw speech bubble
  ctx.fillStyle = '#ff2a55';
  ctx.beginPath();
  ctx.arc(64, 52, 44, 0, Math.PI * 2);
  ctx.fill();

  // Pointer
  ctx.beginPath();
  ctx.moveTo(50, 90);
  ctx.lineTo(64, 116);
  ctx.lineTo(78, 90);
  ctx.closePath();
  ctx.fill();

  // White exclamation
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const geo = new THREE.PlaneGeometry(0.7, 0.7);
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  return { group, textMesh: mesh };
}

/**
 * Creates Floor Projected 3D Vision Cone.
 */
export function createVisionCone(range: number = 7.5, fovRad: number = Math.PI * 0.45): THREE.Mesh {
  const segments = 24;
  const positions: number[] = [];
  const uvs: number[] = [];

  // Origin at observer feet
  positions.push(0, 0.03, 0);
  uvs.push(0.5, 0);

  const halfFov = fovRad / 2;
  for (let i = 0; i <= segments; i++) {
    const angle = -halfFov + (fovRad * i) / segments;
    const x = Math.cos(angle) * range;
    const z = Math.sin(angle) * range;
    positions.push(x, 0.03, z);
    uvs.push(i / segments, 1);
  }

  const indices: number[] = [];
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  // Procedural gradient texture with scan lines
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 0, 0, 64, 0, 128);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    color: 0x10b981, // Default Green (patrol)
    map: tex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'vision_cone';

  // Neon glowing perimeter outline line
  const edgePositions: number[] = [];
  edgePositions.push(0, 0.04, 0);
  for (let i = 0; i <= segments; i++) {
    const angle = -halfFov + (fovRad * i) / segments;
    edgePositions.push(Math.cos(angle) * range, 0.04, Math.sin(angle) * range);
  }
  edgePositions.push(0, 0.04, 0);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 });
  const edgeLine = new THREE.Line(edgeGeo, edgeMat);
  edgeLine.name = 'vision_cone_edge';
  mesh.add(edgeLine);

  return mesh;
}

/**
 * Builds Stylized 3D Cartoon Enemies (Basic Guard, Heavy Brute, Elite Scout, Boss).
 */
export function createEnemyCharacter(type: EnemyType): CharacterRig {
  const root = new THREE.Group();
  root.name = `enemy_${type}`;

  const contactShadow = createContactShadow(type === 'heavy' || type === 'boss' ? 0.65 : 0.45);
  root.add(contactShadow);

  let suitColor = 0x2563eb; // Security Blue
  let hatColor = 0x1d4ed8;
  let accentColor = 0xf59e0b; // Gold badge
  let skinTone = 0xffdfc4;
  let visionRange = 7;
  let visionFov = Math.PI * 0.42;

  if (type === 'heavy') {
    suitColor = 0xea580c; // Riot Orange
    hatColor = 0x334155; // Iron helmet
    accentColor = 0xfacc15;
    visionRange = 6.0;
    visionFov = Math.PI * 0.52; // Wider vision
  } else if (type === 'elite') {
    suitColor = 0x475569; // Charcoal tech
    hatColor = 0x7c3aed; // Neon Violet
    accentColor = 0xa855f7;
    visionRange = 9.0;
    visionFov = Math.PI * 0.4;
  } else if (type === 'boss') {
    suitColor = 0x7e22ce; // Purple Mafia
    hatColor = 0x581c87;
    accentColor = 0xfacc15; // Heavy Gold
    visionRange = 8.5;
    visionFov = Math.PI * 0.55;
  }

  const suitMat = new THREE.MeshStandardMaterial({
    color: suitColor,
    roughness: 0.65,
    metalness: type === 'elite' ? 0.4 : 0.1,
  });
  const hatMat = new THREE.MeshStandardMaterial({
    color: hatColor,
    roughness: 0.5,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.7,
    roughness: 0.3,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinTone,
    roughness: 0.5,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });

  // Torso
  const torso = new THREE.Group();
  torso.position.y = 0.55;
  root.add(torso);

  if (type === 'heavy' || type === 'boss') {
    // Bulky square torso
    const bruteTorso = new THREE.Mesh(heavyTorsoGeo, suitMat);
    bruteTorso.castShadow = true;
    torso.add(bruteTorso);

    // Pauldrons (Shoulder pads)
    [-0.42, 0.42].forEach((xPos) => {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.32), hatMat);
      pauldron.position.set(xPos, 0.28, 0);
      torso.add(pauldron);
    });
  } else {
    // Standard chubby guard torso
    const guardTorso = new THREE.Mesh(torsoGeo, suitMat);
    guardTorso.castShadow = true;
    torso.add(guardTorso);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = type === 'heavy' || type === 'boss' ? 0.52 : 0.42;
  torso.add(head);

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.scale.set(0.95, 0.95, 0.95);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Hat or Helmet
  if (type === 'heavy') {
    // Riot Iron Helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), hatMat);
    helmet.position.set(0, 0.08, -0.02);
    head.add(helmet);

    // Dark Visor Slit
    const visor = new THREE.Mesh(visorGeo, darkMat);
    visor.position.set(0, 0.05, 0.36);
    head.add(visor);
  } else if (type === 'elite') {
    // Cyber Goggles
    const goggleMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xc084fc,
      emissiveIntensity: 0.8,
    });
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.14), goggleMat);
    goggles.position.set(0, 0.06, 0.34);
    head.add(goggles);

    // Tech antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), darkMat);
    antenna.position.set(0.24, 0.35, 0);
    head.add(antenna);
  } else {
    // Peaked Security Cap
    const cap = new THREE.Mesh(capGeo, hatMat);
    cap.position.set(0, 0.32, 0);
    head.add(cap);

    const capVisor = new THREE.Mesh(visorGeo, darkMat);
    capVisor.position.set(0, 0.26, 0.28);
    capVisor.rotation.x = 0.2;
    head.add(capVisor);

    // Gold Guard Badge
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), accentMat);
    badge.position.set(0, 0.34, 0.26);
    head.add(badge);
  }

  // Eyes (for regular & boss)
  const eyes: THREE.Group[] = [];
  if (type !== 'heavy' && type !== 'elite') {
    [-0.12, 0.12].forEach((xOff) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(xOff, 0.05, 0.32);

      const eye = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.scale.set(0.8, 1, 0.2);
      eyeGroup.add(eye);

      const pupil = new THREE.Mesh(pupilGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
      pupil.position.z = 0.02;
      eyeGroup.add(pupil);

      head.add(eyeGroup);
      eyes.push(eyeGroup);
    });

    if (type === 'boss') {
      // Big Boss Cartoon Mustache!
      const mustacheGeo = new THREE.TorusGeometry(0.12, 0.04, 8, 12, Math.PI);
      const mustache = new THREE.Mesh(mustacheGeo, darkMat);
      mustache.rotation.z = Math.PI;
      mustache.position.set(0, -0.1, 0.36);
      head.add(mustache);
    }
  }

  // Limbs
  const armScale = type === 'heavy' || type === 'boss' ? 1.3 : 1;
  const leftArm = new THREE.Group();
  leftArm.position.set(type === 'heavy' || type === 'boss' ? -0.45 : -0.32, 0.2, 0);
  const leftArmMesh = new THREE.Mesh(limbGeo, suitMat);
  leftArmMesh.scale.set(armScale, armScale, armScale);
  leftArmMesh.position.y = -0.18;
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(type === 'heavy' || type === 'boss' ? 0.45 : 0.32, 0.2, 0);
  const rightArmMesh = new THREE.Mesh(limbGeo, suitMat);
  rightArmMesh.scale.set(armScale, armScale, armScale);
  rightArmMesh.position.y = -0.18;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);
  torso.add(rightArm);

  // Baton / Flashlight prop on right arm
  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), darkMat);
  baton.position.set(0, -0.32, 0.1);
  baton.rotation.x = Math.PI / 3;
  rightArm.add(baton);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, -0.28, 0);
  const leftLegMesh = new THREE.Mesh(limbGeo, darkMat);
  leftLegMesh.position.y = -0.12;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);
  const leftBoot = new THREE.Mesh(bootGeo, darkMat);
  leftBoot.position.set(0, -0.24, 0.04);
  leftLeg.add(leftBoot);
  torso.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, -0.28, 0);
  const rightLegMesh = new THREE.Mesh(limbGeo, darkMat);
  rightLegMesh.position.y = -0.12;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);
  const rightBoot = new THREE.Mesh(bootGeo, darkMat);
  rightBoot.position.set(0, -0.24, 0.04);
  rightLeg.add(rightBoot);
  torso.add(rightLeg);

  // Vision cone
  const visionConeMesh = createVisionCone(visionRange, visionFov);
  root.add(visionConeMesh);

  // Alert Billboard
  const alert = createAlertBillboard();
  root.add(alert.group);

  return {
    root,
    head,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    eyes,
    alertIconGroup: alert.group,
    alertTextMesh: alert.textMesh,
    visionConeMesh,
    contactShadow,
    animTimer: Math.random() * 10,
    blinkTimer: 2 + Math.random() * 3,
  };
}

/**
 * Updates rig animation smoothly based on character state.
 */
export function updateCharacterRig(
  rig: CharacterRig,
  state: 'idle' | 'walk' | 'run' | 'sneak' | 'takedown' | 'victory' | 'defeat',
  speedRatio: number,
  delta: number,
  camera?: THREE.Camera
) {
  rig.animTimer += delta * (state === 'sneak' ? 6 : state === 'run' ? 14 : 9) * Math.max(0.4, speedRatio);
  const t = rig.animTimer;

  // Make alert billboard face camera if active
  if (rig.alertIconGroup && rig.alertIconGroup.visible && camera) {
    rig.alertIconGroup.quaternion.copy(camera.quaternion);
  }

  // Eye blinking
  rig.blinkTimer -= delta;
  if (rig.blinkTimer <= 0) {
    rig.eyes.forEach((eye) => (eye.scale.y = 0.1));
    if (rig.blinkTimer <= -0.15) {
      rig.eyes.forEach((eye) => (eye.scale.y = 1));
      rig.blinkTimer = 2.5 + Math.random() * 3;
    }
  }

  if (state === 'idle') {
    // Gentle breathing & weight shift
    rig.torso.position.y = 0.52 + Math.sin(t * 0.4) * 0.02;
    rig.head.rotation.x = Math.sin(t * 0.4) * 0.03;
    rig.head.rotation.y = Math.sin(t * 0.2) * 0.05;
    rig.leftArm.rotation.x = Math.sin(t * 0.4) * 0.06;
    rig.rightArm.rotation.x = -Math.sin(t * 0.4) * 0.06;
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    if (rig.scarf) {
      rig.scarf.rotation.z = Math.sin(t * 0.5) * 0.1;
    }
  } else if (state === 'walk' || state === 'run') {
    // Comic bouncy run/gallop!
    const bounce = Math.abs(Math.sin(t));
    rig.torso.position.y = 0.52 + bounce * 0.06;
    rig.torso.rotation.x = state === 'run' ? 0.22 : 0.1;

    rig.leftLeg.rotation.x = Math.sin(t) * 0.7;
    rig.rightLeg.rotation.x = -Math.sin(t) * 0.7;

    rig.leftArm.rotation.x = -Math.sin(t) * 0.6;
    rig.rightArm.rotation.x = Math.sin(t) * 0.6;

    rig.head.rotation.x = -rig.torso.rotation.x + Math.sin(t * 2) * 0.05;

    if (rig.scarf) {
      rig.scarf.rotation.x = 0.6 + bounce * 0.2;
    }
  } else if (state === 'sneak') {
    // Low crouching tiptoe stealth crawl
    rig.torso.position.y = 0.38 + Math.abs(Math.sin(t)) * 0.03;
    rig.torso.rotation.x = 0.32; // deep crouch

    rig.leftLeg.rotation.x = Math.sin(t) * 0.4;
    rig.rightLeg.rotation.x = -Math.sin(t) * 0.4;

    rig.leftArm.rotation.x = 0.3 + Math.sin(t) * 0.2;
    rig.rightArm.rotation.x = 0.3 - Math.sin(t) * 0.2;

    rig.head.rotation.x = -0.2;
    rig.head.rotation.y = Math.sin(t * 0.8) * 0.25; // looking cautiously left and right!
  } else if (state === 'takedown') {
    // Leaping spinning cartoon action strike
    rig.torso.position.y = 0.8;
    rig.torso.rotation.x = 0.4;
    rig.leftArm.rotation.x = -1.2;
    rig.rightArm.rotation.x = 1.2;
    rig.leftLeg.rotation.x = -0.8;
    rig.rightLeg.rotation.x = 0.8;
  } else if (state === 'victory') {
    // Comic double victory jump & arms high in V-sign!
    const jump = Math.max(0, Math.sin(t * 2)) * 0.4;
    rig.torso.position.y = 0.52 + jump;
    rig.leftArm.rotation.z = 1.3;
    rig.rightArm.rotation.z = -1.3;
    rig.head.rotation.x = -0.3; // looking up proudly
  } else if (state === 'defeat') {
    // Comic topple backward with legs in air
    rig.torso.position.y = 0.2;
    rig.torso.rotation.x = -1.3;
    rig.leftLeg.rotation.x = 0.8;
    rig.rightLeg.rotation.x = 0.6;
    rig.leftArm.rotation.x = 1.2;
    rig.rightArm.rotation.x = 1.2;
  }
}
