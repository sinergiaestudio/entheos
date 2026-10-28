/**
 * ANATHEOS B6.1 — extract labelled voxel BOUNDARIES of the current DICOM study.
 * No anatomical detection and no other reference specimen. Export binary STL
 * vertices in physical DICOM LPS MILLIMETRES (not RAS, not voxel indexes).
 * Faces follow the voxel grid: intentionally block-shaped, no false smoothing.
 * Pure JS; no external libraries, API, telemetry or patient identifiers.
 */
import {inspectVolumeGeometry} from './volumetric.js';
import {MAX_TRIANGLES_PER_MESH,MAX_SCENE_TRIANGLES,MAX_MESH_BYTES} from './surface-core.mjs';

export const MASK_SURFACE_COORDINATES='LPS mm';
const FACE_OFFSETS=Object.freeze([
 [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],
 [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
 [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],
 [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],
 [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]],
 [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]
]);
function check(ok,message){if(!ok)throw new Error(message);}
function geometry(mask,series){
 check(mask&&Number.isInteger(mask.x)&&Number.isInteger(mask.y)&&Number.isInteger(mask.z)&&
  mask.x>0&&mask.y>0&&mask.z>1&&mask.data instanceof Uint8Array&&
  mask.data.length===mask.x*mask.y*mask.z,'Máscara 3D incompatible o truncada.');
 const geo=inspectVolumeGeometry(series);
 check(geo.x===mask.x&&geo.y===mask.y&&geo.z===mask.z,'Máscara de otro estudio: matriz DICOM diferente.');
 const frame=series.items[0];
 const axes=[
  frame.iop.slice(0,3).map(v=>v*frame.spacing[1]),
  frame.iop.slice(3,6).map(v=>v*frame.spacing[0]),
  geo.normal.map(v=>v*geo.stepMm)
 ];
 check([...geo.originLps,...axes.flat()].every(v=>Number.isFinite(v)&&Math.abs(v)<1e8),
  'Coordenadas físicas DICOM fuera de rango.');
 return {geo,axes,origin:geo.originLps};
}
function world(x,y,z,g){
 const [a,b,c]=g.axes,o=g.origin;
 return [o[0]+a[0]*x+b[0]*y+c[0]*z,
         o[1]+a[1]*x+b[1]*y+c[1]*z,
         o[2]+a[2]*x+b[2]*y+c[2]*z];
}
function eachExposedFace(mask,cb){
 const {x:w,y:h,z:d,data}=mask,plane=w*h;
 for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=z*plane+y*w+x,id=data[at];
  if(id===0)continue;
  check(id<=3,'La máscara contiene etiquetas fuera del intervalo 1–3.');
  if(x===0||data[at-1]!==id)cb(id,x,y,z,0);
  if(x===w-1||data[at+1]!==id)cb(id,x,y,z,1);
  if(y===0||data[at-w]!==id)cb(id,x,y,z,2);
  if(y===h-1||data[at+w]!==id)cb(id,x,y,z,3);
  if(z===0||data[at-plane]!==id)cb(id,x,y,z,4);
  if(z===d-1||data[at+plane]!==id)cb(id,x,y,z,5);
 }
}
function writeTriangle(view,offset,vertices,bounds){
 const [a,b,c]=vertices;
 const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
 const magnitude=Math.hypot(...normal);
 check(magnitude>1e-12,'Triángulo degenerado por geometría física DICOM.');
 for(const v of normal){view.setFloat32(offset,v/magnitude,true);offset+=4;}
 for(const point of vertices)for(let k=0;k<3;k++){
  const value=point[k];
  check(Number.isFinite(value)&&Math.abs(value)<1e8,'Coordenada STL inválida.');
  bounds.min[k]=Math.min(bounds.min[k],value);bounds.max[k]=Math.max(bounds.max[k],value);
  view.setFloat32(offset,value,true);offset+=4;
 }
 view.setUint16(offset,0,true);return offset+2;
}
/** No file written unless caller requests export. No network or medical labels. */
export function makeMaskSurfaceSTLs(mask,series){
 const g=geometry(mask,series),counts=[0,0,0,0],voxels=[0,0,0,0];
 for(const v of mask.data){check(v<=3,'Etiqueta de máscara inválida.');if(v)voxels[v]++;}
 eachExposedFace(mask,id=>{counts[id]++;});
 const total=counts.slice(1).reduce((sum,n)=>sum+n*2,0);
 check(total>0,'No hay regiones marcadas que puedan convertirse en superficies.');
 check(total<=MAX_SCENE_TRIANGLES,'Superficie excede límite de escena ('+MAX_SCENE_TRIANGLES+' triángulos); refiná las máscaras.');
 const meshes=[];
 for(let label=1;label<=3;label++){
  const faces=counts[label];if(!faces)continue;
  const triangles=faces*2,bytes=84+triangles*50;
  check(triangles<=MAX_TRIANGLES_PER_MESH&&bytes<=MAX_MESH_BYTES,
   'Región '+label+': demasiadas caras ('+triangles+' triángulos). Dividí o refiná la máscara.');
  const buffer=new ArrayBuffer(bytes),view=new DataView(buffer);
  const header=new TextEncoder().encode('ANATHEOS B6.1 MANUAL ROI; DICOM LPS mm; NOT ANATOMY OR DIAGNOSIS');
  new Uint8Array(buffer).set(header.slice(0,80));
  view.setUint32(80,triangles,true);
  let offset=84;
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  eachExposedFace(mask,(id,x,y,z,face)=>{
   if(id!==label)return;
   const pts=FACE_OFFSETS[face].map(p=>world(x+p[0],y+p[1],z+p[2],g));
   offset=writeTriangle(view,offset,[pts[0],pts[1],pts[2]],bounds);
   offset=writeTriangle(view,offset,[pts[0],pts[2],pts[3]],bounds);
  });
  check(offset===bytes,'Error interno de recuento de triángulos STL.');
  meshes.push({label,name:'Región '+label+' · máscara manual · SIN validar',
   buffer,triangles,exposedFaces:faces,voxels:voxels[label],bounds,
   coordinateSystem:MASK_SURFACE_COORDINATES,derivedFrom:'current-study-manual-labelmap'});
 }
 return meshes;
}
