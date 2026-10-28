import { inspectVolumeGeometry, prepareVolumeTexture, VolumeRenderer } from './volumetric.js';
import { createMask, paintDisk, growRegion2D, eraseRegion, countRegions, toNrrd, fromNrrd, REGION_COLORS } from './segmentation.mjs';
import {makeMaskSurfaceSTLs} from './mask-to-surface.mjs';
import {makeContinuousMaskSTLs} from './continuous-mask-surface.mjs';
import {proposeConnected3D,acceptConnected3D} from './assisted-segmentation-3d.mjs';
/* ANATHEOS Demo Local v0.1 — native uncompressed DICOM browser viewer.
 * Operates only on File/Blob bytes provided by the user or localhost package.
 * No remote API or data telemetry. Experimental; not medical/diagnostic.
 * Cornerstone3D compatibility is tracked in separate G2a browser experiments.
 */
const $=id=>document.getElementById(id);
const state={mode:'2d',mixed:false,volumeRenderer:null,volumeToken:0,series:[],current:null,index:0,wlCenter:350,wlWidth:850,brightness:0,contrast:100,zoom:1,panX:0,panY:0,loadGeneration:0,source:'',imageKey:'',lastPixels:null,segMask:null,segCount:[0,0,0,0],segVersion:0,segVisibility:7,segOverlayKey:'',segEdit:false,b7Picking:false,b7Seed:null,b7Draft:null,b7DraftVersion:0};
const LONG=new Set(['OB','OD','OF','OL','OV','OW','SQ','UC','UR','UT','UN']);
const NUMTAG=new Set([0x00280002,0x00280010,0x00280011,0x00280100,0x00280101,0x00280102,0x00280103,0x00280006]);
const TAGS=new Map([[0x00020010,'syntax'],[0x00080060,'modality'],[0x0008103e,'description'],[0x00080016,'sopClass'],[0x0020000e,'seriesUid'],[0x00200013,'instance'],[0x00200032,'ipp'],[0x00200037,'iop'],[0x00280002,'samples'],[0x00280004,'photo'],[0x00280008,'frames'],[0x00280010,'rows'],[0x00280011,'columns'],[0x00280030,'spacing'],[0x00280100,'bitsAllocated'],[0x00280101,'bitsStored'],[0x00280102,'highBit'],[0x00280103,'signed'],[0x00281052,'intercept'],[0x00281053,'slope'],[0x00281050,'dicomCenter'],[0x00281051,'dicomWidth'],[0x7fe00010,'pixels']]);
const UTF8=new TextDecoder('utf-8');
function stringVal(bytes){return UTF8.decode(bytes).replace(/[\x00 ]+$/g,'').trim();}
function numericList(s){return (s||'').split('\\').map(Number).filter(Number.isFinite);}
function hasDicm(buffer){return buffer.byteLength>=132&&String.fromCharCode(...new Uint8Array(buffer,128,4))==='DICM';}
function readDicom(buffer,name){
 const view=new DataView(buffer),u8=new Uint8Array(buffer);
 if(!hasDicm(buffer))throw Error('No contiene cabecera DICOM Part 10 (DICM)');
 let offset=132,syntax='',meta={},pixelOffset=-1,pixelLength=0;
 while(offset+8<=buffer.byteLength){
  const group=view.getUint16(offset,true),element=view.getUint16(offset+2,true),tag=(group*65536+element)>>>0;
  offset+=4;
  const explicit=(group===2 || syntax!=='1.2.840.10008.1.2');let vr='',length=0;
  if(explicit){vr=String.fromCharCode(u8[offset],u8[offset+1]);offset+=2;
   if(LONG.has(vr)){if(offset+6>buffer.byteLength)throw Error('Campo DICOM incompleto');offset+=2;length=view.getUint32(offset,true);offset+=4;}
   else{length=view.getUint16(offset,true);offset+=2;}
  }else{length=view.getUint32(offset,true);offset+=4;}
  if(length===0xffffffff){if(tag===0x7fe00010)throw Error('Transfer Syntax encapsulada o comprimida: no compatible con este visor local');throw Error('Secuencia DICOM de longitud indefinida: versión local no compatible');}
  if(offset+length>buffer.byteLength)throw Error('Campo DICOM incompleto o longitud fuera del archivo');
  const key=TAGS.get(tag);
  if(tag===0x7fe00010){pixelOffset=offset;pixelLength=length;break;}
  if(key){
   if(NUMTAG.has(tag)&&length===2)meta[key]=view.getUint16(offset,true);
   else if(length<4096)meta[key]=stringVal(u8.subarray(offset,offset+length));
   if(tag===0x00020010)syntax=meta.syntax;
  }
  offset+=length;
 }
 if(pixelOffset<0)throw Error('No se encontró Pixel Data (7FE0,0010)');
 if(!['1.2.840.10008.1.2.1','1.2.840.10008.1.2'].includes(meta.syntax))throw Error('Transfer Syntax '+(meta.syntax||'desconocida')+' no compatible con Demo v0.1');
 if(meta.frames&&Number(meta.frames)>1)throw Error('Instancia multiframe: todavía no compatible con esta demo local');
 if(meta.samples!==1||!['MONOCHROME2','MONOCHROME1'].includes(meta.photo))throw Error('Solo se admiten muestras DICOM monocromáticas');
 if(meta.bitsAllocated!==16||!(meta.bitsStored>=1&&meta.bitsStored<=16))throw Error('Profundidad de bits no compatible (se requieren 16 bits asignados)');
 if(!(meta.rows>0&&meta.columns>0&&meta.rows<=8192&&meta.columns<=8192))throw Error('Matriz DICOM inválida');
 const count=meta.rows*meta.columns;
 if(pixelLength<count*2)throw Error('Pixel Data contiene menos bytes de los esperados');
 const pixelBytes=new DataView(buffer,pixelOffset,count*2),bits=meta.bitsStored,mask=bits===16?0xffff:(1<<bits)-1;
 const values=new Int32Array(count);
 for(let i=0;i<count;i++){let v=pixelBytes.getUint16(i*2,true)&mask;
  if(meta.signed===1&&v&(1<<(bits-1)))v-=1<<bits;
  values[i]=v;
 }
 const ipp=numericList(meta.ipp),iop=numericList(meta.iop),spacing=numericList(meta.spacing);
 if(ipp.length!==3||iop.length!==6||spacing.length!==2||spacing.some(s=>s<=0))throw Error('Faltan IPP, IOP o PixelSpacing válidos para ordenar la serie');
 return {...meta,filename:name,ipp,iop,spacing,values,pixelCount:count,
  slope:Number(meta.slope)||1,intercept:Number(meta.intercept)||0};
}
// CRC32 detects corrupted ZIP members before parsing as medical images.
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(data){let c=0xffffffff;for(let i=0;i<data.length;i++)c=CRC_TABLE[(c^data[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function listZip(buffer){
 const v=new DataView(buffer),arr=new Uint8Array(buffer),last=Math.max(0,arr.length-65557);let eocd=-1;
 for(let i=arr.length-22;i>=last;i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('No se encontró el índice central del ZIP');
 const num=v.getUint16(eocd+10,true),start=v.getUint32(eocd+16,true);
 if(num===0xffff||start===0xffffffff)throw Error('ZIP64 todavía no compatible');
 if(num>12000)throw Error('ZIP excede el límite local de archivos');
 let p=start,entries=[];
 for(let i=0;i<num;i++){
  if(p+46>arr.length||v.getUint32(p,true)!==0x02014b50)throw Error('Índice central ZIP inconsistente');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),crc=v.getUint32(p+16,true),compressed=v.getUint32(p+20,true),uncompressed=v.getUint32(p+24,true),nlen=v.getUint16(p+28,true),xlen=v.getUint16(p+30,true),clen=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
  const name=UTF8.decode(arr.subarray(p+46,p+46+nlen));
  if(!name.endsWith('/'))entries.push({name,flags,method,crc,compressed,uncompressed,local});
  p+=46+nlen+xlen+clen;
 }
 return entries;
}
async function unpackMember(buffer,entry){
 const v=new DataView(buffer),arr=new Uint8Array(buffer),p=entry.local;
 if(v.getUint32(p,true)!==0x04034b50)throw Error('Encabezado local ZIP no válido');
 if(entry.flags&1)throw Error('ZIP cifrado no permitido');
 const dataStart=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true);
 if(dataStart+entry.compressed>buffer.byteLength)throw Error('ZIP truncado');
 const comp=arr.subarray(dataStart,dataStart+entry.compressed);
 let result;
 if(entry.method===0)result=new Uint8Array(comp);
 else if(entry.method===8){
  if(typeof DecompressionStream==='undefined')throw Error('Tu navegador no admite ZIP; extraé la carpeta DICOM y abrila');
  result=new Uint8Array(await new Response(new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
 }else throw Error('Método de compresión ZIP no compatible: '+entry.method);
 if(result.byteLength!==entry.uncompressed||crc32(result)!==entry.crc)throw Error('CRC incorrecto o longitud inválida del ZIP');
 return result;
}
function vecCross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((sum,v,i)=>sum+v*b[i],0);}
function orientCheck(a,b){return a.iop.every((v,k)=>Math.abs(v-b.iop[k])<0.0003);}
function clean(){state.b7Picking=false;state.b7Seed=null;state.b7Draft=null;state.b7DraftVersion++;$('b7SeedStatus').textContent='Sin semilla seleccionada.';$('b7Accept').disabled=true;$('b7Discard').disabled=true;$('b7Discard').disabled=true;window.dispatchEvent(new Event('anatheos:study-reset'));stopVolume();state.mode='2d';state.mixed=false;switchModeButtons();state.segMask=null;state.segVersion++;state.segCount=[0,0,0,0];state.segOverlayKey='';state.segEdit=false;$('segEdit').checked=false;state.current=null;state.series=[];state.index=0;state.imageKey='';state.lastPixels=null;state.source='';state.panX=0;state.panY=0;state.zoom=1;updateControls();render();}
function cancelCurrent(){state.loadGeneration++;$('loading').hidden=true;}
function showLoad(detail,progress=0){$('loading').hidden=false;$('loadingDetail').textContent=detail;$('loadingProgress').style.width=progress+'%';}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4200);}
const yieldUI=()=>new Promise(ok=>requestAnimationFrame(()=>setTimeout(ok,0)));
function warningsDisplay(errors,notes){const w=$('warnings');w.replaceChildren();if(!errors.length&&!notes.length){w.textContent='Archivos comprobados. Sin errores de lectura.';w.classList.add('oktext');return;}
 w.classList.remove('oktext');for(let msg of [...errors.slice(0,6).map(s=>'ERROR · '+s),...notes.slice(0,6)]){const p=document.createElement('p');p.textContent=msg;if(msg.startsWith('ERROR'))p.classList.add('error');w.append(p);}if(errors.length>6){const p=document.createElement('p');p.textContent=`+ ${errors.length-6} errores adicionales`;w.append(p);}}
async function loadBuffer(buffer,source,gen){
 let files=[];const errors=[];let notes=[];const entries=listZip(buffer);
 let selected=entries;
 const nested=entries.filter(e=>/\.zip$/i.test(e.name));
 const dicoms=entries.filter(e=>!e.name.includes('__MACOSX')&&!e.name.endsWith('.txt')&&!e.name.endsWith('.zip'));
 if(nested.length&&!dicoms.length){
  const target=nested.find(e=>/MR_DESS\.zip$/i.test(e.name));
  if(!target)throw Error('Contenedor con ZIP: no se encontró RTKN*_MR_DESS.zip');
  showLoad('Extrayendo el ZIP DESS original del contenedor A…',8);
  const inside=(await unpackMember(buffer,target)).buffer;
  if(gen!==state.loadGeneration)return;
  return loadBuffer(inside,target.name,gen);
 }
 selected=dicoms;
 if(selected.length>2500)throw Error('Se excedió el límite de seguridad de 2500 instancias');
 let total=0;
 for(let i=0;i<selected.length;i++){
  if(gen!==state.loadGeneration)return;
  const e=selected[i];
  if(e.uncompressed>100*1024*1024){errors.push(e.name+': archivo excesivamente grande');continue;}
  try{const raw=await unpackMember(buffer,e);const record=readDicom(raw.buffer,e.name);files.push(record);}catch(ex){if(errors.length<150)errors.push(e.name.split('/').pop()+': '+ex.message);}
  total++;if(i%6===0){showLoad('Leyendo instancias DICOM… '+total+' de '+selected.length,Math.round(total/selected.length*95));await yieldUI();}
 }
 if(gen!==state.loadGeneration)return;
 return commitRecords(files,source,errors,notes,gen);
}
function commitRecords(files,source,errors,notes,gen){
 if(gen!==state.loadGeneration)return;
 if(!files.length)throw Error('No se encontraron instancias DICOM compatibles. '+(errors[0]||''));
 const grouped=new Map();for(const m of files){const k=m.seriesUid||m.description||'sin-serie';if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(m);}
 state.series=Array.from(grouped.entries()).map(([uid,items])=>{
  const first=items[0],normal=vecCross(first.iop.slice(0,3),first.iop.slice(3));
  let compatible=items.filter(m=>m.rows===first.rows&&m.columns===first.columns&&m.spacing.every((s,i)=>Math.abs(s-first.spacing[i])<0.002)&&orientCheck(m,first));
  if(compatible.length!==items.length)notes.push(`SERIE: ${items.length-compatible.length} instancias tienen diferente matriz/orientación y fueron excluidas de este stack.`);
  for(const m of compatible)m.projection=dot(normal,m.ipp);
  compatible.sort((a,b)=>a.projection-b.projection||Number(a.instance)-Number(b.instance));
  const dist=compatible.slice(1).map((m,i)=>m.projection-compatible[i].projection);
  const median=dist.slice().sort((a,b)=>a-b)[Math.floor(dist.length/2)]||0;
  if(dist.some(d=>Math.abs(d-median)>0.05))notes.push('Advertencia: espaciamiento irregular; no se habilitan reconstrucciones multiplanares.');
  if(compatible.some(m=>Math.abs(dot(normal,m.ipp)-m.projection)>1e-6))notes.push('Geometría de instancia inconsistente.');
  return{uid,description:first.description||'Serie DICOM',items:compatible,normal,spacingBetween:median};
 }).filter(s=>s.items.length).sort((a,b)=>b.items.length-a.items.length);
 if(!state.series.length)throw Error('Ninguna serie conserva orientación y matriz compatibles');
 state.b7Seed=null;state.b7Draft=null;state.b7DraftVersion++;$('b7SeedStatus').textContent='Sin semilla seleccionada.';$('b7Accept').disabled=true;
 state.current=state.series[0];state.segMask=createMask(state.current.items[0].columns,state.current.items[0].rows,state.current.items.length);
 state.segVersion++;state.segOverlayKey='';state.segCount=[0,0,0,0];state.index=Math.floor(state.current.items.length/2);state.source=source;
 const active=state.current.items[state.index];
 let sampled=[];for(let i=0;i<active.values.length;i+=17)sampled.push(active.values[i]*active.slope+active.intercept);
 sampled.sort((a,b)=>a-b);state.wlCenter=(sampled[Math.floor(sampled.length*.02)]+sampled[Math.floor(sampled.length*.98)])/2;
 state.wlWidth=Math.max(10,sampled[Math.floor(sampled.length*.98)]-sampled[Math.floor(sampled.length*.02)]);
 state.zoom=1;state.panX=0;state.panY=0;state.imageKey='';state.lastPixels=null;
 notes.unshift(`Importación local · ${files.length} instancias decodificadas en memoria · ${grouped.size} serie(s).`);
 if(files.length===144&&state.current.items.length===144)notes.push('DESS RTKN0668: 144 posiciones geométricas únicas, normal del stack calculada desde ImageOrientationPatient.');
 warningsDisplay(errors,notes);updateControls();render();$('loading').hidden=true;
 toast(`Serie cargada: ${state.current.items.length} cortes reales · sin transmisión externa`);
}
async function loadFiles(fileList){
 const gen=++state.loadGeneration;clean();showLoad('Leyendo archivos de la carpeta…',0);const errors=[],notes=[],records=[];
 try{
  const list=Array.from(fileList).filter(f=>!f.name.startsWith('.')&&!f.name.endsWith('.txt'));
  if(list.length>2500)throw Error('Demasiados archivos en la carpeta');
  for(let i=0;i<list.length;i++){
   if(gen!==state.loadGeneration)return;
   try{records.push(readDicom(await list[i].arrayBuffer(),list[i].name));}catch(e){if(errors.length<150)errors.push(list[i].name+': '+e.message);}
   if(i%6===0){showLoad('Leyendo carpeta… '+(i+1)+' de '+list.length,Math.round((i+1)/list.length*100));await yieldUI();}
  }
  commitRecords(records,'Carpeta local',errors,notes,gen);
 }catch(e){if(gen===state.loadGeneration){$('loading').hidden=true;warningsDisplay([e.message],[]);toast(e.message);}}
}
async function loadZipFile(file){const gen=++state.loadGeneration;clean();showLoad('Abriendo ZIP local…',2);try{const b=await file.arrayBuffer();if(gen!==state.loadGeneration)return;await loadBuffer(b,file.name,gen);}catch(e){if(gen===state.loadGeneration){$('loading').hidden=true;warningsDisplay([e.message],[]);toast(e.message);}}}
async function loadIncluded(){const gen=++state.loadGeneration;clean();showLoad('Leyendo DESS incluida desde localhost…',3);
 try{const controller=new AbortController();loadIncluded.controller=controller;const r=await fetch('datasets/RTKN0668_MR_DESS.zip',{signal:controller.signal,cache:'no-store'});if(!r.ok)throw Error('No se encontró la DESS incluida en el paquete local');const b=await r.arrayBuffer();if(gen!==state.loadGeneration)return;await loadBuffer(b,'RTKN0668_MR_DESS.zip · incluida',gen);}catch(e){if(gen===state.loadGeneration){$('loading').hidden=true;warningsDisplay([e.message],[]);toast(e.message);}}}
function clamp(n,low,high){return Math.max(low,Math.min(high,n));}
function currentFrame(){return state.current?.items[state.index];}
function updateControls(){const active=currentFrame(),has=!!active;
 $('threeDButton').disabled=!has;
 $('mixedButton').disabled=!has;

 $('emptyViewer').style.display=has?'none':'flex';$('viewBadge').hidden=!has;
 $('studyTitle').textContent=has?state.current.description:'Sin estudio cargado';$('studySubtitle').textContent=has?`${state.current.items.length} instancias · ${active.modality} · ${state.source}`:'Seleccioná una secuencia para comenzar.';
 $('seriesList').replaceChildren();if(has){for(const s of state.series){const c=document.createElement('div');c.className='seriesCard';const title=document.createElement('strong');title.textContent=s.description;const n=document.createElement('span');n.textContent=`${s.items.length} cortes · ${s.items[0].rows}×${s.items[0].columns}`;c.append(title,n);$('seriesList').append(c);}}
 else $('seriesList').innerHTML='<div class="empty">Todavía no se cargaron imágenes.</div>';
 $('sliceRange').disabled=!has;$('windowRange').disabled=!has;$('levelRange').disabled=!has;
 $('segSave').disabled=!has;$('segOpen').disabled=!has;
 $('b7PickSeed').disabled=!has;$('b7Propose').disabled=!has||!state.b7Seed;
 $('segBuildSurface').disabled=!has||!state.segCount.slice(1).some(Boolean);$('segClearLayer').disabled=!has;$('segClearAll').disabled=!has;$('segEdit').disabled=!has;
 if(has){$('sliceRange').min=0;$('sliceRange').max=state.current.items.length-1;$('sliceRange').value=state.index;
  const center=state.wlCenter,width=state.wlWidth;
  $('windowRange').max=Math.max(4096,Math.ceil(width*3));$('windowRange').value=clamp(width,1,Number($('windowRange').max));
  $('levelRange').min=-4096;$('levelRange').max=Math.max(4095,Math.ceil(center+width*2));$('levelRange').value=clamp(center,-4096,Number($('levelRange').max));
  $('windowValue').textContent=width.toFixed(0);$('levelValue').textContent=center.toFixed(0);
  $('sliceCurrent').textContent=state.index+1;$('sliceTotal').textContent='/ '+state.current.items.length;
  $('slicePosition').textContent=active.projection.toFixed(2)+' mm';$('frameLabel').textContent='CORTE '+(state.index+1)+' / '+state.current.items.length;
  $('metaMatrix').textContent=active.columns+' × '+active.rows;
  $('metaSpacing').textContent=active.spacing.map(v=>v.toFixed(4)).join(' × ')+' mm';
  $('metaOrientation').textContent=active.iop.map(v=>v.toFixed(3)).join(', ');
  $('metaSyntax').textContent=active.syntax.replace('1.2.840.10008.1.2.1','Explicit VR LE').replace('1.2.840.10008.1.2','Implicit VR LE');
  $('metaCount').textContent=state.current.items.length+' imágenes';$('metaPosition').textContent=active.projection.toFixed(3)+' mm';$('sourceLabel').textContent='FUENTE LOCAL';
 }else{$('sliceCurrent').textContent='—';$('sliceTotal').textContent='/ —';$('slicePosition').textContent='— mm';$('frameLabel').textContent='SIN IMÁGENES';for(let id of ['metaMatrix','metaSpacing','metaOrientation','metaSyntax','metaCount','metaPosition'])$(id).textContent='—';}
 $('brightnessValue').textContent=state.brightness.toFixed(0);$('contrastValue').textContent=state.contrast+'%';
}
function makePixels(frame){const {rows,columns,values,slope,intercept}=frame,output=new ImageData(columns,rows),dst=output.data;
 const lo=state.wlCenter-state.wlWidth/2,width=Math.max(1,state.wlWidth),gain=state.contrast/100,offset=state.brightness/100;
 for(let i=0;i<values.length;i++){const val=values[i]*slope+intercept;let p=clamp((val-lo)/width,0,1);p=clamp((p-.5)*gain+.5+offset,0,1);let gray=Math.round((frame.photo==='MONOCHROME1'?1-p:p)*255);const k=i*4;dst[k]=dst[k+1]=dst[k+2]=gray;dst[k+3]=255;}return output;
}
const b7Overlay=document.createElement('canvas'),b7OverlayCtx=b7Overlay.getContext('2d');let b7OverlayKey='';
const canvas=$('scanCanvas'),ctx=canvas.getContext('2d',{alpha:false}),offscreen=document.createElement('canvas'),offctx=offscreen.getContext('2d',{alpha:false}),segOverlayCanvas=document.createElement('canvas'),segOverlayCtx=segOverlayCanvas.getContext('2d');
function render(){if(state.mode==='3d'&&!state.mixed){state.volumeRenderer?.draw();return;}const box=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(10,Math.round(box.width*ratio)),h=Math.max(10,Math.round(box.height*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#181b1e';ctx.fillRect(0,0,w,h);
 const frame=currentFrame();if(!frame)return;
 const key=[state.current.uid,state.index,state.wlCenter,state.wlWidth,state.brightness,state.contrast].join('|');
 if(key!==state.imageKey){offscreen.width=frame.columns;offscreen.height=frame.rows;offctx.putImageData(makePixels(frame),0,0);state.imageKey=key;}
 const fit=Math.min(w/frame.columns,h/frame.rows)*.90,scale=fit*state.zoom;
 ctx.save();ctx.translate(w/2+state.panX*ratio,h/2+state.panY*ratio);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=true;ctx.drawImage(offscreen,-frame.columns/2,-frame.rows/2);
 // The proposal preview is completely separate from original DICOM or accepted labelmap.
 if(state.b7Draft){
  const draft=state.b7Draft,signature=[state.index,state.b7DraftVersion].join('|');
  if(signature!==b7OverlayKey){
   b7Overlay.width=frame.columns;b7Overlay.height=frame.rows;
   const image=b7OverlayCtx.createImageData(frame.columns,frame.rows),pixels=image.data,plane=frame.columns*frame.rows,base=state.index*plane;
   for(const index of draft.indices){if(index<base||index>=base+plane)continue;
    const k=(index-base)*4;pixels[k]=48;pixels[k+1]=220;pixels[k+2]=234;pixels[k+3]=153;}
   b7OverlayCtx.putImageData(image,0,0);b7OverlayKey=signature;
  }
  ctx.drawImage(b7Overlay,-frame.columns/2,-frame.rows/2);
 }

 if(state.segMask&&state.segCount.slice(1).some(Boolean)){
  const mask=state.segMask,z=state.index,signature=[z,state.segVersion,state.segVisibility].join('|');
  if(signature!==state.segOverlayKey){
   segOverlayCanvas.width=mask.x;segOverlayCanvas.height=mask.y;
   const overlay=segOverlayCtx.createImageData(mask.x,mask.y),dest=overlay.data,base=z*mask.x*mask.y;
   for(let i=0;i<mask.x*mask.y;i++){
    const label=mask.data[base+i];if(!label||!(state.segVisibility&(1<<(label-1))))continue;
    const hex=REGION_COLORS[label-1],k=i*4;
    dest[k]=parseInt(hex.slice(1,3),16);dest[k+1]=parseInt(hex.slice(3,5),16);dest[k+2]=parseInt(hex.slice(5,7),16);dest[k+3]=155;
   }
   segOverlayCtx.putImageData(overlay,0,0);state.segOverlayKey=signature;
  }
  ctx.drawImage(segOverlayCanvas,-frame.columns/2,-frame.rows/2);
 }
 ctx.restore();
 if(state.mode==='3d'&&state.mixed)state.volumeRenderer?.draw();
}
function chooseSlice(index){if(!state.current)return;state.index=clamp(Math.round(index),0,state.current.items.length-1);state.imageKey='';updateControls();render();}
function resetView(){state.panX=state.panY=0;state.zoom=1;render();}
$('loadIncluded').onclick=loadIncluded;$('zipButton').onclick=()=>$('zipInput').click();$('folderButton').onclick=()=>$('folderInput').click();
$('zipInput').onchange=e=>{if(e.target.files[0])loadZipFile(e.target.files[0]);e.target.value='';};$('folderInput').onchange=e=>{if(e.target.files.length)loadFiles(e.target.files);e.target.value='';};
$('cancelLoad').onclick=()=>{loadIncluded.controller?.abort();cancelCurrent();clean();toast('Carga cancelada.');};
$('clearButton').onclick=()=>{loadIncluded.controller?.abort();cancelCurrent();clean();warningsDisplay([],['Los datos de la serie se retiraron de la aplicación. La memoria puede liberarse de forma diferida por el navegador.']);toast('Recursos desvinculados de la sesión.');};
$('sliceRange').oninput=e=>chooseSlice(Number(e.target.value));$('prev').onclick=()=>chooseSlice(state.index-1);$('next').onclick=()=>chooseSlice(state.index+1);
$('windowRange').oninput=e=>{state.wlWidth=Number(e.target.value);updateControls();render();};$('levelRange').oninput=e=>{state.wlCenter=Number(e.target.value);updateControls();render();};
$('brightnessRange').oninput=e=>{state.brightness=Number(e.target.value);updateControls();render();};$('contrastRange').oninput=e=>{state.contrast=Number(e.target.value);updateControls();render();};
$('autoWindow').onclick=()=>{const f=currentFrame();if(!f)return;const data=[];for(let i=0;i<f.values.length;i+=17)data.push(f.values[i]*f.slope+f.intercept);data.sort((a,b)=>a-b);let a=data[Math.floor(.02*data.length)],b=data[Math.floor(.98*data.length)];state.wlCenter=(a+b)/2;state.wlWidth=Math.max(1,b-a);updateControls();render();};
$('zoomIn').onclick=()=>{state.zoom=clamp(state.zoom*1.25,.3,10);render();};$('zoomOut').onclick=()=>{state.zoom=clamp(state.zoom/1.25,.3,10);render();};$('fitButton').onclick=resetView;
canvas.addEventListener('wheel',e=>{if(!currentFrame())return;e.preventDefault();if(e.ctrlKey||e.metaKey){state.zoom=clamp(state.zoom*(e.deltaY>0?.9:1.1),.3,10);render();}else chooseSlice(state.index+(e.deltaY>0?1:-1));},{passive:false});
let dragging=false,lastX=0,lastY=0;canvas.onpointerdown=e=>{if(!currentFrame())return;
 if(state.b7Picking){
  const xy=pointToPixel(e);state.b7Picking=false;
  if(xy){state.b7Seed={x:Math.floor(xy[0]),y:Math.floor(xy[1]),z:state.index};
   $('b7SeedStatus').textContent='Semilla: ('+state.b7Seed.x+', '+state.b7Seed.y+', corte '+(state.b7Seed.z+1)+')';
   $('b7Propose').disabled=false;
   $('b7Status').textContent='Semilla colocada. Ajustá tolerancia y radio físico; prepará la propuesta.';
  }else{$('b7Status').textContent='Punto fuera de la imagen; elegí otra semilla.';}
  return;
 }
 if(state.segEdit){paintFromPointer(e);canvas.setPointerCapture(e.pointerId);return;}dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(state.segEdit&&paintingSeg){paintFromPointer(e);return;}if(!dragging)return;state.panX+=e.clientX-lastX;state.panY+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;render();};canvas.onpointerup=()=>{dragging=false;if(paintingSeg)finishPaint();};canvas.onpointercancel=()=>{dragging=false;if(paintingSeg)finishPaint();};
window.addEventListener('resize',()=>render());document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowUp'].includes(e.key)){if(currentFrame()){e.preventDefault();chooseSlice(state.index-1);}}else if(['ArrowRight','ArrowDown'].includes(e.key)){if(currentFrame()){e.preventDefault();chooseSlice(state.index+1);}}});
updateControls();render();

/* ANATHEOS v0.2 true volumetric rendering from the uploaded DICOM pixels. */
function switchModeButtons(){
 const is3d=state.mode==='3d',mixed=is3d&&state.mixed;
 $('threeDButton').setAttribute('aria-pressed',String(is3d&&!mixed));
 $('mixedButton').setAttribute('aria-pressed',String(mixed));
 $('twoDButton').setAttribute('aria-pressed',String(!is3d));
 $('scanCanvas').hidden=is3d&&!mixed;
 $('volumeCanvas').hidden=!is3d;
 $('volumeControls').hidden=!is3d;
 $('viewerOverlayActions').hidden=!is3d;
 $('sliceRange').disabled=(is3d&&!mixed)||!currentFrame();
 $('viewBadge').textContent=mixed?'MIXTO · DICOM 2D + VOLUMEN REAL':is3d?'VOLUMEN REAL · GPU':'ORIGINAL · DICOM';
 $('viewerInfo').textContent=mixed?'Izquierda: cortes DICOM · derecha: rotar volumen · rueda: zoom':is3d?'Arrastrar: rotar · rueda: acercar':'Ctrl + rueda: zoom · arrastrar: mover · rueda: cortes';
 $('orientationNote').textContent=is3d?'DICOM original · orientación radiológica pendiente de validar':'Orientación indicada por DICOM · lateralidad no validada en Slicer';
 $('volumeStatus').textContent=is3d?'Volumen activo · representación no diagnóstica':'';
 $('viewerRoot').dataset.uxMode=mixed?'mixed':is3d?'volume':'slice';
}
function stopVolume(){
 state.volumeToken++;
 if(state.volumeRenderer){state.volumeRenderer.dispose();state.volumeRenderer=null;}
 $('volumeCanvas').hidden=true;
}
async function enableVolume(asMixed=false){
 if(!state.current){toast('Cargá primero una serie DICOM.');return;}
 if(state.mode==='3d'){
  state.mixed=asMixed;switchModeButtons();requestAnimationFrame(()=>render());
  return;
 }
 const token=++state.volumeToken;
 try{
  const g=inspectVolumeGeometry(state.current);
  state.mode='3d';state.mixed=asMixed;switchModeButtons();
  showLoad('Preparando el volumen real de '+g.z+' cortes · '+g.x+' × '+g.y+' píxeles…',0);
  const prepared=await prepareVolumeTexture(state.current,(done,total)=>showLoad('Construyendo textura volumétrica '+done+' / '+total,Math.round(100*done/total)),()=>token!==state.volumeToken);
  if(token!==state.volumeToken)return;
  state.volumeRenderer=new VolumeRenderer($('volumeCanvas'),prepared);
  state.volumeRenderer.opacity=Number($('volumeOpacity').value)/100;
  state.volumeRenderer.threshold=Number($('volumeThreshold').value)/100;
  state.volumeRenderer.steps=Number($('volumeQuality').value);
  state.volumeRenderer.clip=Number($('volumeClip').value)/100;
  state.volumeRenderer.palette=$('volumePalette').value==='gray'?0:1;
  state.volumeRenderer.style=({original:0,relief:1,amber:2})[$('volumeStyle').value]??0;
  state.volumeRenderer.lighting=Number($('volumeLighting').value)/100;
  if(state.segMask&&state.segCount.slice(1).some(Boolean))state.volumeRenderer.setSegmentation(state.segMask,state.segVisibility);
  if(state.mixed)render();else state.volumeRenderer.draw();
  $('volumeStatus').textContent=`Volumen ${g.x} × ${g.y} × ${g.z} · ${g.spanMm.map(v=>v.toFixed(1)).join(' × ')} mm · ${(prepared.textureBytes/1048576).toFixed(1)} MiB de textura R8 · ${state.volumeRenderer.backend}`;
  toast('Volumen DESS construido a partir de los vóxeles reales · giralo arrastrando.');
 }catch(err){if(token!==state.volumeToken)return;const msg=err instanceof Error?err.message:'Error WebGL2';
  stopVolume();state.mode='2d';state.mixed=false;switchModeButtons();render();warningsDisplay([msg],[]);toast('No se pudo activar 3D: '+msg);
 }finally{if(token===state.volumeToken)$('loading').hidden=true;else $('loading').hidden=true;}
}
$('threeDButton').onclick=()=>void enableVolume(false);
$('mixedButton').onclick=()=>void enableVolume(true);
$('twoDButton').onclick=()=>{stopVolume();state.mode='2d';state.mixed=false;switchModeButtons();updateControls();render();};
for(const id of ['volumeOpacity','volumeThreshold','volumeQuality'])$(''+id).addEventListener('input',()=>{
 const r=state.volumeRenderer;if(!r)return;
 r.opacity=Number($('volumeOpacity').value)/100;
 r.threshold=Number($('volumeThreshold').value)/100;
 r.steps=Number($('volumeQuality').value);
 $('opacityReadout').textContent=$('volumeOpacity').value+'%';
 $('thresholdReadout').textContent=$('volumeThreshold').value+'%';
 r.draw();
});

// v0.3: two synchronized control surfaces for the same volume. No anatomical
// label is inferred from raw intensity or from clipping the slice axis.
function updateDepth(source){
 const value=Number(source.value);
 $('volumeClip').value=String(value);$('volumeClipHUD').value=String(value);
 $('volumeClipReadout').textContent=value+'%';$('volumeClipReadoutHUD').textContent=value+'%';
 if(state.volumeRenderer){state.volumeRenderer.clip=value/100;state.volumeRenderer.draw();}
}
for(const id of ['volumeClip','volumeClipHUD'])$(id).addEventListener('input',e=>updateDepth(e.target));
function updatePalette(source){
 const value=source.value;
 $('volumePalette').value=value;$('volumePaletteHUD').value=value;
 if(state.volumeRenderer){state.volumeRenderer.palette=value==='gray'?0:1;state.volumeRenderer.draw();}
}
for(const id of ['volumePalette','volumePaletteHUD'])$(id).addEventListener('change',e=>updatePalette(e.target));
function updateStyleControls(origin){
 const value=origin.value;
 $('volumeStyle').value=value;
 $('uxVolumeStyle').value=value;
 const r=state.volumeRenderer;
 if(r){r.style=({original:0,relief:1,amber:2})[value]??0;r.draw();}
 const note=value==='original'?'Intensidades originales en escala de visualización.':
  value==='relief'?'Relieve por gradiente de intensidad; no identifica tejidos.':
  'Preset ámbar de intensidades. No representa huesos segmentados.';
 $('volumeStyleNote').textContent=note;
 $('uxStyleNote').textContent=note;
}
for(const id of ['volumeStyle','uxVolumeStyle'])$(id).addEventListener('change',e=>updateStyleControls(e.target));
function updateLighting(origin){
 const value=Number(origin.value);
 $('volumeLighting').value=String(value);$('uxVolumeLighting').value=String(value);
 $('volumeLightingReadout').textContent=value+'%';
 $('uxVolumeLightingValue').textContent=value+'%';
 if(state.volumeRenderer){state.volumeRenderer.lighting=value/100;state.volumeRenderer.draw();}
}
for(const id of ['volumeLighting','uxVolumeLighting'])$(id).addEventListener('input',e=>updateLighting(e.target));


// Focus mode expands the DICOM canvas and collapses non-essential panels;
// fullscreen uses the standard browser Fullscreen API, never a remote Site.
function redrawExpanded(){requestAnimationFrame(()=>requestAnimationFrame(()=>render()));}
$('focusButton').onclick=()=>{
 const focused=document.body.classList.toggle('viewer-focus');
 $('focusButton').setAttribute('aria-pressed',String(focused));
 $('focusButton').textContent=focused?'Vista normal':'Visor amplio';
 redrawExpanded();
};
$('fullscreenButton').onclick=async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await $('viewerRoot').requestFullscreen();
 }catch{toast('No se pudo activar pantalla completa. Probá «Visor amplio».');}
};
$('exitFullscreenViewer').onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen();};
document.addEventListener('fullscreenchange',()=>{
 const active=Boolean(document.fullscreenElement);
 $('fullscreenButton').setAttribute('aria-pressed',String(active));
 $('fullscreenButton').textContent=active?'Salir de pantalla completa':'Pantalla completa';
 redrawExpanded();
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.body.classList.contains('viewer-focus')&&!document.fullscreenElement)
   $('focusButton').click();
});
// The canvas size can change even without a window resize (focus mode).
const viewerResize=new ResizeObserver(()=>redrawExpanded());
viewerResize.observe($('viewerRoot'));
$('volumeReset').onclick=()=>{const r=state.volumeRenderer;if(!r)return;r.yaw=.55;r.pitch=.32;r.zoom=1.55;r.draw();};
const volumeCanvas=$('volumeCanvas');
let volumeDrag=null;
volumeCanvas.addEventListener('pointerdown',e=>{if(!state.volumeRenderer)return;volumeDrag=[e.clientX,e.clientY];volumeCanvas.setPointerCapture(e.pointerId);});
volumeCanvas.addEventListener('pointermove',e=>{
 if(!volumeDrag||!state.volumeRenderer)return;
 const r=state.volumeRenderer;r.preview=true;r.yaw+=(e.clientX-volumeDrag[0])*.010;
 r.pitch=clamp(r.pitch+(e.clientY-volumeDrag[1])*.010,-1.5,1.5);
 volumeDrag=[e.clientX,e.clientY];r.draw();
});
volumeCanvas.addEventListener('pointerup',()=>{volumeDrag=null;if(state.volumeRenderer){state.volumeRenderer.preview=false;state.volumeRenderer.draw();}});
volumeCanvas.addEventListener('pointercancel',()=>{volumeDrag=null;if(state.volumeRenderer){state.volumeRenderer.preview=false;state.volumeRenderer.draw();}});
volumeCanvas.addEventListener('wheel',e=>{if(!state.volumeRenderer)return;e.preventDefault();const r=state.volumeRenderer;r.zoom=clamp(r.zoom*(e.deltaY>0?.9:1.1),.4,5);r.draw();},{passive:false});
// Existing toolbar zoom controls now serve the active canvas.
const originalIn=$('zoomIn').onclick,originalOut=$('zoomOut').onclick,originalFit=$('fitButton').onclick;
$('zoomIn').onclick=()=>{if(state.mode==='3d'){const r=state.volumeRenderer;if(r){r.zoom=clamp(r.zoom*1.2,.4,5);r.draw();}}else originalIn();};
$('zoomOut').onclick=()=>{if(state.mode==='3d'){const r=state.volumeRenderer;if(r){r.zoom=clamp(r.zoom/1.2,.4,5);r.draw();}}else originalOut();};
$('fitButton').onclick=()=>{if(state.mode==='3d')$('volumeReset').click();else originalFit();};
// Drop the GPU allocation when the page is closed.
window.addEventListener('pagehide',stopVolume);
switchModeButtons();


/* ANATHEOS v0.4 — editable mask layers. No automatic anatomical labels. */
let paintingSeg=false;
function syncMaskCounts(){
 state.segCount=state.segMask?countRegions(state.segMask):[0,0,0,0];
 $('segBuildSurface').disabled=!state.current||!state.segCount.slice(1).some(Boolean);
 for(let id=1;id<=3;id++)$('segCount'+id).textContent=state.segCount[id].toLocaleString('es-AR')+' vóxeles';
}
function maskChange(){state.segVersion++;state.segOverlayKey='';state.b7Draft=null;state.b7DraftVersion++;$('b7Accept').disabled=true;$('b7Discard').disabled=true;window.dispatchEvent(new Event('anatheos:mask-changed'));render();}
function finishPaint(){paintingSeg=false;syncMaskCounts();maskChange();$('segStatus').textContent='Marcas locales actualizadas. Su interpretación anatómica requiere revisión.';}
function pointToPixel(e){
 const frame=currentFrame();if(!frame)return null;
 const rect=canvas.getBoundingClientRect(),ratio=canvas.width/rect.width;
 const w=canvas.width,h=canvas.height;
 const fit=Math.min(w/frame.columns,h/frame.rows)*.90*state.zoom;
 const col=((e.clientX-rect.left)*ratio-w/2-state.panX*ratio)/fit+frame.columns/2;
 const row=((e.clientY-rect.top)*ratio-h/2-state.panY*ratio)/fit+frame.rows/2;
 if(col<0||col>=frame.columns||row<0||row>=frame.rows)return null;
 return [col,row];
}
function paintFromPointer(e){
 if(!state.segMask||state.mode!=='2d')return;
 const xy=pointToPixel(e);if(!xy)return;
 paintingSeg=true;
 const label=Number($('segSelected').value);
 const tool=$('segTool').value,erase=tool==='erase';
 const touched=tool==='grow'
  ? growRegion2D(state.segMask,currentFrame(),xy[0],xy[1],state.index,label,state.wlWidth*Number($('segTolerance').value)/100,Number($('segGrowRadius').value))
  : paintDisk(state.segMask,xy[0],xy[1],state.index,Number($('segRadius').value),label,erase,Number($('segSlices').value));
 if(tool==='grow') {syncMaskCounts();paintingSeg=false;}
 if(touched){state.segCount[label]=Math.max(1,state.segCount[label]);maskChange();}
}
$('segEdit').addEventListener('change',e=>{
 state.segEdit=e.target.checked;
 if(state.segEdit&&state.mode==='3d'){$('twoDButton').click();}
 canvas.classList.toggle('seg-paint-active',state.segEdit);
 $('segStatus').textContent=state.segEdit?'Editor manual activo: arrastrá sobre el corte. Desactivá para desplazarte.':'Editor desactivado; arrastrar desplaza el corte.';
});
$('segTolerance').addEventListener('input',e=>$('segToleranceOut').textContent=e.target.value+'%');
$('segGrowRadius').addEventListener('input',e=>$('segGrowRadiusOut').textContent=e.target.value+' px');
$('segRadius').addEventListener('input',e=>$('segRadiusOut').textContent=e.target.value+' px');
for(let i=1;i<=3;i++)$('segVisible'+i).addEventListener('change',()=>{
 state.segVisibility=0;
 for(let j=1;j<=3;j++)if($('segVisible'+j).checked)state.segVisibility|=1<<(j-1);
 state.segOverlayKey='';
 if(state.volumeRenderer){state.volumeRenderer.labelVisibility=state.segVisibility;state.volumeRenderer.draw();}
 else render();
});
$('segClearLayer').onclick=()=>{
 if(!state.segMask)return;
 const label=Number($('segSelected').value);
 if(state.segCount[label]>0&&!confirm('¿Vaciar todas las marcas de la región '+label+'?'))return;
 eraseRegion(state.segMask,label);syncMaskCounts();maskChange();
};
$('segClearAll').onclick=()=>{
 if(!state.segMask)return;
 if(state.segCount.slice(1).some(Boolean)&&!confirm('¿Vaciar TODAS las regiones marcadas?'))return;
 state.segMask.data.fill(0);syncMaskCounts();maskChange();
};
$('segSave').onclick=()=>{
 if(!state.segMask||!state.current)return;
 try{
  const bytes=toNrrd(state.segMask,state.current),blob=new Blob([bytes],{type:'application/octet-stream'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
  a.download='ANATHEOS_regiones_manual_'+state.segMask.x+'x'+state.segMask.y+'x'+state.segMask.z+'.nrrd';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),6000);
  $('segStatus').textContent='Máscara NRRD guardada en tu equipo; nunca se transmitió.';
 }catch{$('segStatus').textContent='Error al preparar la máscara NRRD.';}
};
$('segOpen').onclick=()=>$('segFile').click();
$('segFile').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||!state.segMask||!state.current)return;
 try{
  if(file.size>110*1024*1024)throw Error('Archivo demasiado grande');
  const counts=fromNrrd(await file.arrayBuffer(),state.segMask,state.current);
  state.segCount=counts;syncMaskCounts();maskChange();
  $('segStatus').textContent='Máscara NRRD recuperada; dimensiones y geometría verificadas.';
 }catch(err){$('segStatus').textContent='Máscara rechazada: '+(err.message||'archivo inválido');}
};
// B7.1: local proposal first, explicit acceptance second, never replacing unrelated labels.
$('b7PickSeed').addEventListener('click',()=>{
 if(!state.current)return;
 if(state.mode==='3d')$('twoDButton').click();
 if(state.segEdit){$('segEdit').checked=false;state.segEdit=false;canvas.classList.remove('seg-paint-active');}
 state.b7Seed=null;$('b7Propose').disabled=true;invalidateB7Draft('Nueva selección de semilla: propuesta anterior descartada.');
 state.b7Picking=true;$('b7Status').textContent='Hacé clic sobre un punto del corte DICOM para colocar la semilla.';
});
function invalidateB7Draft(reason){
 state.b7Draft=null;state.b7DraftVersion++;$('b7Accept').disabled=true;$('b7Discard').disabled=true;
 if(reason)$('b7Status').textContent=reason;render();
}
for(const [id,out,unit] of [['b7Tolerance','b7ToleranceOut',''],['b7Radius','b7RadiusOut',' mm']]){
 $(id).addEventListener('input',()=>{$(out).textContent=$(id).value+unit;
  invalidateB7Draft('Parámetros cambiados. Prepará nuevamente para revisar antes de aceptar.');});
}
$('b7Propose').addEventListener('click',async()=>{
 if(!state.current||!state.b7Seed)return;
 const generation=state.loadGeneration,version=state.segVersion,series=state.current;
 $('b7Propose').disabled=true;
 $('b7Status').textContent='Calculando región conectada 3D desde intensidades DICOM originales…';
 await yieldUI();
 try{
  const proposal=proposeConnected3D(series,{...state.b7Seed,tolerance:Number($('b7Tolerance').value),radiusMm:Number($('b7Radius').value)});
  if(generation!==state.loadGeneration||version!==state.segVersion||state.current!==series)
   throw Error('El estudio o la máscara cambiaron. Volvé a elegir semilla.');
  state.b7Draft=proposal;state.b7DraftVersion++;b7OverlayKey='';
  $('b7Accept').disabled=false;$('b7Discard').disabled=false;
  $('b7Status').textContent=proposal.count.toLocaleString('es-AR')+' vóxeles conectados · intensidades '+proposal.intensityMin.toFixed(1)+' a '+proposal.intensityMax.toFixed(1)+'. '+(proposal.touchesRadius?'Advertencia: alcanza el límite del radio. ':'')+'Revisá la previsualización CIAN en distintos cortes antes de aceptar.';
  render();
 }catch(e){invalidateB7Draft('Propuesta rechazada: '+e.message);}
 finally{$('b7Propose').disabled=!state.current||!state.b7Seed;}
});
$('b7Discard').addEventListener('click',()=>invalidateB7Draft('Propuesta descartada sin modificar la máscara DICOM.'));
$('b7Accept').addEventListener('click',()=>{
 const draft=state.b7Draft;
 if(!state.current||!state.segMask||!draft)return;
 try{
  const report=acceptConnected3D(state.segMask,draft,Number($('segSelected').value));
  state.b7Seed=null;$('b7SeedStatus').textContent='Sin semilla seleccionada.';
  $('b7Propose').disabled=true;
  syncMaskCounts();maskChange();
  $('b7Status').textContent='Aplicados '+report.added.toLocaleString('es-AR')+' vóxeles a la región seleccionada; '+report.skipped+' ya pertenecían a otras regiones (no modificados). Máscara aún SIN validar anatómicamente.';
  if(state.segCount.slice(1).some(Boolean))$('segBuildSurface').click();
 }catch(e){$('b7Status').textContent='No se aplicó: '+e.message;}
});
$('segMeshMethod').addEventListener('change',()=>{
 const continuous=$('segMeshMethod').value==='continuous';
 $('segMeshSoftness').disabled=!continuous;
 $('segMeshMethodNote').textContent=continuous
  ?'Isosuperficie de máscara del MISMO estudio; interpolación geométrica conservadora, SIN segmentación automática. Puede modificar detalles finos.'
  :'B6.1: bordes rectangulares exactos de vóxeles; no interpola geometría.';
});
$('segMeshSoftness').addEventListener('input',()=>{
 $('segMeshSoftnessValue').textContent=$('segMeshSoftness').value+'%';
});
$('segBuildSurface').addEventListener('click',async()=>{
 if(!state.current||!state.segMask||!state.segCount.slice(1).some(Boolean)){
  $('segMeshStatus').textContent='Sin regiones pintadas ni NRRD válida para el estudio actual.';return;
 }
 $('segBuildSurface').disabled=true;
 $('segMeshStatus').textContent='Comprobando geometría DICOM y construyendo superficies físicas LPS…';
 await yieldUI();
 try{
  const method=$('segMeshMethod').value;
  const meshes=method==='continuous'
   ?makeContinuousMaskSTLs(state.segMask,state.current,{soften:Number($('segMeshSoftness').value)/100})
   :makeMaskSurfaceSTLs(state.segMask,state.current);
  const id=(state.current.uid||'serie-sin-uid')+'|'+state.loadGeneration;
  const accepted=window.dispatchEvent(new CustomEvent('anatheos:show-same-study-surfaces',{
   detail:{meshes,studyId:id,segVersion:state.segVersion},cancelable:true
  }));
  if(!accepted)throw Error('El visor de superficies rechazó el cambio; revisá la escena existente.');
  $('segMeshStatus').textContent=meshes.length+' regiones de la MISMA serie · '+(method==='continuous'?'isosuperficie continua B6.2':'voxel B6.1')+' · '+meshes.reduce((n,m)=>n+m.triangles,0).toLocaleString('es-AR')+' triángulos LPS mm. ANATOMÍA SIN validar.';
 }catch(e){$('segMeshStatus').textContent='No se generó superficie: '+e.message;}
 finally{$('segBuildSurface').disabled=!state.current||!state.segCount.slice(1).some(Boolean);}
});
// Regions are generated solely from the in-memory labelmap currently bound to
// state.current, never from external SPL assets or synthesized anatomy.
// Detach annotations and renderer when an unrelated series is loaded.
const clearOldStatus=clean;
// The owning clean() above clears mask references before new DICOM records are read.
