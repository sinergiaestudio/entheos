"""Generate deterministic cross-language synthetic physical geometry fixtures.

Independent analytic formula, not AFE output, is the reference expectedPoint.
No clinical pixels, UIDs or external dataset.
"""
import json
import math
import sys
from pathlib import Path
from afe.geometry import SliceGeometry, build_regular_grid, lps_to_ras


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def frames(iop,reverse=False):
    out=[SliceGeometry(
        ipp_lps_mm=(11.5,-23.25,44.0+z*1.25),iop=iop,
        spacing_row_col_mm=(2.5,0.75),rows=32,columns=48,
        slice_thickness_mm=1.25,modality='MR',
        acquisition_key='synthetic-proven-acq',temporal_key='synthetic-fixed-phase')
        for z in range(4)]
    return out[::-1] if reverse else out


def fixture(label,iop,reverse=False):
    fs=frames(iop,reverse)
    g=build_regular_grid(fs)
    rowcos,colcos=iop[:3],iop[3:]
    nn=cross(rowcos,colcos);nnorm=math.sqrt(sum(x*x for x in nn))
    n=tuple(x/nnorm for x in nn)
    out=[]
    for col,row,z in ((1.,2.,0.),(23.25,17.5,1.),(47.,31.,3.),(9.1,7.9,2.5)):
        # Independent direct DICOM equation; no call to Python AFE for expected.
        expected=[(11.5,-23.25,44.0)[k]+col*0.75*rowcos[k]+row*2.5*colcos[k]+z*1.25*n[k]
                  for k in range(3)]
        actual=g.voxel_to_lps(col,row,z)
        back=g.lps_to_voxel(expected)
        err=max(abs(actual[k]-expected[k]) for k in range(3))
        if err>1e-9:raise AssertionError((label,'world error',err))
        if max(abs(back[k]-q) for k,q in enumerate((col,row,z)))>1e-9:
            raise AssertionError((label,'inverse error',back))
        sample_frame=dict(
            image_position_patient_LPS_mm=list(g.voxel_to_lps(0.,0.,z)),
            image_orientation_patient_LPS=list(iop),
            pixel_spacing_row_col_mm=[2.5,.75])
        out.append(dict(label=label,frame=sample_frame,column=col,row=row,slice=z,
                        expectedPoint=expected,pythonPoint=list(actual),
                        pythonInverse=list(back),rasPoint=list(lps_to_ras(expected)),
                        analyticNormal=list(n)))
    return dict(label=label,sourceIndices=list(g.sorted_source_indices),
                expectedOrder=[3,2,1,0] if reverse else [0,1,2,3],
                sampleCount=len(out),samples=out)


def main(path):
    t=math.pi/6
    cases=[
        fixture('axial',(1.,0.,0.,0.,1.,0.)),
        fixture('oblique-30',(math.cos(t),math.sin(t),0.,-math.sin(t),math.cos(t),0.)),
        fixture('inverted-axes',(-1.,0.,0.,0.,-1.,0.)),
        fixture('reversed-source',(1.,0.,0.,0.,1.,0.),True),
        fixture('accepted-rounded-skew',(1.,0.,0.,0.00006,1.,0.))]
    Path(path).write_text(json.dumps({'schema':'afe-synthetic-interop-v1','cases':cases},
                                     sort_keys=True,indent=2),encoding='utf-8')
    print('PYTHON_SYNTHETIC_REFERENCE_PASS cases=%d points=%d'%(
        len(cases),sum(len(c['samples']) for c in cases)))


if __name__=='__main__':main(sys.argv[1])
