import {sceneBounds} from './surface-core.mjs';
/** Viewport-specific parameters are derived from CSS pixels on EVERY draw.
 * This prevents horizontally/vertically stretched screenshots in fullscreen,
 * split-view and focus-mode, even when fullscreenchange doesn't resize window.
 */
export function surfaceViewport(width,height,dpr=1){
 if(![width,height,dpr].every(Number.isFinite)||width<=0||height<=0||dpr<=0)throw Error('Viewport de superficie inválido');
 const ratio=Math.min(dpr,1.5);
 const pixelsW=Math.max(1,Math.round(width*ratio));
 const pixelsH=Math.max(1,Math.round(height*ratio));
 return {pixelsW,pixelsH,aspect:pixelsW/pixelsH,fit:Math.min(1,pixelsW/pixelsH)};
}
/** Trackball-style object drag: dragging right/down moves the near-facing
 * surface right/down. Intentionally opposite to changing camera orientation.
 */
export function surfaceOrbitDrag(yaw,pitch,deltaX,deltaY,sensitivity=.008){
 if(![yaw,pitch,deltaX,deltaY,sensitivity].every(Number.isFinite))throw Error('Arrastre inválido');
 return {yaw:yaw-deltaX*sensitivity,pitch:Math.min(1.45,Math.max(-1.45,pitch-deltaY*sensitivity))};
}
export function projectedSurfacePoint(point,yaw,pitch,aspect,zoom){
 if(!point?.every(Number.isFinite)||point.length!==3||![yaw,pitch,aspect,zoom].every(Number.isFinite)||aspect<=0)throw Error('Proyección inválida');
 const [x,y,z]=point,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const ox=cy*x+sy*z,oz=-sy*x+cy*z,oy=cp*y-sp*oz;
 const fit=Math.min(1,aspect);
 return [ox*zoom*fit/aspect,oy*zoom*fit,(sp*y+cp*oz)*.42];
}
export function sortTransparentSurfaces(items,bounds,yaw,pitch,basis=[1,0,0,0,1,0,0,0,1]){
 const c=bounds.center,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const z=mesh=>{
  const v=mesh.bounds.min.map((low,k)=>(low+mesh.bounds.max[k])/2-c[k]);
  const center=[0,1,2].map(k=>basis[k]*v[0]+basis[3+k]*v[1]+basis[6+k]*v[2]);
  return sp*center[1]+cp*(-sy*center[0]+cy*center[2]);
 };
 return [...items].sort((a,b)=>z(b)-z(a));
}
const vs=`#version 300 es
in vec3 aPos;in vec3 aNormal;in vec2 aUv;
uniform vec3 uCenter;uniform float uScale,uYaw,uPitch,uZoom,uAspect;
uniform mat3 uBasis;out vec3 vNormal;out vec2 vUv;
vec3 orient(vec3 v){v=uBasis*v;float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);vec3 a=vec3(cy*v.x+sy*v.z,v.y,-sy*v.x+cy*v.z);return vec3(a.x,cp*a.y-sp*a.z,sp*a.y+cp*a.z);}
void main(){vec3 p=orient((aPos-uCenter)/uScale);vNormal=orient(aNormal);vUv=aUv;gl_Position=vec4(p.x*uZoom/uAspect,p.y*uZoom,p.z*.42,1.);}`;
const fs=`#version 300 es
precision highp float;in vec3 vNormal;in vec2 vUv;uniform sampler2D uImage;uniform int uMode;uniform vec4 uColor;uniform int uSelected;out vec4 outputColor;
void main(){if(uMode==1){float g=texture(uImage,vUv).r;outputColor=vec4(vec3(g),uColor.a);return;}if(uMode==2){outputColor=uColor;return;}vec3 n=normalize(vNormal);float diffuse=.35+.65*abs(dot(n,normalize(vec3(.3,.6,1.))));vec3 c=uColor.rgb*diffuse;if(uSelected==1)c=mix(c,vec3(1.),.22);outputColor=vec4(c,uColor.a);}`;
function shader(gl,kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
export class SurfaceRenderer {
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('El visor de superficies requiere WebGL2 local; DICOM v0.4 permanece disponible');this.gl=gl;const prog=gl.createProgram(),v=shader(gl,gl.VERTEX_SHADER,vs),f=shader(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));this.program=prog;this.uniforms=Object.fromEntries(['uCenter','uScale','uYaw','uPitch','uZoom','uAspect','uColor','uSelected','uBasis','uMode','uImage'].map(s=>[s,gl.getUniformLocation(prog,s)]));this.basis=[1,0,0,0,1,0,0,0,1];this.meshes=[];this.yaw=.5;this.pitch=.18;this.zoom=1.6;this.selected=null;this.disposed=false;}
 add(mesh){const gl=this.gl;const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pos=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,mesh.positions,gl.STATIC_DRAW);let loc=gl.getAttribLocation(this.program,'aPos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);const nor=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nor);gl.bufferData(gl.ARRAY_BUFFER,mesh.normals,gl.STATIC_DRAW);loc=gl.getAttribLocation(this.program,'aNormal');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);const uv=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,mesh.uvs||new Float32Array(mesh.positions.length/3*2),gl.STATIC_DRAW);loc=gl.getAttribLocation(this.program,'aUv');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);let texture=null;if(mesh.grayPixels){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,mesh.width,mesh.height,0,gl.RED,gl.UNSIGNED_BYTE,mesh.grayPixels);}const item={...mesh,vao,pos,nor,uv,texture,visible:true,opacity:1,color:'#b8d7eb'};this.meshes.push(item);return item;}
 remove(items){const gl=this.gl;for(const m of items){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.pos);gl.deleteBuffer(m.nor);gl.deleteBuffer(m.uv);if(m.texture)gl.deleteTexture(m.texture);}this.meshes=this.meshes.filter(m=>!items.includes(m));}
 clear(){const gl=this.gl;for(const m of this.meshes){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.pos);gl.deleteBuffer(m.nor);gl.deleteBuffer(m.uv);if(m.texture)gl.deleteTexture(m.texture);}this.meshes=[];this.selected=null;this.draw();}
 draw(){if(this.disposed)return;const gl=this.gl,rect=this.canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const vp=surfaceViewport(rect.width,rect.height,window.devicePixelRatio||1),w=vp.pixelsW,h=vp.pixelsH;if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.045,.072,.105,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.meshes.length)return;
  const b=sceneBounds(this.meshes),u=this.uniforms;gl.useProgram(this.program);gl.uniform3fv(u.uCenter,b.center);gl.uniformMatrix3fv(u.uBasis,false,this.basis);gl.uniform1i(u.uImage,0);gl.uniform1f(u.uScale,b.scale);gl.uniform1f(u.uYaw,this.yaw);gl.uniform1f(u.uPitch,this.pitch);gl.uniform1f(u.uZoom,this.zoom*vp.fit);gl.uniform1f(u.uAspect,vp.aspect);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);
  // Original atlas STLs are not guaranteed consistently wound. Two-sided opaque
  // depth testing prevents clipped/missing faces without moving any anatomy.
  gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
  const visible=this.meshes.filter(m=>m.visible&&m.opacity>0);const opaque=visible.filter(m=>m.opacity>=.999),transparent=visible.filter(m=>m.opacity<.999);
  const paint=(m)=>{const color=m.color.replace('#','');if(!/^[\da-f]{6}$/i.test(color))return;const c=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16)/255);gl.uniform4f(u.uColor,...c,m.opacity);gl.uniform1i(u.uSelected,m===this.selected?1:0);gl.uniform1i(u.uMode,m.texture?1:m.unlit?2:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.texture);gl.bindVertexArray(m.vao);gl.drawArrays(m.primitive==='lines'?gl.LINES:gl.TRIANGLES,0,m.positions.length/3);};
  gl.depthMask(true);for(const m of opaque)paint(m);
  if(transparent.length){
   // Opaque layer writes real depth. Alpha meshes are approximate: sort by
   // camera-space Z and do NOT overwrite depth. We never alter world positions.
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.depthMask(false);
   for(const m of sortTransparentSurfaces(transparent,b,this.yaw,this.pitch,this.basis))paint(m);
   gl.depthMask(true);gl.disable(gl.BLEND);
  }
  gl.bindVertexArray(null);
 }
 dispose(){this.clear();this.gl.deleteProgram(this.program);this.disposed=true;}
}
