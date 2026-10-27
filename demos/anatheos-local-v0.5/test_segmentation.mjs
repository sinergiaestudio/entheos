import test from 'node:test';
import assert from 'node:assert/strict';
import {createMask,paintDisk,growRegion2D,eraseRegion,countRegions,toNrrd,fromNrrd,labelAt} from './segmentation.mjs';
const fake={items:[0,1,2].map(i=>({columns:8,rows:9,iop:[1,0,0,0,1,0],ipp:[12,22,32+i*0.7],spacing:[0.4,0.4]})),spacingBetween:0.7};
test('paint 2D three region masks without changing source voxels',()=>{
 const m=createMask(8,9,3);assert.equal(paintDisk(m,3,4,1,2,1),13);assert.equal(labelAt(m,3,4,1),1);
 assert.equal(labelAt(m,3,4,0),0);paintDisk(m,3,4,1,1,2);assert.equal(labelAt(m,3,4,1),2);
 assert.ok(eraseRegion(m,1)>0);assert.equal(countRegions(m)[1],0);
});
test('LPS NRRD exports exact shape, spacing and region labels; exact roundtrip',()=>{
 const m=createMask(8,9,3);paintDisk(m,5,4,1,2,3);
 const serialized=toNrrd(m,fake),header=new TextDecoder().decode(serialized.slice(0,800));
 assert.match(header,/space: left-posterior-superior/);
 assert.match(header,/sizes: 8 9 3/);
 assert.match(header,/space origin: \(12,22,32\)/);
 const recovered=createMask(8,9,3);
 assert.equal(fromNrrd(serialized.buffer,recovered,fake)[3],countRegions(m)[3]);
 assert.deepEqual(recovered.data,m.data);
});
test('fail closed on other image geometries, invalid labels and bad dimensions',()=>{
 const m=createMask(8,9,3), bytes=toNrrd(m,fake);
 assert.throws(()=>fromNrrd(bytes.buffer,createMask(7,9,3),fake));
 const other={...fake,items:fake.items.map(x=>({...x,ipp:[22,22,32]}))};
 assert.throws(()=>fromNrrd(bytes.buffer,createMask(8,9,3),other),/Geometría/);
 const corrupted=Uint8Array.from(bytes);corrupted[corrupted.length-1]=25;
 assert.throws(()=>fromNrrd(corrupted.buffer,createMask(8,9,3),fake),/fuera de rango/);
 assert.throws(()=>createMask(0,4,5));
});

test('bounded seed-based 2D growing never classifies or modifies neighbouring slices',()=>{
 const m=createMask(8,9,3); const values=new Int32Array(8*9).fill(100);
 for(let row=2;row<=5;row++)for(let col=2;col<=5;col++)values[row*8+col]=420;
 const f={rows:9,columns:8,values,slope:1,intercept:0};
 const filled=growRegion2D(m,f,3,3,1,2,5,6,100);
 assert.equal(filled,16);assert.equal(countRegions(m)[2],16);
 assert.equal(labelAt(m,3,3,0),0);assert.equal(labelAt(m,3,3,2),0);
 assert.equal(labelAt(m,0,0,1),0);
 assert.throws(()=>growRegion2D(m,f,2,2,1,2,-1));
});
