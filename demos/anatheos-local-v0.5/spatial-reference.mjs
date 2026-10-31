/** Original DICOM geometry only. PixelSpacing is [row, column], in mm. */
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function plane(f,rows,cols){
 const o=f.image_orientation_patient_LPS,p=f.image_position_patient_LPS_mm,s=f.pixel_spacing_row_col_mm;
 if(![o,p,s].every(Array.isArray)||o.length!==6||p.length!==3||s.length!==2||![...o,...p,...s].every(Number.isFinite)||s.some(x=>x<=0)||!Number.isInteger(rows)||!Number.isInteger(cols)||rows<2||cols<2)throw Error('Geometría ausente o inválida');
 const r=o.slice(0,3),c=o.slice(3);if(Math.abs(dot(r,r)-1)>1e-4||Math.abs(dot(c,c)-1)>1e-4||Math.abs(dot(r,c))>1e-4)throw Error('IOP no ortonormal');
 return {p,r,c,n:cross(r,c),s,rows,cols};
}
export function pixelToLps(g,i,j){return g.p.map((x,k)=>x+i*g.s[1]*g.r[k]+j*g.s[0]*g.c[k]);}
export function lpsToPixel(g,p){const d=sub(p,g.p),i=dot(d,g.r)/g.s[1],j=dot(d,g.c)/g.s[0],distance=dot(d,g.n);return {i,j,distance,status:i<0||j<0||i>g.cols-1||j>g.rows-1?'FUERA DE CAMPO':Math.abs(distance)<=.01?'EN PLANO':'PROYECCIÓN CERCANA'};}
export function intersection(a,b){
 // Clip the intersection of b's plane with a's visible rectangle.
 const corners=[[0,0],[a.cols-1,0],[a.cols-1,a.rows-1],[0,a.rows-1]],points=[];
 if(Math.abs(dot(a.n,b.n))>1-1e-8)return [];
 for(let k=0;k<4;k++){const x=corners[k],y=corners[(k+1)%4],dx=dot(sub(pixelToLps(a,...x),b.p),b.n),dy=dot(sub(pixelToLps(a,...y),b.p),b.n);
  if(dx*dy<=0&&Math.abs(dx-dy)>1e-10){const t=dx/(dx-dy),q=x.map((v,i)=>v+t*(y[i]-v));if(!points.some(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6))points.push(q);}}
 if(points.length!==2)return [];
 const ends=points.map(p=>lpsToPixel(b,pixelToLps(a,...p)));let lo=0,hi=1;
 for(const [key,max] of [['i',b.cols-1],['j',b.rows-1]]){const x=ends[0][key],d=ends[1][key]-x;
  if(Math.abs(d)<1e-10){if(x<0||x>max)return [];continue;}
  const t=[-x/d,(max-x)/d].sort((x,y)=>x-y);lo=Math.max(lo,t[0]);hi=Math.min(hi,t[1]);}
 return lo>hi?[]:[lo,hi].map(t=>points[0].map((x,i)=>x+t*(points[1][i]-x)));
}
export function eligibility(frames,rows,cols){
 const reasons=[],groups=new Map();
 frames.forEach((f,index)=>{try{const g=plane(f,rows,cols),key=[...g.r,...g.c,...g.s].map(x=>x.toFixed(5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({g,index,f});}catch(e){reasons.push(e.message);}});
 const result=[...groups.values()].map(items=>{
  const g=items[0].g,sorted=items.map(x=>({...x,z:dot(sub(x.g.p,g.p),g.n)})).sort((a,b)=>a.z-b.z),steps=sorted.slice(1).map((x,i)=>x.z-sorted[i].z);
  const reason=[];if(items.length<3)reason.push('Cobertura insuficiente');
  if(steps.some(x=>x<=.01))reason.push('Posiciones repetidas: fases o contrastes sin separar');
  const step=steps.length?steps.reduce((a,b)=>a+b,0)/steps.length:0;
  if(steps.some(x=>Math.abs(x-step)>Math.max(.01,step*.01)))reason.push('Separación irregular o huecos');
  if(items.some(x=>{const d=sub(x.g.p,g.p),z=dot(d,g.n);return Math.hypot(...d.map((v,k)=>v-z*g.n[k]))>.01;}))reason.push('Desplazamiento fuera de la normal');
  // Geometric regularity alone cannot establish acquisition/contrast equivalence.
  reason.push('Equivalencia de adquisición y contraste pendiente de verificar');
  return {capabilities:['A','B'],volumeEligible:false,indices:sorted.map(x=>x.index),spacingMm:step,reasons:reason};
 });
 return {groups:result,invalidFrames:frames.length-[...groups.values()].reduce((n,g)=>n+g.length,0),reasons:[...new Set(reasons)],temporal:'TIEMPO NO VALIDADO',derivedModel:false};
}
