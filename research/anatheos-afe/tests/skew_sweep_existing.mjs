/** Synthetic JS stress test against independently solved 2x2 Gram equations.
 * Protected original JS implementation is imported but never modified.
 */
import assert from 'node:assert/strict';
import {plane,pixelToLps,lpsToPixel} from '../../../demos/anatheos-local-v0.5/spatial-reference.mjs';
const angles=[0,Math.PI/9,Math.PI/4,1.41,2.73];
const dims=[[16,16],[64,128],[512,512],[1024,2048]];
const spacings=[[.25,.25],[1,1],[.2,2.5],[2.5,.2]];
const skew=[0,.00001,.00006,.00009];
const samps=[.05,.27,.51,.76,.98];
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
function solve(g,p){
 const d=p.map((x,k)=>x-g.p[k]);
 const a=g.r.map(x=>x*g.s[1]),b=g.c.map(x=>x*g.s[0]);
 const aa=dot(a,a),ab=dot(a,b),bb=dot(b,b),det=aa*bb-ab*ab;
 assert(det>0);
 return {i:(dot(d,a)*bb-dot(d,b)*ab)/det,j:(dot(d,b)*aa-dot(d,a)*ab)/det};
}
let count=0,all=[],maxCase=null,outOfField=0;
for(const theta of angles)for(const [rows,cols] of dims)
for(const spacing of spacings)for(const alpha of skew){
 const c=Math.cos(theta),s=Math.sin(theta);
 const frame={image_orientation_patient_LPS:[c,s,0,-s+alpha*c,c+alpha*s,0],
   image_position_patient_LPS_mm:[100,-200,300],pixel_spacing_row_col_mm:spacing};
 const g=plane(frame,rows,cols);
 for(const t of samps){
  const i=(cols-1)*t,j=(rows-1)*(1-t),p=pixelToLps(g,i,j);
  const js=lpsToPixel(g,p),ref=solve(g,p);
  const oracleErr=Math.max(Math.abs(i-ref.i),Math.abs(j-ref.j));
  assert(oracleErr<1e-7,'Independent inverse failed for forward sample');
  const diff=Math.max(Math.abs(js.i-ref.i),Math.abs(js.j-ref.j));
  if(!js.inField)outOfField++;
  if(!maxCase||diff>maxCase.error)maxCase={theta,rows,cols,spacing,alpha,i,j,error:diff};
  if(alpha===0)assert(diff<1e-8);
  all.push(diff);
 }
 count++;
}
all.sort((a,b)=>a-b);
assert.equal(count,320);assert.equal(all.length,1600);
const result={configurations:count,samples:all.length,maxErrorVoxel:all.at(-1),
 meanErrorVoxel:all.reduce((a,b)=>a+b,0)/all.length,p95ErrorVoxel:all[1519],
 maxCase,outOfField,comparison:'independent Gram 2x2; no AFE-derived oracle'};
assert(result.maxErrorVoxel>2,'Issue not reproduced in high-anisotropy 2048-column case');
console.log('AFE01C_JS_SKEW_SWEEP_PASS '+JSON.stringify(result));
