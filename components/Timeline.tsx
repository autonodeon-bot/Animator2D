
import React, { useRef, useEffect, useState } from 'react';
import { TimelineMode, AnimationClip, EasingType, Bone, LoopRange } from '../types';
import { Play, Pause, PlusCircle, ZoomIn, ZoomOut, CircleDot, ChevronDown, ChevronUp, Activity, StepBack, StepForward, SkipBack, SkipForward, Repeat } from 'lucide-react';

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
  setLoopRange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [draggingKey, setDraggingKey] = useState<{ trackIdx: number, keyIndex: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const FRAME_WIDTH = 12 * zoom;
  const HEADER_HEIGHT = 30;
  const LOOP_BAR_HEIGHT = 10;
  const ROW_HEIGHT = 24;
  const SIDEBAR_WIDTH = 160;

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tracksCount = (clip?.tracks?.length || 0) + (clip?.audio ? 1 : 0); 

      canvas.width = wrapper.clientWidth;
      canvas.height = Math.max(wrapper.clientHeight, HEADER_HEIGHT + LOOP_BAR_HEIGHT + tracksCount * ROW_HEIGHT + 50);
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#171717';
      ctx.fillRect(0, 0, width, height);

      // Loop Region
      if (loopRange.enabled) {
          const startX = SIDEBAR_WIDTH + loopRange.start * FRAME_WIDTH + (FRAME_WIDTH/2);
          const endX = SIDEBAR_WIDTH + loopRange.end * FRAME_WIDTH + (FRAME_WIDTH/2);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.fillRect(startX, 0, endX - startX, height);
          
          // Loop Bar
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(startX, 0, endX - startX, LOOP_BAR_HEIGHT);
          ctx.fillStyle = '#fff';
          ctx.fillRect(startX, 0, 2, height);
          ctx.fillRect(endX, 0, 2, height);
      }

      // Grid
      ctx.strokeStyle = '#262626';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const visibleFrames = Math.ceil((width - SIDEBAR_WIDTH) / FRAME_WIDTH);
      for (let i = 0; i <= visibleFrames; i++) {
        const x = SIDEBAR_WIDTH + i * FRAME_WIDTH;
        ctx.moveTo(x + 0.5, LOOP_BAR_HEIGHT);
        ctx.lineTo(x + 0.5, height);
        if (i % 5 === 0) {
          ctx.fillStyle = '#525252';
          ctx.font = '9px sans-serif';
          ctx.fillText(i.toString(), x + 2, LOOP_BAR_HEIGHT + 12);
        }
      }
      ctx.stroke();

      let currentY = HEADER_HEIGHT + LOOP_BAR_HEIGHT;

      // Audio Track rendering
      if (clip && clip.audio) {
          ctx.fillStyle = '#0f2e1a';
          ctx.fillRect(0, currentY, width, ROW_HEIGHT);
          currentY += ROW_HEIGHT;
      }

      if (mode === TimelineMode.CLIP && clip && clip.tracks) {
        clip.tracks.forEach((track, idx) => {
            const y = currentY;
            const boneName = bones ? (bones.find(b => b.id === track.boneId)?.name || track.boneId) : track.boneId;

            ctx.fillStyle = idx % 2 === 0 ? '#202020' : '#1a1a1a';
            ctx.fillRect(0, y, SIDEBAR_WIDTH, ROW_HEIGHT);
            ctx.fillStyle = '#a3a3a3';
            ctx.font = '10px sans-serif';
            ctx.fillText(`${boneName} (${track.property})`, 10, y + 16);

            if (idx % 2 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                ctx.fillRect(SIDEBAR_WIDTH, y, width - SIDEBAR_WIDTH, ROW_HEIGHT);
            }
            
            ctx.strokeStyle = '#333';
            ctx.beginPath(); ctx.moveTo(0, y + ROW_HEIGHT); ctx.lineTo(width, y + ROW_HEIGHT); ctx.stroke();

            // Render Keys
            if (track.keyframes) {
                track.keyframes.forEach(kf => {
                    const kx = SIDEBAR_WIDTH + kf.time * FRAME_WIDTH + (FRAME_WIDTH / 2);
                    const ky = y + (ROW_HEIGHT / 2);
                    ctx.fillStyle = kf.easing !== 'linear' ? '#facc15' : '#d8b4fe';
                    // Diamond shape
                    ctx.beginPath(); ctx.moveTo(kx, ky - 4); ctx.lineTo(kx + 4, ky); ctx.lineTo(kx, ky + 4); ctx.lineTo(kx - 4, ky); ctx.fill();
                });
            }
            currentY += ROW_HEIGHT;
        });
      }
      
      const playheadX = SIDEBAR_WIDTH + currentFrame * FRAME_WIDTH + (FRAME_WIDTH/2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, height); ctx.stroke();
    };
    render();
  }, [currentFrame, mode, clip, zoom, wrapperRef.current?.clientWidth, wrapperRef.current?.clientHeight, bones, loopRange]);

  const handleMouseDown = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle Loop Dragging (Top Bar)
      if (y < LOOP_BAR_HEIGHT) {
         const frame = Math.max(0, Math.round((x - SIDEBAR_WIDTH) / FRAME_WIDTH));
         if (e.shiftKey) setLoopRange({ ...loopRange, end: frame, enabled: true });
         else setLoopRange({ ...loopRange, start: frame, enabled: true });
         return;
      }

      // Check for Keyframe Click
      if (x >= SIDEBAR_WIDTH) {
          const frame = Math.max(0, Math.round((x - SIDEBAR_WIDTH) / FRAME_WIDTH));
          const trackIdx = Math.floor((y - HEADER_HEIGHT - LOOP_BAR_HEIGHT) / ROW_HEIGHT);

          if (mode === TimelineMode.CLIP && clip?.tracks && trackIdx >= 0 && trackIdx < clip.tracks.length) {
              const track = clip.tracks[trackIdx];
              const keyIndex = track.keyframes.findIndex(k => Math.abs(k.time - frame) < 0.5); // Snap check
              if (keyIndex !== -1) { 
                  setDraggingKey({ trackIdx, keyIndex }); 
                  return; 
              }
          }
      }

      // Start Scrubbing
      setIsScrubbing(true);
      if (x >= SIDEBAR_WIDTH) {
          const frame = Math.max(0, (x - SIDEBAR_WIDTH) / FRAME_WIDTH);
          setCurrentFrame(frame); // Allow float during scrub
      }
  };

  // Global Mouse Move for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;

        if (draggingKey && mode === TimelineMode.CLIP) {
            const frame = Math.max(0, Math.round((x - SIDEBAR_WIDTH) / FRAME_WIDTH));
            const newClip = { ...clip };
            const track = newClip.tracks[draggingKey.trackIdx];
            const key = track.keyframes[draggingKey.keyIndex];
            if (!track.keyframes.some((k, i) => i !== draggingKey.keyIndex && k.time === frame)) {
                key.time = frame;
                updateClip(newClip);
            }
        } else if (isScrubbing) {
            const frame = Math.max(0, (x - SIDEBAR_WIDTH) / FRAME_WIDTH);
            setCurrentFrame(frame);
        }
    };

    const handleGlobalMouseUp = () => {
        setDraggingKey(null);
        setIsScrubbing(false);
        // Snap to integer on release if desired, or keep smooth
        setCurrentFrame(Math.round(currentFrame)); 
    };

    if (draggingKey || isScrubbing) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingKey, isScrubbing, clip, mode, currentFrame, FRAME_WIDTH, SIDEBAR_WIDTH]);

  return (
    <>
    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-40">
       {collapsed && (
           <button onClick={() => setCollapsed(false)} className="bg-neutral-800 border border-neutral-600 rounded-t px-4 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-1">
               <ChevronUp size={12} /> Show Timeline
           </button>
       )}
    </div>
    <div className={`flex flex-col border-t border-neutral-700 bg-neutral-900 select-none transition-all duration-300 ease-in-out ${collapsed ? 'h-0 overflow-hidden' : 'h-72'}`}>
      <div className="flex items-center justify-between px-2 py-1 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center space-x-2">
           <button onClick={() => setCollapsed(true)} className="text-gray-500 hover:text-white"><ChevronDown size={14} /></button>
           
           {/* Playback Controls */}
           <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-700">
                <button onClick={() => setCurrentFrame(loopRange.enabled ? loopRange.start : 0)} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Go to Start"><SkipBack size={12}/></button>
                <button onClick={() => setCurrentFrame(Math.max(0, Math.floor(currentFrame) - 1))} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Step Back"><StepBack size={12}/></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-1 hover:bg-neutral-800 rounded text-white mx-1">
                    {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                </button>
                <button onClick={() => setCurrentFrame(Math.floor(currentFrame) + 1)} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Step Forward"><StepForward size={12}/></button>
                <button onClick={() => setCurrentFrame(loopRange.enabled ? loopRange.end : clip.duration)} className="p-1 hover:bg-neutral-800 rounded text-gray-400" title="Go to End"><SkipForward size={12}/></button>
           </div>
           
           <button onClick={() => setLoopRange({...loopRange, enabled: !loopRange.enabled})} className={`p-1 rounded ${loopRange.enabled ? 'text-blue-400' : 'text-gray-500'}`} title="Loop Region"><Repeat size={14}/></button>

           <div className="flex items-center space-x-2 text-xs border-l border-neutral-700 pl-2">
             <div className="flex flex-col"><span className="text-[9px] text-gray-500">FRAME</span><input type="number" value={Math.round(currentFrame)} onChange={(e) => setCurrentFrame(Math.max(0, parseInt(e.target.value)))} className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1 text-blue-400 font-mono"/></div>
             <div className="flex flex-col"><span className="text-[9px] text-gray-500">SPEED</span>
                 <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="w-14 bg-neutral-900 border border-neutral-700 rounded px-0 text-gray-300">
                     <option value={0.25}>0.25x</option>
                     <option value={0.5}>0.5x</option>
                     <option value={1}>1.0x</option>
                     <option value={1.5}>1.5x</option>
                     <option value={2}>2.0x</option>
                 </select>
             </div>
           </div>
        </div>

        <div className="flex items-center space-x-2">
            <div className="flex items-center bg-neutral-900 rounded border border-neutral-700 overflow-hidden">
                <button onClick={toggleAutoKey} className={`flex items-center gap-1 px-2 py-1 text-xs ${autoKey ? 'bg-red-900/50 text-red-400' : 'text-gray-500 hover:text-gray-300'}`}><CircleDot size={12} className={autoKey ? 'fill-red-500 text-red-500' : ''} /> REC</button>
            </div>
            <div className="flex items-center gap-1 mr-4 text-gray-400">
                <ZoomOut size={12} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="cursor-pointer hover:text-white" />
                <span className="text-[10px] w-6 text-center">{Math.round(zoom*100)}%</span>
                <ZoomIn size={12} onClick={() => setZoom(Math.min(3, zoom + 0.25))} className="cursor-pointer hover:text-white" />
            </div>
             <button onClick={addKeyframe} className="flex items-center gap-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-xs rounded text-white"><PlusCircle size={12} /> Keyframe</button>
        </div>
      </div>

      <div className="flex-1 relative overflow-y-auto overflow-x-hidden" ref={wrapperRef}>
          <canvas ref={canvasRef} className="absolute top-0 left-0 block cursor-pointer" onMouseDown={handleMouseDown} />
      </div>
    </div>
    </>
  );
};
