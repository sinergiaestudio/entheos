/** ANATHEOS CMR-R3 · Native, locally imported 2D/cine module.
 * Clinical datasets never leave the host. Native DICOM module remains untouched.
 * Private CMR-R2 folders only; source JPEG2000 import is a separate future gate.
 */
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
 const open=document.createElement('button');open.type='button';open.id='cmrNativeOpen';open.className='secondary';open.textContent='RM cardíaca · Abrir estudio preparado';
 const mount=byId('zipButton').parentElement;mount.insertAdjacentElement('afterend',open);
 const picker=document.createElement('input');picker.type='file';picker.multiple=true;picker.setAttribute('webkitdirectory','');picker.id='cmrNativeFolder';picker.hidden=true;open.insertAdjacentElement('afterend',picker);
 const section=document.createElement('section');section.id='cmrNativePanel';section.hidden=true;section.className='cmr-native';
 section.innerHTML=`<div class="cmr-native-main"><div class="cmr-native-image"><canvas id="cmrNativeCanvas" aria-label="Imagen cardíaca original decodificada"></canvas></div><div class="cmr-native-toolbar"><label>Ampliación <output id="cmrNativeZoomText">Ajustar</output><input id="cmrNativeZoom" type="range" min="100" max="400" step="25" value="100"></label><button id="cmrNativeFull" type="button">Pantalla completa</button></div></div><aside class="cmr-native-controls"><div class="cmr-native-head"><strong>RM cardíaca · ANATHEOS</strong><button id="cmrNativeClose" type="button">Cerrar vista</button></div><p class="cmr-native-disclaimer">Imágenes originales del estudio local. Navegación exploratoria, no diagnóstica. Sin 3D/4D validado.</p><label>Serie<select id="cmrNativeSeries"></select></label><label id="cmrNativeOriLabel">Orientación<select id="cmrNativeOri"></select></label><label>Posición / corte <output id="cmrNativePlaneText"></output><input type="range" id="cmrNativePlane" min="0" max="0" value="0"></label><label>Fotograma / fase / contraste <output id="cmrNativePhaseText"></output><input type="range" id="cmrNativePhase" min="0" max="0" value="0"></label><div class="cmr-native-actions"><button id="cmrNativePlay" type="button" disabled>Reproducir</button><button id="cmrNativeWindow" type="button">Ventana automática</button></div><p id="cmrNativeStatus" role="status">Elegí la carpeta CMR-R2 ya preparada.</p></aside>`;
 byId('viewerRoot').appendChild(section);
 const $=id=>byId(id),canvas=$('cmrNativeCanvas'),ctx=canvas.getContext('2d');
 let catalog=null,files=new Map(),decoded=null,geometry=null,orientations=[],active=null,interval=null;
 function stop(){if(interval!==null){clearInterval(interval);interval=null;}}
 function setStatus(x){$('cmrNativeStatus').textContent=x;}
 function close(){stop();section.hidden=true;}
 function locate(f){const path=String(f.webkitRelativePath||f.name).replaceAll('\\','/');const match=path.match(/(?:^|\/)(RM-\d{3})\/(geometria_privada\.json|pixels_original_decoded\.npy)$/);if(match)return `${match[1]}/${match[2]}`;if(path.endsWith('/catalogo_local_privado.json')||path==='catalogo_local_privado.json')return 'catalogo_local_privado.json';return null;}
 async function ingest(fs){stop();files=new Map();
  for(const f of fs){const key=locate(f);if(key&&!files.has(key))files.set(key,f);}
  const c=files.get('catalogo_local_privado.json');require(c,'No se encontró catálogo CMR-R2 en la carpeta seleccionada');
  catalog=JSON.parse(await c.text());require(catalog.schema==='anatheos-cmr-r2-private-v1'&&Array.isArray(catalog.series)&&catalog.series.length<=1000,'Catálogo incompatible');
  const sel=$('cmrNativeSeries');sel.textContent='';
  for(const s of catalog.series){if(!/^RM-\d{3}$/.test(s.serie_local))continue;const o=document.createElement('option');o.value=s.serie_local;o.textContent=`${s.serie_local} · ${s.familia_probable||'Serie'} (${s.instancias})`;o.disabled=s.estado!=='preparada';sel.appendChild(o);}
  const eligible=catalog.series.find(s=>s.estado==='preparada');require(eligible,'No hay series preparadas');sel.value=eligible.serie_local;section.hidden=false;await selectSeries();
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
  const f=files.get(`${id}/geometria_privada.json`),npy=files.get(`${id}/pixels_original_decoded.npy`);require(f&&npy,'Faltan los datos preparados de esta serie');
  const g=JSON.parse(await f.text()),d=decodeNpy(await npy.arrayBuffer());require(g.serie_local===id&&g.frames?.length===d.dims[0]&&d.dims[0]===active.instancias,'Geometría y píxeles no corresponden');
  geometry=g;decoded=d;orientations=organize(g.frames);
  const ori=$('cmrNativeOri');ori.textContent='';orientations.forEach((group,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${group.label} · orientación ${i+1} (${group.planes.length} posiciones)`;ori.appendChild(o)});
  $('cmrNativeOriLabel').hidden=orientations.length<=1;ori.value='0';positionChange();
  $('cmrNativePlay').disabled=!['cine_provisional','perfusion_temporal'].includes(active.modo_seguro)||!orientations.some(x=>x.planes.some(p=>p.indices.length>1));
 }
 picker.addEventListener('change',async()=>{try{await ingest([...picker.files]);}catch(e){section.hidden=false;setStatus('No se pudo abrir la carpeta CMR: '+e.message);}finally{picker.value='';}});
 open.addEventListener('click',()=>picker.click());$('cmrNativeClose').addEventListener('click',close);
 $('cmrNativeSeries').addEventListener('change',async()=>{try{await selectSeries()}catch(e){setStatus(e.message)}});
 $('cmrNativeOri').addEventListener('change',()=>{stop();positionChange();});
 $('cmrNativePlane').addEventListener('input',()=>{stop();phaseChange();});
 $('cmrNativePhase').addEventListener('input',render);
 $('cmrNativeWindow').addEventListener('click',()=>{win=frameWindow();render();});
 $('cmrNativeZoom').addEventListener('input',()=>{const z=Number($('cmrNativeZoom').value);canvas.style.setProperty('--cmr-native-zoom',String(z/100));$('cmrNativeZoomText').textContent=z===100?'Ajustar':z+' %';});
 $('cmrNativeFull').addEventListener('click',()=>{const box=section.querySelector('.cmr-native-main');if(document.fullscreenElement)document.exitFullscreen();else box.requestFullscreen?.();});
 $('cmrNativePlay').addEventListener('click',()=>{if(interval!==null){stop();return;}if($('cmrNativePlay').disabled)return;const g=currentGroup()[Number($('cmrNativePlane').value)];if(g?.indices.length<=1)return;interval=setInterval(()=>{$('cmrNativePhase').value=(Number($('cmrNativePhase').value)+1)%g.indices.length;render();},120);});
 window.addEventListener('pagehide',stop);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();