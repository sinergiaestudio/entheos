import assert from 'node:assert/strict';
import {eligibleVolume,reformat} from './eligible-volume.mjs';
const frames=[0,1,2].map(z=>({study_instance_uid:'synthetic',series_instance_uid:'synthetic-series',frame_of_reference_uid:'synthetic-for',modality:'MR',image_type:'ORIGINAL',image_orientation_patient_LPS:[1,0,0,0,1,0],image_position_patient_LPS_mm:[0,0,z*3],pixel_spacing_row_col_mm:[2,1],acquisition:{scan_sequence:'SE',tr:'500',te:'20',slice_thickness:3}}));
const pixels=Uint16Array.from({length:3*4*5},(_,i)=>Math.floor(i/20)*100+Math.floor(i%20/5)*10+i%5);
const data={id:'synthetic',frames,decoded:{dims:[3,4,5],pixels},mode:'pila_2d_revisar_3d'};
const v=eligibleVolume(data,0);const p=reformat(v,0,2);assert.equal(p.width,4);assert.equal(p.height,3);assert.equal(p.values[2*4+3],232);assert.deepEqual(p.spacing,[3,2]);assert.deepEqual(p.originLps,[2,0,0]);
assert.throws(()=>eligibleVolume({...data,mode:'cine_provisional'},0));
assert.throws(()=>reformat(v,0,99));console.log('G4_GRID_VALUES_SCALE_AND_REJECTION_PASS');
