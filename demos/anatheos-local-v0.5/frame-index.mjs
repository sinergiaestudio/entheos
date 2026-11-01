/** Original frame indexing; no interpolation or temporal validation. */
const position=f=>{
 const a=f?.image_orientation_patient_LPS,p=f?.image_position_patient_LPS_mm;
 if(!Array.isArray(a)||a.length!==6||!Array.isArray(p)||p.length!==3)return null;
 const [r1,r2,r3,c1,c2,c3]=a.map(Number),n=[r2*c3-r3*c2,r3*c1-r1*c3,r1*c2-r2*c1];
 const v=p.reduce((s,x,i)=>s+Number(x)*n[i],0);return Number.isFinite(v)?v:null;
};
const orientation=f=>Array.isArray(f?.image_orientation_patient_LPS)&&f.image_orientation_patient_LPS.length===6?
 f.image_orientation_patient_LPS.map(x=>Number(x).toFixed(3)).join(','):'sin_orientacion';
const anatomical=f=>{
 const a=f?.image_orientation_patient_LPS;if(!Array.isArray(a)||a.length!==6)return 'Sin orientación';
 const [r1,r2,r3,c1,c2,c3]=a.map(Number),n=[Math.abs(r2*c3-r3*c2),Math.abs(r3*c1-r1*c3),Math.abs(r1*c2-r2*c1)],i=n.indexOf(Math.max(...n));
 return n[i]>=.94?['Sagital','Coronal','Axial'][i]:'Oblicua';
};
export function organize(frames){
 const byOri=new Map();
 frames.forEach((f,i)=>{
  const key=orientation(f);if(!byOri.has(key))byOri.set(key,{label:anatomical(f),positionMap:new Map()});
  const group=byOri.get(key),pos=position(f),pk=pos===null?'unknown':pos.toFixed(2);
  if(!group.positionMap.has(pk))group.positionMap.set(pk,{pos,indices:[]});group.positionMap.get(pk).indices.push(i);
 });
 return [...byOri.values()].map(g=>({label:g.label,planes:[...g.positionMap.values()].sort((a,b)=>(a.pos??0)-(b.pos??0)).map(p=>{
  const key=i=>frames[i].temporal_position_identifier??frames[i].trigger_time_ms??frames[i].instance_number??i;
  p.indices.sort((a,b)=>Number(key(a))-Number(key(b))||a-b);return p;
 })}));
}
