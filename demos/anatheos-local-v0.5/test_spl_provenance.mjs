import test from 'node:test';
import assert from 'node:assert/strict';
import {SPL_ATLAS_COMMIT,SPL_MASK_SHA256,SPL_MESH_MANIFEST,verifyOriginalSPLMesh} from './spl-provenance.mjs';
test('Original SPL bone manifest is pinned and scientifically explicit',()=>{
 assert.equal(SPL_ATLAS_COMMIT,'a033300264aec8625a56512be3865c10cdbcb61b');
 assert.equal(SPL_MASK_SHA256,'3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d');
 const femur=SPL_MESH_MANIFEST['femur-95.stl'],tibia=SPL_MESH_MANIFEST['tibia-96.stl'];
 assert.equal(femur.label,95);assert.equal(tibia.label,96);
 assert.equal(femur.triangles+tibia.triangles,595840);
 assert.equal(femur.bytes,16447884);assert.equal(tibia.bytes,13344284);
 assert(femur.bboxErrorMm<0.71&&tibia.bboxErrorMm<0.71);
 assert.equal(femur.preferredFrame,'RAS');assert.equal(tibia.preferredFrame,'RAS');
});
test('Misleading names, wrong byte sizes, and fabricated atlas content are never verified',async()=>{
 const bogus=new ArrayBuffer(84+50*2);
 assert.equal(await verifyOriginalSPLMesh('femur-95.stl',bogus,2),null);
 assert.equal(await verifyOriginalSPLMesh('tibia-96.stl',bogus,2),null);
 assert.equal(await verifyOriginalSPLMesh('femur-95.stl',bogus,328956),null);
 assert.equal(await verifyOriginalSPLMesh('femur-stolen.stl',bogus,2),null);
});
