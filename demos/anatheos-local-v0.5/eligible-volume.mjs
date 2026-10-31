import {eligibility} from './spatial-reference.mjs';
import {inspectVolumeGeometry} from './volumetric.js';

/** Zero-resampling adapter into the existing ANATHEOS volume/mask/surface contract. */
export function eligibleVolume(data,groupIndex){
 const [count,rows,columns]=data.decoded.dims;
 const analysis=eligibility(data.frames,rows,columns,{mode:data.mode});
 const group=analysis.groups[groupIndex];if(!group?.volumeEligible)throw Error('Grupo no elegible: '+(group?.reasons.join('; ')||'ausente'));
 if(group.indices.length*rows*columns>100_000_000)throw Error('Volumen excede el límite del editor de máscaras');
 const items=group.indices.map(index=>{const f=data.frames[index];return {
  seriesUid:f.series_instance_uid,description:data.id,filename:'DICOM original decodificado',rows,columns,
  iop:f.image_orientation_patient_LPS,ipp:f.image_position_patient_LPS_mm,spacing:f.pixel_spacing_row_col_mm,
  values:data.decoded.pixels.subarray(index*rows*columns,(index+1)*rows*columns),
  slope:f.rescale_slope??1,intercept:f.rescale_intercept??0,photo:f.photometric_interpretation||'MONOCHROME2',
  instance:index+1,modality:f.modality,syntax:f.transfer_syntax||'',sourceSha256:f.source_sha256};});
 const series={uid:items[0].seriesUid,description:data.id,items,spacingBetween:group.spacingMm};
 inspectVolumeGeometry(series);return series;
}

/** Reformat original grid along its own axes; no anatomical-axis claim or interpolation. */
export function reformat(series,axis,index){
 const geo=inspectVolumeGeometry(series),[x,y,z]=[geo.x,geo.y,geo.z];
 const limits=[x,y,z];if(!Number.isInteger(axis)||axis<0||axis>2||!Number.isInteger(index)||index<0||index>=limits[axis])throw Error('Plano MPR fuera de campo');
 const width=axis===0?y:x,height=axis===2?y:z,values=new Float32Array(width*height);
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const [i,j,k]=axis===0?[index,col,row]:axis===1?[col,index,row]:[col,row,index];
  const f=series.items[k];values[row*width+col]=f.values[j*x+i]*f.slope+f.intercept;
 }
 const f=series.items[0],normal=geo.normal;
 const u=axis===0?f.iop.slice(3):f.iop.slice(0,3),v=axis===2?f.iop.slice(3):normal;
 const step=axis===0?f.spacing[1]:axis===1?f.spacing[0]:geo.stepMm;
 const direction=axis===0?f.iop.slice(0,3):axis===1?f.iop.slice(3):normal;
 return {width,height,values,spacing:[axis===2?f.spacing[0]:geo.stepMm,axis===0?f.spacing[0]:f.spacing[1]],
  originLps:f.ipp.map((n,k)=>n+index*step*direction[k]),iop:[...u,...v],axis,index,
  provenance:'Cuadrícula de la pila original; sin interpolación, sin resolución adicional'};
}
