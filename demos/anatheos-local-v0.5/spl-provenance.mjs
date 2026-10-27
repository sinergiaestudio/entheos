/** Exact research atlas provenance for local-only SPL Knee study. No network I/O.
 * SHA-256 was measured from original files pinned at commit a033300264aec8625a56512be3865c10cdbcb61b.
 * Binary STL has no intrinsic coordinate system: the matched model bounds were
 * independently compared to NRRD LPS label-map bounds under RAS->LPS sign flip.
 * This is a coarse registration preflight, NOT a diagnostic geometry guarantee.
 */
export const SPL_ATLAS_COMMIT='a033300264aec8625a56512be3865c10cdbcb61b';
export const SPL_MASK_SHA256='3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d';
export const SPL_MESH_MANIFEST=Object.freeze({
 'femur-95.stl':Object.freeze({label:95,display:'Fémur',triangles:328956,bytes:16447884,
  sha256:'f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277',
  preferredFrame:'RAS',bboxErrorMm:0.6894}),
 'tibia-96.stl':Object.freeze({label:96,display:'Tibia',triangles:266884,bytes:13344284,
  sha256:'4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055',
  preferredFrame:'RAS',bboxErrorMm:0.7009})
});
export async function verifyOriginalSPLMesh(filename,buffer,triangles){
 const target=SPL_MESH_MANIFEST[filename.toLowerCase()];
 if(!target || !(buffer instanceof ArrayBuffer) || buffer.byteLength!==target.bytes ||
   triangles!==target.triangles)return null;
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 no disponible: usar localhost seguro; no se puede autenticar el atlas');
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==target.sha256)return null;
 return {...target,source:'SPL Knee Atlas',hashVerified:true,studyKey:'spl-knee',geometryCompared:'bounding-box LPS/RAS only'};
}
