"""Ephemeral public reference metadata; print aggregate rejection reasons only."""
import collections, hashlib, io, json, pathlib, subprocess, sys, tempfile, zipfile
import pydicom
ROOT=pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'research/anatheos-cmr/r2'))
from auditar_dicom_offline import parse_dicom
from preparar_todas_las_series import frame_record

for name,path in [('Leeds',sys.argv[1]),('LCTSC',sys.argv[2])]:
    source=pathlib.Path(path)
    digest=hashlib.sha256(source.read_bytes()).hexdigest() if name=='Leeds' else hashlib.md5(source.read_bytes()).hexdigest()
    expected='1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d' if name=='Leeds' else 'e472ce41106eb881264f2acb2f2bb1ca'
    assert digest==expected,'Public source integrity mismatch'
    groups=collections.defaultdict(list)
    with zipfile.ZipFile(source) as archive:
        for member in archive.infolist():
            if member.is_dir() or member.file_size>75*1024**2:continue
            raw=archive.read(member)
            if len(raw)<132 or raw[128:132]!=b'DICM':continue
            ds=pydicom.dcmread(io.BytesIO(raw),stop_before_pixels=True)
            if str(getattr(ds,'Modality','')) not in ('MR','CT'):continue
            record=parse_dicom(raw)
            # The R2 metadata preflight intentionally stops at undefined SQ.
            # Use the established public-data parser for this independent comparison.
            mapping={'study':'StudyInstanceUID','series':'SeriesInstanceUID','for_uid':'FrameOfReferenceUID','modality':'Modality','image_type':'ImageType','scan_sequence':'ScanningSequence','sequence_variant':'SequenceVariant','tr':'RepetitionTime','te':'EchoTime','ti':'InversionTime','slice_thickness':'SliceThickness','slice_spacing':'SpacingBetweenSlices','kvp':'KVP','convolution_kernel':'ConvolutionKernel','ipp':'ImagePositionPatient','iop':'ImageOrientationPatient','spacing':'PixelSpacing','slope':'RescaleSlope','intercept':'RescaleIntercept','photo':'PhotometricInterpretation'}
            for key,attr in mapping.items():
                value=getattr(ds,attr,None)
                if value is not None:record[key]='\\'.join(map(str,value)) if isinstance(value,(list,pydicom.multival.MultiValue)) else str(value)
            record.update(rows=int(ds.Rows),cols=int(ds.Columns),pixel=True)
            if record.get('modality') not in ('MR','CT') or not record.get('pixel'):continue
            groups[(record.get('study'),record.get('series'),int(record['rows']),int(record['cols']))].append(frame_record(record,raw))
    with tempfile.TemporaryDirectory() as temp:
        data=pathlib.Path(temp)/'metadata.json'
        data.write_text(json.dumps([{'rows':k[2],'cols':k[3],'frames':v} for k,v in groups.items()]))
        code="""import fs from 'node:fs';import {eligibility} from './demos/anatheos-local-v0.5/spatial-reference.mjs';
const source=JSON.parse(fs.readFileSync(process.argv[1]));let candidates=0,images=0;const reasons={};
for(const s of source){images+=s.frames.length;for(const g of eligibility(s.frames,s.rows,s.cols).groups){if(g.volumeEligible)candidates++;for(const r of g.reasons)reasons[r]=(reasons[r]||0)+1;}}
console.log(JSON.stringify({images,candidates,reasons}));if(candidates<1)process.exitCode=1;
"""
        result=subprocess.run(['node','--input-type=module','-e',code,str(data)],cwd=ROOT,text=True,capture_output=True)
        print(name+': '+result.stdout.strip(),flush=True)
        assert result.returncode==0,'Known public volume rejected: investigate criteria'
