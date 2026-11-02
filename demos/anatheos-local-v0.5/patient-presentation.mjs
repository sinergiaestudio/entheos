/** Display directions only. Source pixels/poses and the shared spatial contract stay intact. */
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
export function patientCamera(basis,yaw,pitch){
 const c=Math.cos(pitch),s=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 // Orbit around patient superior; camera starts anterior. Proper rotation, no mirror.
 const world={view:[sy*c,-cy*c,s],right:[cy,sy,0],up:[-sy*s,cy*s,c]};
 return Object.fromEntries(Object.entries(world).map(([k,v])=>[k,basis.map(b=>dot(v,b))]));
}
export function nativeCamera(yaw,pitch){
 const c=Math.cos(pitch),s=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 return {view:[sy*c,s,cy*c],right:[cy,0,-sy],up:[-s*sy,c,-s*cy]};
}
export function presentationCamera(prepared,yaw,pitch){
 const g=prepared.geo,basis=prepared.surveyL1?prepared.pile.basis:g?.rowCosines&&g?.columnCosines&&g?.normal?[g.rowCosines,g.columnCosines,g.normal]:null;
 return basis?patientCamera(basis,yaw,pitch):nativeCamera(yaw,pitch);
}
/** Four proper 2D rotations. No reflection or world→pixel inversion. */
export function displayToNative(turn,u,v){return turn===0?[u,v]:turn===1?[v,1-u]:turn===2?[1-u,1-v]:[1-v,u];}
export function nativeToDisplay(turn,u,v){return displayToNative((4-turn)%4,u,v);}
export function mprPresentation(basis,axes,spanMm){
 const [a,b]=axes.map(k=>basis[k]),neg=v=>v.map(x=>-x);
 const candidates=[[a,b],[neg(b),a],[neg(a),neg(b)],[b,neg(a)]];
 const superior=Math.max(Math.abs(a[2]),Math.abs(b[2]))>.1;
 const score=([,down])=>superior?-down[2]:down[1]; // superior up; axial anterior up
 let turn=0;for(let k=1;k<4;k++)if(score(candidates[k])>score(candidates[turn])+1e-10)turn=k;
 return {turn,right:candidates[turn][0],down:candidates[turn][1],spanMm:turn%2?[...spanMm].reverse():spanMm};
}

export function patientDirection(v){const names=[['R','L'],['A','P'],['I','S']],k=v.map(Math.abs).indexOf(Math.max(...v.map(Math.abs)));return names[k][v[k]>=0?1:0];}
