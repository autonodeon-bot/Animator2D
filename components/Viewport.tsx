
import React, { useRef, useState, useEffect } from 'react';
import { Bone, ToolMode, CameraState, Sprite, AppSettings, Selection, DerivedBone, TransformMode, DrawingStroke, ReferenceImage, Vector2 } from '../types';
import { calculateFK, degToRad, radToDeg, solveIK } from '../utils';

interface ViewportProps {
  bones: Bone[];
  prevBones: Bone[] | null;
  sprites: Sprite[];
  drawings: DrawingStroke[];
  updateBone: (id: string, updates: Partial<Bone>) => void;
  updateSprite: (id: string, updates: Partial<Sprite>) => void;
  addDrawing: (stroke: DrawingStroke) => void;
  camera: CameraState;
  setCamera: (c: CameraState | ((prev: CameraState) => CameraState)) => void;
  selection: Selection | null;
  setSelection: (s: Selection | null) => void;
  mode: ToolMode;
  transformMode: TransformMode;
  settings: AppSettings;
  referenceImage: ReferenceImage | null;
  motionPath: Vector2[];
  isolateMode: boolean;
  onSnapshot: (blob: Blob) => void;
  triggerSnapshot: boolean;
}

export const Viewport: React.FC<ViewportProps> = ({
  bones,
  prevBones,
  sprites,
  drawings,
  updateBone,
  updateSprite,
  addDrawing,
  camera,
  setCamera,
  selection,
  setSelection,
  mode,
  transformMode,
  settings,
  referenceImage,
  motionPath,
  isolateMode,
  onSnapshot,
  triggerSnapshot
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [dragState, setDragState] = useState<{
    active: boolean;
    type: 'bone' | 'sprite' | 'camera' | 'drawing';
    targetId?: string; 
    startX: number;
    startY: number;
    initialVal: any; 
    // For angular rotation
    pivot?: Vector2;
    startAngle?: number;
    currentPoints?: {x: number, y: number}[];
  } | null>(null);

  const derivedBones = calculateFK(bones);
  const derivedPrevBones = prevBones ? calculateFK(prevBones) : null;

  const getVisibleBones = () => {
      if (!isolateMode || !selection || selection.type !== 'BONE') return derivedBones;
      const visibleIds = new Set<string>();
      const traverse = (id: string) => {
          visibleIds.add(id);
          derivedBones.filter(b => b.parentId === id).forEach(c => traverse(c.id));
      };
      traverse(selection.id);
      return derivedBones.filter(b => visibleIds.has(b.id));
  };
  const visibleBones = getVisibleBones();

  const snap = (val: number) => settings.snapToGrid ? Math.round(val / 10) * 10 : val;

  // Snapshot Logic
  useEffect(() => {
      if (triggerSnapshot && svgRef.current) {
          const svgData = new XMLSerializer().serializeToString(svgRef.current);
          const canvas = document.createElement("canvas");
          const svgSize = svgRef.current.getBoundingClientRect();
          canvas.width = svgSize.width;
          canvas.height = svgSize.height;
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.setAttribute("src", "data:image/svg+xml;base64," + btoa(svgData));
          img.onload = () => {
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(blob => {
                    if (blob) onSnapshot(blob);
                });
              }
          };
      }
  }, [triggerSnapshot, onSnapshot]);


  const getCursor = () => {
      if (mode === ToolMode.DRAW) return 'crosshair';
      if (dragState?.active) return 'grabbing';
      if (mode === ToolMode.CAMERA) return 'move';
      if (mode === ToolMode.SELECT) {
          if (selection?.type === 'BONE') return transformMode === 'ROTATE' ? 'alias' : 'crosshair';
          if (selection?.type === 'SPRITE') return 'move';
      }
      return 'default';
  };

  // Convert Screen Mouse (Pixel) to World Space (SVG Units)
  const getLocalMouse = (clientX: number, clientY: number) => {
     const rect = svgRef.current?.getBoundingClientRect();
     if (!rect) return { x: 0, y: 0 };
     
     const centerX = rect.width / 2;
     const centerY = rect.height / 2;
     
     // Mouse relative to center of SVG
     const mx = clientX - rect.left - centerX;
     const my = clientY - rect.top - centerY;
     
     // Un-rotate camera
     const camRad = degToRad(-camera.rotation); // Negative because SVG rotate is clockwise
     const unrotX = mx * Math.cos(-camRad) - my * Math.sin(-camRad);
     const unrotY = mx * Math.sin(-camRad) + my * Math.cos(-camRad);
     
     // Un-scale and Un-translate
     return { 
         x: (unrotX / camera.zoom) + camera.x, 
         y: (unrotY / camera.zoom) + camera.y 
     };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === ToolMode.CAMERA || e.button === 1) {
      e.preventDefault();
      setDragState({ active: true, type: 'camera', startX: e.clientX, startY: e.clientY, initialVal: { ...camera } });
    } else if (mode === ToolMode.DRAW) {
       const p = getLocalMouse(e.clientX, e.clientY);
       setDragState({ active: true, type: 'drawing', startX: 0, startY: 0, initialVal: null, currentPoints: [p] });
    } else if (mode === ToolMode.SELECT) {
       if (e.target === svgRef.current) setSelection(null);
    }
  };

  const handleObjectMouseDown = (e: React.MouseEvent, type: 'bone' | 'sprite', id: string) => {
    e.stopPropagation(); e.preventDefault();
    setSelection({ type: type === 'bone' ? 'BONE' : 'SPRITE', id });
    const mousePos = getLocalMouse(e.clientX, e.clientY);

    if (mode === ToolMode.SELECT) {
        if (type === 'bone' && bones) {
            const bone = bones.find(b => b.id === id);
            const derivedBone = derivedBones.find(b => b.id === id);
            
            if (bone && derivedBone && !bone.locked) {
                 // For Rotation: Calculate initial angle relative to bone start
                 const angleToMouse = Math.atan2(mousePos.y - derivedBone.worldStart.y, mousePos.x - derivedBone.worldStart.x);
                 
                 setDragState({ 
                     active: true, 
                     type: 'bone', 
                     targetId: id, 
                     startX: e.clientX, 
                     startY: e.clientY, 
                     initialVal: { rotation: bone.rotation, x: bone.x, y: bone.y },
                     pivot: derivedBone.worldStart,
                     startAngle: angleToMouse
                 });
            }
        } else if (type === 'sprite' && sprites) {
            const sprite = sprites.find(s => s.id === id);
            if (sprite) {
                setDragState({ active: true, type: 'sprite', targetId: id, startX: e.clientX, startY: e.clientY, initialVal: { offsetX: sprite.offsetX, offsetY: sprite.offsetY } });
            }
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !dragState.active) return;
    
    // Screen delta
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    if (dragState.type === 'camera') {
        const rad = degToRad(camera.rotation);
        const cos = Math.cos(rad); const sin = Math.sin(rad);
        // Correct rotation logic for camera pan
        const rdx = (dx * cos + dy * sin) / camera.zoom;
        const rdy = (-dx * sin + dy * cos) / camera.zoom;
        setCamera(prev => ({ ...prev, x: dragState.initialVal.x - rdx, y: dragState.initialVal.y - rdy }));
    } 
    else if (dragState.type === 'drawing') {
        const p = getLocalMouse(e.clientX, e.clientY);
        setDragState(prev => prev ? ({ ...prev, currentPoints: [...(prev.currentPoints || []), p] }) : null);
    }
    else if (dragState.type === 'bone' && dragState.targetId && bones) {
      const bone = bones.find(b => b.id === dragState.targetId);
      if (!bone || bone.locked) return;
      
      const worldMouse = getLocalMouse(e.clientX, e.clientY);

      if (transformMode === 'TRANSLATE') {
         if (bone.parentId === null) {
             // Root movement
             updateBone(bone.id, { x: snap(worldMouse.x), y: snap(worldMouse.y) });
         } else {
             // IK Movement
             const solvedBones = solveIK(bones, bone.id, worldMouse);
             solvedBones.forEach(sb => {
                 const original = bones.find(b => b.id === sb.id);
                 if (original && Math.abs(original.rotation - sb.rotation) > 0.01) updateBone(sb.id, { rotation: sb.rotation });
             });
         }
      } else {
         // Angular Rotation Logic (Intuitive)
         if (dragState.pivot && dragState.startAngle !== undefined) {
             const currentAngle = Math.atan2(worldMouse.y - dragState.pivot.y, worldMouse.x - dragState.pivot.x);
             const angleDiff = radToDeg(currentAngle - dragState.startAngle);
             
             let newRot = dragState.initialVal.rotation + angleDiff;
             if (settings.snapToGrid) newRot = Math.round(newRot / 15) * 15;
             updateBone(bone.id, { rotation: newRot });
         }
      }
    }
    else if (dragState.type === 'sprite' && dragState.targetId) {
        const sprite = sprites.find(s => s.id === dragState.targetId);
        const parentBone = derivedBones.find(b => b.id === sprite?.boneId);
        
        if (sprite && parentBone) {
            // We need to transform the SCREEN delta into BONE LOCAL space
            
            // 1. Un-scale camera zoom
            const zoomDx = dx / camera.zoom;
            const zoomDy = dy / camera.zoom;

            // 2. We need to account for Camera Rotation AND Bone Rotation
            // Total visual rotation = Bone World Rotation - Camera Rotation
            // Note: Camera rotation affects the viewport, so we usually just need Bone World Rotation relative to World axes
            
            // Actually, getLocalMouse handles camera. So let's just use world coordinates difference
            const worldMouseStart = getLocalMouse(dragState.startX, dragState.startY);
            const worldMouseCurrent = getLocalMouse(e.clientX, e.clientY);
            
            const worldDx = worldMouseCurrent.x - worldMouseStart.x;
            const worldDy = worldMouseCurrent.y - worldMouseStart.y;

            // 3. Project world delta onto bone local axes
            // Rotate the vector (worldDx, worldDy) by -BoneRotation
            const boneRad = degToRad(-parentBone.worldRotation);
            const localDx = worldDx * Math.cos(boneRad) - worldDy * Math.sin(boneRad);
            const localDy = worldDx * Math.sin(boneRad) + worldDy * Math.cos(boneRad);
            
            updateSprite(dragState.targetId, { 
                offsetX: dragState.initialVal.offsetX + localDx, 
                offsetY: dragState.initialVal.offsetY + localDy 
            });
        }
    }
  };

  const handleMouseUp = () => {
    if (dragState?.type === 'drawing' && dragState.currentPoints) {
        addDrawing({
            id: Date.now().toString(),
            points: dragState.currentPoints,
            color: '#ffffff',
            width: 2,
            isClosed: false
        });
    }
    setDragState(null);
  };

  const getBonePath = (bone: DerivedBone, widthStart: number, widthEnd: number) => {
     const dx = bone.worldEnd.x - bone.worldStart.x;
     const dy = bone.worldEnd.y - bone.worldStart.y;
     const length = Math.sqrt(dx*dx + dy*dy);
     if(length < 1) return "";
     const nx = dx / length; const ny = dy / length;
     const px = -ny; const py = nx;
     const x1 = bone.worldStart.x + px * widthStart; const y1 = bone.worldStart.y + py * widthStart;
     const x2 = bone.worldStart.x - px * widthStart; const y2 = bone.worldStart.y - py * widthStart;
     const x3 = bone.worldEnd.x - px * widthEnd; const y3 = bone.worldEnd.y - py * widthEnd;
     const x4 = bone.worldEnd.x + px * widthEnd; const y4 = bone.worldEnd.y + py * widthEnd;
     return `M ${x1} ${y1} L ${x4} ${y4} L ${x3} ${y3} L ${x2} ${y2} Z`;
  };

  const w = window.innerWidth;
  const h = window.innerHeight;

  return (
    <div className="relative flex-1 bg-[#151515] overflow-hidden" style={{ cursor: getCursor() }}>
       <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2 pointer-events-none select-none">
          <div className="bg-black/50 backdrop-blur text-xs p-2 rounded border border-white/10 text-white">
             <div className="flex items-center gap-2 mb-1">
               <span className={`font-bold ${mode === ToolMode.SELECT ? 'text-blue-400' : 'text-gray-500'}`}>
                   {mode === ToolMode.SELECT ? (transformMode === 'TRANSLATE' ? 'MOVE / IK [G]' : 'ROTATE [R]') : mode}
               </span>
               {isolateMode && <span className="text-red-500 font-bold ml-2">ISOLATE</span>}
             </div>
             <div className="text-[10px] text-gray-400">
                 {selection ? `Selected: ${selection.type} ${selection.id}` : 'No Selection'}
             </div>
          </div>
       </div>

       {settings.showRulers && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-20">
             <div className="absolute top-1/2 left-0 w-full h-px bg-white"></div>
             <div className="absolute top-0 left-1/2 w-px h-full bg-white"></div>
             {[...Array(20)].map((_, i) => (
                 <div key={i} className="absolute h-2 w-px bg-gray-500" style={{ left: '50%', transform: `translateX(${i * 100}px)` }}></div>
             ))}
          </div>
       )}

       <svg 
         ref={svgRef}
         className="w-full h-full touch-none"
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         style={{ backgroundColor: settings.backgroundColor }}
       >
         <defs>
            <pattern id="grid" width={100 * camera.zoom} height={100 * camera.zoom} patternUnits="userSpaceOnUse">
              <path d={`M ${100 * camera.zoom} 0 L 0 0 0 ${100 * camera.zoom}`} fill="none" stroke="#333" strokeWidth={1} />
            </pattern>
            {sprites.map(s => (
                s.clipId ? (
                    <clipPath key={`clip_${s.id}`} id={`clip_${s.id}`}>
                         <rect x="-50" y="-50" width="100" height="100" /> 
                    </clipPath>
                ) : null
            ))}
         </defs>
         
         {settings.showGrid && <rect width="100%" height="100%" fill="url(#grid)" />}

         <g transform={`translate(${w / 2}, ${h / 2}) scale(${camera.zoom}) rotate(${-camera.rotation}) translate(${-camera.x}, ${-camera.y})`}>
            
            {referenceImage && referenceImage.visible && (
                <image 
                   href={referenceImage.url} 
                   x={referenceImage.x - 500} 
                   y={referenceImage.y - 500} 
                   width={1000 * referenceImage.scale} 
                   height={1000 * referenceImage.scale} 
                   opacity={referenceImage.opacity} 
                   className="pointer-events-none"
                />
            )}

            {drawings.map(d => (
                <polyline key={d.id} points={d.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={d.color} strokeWidth={d.width} strokeLinecap="round" />
            ))}
            {dragState?.type === 'drawing' && dragState.currentPoints && (
                <polyline points={dragState.currentPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            )}

            {settings.showMotionPaths && motionPath.length > 1 && (
                <polyline 
                   points={motionPath.map(p => `${p.x},${p.y}`).join(' ')} 
                   fill="none" 
                   stroke="yellow" 
                   strokeWidth={2} 
                   strokeDasharray="4 4"
                   opacity={0.6}
                />
            )}

            {sprites.sort((a,b) => a.zIndex - b.zIndex).map(sprite => {
                const bone = visibleBones.find(b => b.id === sprite.boneId);
                if (!bone || bone.visible === false) return null;
                const isSelected = selection?.type === 'SPRITE' && selection.id === sprite.id;
                
                const transform = `translate(${bone.worldStart.x}, ${bone.worldStart.y}) rotate(${bone.worldRotation}) translate(${sprite.offsetX}, ${sprite.offsetY}) rotate(${sprite.rotation}) scale(${sprite.scaleX}, ${sprite.scaleY})`;
                return (
                    <g key={sprite.id} transform={transform} style={{ opacity: sprite.opacity }} onMouseDown={(e) => handleObjectMouseDown(e, 'sprite', sprite.id)} className="pointer-events-auto">
                        {isSelected && <rect x="-52" y="-52" width="104" height="104" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />}
                        <image href={sprite.imageUrl} x="-50" y="-50" width="100" height="100" />
                    </g>
                )
            })}

            {settings.showBones && visibleBones.map((bone) => {
               if (bone.visible === false) return null;
               const isSelected = selection?.type === 'BONE' && selection.id === bone.id;
               let boneColor = bone.color || '#a3a3a3';
               let jointColor = '#222';
               
               if (isSelected) {
                   if (transformMode === 'ROTATE') { boneColor = '#3b82f6'; jointColor = '#1d4ed8'; } 
                   else if (transformMode === 'TRANSLATE') { jointColor = '#fff'; }
               }
               const width = settings.boneThickness || 20; 
               const tipWidth = width * 0.3;

               return (
                 <g key={bone.id} onMouseDown={(e) => handleObjectMouseDown(e, 'bone', bone.id)} className={`transition-opacity ${bone.locked ? '' : 'hover:opacity-90'}`}>
                    <path d={getBonePath(bone, width, width)} fill="transparent" stroke="transparent" />
                    <path d={getBonePath(bone, tipWidth, tipWidth/3)} fill={boneColor} stroke="none" opacity={0.9} />
                    <circle cx={bone.worldStart.x} cy={bone.worldStart.y} r={tipWidth/1.5} fill={jointColor} stroke={boneColor} strokeWidth={2} />
                    {bone.constraints?.some(c => c.type === 'LIMIT_ROTATION') && (
                        <path d={`M ${bone.worldStart.x} ${bone.worldStart.y} L ${bone.worldStart.x + 10} ${bone.worldStart.y}`} stroke="yellow" strokeWidth={1} opacity={0.5} />
                    )}
                 </g>
               );
            })}
         </g>
       </svg>
    </div>
  );
};
