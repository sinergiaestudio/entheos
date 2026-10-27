import assert from 'node:assert/strict';
import { inspectVolumeGeometry, prepareVolumeTexture } from './volumetric.js';
const build=(d=1,tilt=0)=>({spacingBetween:d,items:[0,1,2].map(z=>({
 iop:[1,0,0,0,1,0],ipp:[tilt*z,0,30+z*d],spacing:[2,3],rows:3,columns:4,
 values:Int32Array.from(Array.from({length:12},(_,i)=>z*100+i)),slope:1,intercept:-50,
}))});
const series=build();
const geo=inspectVolumeGeometry(series);
assert.deepEqual([geo.x,geo.y,geo.z],[4,3,3]);
assert.deepEqual(geo.spanMm,[12,6,2]);
assert.deepEqual(geo.normal,[0,0,1]);
assert.deepEqual(geo.originLps,[0,0,30]);
const p=await prepareVolumeTexture(series);
assert.equal(p.output.length,36);assert.equal(p.rawRange[0],-50);assert.equal(p.rawRange[1],157);
assert.equal(p.output[0],0);assert.equal(p.output[35],255);
await assert.rejects(()=>prepareVolumeTexture(series,()=>{},()=>true),/cancelada/);
assert.throws(()=>inspectVolumeGeometry(build(1,.5)),/desplazamiento lateral/);
const invalid=build();invalid.items[2].ipp[2]=35;
assert.throws(()=>inspectVolumeGeometry(invalid),/Posiciones irregulares/);
const invalid2=build();invalid2.items[1].iop[0]=.9;
assert.throws(()=>inspectVolumeGeometry(invalid2),/Orientation/);
console.log('PASS: DICOM geometric gate, physical voxel span, raw-to-R8 stack mapping, abort and rejection');
