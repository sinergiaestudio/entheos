import {sceneBounds} from './surface-core.mjs';
const vs=`#version 300 es
in vec3 aPos;in vec3 aNormal;
uniform vec3 uCenter;uniform float uScale,uYaw,uPitch,uZoom,uAspect;
out vec3 vNormal;
vec3 orient(vec3 v){float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);vec3 a=vec3(cy*v.x+sy*v.z,v.y,-sy*v.x+cy*v.z);return vec3(a.x,cp*a.y-sp*a.z,sp*a.y+cp*a.z);}
void main(){vec3 p=orient((aPos-uCenter)/uScale);vNormal=orient(aNormal);gl_Position=vec4(p.x*uZoom/uAspect,p.y*uZoom,p.z*.42,1.);}`;
const fs=`#version 300 es
precision highp float;in vec3 vNormal;uniform vec4 uColor;uniform int uSelected;out vec4 outputColor;
void main(){vec3 n=normalize(vNormal);float diffuse=.35+.65*abs(dot(n,normalize(vec3(.3,.6,1.))));vec3 c=uColor.rgb*diffuse;if(uSelected==1)c=mix(c,vec3(1.),.22);outputColor=vec4(c,uColor.a);}`;
function shader(gl,kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
export class SurfaceRenderer {
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('El visor de superficies requiere WebGL2 local; DICOM v0.4 permanece disponible');this.gl=gl;const prog=gl.createProgram(),v=shader(gl,gl.VERTEX_SHADER,vs),f=shader(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));this.program=prog;this.uniforms=Object.fromEntries(['uCenter','uScale','uYaw','uPitch','uZoom','uAspect','uColor','uSelected'].map(s=>[s,gl.getUniformLocation(prog,s)]));this.meshes=[];this.yaw=.5;this.pitch=.18;this.zoom=1.6;this.selected=null;this.disposed=false;}
 add(mesh){const gl=this.gl;const vao=gl.createVertexArray();gl.bindVertexArray(vao);const pos=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,mesh.positions,gl.STATIC_DRAW);let loc=gl.getAttribLocation(this.program,'aPos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);const nor=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nor);gl.bufferData(gl.ARRAY_BUFFER,mesh.normals,gl.STATIC_DRAW);loc=gl.getAttribLocation(this.program,'aNormal');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);const item={...mesh,vao,pos,nor,visible:true,opacity:1,color:'#b8d7eb'};this.meshes.push(item);return item;}
 clear(){const gl=this.gl;for(const m of this.meshes){gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.pos);gl.deleteBuffer(m.nor);}this.meshes=[];this.selected=null;this.draw();}
 draw(){if(this.disposed)return;const gl=this.gl,rect=this.canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.045,.072,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.meshes.length)return;
  const b=sceneBounds(this.meshes),u=this.uniforms;gl.useProgram(this.program);gl.uniform3fv(u.uCenter,b.center);gl.uniform1f(u.uScale,b.scale);gl.uniform1f(u.uYaw,this.yaw);gl.uniform1f(u.uPitch,this.pitch);gl.uniform1f(u.uZoom,this.zoom);gl.uniform1f(u.uAspect,w/h);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  const visible=this.meshes.filter(m=>m.visible&&m.opacity>0);const opaque=visible.filter(m=>m.opacity>=.999),transparent=visible.filter(m=>m.opacity<.999);
  const paint=(m)=>{const color=m.color.replace('#','');if(!/^[\da-f]{6}$/i.test(color))return;const c=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16)/255);gl.uniform4f(u.uColor,...c,m.opacity);gl.uniform1i(u.uSelected,m===this.selected?1:0);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.positions.length/3);};
  gl.depthMask(true);for(const m of opaque)paint(m);gl.depthMask(false);for(const m of transparent)paint(m);gl.depthMask(true);gl.bindVertexArray(null);
 }
 dispose(){this.clear();this.gl.deleteProgram(this.program);this.disposed=true;}
}
