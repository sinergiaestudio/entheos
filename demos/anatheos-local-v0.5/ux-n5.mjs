/**
 * ANATHEOS UX-N5 — contextual status ribbon from ACTUAL study/render/mesh state.
 * Presentation only. No new image/model, no clinical inference or network calls.
 * Keep existing state, canvases, event handlers and safe provenance intact.
 */
const get=id=>document.getElementById(id);
const studyArea=get('seriesList')?.closest('.sideblock');
if(studyArea){
 const ribbon=document.createElement('section');
 ribbon.id='uxN5Evidence';
 ribbon.className='uxn5-evidence';
 ribbon.setAttribute('aria-label','Estado de las representaciones del estudio activo');
 ribbon.hidden=true;
 ribbon.innerHTML='<div class="uxn5-evidence-item"><span class="uxn5-led" id="uxN5VolumeLed"></span><span>Volumen</span><strong id="uxN5VolumeState">No preparado</strong></div><div class="uxn5-evidence-item"><span class="uxn5-led" id="uxN5MeshLed"></span><span>Geometría</span><strong id="uxN5MeshState">Sin máscaras</strong></div>';
 studyArea.append(ribbon);
 const update=()=>{
  const loaded=get('studyTitle').textContent!=='Sin estudio cargado';
  ribbon.hidden=!loaded;
  if(!loaded)return;
  const text=get('volumeStatus')?.textContent||'';
  const ready=/Volumen \d+|Volumen preparado|Volumen listo|Textura 3D/i.test(text);
  const preparing=/Preparando|Calculando|Decodificando/i.test(text);
  get('uxN5VolumeState').textContent=ready?'Preparado':preparing?'Procesando':'Disponible al abrir 3D';
  get('uxN5VolumeLed').dataset.state=ready?'ready':preparing?'busy':'idle';
  const origin=get('surfaceLayers')?.dataset.origin||'';
  const rows=get('surfaceLayers')?.querySelectorAll('.surface-row').length||0;
  const same=origin==='same-study-manual'&&rows>0;
  let painted=0;
  for(let i=1;i<=3;i++){
   const number=(get('segCount'+i)?.textContent||'').replace(/\./g,'').match(/\d+/);
   if(number)painted+=Number(number[0]);
  }
  get('uxN5MeshState').textContent=same?'Malla del estudio':painted>0?'Máscara sin malla':'Sin máscaras';
  get('uxN5MeshLed').dataset.state=same?'ready':painted>0?'busy':'idle';
 };
 const observer=new MutationObserver(update);
 const elements=['studyTitle','volumeStatus','surfaceLayers','segCount1','segCount2','segCount3'];
 for(const id of elements){
  const node=get(id);
  if(node)observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:id==='surfaceLayers',attributeFilter:id==='surfaceLayers'?['data-origin']:undefined});
 }
 update();
}
// Actual state and source are always displayed via original right panel.
// This final polish deliberately does not add non-existing bone/cartilage
// layers to satisfy a visual mockup. The amber renderer remains optional.
