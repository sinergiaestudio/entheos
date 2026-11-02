import {attachVisualTarget} from './survey-mpr-controls.mjs';
import {VolumeRenderer} from './volumetric.js';
import {buildSurveyField,surveyPointCloud,L1_LABEL} from './survey-field.mjs';
import {buildOriginalPlaneScene} from './original-planes.mjs';
import {session} from './study-session.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function mountSurveyFieldView(host,inspector,data,originals,{visualTarget=false}={}){
 const root=el('section'),canvas=el('canvas'),badge=el('p',L1_LABEL),status=el('p'),legend=el('p','Centros: adquirido cian · soporte NOMINAL ámbar · estimado magenta · NO_DATA ausente. Una pila por vez; sin fusión ni fase común.');
 root.id='surveyFieldScene';canvas.id='surveyFieldCanvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','Volumen exploratorio SURVEY: arrastrar/flechas rotan, rueda amplía, Escape vuelve a 2D');badge.className='l0-badge';status.className='l0-status';legend.className='l1-legend';root.append(canvas,badge,status,legend);host.append(root);
 const panel=el('details');panel.id='surveyFieldInspector';panel.open=true;panel.append(el('summary','SURVEY L1 · intensidad, no tejido'));inspector.prepend(panel);
 let visual=null,renderer=null,field=null,disposed=false,unsub=()=>{},drag=null;const offs=[],on=(n,t,f,o)=>{n.addEventListener(t,f,o);offs.push(()=>n.removeEventListener(t,f,o));};
 const resize=new ResizeObserver(()=>draw());resize.observe(root);
 function dispose(){if(disposed)return;disposed=true;resize.disconnect();unsub();offs.forEach(f=>f());visual?.dispose();renderer?.dispose();renderer=null;field=null;root.remove();panel.remove();}
 const select=el('select');select.id='l1Pile';buildOriginalPlaneScene(data).groups.forEach(g=>select.add(new Option(`${g.label} · ${g.planes.length} planos`,g.id)));
 const mode=el('select');mode.id='l1Mode';mode.add(new Option('Volumen de intensidades','volume'));mode.add(new Option('Nube de muestras','points'));
 const label=(text,node)=>{const n=el('label',text);n.append(node);panel.append(n);return node;};label('Pila independiente · NO fusionadas',select);label('Representación',mode);
 const check=(id,text,value)=>{const n=el('input');n.type='checkbox';n.id=id;n.checked=value;return label(text,n);};
 const estimate=check('l1Estimate','Mostrar estimación entre soportes',true),nominal=check('l1Nominal','Mostrar soporte NOMINAL (copia de señal)',true),confidence=check('l1Confidence','Colorear procedencia del centro de vóxel',true),mask=check('l1MaskOnly','Sólo estados de soporte (sin umbral)',false);
 const range=(id,text,min,max,value,step=1)=>{const n=el('input');n.type='range';n.id=id;n.min=min;n.max=max;n.value=value;n.step=step;return label(text,n);};
 const opacity=range('l1Opacity','Opacidad',0,4,1.8,.05),clip=range('l1Clip','Recorte longitudinal de la pila',0,1,1,.01),threshold=range('l1Threshold','Umbral de señal de esta pila',0,.9,.07,.01);
 const original=check('l1Original','Mostrar plano original seleccionado',false),slice=range('l1OriginalSlice','Fuente original (orden espacial)',0,19,10),source=el('p');panel.append(source);
 const groups=check('l1Groups','Nube: tres grupos de señal, NO tejidos',false),estimatedPoints=check('l1EstimatedPoints','Nube: añadir estimados separados (magenta)',false);
 const technical=el('details'),technicalBody=el('p');technical.append(el('summary','Procedencia, límites y recursos'),technicalBody);panel.append(technical);
 const originalButton=el('button','Ver planos originales · L0'),fit=el('button','Restablecer cámara');originalButton.type=fit.type='button';panel.append(originalButton,fit);
 function cloud(){if(renderer&&field){const stride=Math.max(4,Math.ceil(Math.sqrt(field.pile.rows*field.pile.cols*20/50000)));renderer.setSurveyPointCloud(surveyPointCloud(field,{estimated:estimatedPoints.checked,stride}));}}
 function build(){renderer?.dispose();renderer=null;field=buildSurveyField(data,Number(select.value));renderer=new VolumeRenderer(canvas,field);renderer.steps=100;renderer.yaw=.65;renderer.pitch=.32;renderer.zoom=1.85;cloud();draw();}
 function draw(){if(disposed||!renderer||!field)return;const begin=performance.now();renderer.opacity=Number(opacity.value);renderer.clip=Number(clip.value);renderer.threshold=Number(threshold.value);renderer.surveyEstimate=estimate.checked;renderer.surveyNominal=nominal.checked;renderer.surveyConfidence=confidence.checked;renderer.surveyMaskOnly=mask.checked;renderer.surveyMode=mode.value;renderer.surveyGroups=groups.checked;renderer.surveyOriginal=original.checked?field.surveyL1.originalLayers[Number(slice.value)]:-1;visual?.prepare(field,renderer);renderer.draw();
  const p=field.pile.slices[Number(slice.value)];source.textContent=`Fuente ${Number(slice.value)+1}/20 · SourceIndex ${p.sourceIndex} · SHA ${p.sourceSha256?.slice(0,16)||'sin huella'}… · LPS ${p.geometry.p.map(v=>v.toFixed(2)).join(', ')} mm`;
  const [unknown,acquired,nom,est]=field.counts;status.textContent=`Pila ${Number(select.value)+1} · ${field.geo.x}×${field.geo.y}×${field.geo.z} centros · adquiridos ${acquired} · NOMINAL ${nom} · estimados ${est} ${estimate.checked?'visibles':'APAGADOS'} · NO_DATA ${unknown}. ${mode.value==='points'?`${renderer.pointCloud.points.length} puntos · paso ${renderer.pointCloud.stride} px`:'Ray casting 3D de señal'} · ejes propios de pila con mapeo LPS.`;
  technicalBody.textContent=`Campo Float32 + procedencia + R8: ${(field.memoryBytes/1048576).toFixed(1)} MiB; buffers nube ${(renderer.pointBytes/1048576).toFixed(1)} MiB (no incluye heap JS/driver). Planos z no uniformes; centros originales preservados. NOMINAL copia un plano, no medición volumétrica. Terciles de muestras adquiridas: ${renderer.pointCloud.cuts.map(v=>v.toFixed(2)).join(' / ')}. ${renderer.pointCloud.label}. Sin gating, registro anatómico, fusión o validación clínica. GPU: ${renderer.backend}.`;
  root.dataset.group=select.value;root.dataset.mode=mode.value;root.dataset.estimated=estimate.checked?'on':'off';root.dataset.original=original.checked?'on':'off';root.dataset.fieldBytes=String(field.memoryBytes);root.dataset.drawMs=(performance.now()-begin).toFixed(2);root.dataset.points=String(renderer.pointCloud.points.length);
  for(const n of [confidence,mask,nominal,opacity,threshold,original,slice])n.disabled=mode.value==='points';groups.disabled=estimatedPoints.disabled=mode.value!=='points';visual?.refresh();
 }
 const zoom=f=>{if(renderer){renderer.zoom=Math.max(.3,Math.min(6,renderer.zoom*f));draw();}};const reset=()=>{if(renderer){renderer.yaw=.65;renderer.pitch=.32;renderer.zoom=1.85;draw();}};
 on(select,'change',()=>{try{build();}catch(e){renderer?.dispose();renderer=null;status.textContent=e.message;root.dataset.error='rejected';}});
 for(const n of [mode,estimate,nominal,confidence,mask,opacity,clip,threshold,original,slice,groups])on(n,'input',draw);on(estimatedPoints,'input',()=>{cloud();draw();});on(originalButton,'click',originals);on(fit,'click',reset);
 on(canvas,'pointerdown',e=>{if(e.button!==0)return;drag=[e.clientX,e.clientY];if(visual&&renderer)renderer.preview=true;canvas.setPointerCapture(e.pointerId);canvas.focus();});on(canvas,'pointermove',e=>{if(!drag||!renderer)return;renderer.yaw-=(e.clientX-drag[0])*.008;renderer.pitch=Math.max(-1.45,Math.min(1.45,renderer.pitch-(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];draw();});for(const t of ['pointerup','pointercancel','lostpointercapture'])on(canvas,t,()=>{if(drag){drag=null;if(visual&&renderer){renderer.preview=false;draw();}}});
 on(canvas,'wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1);},{passive:false});on(canvas,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();session.mode('2d');}else if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?.8:1.25);}else if(e.key.startsWith('Arrow')&&renderer){e.preventDefault();e.stopPropagation();renderer.yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;renderer.pitch=Math.max(-1.45,Math.min(1.45,renderer.pitch+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0)));draw();}});
 if(visualTarget){visual=attachVisualTarget({root,canvas,panel,draw,sourceSlice:slice});confidence.checked=false;}
 unsub=session.subscribe(s=>{if(!s.active||s.mode!=='survey')dispose();});try{build();canvas.focus();}catch(e){dispose();throw e;}
 return {dispose,zoom,fit:reset};
}
