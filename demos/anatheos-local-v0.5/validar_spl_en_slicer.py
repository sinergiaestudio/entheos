#!/usr/bin/env python3
"""ANATHEOS B3 · protocolo de comparacion dentro de 3D Slicer GUI.
SPL Knee Atlas public original only. Research use, not diagnostic.
This computes distance from sampled STL vertices to nearby *voxel centers*;
it does NOT imply segmentation Dice, surface Hausdorff or clinical validation.
"""
from pathlib import Path
import hashlib,json,traceback
import numpy as np
import vtk,slicer
from vtk.util.numpy_support import vtk_to_numpy
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'ATLAS_SPL'
OUTPUT=ROOT/'VALIDACION_SLICER'
SPL={95:('femur-95.stl','f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277',328956),
     96:('tibia-96.stl','4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055',266884)}
NRRD_SHA='3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d'
def verify(filename,expected):
 p=DATA/filename
 if not p.is_file():raise FileNotFoundError(f'{p} falta. Ejecutar OBTENER_ATLAS_SPL.cmd primero')
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1<<20),b''):h.update(b)
 if h.hexdigest()!=expected:raise ValueError(f'SHA-256 no valido para {filename}')
 return str(p)
def vertex_distances_to_mask_centers(points,arr,transform,label):
 M=np.array([[transform.GetElement(i,j) for j in range(4)] for i in range(4)])
 inv=np.linalg.inv(M);basis=M[:3,:3];origin=M[:3,3];size=np.array(arr.shape[::-1])
 sample=points[::max(1,len(points)//6000)]
 index=(np.column_stack([sample,np.ones(len(sample))])@inv.T)[:,:3]
 vals=[]
 for point,coords in zip(sample,index):
  c=np.rint(coords).astype(int); best=float('inf')
  for dz in range(-2,3):
   k=c[2]+dz
   if not 0<=k<size[2]:continue
   for dy in range(-3,4):
    j=c[1]+dy
    if not 0<=j<size[1]:continue
    for dx in range(-3,4):
     i=c[0]+dx
     if not 0<=i<size[0] or arr[k,j,i]!=label:continue
     v=basis@np.array([i,j,k])+origin
     best=min(best,float(np.linalg.norm(v-point)))
  vals.append(best)
 x=np.asarray(vals);good=x[np.isfinite(x)]
 return {'sampled_vertices':len(sample),'valid_fraction':float(len(good)/len(sample)),
         'p50_mm':float(np.percentile(good,50)) if len(good) else None,
         'p95_mm':float(np.percentile(good,95)) if len(good) else None,
         'p99_mm':float(np.percentile(good,99)) if len(good) else None,
         'method':'STL RAS vertex-to-nearest labeled voxel CENTER, search +/- 3x3x2 voxels; not Hausdorff/Dice'}
def run():
 OUTPUT.mkdir(exist_ok=True)
 label=slicer.util.loadLabelVolume(verify('SPLKneeAtlasLabels.nrrd',NRRD_SHA))
 if label is None or label.GetImageData() is None:raise RuntimeError('No se abrio NRRD')
 arr=slicer.util.arrayFromVolume(label)
 if tuple(arr.shape)!=(119,512,512):raise ValueError(f'Dimensiones inesperadas {arr.shape}')
 M=vtk.vtkMatrix4x4();label.GetIJKToRASMatrix(M)
 report={'engine':'3D Slicer','version':slicer.app.applicationVersion,
         'atlas':'SPL Knee Atlas','space_transform':'NRRD LPS -> Slicer RAS',
         'matrix_IJK_to_RAS':[[M.GetElement(i,j) for j in range(4)] for i in range(4)],
         'no_diagnostic_claim':True,'structures':{}}
 for ident,(filename,hash_,triangles) in SPL.items():
  model=slicer.util.loadModel(verify(filename,hash_))
  if model is None or model.GetPolyData() is None:raise RuntimeError('Error STL '+filename)
  poly=model.GetPolyData()
  if poly.GetNumberOfPolys()!=triangles:raise ValueError('Conteo triangulos inesperado')
  pts=vtk_to_numpy(poly.GetPoints().GetData())
  v=vertex_distances_to_mask_centers(pts,arr,M,ident)
  v.update({'file':filename,'sha256':hash_,'triangles':int(poly.GetNumberOfPolys()),
            'bounds_RAS_mm':list(poly.GetBounds())})
  report['structures'][str(ident)]=v
  if model.GetDisplayNode():
   model.GetDisplayNode().SetColor(*((.85,.78,.72) if ident==95 else (.95,.69,.35)))
 target=OUTPUT/'RESULTADOS_SLICER_B3.json'
 target.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 print('ANATHEOS_B3_SLICER_REPORT='+str(target))
 try:
  slicer.util.resetThreeDViews()
  snapshot=OUTPUT/'SLICER_ATLAS_B3.png'
  slicer.util.mainWindow().grab().save(str(snapshot))
  print('ANATHEOS_B3_SLICER_SCREENSHOT='+str(snapshot))
 except Exception as e:print('No se pudo capturar pantalla: '+str(e))
 print('METRICAS EXPERIMENTALES: faltan inspeccion visual de lateralidad y registro formal.')
 return report
if __name__=='__main__':
 try:run()
 except Exception as e:
  print('ANATHEOS_B3_SLICER_ERROR='+str(e))
  traceback.print_exc()
  raise
