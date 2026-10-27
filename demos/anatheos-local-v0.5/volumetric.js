/* ANATHEOS 3D v0.2 — genuine DESS voxel volume GPU ray casting.
 * Original DICOM spatial sorting and pixel values from v0.1. Pure local WebGL2.
 * 8-bit display texture is a visualization rescale: NOT diagnostic fidelity.
 * World x/y/z correspond to DICOM column/row/normal axes and true mm aspect,
 * NOT certified clinical patient-facing L/R labels. No external dependencies.
 */
function ensure(test,reason){if(!test)throw new Error(reason);}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const volumeDot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function inspectVolumeGeometry(series){
 ensure(series&&series.items&&series.items.length>=2,'Se requieren al menos dos cortes para construir un volumen.');
 const frames=series.items,one=frames[0],normal=cross(one.iop.slice(0,3),one.iop.slice(3));
 ensure(Math.abs(norm(normal)-1)<0.004,'Las direcciones DICOM no definen una base ortogonal.');
 ensure(one.spacing.length===2&&one.spacing.every(v=>Number.isFinite(v)&&v>0),'PixelSpacing inválido.');
 ensure(frames.length<=1024 && one.rows<=2048 && one.columns<=2048,'El volumen excede los límites de seguridad del visor experimental.');
 const baseProj=volumeDot(one.ipp,normal),step=series.spacingBetween;
 ensure(Number.isFinite(step)&&step>0.001,'SliceSpacing no positivo o indefinido.');
 for(let i=0;i<frames.length;i++){
  const item=frames[i];
  ensure(item.columns===one.columns&&item.rows===one.rows,'Dimensiones distintas entre cortes.');
  ensure(item.iop.every((v,k)=>Math.abs(v-one.iop[k])<0.0003),'ImageOrientationPatient varía entre cortes.');
  ensure(item.spacing.every((v,k)=>Math.abs(v-one.spacing[k])<0.001),'PixelSpacing variable.');
  const dx=item.ipp.map((v,k)=>v-one.ipp[k]),along=volumeDot(dx,normal),inPlane=dx.map((v,k)=>v-along*normal[k]);
  ensure(norm(inPlane)<=0.1,'Cortes con desplazamiento lateral (gantry tilt): requiere remuestreo.');
  ensure(Math.abs(volumeDot(item.ipp,normal)-(baseProj+i*step))<=Math.max(0.05,step*0.07),
    'Posiciones irregulares: faltan cortes o hay intervalos distintos.');
 }
 const span=[one.columns*one.spacing[1],one.rows*one.spacing[0],(frames.length-1)*step];
 return {x:one.columns,y:one.rows,z:frames.length,spanMm:span,normal,stepMm:step,originLps:one.ipp,
  rowCosines:one.iop.slice(0,3),columnCosines:one.iop.slice(3)};
}
// Uses the full raw stack to compute a deterministic fixed R8 intensity mapping.
// 2D pixels remain unchanged in Int32Array; R8 is solely for interactive GPU 3D.
export async function prepareVolumeTexture(series,progress=()=>{},cancel=()=>false){
 const geo=inspectVolumeGeometry(series),frames=series.items;
 let lo=Infinity,hi=-Infinity;
 for(let z=0;z<frames.length;z++){
  if(cancel())throw Error('Preparación del volumen cancelada.');
  const f=frames[z];
  for(let k=0;k<f.values.length;k+=7){const v=f.values[k]*f.slope+f.intercept;lo=Math.min(lo,v);hi=Math.max(hi,v);}
 }
 ensure(Number.isFinite(lo)&&hi>lo,'Intensidad del volumen uniforme o inválida.');
 const output=new Uint8Array(geo.x*geo.y*geo.z),span=hi-lo;
 for(let z=0;z<frames.length;z++){
  if(cancel())throw Error('Preparación del volumen cancelada.');
  const f=frames[z],base=z*f.values.length;
  for(let k=0;k<f.values.length;k++){
   const v=(f.values[k]*f.slope+f.intercept-lo)/span;
   output[base+k]=Math.round(Math.max(0,Math.min(1,v))*255);
  }
  if(z%8===7||z===frames.length-1){progress(z+1,frames.length);await new Promise(r=>setTimeout(r,0));}
 }
 return {geo,output,rawRange:[lo,hi],textureBytes:output.byteLength};
}
const VERT=`#version 300 es
in vec2 aPosition;
out vec2 uv;
void main(){uv=aPosition;gl_Position=vec4(aPosition,0.,1.);}`;
const FRAG=`#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 uv;
out vec4 pixel;
uniform sampler3D uVolume;
uniform sampler3D uLabels;
uniform int uHasLabels;
uniform int uLabelShow;
uniform float uLabelOpacity;
uniform vec3 uHalf;
uniform vec3 uView;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uAspect;
uniform float uZoom;
uniform float uThreshold;
uniform float uOpacity;
uniform float uClip;
uniform int uPalette;
uniform float uWindowLow;
uniform float uWindowHigh;
uniform int uSteps;
vec2 hitBox(vec3 o,vec3 d,vec3 halfs){
 vec3 inv=1./d;
 vec3 t0=(-halfs-o)*inv,t1=(halfs-o)*inv;
 vec3 near=min(t0,t1),far=max(t0,t1);
 return vec2(max(max(near.x,near.y),near.z),min(min(far.x,far.y),far.z));
}
void main(){
 vec3 rd=-normalize(uView);
 vec3 origin=uView*2.2+(uRight*uv.x*uAspect+uUp*uv.y)*1.25/uZoom;
 vec2 interval=hitBox(origin,rd,uHalf);
 float t=max(interval.x,0.);
 if(interval.y<=t){pixel=vec4(.06,.07,.085,1.);return;}
 float rayLength=interval.y-t;
 vec3 rgb=vec3(0.);
 float accumulated=0.;
 int steps=clamp(uSteps,30,360);
 for(int i=0;i<360;i++){
  if(i>=steps)break;
  vec3 p=origin+rd*(t+(float(i)+.5)*rayLength/float(steps));
  vec3 coords=p/(2.*uHalf)+vec3(.5);
  if(coords.z > uClip) continue;
  float value=texture(uVolume,coords).r;
  // Window/Level operate on the fixed display-intensity mapping (0..1).
  float visible=clamp((value-uWindowLow)/max(uWindowHigh-uWindowLow,.005),0.,1.);
  float response=clamp((visible-uThreshold)/max(1.-uThreshold,.04),0.,1.);
  float a=clamp(response*uOpacity*10.0/float(steps),0.,.09);
  float luminance=.60+.40*visible;
  vec3 tissue=uPalette==0 ? vec3(1.) : mix(vec3(.62,.70,.77),vec3(.95,.88,.79),visible);
  if(uHasLabels==1){
   int label=int(floor(texture(uLabels,coords).r*255.0+.5));
   if(label>=1&&label<=3&&((uLabelShow&(1<<(label-1)))!=0)){
    vec3 region=label==1?vec3(.985,.42,.51):label==2?vec3(.392,.839,.894):vec3(.969,.776,.42);
    tissue=mix(tissue,region,.92);
    luminance=1.0;
    a=max(a,.16*uLabelOpacity);
   }
  }
  rgb+=(1.-accumulated)*a*tissue*luminance;
  accumulated+=(1.-accumulated)*a;
  if(accumulated>.985)break;
 }
 pixel=vec4(rgb+(1.-accumulated)*vec3(.06,.07,.085),1.);
}`;
function compile(gl,type,source){const s=gl.createShader(type);ensure(s,'No se pudo crear shader.');gl.shaderSource(s,source);gl.compileShader(s);ensure(gl.getShaderParameter(s,gl.COMPILE_STATUS),'Error del shader volumétrico: '+gl.getShaderInfoLog(s));return s;}
function createProgram(gl){const p=gl.createProgram();ensure(p,'No se pudo crear programa WebGL.');gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);ensure(gl.getProgramParameter(p,gl.LINK_STATUS),'No se pudo vincular el shader volumétrico: '+gl.getProgramInfoLog(p));return p;}
export class VolumeRenderer {
 constructor(canvas,prepared){
  this.canvas=canvas;this.prepared=prepared;this.yaw=.55;this.pitch=.32;this.zoom=1.55;this.preview=false;
  this.threshold=.07;this.opacity=1.5;this.steps=220;this.low=0;this.high=1;this.clip=1;this.palette=0;
  this.mask=null;this.maskTexture=null;this.labelVisibility=7;this.labelOpacity=.75;
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  this.gl=gl;
  this.backend=gl?'WebGL2 (GPU)':'CPU (respaldo local)';
  if(!gl){
   this.cpu=canvas.getContext('2d',{alpha:false});
   ensure(this.cpu,'El navegador no ofrece Canvas 2D ni WebGL2.');
   const m=Math.max(...prepared.geo.spanMm);
   this.half=prepared.geo.spanMm.map(v=>.5*v/m);
   this.draw();return;
  }
  const {geo,output}=prepared;
  ensure(geo.x<=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)&&geo.y<=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)&&geo.z<=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE),'El volumen excede el límite de textura 3D de la GPU.');
  this.program=createProgram(gl);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(this.program,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,this.texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,geo.x,geo.y,geo.z,0,gl.RED,gl.UNSIGNED_BYTE,output);
  ensure(gl.getError()===gl.NO_ERROR,'No se pudo transferir el volumen a la GPU.');
  this.locations={};for(const name of ['uLabels','uHasLabels','uLabelShow','uLabelOpacity','uVolume','uHalf','uView','uRight','uUp','uAspect','uZoom','uThreshold','uOpacity','uWindowLow','uWindowHigh','uSteps','uClip','uPalette'])this.locations[name]=gl.getUniformLocation(this.program,name);
  const m=Math.max(...geo.spanMm);this.half=geo.spanMm.map(v=>.5*v/m);
  this.draw();
 }
 setSegmentation(mask, visibility=7){
  const {geo}=this.prepared;
  if(mask && (mask.x!==geo.x||mask.y!==geo.y||mask.z!==geo.z))throw Error('Dimensiones de máscara incompatibles');
  this.mask=mask;this.labelVisibility=visibility;
  const gl=this.gl;
  if(gl){
   if(this.maskTexture){gl.deleteTexture(this.maskTexture);this.maskTexture=null;}
   if(mask){
    this.maskTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,this.maskTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,geo.x,geo.y,geo.z,0,gl.RED,gl.UNSIGNED_BYTE,mask.data);
    ensure(gl.getError()===gl.NO_ERROR,'No se pudo transferir la máscara a la GPU');
   }
  }
  this.draw();
 }
 draw(){const gl=this.gl;if(!gl){this.drawSoftware();return;}if(gl.isContextLost())return;
  const rect=this.canvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.25)*(this.preview?.58:1);
  const w=Math.max(100,Math.min(1360,Math.round(rect.width*scale))),h=Math.max(100,Math.min(900,Math.round(rect.height*scale)));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  gl.viewport(0,0,w,h);gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.texture);
  const yaw=this.yaw,pitch=this.pitch,v=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const right=[Math.cos(yaw),0,-Math.sin(yaw)];const up=cross(v,right);
  const u=this.locations;
  gl.uniform1i(u.uHasLabels,this.maskTexture?1:0);
  gl.uniform1i(u.uLabelShow,this.labelVisibility);
  gl.uniform1f(u.uLabelOpacity,this.labelOpacity);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,this.maskTexture);
  gl.uniform1i(u.uLabels,1);
  gl.uniform1i(u.uVolume,0);gl.uniform3fv(u.uHalf,this.half);gl.uniform3fv(u.uView,v);gl.uniform3fv(u.uRight,right);gl.uniform3fv(u.uUp,up);
  gl.uniform1f(u.uAspect,w/h);gl.uniform1f(u.uZoom,this.zoom);gl.uniform1f(u.uThreshold,this.threshold);gl.uniform1f(u.uOpacity,this.opacity);
  gl.uniform1f(u.uWindowLow,this.low);gl.uniform1f(u.uWindowHigh,this.high);gl.uniform1i(u.uSteps,this.steps);
  gl.uniform1f(u.uClip,this.clip);gl.uniform1i(u.uPalette,this.palette);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 drawSoftware(){
  const context=this.cpu,canvas=this.canvas,rect=canvas.getBoundingClientRect();
  const w=Math.max(160,Math.min(this.preview?320:460,Math.round(rect.width*(this.preview?.48:.65))));
  const h=Math.max(120,Math.min(this.preview?230:310,Math.round(rect.height*(this.preview?.48:.65))));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const {x:nx,y:ny,z:nz}=this.prepared.geo,voxels=this.prepared.output,halfs=this.half;
  const yaw=this.yaw,pitch=this.pitch,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const dir=[-sy*cp,-sp,-cy*cp],view=dir.map(v=>-v),right=[cy,0,-sy];
  const up=[-sp*sy,cp,-sp*cy];
  const result=context.createImageData(w,h),pixels=result.data;
  const steps=Math.min(140,Math.max(40,Math.round(this.steps*.6)));
  const zoom=this.zoom,threshold=this.threshold,opacity=this.opacity;
  const low=this.low,high=this.high,width=Math.max(high-low,.005);
  const sx=(2/w)*w/h*1.25/zoom,syy=(2/h)*1.25/zoom;
  for(let j=0;j<h;j++){
   const py=(h-1-2*j)*.5*syy;
   for(let i=0;i<w;i++){
    const px=(2*i+1-w)*.5*sx;
    const o0=view[0]*2.2+right[0]*px+up[0]*py;
    const o1=view[1]*2.2+right[1]*px+up[1]*py;
    const o2=view[2]*2.2+right[2]*px+up[2]*py;
    let near=-Infinity,far=Infinity;
    for(let axis=0;axis<3;axis++){
     const o=axis===0?o0:axis===1?o1:o2,d=dir[axis],box=halfs[axis];
     if(Math.abs(d)<1e-9){if(o<-box||o>box){far=-Infinity;break;}continue;}
     const a=(-box-o)/d,b=(box-o)/d;
     near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
    }
    const pos=(j*w+i)*4;
    let r=15,g=18,b=22;
    if(far>Math.max(near,0)){
     let acc=0,rr=0,gg=0,bb=0;
     const entry=Math.max(near,0),len=far-entry;
     for(let k=0;k<steps;k++){
      const t=entry+(k+.5)*len/steps;
      const vx=(o0+dir[0]*t)/(2*halfs[0])+.5;
      const vy=(o1+dir[1]*t)/(2*halfs[1])+.5;
      const vz=(o2+dir[2]*t)/(2*halfs[2])+.5;
      const ix=Math.min(nx-1,Math.max(0,Math.floor(vx*nx)));
      const iy=Math.min(ny-1,Math.max(0,Math.floor(vy*ny)));
      const iz=Math.min(nz-1,Math.max(0,Math.floor(vz*nz)));
      if(vz>this.clip)continue;
      const val=voxels[(iz*ny+iy)*nx+ix]/255;
      const visible=Math.max(0,Math.min(1,(val-low)/width));
      const response=Math.max(0,Math.min(1,(visible-threshold)/Math.max(1-threshold,.04)));
      let alpha=Math.min(.09,response*opacity*10/steps);
      let luminance=.60+.40*visible;
      let red=this.palette===0?1:(.62+(.95-.62)*visible);
      let green=this.palette===0?1:(.70+(.88-.70)*visible);
      let blue=this.palette===0?1:(.77+(.79-.77)*visible);
      if(this.mask){
       const id=this.mask.data[(iz*ny+iy)*nx+ix];
       if(id>=1&&id<=3&&(this.labelVisibility&(1<<(id-1)))){
        const c=id===1?[.985,.42,.51]:id===2?[.392,.839,.894]:[.969,.776,.42];
        red=.08*red+.92*c[0];green=.08*green+.92*c[1];blue=.08*blue+.92*c[2];
        alpha=Math.max(alpha,.16*this.labelOpacity);luminance=1;
       }
      }
      const one=(1-acc)*alpha*luminance;
      rr+=one*red;
      gg+=one*green;
      bb+=one*blue;
      acc+=(1-acc)*alpha;
      if(acc>.985)break;
     }
     r=Math.round(255*(rr+(1-acc)*.06));
     g=Math.round(255*(gg+(1-acc)*.07));
     b=Math.round(255*(bb+(1-acc)*.085));
    }
    pixels[pos]=r;pixels[pos+1]=g;pixels[pos+2]=b;pixels[pos+3]=255;
   }
  }
  context.putImageData(result,0,0);
 }
 dispose(){if(this.gl){if(this.maskTexture)this.gl.deleteTexture(this.maskTexture);this.gl.deleteTexture(this.texture);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.gl=null;}this.prepared=null;}
}
