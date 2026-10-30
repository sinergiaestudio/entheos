'use strict';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let catalog=null,meta=null,shape=null,pixels=null,groups=[],current=null,timer=null,loadSerial=0;
function status(x){$('status').textContent=x}
function stop(){if(timer!==null){clearInterval(timer);timer=null;}}
function npy(buf){
 const d=new DataView(buf),magic=[147,78,85,77,80,89];if(!magic.every((v,i)=>d.getUint8(i)===v))throw Error('NPY sin firma válida');
 const v=d.getUint8(6),minor=d.getUint8(7);if(![1,2].includes(v))throw Error('NPY versión no admitida');
 const length=v===1?d.getUint16(8,true):d.getUint32(8,true),p=v===1?10:12;
 if(length>10000||p+length>buf.byteLength)throw Error('Cabecera NPY no segura');
 const h=new TextDecoder('ascii',{fatal:true}).decode(new Uint8Array(buf,p,length));
 if(!/['"]descr['"]\s*:\s*['"]<u2['"]/.test(h)||!/['"]fortran_order['"]\s*:\s*False/.test(h))throw Error('Se exige uint16 little-endian continuo');
 const m=h.match(/['"]shape['"]\s*:\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/);if(!m)throw Error('NPY debe ser tridimensional [imagen, fila, columna]');
 const shape=m.slice(1).map(Number),count=shape.reduce((a,b)=>a*b,1),offset=p+length;
 if(!Number.isSafeInteger(count)||count>200000000||offset%2!==0||count*2+offset!==buf.byteLength)throw Error('Tamaño NPY inválido');
 return {shape,pixels:new Uint16Array(buf,offset,count)};
}
function projection(f){const a=f.image_orientation_patient_LPS,b=f.image_position_patient_LPS_mm;
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==6||b.length!==3)return null;
 const n=[a[1]*a[5]-a[2]*a[4],a[2]*a[3]-a[0]*a[5],a[0]*a[4]-a[1]*a[3]];
 const x=n[0]*b[0]+n[1]*b[1]+n[2]*b[2];return Number.isFinite(x)?x:null;
}
function regroup(){
 const map=new Map();meta.frames.forEach((f,i)=>{
  const projectionMM=projection(f),o=Array.isArray(f.image_orientation_patient_LPS)?f.image_orientation_patient_LPS:[];
  const key=(projectionMM===null?'sin':projectionMM.toFixed(2))+'|'+o.map(x=>Number(x).toFixed(4)).join(',');
  if(!map.has(key))map.set(key,{position:projectionMM,indices:[]});map.get(key).indices.push(i);
 });
 groups=[...map.values()].sort((a,b)=>(a.position??0)-(b.position??0));
 for(const g of groups)g.indices.sort((a,b)=>{
  const x=meta.frames[a],y=meta.frames[b];
  const time=(f)=>Number.isFinite(Number(f.temporal_position_identifier))?Number(f.temporal_position_identifier):null;
  const tx=time(x),ty=time(y);if(tx!==null&&ty!==null&&tx!==ty)return tx-ty;
  const dx=Number(x.trigger_time_ms),dy=Number(y.trigger_time_ms);if(Number.isFinite(dx)&&Number.isFinite(dy)&&dx!==dy)return dx-dy;
  return Number(x.instance_number||0)-Number(y.instance_number||0);
 });
 $('plane').max=Math.max(0,groups.length-1);$('plane').value=0;rangeForPhase();
}
function rangeForPhase(){const g=groups[Number($('plane').value)];$('phase').max=Math.max(0,(g?.indices.length||1)-1);$('phase').value=0;render();}
function selectedIndex(){return groups[Number($('plane').value)]?.indices[Number($('phase').value)]??0;}
function autoWindow(){if(!pixels||!shape)return;const k=selectedIndex(),offset=k*shape[1]*shape[2],length=shape[1]*shape[2];
 let lo=65535,hi=0;for(let i=0;i<length;i+=3){const v=pixels[offset+i];lo=Math.min(lo,v);hi=Math.max(hi,v)}
 $('center').value=Math.max(0,Math.min(65535,Math.round((lo+hi)/2)));$('width').value=Math.max(1,Math.min(65535,hi-lo));
}
function render(){if(!meta||!pixels||!shape)return;
 const frame=selectedIndex(),w=shape[2],h=shape[1];if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 const center=Number($('center').value),width=Math.max(1,Number($('width').value)),low=center-width/2,im=ctx.createImageData(w,h);
 const off=frame*w*h,invert=meta.frames[frame]?.photometric_interpretation==='MONOCHROME1';
 for(let i=0;i<w*h;i++){const n=Math.max(0,Math.min(255,Math.round((pixels[off+i]-low)*255/width)));const val=invert?255-n:n,j=i*4;im.data[j]=val;im.data[j+1]=val;im.data[j+2]=val;im.data[j+3]=255}
 ctx.putImageData(im,0,0);canvas.style.display='block';$('empty').style.display='none';
 const g=groups[Number($('plane').value)];$('planeInfo').textContent=`Plano ${Number($('plane').value)+1}/${groups.length} · posición ${g?.position?.toFixed(2)??'no disponible'} mm`;
 const mode=current?.modo_seguro||'no_verificado';$('phaseInfo').textContent=`Imagen ${Number($('phase').value)+1}/${g?.indices.length||1} · modo ${mode}`;
 $('centerN').textContent=String(center);$('widthN').textContent=String(width);
 status(`${current.serie_local} · ${w} × ${h} · imagen ${frame+1}/${shape[0]} · sin interpolación ni diagnóstico.`);
}
async function loadSeries(){
 stop();const ticket=++loadSerial,id=$('serie').value;current=catalog?.series.find(x=>x.serie_local===id)||null;
 meta=null;pixels=null;shape=null;canvas.style.display='none';$('empty').style.display='block';
 if(!current){$('empty').textContent='Seleccioná una serie del catálogo.';$('summary').textContent='';return}
 if(current.estado!=='preparada'){status('Serie bloqueada: falta completar preparación local.');return}
 $('empty').textContent='Leyendo datos médicos desde 127.0.0.1…';status('Abriendo '+id);
 try{
  const [r1,r2]=await Promise.all([fetch(`${id}/geometria_privada.json`,{cache:'no-store'}),fetch(`${id}/pixels_original_decoded.npy`,{cache:'no-store'})]);
  if(!r1.ok||!r2.ok)throw Error('Faltan derivados privados de esta serie');
  const metadata=await r1.json(),raw=await r2.arrayBuffer();if(ticket!==loadSerial)return;
  const decoded=npy(raw);if(metadata.serie_local!==id||metadata.frames?.length!==decoded.shape[0])throw Error('No corresponden geometría y matriz de imágenes');
  meta=metadata;shape=decoded.shape;pixels=decoded.pixels;regroup();autoWindow();render();
  const candidate=current.modo_seguro||'revisión';
  $('summary').textContent=`${current.serie_local} · ${current.familia_probable.replaceAll('_',' ')}\n${current.instancias} imágenes · ${candidate.replaceAll('_',' ')}`;
  const canPlay=['cine_provisional','perfusion_temporal'].includes(candidate);
  $('play').disabled=!canPlay||!groups.some(x=>x.indices.length>1);
  $('banner').textContent=canPlay?'Secuencia temporal: reproducir no equivale a sincronización clínica validada.':
    'No se presume cine ni volumen 3D; estas imágenes pueden ser contrastes, planos o tiempos diferentes.';
 }catch(e){if(ticket!==loadSerial)return;pixels=null;status('No se pudo abrir: '+e.message);$('empty').textContent='La serie no está disponible o no pasó los controles';}
}
async function boot(){try{
 const res=await fetch('catalogo_local_privado.json',{cache:'no-store'});if(!res.ok)throw Error('No se encontró catálogo privado R2');
 const data=await res.json();if(data.schema!=='anatheos-cmr-r2-private-v1'||!Array.isArray(data.series))throw Error('Catálogo incompatible');
 catalog=data;const option=$('serie');option.textContent='';const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=`Seleccionar entre ${data.series.length} series…`;option.appendChild(placeholder);
 for(const s of data.series){if(!/^RM-\d{3}$/.test(s.serie_local))continue;const opt=document.createElement('option');opt.value=s.serie_local;opt.textContent=`${s.serie_local} · ${String(s.familia_probable||'').replaceAll('_',' ')} (${s.instancias})${s.estado==='preparada'?'':' · BLOQUEADA'}`;opt.disabled=s.estado!=='preparada';option.appendChild(opt)}
 $('empty').textContent='Elegí una serie. Las 24 no se combinan entre sí.';
 $('summary').textContent=`${data.series_preparadas}/${data.series_detectadas} series preparadas · ${data.instancias_preparadas} imágenes.\nLos derivados y los metadatos están en esta computadora.`;
 }catch(e){$('serie').textContent='';status('Catálogo no disponible: '+e.message);$('empty').textContent='Prepará las 24 series y abrí con INICIAR_VISOR_24_WINDOWS.cmd';}}
$('serie').addEventListener('change',loadSeries);
$('plane').addEventListener('input',()=>{stop();rangeForPhase();autoWindow();render()});
$('phase').addEventListener('input',()=>{autoWindow();render()});
for(const k of ['center','width'])$(k).addEventListener('input',render);
$('auto').addEventListener('click',()=>{autoWindow();render()});
$('play').addEventListener('click',()=>{if(timer!==null){stop();return}if($('play').disabled)return;const g=groups[Number($('plane').value)];if(!g||g.indices.length<2)return;timer=setInterval(()=>{$('phase').value=(Number($('phase').value)+1)%g.indices.length;render()},120)});
window.addEventListener('pagehide',stop);
boot();