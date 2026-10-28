/* ANATHEOS B5 · presentation and startup only. No DICOM/segmentation rewrites.
 * The ONLY automatic network access is a same-origin HEAD/GET request for the
 * packaged research DESS through localhost. No telemetry or external endpoints.
 * Browser file access always requires a user-initiated file picker.
 */
const $=id=>document.getElementById(id);
const bundled='datasets/RTKN0668_MR_DESS.zip';
let manualChoice=false;
let autoClick=false;
const status=message=>{$('b5WorkflowStatus').textContent=message;};

function currentView(){
 if($('surfaceButton').getAttribute('aria-pressed')==='true')return 'surface';
 if($('threeDButton').getAttribute('aria-pressed')==='true')return 'volume';
 return 'slice';
}
function syncPresentation(){
 const view=currentView();
 document.body.dataset.b5View=view;
 const title=$('studyTitle').textContent;
 const subtitle=$('studySubtitle').textContent;
 const loaded=title!=='Sin estudio cargado';
 const leeds=loaded&&/RTKN0668|MR_DESS\.zip|incluida/i.test(subtitle);
 $('b5StudyType').textContent=loaded?(leeds?'RM Leeds · serie original':title):'Sin estudio';
 const source=$('surfaceSource').value;
 if(view==='surface'){
  $('b5SourceNote').textContent=source==='spl-knee'
   ? 'SPL Knee Atlas: los huesos STL son de OTRO especimen, nunca de la resonancia Leeds.'
   : 'STL/OBJ externo: geometria importada, no derivada del estudio DICOM actual.';
 }else{
  $('b5SourceNote').textContent=loaded
   ? 'Origen DICOM: '+(leeds?'serie Leeds DESS original':'archivos locales del usuario')+'. Volumen 3D = mismos voxeles; las capas manuales no son anatomia reconocida.'
   : 'Sin archivos. Podes abrir tu ZIP/carpeta o utilizar la RM de investigacion incluida.';
 }
 if(loaded){status(view==='surface'?'Vista de superficies externas: no superponer con RM.':view==='volume'?'Reconstruccion volumetrica del mismo estudio DICOM.':'Serie DICOM original lista para explorar.');}
}

$('b5AdvancedToggle').addEventListener('click',()=>{
 const on=document.body.classList.toggle('b5-advanced');
 $('b5AdvancedToggle').setAttribute('aria-pressed',String(on));
 $('b5AdvancedToggle').textContent=on?'Ocultar controles avanzados':'Controles avanzados';
});
$('b5OpenStudy').addEventListener('click',()=>{
 manualChoice=true;
 $('zipInput').click();
});
for(const id of ['loadIncluded','zipButton','folderButton','surfaceButton','clearButton','twoDButton','threeDButton']){
 $(id).addEventListener('click',()=>{if(!autoClick)manualChoice=true;},true);
}
for(const id of ['zipInput','folderInput'])$(id).addEventListener('change',e=>{
 if(e.target.files?.length)manualChoice=true;
},true);
const mo=new MutationObserver(syncPresentation);
for(const id of ['studyTitle','studySubtitle','surfaceButton','threeDButton','twoDButton','surfaceSource']){
 mo.observe($(id),{subtree:true,childList:true,attributes:id.endsWith('Button'),attributeFilter:id.endsWith('Button')?['aria-pressed']:undefined});
}
function syncLoad(){
 const loading=!$('loading').hidden;
 if(loading)status('Procesando el estudio DICOM local; no se envian imagenes a Internet.');
 else if($('studyTitle').textContent==='Sin estudio cargado'&&$('warnings').textContent.includes('ERROR'))
  status('No se pudo procesar la serie. Podes abrir otro ZIP o carpeta.');
}
mo.observe($('loading'),{attributes:true,attributeFilter:['hidden']});
mo.observe($('warnings'),{childList:true,subtree:true});
const oldSync=syncPresentation;
const allSync=()=>{oldSync();syncLoad();};
// Replace additional watch with a separate observer so loader events are reflected.
const loadObserver=new MutationObserver(allSync);
loadObserver.observe($('loading'),{attributes:true,attributeFilter:['hidden']});
loadObserver.observe($('warnings'),{childList:true,subtree:true});
syncPresentation();
async function autoOpenBundled(){
 if(manualChoice)return;
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4000);
  let result;
  try {result=await fetch(bundled,{method:'HEAD',signal:controller.signal,cache:'no-store'});}
  finally{clearTimeout(timer);}
  if(manualChoice)return;
  if(!result.ok){status('No hay RM incluida: usa Abrir mi estudio, Abrir ZIP o Abrir carpeta.');return;}
  if(result.headers.get('content-type')?.startsWith('text/html')){
   status('No hay estudio de ejemplo: selecciona tus imagenes locales.');return;
  }
  status('Se detecto la RM de investigacion incluida. Carga automatica en curso…');
  autoClick=true;
  try{$('loadIncluded').click();}
  finally{autoClick=false;}
 }catch{
  if(!manualChoice)status('La RM incluida no esta disponible; abri un ZIP o una carpeta local.');
 }
}
void autoOpenBundled();
