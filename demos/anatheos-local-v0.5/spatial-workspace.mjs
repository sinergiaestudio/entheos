import {plane,pixelToLps,lpsToPixel,intersection} from './spatial-reference.mjs';
/** Embedded comparison for orientation groups of ONE source series. */
export function createWorkspace(host,decoded,frames,orientations){
 host.replaceChildren();const tools=document.createElement('div'),grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;height:100%;overflow:auto';host.append(tools,grid);
 const layout=document.createElement('select');layout.setAttribute('aria-label','Número de vistas');for(const n of [1,2,3,4])layout.add(new Option(`${n} vistas`,n));tools.append(layout);
 let views=[],point=null;
 const [count,h,w]=decoded.dims;
 function draw(){for(const v of views){const group=orientations[Number(v.orientation.value)],indices=group.planes[Number(v.position.value)]?.indices||[],idx=indices[0];if(idx===undefined)continue;
  v.frame=frames[idx];try{v.geometry=plane(v.frame,h,w);}catch{v.geometry=null;}
  const ctx=v.canvas.getContext('2d'),im=ctx.createImageData(w,h),off=idx*w*h,win=Number(v.window.value);for(let i=0;i<w*h;i++){let x=Math.max(0,Math.min(255,decoded.pixels[off+i]*255/win));if(v.frame.photometric_interpretation==='MONOCHROME1')x=255-x;im.data.set([x,x,x,255],i*4);}ctx.putImageData(im,0,0);
  v.status.textContent=`${group.label} · ${Number(v.position.value)+1}/${group.planes.length} · TIEMPO NO VALIDADO`;
  if(point&&v.geometry){const p=lpsToPixel(v.geometry,point);v.status.textContent+=` · ${p.status} · distancia ${p.distance.toFixed(2)} mm`;if(p.status==='EN PLANO'){ctx.strokeStyle='#50efbf';ctx.beginPath();ctx.moveTo(p.i-5,p.j);ctx.lineTo(p.i+5,p.j);ctx.moveTo(p.i,p.j-5);ctx.lineTo(p.i,p.j+5);ctx.stroke();}}
 }
 for(const v of views){if(!v.geometry)continue;const ctx=v.canvas.getContext('2d');ctx.strokeStyle='#f3c77d';for(const other of views){if(other===v||!other.geometry)continue;const line=intersection(v.geometry,other.geometry);if(line.length===2){ctx.beginPath();ctx.moveTo(...line[0]);ctx.lineTo(...line[1]);ctx.stroke();}}}}
 function build(){grid.replaceChildren();views=[];for(let i=0;i<Number(layout.value);i++){const box=document.createElement('section'),orientation=document.createElement('select'),position=document.createElement('input'),window=document.createElement('input'),canvas=document.createElement('canvas'),status=document.createElement('p');canvas.width=w;canvas.height=h;canvas.style.cssText='max-width:100%;max-height:45vh;width:auto;height:auto;display:block;margin:auto';box.style.cssText='min-width:0;background:#101f2f;padding:8px';position.type=window.type='range';window.min=1;window.max=65535;window.value=4096;position.min=0;
  orientations.forEach((g,k)=>orientation.add(new Option(`${g.label} ${k+1}`,k)));orientation.value=String(i%orientations.length);
  const v={orientation,position,window,canvas,status};views.push(v);const reset=()=>{position.max=orientations[Number(orientation.value)].planes.length-1;position.value=0;draw();};orientation.onchange=reset;position.oninput=window.oninput=draw;
  canvas.onclick=e=>{if(!v.geometry)return;const r=canvas.getBoundingClientRect();point=pixelToLps(v.geometry,(e.clientX-r.left)*w/r.width,(e.clientY-r.top)*h/r.height);draw();};
  box.append(orientation,position,window,canvas,status);grid.append(box);reset();}draw();}
 layout.value=String(Math.min(3,orientations.length));layout.onchange=build;build();
}
