
import React from 'react';
import { ToolMode, TransformMode } from '../types';
import { MousePointer2, Move, RotateCw, Camera, Save, HelpCircle, PenTool, Grid } from 'lucide-react';

interface ToolbarProps {
  mode: ToolMode;
  setMode: (m: ToolMode) => void;
  transformMode: TransformMode;
  setTransformMode: (m: TransformMode) => void;
  onSave: () => void;
  onHelp: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  setMode,
  transformMode,
  setTransformMode,
  onSave,
  onHelp
}) => {
  
  const btnClass = (active: boolean) => 
    `p-3 rounded-lg mb-2 transition-colors relative group ${active ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700 hover:text-white'}`;

  return (
    <div className="w-14 bg-neutral-900 border-r border-neutral-700 flex flex-col items-center py-4 select-none z-20 shadow-lg">
      <button 
        onClick={() => setMode(ToolMode.SELECT)}
        className={btnClass(mode === ToolMode.SELECT)}
        title="Select Tool (V)"
      >
        <MousePointer2 size={20} />
        <span className="absolute left-full ml-2 bg-black text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50">Select</span>
      </button>

      <div className="w-8 h-px bg-neutral-700 my-2"></div>

      <button 
        onClick={() => { setMode(ToolMode.SELECT); setTransformMode('TRANSLATE'); }}
        className={btnClass(mode === ToolMode.SELECT && transformMode === 'TRANSLATE')}
        title="Move / IK (G)"
      >
        <Move size={20} />
        <span className="absolute left-full ml-2 bg-black text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50">Move / IK</span>
      </button>

      <button 
        onClick={() => { setMode(ToolMode.SELECT); setTransformMode('ROTATE'); }}
        className={btnClass(mode === ToolMode.SELECT && transformMode === 'ROTATE')}
        title="Rotate Bone (R)"
      >
        <RotateCw size={20} />
        <span className="absolute left-full ml-2 bg-black text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50">Rotate</span>
      </button>

      <div className="w-8 h-px bg-neutral-700 my-2"></div>

      <button 
        onClick={() => setMode(ToolMode.DRAW)}
        className={btnClass(mode === ToolMode.DRAW)}
        title="Draw Mode (Grease Pencil)"
      >
        <PenTool size={20} />
        <span className="absolute left-full ml-2 bg-black text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50">Draw Mode</span>
      </button>

      <button 
        onClick={() => setMode(ToolMode.MESH_EDIT)}
        className={btnClass(mode === ToolMode.MESH_EDIT)}
        title="Mesh Edit Mode"
      >
        <Grid size={20} />
        <span className="absolute left-full ml-2 bg-black text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50">Mesh Edit</span>
      </button>

      <div className="w-8 h-px bg-neutral-700 my-2"></div>

      <button 
        onClick={() => setMode(ToolMode.CAMERA)}
        className={btnClass(mode === ToolMode.CAMERA)}
        title="Camera Tool (C)"
      >
        <Camera size={20} />
        <span className="absolute left-full ml-2 bg-black text-white text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-50">Camera</span>
      </button>

      <div className="flex-1"></div>

      <button 
        onClick={onSave}
        className="p-3 rounded-lg mb-2 bg-neutral-800 text-gray-400 hover:bg-neutral-700 hover:text-green-400"
        title="Save Project"
      >
        <Save size={20} />
      </button>

      <button 
        onClick={onHelp}
        className="p-3 rounded-lg mb-2 bg-neutral-800 text-gray-400 hover:bg-neutral-700 hover:text-yellow-400"
        title="Help / Shortcuts"
      >
        <HelpCircle size={20} />
      </button>
    </div>
  );
};
