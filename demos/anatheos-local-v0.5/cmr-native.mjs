/** ANATHEOS CMR-W1 · Native, locally imported 2D/cine module.
 * Clinical datasets never leave the host. Native DICOM module remains untouched.
 * The primary flow imports the original ZIP through the loopback-only W1 service.
 * The prepared-folder picker remains as an explicit QA/recovery fallback.
 */
import {eligibility} from './spatial-reference.mjs';
import {createWorkspace} from './spatial-workspace.mjs';
const byId=id=>document.getElementById(id);
function require(condition,reason){if(!condition)throw Error(reason);}
function decodeNpy(buffer){
 const d=new DataView(buffer);require(buffer.byteLength>16&&[147,78,85,77,80,89].every((b,i)=>d.getUint8(i)===b),'NPY sin firma');
 const version=d.getUint8(6);require(version===1||version===2,'Versión NPY incompatible');
 const offset=version===1?10:12, n=version===1?d.getUint16(8,true):d.getUint32(8,true);
 require(n<10000&&offset+n<buffer.byteLength,'Cabecera NPY incorrecta');
 const h=new TextDecoder('ascii',{fatal:true}).decode(new Uint8Array(buffer,offset,n));
 require(/['"]descr['"]\s*:\s*['"]<u2['"]/.test(h)&&/['"]fortran_order['"]\s*:\s*False/.test(h),'NPY requiere uint16 little endian');
 const m=h.match(/['"]shape['"]\s*:\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/);require(m,'Matriz de fotogramas incompatible');
 const dims=m.slice(1).map(Number),count=dims.reduce((x,y)=>x*y,1),start=offset+n;
 require(Number.isSafeInteger(count)&&count>0&&count<170000000&&start%2===0&&start+count*2===buffer.byteLength,'Longitud NPY incompatible');
 return {dims,pixels:new Uint16Array(buffer,start,count)};
}
const position=f=>{
 const a=f?.image_orientation_patient_LPS,p=f?.image_position_patient_LPS_mm;
 if(!Array.isArray(a)||a.length!==6||!Array.isArray(p)||p.length!==3)return null;
 const [r1,r2,r3,c1,c2,c3]=a.map(Number),n=[r2*c3-r3*c2,r3*c1-r1*c3,r1*c2-r2*c1];
 const v=p.reduce((s,x,i)=>s+Number(x)*n[i],0);return Number.isFinite(v)?v:null;
};
const orientation=f=>Array.isArray(f?.image_orientation_patient_LPS)&&f.image_orientation_patient_LPS.length===6?
 f.image_orientation_patient_LPS.map(x=>Number(x).toFixed(3)).join(','):'sin_orientacion';
const anatomical=f=>{
 const a=f?.image_orientation_patient_LPS;if(!Array.isArray(a)||a.length!==6)return 'Sin orientación';
 const [r1,r2,r3,c1,c2,c3]=a.map(Number),n=[Math.abs(r2*c3-r3*c2),Math.abs(r3*c1-r1*c3),Math.abs(r1*c2-r2*c1)],i=n.indexOf(Math.max(...n));
 return n[i]>=.94?['Sagital','Coronal','Axial'][i]:'Oblicua';
};
function organize(frames){
 const byOri=new Map();
 frames.forEach((f,i)=>{
  const key=orientation(f);if(!byOri.has(key))byOri.set(key,{label:anatomical(f),positionMap:new Map()});
  const group=byOri.get(key),pos=position(f),pk=pos===null?'unknown':pos.toFixed(2);
  if(!group.positionMap.has(pk))group.positionMap.set(pk,{pos,indices:[]});group.positionMap.get(pk).indices.push(i);
 });
 return [...byOri.values()].map(g=>({label:g.label,planes:[...g.positionMap.values()].sort((a,b)=>(a.pos??0)-(b.pos??0)).map(p=>{
  const key=i=>frames[i].temporal_position_identifier??frames[i].trigger_time_ms??frames[i].instance_number??i;
  p.indices.sort((a,b)=>Number(key(a))-Number(key(b))||a-b);return p;
 })}));
}
function start(){
 if(!byId('zipButton')||!byId('viewerRoot'))return;
 const zipOpen=document.createElement('button');zipOpen.type='button';zipOpen.id='cmrNativeZipOpen';zipOpen.className='primary';zipOpen.textContent='RM cardíaca · Abrir ZIP DICOM original';
 const open=document.createElement('button');open.type='button';open.id='cmrNativeOpen';open.className='secondary';open.textContent='Recuperación · Abrir carpeta ya preparada';
 const mount=byId('zipButton').parentElement;mount.insertAdjacentElement('afterend',zipOpen);zipOpen.insertAdjacentElement('afterend',open);
 const zipPicker=document.createElement('input');zipPicker.type='file';zipPicker.accept='.zip,application/zip';zipPicker.id='cmrNativeZip';zipPicker.hidden=true;open.insertAdjacentElement('afterend',zipPicker);
 const picker=document.createElement('input');picker.type='file';picker.multiple=true;picker.setAttribute('webkitdirectory','');picker.id='cmrNativeFolder';picker.hidden=true;open.insertAdjacentElement('afterend',picker);
 const section=document.createElement('section');section.id='cmrNativePanel';section.hidden=true;section.className='cmr-native';
 section.innerHTML=`<div class="cmr-native-main"><div class="cmr-native-image"><canvas id="cmrNativeCanvas" aria-label="Imagen cardíaca original decodificada"></canvas></div><div class="cmr-native-toolbar"><label>Ampliación <output id="cmrNativeZoomText">Ajustar</output><input id="cmrNativeZoom" type="range" min="100" max="400" step="25" value="100"></label><button id="cmrNativeFull" type="button">Pantalla completa</button></div></div><aside class="cmr-native-controls"><div class="cmr-native-head"><strong>RM cardíaca · ANATHEOS</strong><button id="cmrNativeClose" type="button">Cerrar vista</button></div><p class="cmr-native-disclaimer">Imágenes originales procesadas únicamente en el servidor local de esta computadora. Navegación exploratoria, no diagnóstica. Sin 3D/4D validado.</p><label>Serie<select id="cmrNativeSeries"></select></label><label id="cmrNativeOriLabel">Orientación<select id="cmrNativeOri"></select></label><label>Posición / corte <output id="cmrNativePlaneText"></output><input type="range" id="cmrNativePlane" min="0" max="0" value="0"></label><label>Fotograma / fase / contraste <output id="cmrNativePhaseText"></output><input type="range" id="cmrNativePhase" min="0" max="0" value="0"></label><div class="cmr-native-actions"><button id="cmrNativePlay" type="button" disabled>Reproducir</button><button id="cmrNativeWindow" type="button">Ventana automática</button><button id="cmrNativeCancel" type="button" hidden>Cancelar importación</button></div><p id="cmrNativeStatus" role="status">Seleccioná el ZIP DICOM original. La importación no sale de esta computadora.</p></aside>`;
 byId('viewerRoot').appendChild(section);
 const analysis=document.createElement('details');analysis.id='cmrReconstructionAnalysis';const title=document.createElement('summary');title.textContent='Análisis de reconstrucción';const report=document.createElement('p');analysis.append(title,report);section.querySelector('.cmr-native-controls').append(analysis);
 const $=id=>byId(id),canvas=$('cmrNativeCanvas'),ctx=canvas.getContext('2d');
 let catalog=null,files=new Map(),source=null,jobId=null,decoded=null,geometry=null,orientations=[],active=null,interval=null,pollAbort=null;
 function stop(){if(interval!==null){clearInterval(interval);interval=null;}}
 function setStatus(x){$('cmrNativeStatus').textContent=x;}
 async function discardJob(){const id=jobId;jobId=null;if(!id)return;try{await fetch(`/api/cmr/jobs/${encodeURIComponent(id)}`,{method:'DELETE'});}catch(_){}}
 function resetStudy(){stop();catalog=null;files=new Map();source=null;decoded=null;geometry=null;orientations=[];active=null;}
 function close(){if(pollAbort)pollAbort.abort();pollAbort=null;discardJob();resetStudy();section.hidden=true;}
 function locate(f){const path=String(f.webkitRelativePath||f.name).replaceAll('\\','/');const match=path.match(/(?:^|\/)(RM-\d{3})\/(geometria_privada\.json|pixels_original_decoded\.npy)$/);if(match)return `${match[1]}/${match[2]}`;if(path.endsWith('/catalogo_local_privado.json')||path==='catalogo_local_privado.json')return 'catalogo_local_privado.json';return null;}
 async function activateCatalog(nextCatalog,nextSource){
  catalog=nextCatalog;source=nextSource;require(catalog.schema==='anatheos-cmr-r2-private-v1'&&Array.isArray(catalog.series)&&catalog.series.length<=1000,'Catálogo incompatible');
  const sel=$('cmrNativeSeries');sel.textContent='';
  for(const s of catalog.series){if(!/^RM-\d{3}$/.test(s.serie_local))continue;const o=document.createElement('option');o.value=s.serie_local;o.textContent=`${s.serie_local} · ${s.familia_probable||'Serie'} (${s.instancias})`;o.disabled=s.estado!=='preparada';sel.appendChild(o);}
  const eligible=catalog.series.find(s=>s.estado==='preparada');require(eligible,'No hay series preparadas');sel.value=eligible.serie_local;section.hidden=false;await selectSeries();
 }
 async function ingest(fs){await discardJob();resetStudy();files=new Map();
  for(const f of fs){const key=locate(f);if(key&&!files.has(key))files.set(key,f);}
  const c=files.get('catalogo_local_privado.json');require(c,'No se encontró catálogo CMR-R2 en la carpeta seleccionada');
  await activateCatalog(JSON.parse(await c.text()),{text:key=>files.get(key)?.text(),buffer:key=>files.get(key)?.arrayBuffer()});
 }
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function importZip(file){
  require(file&&file.name.toLowerCase().endsWith('.zip'),'Seleccioná un archivo ZIP');
  await discardJob();resetStudy();section.hidden=false;$('cmrNativeCancel').hidden=false;zipOpen.disabled=true;pollAbort=new AbortController();
  setStatus('Copiando el ZIP al procesador local…');
  const created=await fetch('/api/cmr/jobs',{method:'POST',headers:{'Content-Type':'application/zip'},body:file,signal:pollAbort.signal});
  if(!created.ok)throw Error(await created.text()||'El servidor local rechazó el ZIP');
  const first=await created.json();jobId=first.job_id;require(/^[a-f0-9]{32}$/.test(jobId),'Respuesta local inválida');
  for(;;){
   const response=await fetch(`/api/cmr/jobs/${jobId}`,{cache:'no-store',signal:pollAbort.signal});require(response.ok,'No se pudo consultar la importación local');
   const status=await response.json();setStatus(`${status.message||'Procesando estudio…'}${Number.isFinite(status.progress)?` · ${status.progress}%`:''}`);
   if(status.state==='ready')break;
   if(status.state==='failed'||status.state==='cancelled')throw Error(status.error||'La importación no pudo completarse');
   await wait(250);
  }
  source={
   text:async key=>{const r=await fetch(`/api/cmr/jobs/${jobId}/data/${key}`,{cache:'no-store'});require(r.ok,'Falta un archivo preparado');return r.text();},
   buffer:async key=>{const r=await fetch(`/api/cmr/jobs/${jobId}/data/${key}`,{cache:'no-store'});require(r.ok,'Falta un archivo preparado');return r.arrayBuffer();}
  };
  const raw=await source.text('catalogo_local_privado.json');await activateCatalog(JSON.parse(raw),source);
 }
 function currentGroup(){return orientations[Number($('cmrNativeOri').value)]?.planes||[];}
 function currentFrameIndex(){const plane=currentGroup()[Number($('cmrNativePlane').value)];return plane?.indices[Number($('cmrNativePhase').value)]??0;}
 function frameWindow(){const k=currentFrameIndex(),[n,h,w]=decoded.dims,offset=k*h*w;let lo=65535,hi=0;for(let i=offset;i<offset+h*w;i+=7){const x=decoded.pixels[i];lo=Math.min(lo,x);hi=Math.max(hi,x);}return [lo,Math.max(1,hi-lo)];}
 let win=[0,4096];
 function render(){if(!decoded||!geometry)return;
  const [n,h,w]=decoded.dims,k=currentFrameIndex(),off=k*h*w;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const image=ctx.createImageData(w,h),[lo,width]=win,invert=geometry.frames[k]?.photometric_interpretation==='MONOCHROME1';
  for(let i=0;i<w*h;i++){const v=Math.max(0,Math.min(255,Math.round((decoded.pixels[off+i]-lo)*255/width))),a=invert?255-v:v,o=i*4;image.data[o]=a;image.data[o+1]=a;image.data[o+2]=a;image.data[o+3]=255;}
  ctx.putImageData(image,0,0);
  const planes=currentGroup(),frameCount=planes[Number($('cmrNativePlane').value)]?.indices.length||1;
  $('cmrNativePlaneText').textContent=`${Number($('cmrNativePlane').value)+1}/${planes.length}`;
  $('cmrNativePhaseText').textContent=`${Number($('cmrNativePhase').value)+1}/${frameCount}`;
  setStatus(`${active?.serie_local} · ${w} × ${h} · orientación ${Number($('cmrNativeOri').value)+1}/${orientations.length} · no diagnóstico`);
 }
 function positionChange(){const group=currentGroup();$('cmrNativePlane').max=String(Math.max(0,group.length-1));$('cmrNativePlane').value='0';phaseChange();}
 function phaseChange(){const group=currentGroup(),frames=group[Number($('cmrNativePlane').value)]?.indices||[];$('cmrNativePhase').max=String(Math.max(0,frames.length-1));$('cmrNativePhase').value='0';win=frameWindow();render();}
 async function selectSeries(){stop();const id=$('cmrNativeSeries').value;active=catalog.series.find(s=>s.serie_local===id);require(active?.estado==='preparada','Serie no preparada');
  require(source,'No hay una fuente local activa');const g=JSON.parse(await source.text(`${id}/geometria_privada.json`)),d=decodeNpy(await source.buffer(`${id}/pixels_original_decoded.npy`));require(g.serie_local===id&&g.frames?.length===d.dims[0]&&d.dims[0]===active.instancias,'Geometría y píxeles no corresponden');
  geometry=g;decoded=d;orientations=organize(g.frames);
  let comparison=section.querySelector('#cmrSpatialCompare');if(!comparison){comparison=document.createElement('details');comparison.id='cmrSpatialCompare';const summary=document.createElement('summary');summary.textContent='Comparar orientaciones · misma serie';comparison.append(summary);section.querySelector('.cmr-native-main').append(comparison);}comparison.querySelectorAll('div').forEach(x=>x.remove());const space=document.createElement('div');comparison.append(space);createWorkspace(space,d,g.frames,orientations);
  const assessment=eligibility(g.frames,d.dims[1],d.dims[2]);
  report.textContent=`${catalog.series.length} series identificadas. Serie activa: ${assessment.groups.length} grupos geométricos. A: imágenes originales. B: planos con geometría disponible. ${assessment.temporal}. Modelos derivados: requieren máscaras verificadas. `+assessment.groups.map((x,i)=>`Grupo ${i+1}: ${x.indices.length} imágenes; ${x.reasons.join('; ')}.`).join(' ');
  const ori=$('cmrNativeOri');ori.textContent='';orientations.forEach((group,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${group.label} · orientación ${i+1} (${group.planes.length} posiciones)`;ori.appendChild(o)});
  $('cmrNativeOriLabel').hidden=orientations.length<=1;ori.value='0';positionChange();
  $('cmrNativePlay').disabled=!['cine_provisional','perfusion_temporal'].includes(active.modo_seguro)||!orientations.some(x=>x.planes.some(p=>p.indices.length>1));
 }
 picker.addEventListener('change',async()=>{try{await ingest([...picker.files]);}catch(e){section.hidden=false;setStatus('No se pudo abrir la carpeta CMR: '+e.message);}finally{picker.value='';}});
 zipPicker.addEventListener('change',async()=>{try{await importZip(zipPicker.files[0]);}catch(e){await discardJob();resetStudy();section.hidden=false;if(e.name!=='AbortError')setStatus('No se pudo importar el ZIP: '+e.message);}finally{zipPicker.value='';zipOpen.disabled=false;$('cmrNativeCancel').hidden=true;pollAbort=null;}});
 zipOpen.addEventListener('click',()=>zipPicker.click());open.addEventListener('click',()=>picker.click());$('cmrNativeClose').addEventListener('click',close);
 $('cmrNativeCancel').addEventListener('click',()=>{if(pollAbort)pollAbort.abort();pollAbort=null;discardJob();resetStudy();$('cmrNativeCancel').hidden=true;zipOpen.disabled=false;setStatus('Importación cancelada; los temporales locales fueron descartados.');});
 $('cmrNativeSeries').addEventListener('change',async()=>{try{await selectSeries()}catch(e){setStatus(e.message)}});
 $('cmrNativeOri').addEventListener('change',()=>{stop();positionChange();});
 $('cmrNativePlane').addEventListener('input',()=>{stop();phaseChange();});
 $('cmrNativePhase').addEventListener('input',render);
 $('cmrNativeWindow').addEventListener('click',()=>{win=frameWindow();render();});
 $('cmrNativeZoom').addEventListener('input',()=>{const z=Number($('cmrNativeZoom').value);canvas.style.setProperty('--cmr-native-zoom',String(z/100));$('cmrNativeZoomText').textContent=z===100?'Ajustar':z+' %';});
 $('cmrNativeFull').addEventListener('click',()=>{const box=section.querySelector('.cmr-native-main');if(document.fullscreenElement)document.exitFullscreen();else box.requestFullscreen?.();});
 $('cmrNativePlay').addEventListener('click',()=>{if(interval!==null){stop();return;}if($('cmrNativePlay').disabled)return;const g=currentGroup()[Number($('cmrNativePlane').value)];if(g?.indices.length<=1)return;interval=setInterval(()=>{$('cmrNativePhase').value=(Number($('cmrNativePhase').value)+1)%g.indices.length;render();},120);});
 fetch('/api/cmr/capabilities',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(c=>{require(c.original_zip&&c.local_only,'Servicio W1 incompatible')}).catch(()=>{zipOpen.disabled=true;zipOpen.title='Iniciá ANATHEOS con el servicio local W1 para abrir el ZIP original';});
 window.addEventListener('pagehide',stop);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
