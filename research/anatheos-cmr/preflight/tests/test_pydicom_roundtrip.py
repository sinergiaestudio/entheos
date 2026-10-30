"""End-to-end synthetic Part 10 DICOM/ZIP QA. Needs pydicom 3.0, never patient data."""
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, MRImageStorage, EnhancedMRImageStorage, generate_uid

SCRIPT = Path(__file__).resolve().parents[1] / 'inventariar_rm_cardiaca.py'
SENSITIVE='NOMBRE_PERSONAL_SIMULADO_NO_EXPORTAR'


def dicom_blob(study_uid,series_uid,sopclass,description,inst,position,trigger=None,frames=1):
    sop=generate_uid()
    fm=FileMetaDataset()
    fm.MediaStorageSOPClassUID=sopclass
    fm.MediaStorageSOPInstanceUID=sop
    fm.TransferSyntaxUID=ExplicitVRLittleEndian
    fm.ImplementationClassUID=generate_uid()
    ds=FileDataset('synthetic',{},file_meta=fm,preamble=b'\0'*128)
    ds.SOPClassUID=sopclass; ds.SOPInstanceUID=sop
    ds.StudyInstanceUID=study_uid; ds.SeriesInstanceUID=series_uid
    ds.PatientName=SENSITIVE
    ds.PatientID='SENSITIVE_TEST_ID'
    ds.SeriesDescription=description
    ds.ProtocolName=description
    ds.InstanceNumber=inst
    ds.Modality='MR'
    ds.ImageOrientationPatient=[1,0,0,0,1,0]
    ds.ImagePositionPatient=[0,0,position]
    ds.PixelSpacing=[1.3,1.3]
    ds.SamplesPerPixel=1
    ds.PhotometricInterpretation='MONOCHROME2'
    ds.Rows=32;ds.Columns=32
    ds.BitsAllocated=16;ds.BitsStored=16;ds.HighBit=15;ds.PixelRepresentation=0
    if frames>1:ds.NumberOfFrames=frames
    if trigger is not None:ds.TriggerTime=trigger
    ds.PixelData=(b'\0\0'*(32*32*frames))
    buffer=io.BytesIO()
    ds.save_as(buffer,enforce_file_format=True)
    return buffer.getvalue()


def main():
    study=generate_uid();cine=generate_uid();lge=generate_uid();enh=generate_uid()
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp);zpath=root/'personal_prueba_sintetica.zip';out=root/'report.json'
        with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
            for i,trigger in enumerate([0,35,70]):
                z.writestr(f'SERIES/PRIVADA_{i}.dcm',dicom_blob(study,cine,MRImageStorage,'EJE CORTO',i,0,trigger))
            for i,pos in enumerate([0,8]):
                z.writestr(f'PSIR/PRIVADA_{i}.dcm',dicom_blob(study,lge,MRImageStorage,'PSIR_TFE_BH SENSE',i,pos))
            z.writestr('ENHANCED/PRIVADA_multiframe.dcm',dicom_blob(study,enh,EnhancedMRImageStorage,'OTRA SECUENCIA',1,0,frames=8))
            z.writestr('PRIVADO_licence.txt',SENSITIVE)
        proc=subprocess.run([sys.executable,str(SCRIPT),'--entrada',str(zpath),'--salida',str(out)],capture_output=True,text=True,timeout=30)
        if proc.returncode!=0:raise RuntimeError('Cardiac preflight failed (stderr suppressed)')
        data=json.loads(out.read_text('utf8'))
        if data['series_detectadas']!=3 or data['instancias_dicom_reconocidas']!=6:
            raise AssertionError('Unexpected MR grouping')
        records={x['familia_probable']:x for x in data['series']}
        if records['cine_eje_corto']['ruta_tecnica']!='visor_cine_o_4d_antes_de_reconstruir':
            raise AssertionError('Repeated trigger time not identified as cardiac cine')
        if records['realce_tardio_psir']['ruta_tecnica']!='candidato_volumen_3d_revisar_anatomia':
            raise AssertionError('PSIR geometry metadata not assessed')
        if records['otra_por_verificar']['ruta_tecnica']!='requiere_decodificador_o_multiframe':
            raise AssertionError('Enhanced MR incorrectly labelled as standard 3D stack')
        serialized=json.dumps(data)
        for secret in (SENSITIVE,'SENSITIVE_TEST_ID',str(study),str(cine),str(lge),str(enh),'PRIVADA_'):
            if secret in serialized:raise AssertionError('Sensitive identifier exported')
        print('ANATHEOS_CARDIAC_MR_SYNTHETIC_DICOM_QA='+json.dumps({
            'gate':'PASS', 'mr_instances':6, 'series':3,
            'cine_temporal_guard':True, 'enhanced_multiframe_guard':True,
            'privacy_no_patient_ids_or_uids':True,'no_real_patient_data':True,
            'reading_only_metadata':True
        },sort_keys=True))

if __name__=='__main__':main()