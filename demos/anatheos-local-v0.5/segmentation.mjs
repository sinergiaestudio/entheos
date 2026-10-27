/** ANATHEOS v0.4: manual, experimental voxel labels.
 * No anatomical recognition; no DICOM modification; no network API.
 * A single label uint8 volume matches the source DICOM voxel grid exactly.
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const REGION_COLORS = ['#fb6c82', '#64d6e4', '#f7c66b'];
export const REGION_NAMES = ['Región 1 · sin validar', 'Región 2 · sin validar', 'Región 3 · sin validar'];
export function createMask(x, y, z) {
  if (![x,y,z].every(n => Number.isInteger(n) && n > 0 && n <= 2048)) throw Error('Dimensiones de máscara inválidas');
  if (x*y*z > 100_000_000) throw Error('Máscara demasiado grande');
  return {x,y,z,data:new Uint8Array(x*y*z)};
}
export function paintDisk(mask, col, row, slice, radiusPx, label, erase=false, zRadius=0) {
  if (!mask || !Number.isInteger(label) || label < 1 || label > 3) throw Error('Etiqueta inválida');
  const x=Math.round(col),y=Math.round(row),z=Math.round(slice),r=clamp(Math.round(radiusPx),1,60);
  if(![x,y,z].every(Number.isFinite)||z<0||z>=mask.z) return 0;
  let edits=0;
  for(let dz=-zRadius;dz<=zRadius;dz++) {
   const zz=z+dz;
   if(zz<0||zz>=mask.z)continue;
   const rr=Math.max(0,Math.sqrt(r*r-dz*dz));
   for(let py=Math.max(0,Math.ceil(y-rr));py<=Math.min(mask.y-1,Math.floor(y+rr));py++)
    for(let px=Math.max(0,Math.ceil(x-rr));px<=Math.min(mask.x-1,Math.floor(x+rr));px++){
     if((px-x)**2+(py-y)**2+dz**2>r*r)continue;
     const at=(zz*mask.y+py)*mask.x+px,next=erase?0:label;
     if(mask.data[at]!==next){mask.data[at]=next;edits++;}
    }
  }
  return edits;
}
/** Region-growing proposal bounded to ONE source slice and finite distance.
 * This is intensity similarity, NEVER automatic anatomy recognition.
 */
export function growRegion2D(mask, frame, col, row, slice, label, tolerance, maxRadius=45, maxPixels=20000) {
 if(!frame || frame.rows!==mask.y||frame.columns!==mask.x || !Number.isFinite(tolerance) || tolerance<0 || label<1 || label>3)throw Error('Parámetros incompatibles');
 const x=Math.floor(col),y=Math.floor(row),z=Math.floor(slice),w=mask.x,h=mask.y;
 if(x<0||x>=w||y<0||y>=h||z<0||z>=mask.z)return 0;
 const start=y*w+x, base=z*w*h;
 const source=frame.values,seed=source[start]*frame.slope+frame.intercept;
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);
 let head=0,tail=1,edits=0;queue[0]=start;visited[start]=1;
 const r=Math.max(1,Math.min(70,Math.round(maxRadius))),r2=r*r;
 while(head<tail && edits<maxPixels){
  const at=queue[head++],px=at%w,py=Math.floor(at/w);
  if((px-x)**2+(py-y)**2>r2)continue;
  const intensity=source[at]*frame.slope+frame.intercept;
  if(Math.abs(intensity-seed)>tolerance)continue;
  if(mask.data[base+at]!==label){mask.data[base+at]=label;edits++;}
  for(const nb of [at-w,at+w,at-1,at+1]){
   if(nb<0||nb>=w*h||visited[nb])continue;
   if(Math.abs((nb%w)-px)+Math.abs(Math.floor(nb/w)-py)!==1)continue;
   visited[nb]=1;queue[tail++]=nb;
  }
 }
 return edits;
}
export function eraseRegion(mask, label){
 if(!mask||label<1||label>3)throw Error('Etiqueta inválida');
 let removed=0;
 for(let i=0;i<mask.data.length;i++)if(mask.data[i]===label){mask.data[i]=0;removed++;}
 return removed;
}
export function countRegions(mask){const result=[0,0,0,0];for(const v of mask.data){if(v<=3)result[v]++;}return result;}
export function labelAt(mask,col,row,z){return mask.data[(z*mask.y+row)*mask.x+col];}
const fmt=x=>Number(x).toPrecision(13).replace(/0+$/,'').replace(/[.]$/,'');
const tuple=v=>'('+v.map(fmt).join(',')+')';
const multiply=(dir,scalar)=>dir.map(x=>x*scalar);
/** Export a DICOM LPS-aligned NRRD labelmap for independent 3D Slicer review.
 * This is NOT a registered DICOM-SEG, nor an automatically labelled model.
 * Header contains only non-identifying grid geometry, not patient tags.
 */
export function toNrrd(mask, series){
 const f=series?.items?.[0];if(!f||f.columns!==mask.x||f.rows!==mask.y||series.items.length!==mask.z)throw Error('Máscara y serie no coinciden');
 const normal=[f.iop[1]*f.iop[5]-f.iop[2]*f.iop[4],f.iop[2]*f.iop[3]-f.iop[0]*f.iop[5],f.iop[0]*f.iop[4]-f.iop[1]*f.iop[3]];
 const directions=[multiply(f.iop.slice(0,3),f.spacing[1]),multiply(f.iop.slice(3),f.spacing[0]),multiply(normal,series.spacingBetween)];
 const header=[
  'NRRD0005','# ANATHEOS 3D v0.4 manual ROI labelmap; NOT diagnostic',
  'type: uint8','dimension: 3','space: left-posterior-superior',
  'sizes: '+[mask.x,mask.y,mask.z].join(' '),'kinds: domain domain domain',
  'space directions: '+directions.map(tuple).join(' '),'space origin: '+tuple(f.ipp),
  'encoding: raw','endian: little',
  'content: Manual region labels (unvalidated anatomy)',
  'ANATHEOS_label1:=Region 1; RGB '+REGION_COLORS[0],
  'ANATHEOS_label2:=Region 2; RGB '+REGION_COLORS[1],
  'ANATHEOS_label3:=Region 3; RGB '+REGION_COLORS[2],
  '', ''
 ].join('\n');
 const prefix=new TextEncoder().encode(header),out=new Uint8Array(prefix.length+mask.data.length);
 out.set(prefix);out.set(mask.data,prefix.length);return out;
}
export function fromNrrd(buffer,mask,series){
 const bytes=new Uint8Array(buffer);const head=bytes.subarray(0,Math.min(8192,bytes.length));
 const marker=new TextEncoder().encode('\n\n');let end=-1;
 for(let i=0;i<head.length-1;i++)if(head[i]===marker[0]&&head[i+1]===marker[1]){end=i+2;break;}
 if(end<0)throw Error('Cabecera NRRD incompleta');
 const header=new TextDecoder().decode(bytes.subarray(0,end));
 if(!header.startsWith('NRRD0005\n')||!header.includes('\nencoding: raw\n')||!header.includes('\ntype: uint8\n'))throw Error('Solo se admite NRRD RAW uint8');
 if(!header.includes('sizes: '+[mask.x,mask.y,mask.z].join(' ')+'\n'))throw Error('Dimensiones NRRD diferentes a la RM');
 if(bytes.length-end!==mask.data.length)throw Error('Datos de segmentación incompletos');
 const expected=toNrrd(createMask(mask.x,mask.y,mask.z),series);
 const expectedHead=new TextDecoder().decode(expected.subarray(0,expected.length-mask.data.length));
 if(header!==expectedHead)throw Error('Geometría NRRD diferente del estudio: máscara rechazada');
 const labels=bytes.subarray(end);
 if(labels.some(v=>v>3))throw Error('Etiquetas de máscara fuera de rango');
 mask.data.set(labels);return countRegions(mask);
}
