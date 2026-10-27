/** ANATHEOS v0.5: strictly local, research-only triangulated surface input.
 * STL has no units or handedness: retain coordinates verbatim, never auto-align to MRI.
 */
export const MAX_TRIANGLES_PER_MESH=450_000;
export const MAX_MESH_BYTES=40*1024*1024;
export const MAX_SCENE_TRIANGLES=850_000;
const finite=(n)=>Number.isFinite(n)&&Math.abs(n)<1e8;
function ensure(ok,message){if(!ok)throw new Error(message);}
function fromTriangles(flat,sourceFormat){
 ensure(flat.length>=9&&flat.length%9===0,'Malla vacía o número de vértices inválido');
 const count=flat.length/9;
 ensure(count<=MAX_TRIANGLES_PER_MESH,`Límite de ${MAX_TRIANGLES_PER_MESH} triángulos por estructura`);
 const positions=new Float32Array(flat.length),normals=new Float32Array(flat.length);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let nonDegenerate=0;
 for(let i=0;i<flat.length;i+=9){
  for(let k=0;k<9;k++){const v=Number(flat[i+k]);ensure(finite(v),'Coordenada NaN, infinita o fuera de escala');positions[i+k]=v;min[k%3]=Math.min(min[k%3],v);max[k%3]=Math.max(max[k%3],v);}
  const ax=positions[i+3]-positions[i],ay=positions[i+4]-positions[i+1],az=positions[i+5]-positions[i+2];
  const bx=positions[i+6]-positions[i],by=positions[i+7]-positions[i+1],bz=positions[i+8]-positions[i+2];
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,mag=Math.hypot(nx,ny,nz);
  if(mag>1e-12){nonDegenerate++;for(let v=0;v<3;v++){normals[i+v*3]=nx/mag;normals[i+v*3+1]=ny/mag;normals[i+v*3+2]=nz/mag;}}
 }
 ensure(nonDegenerate>0,'La malla sólo contiene triángulos degenerados');
 return {positions,normals,triangles:count,nonDegenerate,bounds:{min,max},sourceFormat};
}
export function parseSTL(buffer){
 ensure(buffer instanceof ArrayBuffer,'STL requiere ArrayBuffer');
 ensure(buffer.byteLength<=MAX_MESH_BYTES,'Archivo STL mayor al límite de 40 MiB');
 const view=new DataView(buffer);let binary=false,n=0;
 if(buffer.byteLength>=84){n=view.getUint32(80,true);binary=n>0 && n<=MAX_TRIANGLES_PER_MESH && 84+n*50===buffer.byteLength;}
 if(binary){
  const values=new Float32Array(n*9);for(let t=0;t<n;t++){const p=84+t*50+12;for(let j=0;j<9;j++)values[t*9+j]=view.getFloat32(p+j*4,true);}
  return fromTriangles(values,'STL binario');
 }
 const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
 ensure(/^\s*solid\b/i.test(text),'STL inválido: tamaño binario incorrecto o encabezado ASCII ausente');
 const lines=text.split(/\r?\n/),vertices=[];let current=[];let facets=0;
 for(const line of lines){const m=/^\s*vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s*$/i.exec(line);
  if(m){current.push(...m.slice(1).map(Number));if(current.length===9){vertices.push(...current);current=[];facets++;ensure(facets<=MAX_TRIANGLES_PER_MESH,'Demasiados triángulos');}}}
 ensure(current.length===0,'STL ASCII truncado');
 return fromTriangles(vertices,'STL ASCII');
}
export function parseOBJ(text){
 ensure(typeof text==='string'&&text.length<=MAX_MESH_BYTES,'OBJ vacío o demasiado grande');
 const verts=[],triangles=[];let faces=0;
 for(const line of text.split(/\r?\n/)){
  const t=line.trim();if(t.startsWith('v ')){
   const a=t.split(/\s+/).slice(1,4).map(Number);ensure(a.length===3&&a.every(finite),'Vértice OBJ inválido');verts.push(a);
  } else if(t.startsWith('f ')){
   const ids=t.split(/\s+/).slice(1).map(s=>{const v=Number(s.split('/')[0]);ensure(Number.isInteger(v)&&v!==0,'Índice OBJ inválido');const i=v>0?v-1:verts.length+v;ensure(i>=0&&i<verts.length,'Índice OBJ fuera de rango');return i;});
   ensure(ids.length>=3&&ids.length<=100,'Polígono OBJ inválido');for(let k=1;k<ids.length-1;k++){
    triangles.push(...verts[ids[0]],...verts[ids[k]],...verts[ids[k+1]]);faces++;ensure(faces<=MAX_TRIANGLES_PER_MESH,'Demasiados triángulos');
   }
  }
 }
 return fromTriangles(triangles,'OBJ triangulado');
}
export function loadSurface(name,arrayBuffer){const ext=name.toLowerCase().split('.').pop();
 if(ext==='stl')return parseSTL(arrayBuffer);
 if(ext==='obj')return parseOBJ(new TextDecoder('utf-8',{fatal:true}).decode(arrayBuffer));
 throw new Error('Sólo STL u OBJ. Para VTK/VTP, convertir localmente desde Slicer, conservando origen y coordenadas.');
}
export function sceneBounds(meshes){
 ensure(meshes.length>0,'Escena sin estructuras');const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const m of meshes){for(let k=0;k<3;k++){min[k]=Math.min(min[k],m.bounds.min[k]);max[k]=Math.max(max[k],m.bounds.max[k]);}}
 const extent=max.map((v,i)=>v-min[i]);const scale=Math.max(...extent);ensure(scale>1e-8,'Malla de extensión nula');
 return {min,max,center:min.map((v,i)=>(v+max[i])/2),extent,scale};
}
