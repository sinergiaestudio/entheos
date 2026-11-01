/** Existing ANATHEOS JS functions vs Python AFE vs independent analytic formula.
 * This is a synthetic cross-check only; no edit to production JS.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plane,pixelToLps,lpsToPixel} from '../../../demos/anatheos-local-v0.5/spatial-reference.mjs';
const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(data.schema,'afe-synthetic-interop-v1');
const dist=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const metric={cases:0,samples:0,maxJsVsAnalyticMm:0,maxAfeVsAnalyticMm:0,
  maxAfeInverseErrorVoxel:0,maxJsInverseOrthonormalErrorVoxel:0,
  maxJsInverseSkewErrorVoxel:0,maxNormalError:0};
for(const c of data.cases){
 assert.deepEqual(c.sourceIndices,c.expectedOrder);
 metric.cases++;
 for(const s of c.samples){
  metric.samples++;
  const g=plane(s.frame,32,48);
  const js= pixelToLps(g,s.column,s.row);
  const actualPoint=s.expectedPoint;
  metric.maxJsVsAnalyticMm=Math.max(metric.maxJsVsAnalyticMm,dist(js,actualPoint));
  metric.maxAfeVsAnalyticMm=Math.max(metric.maxAfeVsAnalyticMm,dist(s.pythonPoint,actualPoint));
  metric.maxAfeInverseErrorVoxel=Math.max(metric.maxAfeInverseErrorVoxel,
    dist(s.pythonInverse,[s.column,s.row,s.slice]));
  const inverse=lpsToPixel(g,actualPoint);
  // Legacy projection may classify rounded-skew edge pixels outside FOV.
  // Preserve the numerical discrepancy for audit instead of changing JS.
  const error=Math.max(Math.abs(inverse.i-s.column),Math.abs(inverse.j-s.row));
  if(c.label==='accepted-rounded-skew'){
   metric.maxJsInverseSkewErrorVoxel=Math.max(metric.maxJsInverseSkewErrorVoxel,error);
  } else {
   metric.maxJsInverseOrthonormalErrorVoxel=Math.max(metric.maxJsInverseOrthonormalErrorVoxel,error);
  }
  const nn=cross(g.r,g.c), mag=Math.hypot(...nn);
  metric.maxNormalError=Math.max(metric.maxNormalError,dist(nn.map(x=>x/mag),s.analyticNormal));
  assert.deepEqual(s.rasPoint,[-actualPoint[0],-actualPoint[1],actualPoint[2]]);
 }
}
assert.equal(metric.cases,5);assert.equal(metric.samples,20);
assert(metric.maxJsVsAnalyticMm<1e-9,'JS forward pixel-to-LPS discrepancy');
assert(metric.maxAfeVsAnalyticMm<1e-9,'Python forward discrepancy');
assert(metric.maxAfeInverseErrorVoxel<1e-9,'Python full affine inverse discrepancy');
assert(metric.maxJsInverseOrthonormalErrorVoxel<1e-8,'JS inverse orthonormal discrepancy');
assert(metric.maxNormalError<1e-10,'normal discrepancy');
assert(metric.maxJsInverseSkewErrorVoxel>1e-4,'expected JS projection limitation not reproduced');
assert(metric.maxJsInverseSkewErrorVoxel<0.01,'JS projection discrepancy larger than engineered note');
console.log('AFE_JS_INDEPENDENT_CROSSCHECK_PASS '+JSON.stringify(metric));
// IMPORTANT: The legacy JS inverse is deliberately projection-based; in the
// rounded-skew case it differs. Do not silently "fix" it in PR #74 or #73.
