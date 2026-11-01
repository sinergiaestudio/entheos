import {SurfaceRenderer,surfaceOrbitDrag,projectedSurfacePoint,surfaceViewport} from './surface-renderer.mjs';
import {sceneBounds} from './surface-core.mjs';
import {buildOriginalPlaneScene,planeMesh,grayTexture,intersectOriginalPlanes,LPS_DISPLAY_BASIS,displayLps,L0_LABEL} from './original-planes.mjs';
import {session} from './study-session.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function mountOriginalPlaneView(host,inspector,data){
 const model=buildOriginalPlaneScene(data),root=el('section'),canvas=el('canvas'),badge=el('p',L0_LABEL),status=el('p'),axes=el('div');
 root.id='originalPlaneScene';root.setAttribute('aria-label','SURVEY L0 · planos originales en LPS');canvas.id='originalPlaneCanvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','Escena de planos originales: arrastrar o flechas para rotar; rueda o más/menos para zoom; Escape vuelve a 2D');canvas.setAttribute('role','img');badge.className='l0-badge';status.className='l0-status';axes.className='l0-axes';root.append(canvas,axes,badge,status);host.append(root);
 const panel=el('details');panel.id='stationL0Inspector';panel.open=true;panel.append(el('summary','SURVEY · planos originales'));inspector.prepend(panel);
 let renderer,disposed=false,unsub=()=>{},drag=null,lineItems=[];const listeners=[];
 const on=(n,t,f,o)=>{n.addEventListener(t,f,o);listeners.push(()=>n.removeEventListener(t,f,o));};
 const dispose=()=>{if(disposed)return;disposed=true;unsub();resize?.disconnect();for(const off of listeners)off();renderer?.dispose();root.remove();panel.remove();};
 const back=()=>session.mode('2d');
 try{renderer=new SurfaceRenderer(canvas);renderer.basis=LPS_DISPLAY_BASIS.slice();}catch(e){root.remove();panel.remove();throw e;}
 const hint=el('p','Arrastrá para rotar · rueda para zoom · Escape: cortes 2D. Transparencia aproximada; las intersecciones son geométricas, no registro anatómico.');panel.append(hint);
 const backButton=el('button','Volver a cortes 2D'),fit=el('button','Restablecer cámara');backButton.type=fit.type='button';panel.append(backButton,fit);
 const selectedOnly=el('input');selectedOnly.type='checkbox';selectedOnly.checked=true;selectedOnly.id='l0SelectedOnly';const singleLabel=el('label','Sólo corte seleccionado de cada orientación');singleLabel.append(selectedOnly);panel.append(singleLabel);
 const showIntersections=el('input');showIntersections.type='checkbox';showIntersections.checked=true;showIntersections.id='l0Intersections';const il=el('label','Intersecciones de los cortes seleccionados');il.append(showIntersections);panel.append(il);
 const showGaps=el('input');showGaps.type='checkbox';showGaps.checked=true;showGaps.id='l0Gaps';const gapLabel=el('label','Marcar huecos de espesor nominal');gapLabel.append(showGaps);panel.append(gapLabel);
 const controls=model.groups.map(group=>{
  const block=el('fieldset'),legend=el('legend',group.label),visible=el('input'),opacity=el('input'),slice=el('input'),readout=el('output'),meta=el('p'),source=el('p');legend.style.color=group.color;block.append(legend);
  visible.type='checkbox';visible.checked=true;visible.id=`l0Group${group.id}`;const vl=el('label','Visible');vl.append(visible);block.append(vl);
  opacity.type='range';opacity.min=0;opacity.max=100;opacity.value=85;opacity.id=`l0Opacity${group.id}`;opacity.setAttribute('aria-label',`Transparencia orientación ${group.id+1}`);const ol=el('label','Opacidad');ol.append(opacity);block.append(ol);
  slice.type='range';slice.min=0;slice.max=group.planes.length-1;slice.value=Math.floor(group.planes.length/2);slice.id=`l0Slice${group.id}`;slice.setAttribute('aria-label',`Corte orientación ${group.id+1}`);const sl=el('label','Corte original');sl.append(slice,readout);block.append(sl);const provenance=el('details');provenance.append(el('summary','Geometría y procedencia'),meta,source);block.append(provenance);panel.append(block);
  const allValues=group.planes.flatMap(p=>Array.from(p.pixels).filter((_,i)=>i%17===0).map(v=>v*(p.frame.rescale_slope??1)+(p.frame.rescale_intercept??0))).sort((a,b)=>a-b),lo=allValues[Math.floor(allValues.length*.02)],hi=allValues[Math.min(allValues.length-1,Math.floor(allValues.length*.98))],width=Math.max(1,hi-lo),level=(hi+lo)/2;
  const items=group.planes.map(p=>{const m=renderer.add({...planeMesh(p),grayPixels:grayTexture(p,level,width),width:p.cols,height:p.rows});m.color=group.color;return m;});
  const gaps=group.intervals.map(x=>x.nominalGapMm).filter(x=>x!=null),space=group.steps;
  meta.textContent=`${group.planes.length} planos · ${space.length?`paso ${Math.min(...space).toFixed(3)}–${Math.max(...space).toFixed(3)} mm`:'un plano'} · ${gaps.some(x=>x>.01)?'HUECOS nominales presentes':gaps.length?'espesores nominales contiguos/solapados':'espesor no documentado'}. Texturas grises sin mezcla entre orientaciones; ventana común del grupo.`;
  return {group,visible,opacity,slice,readout,source,items};
 });
 const addLines=(points,color)=>{if(!points.length)return;const min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));const m=renderer.add({positions:new Float32Array(points.flat()),normals:new Float32Array(points.flatMap(()=>[0,0,1])),bounds:{min,max},unlit:true,primitive:'lines'});m.color=color;m.opacity=1;lineItems.push(m);};
 const bounds=sceneBounds(renderer.meshes),axisStart=bounds.min.map((v,k)=>v+(bounds.max[k]-v)*.08),length=bounds.scale*.3;
 const axisDefs=[[0,'L+ / R−','#ff9898'],[1,'P+ / A−','#9eefa5'],[2,'S+ / I−','#86cfff']].map(([k,label,color])=>{const end=axisStart.slice();end[k]+=length;const node=el('span',label);node.style.color=color;axes.append(node);return {end,node,color};});
 function draw(){if(disposed)return;renderer.remove(lineItems);lineItems=[];let count=0;
  const selected=[];
  for(const c of controls){const k=Number(c.slice.value),p=c.group.planes[k];c.items.forEach((m,i)=>{m.visible=c.visible.checked&&(!selectedOnly.checked||i===k);m.opacity=Number(c.opacity.value)/100;if(m.visible&&m.opacity>0)count++;});
   c.readout.textContent=`${k+1} / ${c.group.planes.length}`;c.source.textContent=`SourceIndex ${p.sourceIndex} (base 0) · LPS ${p.geometry.p.map(v=>v.toFixed(2)).join(', ')} mm · fuente ${p.sourceSha256?p.sourceSha256.slice(0,16)+'…':'huella no declarada'}`;
   if(!c.visible.checked||Number(c.opacity.value)<=0)continue;selected.push(p);addLines(p.corners.flatMap((v,i)=>[v,p.corners[(i+1)%4]]),c.group.color);
   if(showGaps.checked)for(const interval of c.group.intervals.filter(x=>x.nominalGapMm>.01)){const a=model.planes[interval.a],b=model.planes[interval.b],ta=Number(a.frame.acquisition.slice_thickness),tb=Number(b.frame.acquisition.slice_thickness),start=a.center.map((v,k)=>v+a.normal[k]*ta/2),end=b.center.map((v,k)=>v-b.normal[k]*tb/2);for(let j=0;j<4;j++)addLines([start.map((v,k)=>v+(end[k]-v)*j/4),start.map((v,k)=>v+(end[k]-v)*(j+.5)/4)],'#ff9f43');}
  }
  if(showIntersections.checked)for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++)addLines(intersectOriginalPlanes(selected[i],selected[j]),'#ffe997');
  for(const a of axisDefs)addLines([axisStart,a.end],a.color);
  renderer.draw();status.textContent=`${model.planes.length} planos cargados · ${count} visibles · LPS en mm · ${L0_LABEL}. Líneas naranjas: hueco NOMINAL, no anatomía.`;
  root.dataset.loadedPlanes=String(model.planes.length);root.dataset.visiblePlanes=String(count);
  const vp=surfaceViewport(canvas.clientWidth||1,canvas.clientHeight||1,devicePixelRatio||1),b=sceneBounds(renderer.meshes);
  for(const a of axisDefs){const v=displayLps(a.end.map((v,k)=>(v-b.center[k])/b.scale)),xy=projectedSurfacePoint(v,renderer.yaw,renderer.pitch,vp.aspect,renderer.zoom);a.node.style.left=((xy[0]+1)*canvas.clientWidth/2)+'px';a.node.style.top=((1-xy[1])*canvas.clientHeight/2)+'px';}
 }
 function reset(){renderer.yaw=.65;renderer.pitch=.32;renderer.zoom=1.35;draw();}
 const resize=new ResizeObserver(draw);resize.observe(root);
 for(const c of controls)for(const n of [c.visible,c.opacity,c.slice])on(n,'input',draw);for(const n of [selectedOnly,showIntersections,showGaps])on(n,'input',draw);
 on(backButton,'click',back);on(fit,'click',reset);
 on(canvas,'pointerdown',e=>{if(e.button!==0)return;drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus();});
 on(canvas,'pointermove',e=>{if(!drag)return;const o=surfaceOrbitDrag(renderer.yaw,renderer.pitch,e.clientX-drag[0],e.clientY-drag[1]);renderer.yaw=o.yaw;renderer.pitch=o.pitch;drag=[e.clientX,e.clientY];draw();});
 for(const t of ['pointerup','pointercancel','lostpointercapture'])on(canvas,t,()=>drag=null);
 const zoom=factor=>{renderer.zoom=Math.max(.2,Math.min(6,renderer.zoom*factor));draw();};on(canvas,'wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1);},{passive:false});
 on(canvas,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();back();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();renderer.yaw+=e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0;renderer.pitch=Math.max(-1.45,Math.min(1.45,renderer.pitch+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0)));draw();}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?.8:1.25);}});
 unsub=session.subscribe(s=>{if(!s.active||s.mode!=='planes')dispose();});reset();canvas.focus();
 return {dispose,zoom,fit:reset,model};
}
