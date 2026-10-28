import {loadSurface,MAX_SCENE_TRIANGLES} from './surface-core.mjs';
import {SurfaceRenderer,surfaceOrbitDrag} from './surface-renderer.mjs';
import {verifyOriginalSPLMesh,SPL_MESH_MANIFEST} from './spl-provenance.mjs';
const $=id=>document.getElementById(id);
const colorFor=['#d6e9f5','#f3c77d','#e59ca1','#78c6c9','#b0a9e2'];
let renderer=null,active=false,drag=null,modelCounter=0;
function status(message){$('surfaceStatus').textContent=message;}
const emptyHint='Sin modelos cargados. Para el estudio actual, dibujá regiones en Controles avanzados y pulsá Visualizar mis regiones en 3D; para otro espécimen usá Preparar y ver atlas SPL.';
function syncSurfaceUI(){
 const ready=Boolean(renderer?.meshes.length);
 $('surfaceAll').disabled=!ready;
 $('surfaceReset').disabled=!ready;
 $('surfaceClear').disabled=!ready;
 $('surfaceHelpOverlay').hidden=!active||ready;
}
function resetSurfaceView(){if(!renderer)return;renderer.yaw=.5;renderer.pitch=.18;renderer.zoom=1.6;renderer.draw();}
function showMode(){
 if($('viewerRoot').dataset.uxMode==='triple'){
  const same=renderer?.meshes?.length&&renderer.meshes.every(m=>m.provenance?.kind==='same-study-manual');
  if(same){showTriptychGeometry();return;}
  // Explicit 'Superficies' action opens the independent viewer for external
  // STL/SPL without presenting them as Leeds in the triple workspace.
  $('twoDButton').click();
 }
 // Exit previous volume mode so DICOM GPU controls cannot affect STL surfaces.
 if(!active)$('twoDButton').click();
 if(!renderer){try{renderer=new SurfaceRenderer($('surfaceCanvas'));}catch(e){status(e.message);return;}}
 active=true;
 $('surfaceCanvas').hidden=false;
 $('scanCanvas').hidden=true;
 $('volumeCanvas').hidden=true;
 $('emptyViewer').style.display='none';
 $('viewBadge').hidden=true;
 $('surfaceButton').setAttribute('aria-pressed','true');
 $('twoDButton').setAttribute('aria-pressed','false');
 $('threeDButton').setAttribute('aria-pressed','false');
 $('mixedButton').setAttribute('aria-pressed','false');
 const sameStudy=renderer.meshes.length>0&&renderer.meshes.every(m=>m.provenance?.kind==='same-study-manual');
 $('orientationNote').textContent=sameStudy
  ?'MISMA SERIE DICOM · máscaras manuales · coordenadas físicas LPS mm · SIN anatomía validada'
  :renderer.meshes.length&&renderer.meshes.every(m=>m.provenance?.hashVerified)
  ?'SPL Knee Atlas · SHA-256 auténtico · RAS / mm · OTRO espécimen'
  :'Superficies externas · no verificadas respecto de la RM actual';
 const originalSPL=renderer.meshes.length>0&&renderer.meshes.every(m=>m.provenance?.hashVerified);
 $('frameLabel').textContent=sameStudy
  ?'MALLAS DE MÁSCARAS MANUALES · MISMA RM · SIN VALIDAR'
  :originalSPL
  ?'ATLAS SPL EXTERNO · NO GENERADO DE LA RM LEEDS'
  :'STL/OBJ IMPORTADOS · ORIGEN SIN VALIDAR';
 $('viewerInfo').textContent=renderer.meshes.length
  ?'Arrastrar: girar objeto · rueda: zoom · Capas: aislar para estudiar solapamientos'
  :'Sin modelos importados';
 syncSurfaceUI();
 if(!renderer.meshes.length)status(emptyHint);
 renderer.draw();
}
function leaveMode(){
 if(!active)return;
 active=false;
 $('surfaceCanvas').hidden=true;
 $('triptychNoMask').hidden=true;
 $('surfaceButton').setAttribute('aria-pressed','false');
 syncSurfaceUI();
 // app.js has already restored 2D or 3D DICOM UI; do not overwrite it.
 if($('studyTitle').textContent==='Sin estudio cargado')$('emptyViewer').style.display='flex';
}
function uiRows(){const root=$('surfaceLayers');root.dataset.origin=renderer?.meshes?.[0]?.provenance?.kind==='same-study-manual'?'same-study-manual':'external';root.replaceChildren();if(!renderer?.meshes.length){root.textContent='Sin modelos STL/OBJ cargados. Los controles se habilitan despues de importar los archivos.';syncSurfaceUI();return;}
 for(const [n,m] of renderer.meshes.entries()){
  const row=document.createElement('div');row.className='surface-row';const label=document.createElement('button');label.type='button';label.className='surface-select';label.textContent=m.name+` · ${m.triangles.toLocaleString('es-AR')} triángulos`;label.setAttribute('aria-pressed',m===renderer.selected?'true':'false');label.onclick=()=>{renderer.selected=m;uiRows();renderer.draw();};
  const visible=document.createElement('input');visible.type='checkbox';visible.checked=m.visible;visible.title='Mostrar u ocultar '+m.name;visible.onchange=()=>{m.visible=visible.checked;renderer.draw();};
  const color=document.createElement('input');color.type='color';color.value=m.color;color.title='Color de '+m.name;color.oninput=()=>{m.color=color.value;renderer.draw();};
  const alpha=document.createElement('input');alpha.type='range';alpha.min='0';alpha.max='100';alpha.step='5';alpha.value=String(Math.round(m.opacity*100));alpha.title='Opacidad de '+m.name;alpha.oninput=()=>{m.opacity=Number(alpha.value)/100;renderer.draw();};
  const isolate=document.createElement('button');isolate.textContent='Solo';isolate.type='button';isolate.onclick=()=>{renderer.meshes.forEach(x=>x.visible=x===m);uiRows();renderer.draw();};
  row.append(label,visible,color,alpha,isolate);root.append(row);
 }
 syncSurfaceUI();
}
async function loadMeshes(files){if(!files.length)return;if(!renderer){try{renderer=new SurfaceRenderer($('surfaceCanvas'));}catch(e){status(e.message);return;}}
 const expected=$('surfaceSource').value;let loaded=0,authenticated=0;
 for(const file of files){try{
   if(!/\.(stl|obj)$/i.test(file.name))throw Error('Formato no admitido: '+file.name);
   const arr=await file.arrayBuffer();const m=loadSurface(file.name,arr);const current=renderer.meshes.reduce((a,v)=>a+v.triangles,0);
   if(current+m.triangles>MAX_SCENE_TRIANGLES)throw Error('Límite de triángulos por escena');
   const spl=expected==='spl-knee' ? await verifyOriginalSPLMesh(file.name,arr,m.triangles) : null;
   if(expected==='spl-knee'&&!spl)throw Error('La malla no coincide con las fuentes originales SPL por nombre, geometría y SHA-256. Elegí Otro estudio para material no verificado.');
   if(renderer.meshes.length&&renderer.meshes[0].sourceId!==expected)throw Error('No se permite mezclar mallas de estudios distintos; vaciá antes la escena');
   m.name=spl?`${spl.display} · SPL verificado`:file.name.replace(/\.(stl|obj)$/i,'').replace(/[-_]/g,' ');m.originalName=file.name;m.sourceId=expected;m.coordinateSystem=spl?'RAS (bbox compatible con máscara LPS)':'unknown';m.provenance=spl;m.id=++modelCounter;
   if(spl)authenticated++;
   const item=renderer.add(m);item.color=colorFor[(renderer.meshes.length-1)%colorFor.length];loaded++;
  }catch(e){status(`Rechazado ${file.name}: ${e.message}`);}
 }
 if(loaded){renderer.selected=renderer.meshes.at(-1);uiRows();showMode();status(authenticated===loaded?`${authenticated} estructura(s) SPL comprobadas por SHA-256. Coordenadas RAS y cotas físicas coherentes con el mapa LPS (error máximo inferior a 0,71 mm); falta registro formal 3D Slicer. No superponer a Leeds.`:`${loaded} estructura(s) importadas sin procedencia anatómica comprobada. Sin registro espacial con DICOM.`);}
}
// B6.1: safe in-memory handoff. Reject mixing with SPL or an unrelated series.
window.addEventListener('anatheos:show-same-study-surfaces',event=>{
 try{
  const {meshes,studyId,segVersion}=event.detail||{};
  if(!Array.isArray(meshes)||!meshes.length||!studyId||!Number.isInteger(segVersion))throw Error('Modelo sin procedencia completa.');
  if(!renderer)renderer=new SurfaceRenderer($('surfaceCanvas'));
  if(renderer.meshes.length&&!renderer.meshes.every(m=>m.sourceId==='dicom-derived'&&m.studyId===studyId)){
   throw Error('Hay modelos de otro origen. Vacialos antes de visualizar las regiones de este estudio.');
  }
  const prepared=meshes.map(item=>{
   if(item.derivedFrom!=='current-study-manual-labelmap'||item.coordinateSystem!=='LPS mm'||!(item.buffer instanceof ArrayBuffer))throw Error('Malla no vinculada a máscara física LPS.');
   const model=loadSurface('mask-'+item.label+'.stl',item.buffer);
   if(model.triangles!==item.triangles)throw Error('Triángulos inconsistentes de máscara.');
   model.name=item.name;model.originalName='Región '+item.label+' (sin validar)';
   model.sourceId='dicom-derived';model.studyId=studyId;model.segVersion=segVersion;
   model.coordinateSystem='LPS mm';model.surfaceMethod=item.surfaceMethod||'voxel-boundary';model.provenance={kind:'same-study-manual',studyId,coordinateSystem:'LPS mm',validatedAnatomy:false,label:item.label,voxels:item.voxels,method:model.surfaceMethod,soften:item.soften??0};
   return model;
  });
  if(prepared.reduce((sum,m)=>sum+m.triangles,0)>MAX_SCENE_TRIANGLES)throw Error('Escena excede el límite de triángulos.');
  if(renderer.meshes.length)renderer.clear();
  for(const mesh of prepared){
   const added=renderer.add(mesh);
   added.color=['#fb6c82','#64d6e4','#f7c66b'][mesh.provenance.label-1];
  }
  renderer.selected=renderer.meshes[0];
  uiRows();showMode();
  status('B6.2: '+prepared.length+' regiones derivadas de las máscaras MANUALES del mismo estudio DICOM. LPS mm · '+(prepared[0].surfaceMethod==='marching-tetrahedra'?'isosuperficie continua interpolada':'bordes cúbicos de vóxel')+'. Sin identificación anatómica, sin validación Slicer.');
 }catch(error){
  status('B6.1: '+error.message);
  event.preventDefault();
 }
});
function discardStaleSameStudy(){
 if(renderer?.meshes?.some(m=>m.sourceId==='dicom-derived')){
  renderer.clear();uiRows();showTriptychGeometry();status('Modelos de máscara descartados: la serie o los vóxeles marcados cambiaron. Regenerá las superficies.');
 }
}
window.addEventListener('anatheos:study-reset',discardStaleSameStudy);
window.addEventListener('anatheos:mask-changed',discardStaleSameStudy);

// Explicit user action, no background network downloads. Only fixed localhost API paths.
const atlasButton=$('surfaceAutoSPL');
const atlasStatus=$('surfaceAutoSPLStatus');
const atlasNames=['femur-95.stl','tibia-96.stl'];
let preparing=false;
async function loadAtlasAutomatically(){
 if(preparing)return;
 if(renderer?.meshes.length){
  atlasStatus.textContent='Primero usa Vaciar modelos si hay otra escena abierta: no mezclamos estudios ni reemplazamos trabajo sin permiso.';
  $('surfaceManual').open=true;
  return;
 }
 preparing=true;atlasButton.disabled=true;
 atlasButton.textContent='Preparando atlas SPL…';
 try{
  atlasStatus.textContent='Descargando solo los archivos publicos del atlas, con comprobacion SHA-256 en tu computadora…';
  const prepared=await fetch('/api/spl/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  let result;
  try{result=await prepared.json();}catch{throw Error('Tu servidor local no admite B5.2. Abre esta version con INICIAR_ANATHEOS.cmd y reinicia el servidor.');}
  if(!prepared.ok||result?.ok!==true)throw Error(result?.message||'El atlas no pudo prepararse');
  // Read both files and verify them BEFORE adding any mesh to the scene.
  const files=[];
  for(const name of atlasNames){
   atlasStatus.textContent='Verificando '+name+' dentro de ANATHEOS…';
   const response=await fetch('/atlas/'+name,{cache:'no-store'});
   if(!response.ok)throw Error('Falta o no coincide el archivo original '+name);
   const data=await response.arrayBuffer();
   const expected=SPL_MESH_MANIFEST[name];
   const verified=await verifyOriginalSPLMesh(name,data,expected.triangles);
   if(!verified)throw Error('Integridad SHA-256 invalida: '+name);
   files.push(new File([data],name,{type:'application/octet-stream'}));
  }
  $('surfaceSource').value='spl-knee';
  $('surfaceSource').dispatchEvent(new Event('change',{bubbles:true}));
  await loadMeshes(files);
  if(renderer?.meshes.length!==2)throw Error('No se pudieron representar las dos superficies originales');
  atlasButton.textContent='Atlas SPL listo · volver a mostrar';
  atlasStatus.textContent='Fémur y tibia originales SPL verificados. Capas independientes; NO corresponden a los cortes de Leeds. Disponible sin Internet en proximas aperturas.';
 }catch(error){
  atlasStatus.textContent='No completado: '+error.message+'. Podes revisar la conexion inicial o abrir las opciones manuales.';
  atlasButton.textContent='Reintentar preparar atlas SPL';
  status('No se importaron modelos SPL: '+error.message);
 }finally{preparing=false;atlasButton.disabled=false;}
}
atlasButton.addEventListener('click',loadAtlasAutomatically);
async function checkAtlasCached(){
 try{
  const response=await fetch('/api/spl/status',{cache:'no-store'});
  if(!response.ok)return;
  const value=await response.json();
  if(value.ready) {
   atlasButton.textContent='Abrir atlas SPL guardado';
   atlasStatus.textContent='Atlas autentico ya descargado y verificado en esta computadora. Abri con un clic; sin nueva descarga.';
  }
 }catch{ /* Old server or offline manual mode: button provides a useful error. */ }
}
void checkAtlasCached();

$('surfaceFile').addEventListener('change',async e=>{await loadMeshes([...e.target.files]);e.target.value='';});
$('surfaceOpen').addEventListener('click',()=>$('surfaceFile').click());

/* Only locally derived, same-study mask meshes may share the triple DICOM view.
 * A public SPL atlas from another knee is NEVER shown beside Leeds as a match.
 */
function showTriptychGeometry(){
 if($('viewerRoot').dataset.uxMode!=='triple')return;
 if(!renderer){try{renderer=new SurfaceRenderer($('surfaceCanvas'));}catch(error){status('Visor de mallas: '+error.message);}}
 const allowed=Boolean(renderer?.meshes?.length)&&renderer.meshes.every(m=>m.provenance?.kind==='same-study-manual');
 active=allowed;
 $('surfaceCanvas').hidden=!allowed;
 $('triptychNoMask').hidden=allowed;
 $('surfaceHelpOverlay').hidden=true;
 if(allowed)requestAnimationFrame(()=>renderer?.draw());
}
window.addEventListener('anatheos:triptych-activated',()=>requestAnimationFrame(showTriptychGeometry));
window.addEventListener('anatheos:triptych-left',()=>{
 if($('surfaceButton').getAttribute('aria-pressed')!=='true'){
  active=false;$('surfaceCanvas').hidden=true;$('triptychNoMask').hidden=true;
 }
});
$('surfaceButton').addEventListener('click',()=>{if($('viewerRoot').dataset.uxMode==='triple')$('twoDButton').click();showMode();});
for(const id of ['twoDButton','threeDButton','mixedButton','tripleButton'])$(id).addEventListener('click',leaveMode);
$('surfaceAll').addEventListener('click',()=>{if(!renderer)return;renderer.meshes.forEach(x=>x.visible=true);uiRows();renderer.draw();});
$('surfaceClear').addEventListener('click',()=>{renderer?.clear();uiRows();status('Modelos retirados de memoria. '+emptyHint);});
$('surfaceReset').addEventListener('click',resetSurfaceView);
$('clearButton').addEventListener('click',()=>{renderer?.clear();uiRows();leaveMode();});
const canvas=$('surfaceCanvas');canvas.addEventListener('pointerdown',e=>{if(!active||!renderer)return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||!active||!renderer)return;
 const angles=surfaceOrbitDrag(renderer.yaw,renderer.pitch,e.clientX-drag[0],e.clientY-drag[1]);
 renderer.yaw=angles.yaw;renderer.pitch=angles.pitch;
 drag=[e.clientX,e.clientY];renderer.draw();
});
canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('wheel',e=>{if(!active||!renderer)return;e.preventDefault();renderer.zoom=Math.max(.3,Math.min(3.8,renderer.zoom*(e.deltaY>0?.9:1.1)));renderer.draw();},{passive:false});
// Fullscreen/focus change the canvas CSS box without necessarily emitting a
// window resize; redraw AFTER layout so WebGL pixels track the new aspect.
let surfaceRedrawQueued=false;
function scheduleSurfaceRedraw(){
 if(surfaceRedrawQueued||!active)return;
 surfaceRedrawQueued=true;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  surfaceRedrawQueued=false;
  if(active)renderer?.draw();
 }));
}
const surfaceResize=typeof ResizeObserver!=='undefined'?new ResizeObserver(scheduleSurfaceRedraw):null;
surfaceResize?.observe($('viewerRoot'));
surfaceResize?.observe(canvas);
window.addEventListener('resize',scheduleSurfaceRedraw);
document.addEventListener('fullscreenchange',scheduleSurfaceRedraw);
$('focusButton').addEventListener('click',scheduleSurfaceRedraw);
$('fullscreenButton').addEventListener('click',scheduleSurfaceRedraw);
$('surfaceSource').addEventListener('change',()=>{
 if(renderer?.meshes.length&&renderer.meshes[0].sourceId!==$('surfaceSource').value){
  $('surfaceSource').value=renderer.meshes[0].sourceId;
  status('Primero vacia modelos para cambiar de especimen; no mezclar estudios distintos.');
  return;
 }
 if(!renderer?.meshes.length)status($('surfaceSource').value==='spl-knee'?'Atlas SPL seleccionado. Podes usar Preparar y ver atlas SPL en la vista principal.':'Podes importar manualmente archivos STL/OBJ de un mismo estudio.');
});
uiRows();
