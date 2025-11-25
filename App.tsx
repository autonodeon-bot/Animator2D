
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Viewport } from './components/Viewport';
import { Timeline } from './components/Timeline';
import { Properties } from './components/Properties';
import { Outliner } from './components/Outliner';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Bone, ToolMode, TimelineMode, CameraState, AnimationClip, Sprite, ProjectFile, AppSettings, Selection, HistoryState, TransformMode, DrawingStroke } from './types';
import { applyAnimation, renderFrameToCanvas, createHumanRig, createWalkCycle, createDummySprites, evaluateDrivers, exportGameData } from './utils';

const INITIAL_BONES: Bone[] = createHumanRig();
const INITIAL_CLIP: AnimationClip = createWalkCycle();

const App: React.FC = () => {
  const [bones, setBones] = useState<Bone[]>(INITIAL_BONES);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [drawings, setDrawings] = useState<DrawingStroke[]>([]);
  const [currentClip, setCurrentClip] = useState<AnimationClip>(INITIAL_CLIP);
  
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mode, setMode] = useState<ToolMode>(ToolMode.SELECT);
  const [transformMode, setTransformMode] = useState<TransformMode>('ROTATE');
  const [timelineMode, setTimelineMode] = useState<TimelineMode>(TimelineMode.CLIP);
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1, rotation: 0 });
  const [settings, setSettings] = useState<AppSettings>({ showGrid: true, snapToGrid: false, showBones: true, onionSkin: false, onionSkinFrames: 1, backgroundColor: '#151515' });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [autoKey, setAutoKey] = useState(false);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastFrameTime = useRef(0);
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const isShiftDown = useRef(false);

  useEffect(() => {
      setSprites(createDummySprites());
  }, []);

  const pushHistory = useCallback(() => {
    const newState: HistoryState = {
        bones: JSON.parse(JSON.stringify(bones)),
        sprites: JSON.parse(JSON.stringify(sprites)),
        drawings: JSON.parse(JSON.stringify(drawings)),
        currentClip: JSON.parse(JSON.stringify(currentClip))
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newState]);
    setHistoryIndex(prev => prev + 1);
  }, [bones, sprites, drawings, currentClip, historyIndex]);

  useEffect(() => { if (history.length === 0) pushHistory(); }, []);

  useEffect(() => {
      const interval = setInterval(() => {
          const project: ProjectFile = { version: '2.0', bones, sprites, meshes: [], drawings, clips: [currentClip] };
          localStorage.setItem('animator-autosave', JSON.stringify(project));
      }, 30000);
      return () => clearInterval(interval);
  }, [bones, sprites, drawings, currentClip]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const s = history[historyIndex - 1];
          setBones(s.bones); setSprites(s.sprites); setDrawings(s.drawings || []); setCurrentClip(s.currentClip);
          setHistoryIndex(historyIndex - 1);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const s = history[historyIndex + 1];
          setBones(s.bones); setSprites(s.sprites); setDrawings(s.drawings || []); setCurrentClip(s.currentClip);
          setHistoryIndex(historyIndex + 1);
      }
  };

  useEffect(() => {
    let raf: number;
    if (isPlaying) {
        const loop = (time: number) => {
            if (time - lastFrameTime.current > (1000 / currentClip.fps)) {
                setCurrentFrame(f => f >= currentClip.duration ? 0 : f + 1);
                lastFrameTime.current = time;
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, currentClip.fps, currentClip.duration]);

  // Apply animation AND Drivers
  const animatedState = isPlaying || currentFrame > 0 ? applyAnimation(bones, sprites, currentClip, currentFrame) : { bones, sprites };
  const finalBones = evaluateDrivers(animatedState.bones); // Apply drivers live
  const finalSprites = animatedState.sprites;

  const prevFrameState = settings.onionSkin ? applyAnimation(bones, sprites, currentClip, Math.max(0, currentFrame - 1)) : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key.toLowerCase() === 'v') setMode(ToolMode.SELECT);
      if (e.key.toLowerCase() === 'c') setMode(ToolMode.CAMERA);
      if (e.key.toLowerCase() === 'd') setMode(ToolMode.DRAW);
      if (e.key.toLowerCase() === 'g') setTransformMode('TRANSLATE');
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey) setTransformMode('ROTATE');
      if (e.key.toLowerCase() === 'h') setShowHelp(prev => !prev);
      if (e.key === 'Shift') isShiftDown.current = true;
      if (e.key === 'Delete') handleDeleteSelection();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftDown.current = false; };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [selection, bones, sprites, historyIndex]);

  const updateBone = (id: string, updates: Partial<Bone>) => {
    const updatedBones = bones.map(b => b.id === id ? { ...b, ...updates } : b);
    setBones(updatedBones);
    if (autoKey && !isPlaying) {
        setCurrentClip(prev => {
            const newTracks = prev.tracks ? [...prev.tracks] : [];
            const bone = updatedBones.find(b => b.id === id);
            if (!bone) return prev;
            const addKey = (prop: 'x'|'y'|'rotation', val: number) => {
                 let track = newTracks.find(t => t.boneId === id && t.property === prop);
                 if (!track) { track = { boneId: id, property: prop, keyframes: [] }; newTracks.push(track); }
                 if (track.keyframes) {
                     track.keyframes = track.keyframes.filter(k => k.time !== currentFrame);
                     track.keyframes.push({ time: currentFrame, value: val, easing: 'linear' });
                 }
            };
            if (updates.rotation !== undefined) addKey('rotation', bone.rotation);
            if (updates.x !== undefined) addKey('x', bone.x);
            if (updates.y !== undefined) addKey('y', bone.y);
            return { ...prev, tracks: newTracks };
        });
    }
  };

  const updateSprite = (id: string, updates: Partial<Sprite>) => {
    setSprites(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const toggleVisibility = (id: string, type: 'BONE' | 'SPRITE') => {
    if (type === 'BONE') setBones(prev => prev.map(b => b.id === id ? { ...b, visible: b.visible === false ? true : false } : b));
  };
  const toggleLock = (id: string) => setBones(prev => prev.map(b => b.id === id ? { ...b, locked: !b.locked } : b));

  const handleImportSprite = (file: File) => {
     const reader = new FileReader();
     reader.onload = (e) => {
        const url = e.target?.result as string;
        setUploadedImages(prev => [...prev, url]);
        if (selection?.type === 'BONE') attachSpriteToBone(selection.id, url);
        else alert("Select a bone to attach sprite to.");
     };
     reader.readAsDataURL(file);
  };

  const attachSpriteToBone = (boneId: string, imageUrl: string = '') => {
     const url = imageUrl || uploadedImages[uploadedImages.length - 1];
     if (!url) return;
     const newSprite: Sprite = { id: `spr_${Date.now()}`, boneId, name: 'Sprite', imageUrl: url, variants: [{name: 'Default', url}], offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: sprites.length };
     setSprites(prev => [...prev, newSprite]);
     setSelection({ type: 'SPRITE', id: newSprite.id });
     pushHistory();
  };

  const handleDeleteSelection = () => {
      if (!selection) return;
      if (confirm("Delete selected object?")) {
          if (selection.type === 'SPRITE') { setSprites(prev => prev.filter(s => s.id !== selection.id)); setSelection(null); pushHistory(); }
      }
  };

  const addKeyframe = () => {
      if (selection?.type === 'BONE') {
          const bone = bones.find(b => b.id === selection.id);
          if (!bone) return;
          const newTracks = [...currentClip.tracks];
          const addT = (p: 'rotation'|'x'|'y', v: number) => {
             let t = newTracks.find(tr => tr.boneId === bone.id && tr.property === p);
             if (!t) { t = { boneId: bone.id, property: p, keyframes: [] }; newTracks.push(t); }
             t.keyframes = t.keyframes.filter(k => k.time !== currentFrame);
             t.keyframes.push({ time: currentFrame, value: v, easing: 'linear' });
          };
          addT('rotation', bone.rotation);
          if (bone.parentId === null) { addT('x', bone.x); addT('y', bone.y); }
          setCurrentClip(prev => ({ ...prev, tracks: newTracks }));
          pushHistory();
      }
  };

  const handleSaveProject = () => {
      const project: ProjectFile = { version: '2.0', bones, sprites, meshes: [], drawings, clips: [currentClip] };
      const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'project.anim'; a.click();
  };
  
  const handleExportEngine = () => {
      const json = exportGameData(bones, sprites, [currentClip]);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'game_data.json'; a.click();
  };

  const handleLoadProject = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const project = JSON.parse(e.target?.result as string) as ProjectFile;
              if(project.bones) setBones(project.bones);
              if(project.sprites) setSprites(project.sprites);
              if(project.drawings) setDrawings(project.drawings);
              if (project.clips && project.clips.length) setCurrentClip(project.clips[0]);
              pushHistory();
          } catch (err) { console.error("Invalid project"); }
      };
      reader.readAsText(file);
  };

  const handleRenderVideo = async () => {
    setIsPlaying(false);
    const width = 1280; 
    const height = 720;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const stream = canvas.captureStream(currentClip.fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5000000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => { const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'animation.webm'; a.click(); };
    recorder.start();
    for (let f = 0; f <= currentClip.duration; f++) {
        const s = applyAnimation(bones, sprites, currentClip, f);
        await renderFrameToCanvas(canvas, s.bones, s.sprites, width, height);
        await new Promise(r => setTimeout(r, 1000 / currentClip.fps)); 
    }
    recorder.stop();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-gray-200 font-sans overflow-hidden">
      <header className="h-10 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between select-none z-50 relative">
        <div className="flex items-center h-full">
            <div className="px-4 font-bold text-orange-500 tracking-wider text-sm">ANIMATOR PRO 2.0</div>
            <div className="h-4 w-px bg-neutral-600 mx-2"></div>
            <MenuBar onImportSprite={handleImportSprite} onSave={handleSaveProject} onLoad={handleLoadProject} onCopyPose={() => {}} onPastePose={() => {}} toggleGrid={() => setSettings(s => ({ ...s, showGrid: !s.showGrid }))} toggleBones={() => setSettings(s => ({ ...s, showBones: !s.showBones }))} showGrid={settings.showGrid} showBones={settings.showBones} onRender={handleRenderVideo} onUndo={handleUndo} onRedo={handleRedo} toggleOnion={() => setSettings(s => ({...s, onionSkin: !s.onionSkin}))} isOnion={settings.onionSkin} onOpenHelp={() => setShowHelp(true)} onExportEngine={handleExportEngine} />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Toolbar mode={mode} setMode={setMode} transformMode={transformMode} setTransformMode={setTransformMode} onSave={handleSaveProject} onHelp={() => setShowHelp(true)} />
        <Outliner bones={bones} sprites={sprites} selection={selection} setSelection={setSelection} toggleVisibility={toggleVisibility} toggleLock={toggleLock} />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <Viewport bones={finalBones} prevBones={prevFrameState?.bones || null} sprites={finalSprites} drawings={drawings} updateBone={updateBone} updateSprite={updateSprite} addDrawing={(d) => setDrawings(prev => [...prev, d])} camera={camera} setCamera={setCamera} selection={selection} setSelection={setSelection} mode={mode} transformMode={transformMode} settings={settings} />
          {showHelp && <div className="absolute top-10 left-10 bg-neutral-800/95 backdrop-blur border border-neutral-600 p-4 rounded shadow-2xl z-50 text-xs w-64"><h3 className="font-bold text-base text-white mb-4">Shortcuts</h3><div className="grid grid-cols-2 gap-2"><span className="text-orange-400">V</span><span>Select</span><span className="text-orange-400">G</span><span>Move/IK</span><span className="text-orange-400">R</span><span>Rotate</span><span className="text-orange-400">D</span><span>Draw</span></div><button onClick={()=>setShowHelp(false)} className="mt-4 w-full bg-neutral-700 py-1 rounded">Close</button></div>}
          <Timeline mode={timelineMode} setMode={setTimelineMode} currentFrame={currentFrame} setCurrentFrame={setCurrentFrame} clip={currentClip} updateClip={(c) => { setCurrentClip(c); pushHistory(); }} isPlaying={isPlaying} setIsPlaying={setIsPlaying} addKeyframe={addKeyframe} autoKey={autoKey} toggleAutoKey={() => setAutoKey(!autoKey)} bones={bones} />
        </div>
        <Properties selection={selection} bones={bones} sprites={sprites} updateBone={updateBone} updateSprite={updateSprite} onAttachSprite={(bid) => attachSpriteToBone(bid)} onDelete={handleDeleteSelection} />
      </div>
      <div className="h-6 bg-neutral-900 border-t border-neutral-700 flex items-center px-4 text-[10px] text-gray-500 justify-between select-none">
        <div className="flex space-x-4"><span className={isPlaying ? 'text-green-500' : ''}>Status: {isPlaying ? 'PLAYING' : 'IDLE'}</span><span>Frame: {Math.round(currentFrame)}</span><span>Mode: {mode}</span><span className={autoKey ? 'text-red-500 font-bold' : ''}>{autoKey ? 'AUTOKEY: ON' : ''}</span></div>
        <div>Auto-Save: Active</div>
      </div>
    </div>
  );
};

export default App;
