/** SURVEY L1: one acquired orientation only; no registration or tissue inference. */
import {buildOriginalPlaneScene} from './original-planes.mjs';
export const SUPPORT=Object.freeze({NO_DATA:0,ACQUIRED:1,NOMINAL:2,ESTIMATED:3});
export const L1_LABEL='Volumen exploratorio derivado SURVEY · baja resolución · no diagnóstico';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
function ensure(v,m){if(!v)throw Error('SURVEY L1: '+m);}
export function surveyPile(data,groupId=0){
 const scene=buildOriginalPlaneScene(data),group=scene.groups[groupId];ensure(group,'orientación ausente');ensure(group.planes.length===20,'se requieren 20 planos de una sola orientación');
 const first=group.planes[0],g=first.geometry,r=g.r,c=g.c,n=first.normal;
 for(const k of ['tr','te','ti','scan_sequence','sequence_variant'])ensure(new Set(group.planes.map(p=>JSON.stringify(p.frame.acquisition?.[k]??null))).size===1,'contraste/adquisición heterogéneos');
 for(const p of group.planes){
  ensure([...p.geometry.r,...p.geometry.c].every((v,k)=>Math.abs(v-[...r,...c][k])<=1e-6),'orientación variable; no remuestreo correctivo autorizado');
  const d=sub(p.geometry.p,g.p),z=dot(d,n);ensure(Math.hypot(...d.map((v,k)=>v-z*n[k]))<=.001,'desplazamiento lateral > 0,001 mm; rechazar, no corregir');
  ensure(Number.isFinite(p.frame.acquisition?.slice_thickness)&&p.frame.acquisition.slice_thickness>0,'espesor nominal ausente/inválido');
  ensure(Number.isFinite(p.frame.rescale_slope??1)&&Number.isFinite(p.frame.rescale_intercept??0),'rescale inválido');
 }
 const slices=group.planes.map(p=>({...p,z:dot(sub(p.geometry.p,g.p),n),thickness:p.frame.acquisition.slice_thickness}));
 const at=(i,j,z)=>g.p.map((v,k)=>v+i*g.s[1]*r[k]+j*g.s[0]*c[k]+z*n[k]);
 return {groupId,group,rows:scene.rows,cols:scene.cols,slices,at,originLps:g.p.slice(),basis:[r.slice(),c.slice(),n.slice()],spacing:g.s.slice(),fusion:false};
}
/** Values at original lateral pixel centers. Unknown != zero; nominal is copied,
 * NOT an acquired thickness profile. Interpolation bridges gaps only when enabled. */
export function sampleSurvey(pile,i,j,z,estimate=true){
 if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>=pile.cols||j>=pile.rows||!Number.isFinite(z))return {value:NaN,support:0,sources:[],weights:[]};
 const a=pile.slices;let lo=0;while(lo+1<a.length&&a[lo+1].z<=z)lo++;const hi=Math.min(a.length-1,lo+1);
 let nearest=a.reduce((best,p,k)=>Math.abs(p.z-z)<Math.abs(a[best].z-z)?k:best,0),p=a[nearest];
 const value=k=>{const f=a[k].frame;return a[k].pixels[j*pile.cols+i]*(f.rescale_slope??1)+(f.rescale_intercept??0);};
 if(Math.abs(z-p.z)<=1e-7)return {value:value(nearest),support:1,sources:[p.sourceIndex],weights:[1]};
 // A neighbouring thick slab may cover a coordinate closer to a thin slab.
 const covered=a.map((p,k)=>k).filter(k=>Math.abs(z-a[k].z)<=a[k].thickness/2+1e-9);
 if(covered.length){nearest=covered.reduce((best,k)=>Math.abs(a[k].z-z)<Math.abs(a[best].z-z)?k:best,covered[0]);return {value:value(nearest),support:2,sources:[a[nearest].sourceIndex],weights:[1]};}
 if(estimate&&z>a[0].z&&z<a.at(-1).z&&hi!==lo){const t=(z-a[lo].z)/(a[hi].z-a[lo].z);return {value:value(lo)*(1-t)+value(hi)*t,support:3,sources:[a[lo].sourceIndex,a[hi].sourceIndex],weights:[1-t,t]};}
 return {value:NaN,support:0,sources:[],weights:[]};
}
export function buildSurveyField(data,groupId=0){
 const pile=surveyPile(data,groupId),a=pile.slices,dz=Math.min(...pile.spacing),start=a[0].z-a[0].thickness/2-dz,end=a.at(-1).z+a.at(-1).thickness/2+dz;
 const anchors=[start,...a.map(p=>p.z),end],z=[];
 for(let k=0;k<anchors.length-1;k++){const count=Math.ceil((anchors[k+1]-anchors[k])/dz);for(let j=0;j<count;j++)z.push(anchors[k]+(anchors[k+1]-anchors[k])*j/count);}z.push(end);
 ensure(z.length<=256,'más de 256 niveles físicos; requiere otra resolución predeclarada');
 const x=pile.cols+2,y=pile.rows+2,depth=z.length,total=x*y*depth;ensure(total<=8_000_000,'rejilla excede presupuesto de 8 M vóxeles');
 const values=new Float32Array(total).fill(NaN),support=new Uint8Array(total),sourceA=new Int16Array(depth).fill(-1),sourceB=new Int16Array(depth).fill(-1),weightB=new Float32Array(depth),counts=[0,0,0,0];
 let low=Infinity,high=-Infinity;
 for(let k=0;k<depth;k++){
  const p=sampleSurvey(pile,0,0,z[k]);sourceA[k]=p.sources[0]??-1;sourceB[k]=p.sources[1]??-1;weightB[k]=p.weights[1]??0;
  const sources=p.sources.map(id=>pile.slices.find(s=>s.sourceIndex===id));
  for(let j=0;j<y;j++)for(let i=0;i<x;i++){const idx=(k*y+j)*x+i,valid=i>0&&i<x-1&&j>0&&j<y-1&&p.support;const state=valid?p.support:0;support[idx]=state;counts[state]++;
   if(state){const pixel=(j-1)*pile.cols+i-1;let value=0;for(let t=0;t<sources.length;t++){const f=sources[t].frame;value+=(sources[t].pixels[pixel]*(f.rescale_slope??1)+(f.rescale_intercept??0))*p.weights[t];}values[idx]=value;low=Math.min(low,value);high=Math.max(high,value);}}

 }
 ensure(Number.isFinite(low)&&high>low,'rango de señal uniforme/inválido');const output=new Uint8Array(total);for(let k=0;k<total;k++)if(support[k])output[k]=Math.round(Math.max(0,Math.min(1,(values[k]-low)/(high-low)))*255);
 const minZ=start-dz/2,maxZ=end+dz/2,spanMm=[x*pile.spacing[1],y*pile.spacing[0],maxZ-minZ],zNormalized=new Float32Array(z.map(v=>(v-minZ)/(maxZ-minZ))),originalLayers=a.map(s=>z.findIndex(v=>Math.abs(v-s.z)<1e-7));ensure(originalLayers.every(k=>k>=0),'centro original perdido');
 return {pile,values,support,sourceA,sourceB,weightB,z,counts,geo:{x,y,z:depth,spanMm,originLps:pile.at(-1,-1,start),rowCosines:pile.basis[0],columnCosines:pile.basis[1],normal:pile.basis[2]},output,rawRange:[low,high],textureBytes:output.byteLength,surveyL1:{support,zNormalized,originalLayers},memoryBytes:values.byteLength+support.byteLength+output.byteLength+sourceA.byteLength+sourceB.byteLength+weightB.byteLength+zNormalized.byteLength};
}
export function fieldVoxel(field,i,j,k,estimate=true,nominal=true){
 if(![i,j,k].every(Number.isInteger)||i<0||j<0||k<0||i>=field.geo.x||j>=field.geo.y||k>=field.geo.z)return {support:0,value:NaN,sources:[]};
 const idx=(k*field.geo.y+j)*field.geo.x+i,s=field.support[idx];if(!s||s===3&&!estimate||s===2&&!nominal)return {support:0,value:NaN,sources:[]};
 return {support:s,value:field.values[idx],sources:[field.sourceA[k],field.sourceB[k]].filter(x=>x>=0),weightB:field.weightB[k],lps:field.pile.at(i-1,j-1,field.z[k])};
}
/** Deterministic acquired sample lattice. Statistical signal bins, not tissues.
 * Native positions/source values survive display normalization; stride recorded. */
export function surveyPointCloud(field,{estimated=false,stride=4,maxPoints=70000}={}){
 ensure(Number.isInteger(stride)&&stride>=1&&stride<=32,'paso de nube inválido');const {pile}=field,points=[];
 for(const s of pile.slices)for(let j=0;j<pile.rows;j+=stride)for(let i=0;i<pile.cols;i+=stride){const v=sampleSurvey(pile,i,j,s.z);points.push({local:[i*pile.spacing[1],j*pile.spacing[0],s.z],lps:pile.at(i,j,s.z),value:v.value,support:1,sources:v.sources,weights:v.weights,pixel:[i,j]});}
 if(estimated)for(let k=0;k<field.z.length;k++)if(field.sourceB[k]>=0)for(let j=0;j<pile.rows;j+=stride*2)for(let i=0;i<pile.cols;i+=stride*2){const p=sampleSurvey(pile,i,j,field.z[k]);points.push({local:[i*pile.spacing[1],j*pile.spacing[0],field.z[k]],lps:pile.at(i,j,field.z[k]),value:p.value,support:3,sources:p.sources,weights:p.weights,pixel:[i,j]});}
 ensure(points.length<=maxPoints,'nube excede presupuesto; aumentar paso explícitamente');
 const sorted=points.filter(p=>p.support===1).map(p=>p.value).sort((a,b)=>a-b),cuts=[sorted[Math.floor(sorted.length/3)],sorted[Math.floor(sorted.length*2/3)]];
 for(const p of points)p.signalGroup=p.value<cuts[0]?0:p.value<cuts[1]?1:2;
 return {points,cuts,stride,label:'Tres grupos de señal por terciles de muestras adquiridas de esta pila; no tejidos',estimated};
}
