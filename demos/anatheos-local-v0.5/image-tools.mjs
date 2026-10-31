export function planarDistanceMm(a,b,spacing){
 if(!Array.isArray(spacing)||spacing.length!==2||spacing.some(x=>!Number.isFinite(x)||x<=0))throw Error('PixelSpacing inválido');
 return Math.hypot((b[0]-a[0])*spacing[1],(b[1]-a[1])*spacing[0]);
}
