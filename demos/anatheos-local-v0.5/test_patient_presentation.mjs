import assert from 'node:assert/strict';
import {patientCamera,nativeCamera,mprPresentation,displayToNative,nativeToDisplay,presentationCamera} from './patient-presentation.mjs';
import {dragDistanceMm} from './survey-mpr.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
// Axial, coronal, sagittal, oblique and head-first reversed acquisitions.
const bases=[[[1,0,0],[0,1,0],[0,0,1]],[[1,0,0],[0,0,-1],[0,1,0]],[[0,1,0],[0,0,-1],[-1,0,0]],[[0,-1,0],[0,0,1],[-1,0,0]],[[.8,.6,0],[0,0,1],[.6,-.8,0]]];
for(const basis of bases)for(const yaw of [-2,.65,2])for(const pitch of [-1,.32,1]){
 const c=patientCamera(basis,yaw,pitch),s=basis.map(v=>v[2]);near(dot(c.up,s),Math.cos(pitch));assert.ok(dot(c.up,s)>0);
 near(dot(cross(c.right,c.up),c.view),1);near(dot(c.up,c.right),0);
 // A known 7mm cut displacement projected by THIS camera recovers the same scalar.
 const normal=[1,0,0],width=1100,height=620,zoom=1.85,scale=250;
 const screen=[dot(normal,c.right)*zoom/1.25/(width/height)*width/2/scale,-dot(normal,c.up)*zoom/1.25*height/2/scale];
 near(dragDistanceMm(screen.map(v=>v*7),normal,yaw,pitch,width,height,zoom,scale,c),7);
 for(const axes of [[0,1],[1,2],[0,2]]){
  const d=mprPresentation(basis,axes,[120,300]);
  if(Math.max(...axes.map(k=>Math.abs(basis[k][2])))>.1)assert.ok(d.down[2]<0);else assert.ok(d.down[1]>=0);
  // Asymmetric landmarks and every corner; paired chart rotation, never reflection.
  for(const p of [[0,0],[1,0],[0,1],[1,1],[.17,.73]]){const q=displayToNative(d.turn,...p),r=nativeToDisplay(d.turn,...q);near(r[0],p[0]);near(r[1],p[1]);}
  const [x,y]=axes.map(k=>basis[k]);near(dot(cross(d.right,d.down),cross(x,y)),1);
 }
}
assert.deepEqual(presentationCamera({geo:{}},.3,.2),nativeCamera(.3,.2));
assert.deepEqual(presentationCamera({geo:{rowCosines:bases[1][0],columnCosines:bases[1][1],normal:bases[1][2]}},.65,.32),patientCamera(bases[1],.65,.32));
assert.ok(dot(nativeCamera(.65,.32).up,bases[1].map(b=>b[2]))<0,'Regression fixture reproduces previous upside-down default');
console.log('PATIENT_CAMERA_SUPERIOR_UP_MPR_ROTATION_CHIRALITY_CURSOR_DRAG_PASS');
