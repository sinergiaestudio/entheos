import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceViewport,surfaceOrbitDrag,projectedSurfacePoint,sortTransparentSurfaces} from './surface-renderer.mjs';

test('canvas backing pixels and aspect follow CSS size in focus/fullscreen and mobile',()=>{
 for(const [width,height,dpr] of [[980,550,1],[1550,800,1.5],[420,280,2],[320,700,1]]){
  const v=surfaceViewport(width,height,dpr);
  assert.equal(v.pixelsW,Math.round(width*Math.min(1.5,dpr)));
  assert.equal(v.pixelsH,Math.round(height*Math.min(1.5,dpr)));
  assert.equal(v.aspect,v.pixelsW/v.pixelsH);
  assert.equal(v.fit,Math.min(1,v.aspect));
  const pX=projectedSurfacePoint([1,0,0],0,0,v.aspect,1);
  const pY=projectedSurfacePoint([0,1,0],0,0,v.aspect,1);
  // x/y world distances must have equal projected pixel distances, no warp.
  assert(Math.abs(pX[0]*v.pixelsW-pY[1]*v.pixelsH)<1e-7);
 }
 assert.throws(()=>surfaceViewport(0,500),/inválido/);
});
test('drag rotation is intuitive, reversible and pitch-clamped',()=>{
 const start={yaw:.5,pitch:.18};
 const right=surfaceOrbitDrag(start.yaw,start.pitch,100,0);
 assert(right.yaw<start.yaw);
 const restored=surfaceOrbitDrag(right.yaw,right.pitch,-100,0);
 assert(Math.abs(restored.yaw-start.yaw)<1e-9);
 const down=surfaceOrbitDrag(start.yaw,start.pitch,0,80);
 assert(down.pitch<start.pitch);
 assert.equal(surfaceOrbitDrag(0,1,0,-1000).pitch,1.45);
 assert.equal(surfaceOrbitDrag(0,-1,0,1000).pitch,-1.45);
});
test('actual rotation changes projected surface without reversing physical mesh',()=>{
 const a=projectedSurfacePoint([0,0,-1],0,0,1,1);
 const drag=surfaceOrbitDrag(0,0,50,0);
 const b=projectedSurfacePoint([0,0,-1],drag.yaw,drag.pitch,1,1);
 assert(b[0]>a[0],'dragging right moves near side right in screen space');
});
test('transparent meshes render back-to-front in camera-space, not import order',()=>{
 const a={bounds:{min:[-1,-1,-2],max:[1,1,-1]}};
 const b={bounds:{min:[-1,-1,1],max:[1,1,2]}};
 const ordered=sortTransparentSurfaces([a,b],{center:[0,0,0]},0,0);
 assert.deepEqual(ordered,[b,a]);
 const flipped=sortTransparentSurfaces([a,b],{center:[0,0,0]},Math.PI,0);
 assert.deepEqual(flipped,[a,b]);
});
