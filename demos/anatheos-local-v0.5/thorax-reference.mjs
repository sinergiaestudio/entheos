/** ANATHEOS T2-B3 · Offline 5-label RTSTRUCT reference overlay.
 * Independent of manual 3-label editing. Not a diagnostic, classification or
 * lesion detection tool. Needs matching CT DICOM AND CT_HU_LPS.nrrd + bitmask.
 */
const palette=[[81,202,171],[231,170,87],[220,102,134],[131,150,235],[211,197,120]];
const names=['Pulmón izquierdo','Pulmón derecho','Corazón (contorno global)','Esófago','Médula espinal'];
const maxVoxels=75_000_000;
const little=(()=>{const x=new Uint8Array(new Uint16Array([1]).buffer);return x[0]===1})();
function close3(a,b,tolerance=.005){return a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=tolerance);}
function vec3(text){const m=/^\(([^)]*)\)$/.exec(text?.trim()||'');if(!m)throw Error('Vector LPS inválido');const v=m[1].split(',').map(Number);if(v.length!==3||v.some(x=>!Number.isFinite(x)))throw Error('Vector LPS inválido');return v;}
function parse(buffer,kind){
 const data=new Uint8Array(buffer);let end=-1;
 for(let i=0;i<Math.min(16384,data.length-1);i++){
  if(data[i]===10&&data[i+1]===10){end=i+2;break;}
  if(i+3<data.length&&data[i]===13&&data[i+1]===10&&data[i+2]===13&&data[i+3]===10){end=i+4;break;}
 }
 if(end<0)throw Error('Cabecera NRRD incompleta');
 const header=new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(0,end));
 if(!/^NRRD000[45]\r?\n/.test(header))throw Error('No es NRRD 4/5');
 const meta={};for(const line of header.split(/\r?\n/)){
  if(!line||line[0]==='#'||line.startsWith('NRRD'))continue;
  const at=line.indexOf(':');if(at>0)meta[line.slice(0,at).trim().toLowerCase()]=line.slice(at+1).trim();
 }
 const dims=(meta.sizes||'').trim().split(/\s+/).map(Number);
 if(meta.dimension!=='3'||dims.length!==3||dims.some(x=>!Number.isInteger(x)||x<1))throw Error('Se exige NRRD 3D');
 const vox=dims[0]*dims[1]*dims[2];if(!Number.isSafeInteger(vox)||vox>maxVoxels)throw Error('Volumen NRRD demasiado grande');
 if(meta.encoding!=='raw'||meta.space!=='left-posterior-superior'||(meta.endian||'little')!=='little')throw Error('Se exige NRRD RAW Little Endian con espacio LPS');
 const type=(meta.type||'').toLowerCase();const isMask=kind==='mask';
 if(isMask?!['uchar','uint8','unsigned char'].includes(type):!['short','int16','signed short'].includes(type))throw Error('Tipo NRRD incompatible');
 if(isMask&&meta['anatheos-layer-format']!=='bitmask-v1')throw Error('Falta bitmask-v1 con cinco capas identificables');
 if(data.length-end!==vox*(isMask?1:2))throw Error('Datos de NRRD incompletos o tamaño inválido');
 const dirs=(meta['space directions']||'').match(/\([^)]*\)/g);
 if(!dirs||dirs.length!==3)throw Error('Direcciones de NRRD faltantes');
 const vectors=dirs.map(vec3),origin=vec3(meta['space origin']);
 if(!little)throw Error('La plataforma no admite este orden de bytes');
 const copy=data.slice(end);const values=isMask?copy:new Int16Array(copy.buffer);
 if(isMask&&values.some(v=>v>31))throw Error('Máscara contiene bits fuera de cinco capas');
 return {dims,dirs:vectors,origin,values};
}
function physicalGrid(series){
 const items=series?.items;if(!items||items.length<2)throw Error('Importá primero la TC DICOM completa');
 const first=items[0],next=items[1],x=first.columns,y=first.rows,z=items.length;
 const dirs=[first.iop.slice(0,3).map(v=>v*first.spacing[1]),
   first.iop.slice(3,6).map(v=>v*first.spacing[0]),next.ipp.map((v,i)=>v-first.ipp[i])];
 for(let i=0;i<items.length;i++){
  const expected=first.ipp.map((v,k)=>v+i*dirs[2][k]);
  if(!close3(expected,items[i].ipp))throw Error('La serie DICOM no forma una grilla LPS regular');
 }
 return {dims:[x,y,z],origin:first.ipp,dirs};
}
function assertSameGrid(a,b){
 if(a.dims.some((x,i)=>x!==b.dims[i])||!close3(a.origin,b.origin)||a.dirs.some((v,i)=>!close3(v,b.dirs[i])))
  throw Error('Máscaras y TC no comparten matriz física LPS');
}
function confirmExactDICOM(ct,series){
 // Full HU comparison, not just shape or origin: prevents mixing subjects/scans.
 const {items}=series,[x,y]=ct.dims,plane=x*y;
 let checked=0;
 for(let z=0;z<items.length;z++){
  const frame=items[z];if(frame.values.length!==plane)throw Error('Cortes DICOM incompletos');
  for(let i=0;i<plane;i++){
   if(Math.abs(ct.values[z*plane+i]-Math.round(frame.values[i]*frame.slope+frame.intercept))>1)
    throw Error('NRRD y DICOM tienen vóxeles diferentes; no pueden superponerse');
   checked++;
  }
 }
 return checked;
}
export const thoraxReference={
 series:null,redraw:null,ct:null,mask:null,canvas:null,ctx:null,lastKey:'',opacity:.55,visible:31,serial:0,
 initialize(){
  const root=document.getElementById('segmentationPanel');if(!root)return;
  const section=document.createElement('section');section.setAttribute('aria-label','Referencia torácica externa');
  section.id='thoraxReferencePanel';section.className='segmentationPanel';
  const top=document.createElement('div');top.className='segTop';
  const title=document.createElement('strong');title.textContent='T2-B3 · Referencia torácica externa (5 capas)';top.append(title);
  const explain=document.createElement('p');explain.textContent='Contornos RT de procedencia externa, no identificación automática. Sólo se superponen si coinciden geometría LPS Y TODOS los vóxeles de la TC DICOM.';
  const controls=document.createElement('div');controls.className='segActions';
  const uploadCT=document.createElement('input');uploadCT.type='file';uploadCT.accept='.nrrd';uploadCT.id='thoraxRefCT';uploadCT.setAttribute('aria-label','Importar CT HU NRRD');
  const uploadMask=document.createElement('input');uploadMask.type='file';uploadMask.accept='.nrrd';uploadMask.id='thoraxRefMask';uploadMask.setAttribute('aria-label','Importar NRRD bitmask cinco capas');
  const status=document.createElement('p');status.id='thoraxRefStatus';status.setAttribute('role','status');status.textContent='Cargá la TC DICOM y luego su pareja CT_HU_LPS.nrrd + máscara bitmask-v1.';
  controls.append(uploadCT,uploadMask);const layers=document.createElement('div');layers.className='segLayers';
  for(let i=0;i<5;i++){
   const label=document.createElement('label');const box=document.createElement('input');box.type='checkbox';box.checked=true;box.id=`thoraxRefLayer${i+1}`;
   box.addEventListener('change',()=>{this.visible=box.checked?this.visible|(1<<i):this.visible&~(1<<i);this.lastKey='';this.redraw?.()});
   const text=document.createElement('span');text.textContent=' '+names[i]+' · referencia externa';label.append(box,text);layers.append(label);
  }
  const opacity=document.createElement('input');opacity.type='range';opacity.id='thoraxRefOpacity';opacity.min=0;opacity.max=100;opacity.value=55;
  opacity.addEventListener('input',()=>{this.opacity=Number(opacity.value)/100;this.lastKey='';this.redraw?.()});
  const opacityLabel=document.createElement('label');opacityLabel.textContent='Opacidad de la referencia externa';opacityLabel.append(opacity);
  const clear=document.createElement('button');clear.type='button';clear.id='thoraxRefClear';clear.textContent='Retirar referencia';
  clear.addEventListener('click',()=>this.reset());
  section.append(top,explain,controls,layers,opacityLabel,clear,status);root.append(section);
  const ingest=async(which,file)=>{
   const token=this.serial;
   try{
    if(!file)return;
    if(!this.series)throw Error('Primero cargá la serie DICOM original');
    const parsed=parse(await file.arrayBuffer(),which);
    if(token!==this.serial)return;
    if(which==='ct')this.ct=parsed;else this.mask=parsed;
    this.lastKey='';this.canvas=null;
    if(this.ct&&this.mask){
     const dicomGrid=physicalGrid(this.series);
     assertSameGrid(this.ct,this.mask);assertSameGrid(this.ct,dicomGrid);
     const checked=confirmExactDICOM(this.ct,this.series);
     status.textContent=`Referencia vinculada: ${checked.toLocaleString('es-AR')} vóxeles de CT cotejados y cinco capas conservadas. No diagnóstica.`;
     this.redraw?.();
    }else{status.textContent=`${which==='ct'?'CT HU':'Máscara'} cargada; falta su pareja NRRD para verificar el mismo estudio.`;}
   }catch(e){this.ct=null;this.mask=null;this.lastKey='';this.canvas=null;status.textContent='RECHAZADO · '+e.message;this.redraw?.();}
  };
  uploadCT.addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';ingest('ct',file);});
  uploadMask.addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';ingest('mask',file);});
 },
 bind(series,redraw){this.series=series;this.redraw=redraw;this.ct=null;this.mask=null;this.lastKey='';this.canvas=null;this.serial++;const el=document.getElementById('thoraxRefStatus');if(el)el.textContent='Nueva serie DICOM: cargá únicamente NRRD originales de ESTE estudio.';},
 reset(){this.bind(null,this.redraw);for(const id of ['thoraxRefCT','thoraxRefMask']){const x=document.getElementById(id);if(x)x.value='';}this.redraw?.();},
 paint(ctx,frame,z){
  if(!this.ct||!this.mask||!this.series||!this.visible||this.opacity===0)return;
  const [x,y]=this.ct.dims,base=z*x*y;const key=[z,this.visible,this.opacity].join(':');
  if(this.lastKey!==key){
   if(!this.canvas){this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');}
   this.canvas.width=x;this.canvas.height=y;
   const image=this.ctx.createImageData(x,y),dest=image.data;
   for(let i=0;i<x*y;i++){
    const bits=this.mask.values[base+i]&this.visible;if(!bits)continue;
    let count=0,r=0,g=0,b=0;
    for(let k=0;k<5;k++){if(bits&(1<<k)){count++;r+=palette[k][0];g+=palette[k][1];b+=palette[k][2];}}
    const at=i*4;dest[at]=r/count;dest[at+1]=g/count;dest[at+2]=b/count;dest[at+3]=Math.round(255*this.opacity);
   }
   this.ctx.putImageData(image,0,0);this.lastKey=key;
  }
  ctx.drawImage(this.canvas,-frame.columns/2,-frame.rows/2);
 }
};
export const referenceQA={parse,physicalGrid,assertSameGrid,confirmExactDICOM};