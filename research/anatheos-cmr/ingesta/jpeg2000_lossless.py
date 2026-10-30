"""ANATHEOS CMR-R1: JPEG 2000 lossless single-frame decoder (local only).

Public code contains NO real DICOM, PHI, UIDs or pixels. The pixel output
remains in local/private memory; this module does not upload, log or export it.
Enhanced/multiframe and other transfer syntaxes are rejected explicitly.
Requires free: pydicom >= 3, Pillow with JPEG 2000, numpy.
"""
from __future__ import annotations

from io import BytesIO
import numpy as np
from PIL import Image, features
from pydicom.encaps import generate_frames

J2K_LOSSLESS = "1.2.840.10008.1.2.4.90"
MR_IMAGE = "1.2.840.10008.5.1.4.1.1.4"


class IncompatibleSeries(ValueError):
    """Safe generic incompatibility; never interpolate or silently skip."""


def decode_mr_single_frame(dataset) -> np.ndarray:
    """Recover original unsigned 16-bit image samples; geometry unchanged.

    Requires dataset read with stop_before_pixels=False. Does not perform
    rescale, window/level, patient orientation, registration or interpolation.
    Validation of cine grouping and source provenance occurs upstream.
    """
    if not features.check("jpg_2000"):
        raise IncompatibleSeries("JPEG2000 codec is unavailable")
    if str(getattr(dataset, "SOPClassUID", "")) != MR_IMAGE:
        raise IncompatibleSeries("Only classic single-frame MR image storage supported")
    if str(getattr(getattr(dataset, "file_meta", None), "TransferSyntaxUID", "")) != J2K_LOSSLESS:
        raise IncompatibleSeries("Transfer syntax not supported")
    if int(getattr(dataset, "NumberOfFrames", 1)) != 1:
        raise IncompatibleSeries("Multiframe requires a separate dimension-aware decoder")
    if int(getattr(dataset, "SamplesPerPixel", 0)) != 1:
        raise IncompatibleSeries("Only monochrome pixels supported")
    if str(getattr(dataset, "PhotometricInterpretation", "")) not in ("MONOCHROME1", "MONOCHROME2"):
        raise IncompatibleSeries("Photometric interpretation unsupported")
    if int(getattr(dataset, "BitsAllocated", 0)) != 16:
        raise IncompatibleSeries("This validated path requires 16-bit samples")
    if int(getattr(dataset, "PixelRepresentation", -1)) != 0:
        raise IncompatibleSeries("This validated path requires unsigned samples")
    try:
        frames = generate_frames(dataset.PixelData, number_of_frames=1)
        codestream = next(frames)
        try:
            next(frames)
            raise IncompatibleSeries("More than one compressed frame")
        except StopIteration:
            pass
        with Image.open(BytesIO(codestream)) as image:
            image.load()
            result = np.asarray(image).copy()
    except IncompatibleSeries:
        raise
    except Exception:
        raise IncompatibleSeries("Unable to decode image safely") from None
    if result.shape != (int(dataset.Rows), int(dataset.Columns)):
        raise IncompatibleSeries("Decoded frame geometry differs from DICOM metadata")
    if result.dtype != np.dtype("uint16"):
        raise IncompatibleSeries("Decoded samples are not unsigned 16-bit")
    return result


def synthetic_selftest() -> dict:
    """No clinical data; assures JPEG 2000 lossless round-trip."""
    from pydicom.dataset import Dataset, FileMetaDataset
    from pydicom.encaps import encapsulate

    source = np.array([[0, 42, 4095], [900, 1234, 65535]], dtype=np.uint16)
    encoded = BytesIO()
    Image.fromarray(source).save(encoded, format="JPEG2000", irreversible=False)
    ds = Dataset()
    ds.file_meta = FileMetaDataset()
    ds.file_meta.TransferSyntaxUID = J2K_LOSSLESS
    ds.SOPClassUID = MR_IMAGE
    ds.NumberOfFrames = 1
    ds.Rows, ds.Columns = source.shape
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 16
    ds.PixelRepresentation = 0
    ds.PixelData = encapsulate([encoded.getvalue()])
    recovered = decode_mr_single_frame(ds)
    assert np.array_equal(recovered, source), "Pixel values were not preserved"
    ds.NumberOfFrames = 2
    try:
        decode_mr_single_frame(ds)
    except IncompatibleSeries:
        pass
    else:
        raise AssertionError("Unsafe multiframe was accepted")
    return {"synthetic_j2k_roundtrip": "PASS", "multiframe_rejection": "PASS",
            "data_shared": False}


if __name__ == "__main__":
    print(synthetic_selftest())
