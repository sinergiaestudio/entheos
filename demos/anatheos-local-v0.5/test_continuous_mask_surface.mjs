import test from 'node:test';
import assert from 'node:assert/strict';
import {createMask} from './segmentation.mjs';
import {makeContinuousMaskSTLs,B62_MAX_ROI_CELLS} from './continuous-mask-surface.mjs';
import {makeMaskSurfaceSTLs} from './mask-to-surface.mjs';
import {parseSTL} from './surface-core.mjs';
const study=(w=9,h=9,d=9,{spacing=[1,1],step=1,iop=[1,0,0,0,1,0]}={})=>({
 spacingBetween:step,items:Array.from({length:d},(_,z)=>({columns:w,rows:h,iop:[...iop],ipp:[10,20,30+z*step],spacing:[...spacing]}))
});
const mark=(m,x,y,z,label=1)=>{m.data[(z*m.y+y)*m.x+x]=label};
const key=v=>v.map(n=>n.toFixed(5)).join(',');
test('B6.2 single marked voxel: real continuous CLOSED LPS geometry, outward normal',()=>{
 const m=createMask(5,5,5);mark(m,2,2,2);
 const surfaces=makeContinuousMaskSTLs(m,study(5,5,5),{soften:0});
 assert.equal(surfaces.length,1);
 const a=surfaces[0],parsed=parseSTL(a.buffer);
 assert.equal(a.coordinateSystem,'LPS mm');
 assert.equal(a.surfaceMethod,'marching-tetrahedra');
 assert.equal(a.voxels,1);
 assert.equal(a.triangles,parsed.triangles);
 assert.equal(parsed.nonDegenerate,a.triangles);
 assert(a.triangles>12 && a.triangles<120,'Tetrahedral iso triangle count bounded');
 assert.deepEqual(a.bounds.min,[11.5,21.5,31.5]);
 assert.deepEqual(a.bounds.max,[12.5,22.5,32.5]);
 const dv=new DataView(a.buffer);
 const edges=new Map();
 let oriented=0;
 for(let t=0;t<a.triangles;t++){
  const o=84+50*t,normal=[0,1,2].map(i=>dv.getFloat32(o+i*4,true));
  const p=[0,1,2].map(j=>[0,1,2].map(i=>dv.getFloat32(o+12+j*12+i*4,true)));
  const mid=[0,1,2].map(i=>(p[0][i]+p[1][i]+p[2][i])/3),center=[12,22,32];
  assert(normal.reduce((s,n,i)=>s+n*(mid[i]-center[i]),0)>0,'outward LPS normal');
  const ids=p.map(key);
  for(const [i,j] of [[0,1],[1,2],[2,0]]){
   const k=[ids[i],ids[j]].sort().join('/');
   edges.set(k,(edges.get(k)||0)+1);
  }
  oriented++;
 }
 assert(edges.size>0);
 assert([...edges.values()].every(v=>v===2),'No open seam: each unique edge shared by two triangles');
 assert.equal(oriented,a.triangles);
});
test('B6.2 anisotropic spacing preserves physical mm, nonuniform image axes',()=>{
 const m=createMask(5,5,5);mark(m,2,2,2);
 const a=makeContinuousMaskSTLs(m,study(5,5,5,{spacing:[2,3],step:4}),{soften:0})[0];
 assert.deepEqual(a.bounds.min,[14.5,23,36]);
 assert.deepEqual(a.bounds.max,[17.5,25,40]);
});
test('B6.2 same-mask label count and physical extents: smoothing is bounded, never invents tissue labels',()=>{
 const m=createMask(9,9,9);
 for(let z=2;z<=6;z++)for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)mark(m,x,y,z,1);
 const series=study();
 const raw=makeContinuousMaskSTLs(m,series,{soften:0})[0];
 const smooth=makeContinuousMaskSTLs(m,series,{soften:.25})[0];
 const vox=makeMaskSurfaceSTLs(m,series)[0];
 assert.equal(raw.voxels,125);
 assert.equal(smooth.voxels,125);
 assert.equal(vox.voxels,125);
 assert(raw.triangles>0&&smooth.triangles>0);
 for(let i=0;i<3;i++){
  assert(Math.abs(smooth.bounds.min[i]-raw.bounds.min[i])<=.45);
  assert(Math.abs(smooth.bounds.max[i]-raw.bounds.max[i])<=.45);
 }
 assert.equal(parseSTL(smooth.buffer).nonDegenerate,smooth.triangles);
 assert(raw.triangles>vox.triangles,'Continuous interpolated mesh typically has more facets');
 assert(m.data[(4*m.y+4)*m.x+4]===1,'No mutation of segmentation');
});
test('B6.2 multiple labels stay separate (no SPL/Leeds mixing)',()=>{
 const m=createMask(9,9,9);
 mark(m,2,2,2,1);mark(m,6,6,6,2);
 const out=makeContinuousMaskSTLs(m,study());
 assert.deepEqual(out.map(x=>x.label),[1,2]);
 assert(out.every(x=>x.derivedFrom==='current-study-manual-labelmap'));
});
test('B6.2 strict geometry & data bounds, no quiet fill or inference',()=>{
 const m=createMask(5,5,5),good=study(5,5,5);
 assert.throws(()=>makeContinuousMaskSTLs(m,good),/No hay regiones/);
 mark(m,2,2,2,4);
 assert.throws(()=>makeContinuousMaskSTLs(m,good),/Etiqueta/);
 mark(m,2,2,2,1);
 assert.throws(()=>makeContinuousMaskSTLs(m,study(6,5,5)),/no coinciden/);
 assert.throws(()=>makeContinuousMaskSTLs(m,good,{soften:1}),/Suavizado/);
 assert.throws(()=>makeContinuousMaskSTLs(m,good,{soften:NaN}),/Suavizado/);
 const bad=study(5,5,5);bad.items[4].ipp[2]=200;
 assert.throws(()=>makeContinuousMaskSTLs(m,bad),/irregulares|incompatib|posición/);
});
test('B6.2 spatially large ROI fails with actionable error, not large allocation',()=>{
 const m=createMask(100,100,90);mark(m,0,0,0);mark(m,99,99,89);
 assert.throws(()=>makeContinuousMaskSTLs(m,study(100,100,90)),new RegExp(String(B62_MAX_ROI_CELLS)));
});
