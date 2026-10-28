/**
 * ANATHEOS B7.1 — operator-reviewed 3D intensity region proposal.
 * The local DICOM and existing labels remain untouched until explicit acceptance.
 * Not automatic anatomical segmentation, tissue recognition or diagnosis.
 */
import {inspectVolumeGeometry} from './volumetric.js';
export const ASSISTED_LIMITS=Object.freeze({roiCells:1_000_000,selectedVoxels:90_000,evaluatedVoxels:1_000_000});
const check=(ok,error)=>{if(!ok)throw Error(error)};
/** Physically bounded six-connected flood fill on original scaled DICOM intensities. */
export function proposeConnected3D(series,{x,y,z,tolerance=70,radiusMm=15}={}){
 const geo=inspectVolumeGeometry(series),frames=series.items,w=geo.x,h=geo.y,d=geo.z,plane=w*h;
 const seed=[x,y,z].map(Number);
 check(seed.every((v,i)=>Number.isInteger(v)&&v>=0&&v<[w,h,d][i]),'Semilla fuera de la serie DICOM.');
 check(Number.isFinite(tolerance)&&tolerance>=0&&tolerance<=10000,'Tolerancia de intensidad fuera de límites.');
 check(Number.isFinite(radiusMm)&&radiusMm>=2&&radiusMm<=50,'Radio físico debe estar entre 2 y 50 mm.');
 const [dx,dy,dz]=[frames[0].spacing[1],frames[0].spacing[0],geo.stepMm];
 const ranges=[dx,dy,dz].map(v=>Math.ceil(radiusMm/v));
 const lo=seed.map((v,i)=>Math.max(0,v-ranges[i]));
 const hi=seed.map((v,i)=>Math.min([w-1,h-1,d-1][i],v+ranges[i]));
 const [nx,ny,nz]=lo.map((v,i)=>hi[i]-v+1),cells=nx*ny*nz;
 check(cells>0&&cells<=ASSISTED_LIMITS.roiCells,
  'La región de búsqueda supera '+ASSISTED_LIMITS.roiCells+' celdas; reducí el radio físico.');
 const roiPlane=nx*ny,visited=new Uint8Array(cells),queue=new Int32Array(cells);
 const get=(px,py,pz)=>{
  const frame=frames[pz],value=frame.values[py*w+px]*frame.slope+frame.intercept;
  check(Number.isFinite(value),'Intensidad DICOM no finita.');return value;
 };
 const seedIntensity=get(...seed),radiusSq=radiusMm*radiusMm;
 const offset=(ax,ay,az)=>((az-lo[2])*ny+(ay-lo[1]))*nx+(ax-lo[0]);
 let head=0,tail=1,count=0,minI=Infinity,maxI=-Infinity,touchesRadius=false,checked=0;
 const seedPos=offset(...seed);queue[0]=seedPos;visited[seedPos]=1;
 const picked=new Uint32Array(ASSISTED_LIMITS.selectedVoxels);
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 while(head<tail){
  const pos=queue[head++],rz=Math.floor(pos/roiPlane),rem=pos-rz*roiPlane,
   ry=Math.floor(rem/nx),rx=rem-ry*nx,px=rx+lo[0],py=ry+lo[1],pz=rz+lo[2];
  const mmSq=(px-seed[0])**2*dx*dx+(py-seed[1])**2*dy*dy+(pz-seed[2])**2*dz*dz;
  if(mmSq>radiusSq+1e-9)continue;
  checked++;
  check(checked<=ASSISTED_LIMITS.evaluatedVoxels,'Propuesta excesiva: reducí radio o tolerancia.');
  const value=get(px,py,pz);
  if(Math.abs(value-seedIntensity)>tolerance)continue;
  check(count<ASSISTED_LIMITS.selectedVoxels,
   'Propuesta excede '+ASSISTED_LIMITS.selectedVoxels+' vóxeles: reducí tolerancia o radio. No se aplicó nada.');
  picked[count++]=pz*plane+py*w+px;minI=Math.min(minI,value);maxI=Math.max(maxI,value);
  if(mmSq>=(radiusMm-Math.max(dx,dy,dz))**2)touchesRadius=true;
  for(const [ax,ay,az] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
   const xx=px+ax,yy=py+ay,zz=pz+az;
   if(xx<lo[0]||xx>hi[0]||yy<lo[1]||yy>hi[1]||zz<lo[2]||zz>hi[2])continue;
   const next=offset(xx,yy,zz);if(visited[next])continue;visited[next]=1;queue[tail++]=next;
  }
 }
 check(count>0,'La semilla no produjo vóxeles.');
 for(let i=0;i<count;i++){
  const index=picked[i],pz=Math.floor(index/plane),py=Math.floor(index/w)%h,px=index%w;
  [px,py,pz].forEach((v,k)=>{bounds.min[k]=Math.min(bounds.min[k],v);bounds.max[k]=Math.max(bounds.max[k],v);});
 }
 return Object.freeze({indices:picked.slice(0,count),shape:[w,h,d],seed:{x,y,z},count,checked,seedIntensity,
  intensityMin:minI,intensityMax:maxI,bounds,physicalRadiusMm:radiusMm,tolerance,
  touchesRadius,roiCells:cells,method:'6-connected-3d-intensity-proposal',geometry:'DICOM same-study voxels'});
}
/** Atomic commit, without ever overwriting a different existing label. */
export function acceptConnected3D(mask,proposal,label,{overwrite=false}={}){
 check(mask?.data instanceof Uint8Array&&Number.isInteger(mask.x)&&Number.isInteger(mask.y)&&Number.isInteger(mask.z),
  'Máscara inválida.');
 check(Number.isInteger(label)&&label>=1&&label<=3,'Etiqueta seleccionada inválida.');
 check(proposal?.method==='6-connected-3d-intensity-proposal'&&proposal.indices instanceof Uint32Array&&
  proposal.indices.length>0&&proposal.indices.length===proposal.count,'Propuesta inválida.');
 check(!overwrite,'No se permite sobrescribir otras etiquetas en B7.1.');
 check(Array.isArray(proposal.shape)&&proposal.shape.every((v,i)=>v===[mask.x,mask.y,mask.z][i]),
  'Propuesta de otra cuadrícula DICOM: rechazada.');
 const seen=new Set(),plan=[];let skipped=0;
 for(const index of proposal.indices){
  check(index<mask.data.length&&!seen.has(index),'Propuesta truncada, duplicada o incompatible.');
  seen.add(index);
  if(mask.data[index]&&mask.data[index]!==label){skipped++;continue;}
  if(mask.data[index]!==label)plan.push(index);
 }
 for(const index of plan)mask.data[index]=label;
 return {added:plan.length,unchanged:proposal.count-plan.length-skipped,skipped,selected:proposal.count,label};
}
