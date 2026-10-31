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
export const SPATIAL_TOLERANCES=Object.freeze({coincidenceMm:.01,nearMm:2});
export function lpsToPixel(g,p,tolerances=SPATIAL_TOLERANCES){
 if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('Punto LPS inválido');
 const {coincidenceMm,nearMm}=tolerances;
 if(!Number.isFinite(coincidenceMm)||!Number.isFinite(nearMm)||coincidenceMm<0||nearMm<coincidenceMm)throw Error('Tolerancias inválidas');
 const d=sub(p,g.p),i=dot(d,g.r)/g.s[1],j=dot(d,g.c)/g.s[0],distance=dot(d,g.n);
 const inField=i>=0&&j>=0&&i<=g.cols-1&&j<=g.rows-1,inPlane=Math.abs(distance)<=coincidenceMm,nearPlane=Math.abs(distance)<=nearMm;
 return {i,j,distance,inField,inPlane,nearPlane,status:!inField?'FUERA DE CAMPO':inPlane?'EN PLANO':nearPlane?'PROYECCIÓN CERCANA':'PROYECCIÓN LEJANA'};
}
export function correspondence(a,b){
 const warning='Referencia geométrica; movimiento/apnea no registrados. TIEMPO NO VALIDADO';
 if(!a||!b)return {compatible:false,reason:'Geometría ausente'};
 for(const key of ['study_instance_uid','series_instance_uid','frame_of_reference_uid'])if(!a[key]||!b[key])return {compatible:false,reason:'Identidad o Frame of Reference ausente'};
 if(a.study_instance_uid!==b.study_instance_uid||a.frame_of_reference_uid!==b.frame_of_reference_uid)return {compatible:false,reason:'Estudio o Frame of Reference incompatible'};
 if(a.series_instance_uid!==b.series_instance_uid)return {compatible:false,reason:'Series distintas: requieren registro validado; FoR común insuficiente'};
 for(const key of ['temporal_position_identifier','trigger_time_ms'])if((a[key]!=null||b[key]!=null)&&a[key]!==b[key])return {compatible:false,reason:'Fotogramas de contexto temporal diferente'};
 return {compatible:true,reason:warning};
}
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
export function eligibility(frames,rows,cols,context={}){
 const reasons=[],groups=new Map();
 frames.forEach((f,index)=>{try{const g=plane(f,rows,cols),key=[...g.r,...g.c,...g.s].map(x=>x.toFixed(5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({g,index,f});}catch(e){reasons.push(e.message);}});
 const result=[...groups.values()].map(items=>{
  const g=items[0].g,sorted=items.map(x=>({...x,z:dot(sub(x.g.p,g.p),g.n)})).sort((a,b)=>a.z-b.z),steps=sorted.slice(1).map((x,i)=>x.z-sorted[i].z);
  const reason=[];if(items.length<3)reason.push('Cobertura insuficiente');
  if(steps.some(x=>x<=.01))reason.push('Posiciones repetidas: fases o contrastes sin separar');
  const step=steps.length?steps.reduce((a,b)=>a+b,0)/steps.length:0;
  if(steps.some(x=>Math.abs(x-step)>Math.max(.01,step*.01)))reason.push('Separación irregular o huecos');
  if(items.some(x=>{const d=sub(x.g.p,g.p),z=dot(d,g.n);return Math.hypot(...d.map((v,k)=>v-z*g.n[k]))>.01;}))reason.push('Desplazamiento fuera de la normal');
  const first=items[0].f;
  const identity=f=>[f.study_instance_uid,f.series_instance_uid,f.frame_of_reference_uid,f.modality,f.image_type,f.acquisition?.scan_sequence,f.acquisition?.sequence_variant,f.acquisition?.tr,f.acquisition?.te,f.acquisition?.ti,f.acquisition?.convolution_kernel,f.acquisition?.kvp,f.rescale_slope,f.rescale_intercept,f.photometric_interpretation];
  const signature=identity(first);
  const required=[first.study_instance_uid,first.series_instance_uid,first.frame_of_reference_uid,first.modality,first.image_type,...(first.modality==='MR'?[first.acquisition?.scan_sequence,first.acquisition?.tr,first.acquisition?.te]:[first.rescale_slope,first.rescale_intercept])];
  if(required.some(x=>x===null||x===undefined||x==='')||items.some(x=>JSON.stringify(identity(x.f))!==JSON.stringify(signature)))reason.push('Equivalencia de adquisición y contraste pendiente de verificar');
  if(!['MR','CT'].includes(first.modality))reason.push('Modalidad no validada para volumen');
  if(items.some(x=>/PHASE|PERFUSION|DYNAMIC/i.test(x.f.image_type||'')))reason.push('Imagen de fase/dinámica requiere validación específica');
  if(items.some(x=>x.f.motion_status==='detected'))reason.push('Movimiento detectado: requiere registro');
  if(['trigger_time_ms','temporal_position_identifier'].some(key=>new Set(items.map(x=>x.f[key]??null)).size>1))reason.push('Variación temporal requiere separación validada');
  if(/cine|perfusion|inversion|psir|localizador/.test(context.mode||''))reason.push('Modo de adquisición no validado para volumen continuo');
  const thickness=items.map(x=>Number(x.f.acquisition?.slice_thickness));
  if(thickness.some(x=>!Number.isFinite(x)||x<=0))reason.push('Espesor adquirido insuficientemente documentado');
  else if(step>Math.min(...thickness)+Math.max(.05,step*.05))reason.push('Huecos entre espesores adquiridos: no volumen continuo');
  const eligible=reason.length===0;
  const derived=items.some(x=>/DERIVED|SECONDARY/i.test(x.f.image_type||''));
  return {capabilities:eligible?['A','B','C']:['A','B'],volumeEligible:eligible,indices:sorted.map(x=>x.index),spacingMm:step,reasons:reason,sourceType:derived?'DERIVADA: reconstruye los vóxeles suministrados; interpolación del proveedor y resolución adquirida no verificadas':'ORIGINAL',motionStatus:'NO EVALUADO: no hay registro anatómico ni prueba de ausencia de movimiento',validation:'C es candidatura geométrica dentro de una serie; movimiento y fidelidad anatómica pendientes'};
 });
 return {groups:result,invalidFrames:frames.length-[...groups.values()].reduce((n,g)=>n+g.length,0),reasons:[...new Set(reasons)],temporal:'TIEMPO NO VALIDADO',derivedModel:false};
}
