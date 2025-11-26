
export interface Vector2 {
  x: number;
  y: number;
}

export interface MeshVertex {
  id: string;
  x: number; // Relative to Sprite Center
  y: number;
  u: number; // UV mapping 0-1
  v: number;
}

export interface Mesh {
  id: string;
  spriteId: string;
  vertices: MeshVertex[];
  indices: number[]; // Triangles
}

export interface Constraint {
  id: string;
  type: 'LIMIT_ROTATION' | 'IK_POLE' | 'COPY_TRANSFORM';
  targetBoneId?: string;
  min?: number;
  max?: number;
  influence: number; // 0-1
}

export interface Driver {
  id: string;
  driverProperty: 'rotation' | 'x' | 'y';
  sourceBoneId: string;
  sourceProperty: 'rotation' | 'x' | 'y';
  factor: number;
  offset: number;
}

export interface DrawingStroke {
  id: string;
  points: Vector2[];
  color: string;
  width: number;
  isClosed: boolean;
}

export interface AudioTrack {
  id: string;
  url: string;
  name: string;
  offsetFrame: number;
  volume: number;
}

export interface Sprite {
  id: string;
  boneId: string;
  name: string;
  imageUrl: string; // Current active image
  variants: { name: string, url: string }[]; // For Sprite Swapping
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
  clipId?: string; // ID of another sprite to mask this one
  meshId?: string;
}

export interface Bone {
  id: string;
  parentId: string | null;
  name: string;
  length: number;
  // Local transforms
  rotation: number; 
  x: number; 
  y: number; 
  color?: string;
  // UI States
  locked?: boolean;
  visible?: boolean;
  constraints: Constraint[];
  drivers: Driver[];
}

export interface DerivedBone extends Bone {
  worldStart: Vector2;
  worldEnd: Vector2;
  worldRotation: number;
}

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';

export interface Keyframe {
  time: number;
  value: number;
  easing: EasingType;
  handleLeft?: Vector2; // For Graph Editor
  handleRight?: Vector2;
}

export interface Track {
  boneId: string;
  property: 'rotation' | 'x' | 'y' | 'variant'; // Variant for sprite swap
  keyframes: Keyframe[];
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number; 
  fps: number; 
  tracks: Track[];
  audio?: AudioTrack; // Single audio track for simplicity
}

export interface ProjectFile {
  version: string;
  bones: Bone[];
  sprites: Sprite[];
  meshes: Mesh[];
  drawings: DrawingStroke[];
  clips: AnimationClip[];
}

export enum ToolMode {
  SELECT = 'SELECT',
  CAMERA = 'CAMERA',
  DRAW = 'DRAW',
  MESH_EDIT = 'MESH_EDIT'
}

export type TransformMode = 'ROTATE' | 'TRANSLATE';

export enum TimelineMode {
  CLIP = 'CLIP',
  GRAPH = 'GRAPH',
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface ReferenceImage {
    id: string;
    url: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    visible: boolean;
}

export interface LoopRange {
    enabled: boolean;
    start: number;
    end: number;
}

export type BoneStyle = 'WEDGE' | 'LINE' | 'OCTAHEDRAL';

export interface AppSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  showBones: boolean;
  showRulers: boolean; 
  showMotionPaths: boolean;
  onionSkin: boolean;
  onionSkinFrames: number;
  backgroundColor: string;
  boneThickness: number;
  boneStyle: BoneStyle; 
}

export type SelectionType = 'BONE' | 'SPRITE' | 'VERTEX';

export interface Selection {
  type: SelectionType;
  id: string;
  subId?: string; // For Vertex ID
}

// History State
export interface HistoryState {
  bones: Bone[];
  sprites: Sprite[];
  drawings: DrawingStroke[];
  currentClip: AnimationClip;
}

export interface ContextMenuState {
    x: number;
    y: number;
    visible: boolean;
    targetId?: string;
    type?: 'BONE' | 'SPRITE';
}

export interface TimelineSelection {
    trackIdx: number;
    keyIndex: number;
}

export interface ModalState {
  active: boolean;
  type: 'GRAB' | 'ROTATE';
  startX?: number; // Screen coords
  startY?: number;
  startMouseWorld?: Vector2; // Local/World coords at start
}
