
import React, { useRef, useEffect, useState } from 'react';
import { TimelineMode, AnimationClip, EasingType, Bone, LoopRange, TimelineSelection } from '../types';
import { Play, Pause, PlusCircle, ZoomIn, ZoomOut, CircleDot, ChevronDown, ChevronUp, StepBack, StepForward, SkipBack, SkipForward, Repeat, ArrowRightToLine, ArrowLeftToLine, Copy } from 'lucide-react';

interface TimelineProps {
  mode: TimelineMode;
  setMode: (m: TimelineMode) => void;
  currentFrame: number;
  setCurrentFrame: (f: number) => void;
  clip: AnimationClip;
  updateClip: (clip: AnimationClip) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  addKeyframe: () => void;
  autoKey: boolean;
  toggleAutoKey: () => void;
  bones: Bone[];
  playbackSpeed: number;
  setPlaybackSpeed: (s: number) => void;
  loopRange: LoopRange;
  setLoopRange: (l: LoopRange) => void;
  onDuplicateKey: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  mode,
  setMode,
  currentFrame,
  setCurrentFrame,
  clip,
  updateClip,
  isPlaying,
  setIsPlaying,
  addKeyframe,
  autoKey,
  toggleAutoKey,
  bones,
  playbackSpeed,
  setPlaybackSpeed,
  loopRange,
  setLoopRange,
  onDuplicateKey
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [scrollX, setScrollX] = useState(0);
  
  // Interaction States
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [dragState, setDragState] = useState<{
      active: boolean;
      type: 'KEY_MOVE' | 'BOX_SELECT';
      startX: number;
      startY: number;
      startScrollX: number;
      initialKeys?: { trackIdx: number, keyIndex: number, time: number }[]; // For multi-move
  } | null>(null);

  const [selection, setSelection] = useState<TimelineSelection[]>([]);

  const FRAME_WIDTH = 12 * zoom;
  const HEADER_HEIGHT = 40; // Taller for ticks
  const ROW_HEIGHT = 24;
  const SIDEBAR_WIDTH = 180;
  const SUMMARY_HEIGHT = 16;

  // Render Loop
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tracksCount = (clip?.tracks?.length || 0) + (clip?.audio ? 1 : 0); 
      canvas.width = wrapper.clientWidth;
      canvas.height = Math.max(wrapper.clientHeight, HEADER_HEIGHT + SUMMARY_HEIGHT + tracksCount * ROW_HEIGHT + 50);
      const width = canvas.width;
      const height = canvas.height;

      // Background
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, width, height);

      // Grid & Ruler
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const startFrame = Math.floor(scrollX / FRAME_WIDTH);
      const visibleFrames = Math.ceil((width - SIDEBAR_WIDTH) / FRAME_WIDTH);
      
      for (let i = startFrame; i <= startFrame + visibleFrames; i++) {
        const x = SIDEBAR_WIDTH + (i * FRAME_WIDTH) - scrollX;
        
        // Vertical Grid Line
        ctx.strokeStyle = i % 10 === 0 ? '#444' : '#2a2a2a';
        ctx.beginPath(); ctx.moveTo(x, HEADER_HEIGHT); ctx.lineTo(x, height); ctx.stroke();

        // Ruler Ticks
        const isMajor = i % 10 === 0;
        const isMid = i % 5 === 0;
        const tickHeight = isMajor ? 12 : (isMid ? 8 : 4);
        
        ctx.strokeStyle = '#888';
        ctx.beginPath(); ctx.moveTo(x, HEADER_HEIGHT - tickHeight); ctx.lineTo(x, HEADER_HEIGHT); ctx.stroke();

        if (isMajor) {
            ctx.fillStyle = '#aaa';
            ctx.font = '10px sans-serif';
            ctx.fillText(i.toString(), x + 2, 12);
        }
      }

      // Loop Region
      if (loopRange.enabled) {
          const sx = SIDEBAR_WIDTH + (loopRange.start * FRAME_WIDTH) - scrollX;
          const ex = SIDEBAR_WIDTH + (loopRange.end * FRAME_WIDTH) - scrollX;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.fillRect(sx, HEADER_HEIGHT, ex - sx, height - HEADER_HEIGHT);
          
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(sx, 0, ex - sx, 4); // Top bar
          ctx.fillRect(sx, 0, 1, height);
          ctx.fillRect(ex, 0, 1, height);
      }

      let currentY = HEADER_HEIGHT;

      // --- Summary Track ---
      ctx.fillStyle = '#2d2d2d';
      ctx.fillRect(0, currentY, width, SUMMARY_HEIGHT);
      ctx.fillStyle = '#888';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText("Summary", 10, currentY + 11);
      
      // Draw Summary Keys (If any track has a key at frame X, draw a key here)
      const summaryKeys = new Set<number>();
      clip?.tracks?.forEach(t => t.keyframes.forEach(k => summaryKeys.add(k.time)));
      
      summaryKeys.forEach(time => {
          const kx = SIDEBAR_WIDTH + (time * FRAME_WIDTH) - scrollX + (FRAME_WIDTH/2);
          const ky = currentY + (SUMMARY_HEIGHT/2);
          
          // Check if ALL keys at this frame are selected
          const keysAtFrame = clip?.tracks.flatMap((t, ti) => t.keyframes.map((k, ki) => ({time: k.time, ti, ki}))).filter(k => k.time === time);
          const allSelected = keysAtFrame?.length && keysAtFrame.every(k => selection.some(s => s.trackIdx === k.ti && s.keyIndex === k.ki));

          ctx.fillStyle = allSelected ? '#fff' : '#666';
          ctx.beginPath(); ctx.fillRect(kx - 3, ky - 3, 6, 6);
      });
      currentY += SUMMARY_HEIGHT;

      // --- Audio Track ---
      if (clip && clip.audio) {
          ctx.fillStyle = '#1a332a';
          ctx.fillRect(0, currentY, width, ROW_HEIGHT);
          ctx.fillStyle = '#4ade80';
          ctx.font = '10px sans-serif';
          ctx.fillText(`Audio: ${clip.audio.name}`, 10, currentY + 16);
          currentY += ROW_HEIGHT;
      }

      // --- Bone Tracks ---
      if (mode === TimelineMode.CLIP && clip && clip.tracks) {
        clip.tracks.forEach((track, idx) => {
            const y = currentY;
            const bone = bones.find(b => b.id === track.boneId);
            const boneName = bone ? bone.name : track.boneId;
            const isSelectedTrack = selection.some(s => s.trackIdx === idx);

            ctx.fillStyle = idx % 2 === 0 ? '#252525' : '#1e1e1e';
            if (isSelectedTrack) ctx.fillStyle = '#2c2c2c';
            ctx.fillRect(0, y, SIDEBAR_WIDTH, ROW_HEIGHT);
            
            // Track Name
            ctx.fillStyle = bone?.color || '#a3a3a3';
            ctx.fillRect(0, y, 4, ROW_HEIGHT); // Color indicator
            ctx.fillStyle = '#ccc';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${boneName} . ${track.property}`, 12, y + 16);

            // Track Background
            if (idx % 2 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                ctx.fillRect(SIDEBAR_WIDTH, y, width - SIDEBAR_WIDTH, ROW_HEIGHT);
            }
            
            // Divider
            ctx.strokeStyle = '#303030';
            ctx.beginPath(); ctx.moveTo(0, y + ROW_HEIGHT); ctx.lineTo(width, y + ROW_HEIGHT); ctx.stroke();

            // Render Keys
            if (track.keyframes) {
                track.keyframes.forEach((kf, kIdx) => {
                    const kx = SIDEBAR_WIDTH + (kf.time * FRAME_WIDTH) - scrollX + (FRAME_WIDTH / 2);
                    const ky = y + (ROW_HEIGHT / 2);
                    
                    const isSelected = selection.some(s => s.trackIdx === idx && s.keyIndex === kIdx);

                    // Key Color based on Easing
                    if (isSelected) ctx.fillStyle = '#ffffff'; // Selected = White
                    else if (kf.easing === 'linear') ctx.fillStyle = '#a3a3a3'; // Linear = Grey
                    else if (kf.easing.includes('ease')) ctx.fillStyle = '#4ade80'; // Smooth = Green
                    else ctx.fillStyle = '#facc15'; // Other = Yellow
                    
                    // 3ds Max Style Rectangle Keys with border
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 1;
                    ctx.fillRect(kx - 4, ky - 6, 8, 12);
                    ctx.strokeRect(kx - 4, ky - 6, 8, 12);
                });
            }
            currentY += ROW_HEIGHT;
        });
      }
      
      // Playhead
      const playheadX = SIDEBAR_WIDTH + (currentFrame * FRAME_WIDTH) - scrollX + (FRAME_WIDTH/2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, height); ctx.stroke();
      
      // Playhead Top Triangle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.moveTo(playheadX - 6, 0); ctx.lineTo(playheadX + 6, 0); ctx.lineTo(playheadX, 10); ctx.fill();

      // Box Selection Rect
      if (dragState?.type === 'BOX_SELECT') {
         const rect = canvas.getBoundingClientRect();
         // We need current mouse pos, but we only have start. Ideally we track mouse move in state or ref.
         // Simplified: Box selection visual is handled by Overlay div usually, but here we can draw if we tracked current mouse
      }

    };
    render();
  }, [currentFrame, mode, clip, zoom, wrapperRef.current?.clientWidth, wrapperRef.current?.clientHeight, bones, loopRange, selection, scrollX]);

  // --- Input Handling ---

  const handleMouseDown = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 1. Scrubbing (Top Header)
      if (y < HEADER_HEIGHT) {
         setIsScrubbing(true);
         const frame = Math.max(0, (x - SIDEBAR_WIDTH + scrollX) / FRAME_WIDTH);
         setCurrentFrame(frame);
         return;
      }

      const frame = Math.round((x - SIDEBAR_WIDTH + scrollX) / FRAME_WIDTH);
      const relativeY = y - HEADER_HEIGHT - SUMMARY_HEIGHT;
      const trackIdx = Math.floor(relativeY / ROW_HEIGHT);

      // 2. Summary Track Click
      if (y >= HEADER_HEIGHT && y < HEADER_HEIGHT + SUMMARY_HEIGHT) {
          // Select all keys at this frame
          const newSel: TimelineSelection[] = [];
          clip.tracks.forEach((t, ti) => {
              const ki = t.keyframes.findIndex(k => Math.abs(k.time - frame) < 0.2);
              if (ki !== -1) newSel.push({ trackIdx: ti, keyIndex: ki });
          });
          setSelection(newSel);
          if (newSel.length > 0) {
              const initialKeys = newSel.map(s => ({
                  trackIdx: s.trackIdx, keyIndex: s.keyIndex, time: clip.tracks[s.trackIdx].keyframes[s.keyIndex].time
              }));
              setDragState({ active: true, type: 'KEY_MOVE', startX: e.clientX, startY: e.clientY, startScrollX: scrollX, initialKeys });
          }
          return;
      }

      // 3. Track Key Click
      if (x >= SIDEBAR_WIDTH && trackIdx >= 0 && trackIdx < clip.tracks.length) {
          const track = clip.tracks[trackIdx];
          const keyIndex = track.keyframes.findIndex(k => Math.abs(k.time - frame) < 0.4); // Tolerance

          if (keyIndex !== -1) {
              // Clicked a key
              const isSelected = selection.some(s => s.trackIdx === trackIdx && s.keyIndex === keyIndex);
              let newSel = [...selection];
              
              if (e.ctrlKey || e.shiftKey) {
                  if (isSelected) newSel = newSel.filter(s => !(s.trackIdx === trackIdx && s.keyIndex === keyIndex));
                  else newSel.push({ trackIdx, keyIndex });
              } else {
                  if (!isSelected) newSel = [{ trackIdx, keyIndex }];
              }
              setSelection(newSel);
              
              // Prepare for Drag
              const initialKeys = newSel.map(s => ({
                  trackIdx: s.trackIdx, keyIndex: s.keyIndex, time: clip.tracks[s.trackIdx].keyframes[s.keyIndex].time
              }));
              setDragState({ active: true, type: 'KEY_MOVE', startX: e.clientX, startY: e.clientY, startScrollX: scrollX, initialKeys });
          } else {
              // Clicked Empty Space -> Box Select or Deselect
              if (!e.ctrlKey && !e.shiftKey) setSelection([]);
              setDragState({ active: true, type: 'BOX_SELECT', startX: e.clientX, startY: e.clientY, startScrollX: scrollX });
          }
      }
  };

  useEffect(() => {
    const handleWindowMove = (e: MouseEvent) => {
        if (isScrubbing && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const frame = Math.max(0, (x - SIDEBAR_WIDTH + scrollX) / FRAME_WIDTH);
            setCurrentFrame(frame);
        }

        if (dragState?.active && dragState.type === 'KEY_MOVE' && dragState.initialKeys) {
            const dxPixels = e.clientX - dragState.startX;
            const dtFrames = Math.round(dxPixels / FRAME_WIDTH);
            
            if (dtFrames !== 0) {
                const newClip = { ...clip };
                dragState.initialKeys.forEach(init => {
                    const newTime = Math.max(0, init.time + dtFrames);
                    // Check collision
                    const track = newClip.tracks[init.trackIdx];
                    // Ensure we don't overwrite non-selected keys
                    const collision = track.keyframes.some((k, i) => i !== init.keyIndex && k.time === newTime && !selection.some(s => s.trackIdx === init.trackIdx && s.keyIndex === i));
                    
                    if (!collision) {
                        track.keyframes[init.keyIndex].time = newTime;
                    }
                });
                updateClip(newClip);
            }
        }
        
        // Handle Box Select visual logic would go here
    };

    const handleWindowUp = (e: MouseEvent) => {
        if (dragState?.type === 'BOX_SELECT') {
            // Finalize Box Select
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const endX = e.clientX; 
                const endY = e.clientY;
                // Calculate box in canvas coords
                const left = Math.min(dragState.startX, endX) - rect.left;
                const right = Math.max(dragState.startX, endX) - rect.left;
                const top = Math.min(dragState.startY, endY) - rect.top;
                const bottom = Math.max(dragState.startY, endY) - rect.top;
                
                // Find keys inside
                const newSel: TimelineSelection[] = [];
                const startFrame = (left - SIDEBAR_WIDTH + scrollX) / FRAME_WIDTH;
                const endFrame = (right - SIDEBAR_WIDTH + scrollX) / FRAME_WIDTH;
                const startTrack = Math.floor((top - HEADER_HEIGHT - SUMMARY_HEIGHT) / ROW_HEIGHT);
                const endTrack = Math.floor((bottom - HEADER_HEIGHT - SUMMARY_HEIGHT) / ROW_HEIGHT);

                clip.tracks.forEach((t, tIdx) => {
                    if (tIdx >= startTrack && tIdx <= endTrack) {
                        t.keyframes.forEach((k, kIdx) => {
                            if (k.time >= startFrame && k.time <= endFrame) {
                                newSel.push({ trackIdx: tIdx, keyIndex: kIdx });
                            }
                        });
                    }
                });
                if (e.ctrlKey) setSelection(prev => [...prev, ...newSel]);
                else setSelection(newSel);
            }
        }
        
        setIsScrubbing(false);
        setDragState(null);
    };

    if (isScrubbing || dragState?.active) {
        window.addEventListener('mousemove', handleWindowMove);
        window.addEventListener('mouseup', handleWindowUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleWindowMove);
        window.removeEventListener('mouseup', handleWindowUp);
    };
  }, [isScrubbing, dragState, scrollX, FRAME_WIDTH, SIDEBAR_WIDTH, clip]);

  const updateEasing = (easing: EasingType) => {
      const newClip = { ...clip };
      selection.forEach(s => {
          newClip.tracks[s.trackIdx].keyframes[s.keyIndex].easing = easing;
      });
      updateClip(newClip);
  };

  const deleteSelectedKeys = () => {
      const newClip = { ...clip };
      // Sort in reverse to avoid index shift issues
      const sorted = [...selection].sort((a,b) => a.keyIndex - b.keyIndex).reverse();
      sorted.forEach(s => {
          newClip.tracks[s.trackIdx].keyframes.splice(s.keyIndex, 1);
      });
      setSelection([]);
      updateClip(newClip);
  };

  // Zoom with Wheel
  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoom(z => Math.max(0.2, Math.min(4, z + delta)));
      } else {
          setScrollX(x => Math.max(0, x + e.deltaY));
      }
  };

  return (
    <>
    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-40">
       {collapsed && (
           <button onClick={() => setCollapsed(false)} className="bg-neutral-800 border border-neutral-600 rounded-t px-4 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-1">
               <ChevronUp size={12} /> Show Timeline
           </button>
       )}
    </div>
    <div className={`flex flex-col border-t border-neutral-700 bg-neutral-900 select-none transition-all duration-300 ease-in-out ${collapsed ? 'h-0 overflow-hidden' : 'h-80'}`}>
      <div className="flex items-center justify-between px-2 py-1 bg-neutral-800 border-b border-neutral-700 h-9">
        <div className="flex items-center space-x-2">
           <button onClick={() => setCollapsed(true)} className="text-gray-500 hover:text-white"><ChevronDown size={14} /></button>
           
           <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-700">
                <button onClick={() => setCurrentFrame(loopRange.enabled ? loopRange.start : 0)} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Go to Start"><SkipBack size={12}/></button>
                <button onClick={() => setCurrentFrame(Math.max(0, Math.floor(currentFrame) - 1))} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Step Back"><StepBack size={12}/></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 hover:bg-neutral-800 rounded text-white mx-1 w-6 flex justify-center">
                    {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                </button>
                <button onClick={() => setCurrentFrame(Math.floor(currentFrame) + 1)} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Step Forward"><StepForward size={12}/></button>
                <button onClick={() => setCurrentFrame(loopRange.enabled ? loopRange.end : clip.duration)} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Go to End"><SkipForward size={12}/></button>
           </div>
           
           <button onClick={() => setLoopRange({...loopRange, enabled: !loopRange.enabled})} className={`p-1 rounded ${loopRange.enabled ? 'text-blue-400' : 'text-gray-500'}`} title="Loop Region"><Repeat size={14}/></button>
           
           <div className="flex items-center gap-2 border-l border-neutral-700 pl-2 ml-2">
               <span className="text-[10px] text-gray-500">FPS</span>
               <input type="number" className="w-8 bg-neutral-900 border border-neutral-700 rounded text-[10px] text-center" value={clip.fps} disabled />
           </div>
        </div>

        <div className="flex items-center space-x-2">
            {selection.length > 0 && (
                <div className="flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">
                    <select onChange={(e) => updateEasing(e.target.value as EasingType)} className="bg-transparent text-[10px] text-white outline-none w-20">
                        <option value="linear">Linear</option>
                        <option value="ease-in">Ease In</option>
                        <option value="ease-out">Ease Out</option>
                        <option value="ease-in-out">Smooth</option>
                    </select>
                    <button onClick={deleteSelectedKeys} className="text-red-400 hover:text-red-300 ml-1 text-[10px]">Del</button>
                </div>
            )}
            <button onClick={onDuplicateKey} className="p-1 hover:text-white text-gray-400" title="Duplicate Keyframe"><Copy size={14}/></button>
            <div className="flex items-center bg-neutral-900 rounded border border-neutral-700 overflow-hidden">
                <button onClick={toggleAutoKey} className={`flex items-center gap-1 px-2 py-1 text-xs ${autoKey ? 'bg-red-900/50 text-red-400' : 'text-gray-500 hover:text-gray-300'}`}><CircleDot size={12} className={autoKey ? 'fill-red-500 text-red-500' : ''} /> REC</button>
            </div>
             <button onClick={addKeyframe} className="flex items-center gap-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-xs rounded text-white"><PlusCircle size={12} /> Key</button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden" ref={wrapperRef}>
          <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 block cursor-crosshair" 
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          />
      </div>
    </div>
    </>
  );
};
