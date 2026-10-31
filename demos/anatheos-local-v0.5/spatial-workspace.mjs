import {plane,pixelToLps,lpsToPixel,intersection,correspondence} from './spatial-reference.mjs';
import {planarDistanceMm} from './image-tools.mjs';

export function createWorkspace(host,{catalog,loadSeries,initial}){
 host.replaceChildren();const tools=document.createElement('div'),grid=document.createElement('div');grid.className='spatial-grid';host.append(tools,grid);
 const el=(type,text)=>{const e=document.createElement(type);if(text)e.textContent=text;return e;};
 const range=(min,max,value)=>{const e=el('input');e.type='range';e.min=min;e.max=max;e.value=value;return e;};
 const layout=el('select');layout.setAttribute('aria-label','Número de vistas');for(const n of [1,2,3,4])layout.add(new Option(`${n} vistas`,n));tools.append(layout);
 const linked=el('input'),linkLabel=el('label','Localizar corte compatible al seleccionar punto');linked.type='checkbox';linkLabel.append(linked);tools.append(linkLabel);
 let views=[],point=null,disposed=false;
 function current(v){return v.data?.orientations[Number(v.orientation.value)]?.planes[Number(v.position.value)]?.indices[Number(v.phase.value)];}
 function draw(){
  for(const v of views){v.index=current(v);v.frame=v.data?.frames[v.index];v.geometry=null;if(!v.frame){v.ctx.clearRect(0,0,v.canvas.width,v.canvas.height);continue;}
   const [n,h,w]=v.data.decoded.dims;try{v.geometry=plane(v.frame,h,w);}catch{}
   v.canvas.width=w;v.canvas.height=h;const im=v.ctx.createImageData(w,h),off=v.index*w*h,width=Number(v.window.value),level=Number(v.level.value),slope=v.frame.rescale_slope??1,intercept=v.frame.rescale_intercept??0;
   for(let i=0;i<w*h;i++){let x=Math.max(0,Math.min(255,(v.data.decoded.pixels[off+i]*slope+intercept-level+width/2)*255/width));if(v.frame.photometric_interpretation==='MONOCHROME1')x=255-x;im.data.set([x,x,x,255],i*4);}v.ctx.putImageData(im,0,0);
   v.canvas.style.transform=`translate(${v.pan[0]}px,${v.pan[1]}px) scale(${v.zoom.value})`;
   v.status.textContent=`${v.data.id} · ${v.data.orientations[Number(v.orientation.value)].label} · corte ${Number(v.position.value)+1} · fotograma ${Number(v.phase.value)+1}. ${v.geometry?'Geometría DICOM disponible':'Geometría inválida'}. TIEMPO NO VALIDADO`;
   for(const note of v.notes.filter(x=>x.frame===v.index)){v.ctx.strokeStyle=v.ctx.fillStyle='#ffe09b';v.ctx.beginPath();v.ctx.moveTo(...note.a);v.ctx.lineTo(...(note.b||[note.a[0]+3,note.a[1]+3]));v.ctx.stroke();if(note.mm!=null)v.ctx.fillText(`${note.mm.toFixed(2)} mm`,...note.a);}
   if(point&&v.geometry){const match=correspondence(point.frame,v.frame);if(!match.compatible){v.status.textContent+=` · INCOMPATIBLE: ${match.reason}`;continue;}const p=lpsToPixel(v.geometry,point.lps);v.status.textContent+=` · ${p.status} · distancia ${p.distance.toFixed(2)} mm. ${match.reason}`;
    if(p.inPlane&&p.inField){v.ctx.strokeStyle='#50efbf';v.ctx.beginPath();v.ctx.moveTo(p.i-5,p.j);v.ctx.lineTo(p.i+5,p.j);v.ctx.moveTo(p.i,p.j-5);v.ctx.lineTo(p.i,p.j+5);v.ctx.stroke();}}
  }
  for(const v of views){if(!v.geometry)continue;v.ctx.strokeStyle='#f3c77d';for(const other of views){if(other===v||!other.geometry||!correspondence(v.frame,other.frame).compatible)continue;const line=intersection(v.geometry,other.geometry);if(line.length===2){v.ctx.beginPath();v.ctx.moveTo(...line[0]);v.ctx.lineTo(...line[1]);v.ctx.stroke();}}}
 }
 function resetPhase(v){v.phase.max=Math.max(0,(v.data?.orientations[Number(v.orientation.value)]?.planes[Number(v.position.value)]?.indices.length||1)-1);v.phase.value=0;v.start=null;}
 function resetOrientation(v){v.position.max=Math.max(0,(v.data?.orientations[Number(v.orientation.value)]?.planes.length||1)-1);v.position.value=0;resetPhase(v);draw();}
 function locate(v){if(!point||!linked.checked)return;for(const target of views){if(target===v||!target.data)continue;let best=null;
  target.data.orientations[Number(target.orientation.value)].planes.forEach((p,k)=>{const idx=p.indices[Number(target.phase.value)]??p.indices[0],frame=target.data.frames[idx];if(!correspondence(point.frame,frame).compatible)return;try{const x=lpsToPixel(plane(frame,target.data.decoded.dims[1],target.data.decoded.dims[2]),point.lps);if(x.inField&&(!best||Math.abs(x.distance)<best.distance))best={k,distance:Math.abs(x.distance)};}catch{}});
  if(best){target.position.value=best.k;resetPhase(target);}}}
 async function select(v){const generation=++v.generation,id=v.series.value;if(v.data)v.notesBySeries.set(v.data.id,v.notes);v.data=null;v.notes=v.notesBySeries.get(id)||[];v.frame=null;v.geometry=null;v.start=null;draw();v.status.textContent='Leyendo serie…';
  try{const data=views.find(x=>x!==v&&x.data?.id===id)?.data||await loadSeries(id);if(disposed||generation!==v.generation)return;const unique=new Set(views.filter(x=>x!==v&&x.data).map(x=>x.data));unique.add(data);if([...unique].reduce((n,x)=>n+x.decoded.pixels.byteLength,0)>384*1024**2)throw Error();v.data=data;v.orientation.replaceChildren();data.orientations.forEach((g,k)=>v.orientation.add(new Option(`${g.label} ${k+1}`,k)));v.orientation.value=0;resetOrientation(v);
  }catch{if(generation===v.generation)v.status.textContent='No se pudo abrir: datos incompatibles o límite de memoria (384 MiB)';}}
 function build(){for(const v of views)v.generation++;views=[];point=null;grid.replaceChildren();grid.style.gridTemplateColumns=Number(layout.value)===1?'1fr':'repeat(2,minmax(0,1fr))';
  for(let i=0;i<Number(layout.value);i++){
   const box=el('section'),bar=el('div'),series=el('select'),orientation=el('select'),position=range(0,0,0),phase=range(0,0,0),width=range(1,131070,4096),level=range(-65535,131070,2048),zoom=range(.25,4,1),mode=el('select'),canvas=el('canvas'),stage=el('div'),status=el('p');zoom.step=.05;box.className='spatial-pane';stage.className='spatial-image';series.setAttribute('aria-label',`Serie vista ${i+1}`);
   for(const s of catalog.series.filter(x=>x.estado==='preparada'))series.add(new Option(s.serie_local,s.serie_local));for(const [value,text] of [['cursor','Cursor LPS'],['pan','Desplazar'],['measure','Distancia 2D'],['point','Anotar punto']])mode.add(new Option(text,value));
   for(const [text,e] of [['Serie',series],['Orientación',orientation],['Corte',position],['Fotograma',phase],['Ventana',width],['Nivel',level],['Zoom',zoom],['Herramienta',mode]]){const label=el('label',text);label.append(e);bar.append(label);}
   const reset=el('button','Ajustar'),clear=el('button','Borrar anotaciones');reset.type=clear.type='button';bar.append(reset,clear);stage.append(canvas);box.append(bar,stage,status);grid.append(box);
   const v={series,orientation,position,phase,window:width,level,zoom,mode,canvas,ctx:canvas.getContext('2d'),status,generation:0,data:initial,notes:[],notesBySeries:new Map(),start:null,pan:[0,0]};views.push(v);
   series.value=initial.id;series.onchange=()=>select(v);orientation.onchange=()=>resetOrientation(v);position.oninput=()=>{resetPhase(v);draw();};phase.oninput=width.oninput=level.oninput=zoom.oninput=draw;reset.onclick=()=>{v.pan=[0,0];zoom.value=1;draw();};clear.onclick=()=>{v.notes=[];v.start=null;draw();};mode.onchange=()=>{v.start=null;};
   let drag=null;canvas.onpointerdown=e=>{if(mode.value==='pan'){drag=[e.clientX,e.clientY,...v.pan];canvas.setPointerCapture(e.pointerId);}};canvas.onpointermove=e=>{if(drag){v.pan=[drag[2]+e.clientX-drag[0],drag[3]+e.clientY-drag[1]];draw();}};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
   canvas.onclick=e=>{if(!v.frame||mode.value==='pan')return;const r=canvas.getBoundingClientRect(),p=[(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];if(mode.value==='cursor'&&v.geometry){point={lps:pixelToLps(v.geometry,...p),frame:v.frame};locate(v);}else if(mode.value==='point')v.notes.push({type:'point',frame:v.index,a:p});else if(mode.value==='measure'&&v.geometry){if(v.start?.frame===v.index){v.notes.push({type:'measure',frame:v.index,a:v.start.p,b:p,mm:planarDistanceMm(v.start.p,p,v.geometry.s)});v.start=null;}else v.start={frame:v.index,p};}draw();};
   initial.orientations.forEach((g,k)=>orientation.add(new Option(`${g.label} ${k+1}`,k)));orientation.value=String(i%initial.orientations.length);resetOrientation(v);
  }draw();
 }
 layout.value=String(Math.min(3,initial.orientations.length));layout.onchange=build;build();return ()=>{disposed=true;point=null;for(const v of views){v.generation++;v.data=null;v.notes=[];}views=[];host.replaceChildren();};
}
