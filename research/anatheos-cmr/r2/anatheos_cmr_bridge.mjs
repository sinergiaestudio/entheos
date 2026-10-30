/** ANATHEOS CMR-R2 → native app, standalone read-only interoperability module.
 * No network I/O, no UI, no alteration of CMR source. Future native app importer
 * may call this only after the patient consciously selects an eligible series.
 * Do NOT feed dynamic series directly to an unordered 3D volume builder.
 */
const expect=(ok,reason)=>{if(!ok)throw Error(reason)};
const supported=new Set(['cine_provisional','perfusion_temporal','inversion_no_cine',
 'psir_multicontraste_no_cine','localizador_2d','pila_2d_revisar_3d']);
export function validateCatalog(json){
 expect(json?.schema==='anatheos-cmr-r2-private-v1' && Array.isArray(json.series),'Catálogo CMR-R2 inválido');
 expect(json.series.length<=1000,'Catálogo excede límites');
 const seen=new Set();
 for(const s of json.series){
  expect(/^RM-\d{3}$/.test(s.serie_local)&&!seen.has(s.serie_local),'Identificador de serie inválido o repetido');
  seen.add(s.serie_local);
  expect(supported.has(s.modo_seguro),'Modo de visualización no admitido');
 }
 return Object.freeze({seriesCount:json.series.length,prepared:json.series.filter(s=>s.estado==='preparada').length});
}
export function decodeNpy16(buffer){
 const d=new DataView(buffer);expect(buffer.byteLength>=16,'NPY incompleto');
 expect([147,78,85,77,80,89].every((n,i)=>d.getUint8(i)===n),'Firma NPY inválida');
 const v=d.getUint8(6);expect(v===1||v===2,'Versión NPY no admitida');
 const n=v===1?d.getUint16(8,true):d.getUint32(8,true),p=v===1?10:12;
 expect(n<10000&&p+n<buffer.byteLength,'Cabecera NPY demasiado grande');
 const hdr=new TextDecoder('ascii',{fatal:true}).decode(new Uint8Array(buffer,p,n));
 expect(/['"]descr['"]\s*:\s*['"]<u2['"]/.test(hdr) && /['"]fortran_order['"]\s*:\s*False/.test(hdr),'NPY no es uint16 LE C-contiguous');
 const match=hdr.match(/['"]shape['"]\s*:\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/);
 expect(!!match,'NPY debe ser [instancia,fila,columna]');
 const shape=match.slice(1).map(Number),count=shape.reduce((a,b)=>a*b,1),offset=p+n;
 expect(Number.isSafeInteger(count)&&count>0&&count<=170000000,'Cantidad de vóxeles inválida');
 expect(offset%2===0&&offset+count*2===buffer.byteLength,'Longitud de datos incompleta');
 return {shape,values:new Uint16Array(buffer,offset,count)};
}
function validVector(v,length){return Array.isArray(v)&&v.length===length&&v.every(x=>Number.isFinite(Number(x)))}
function scalar(v,defaultVal){if(v===null||v===undefined||v==='')return defaultVal;return Number.isFinite(Number(v))?Number(v):defaultVal;}
export function attachDecodedSeries(catalog,selectedId,geometry,npyBuffer){
 validateCatalog(catalog);
 expect(/^RM-\d{3}$/.test(selectedId),'Identificador solicitado inválido');
 const info=catalog.series.find(s=>s.serie_local===selectedId);
 expect(info?.estado==='preparada','Serie no preparada');
 expect(geometry?.serie_local===selectedId&&Array.isArray(geometry.frames),'No coincide la geometría de la serie');
 expect(geometry.schema==='anatheos-cmr-r2-private-v1' || geometry.schema==='ANATHEOS-CMR-R1-private-v1','Geometría fuera de esquema');
 const {shape,values}=decodeNpy16(npyBuffer);
 expect(shape[0]===geometry.frames.length && shape[0]===info.instancias,'Fotogramas no coinciden');
 const [n,rows,cols]=shape,plane=rows*cols;
 function getFrame(index){
  expect(Number.isInteger(index)&&index>=0&&index<n,'Fotograma fuera de rango');
  const f=geometry.frames[index];
  const iop=f.image_orientation_patient_LPS,ipp=f.image_position_patient_LPS_mm,spacing=f.pixel_spacing_row_col_mm;
  expect(validVector(iop,6)&&validVector(ipp,3)&&validVector(spacing,2),'Geometría LPS insuficiente');
  expect(spacing.every(x=>Number(x)>0),'Espaciado inválido');
  const slope=scalar(f.rescale_slope,1),intercept=scalar(f.rescale_intercept,0);
  return {
    rows,columns:cols,
    values:values.subarray(index*plane,(index+1)*plane), // READ ONLY BY CONTRACT: typed arrays mutable in JS.
    spacing:spacing.map(Number),iop:iop.map(Number),ipp:ipp.map(Number),
    slope,intercept,
    sourceIndex:index,triggerMs:scalar(f.trigger_time_ms,null),
    temporalPosition:scalar(f.temporal_position_identifier,null),
    photometric:f.photometric_interpretation,
  };
 }
 return Object.freeze({id:selectedId,mode:info.modo_seguro,shape:Object.freeze(shape),
   nFrames:n,getFrame,
   mayBeVolume3d:false,mayBeClinical4d:false,
   warning:'Cada fotograma necesita verificación espacial/temporal. No concatenar cortes y fases.'});
}