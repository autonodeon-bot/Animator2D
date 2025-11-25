
import { Bone, DerivedBone, Vector2, AnimationClip, Track, Sprite, EasingType, ProjectFile } from './types';

export const degToRad = (deg: number) => (deg * Math.PI) / 180;
export const radToDeg = (rad: number) => (rad * 180) / Math.PI;

export const rotatePoint = (point: Vector2, center: Vector2, angleRad: number): Vector2 => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

// Evaluate Drivers (Simple Linear Expression: Target = Source * Factor + Offset)
export const evaluateDrivers = (bones: Bone[]) => {
  // Deep copy to avoid mutation loops during evaluation
  const updatedBones = [...bones];
  
  // Simple 2-pass evaluation to handle basic chains
  for (let pass = 0; pass < 2; pass++) {
    updatedBones.forEach((targetBone, index) => {
      if (!targetBone.drivers) return;
      
      targetBone.drivers.forEach(driver => {
         const sourceBone = updatedBones.find(b => b.id === driver.sourceBoneId);
         if (!sourceBone) return;
         
         let inputVal = 0;
         if (driver.sourceProperty === 'rotation') inputVal = sourceBone.rotation;
         if (driver.sourceProperty === 'x') inputVal = sourceBone.x;
         if (driver.sourceProperty === 'y') inputVal = sourceBone.y;

         const outputVal = inputVal * driver.factor + driver.offset;

         if (driver.driverProperty === 'rotation') updatedBones[index].rotation = outputVal;
         if (driver.driverProperty === 'x') updatedBones[index].x = outputVal;
         if (driver.driverProperty === 'y') updatedBones[index].y = outputVal;
      });
    });
  }
  return updatedBones;
};

// Apply Rotation Constraints
const constrainRotation = (val: number, min?: number, max?: number) => {
    let v = val;
    // Normalize to -180 to 180 for logic
    while (v > 180) v -= 360;
    while (v < -180) v += 360;

    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
};

export const calculateFK = (bones: Bone[]): DerivedBone[] => {
  if (!bones) return [];
  
  // First evaluate drivers
  const drivenBones = evaluateDrivers(bones);

  const derived: Record<string, DerivedBone> = {};
  const result: DerivedBone[] = [];

  const processBone = (bone: Bone, parent?: DerivedBone) => {
    let rot = bone.rotation;
    
    // Apply Constraints (Limit Rotation)
    if (bone.constraints) {
        const limit = bone.constraints.find(c => c.type === 'LIMIT_ROTATION');
        if (limit) {
            rot = constrainRotation(rot, limit.min, limit.max);
        }
    }

    const startX = parent ? parent.worldEnd.x : bone.x;
    const startY = parent ? parent.worldEnd.y : bone.y;
    const parentRot = parent ? parent.worldRotation : 0;
    
    const worldRot = parentRot + rot;
    const angleRad = degToRad(worldRot);

    const endX = startX + Math.cos(angleRad) * bone.length;
    const endY = startY + Math.sin(angleRad) * bone.length;

    const derivedBone: DerivedBone = {
      ...bone,
      rotation: rot, // Store constrained local rotation
      worldStart: { x: startX, y: startY },
      worldEnd: { x: endX, y: endY },
      worldRotation: worldRot,
    };

    derived[bone.id] = derivedBone;
    result.push(derivedBone);

    drivenBones.filter(b => b.parentId === bone.id).forEach(child => processBone(child, derivedBone));
  };

  drivenBones.filter(b => b.parentId === null).forEach(root => processBone(root));

  return result;
};

// Inverse Kinematics (CCD Algorithm)
export const solveIK = (bones: Bone[], effectorId: string, target: Vector2): Bone[] => {
    if (!bones) return [];
    const chain: string[] = [];
    let currentId: string | null = effectorId;
    
    // Build chain
    let depth = 0;
    while (currentId && depth < 4) {
        chain.push(currentId);
        const b = bones.find(b => b.id === currentId);
        currentId = b ? b.parentId : null;
        depth++;
    }

    let newBones = [...bones];

    const iterations = 10;
    for (let i = 0; i < iterations; i++) {
        for (const boneId of chain) {
            const derived = calculateFK(newBones);
            const effector = derived.find(b => b.id === effectorId);
            const currentDerived = derived.find(b => b.id === boneId);

            if (!effector || !currentDerived) continue;

            const effectorPos = effector.worldEnd;
            const originPos = currentDerived.worldStart;

            const toEffector = { x: effectorPos.x - originPos.x, y: effectorPos.y - originPos.y };
            const toTarget = { x: target.x - originPos.x, y: target.y - originPos.y };

            const angEffector = Math.atan2(toEffector.y, toEffector.x);
            const angTarget = Math.atan2(toTarget.y, toTarget.x);
            
            let angleDiff = radToDeg(angTarget - angEffector);
            if (angleDiff > 180) angleDiff -= 360;
            if (angleDiff < -180) angleDiff += 360;

            // Apply rotation with constraints check
            newBones = newBones.map(b => {
                if (b.id === boneId && !b.locked) {
                    let newRot = b.rotation + angleDiff;
                    
                    // Check Constraints
                    if (b.constraints) {
                        const limit = b.constraints.find(c => c.type === 'LIMIT_ROTATION');
                        if (limit) newRot = constrainRotation(newRot, limit.min, limit.max);
                    }
                    
                    return { ...b, rotation: newRot };
                }
                return b;
            });
        }
    }
    return newBones;
};

// --- Easing ---
const easeLinear = (t: number) => t;
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => t * (2 - t);
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

const getEasing = (type: EasingType = 'linear', t: number) => {
    switch (type) {
        case 'ease-in': return easeIn(t);
        case 'ease-out': return easeOut(t);
        case 'ease-in-out': return easeInOut(t);
        default: return easeLinear(t);
    }
};

export const getInterpolatedValue = (track: Track, frame: number): number | null => {
  if (!track || !track.keyframes || !track.keyframes.length) return null;
  
  const keys = [...track.keyframes].sort((a, b) => a.time - b.time);
  
  if (frame <= keys[0].time) return keys[0].value;
  if (frame >= keys[keys.length - 1].time) return keys[keys.length - 1].value;

  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i];
    const k2 = keys[i + 1];
    if (frame >= k1.time && frame < k2.time) {
       let t = (frame - k1.time) / (k2.time - k1.time);
       t = getEasing(k1.easing, t);
       return k1.value + (k2.value - k1.value) * t;
    }
  }
  return keys[0].value;
};

// Apply Animation including Sprite Variants
export const applyAnimation = (bones: Bone[], sprites: Sprite[], clip: AnimationClip, frame: number): {bones: Bone[], sprites: Sprite[]} => {
  if (!clip || !clip.tracks) return { bones, sprites };

  const newBones = bones.map(bone => {
    const newBone = { ...bone };
    const rotTrack = clip.tracks.find(t => t.boneId === bone.id && t.property === 'rotation');
    if (rotTrack) { const val = getInterpolatedValue(rotTrack, frame); if (val !== null) newBone.rotation = val; }
    const xTrack = clip.tracks.find(t => t.boneId === bone.id && t.property === 'x');
    if (xTrack) { const val = getInterpolatedValue(xTrack, frame); if (val !== null) newBone.x = val; }
    const yTrack = clip.tracks.find(t => t.boneId === bone.id && t.property === 'y');
    if (yTrack) { const val = getInterpolatedValue(yTrack, frame); if (val !== null) newBone.y = val; }
    return newBone;
  });

  // Apply Constraints & Drivers after raw animation
  const derived = calculateFK(newBones); 
  const finalBones = newBones.map(b => {
      const d = derived.find(db => db.id === b.id);
      return d ? { ...b, rotation: d.rotation, x: d.x, y: d.y } : b;
  });

  const newSprites = sprites.map(sprite => {
      return sprite; 
  });

  return { bones: finalBones, sprites: newSprites };
};

// --- Calculate Motion Path ---
export const calculateMotionPath = (bones: Bone[], sprites: Sprite[], clip: AnimationClip, targetBoneId: string): Vector2[] => {
    const points: Vector2[] = [];
    const step = 2; // Sample every 2 frames for performance
    
    // We only calculate for the duration of the clip
    for(let f = 0; f <= clip.duration; f += step) {
        const state = applyAnimation(bones, sprites, clip, f);
        const derived = calculateFK(state.bones);
        const target = derived.find(b => b.id === targetBoneId);
        if (target) {
            points.push({ x: target.worldStart.x, y: target.worldStart.y });
        }
    }
    return points;
};

// --- Rendering ---
export const renderFrameToCanvas = async (
  canvas: HTMLCanvasElement,
  bones: Bone[],
  sprites: Sprite[],
  width: number,
  height: number
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  const derivedBones = calculateFK(bones);
  const center = { x: width / 2, y: height / 2 };
  const sortedSprites = [...sprites].sort((a, b) => a.zIndex - b.zIndex);

  for (const sprite of sortedSprites) {
    const bone = derivedBones.find(b => b.id === sprite.boneId);
    if (!bone || bone.visible === false) continue;

    if (sprite.clipId) {
        const clipSprite = sprites.find(s => s.id === sprite.clipId);
        const clipBone = clipSprite ? derivedBones.find(b => b.id === clipSprite.boneId) : null;
        if (clipSprite && clipBone) {
            ctx.save();
            ctx.beginPath();
            ctx.translate(center.x + clipBone.worldStart.x, center.y + clipBone.worldStart.y);
            ctx.rotate(degToRad(clipBone.worldRotation));
            ctx.rect(clipSprite.offsetX - 50, clipSprite.offsetY - 50, 100, 100); 
            ctx.clip();
        }
    }

    const img = new Image();
    img.src = sprite.imageUrl;
    await new Promise((resolve) => { if (img.complete) resolve(null); else img.onload = () => resolve(null); });

    ctx.save();
    ctx.translate(center.x + bone.worldStart.x, center.y + bone.worldStart.y);
    ctx.rotate(degToRad(bone.worldRotation));
    ctx.translate(sprite.offsetX, sprite.offsetY);
    ctx.rotate(degToRad(sprite.rotation));
    ctx.scale(sprite.scaleX, sprite.scaleY);
    ctx.globalAlpha = sprite.opacity;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    if (sprite.clipId) ctx.restore();
  }
};


// --- Game Engine Export ---
export const exportGameData = (bones: Bone[], sprites: Sprite[], clips: AnimationClip[]): string => {
    const exportData = {
        meta: {
            app: "AnimatorPro",
            version: "2.0",
            fps: 24
        },
        skeleton: bones.map(b => ({
            name: b.name,
            parent: b.parentId,
            transform: { x: b.x, y: b.y, rot: b.rotation, len: b.length }
        })),
        slots: sprites.map(s => ({
            name: s.name,
            bone: s.boneId,
            attachment: s.imageUrl, // In real engine, this is an atlas name
            zIndex: s.zIndex
        })),
        animations: clips.map(c => ({
            name: c.name,
            duration: c.duration,
            tracks: c.tracks.map(t => ({
                bone: t.boneId,
                property: t.property,
                keys: t.keyframes.map(k => ({ t: k.time, v: k.value, curve: k.easing }))
            }))
        }))
    };
    return JSON.stringify(exportData, null, 2);
};

// --- Human Rig & Assets ---
export const createHumanRig = (): Bone[] => {
  const c = '#eab308'; const b = '#a3a3a3'; const l = '#60a5fa'; const r = '#f87171';
  return [
    { id: 'hips', parentId: null, name: 'Hips', length: 0, x: 0, y: 0, rotation: -90, color: c, constraints: [], drivers: [] },
    { id: 'spine', parentId: 'hips', name: 'Spine', length: 60, x: 0, y: 0, rotation: 0, color: b, constraints: [], drivers: [] },
    { id: 'chest', parentId: 'spine', name: 'Chest', length: 60, x: 0, y: 0, rotation: 0, color: b, constraints: [], drivers: [] },
    { id: 'neck', parentId: 'chest', name: 'Neck', length: 20, x: 0, y: 0, rotation: 0, color: b, constraints: [], drivers: [] },
    { id: 'head', parentId: 'neck', name: 'Head', length: 50, x: 0, y: 0, rotation: 0, color: b, constraints: [], drivers: [] },
    { id: 'shoulder_l', parentId: 'chest', name: 'Shoulder L', length: 30, x: 0, y: 0, rotation: 80, color: l, constraints: [], drivers: [] },
    { id: 'arm_l_up', parentId: 'shoulder_l', name: 'Upper Arm L', length: 70, x: 0, y: 0, rotation: 10, color: l, constraints: [], drivers: [] },
    { id: 'arm_l_low', parentId: 'arm_l_up', name: 'Lower Arm L', length: 60, x: 0, y: 0, rotation: 0, color: l, constraints: [{ id: 'c1', type: 'LIMIT_ROTATION', min: -10, max: 130, influence: 1 }], drivers: [] },
    { id: 'hand_l', parentId: 'arm_l_low', name: 'Hand L', length: 20, x: 0, y: 0, rotation: 0, color: l, constraints: [], drivers: [] },
    { id: 'shoulder_r', parentId: 'chest', name: 'Shoulder R', length: 30, x: 0, y: 0, rotation: -80, color: r, constraints: [], drivers: [] },
    { id: 'arm_r_up', parentId: 'shoulder_r', name: 'Upper Arm R', length: 70, x: 0, y: 0, rotation: -10, color: r, constraints: [], drivers: [] },
    { id: 'arm_r_low', parentId: 'arm_r_up', name: 'Lower Arm R', length: 60, x: 0, y: 0, rotation: 0, color: r, constraints: [{ id: 'c2', type: 'LIMIT_ROTATION', min: -130, max: 10, influence: 1 }], drivers: [] },
    { id: 'hand_r', parentId: 'arm_r_low', name: 'Hand R', length: 20, x: 0, y: 0, rotation: 0, color: r, constraints: [], drivers: [] },
    { id: 'thigh_l', parentId: 'hips', name: 'Thigh L', length: 80, x: 0, y: 0, rotation: 170, color: l, constraints: [], drivers: [] },
    { id: 'shin_l', parentId: 'thigh_l', name: 'Shin L', length: 80, x: 0, y: 0, rotation: 0, color: l, constraints: [{ id: 'c3', type: 'LIMIT_ROTATION', min: -10, max: 150, influence: 1 }], drivers: [] },
    { id: 'foot_l', parentId: 'shin_l', name: 'Foot L', length: 30, x: 0, y: 0, rotation: 90, color: l, constraints: [], drivers: [] },
    { id: 'thigh_r', parentId: 'hips', name: 'Thigh R', length: 80, x: 0, y: 0, rotation: -170, color: r, constraints: [], drivers: [] },
    { id: 'shin_r', parentId: 'thigh_r', name: 'Shin R', length: 80, x: 0, y: 0, rotation: 0, color: r, constraints: [{ id: 'c4', type: 'LIMIT_ROTATION', min: -10, max: 150, influence: 1 }], drivers: [] },
    { id: 'foot_r', parentId: 'shin_r', name: 'Foot R', length: 30, x: 0, y: 0, rotation: 90, color: r, constraints: [], drivers: [] },
  ];
};

const createSVGDataURL = (svgString: string) => `data:image/svg+xml;base64,${btoa(svgString)}`;

export const createDummySprites = (): Sprite[] => {
    const sprites: Sprite[] = [];
    const fill = "#fca5a5"; const stroke = "#b91c1c";
    const headSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="${fill}" stroke="${stroke}" stroke-width="2"/><rect x="30" y="35" width="10" height="10" fill="#333"/><rect x="60" y="35" width="10" height="10" fill="#333"/><path d="M35 70 Q50 85 65 70" stroke="#333" stroke-width="3" fill="none"/></svg>`;
    const bodySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="20" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    const limbSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="20" y="5" width="60" height="90" rx="30" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;
    const headUrl = createSVGDataURL(headSVG); const bodyUrl = createSVGDataURL(bodySVG); const limbUrl = createSVGDataURL(limbSVG);
    const makeSprite = (id: string, boneId: string, name: string, url: string, scaleX=1, scaleY=1, offX=0, offY=0, rotation=-90, zIndex=10) => ({ id, boneId, name, imageUrl: url, variants: [], offsetX: offX, offsetY: offY, rotation, scaleX, scaleY, opacity: 1, zIndex });
    
    sprites.push(makeSprite('s_head', 'head', 'Head', headUrl, 1.2, 1.2, 25, 0, -90, 20));
    sprites.push(makeSprite('s_chest', 'chest', 'Chest', bodyUrl, 1.2, 0.8, 30, 0, -90, 15));
    sprites.push(makeSprite('s_spine', 'spine', 'Abdomen', bodyUrl, 1.0, 0.8, 30, 0, -90, 14));
    sprites.push(makeSprite('s_hips', 'hips', 'Hips', bodyUrl, 0.8, 0.6, 0, 0, 0, 14));
    sprites.push(makeSprite('s_arm_l_up', 'arm_l_up', 'L Upper Arm', limbUrl, 1.0, 0.4, 35, 0, -90, 12));
    sprites.push(makeSprite('s_arm_l_low', 'arm_l_low', 'L Forearm', limbUrl, 0.9, 0.35, 30, 0, -90, 12));
    sprites.push(makeSprite('s_arm_r_up', 'arm_r_up', 'R Upper Arm', limbUrl, 1.0, 0.4, 35, 0, -90, 12));
    sprites.push(makeSprite('s_arm_r_low', 'arm_r_low', 'R Forearm', limbUrl, 0.9, 0.35, 30, 0, -90, 12));
    sprites.push(makeSprite('s_thigh_l', 'thigh_l', 'L Thigh', limbUrl, 1.2, 0.5, 40, 0, -90, 11));
    sprites.push(makeSprite('s_shin_l', 'shin_l', 'L Shin', limbUrl, 1.1, 0.45, 40, 0, -90, 11));
    sprites.push(makeSprite('s_thigh_r', 'thigh_r', 'R Thigh', limbUrl, 1.2, 0.5, 40, 0, -90, 10));
    sprites.push(makeSprite('s_shin_r', 'shin_r', 'R Shin', limbUrl, 1.1, 0.45, 40, 0, -90, 10));
    return sprites;
};

export const createWalkCycle = (): AnimationClip => {
  const tracks: Track[] = [
    { boneId: 'hips', property: 'y', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 12, value: -5, easing: 'linear' }, { time: 24, value: 0, easing: 'linear' }, { time: 36, value: -5, easing: 'linear' }, { time: 48, value: 0, easing: 'linear' }, { time: 60, value: -5, easing: 'linear' }, { time: 72, value: 0, easing: 'linear' }, { time: 84, value: -5, easing: 'linear' }, { time: 96, value: 0, easing: 'linear' }] },
    { boneId: 'thigh_l', property: 'rotation', keyframes: [{ time: 0, value: 170, easing: 'linear' }, { time: 24, value: 210, easing: 'linear' }, { time: 48, value: 170, easing: 'linear' }, { time: 72, value: 130, easing: 'linear' }, { time: 96, value: 170, easing: 'linear' }] },
    { boneId: 'shin_l', property: 'rotation', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 24, value: 0, easing: 'linear' }, { time: 36, value: 40, easing: 'linear' }, { time: 48, value: 0, easing: 'linear' }, { time: 72, value: 10, easing: 'linear' }, { time: 96, value: 0, easing: 'linear' }] },
    { boneId: 'foot_l', property: 'rotation', keyframes: [{ time: 0, value: 90, easing: 'linear' }, { time: 24, value: 70, easing: 'linear' }, { time: 48, value: 90, easing: 'linear' }, { time: 72, value: 110, easing: 'linear' }, { time: 96, value: 90, easing: 'linear' }] },
    { boneId: 'thigh_r', property: 'rotation', keyframes: [{ time: 0, value: -170, easing: 'linear' }, { time: 24, value: -130, easing: 'linear' }, { time: 48, value: -170, easing: 'linear' }, { time: 72, value: -210, easing: 'linear' }, { time: 96, value: -170, easing: 'linear' }] },
    { boneId: 'shin_r', property: 'rotation', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 12, value: -10, easing: 'linear' }, { time: 24, value: 0, easing: 'linear' }, { time: 48, value: 0, easing: 'linear' }, { time: 72, value: 0, easing: 'linear' }, { time: 84, value: -40, easing: 'linear' }, { time: 96, value: 0, easing: 'linear' }] },
    { boneId: 'foot_r', property: 'rotation', keyframes: [{ time: 0, value: 90, easing: 'linear' }, { time: 24, value: 110, easing: 'linear' }, { time: 48, value: 90, easing: 'linear' }, { time: 72, value: 70, easing: 'linear' }, { time: 96, value: 90, easing: 'linear' }] },
    { boneId: 'shoulder_l', property: 'rotation', keyframes: [ { time: 0, value: 80, easing: 'linear' }, { time: 24, value: 60, easing: 'linear' }, { time: 48, value: 80, easing: 'linear' }, { time: 72, value: 100, easing: 'linear' }, { time: 96, value: 80, easing: 'linear' } ] },
    { boneId: 'shoulder_r', property: 'rotation', keyframes: [ { time: 0, value: -80, easing: 'linear' }, { time: 24, value: -100, easing: 'linear' }, { time: 48, value: -80, easing: 'linear' }, { time: 72, value: -60, easing: 'linear' }, { time: 96, value: -80, easing: 'linear' } ] }
  ];
  return { id: 'walk', name: 'Walk Cycle', duration: 96, fps: 24, tracks };
};
