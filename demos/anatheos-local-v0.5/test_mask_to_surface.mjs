import test from 'node:test';
import assert from 'node:assert/strict';
import {createMask} from './segmentation.mjs';
import {makeMaskSurfaceSTLs,MASK_SURFACE_COORDINATES} from './mask-to-surface.mjs';
import {parseSTL} from './surface-core.mjs';
const study=(w=3,h=3,d=3,iop=[1,0,0,0,1,0],spacing=[2,3],step=4)=>({
 spacingBetween:step,
 items:Array.from({length:d},(_,z)=>({columns:w,rows:h,iop:[...iop],ipp:[10,20,30+z*step],spacing:[...spacing]}))
});
const set=(m,x,y,z,label=1)=>{m.data[(z*m.y+y)*m.x+x]=label;};
test('single explicitly marked voxel generates closed 12-triangle STL with TRUE LPS-mm extents',()=>{
 const m=createMask(3,3,3);set(m,1,1,1);
 const result=makeMaskSurfaceSTLs(m,study());
 assert.equal(result.length,1);
 const mesh=result[0];assert.equal(mesh.coordinateSystem,MASK_SURFACE_COORDINATES);
 assert.equal(mesh.triangles,12);assert.equal(mesh.exposedFaces,6);assert.equal(mesh.voxels,1);
 assert.deepEqual(mesh.bounds.min,[11.5,21,32]);assert.deepEqual(mesh.bounds.max,[14.5,23,36]);
 const parsed=parseSTL(mesh.buffer);
 assert.equal(parsed.triangles,12);assert.equal(parsed.nonDegenerate,12);
 assert.deepEqual(parsed.bounds,mesh.bounds);
 const v=new DataView(mesh.buffer);
 let area=0,orientation=0;
 for(let t=0;t<12;t++){
  const base=84+t*50,n=[0,1,2].map(i=>v.getFloat32(base+i*4,true));
  const points=[0,1,2].map(k=>[0,1,2].map(i=>v.getFloat32(base+12+k*12+i*4,true)));
  const a=points[0],b=points[1],c=points[2];
  const p=b.map((v,i)=>v-a[i]),q=c.map((v,i)=>v-a[i]);
  const cross=[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
  const norm=Math.hypot(...cross);area+=norm/2;
  assert(Math.abs(n.reduce((sum,v,i)=>sum+v*cross[i],0)-norm)<1e-6);
  const center=a.map((v,i)=>(a[i]+b[i]+c[i])/3);
  const boxCenter=[13,22,34];
  assert(n.reduce((sum,v,i)=>sum+v*(center[i]-boxCenter[i]),0)>0,'Triangle must face outward');
  orientation++;
 }
 assert.equal(orientation,12);
 assert.equal(area,52);
});
test('adjacent voxels remove internal faces; distinct labels preserve separate interfaces',()=>{
 const series=study(),m=createMask(3,3,3);
 set(m,1,1,1);set(m,2,1,1);
 assert.equal(makeMaskSurfaceSTLs(m,series)[0].triangles,20);
 set(m,2,1,1,2);
 const meshes=makeMaskSurfaceSTLs(m,series);
 assert.deepEqual(meshes.map(x=>[x.label,x.triangles,x.voxels]),[[1,12,1],[2,12,1]]);
});
test('oblique IOP maps through physical LPS axes; no silent RAS swap',()=>{
 const series=study(3,3,3,[0,1,0,-1,0,0]),m=createMask(3,3,3);
 set(m,1,1,1);
 const mesh=makeMaskSurfaceSTLs(m,series)[0],parsed=parseSTL(mesh.buffer);
 assert.deepEqual(parsed.bounds.min,[7,21.5,32]);
 assert.deepEqual(parsed.bounds.max,[9,24.5,36]);
});
test('reject empty, wrong series, invalid labels and irregular physical geometry',()=>{
 const mask=createMask(3,3,3);
 assert.throws(()=>makeMaskSurfaceSTLs(mask,study()),/No hay regiones/);
 set(mask,1,1,1,4);
 assert.throws(()=>makeMaskSurfaceSTLs(mask,study()),/Etiqueta/);
 set(mask,1,1,1,1);
 assert.throws(()=>makeMaskSurfaceSTLs(mask,study(4,3,3)),/otro estudio/);
 const malformed=study();malformed.items[2].ipp[2]=88;
 assert.throws(()=>makeMaskSurfaceSTLs(mask,malformed),/irregulares/);
 const tilted=study();tilted.items[2].ipp[0]+=3;
 assert.throws(()=>makeMaskSurfaceSTLs(mask,tilted),/desplazamiento/);
});
test('high-frequency checkerboard rejected safely instead of decimating silently',()=>{
 const m=createMask(70,70,50);
 for(let z=0;z<50;z++)for(let y=0;y<70;y++)for(let x=0;x<70;x++)
  if((x+y+z)%2===0)set(m,x,y,z,1);
 assert.throws(()=>makeMaskSurfaceSTLs(m,study(70,70,50)),/límite de escena/);
});