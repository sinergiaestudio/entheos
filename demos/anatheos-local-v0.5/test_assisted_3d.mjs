import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeConnected3D,acceptConnected3D,ASSISTED_LIMITS} from './assisted-segmentation-3d.mjs';
import {createMask} from './segmentation.mjs';
const study=(n=15,spacing=[1,1],step=2)=>({spacingBetween:step,
 items:Array.from({length:n},(_,z)=>({columns:n,rows:n,iop:[1,0,0,0,1,0],ipp:[0,0,z*step],spacing,values:Int32Array.from({length:n*n},(_,index)=>{
  const x=index%n,y=Math.floor(index/n),d2=(x-7)**2+(y-7)**2+((z-7)*step)**2;
  return d2<=25?1200:100;
 }),slope:1,intercept:0}))});
const at=(m,x,y,z)=>m.data[(z*m.y+y)*m.x+x];
test('3D bounded connected seed proposal remains a draft until explicit acceptance',()=>{
 const s=study(),m=createMask(15,15,15);
 const p=proposeConnected3D(s,{x:7,y:7,z:7,tolerance:25,radiusMm:8});
 assert(p.count>30&&p.count<500);assert.equal(p.count,p.indices.length);
 assert.equal(p.method,'6-connected-3d-intensity-proposal');assert.equal(at(m,7,7,7),0);
 assert.equal(p.seedIntensity,1200);assert.equal(p.intensityMin,1200);
 assert.deepEqual(p.shape,[15,15,15]);
 const accepted=acceptConnected3D(m,p,1);
 assert.equal(accepted.added,p.count);assert.equal(at(m,7,7,7),1);assert.equal(at(m,0,0,0),0);
 assert.equal(acceptConnected3D(m,p,1).added,0);
});
test('ROI respects physical anisotropic spacing, not slice indices',()=>{
 const s=study(15,[.5,.5],4),p=proposeConnected3D(s,{x:7,y:7,z:7,tolerance:0,radiusMm:4});
 assert(p.bounds.min[2]>=6&&p.bounds.max[2]<=8);assert(p.count>0&&p.count<250);
});
test('Disconnected DICOM intensity island is not selected as anatomy',()=>{
 const s=study();s.items[7].values[1*15+1]=1200;
 const p=proposeConnected3D(s,{x:7,y:7,z:7,tolerance:20,radiusMm:15});
 assert(!p.indices.includes((7*15+1)*15+1));
});
test('Reviewed proposal cannot overwrite other anatomical labels or mutate on error',()=>{
 const s=study(),m=createMask(15,15,15),p=proposeConnected3D(s,{x:7,y:7,z:7,tolerance:100,radiusMm:7});
 const victim=p.indices[0];m.data[victim]=2;
 const report=acceptConnected3D(m,p,1);assert.equal(m.data[victim],2);assert.equal(report.skipped,1);
 const wrong=createMask(5,5,135),before=wrong.data.slice();
 assert.throws(()=>acceptConnected3D(wrong,p,1),/otra cuadrícula/);assert.deepEqual(wrong.data,before);
 const duplicated={...p,indices:Uint32Array.of(p.indices[0],p.indices[0]),count:2};
 assert.throws(()=>acceptConnected3D(m,duplicated,1),/duplicada/);
 assert.throws(()=>acceptConnected3D(m,p,1,{overwrite:true}),/sobrescribir/);
});
test('Physical radius and complexity fail closed; no partial results',()=>{
 const s=study(130,[.1,.1],.1);for(const f of s.items)f.values.fill(100);
 assert.throws(()=>proposeConnected3D(s,{x:65,y:65,z:65,radiusMm:50,tolerance:1}),/supera/);
 assert.throws(()=>proposeConnected3D(study(),{x:7,y:7,z:7,radiusMm:70}),/entre 2 y 50/);
 assert.throws(()=>proposeConnected3D(study(),{x:7,y:7,z:7,tolerance:-1}),/Tolerancia/);
 assert.equal(ASSISTED_LIMITS.selectedVoxels,90_000);
});
