/**
 * ANATHEOS B6.2 — continuous isosurfaces ONLY from actual DICOM-aligned labels.
 * Marching tetrahedra on a bounded ROI, not anatomical AI or an MR threshold.
 * Physical output: binary STL in DICOM patient LPS millimetres.
 * No external network, GPU library or third-party license.
 * A continuous surface is interpolation, NOT additional acquired resolution.
 */
import {inspectVolumeGeometry} from './volumetric.js';
import {MAX_TRIANGLES_PER_MESH,MAX_SCENE_TRIANGLES,MAX_MESH_BYTES} from './surface-core.mjs';

const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const TETS=[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]];
export const B62_MAX_ROI_CELLS=800_000;
export const B62_COORDINATES='LPS mm';
export const B62_ISOVALUE=0.5;
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
function physical(mask,series){
 ensure(mask?.data instanceof Uint8Array&&Number.isInteger(mask.x)&&Number.isInteger(mask.y)&&Number.isInteger(mask.z)&&mask.z>1&&
  mask.data.length===mask.x*mask.y*mask.z,'Máscara inválida o truncada');
 const geo=inspectVolumeGeometry(series);
 ensure(geo.x===mask.x&&geo.y===mask.y&&geo.z===mask.z,'Máscara y estudio DICOM no coinciden');
 const first=series.items[0];
 const basis=[first.iop.slice(0,3).map(n=>n*first.spacing[1]),
  first.iop.slice(3,6).map(n=>n*first.spacing[0]),geo.normal.map(n=>n*geo.stepMm)];
 const origin=geo.originLps;
 ensure([...origin,...basis.flat()].every(n=>Number.isFinite(n)&&Math.abs(n)<1e8),'Geometría física fuera de rango');
 const handed=dot(cross(basis[0],basis[1]),basis[2]);
 ensure(handed>1e-8,'Orientación DICOM LPS degenerada o invertida');
 return {origin,basis,geo};
}
const world=(grid,g)=>g.origin.map((v,k)=>v+g.basis[0][k]*grid[0]+g.basis[1][k]*grid[1]+g.basis[2][k]*grid[2]);

function limits(mask){
 const boxes=Array.from({length:4},()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],voxels:0}));
 const {x:w,y:h,z:d}=mask;let index=0;
 for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++,index++){
  const label=mask.data[index];ensure(label<=3,'Etiqueta fuera de rango 1–3');
  if(label===0)continue;
  const b=boxes[label];b.voxels++;
  for(let k=0;k<3;k++){const v=[x,y,z][k];b.min[k]=Math.min(b.min[k],v);b.max[k]=Math.max(b.max[k],v);}
 }
 return boxes;
}
function fieldForLabel(mask,label,box,soften){
 const start=box.min.map(n=>n-1),end=box.max.map(n=>n+1);
 const [nx,ny,nz]=end.map((v,i)=>v-start[i]+1);
 const cells=(nx-1)*(ny-1)*(nz-1);
 ensure(cells>0&&cells<=B62_MAX_ROI_CELLS,
  'Región excede límite de procesamiento continuo ('+B62_MAX_ROI_CELLS+' celdas). Ajustá región o usá Superficie de vóxeles B6.1.');
 const scalar=new Float32Array(nx*ny*nz),w=mask.x,h=mask.y,d=mask.z,plane=w*h;
 const at=(x,y,z)=>(z*ny+y)*nx+x;
 const inside=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<w&&y<h&&z<d&&mask.data[z*plane+y*w+x]===label;
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const gx=start[0]+x,gy=start[1]+y,gz=start[2]+z,self=inside(gx,gy,gz)?1:0;
  if(soften===0){scalar[at(x,y,z)]=self;continue;}
  const adjacent=(inside(gx-1,gy,gz)?1:0)+(inside(gx+1,gy,gz)?1:0)+
   (inside(gx,gy-1,gz)?1:0)+(inside(gx,gy+1,gz)?1:0)+
   (inside(gx,gy,gz-1)?1:0)+(inside(gx,gy,gz+1)?1:0);
  // Conservative 6-neighbor smoothing: occupied centers remain > iso,
  // empty centers remain < iso, even for single-voxel structures.
  scalar[at(x,y,z)]=(1-soften)*self+soften*adjacent/6;
 }
 return {scalar,start,nx,ny,nz,at,cells};
}
function interpolate(a,b,va,vb){
 const d=vb-va;
 const t=Math.abs(d)>1e-9?Math.max(0,Math.min(1,(B62_ISOVALUE-va)/d)):.5;
 return a.map((x,i)=>x+(b[i]-x)*t);
}
function triangulateTetra(points,values,write){
 const inside=[],outside=[];
 for(let i=0;i<4;i++)(values[i]>=B62_ISOVALUE?inside:outside).push(i);
 if(!inside.length||!outside.length)return;
 const insideCenter=[0,1,2].map(k=>inside.reduce((sum,i)=>sum+points[i][k],0)/inside.length);
 const outsideCenter=[0,1,2].map(k=>outside.reduce((sum,i)=>sum+points[i][k],0)/outside.length);
 const direction=sub(outsideCenter,insideCenter);
 const edge=(i,j)=>interpolate(points[i],points[j],values[i],values[j]);
 if(inside.length===1){
  write([edge(inside[0],outside[0]),edge(inside[0],outside[1]),edge(inside[0],outside[2])],direction);
 }else if(outside.length===1){
  write([edge(outside[0],inside[0]),edge(outside[0],inside[1]),edge(outside[0],inside[2])],direction);
 }else{
  const [a,b]=inside,[c,d]=outside;
  const p=[edge(a,c),edge(a,d),edge(b,d),edge(b,c)];
  write([p[0],p[1],p[2]],direction);
  write([p[0],p[2],p[3]],direction);
 }
}
export function makeContinuousMaskSTLs(mask,series,{soften=0.15}={}){
 ensure(Number.isFinite(soften)&&soften>=0&&soften<=0.30,'Suavizado solo entre 0 y 0,30');
 const g=physical(mask,series),boxes=limits(mask),results=[];
 if(!boxes.some((b,i)=>i&&b.voxels>0))throw Error('No hay regiones marcadas para reconstruir');
 let sceneTriangles=0;
 for(let label=1;label<=3;label++){
  const box=boxes[label];if(!box.voxels)continue;
  const field=fieldForLabel(mask,label,box,soften);
  const {nx,ny,nz,scalar,start,at}=field;
  // Reserve at most the established 40 MiB/450k-triangle STL budget;
  // not allocating the entire study or unbounded triangle arrays.
  const maxTris=Math.min(MAX_TRIANGLES_PER_MESH,Math.floor((MAX_MESH_BYTES-84)/50),MAX_SCENE_TRIANGLES-sceneTriangles);
  ensure(maxTris>0,'Límite conjunto de escena alcanzado');
  const buffer=new ArrayBuffer(84+maxTris*50),view=new DataView(buffer);
  const title=new TextEncoder().encode('ANATHEOS B6.2 MANUAL DICOM ROI, CONTINUOUS LPS mm, UNVALIDATED');
  new Uint8Array(buffer).set(title.subarray(0,80));
  let written=84,triangles=0;
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  function writeTriangle(gridPoints,direction){
   // Physical orientation works also for oblique LPS. Normals point
   // from occupied label voxels toward background, not into the ROI.
   let p=gridPoints.map(pt=>world(pt,g));
   let ab=sub(p[1],p[0]),ac=sub(p[2],p[0]),n=cross(ab,ac),mag=Math.hypot(...n);
   if(mag<=1e-10)return;
   const positive=world(direction,g);
   const physicalVector=sub(positive,g.origin);
   if(dot(n,physicalVector)<0){[p[1],p[2]]=[p[2],p[1]];n=n.map(v=>-v);}
   ensure(triangles<maxTris,'Superficie demasiado compleja: máximo '+maxTris+' triángulos. Ajustá la máscara o elegí modo vóxeles B6.1.');
   for(let k=0;k<3;k++)view.setFloat32(written+k*4,n[k]/mag,true);
   let o=written+12;
   for(const pt of p)for(let k=0;k<3;k++){
    const value=pt[k];
    ensure(Number.isFinite(value)&&Math.abs(value)<1e8,'Vértice físico no válido');
    view.setFloat32(o,value,true);o+=4;
    bounds.min[k]=Math.min(bounds.min[k],value);
    bounds.max[k]=Math.max(bounds.max[k],value);
   }
   view.setUint16(o,0,true);written+=50;triangles++;
  }
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
   const values=CORNERS.map(([dx,dy,dz])=>scalar[at(x+dx,y+dy,z+dz)]);
   const low=Math.min(...values),high=Math.max(...values);
   if(low>=B62_ISOVALUE||high<B62_ISOVALUE)continue;
   const corners=CORNERS.map(([dx,dy,dz])=>[start[0]+x+dx,start[1]+y+dy,start[2]+z+dz]);
   for(const tet of TETS){
    const tv=tet.map(k=>values[k]);
    if(tv.every(v=>v>=B62_ISOVALUE)||tv.every(v=>v<B62_ISOVALUE))continue;
    triangulateTetra(tet.map(k=>corners[k]),tv,writeTriangle);
   }
  }
  ensure(triangles>0,'La máscara no produce superficie continua no degenerada');
  sceneTriangles+=triangles;
  view.setUint32(80,triangles,true);
  results.push({label,name:'Región '+label+' · continua · MISMA RM · SIN validar',
   buffer:buffer.slice(0,written),triangles,voxels:box.voxels,bounds,
   coordinateSystem:B62_COORDINATES,derivedFrom:'current-study-manual-labelmap',
   surfaceMethod:'marching-tetrahedra',soften,roiCells:field.cells});
 }
 return results;
}
