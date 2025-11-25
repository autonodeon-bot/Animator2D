
import React, { useState } from 'react';
import { Bone, Sprite, Selection, Constraint, Driver } from '../types';
import { Cuboid, Crosshair, Image as ImageIcon, Trash2, Anchor, Activity, Grid, Plus, Settings, X } from 'lucide-react';

interface PropertiesProps {
  selection: Selection | null;
  bones: Bone[];
  sprites: Sprite[];
  updateBone: (id: string, updates: Partial<Bone>) => void;
  updateSprite: (id: string, updates: Partial<Sprite>) => void;
  onAttachSprite: (boneId: string) => void;
  onDelete: () => void;
}

export const Properties: React.FC<PropertiesProps> = ({ 
  selection,
  bones,
  sprites,
  updateBone,
  updateSprite,
  onAttachSprite,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'TRANSFORM' | 'CONSTRAINTS' | 'MESH' | 'DRIVERS'>('TRANSFORM');

  if (!selection) {
    return (
      <div className="w-72 bg-neutral-900 border-l border-neutral-700 p-4 text-neutral-500 text-sm flex flex-col items-center justify-center select-none">
        <Cuboid size={48} className="mb-4 opacity-20" />
        <p>No object selected</p>
        <p className="text-xs mt-2 opacity-50">Press 'V' and click an object</p>
      </div>
    );
  }

  // --- BONE PROPERTIES ---
  if (selection.type === 'BONE') {
      const bone = bones ? bones.find(b => b.id === selection.id) : null;
      if (!bone) return null;
      const attachedSprite = sprites ? sprites.find(s => s.boneId === bone.id) : null;

      const addConstraint = (type: Constraint['type']) => {
          const newC: Constraint = { id: Date.now().toString(), type, min: -45, max: 45, influence: 1 };
          updateBone(bone.id, { constraints: [...(bone.constraints || []), newC] });
      };

      const removeConstraint = (cid: string) => {
          updateBone(bone.id, { constraints: bone.constraints?.filter(c => c.id !== cid) });
      };

      const addDriver = () => {
         const newD: Driver = { id: Date.now().toString(), driverProperty: 'rotation', sourceBoneId: bone.parentId || '', sourceProperty: 'rotation', factor: 0.5, offset: 0 };
         updateBone(bone.id, { drivers: [...(bone.drivers || []), newD] });
      };

      return (
        <div className="w-80 bg-neutral-900 border-l border-neutral-700 flex flex-col text-sm overflow-y-auto">
            {/* Tabs */}
            <div className="flex border-b border-neutral-700 bg-neutral-800">
                <button onClick={() => setActiveTab('TRANSFORM')} className={`flex-1 py-2 flex justify-center ${activeTab === 'TRANSFORM' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'}`} title="Transform"><Crosshair size={16} /></button>
                <button onClick={() => setActiveTab('CONSTRAINTS')} className={`flex-1 py-2 flex justify-center ${activeTab === 'CONSTRAINTS' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-500'}`} title="Constraints"><Anchor size={16} /></button>
                <button onClick={() => setActiveTab('DRIVERS')} className={`flex-1 py-2 flex justify-center ${activeTab === 'DRIVERS' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500'}`} title="Drivers"><Activity size={16} /></button>
            </div>
            
            <div className="p-4 space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Name</label>
                    <input type="text" value={bone.name} onChange={(e) => updateBone(bone.id, { name: e.target.value })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white outline-none" />
                </div>

                {activeTab === 'TRANSFORM' && (
                    <>
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Transform</label>
                            <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Rotation</span><input type="number" value={Math.round(bone.rotation)} onChange={(e) => updateBone(bone.id, { rotation: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                            <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Length</span><input type="number" value={Math.round(bone.length)} onChange={(e) => updateBone(bone.id, { length: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Attachments</label>
                            {!attachedSprite ? (
                                <button onClick={() => onAttachSprite(bone.id)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs font-bold">Attach Sprite</button>
                            ) : (
                                <div className="bg-neutral-800 rounded p-2 flex items-center gap-2"><img src={attachedSprite.imageUrl} className="w-8 h-8 object-contain" alt="icon" /><span className="truncate flex-1">{attachedSprite.name}</span></div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'CONSTRAINTS' && (
                    <div className="space-y-4">
                         <button onClick={() => addConstraint('LIMIT_ROTATION')} className="w-full py-1 bg-neutral-700 hover:bg-neutral-600 rounded flex justify-center items-center gap-2 text-xs"><Plus size={12}/> Add Limit Rotation</button>
                         {bone.constraints?.map(c => (
                             <div key={c.id} className="bg-neutral-800 p-2 rounded border border-neutral-700 space-y-2">
                                 <div className="flex justify-between items-center text-orange-400 text-xs font-bold">
                                     <span>{c.type}</span>
                                     <button onClick={() => removeConstraint(c.id)}><X size={12} /></button>
                                 </div>
                                 {c.type === 'LIMIT_ROTATION' && (
                                     <div className="grid grid-cols-2 gap-2">
                                         <div><span className="text-[10px] text-gray-500">Min</span><input type="number" value={c.min} onChange={(e) => { const nc = {...c, min: parseFloat(e.target.value)}; updateBone(bone.id, {constraints: bone.constraints.map(oc => oc.id === c.id ? nc : oc)}) }} className="w-full bg-black rounded px-1"/></div>
                                         <div><span className="text-[10px] text-gray-500">Max</span><input type="number" value={c.max} onChange={(e) => { const nc = {...c, max: parseFloat(e.target.value)}; updateBone(bone.id, {constraints: bone.constraints.map(oc => oc.id === c.id ? nc : oc)}) }} className="w-full bg-black rounded px-1"/></div>
                                     </div>
                                 )}
                             </div>
                         ))}
                    </div>
                )}

                {activeTab === 'DRIVERS' && (
                    <div className="space-y-4">
                         <button onClick={addDriver} className="w-full py-1 bg-neutral-700 hover:bg-neutral-600 rounded flex justify-center items-center gap-2 text-xs"><Plus size={12}/> Add Driver</button>
                         {bone.drivers?.map(d => (
                             <div key={d.id} className="bg-neutral-800 p-2 rounded border border-neutral-700 space-y-2">
                                 <div className="flex justify-between items-center text-purple-400 text-xs font-bold">
                                     <span>Driver</span>
                                     <button onClick={() => updateBone(bone.id, { drivers: bone.drivers.filter(od => od.id !== d.id) })}><X size={12} /></button>
                                 </div>
                                 <div className="text-[10px] text-gray-500">Target Property</div>
                                 <select value={d.driverProperty} onChange={(e) => { const nd = {...d, driverProperty: e.target.value as any}; updateBone(bone.id, {drivers: bone.drivers.map(od => od.id === d.id ? nd : od)}) }} className="w-full bg-black rounded p-1">
                                     <option value="rotation">Rotation</option>
                                     <option value="x">X Position</option>
                                     <option value="y">Y Position</option>
                                 </select>
                                 <div className="text-[10px] text-gray-500">Source Bone</div>
                                 <select value={d.sourceBoneId} onChange={(e) => { const nd = {...d, sourceBoneId: e.target.value}; updateBone(bone.id, {drivers: bone.drivers.map(od => od.id === d.id ? nd : od)}) }} className="w-full bg-black rounded p-1">
                                     {bones.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                 </select>
                                 <div className="grid grid-cols-2 gap-2">
                                     <div><span className="text-[10px]">Factor</span><input type="number" step="0.1" value={d.factor} onChange={(e) => { const nd = {...d, factor: parseFloat(e.target.value)}; updateBone(bone.id, {drivers: bone.drivers.map(od => od.id === d.id ? nd : od)}) }} className="w-full bg-black rounded px-1"/></div>
                                     <div><span className="text-[10px]">Offset</span><input type="number" value={d.offset} onChange={(e) => { const nd = {...d, offset: parseFloat(e.target.value)}; updateBone(bone.id, {drivers: bone.drivers.map(od => od.id === d.id ? nd : od)}) }} className="w-full bg-black rounded px-1"/></div>
                                 </div>
                             </div>
                         ))}
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- SPRITE PROPERTIES ---
  if (selection.type === 'SPRITE') {
      const sprite = sprites ? sprites.find(s => s.id === selection.id) : null;
      if (!sprite) return null;

      const addVariant = () => {
          const newVar = { name: `Var ${sprite.variants.length + 1}`, url: sprite.imageUrl };
          updateSprite(sprite.id, { variants: [...sprite.variants, newVar] });
      };

      const swapImage = (url: string) => {
          updateSprite(sprite.id, { imageUrl: url });
      };

      return (
         <div className="w-80 bg-neutral-900 border-l border-neutral-700 flex flex-col text-sm overflow-y-auto">
             <div className="bg-neutral-800 p-2 font-bold text-gray-300 flex items-center gap-2">
                <ImageIcon size={14} /> SPRITE PROPERTIES
            </div>
            <div className="p-4 space-y-6">
                <div className="flex justify-center bg-neutral-800 p-4 rounded border border-neutral-700"><img src={sprite.imageUrl} className="h-32 object-contain" alt="Preview" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-400 uppercase">Name</label><input type="text" value={sprite.name} onChange={(e) => updateSprite(sprite.id, { name: e.target.value })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white outline-none" /></div>
                
                <div className="space-y-3">
                     <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Clipping</label>
                     <select value={sprite.clipId || ''} onChange={(e) => updateSprite(sprite.id, { clipId: e.target.value || undefined })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white">
                         <option value="">None</option>
                         {sprites.filter(s => s.id !== sprite.id).map(s => <option key={s.id} value={s.id}>Clip to: {s.name}</option>)}
                     </select>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Variants / Swap</label>
                    <div className="grid grid-cols-3 gap-2">
                         <div onClick={() => addVariant()} className="border border-dashed border-gray-600 rounded flex items-center justify-center h-12 cursor-pointer hover:border-white text-gray-500"><Plus size={16}/></div>
                         {sprite.variants.map((v, i) => (
                             <div key={i} onClick={() => swapImage(v.url)} className={`border rounded h-12 overflow-hidden cursor-pointer relative ${sprite.imageUrl === v.url ? 'border-green-500' : 'border-gray-700'}`}>
                                 <img src={v.url} className="w-full h-full object-cover" />
                             </div>
                         ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase border-b border-neutral-700 block pb-1">Transform</label>
                    <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Offset X</span><input type="number" value={Math.round(sprite.offsetX)} onChange={(e) => updateSprite(sprite.id, { offsetX: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                    <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Offset Y</span><input type="number" value={Math.round(sprite.offsetY)} onChange={(e) => updateSprite(sprite.id, { offsetY: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                    
                    <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Rotation</span><input type="number" value={Math.round(sprite.rotation)} onChange={(e) => updateSprite(sprite.id, { rotation: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                    
                    <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Scale X</span><input type="number" step="0.1" value={sprite.scaleX} onChange={(e) => updateSprite(sprite.id, { scaleX: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                    <div className="grid grid-cols-2 gap-2 items-center"><span className="text-gray-500">Scale Y</span><input type="number" step="0.1" value={sprite.scaleY} onChange={(e) => updateSprite(sprite.id, { scaleY: parseFloat(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-right text-white" /></div>
                </div>

                <button onClick={onDelete} className="w-full py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded flex items-center justify-center gap-2"><Trash2 size={14} /> Delete Sprite</button>
            </div>
         </div>
      );
  }
  return null;
};
