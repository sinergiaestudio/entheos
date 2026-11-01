/** L0: acquired 2D samples only. Authoritative coordinates stay in patient LPS mm.
 * No inverse, registration, phase choice, volume eligibility or interpolation. */
import {plane,pixelToLps} from './spatial-reference.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const m=Math.hypot(...a);return a.map(v=>v/m);};
export const L0_LABEL='Planos originales · no volumen continuo · sin sincronización cardíaca acreditada';
export const LPS_DISPLAY_BASIS=[1,0,0,0,0,-1,0,1,0]; // proper rotation [L,S,-P], never RAS or a data transform
export const displayLps=p=>[p[0],p[2],-p[1]];
export function buildOriginalPlaneScene(data){
 const [count,rows,cols]=data.decoded?.dims||[],pixels=data.decoded?.pixels;
 if(![count,rows,cols].every(Number.isInteger)||count<1||count>256||rows<2||cols<2||count*rows*cols>32_000_000||!pixels||pixels.length!==count*rows*cols||data.frames?.length!==count)throw Error('L0: matriz o memoria incompatible');
 const first=data.frames[0],ids=['study_instance_uid','series_instance_uid','frame_of_reference_uid'];
 if(ids.some(k=>!first[k])||data.frames.some(f=>ids.some(k=>f[k]!==first[k])))throw Error('L0 requiere una sola serie y referencia declaradas; no registro interserie');
 for(const k of ['trigger_time_ms','temporal_position_identifier','image_type'])if(new Set(data.frames.map(f=>JSON.stringify(f[k]??null))).size>1)throw Error('L0 no mezcla fases ni componentes de contraste');
 const groups=[],planes=[];
 data.frames.forEach((f,index)=>{
  const g=plane(f,rows,cols),normal=norm(cross(g.r,g.c)),key=[...g.r,...g.c,...g.s].map(v=>v.toFixed(6)).join(',');
  let group=groups.find(x=>x.key===key);if(!group){if(groups.length===3)throw Error('L0 admite hasta tres orientaciones originales');group={id:groups.length,key,planes:[],color:['#62c7ff','#ffcc75','#c1a1ff'][groups.length],normal};groups.push(group);}
  const corners=[[-.5,-.5],[cols-.5,-.5],[cols-.5,rows-.5],[-.5,rows-.5]].map(p=>pixelToLps(g,...p));
  const item={index,sourceIndex:index,sourceSha256:f.source_sha256||null,frame:f,geometry:g,normal,corners,center:pixelToLps(g,(cols-1)/2,(rows-1)/2),groupId:group.id,position:dot(g.p,normal),pixels:pixels.subarray(index*rows*cols,(index+1)*rows*cols),rows,cols};
  group.planes.push(item);planes.push(item);
 });
 for(const group of groups){
  group.planes.sort((a,b)=>a.position-b.position);group.steps=group.planes.slice(1).map((p,i)=>p.position-group.planes[i].position);
  if(group.steps.some(v=>v<=.01))throw Error('L0: posiciones repetidas; separar temporalidad/contraste antes de abrir');
  group.intervals=group.planes.slice(1).map((p,i)=>{const a=group.planes[i],ta=Number(a.frame.acquisition?.slice_thickness),tb=Number(p.frame.acquisition?.slice_thickness);return {a:a.index,b:p.index,centerDistanceMm:p.position-a.position,nominalGapMm:ta>0&&tb>0?p.position-a.position-(ta+tb)/2:null};});
  const axis=group.normal.map(Math.abs).indexOf(Math.max(...group.normal.map(Math.abs)));group.label=`Orientación ${group.id+1} · normal ${['L','P','S'][axis]} dominante`;
 }
 return {id:data.id,groups,planes,rows,cols,label:L0_LABEL,coordinateSystem:'LPS',temporalStatus:'NO VALIDADO',volumeEligible:false};
}
/** Finite rectangle intersection entirely in LPS; clips against world halfspaces.
 * Parallel/coplanar planes have no unique intersection and return no segment. */
export function intersectOriginalPlanes(a,b){
 if(Math.abs(dot(a.normal,b.normal))>1-1e-8)return [];
 const points=[],eps=1e-6;
 for(let k=0;k<4;k++){
  const p=a.corners[k],q=a.corners[(k+1)%4],x=dot(sub(p,b.geometry.p),b.normal),y=dot(sub(q,b.geometry.p),b.normal);
  if(Math.abs(x)<=eps&&!points.some(z=>Math.hypot(...sub(p,z))<eps))points.push(p);
  if(x*y<0){const t=x/(x-y),v=p.map((n,j)=>n+t*(q[j]-n));if(!points.some(z=>Math.hypot(...sub(v,z))<eps))points.push(v);}
 }
 if(points.length!==2)return [];
 let lo=0,hi=1;const [p,q]=points;
 for(let k=0;k<4;k++){
  const start=b.corners[k],edge=sub(b.corners[(k+1)%4],start),inside=x=>dot(cross(edge,sub(x,start)),b.normal)/Math.hypot(...edge);
  const x=inside(p),d=inside(q)-x;if(Math.abs(d)<1e-12){if(x< -eps)return [];continue;}
  const t=-x/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
 }
 return lo>hi?[]:[lo,hi].map(t=>p.map((v,k)=>v+t*(q[k]-v)));
}
export function planeMesh(p){
 const order=[0,1,2,0,2,3],uv=[[0,0],[1,0],[1,1],[0,1]];
 const positions=new Float32Array(order.flatMap(i=>p.corners[i])),normals=new Float32Array(order.flatMap(()=>p.normal));
 const min=[0,1,2].map(k=>Math.min(...p.corners.map(c=>c[k]))),max=[0,1,2].map(k=>Math.max(...p.corners.map(c=>c[k])));
 return {positions,normals,uvs:new Float32Array(order.flatMap(i=>uv[i])),bounds:{min,max}};
}
export function grayTexture(p,level,width){
 if(!Number.isFinite(level)||!Number.isFinite(width)||width<=0)throw Error('Ventana inválida');
 const slope=p.frame.rescale_slope??1,intercept=p.frame.rescale_intercept??0;
 if(![slope,intercept].every(Number.isFinite))throw Error('Escala inválida');
 const out=new Uint8Array(p.pixels.length);for(let i=0;i<out.length;i++){const v=Math.round(Math.max(0,Math.min(1,(p.pixels[i]*slope+intercept-level+width/2)/width))*255);out[i]=p.frame.photometric_interpretation==='MONOCHROME1'?255-v:v;}return out;
}
