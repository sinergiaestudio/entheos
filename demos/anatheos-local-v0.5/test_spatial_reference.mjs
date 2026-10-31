import assert from 'node:assert/strict';
import {plane,pixelToLps,lpsToPixel,intersection,eligibility} from './spatial-reference.mjs';
const frame=(z=0)=>({image_orientation_patient_LPS:[1,0,0,0,1,0],image_position_patient_LPS_mm:[0,0,z],pixel_spacing_row_col_mm:[2,3]});
const a=plane(frame(),20,30);assert.deepEqual(pixelToLps(a,4,5),[12,10,0]);assert.deepEqual(lpsToPixel(a,[12,10,0]),{i:4,j:5,distance:0,status:'EN PLANO'});
assert.equal(lpsToPixel(a,[-1,0,0]).status,'FUERA DE CAMPO');assert.equal(lpsToPixel(a,[0,0,3]).distance,3);
assert.deepEqual(intersection(a,plane(frame(3),20,30)),[]);
const b=plane({...frame(),image_orientation_patient_LPS:[0,1,0,0,0,1],image_position_patient_LPS_mm:[12,0,0]},20,30);
assert.equal(intersection(a,b).length,2);
assert.deepEqual(intersection(a,plane({...frame(),image_orientation_patient_LPS:[0,1,0,0,0,1],image_position_patient_LPS_mm:[12,1000,0]},20,30)),[]);
assert.throws(()=>plane({...frame(),pixel_spacing_row_col_mm:[0,1]},20,30));
const repeated=eligibility([frame(),frame(),frame(2)],20,30);assert(repeated.groups[0].reasons.some(x=>x.includes('repetidas')));assert.equal(repeated.groups[0].volumeEligible,false);
for(const angle of [.3,1.1,Math.PI]){const f={...frame(),image_orientation_patient_LPS:[Math.cos(angle),Math.sin(angle),0,-Math.sin(angle),Math.cos(angle),0]};const g=plane(f,20,30),p=lpsToPixel(g,pixelToLps(g,7,8));assert(Math.abs(p.i-7)<1e-9&&Math.abs(p.j-8)<1e-9);}
console.log('SPATIAL_SYNTHETIC_PASS');
