/** Presentation of the unchanged L1 rectilinear field. No shared inverse/registration. */
import {fieldVoxel} from './survey-field.mjs';
export const VT_LABEL='SURVEY L1.1 · volumen + MPR derivada · baja resolución · NO DIAGNÓSTICO';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
export function nearestLayer(z,value){let lo=0,hi=z.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(z[m]<=value)lo=m;else hi=m;}return Math.abs(value-z[lo])<=Math.abs(value-z[hi])?lo:hi;}
export function localBounds(f){const dx=f.pile.spacing[1],dy=f.pile.spacing[0],dz=Math.min(dx,dy);return {min:[-1.5*dx,-1.5*dy,f.z[0]-dz/2],span:f.geo.spanMm,scale:Math.max(...f.geo.spanMm)};}
export function cursorLocal(f,c){return [(c[0]-1)*f.pile.spacing[1],(c[1]-1)*f.pile.spacing[0],f.z[c[2]]];}
export function normalizedCursor(f,c){const b=localBounds(f);return cursorLocal(f,c).map((v,k)=>(v-b.min[k])/b.span[k]);}
export function localToWorld(f,p){return f.pile.at(p[0]/f.pile.spacing[1],p[1]/f.pile.spacing[0],p[2]);}
export function sectionPlane(f,c,{axis=2,azimuth=35,elevation=20,offsetMm=0,flip=false}={}){
 let n=[0,0,0];if(axis<3)n[axis]=1;else{const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;n=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];}if(flip)n=n.map(v=>-v);
 const b=localBounds(f),local=cursorLocal(f,c),center=b.min.map((v,k)=>v+b.span[k]/2),point=local.map((v,k)=>v+n[k]*offsetMm),d=dot(n,point.map((v,k)=>(v-center[k])/b.scale));
 const normalLps=[0,1,2].map(k=>n.reduce((s,v,j)=>s+v*f.pile.basis[j][k],0));return {normal:n,d,normalLps,pointLps:localToWorld(f,point),pointLocal:point,axis};
}
export function keptByPlane(f,p,section){const b=localBounds(f),center=b.min.map((v,k)=>v+b.span[k]/2);return dot(section.normal,p.map((v,k)=>(v-center[k])/b.scale))<=section.d+1e-9;}
export function mprGeometry(f,c,axis){
 if(!Number.isInteger(axis)||axis<0||axis>2)throw Error('Eje MPR inválido');const dims=[f.geo.x,f.geo.y,f.geo.z];if(c.some((v,k)=>!Number.isInteger(v)||v<0||v>=dims[k]))throw Error('Cursor fuera de campo');
 const b=localBounds(f),axes=axis===0?[1,2]:axis===1?[0,2]:[0,1],center=cursorLocal(f,c),corners=[[0,0],[1,0],[1,1],[0,1]].map(uv=>{const p=center.slice();axes.forEach((k,j)=>p[k]=b.min[k]+uv[j]*b.span[k]);return localToWorld(f,p);}),normal=f.pile.basis[axis],dominant=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),angle=Math.acos(Math.min(1,Math.abs(normal[dominant])))*180/Math.PI;
 return {axis,axes,spanMm:axes.map(k=>b.span[k]),corners,centerLps:localToWorld(f,center),normalLps:normal,obliqueDegrees:angle,label:`MPR ${['i','j','k'][axis]} · equivalente ${['sagital','coronal','axial'][dominant]}${angle>.1?' OBLICUA':''}`,originalSourceIndex:axis===2?f.pile.slices.find((s,k)=>f.surveyL1.originalLayers[k]===c[2])?.sourceIndex??null:null};
}
export function mprSample(f,c,axis,u,v,{estimate=true,nominal=true,acquiredOnly=false}={}){
 if(u<0||u>1||v<0||v>1)return {support:0,value:NaN,sources:[]};const axes=axis===0?[1,2]:axis===1?[0,2]:[0,1],b=localBounds(f),p=c.slice();for(const [j,k] of axes.entries()){const t=j===0?u:v;p[k]=k===2?nearestLayer(f.z,b.min[2]+t*b.span[2]):Math.max(0,Math.min([f.geo.x,f.geo.y][k]-1,Math.floor(t*[f.geo.x,f.geo.y][k])));}
 const s=fieldVoxel(f,...p,estimate,nominal);if(acquiredOnly&&s.support!==1)return {support:0,value:NaN,sources:[]};return {...s,index:p};
}
/** Invert ONE known screen displacement DOF, not world→pixel or shared #10. */
export function dragDistanceMm(delta,normal,yaw,pitch,width,height,zoom,scale){
 const view=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)],right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[view[1]*right[2]-view[2]*right[1],view[2]*right[0]-view[0]*right[2],view[0]*right[1]-view[1]*right[0]],s=[dot(normal,right)*zoom/1.25/(width/height)*width/2/scale,-dot(normal,up)*zoom/1.25*height/2/scale],den=dot(s,s);return den<1e-8?null:dot(delta,s)/den;
}
