import assert from 'node:assert/strict';
import {validateCatalog,decodeNpy16,attachDecodedSeries} from '../anatheos_cmr_bridge.mjs';
const makeNpy=()=>{
 const hdr="{'descr': '<u2', 'fortran_order': False, 'shape': (2, 4, 4), }";
 const h=hdr.padEnd(117,' ')+'\n',d=new Uint8Array(10+h.length+64);
 d.set([147,78,85,77,80,89,1,0,h.length,0]);d.set(new TextEncoder().encode(h),10);
 for(let i=0;i<32;i++){d[10+h.length+2*i]=i;d[10+h.length+2*i+1]=0;}
 return d.buffer;
};
const c={schema:'anatheos-cmr-r2-private-v1',series:[{serie_local:'RM-004',estado:'preparada',instancias:2,modo_seguro:'cine_provisional'}]};
assert.deepEqual(validateCatalog(c),{seriesCount:1,prepared:1});
const gm={schema:'anatheos-cmr-r2-private-v1',serie_local:'RM-004',frames:[
{image_orientation_patient_LPS:[1,0,0,0,1,0],image_position_patient_LPS_mm:[0,0,0],pixel_spacing_row_col_mm:[1.3,1.3],rescale_slope:1,rescale_intercept:0,trigger_time_ms:0},
{image_orientation_patient_LPS:[1,0,0,0,1,0],image_position_patient_LPS_mm:[0,0,0],pixel_spacing_row_col_mm:[1.3,1.3],rescale_slope:1,rescale_intercept:0,trigger_time_ms:50}]};
const s=attachDecodedSeries(c,'RM-004',gm,makeNpy());
assert.equal(s.getFrame(1).values[0],16);assert.equal(s.mayBeVolume3d,false);
assert.throws(()=>s.getFrame(4));assert.throws(()=>attachDecodedSeries(c,'RM-009',gm,makeNpy()));
const corrupt=new Uint8Array(makeNpy());corrupt[0]=0;
assert.throws(()=>decodeNpy16(corrupt.buffer));
console.log('ANATHEOS_CMR_R2_BRIDGE_QA=PASS');