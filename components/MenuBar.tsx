
import React, { useRef } from 'react';
import { FolderOpen, Image as ImageIcon, Save, Video, Grid, Eye, Copy, ClipboardPaste, Undo, Redo, Layers, HelpCircle, Share, Camera, FileImage, Ruler, Unlock, Activity } from 'lucide-react';

interface MenuBarProps {
  onImportSprite: (file: File) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onCopyPose: () => void;
  onPastePose: () => void;
  toggleGrid: () => void;
  toggleBones: () => void;
  toggleOnion: () => void;
  toggleRulers: () => void;
  toggleMotionPaths: () => void;
  showGrid: boolean;
  showBones: boolean;
  showRulers: boolean;
  showMotionPaths: boolean;
  isOnion: boolean;
  onRender: () => void;
  onSnapshot: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenHelp: () => void;
  onExportEngine: () => void;
  toggleIsolate: () => void;
  isIsolate: boolean;
  onUnlockAll: () => void;
  onShowAll: () => void;
  onImportRef: (file: File) => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onImportSprite,
  onSave,
  onLoad,
  onCopyPose,
  onPastePose,
  toggleGrid,
  toggleBones,
  toggleOnion,
  toggleRulers,
  toggleMotionPaths,
  showGrid,
  showBones,
  showRulers,
  showMotionPaths,
  isOnion,
  onRender,
  onSnapshot,
  onUndo,
  onRedo,
  onOpenHelp,
  onExportEngine,
  toggleIsolate,
  isIsolate,
  onUnlockAll,
  onShowAll,
  onImportRef
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center space-x-1 text-xs h-full">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && onImportSprite(e.target.files[0])} />
      <input type="file" ref={refInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && onImportRef(e.target.files[0])} />
      <input type="file" ref={projectInputRef} className="hidden" accept=".json" onChange={(e) => e.target.files && onLoad(e.target.files[0])} />

      <div className="relative group px-3 h-full flex items-center hover:bg-neutral-700 cursor-pointer">
        <span>File</span>
        <div className="absolute top-full left-0 bg-neutral-800 border border-neutral-700 w-56 shadow-xl hidden group-hover:block z-50">
          <div onClick={() => projectInputRef.current?.click()} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><FolderOpen size={12} /> Open Project</div>
          <div onClick={onSave} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Save size={12} /> Save Project</div>
          <div className="h-px bg-neutral-700 my-1"></div>
          <div onClick={onExportEngine} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Share size={12} /> Export to Engine (JSON)</div>
          <div onClick={onSnapshot} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Camera size={12} /> Save Snapshot (PNG)</div>
          <div className="h-px bg-neutral-700 my-1"></div>
          <div onClick={() => fileInputRef.current?.click()} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><ImageIcon size={12} /> Import Sprite</div>
          <div onClick={() => refInputRef.current?.click()} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><FileImage size={12} /> Import Reference Image</div>
        </div>
      </div>

      <div className="relative group px-3 h-full flex items-center hover:bg-neutral-700 cursor-pointer">
        <span>Edit</span>
        <div className="absolute top-full left-0 bg-neutral-800 border border-neutral-700 w-48 shadow-xl hidden group-hover:block z-50">
           <div onClick={onUndo} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Undo size={12} /> Undo (Ctrl+Z)</div>
           <div onClick={onRedo} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Redo size={12} /> Redo (Ctrl+Y)</div>
           <div className="h-px bg-neutral-700 my-1"></div>
           <div onClick={onCopyPose} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Copy size={12} /> Copy Pose</div>
           <div onClick={onPastePose} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><ClipboardPaste size={12} /> Paste Pose</div>
           <div className="h-px bg-neutral-700 my-1"></div>
           <div onClick={onUnlockAll} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Unlock size={12} /> Unlock All</div>
           <div onClick={onShowAll} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Eye size={12} /> Show All</div>
        </div>
      </div>

      <div className="relative group px-3 h-full flex items-center hover:bg-neutral-700 cursor-pointer">
        <span>View</span>
        <div className="absolute top-full left-0 bg-neutral-800 border border-neutral-700 w-56 shadow-xl hidden group-hover:block z-50">
           <div onClick={toggleGrid} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Grid size={12} /> {showGrid ? 'Hide Grid' : 'Show Grid'}</div>
           <div onClick={toggleBones} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Eye size={12} /> {showBones ? 'Hide Bones' : 'Show Bones'}</div>
           <div onClick={toggleRulers} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Ruler size={12} /> {showRulers ? 'Hide Rulers' : 'Show Rulers'}</div>
           <div onClick={toggleMotionPaths} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Activity size={12} /> {showMotionPaths ? 'Hide Motion Paths' : 'Show Motion Paths'}</div>
           <div onClick={toggleOnion} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Layers size={12} /> {isOnion ? 'Hide Onion Skin' : 'Show Onion Skin'}</div>
           <div className="h-px bg-neutral-700 my-1"></div>
           <div onClick={toggleIsolate} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer text-orange-400">{isIsolate ? 'Exit Isolate Mode (Shift+H)' : 'Isolate Selection (Shift+H)'}</div>
        </div>
      </div>

      <div className="relative group px-3 h-full flex items-center hover:bg-neutral-700 cursor-pointer">
        <span>Render</span>
        <div className="absolute top-full left-0 bg-neutral-800 border border-neutral-700 w-48 shadow-xl hidden group-hover:block z-50">
           <div onClick={onRender} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><Video size={12} /> Render Video (WebM)</div>
        </div>
      </div>

      <div className="relative group px-3 h-full flex items-center hover:bg-neutral-700 cursor-pointer">
        <span>Help</span>
        <div className="absolute top-full left-0 bg-neutral-800 border border-neutral-700 w-48 shadow-xl hidden group-hover:block z-50">
           <div onClick={onOpenHelp} className="px-4 py-2 hover:bg-blue-600 flex items-center gap-2 cursor-pointer"><HelpCircle size={12} /> Shortcuts</div>
        </div>
      </div>
    </div>
  );
};
