"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildVolume, parseDicom, pixelValue, windowedGray,
  type DicomSlice, type DicomVolume,
} from "@/lib/anatheos/dicom";

type SeriesRecord = { key: string; volume: DicomVolume; modality: string };
type Plane = "axial" | "coronal" | "sagital";
const MAX_FILES = 600;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 320 * 1024 * 1024;

function renderPlane(
  canvas: HTMLCanvasElement, volume: DicomVolume, plane: Plane,
  position: number, center: number, width: number,
) {
  const slices = volume.slices;
  const first = slices[0];
  const axial = plane === "axial";
  const coronal = plane === "coronal";
  const h = axial ? first.rows : slices.length;
  const w = axial ? first.columns : coronal ? first.columns : first.rows;
  const pixelHeight = axial ? first.pixelSpacing[0] : volume.sliceSpacingMm;
  const pixelWidth = plane === "sagital" ? first.pixelSpacing[0] : first.pixelSpacing[1];
  canvas.width = w;
  canvas.height = h;
  canvas.style.aspectRatio = String((w * pixelWidth) / (h * pixelHeight));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("El navegador no ofrece un lienzo 2D.");
  const image = context.createImageData(w, h);
  const views = slices.map((s) => new DataView(s.buffer));
  const inverted = first.photometric === "MONOCHROME1";
  const towardLeft = first.rowDirection[0] > 0;
  const towardPosterior = first.columnDirection[1] > 0;
  const normalZ = first.rowDirection[0] * first.columnDirection[1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let z = position, px = x, py = y;
      if (!axial) {
        // Limited to patient-axis-aligned axial series. No oblique resampling.
        z = normalZ > 0 ? slices.length - y - 1 : y;
        if (coronal) {
          py = position;
          px = towardLeft ? x : first.columns - x - 1;
        } else {
          py = towardPosterior ? x : first.rows - x - 1;
          px = position;
        }
      }
      const current = slices[z];
      const intensity = pixelValue(current, px, py, views[z]);
      const gray = windowedGray(intensity, center, width, inverted);
      const offset = (y * w + x) * 4;
      image.data[offset] = gray;
      image.data[offset + 1] = gray;
      image.data[offset + 2] = gray;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

export function AnatheosDicomBrowser() {
  const [series, setSeries] = useState<SeriesRecord[]>([]);
  const [active, setActive] = useState(0);
  const [plane, setPlane] = useState<Plane>("axial");
  const [position, setPosition] = useState(0);
  const [center, setCenter] = useState(40);
  const [width, setWidth] = useState(400);
  const [message, setMessage] = useState("Seleccioná archivos DICOM de una misma adquisición.");
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const volume = series[active]?.volume ?? null;
  const first = volume?.slices[0];
  const planeMax = volume
    ? plane === "axial" ? volume.slices.length - 1
      : plane === "coronal" ? first!.rows - 1 : first!.columns - 1
    : 0;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    setSeries([]);
    setMessage("Leyendo imágenes únicamente en este navegador…");
    try {
      const selected = [...files];
      const total = selected.reduce((sum, file) => sum + file.size, 0);
      if (selected.length > MAX_FILES || selected.some((file) => file.size > MAX_FILE_BYTES) ||
        total > MAX_TOTAL_BYTES) {
        throw new Error("Límite del piloto: 600 archivos, 32 MB por archivo y 320 MB en total.");
      }
      const groups = new Map<string, DicomSlice[]>();
      const rejected = new Map<string, number>();
      for (const file of selected) {
        try {
          const parsed = parseDicom(await file.arrayBuffer());
          const key = parsed.studyUid + "|" + parsed.seriesUid;
          groups.set(key, [...(groups.get(key) ?? []), parsed]);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "No compatible";
          rejected.set(reason, (rejected.get(reason) ?? 0) + 1);
        }
      }
      const built: SeriesRecord[] = [];
      for (const [key, slices] of groups) {
        try {
          const candidate = buildVolume(slices);
          built.push({ key, volume: candidate, modality: slices[0].modality });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Geometría no compatible";
          rejected.set(reason, (rejected.get(reason) ?? 0) + slices.length);
        }
      }
      built.sort((a, b) => b.volume.slices.length - a.volume.slices.length);
      if (built.length === 0) {
        throw new Error("Ninguna serie cumple los requisitos del prototipo. " +
          [...rejected].slice(0, 2).map(([reason, count]) => count + " archivo(s): " + reason).join(" · "));
      }
      setSeries(built);
      setActive(0);
      setPlane("axial");
      setPosition(Math.floor(built[0].volume.slices.length / 2));
      const firstSlice = built[0].volume.slices[0];
      setCenter(firstSlice.windowCenter ?? (firstSlice.modality === "CT" ? 40 : 1024));
      setWidth(firstSlice.windowWidth ?? (firstSlice.modality === "CT" ? 400 : 2048));
      setMessage(
        built.length + " serie(s) compatible(s). " +
        [...rejected].reduce((sum, [, count]) => sum + count, 0) +
        " archivo(s) excluido(s) por seguridad o incompatibilidad. Los archivos no se enviaron a un servidor."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron leer los archivos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!volume || !canvasRef.current) return;
    let frame = 0;
    frame = requestAnimationFrame(() => {
      try {
        if (canvasRef.current) renderPlane(canvasRef.current, volume, plane, position, center, width);
      } catch {
        setMessage("No fue posible dibujar la serie. Ningún archivo se ha transferido.");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [volume, plane, position, center, width]);

  const chooseSeries = (index: number) => {
    const selected = series[index];
    setActive(index);
    setPlane("axial");
    setPosition(Math.floor(selected.volume.slices.length / 2));
    setCenter(selected.volume.slices[0].windowCenter ??
      (selected.modality === "CT" ? 40 : 1024));
    setWidth(selected.volume.slices[0].windowWidth ??
      (selected.modality === "CT" ? 400 : 2048));
  };

  return (
    <section aria-labelledby="anatheos-viewer-title" className="rounded-2xl border border-[#cbd9d0] bg-white p-5 md:p-7">
      <div className="mb-5">
        <h2 id="anatheos-viewer-title" className="text-xl font-semibold">Laboratorio de imágenes DICOM</h2>
        <p className="mt-2 text-sm leading-6 text-[#53675d]">
          Primera implementación: lectura local de cortes monocromáticos DICOM Part 10
          sin compresión (8/16 bits, un fotograma), con control de geometría.
          La reconstrucción 3D completa y los formatos comprimidos aún no están disponibles.
        </p>
      </div>

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[#a3b8ad] bg-[#f8faf8] p-5">
        <span className="block font-semibold">Seleccionar archivos DICOM del equipo</span>
        <span className="mt-1 block text-xs leading-5 text-[#64776c]">
          Múltiples cortes de una serie. Límite total: 320 MB. No se suben archivos a Entheos ni a terceros.
        </span>
        <input
          className="mt-3 block w-full text-sm"
          type="file"
          accept=".dcm,.dicom,application/dicom"
          multiple
          disabled={loading}
          onChange={(event) => {
            void onFiles(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p role="status" aria-live="polite" className="my-4 text-sm text-[#52685c]">
        {loading ? "Procesando archivos localmente…" : message}
      </p>

      {volume && first && (
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              Serie
              <select className="mt-1 w-full rounded-lg border p-2" value={active}
                onChange={(event) => chooseSeries(Number(event.target.value))}>
                {series.map((item, index) =>
                  <option key={item.key} value={index}>
                    {item.modality} · Serie {index + 1} · {item.volume.slices.length} cortes
                  </option>
                )}
              </select>
            </label>
            <div>
              <p className="text-sm font-semibold">Plano</p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(["axial", "coronal", "sagital"] as Plane[]).map((choice) => (
                  <button type="button" key={choice}
                    disabled={!volume.axisAlignedAxial && choice !== "axial"}
                    aria-pressed={plane === choice}
                    onClick={() => {
                      setPlane(choice);
                      setPosition(Math.floor(
                        (choice === "axial" ? volume.slices.length :
                          choice === "coronal" ? first.rows : first.columns) / 2
                      ));
                    }}
                    className={"rounded-md border px-2 py-2 text-xs capitalize " +
                      (plane === choice ? "border-[#35654c] bg-[#dcece2]" : "bg-white")}>
                    {choice}
                  </button>
                ))}
              </div>
              {!volume.axisAlignedAxial && (
                <p className="mt-2 text-xs text-[#7f564c]">
                  Serie oblicua: las reconstrucciones ortogonales requieren un motor de remuestreo posterior.
                </p>
              )}
            </div>
            <label className="block text-sm">
              <span className="font-semibold">Corte {position + 1} / {planeMax + 1}</span>
              <input type="range" className="mt-2 w-full" min={0} max={planeMax}
                value={Math.min(position, planeMax)}
                onChange={(e) => setPosition(Number(e.target.value))}/>
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Centro de ventana ({center})</span>
              <input type="range" className="mt-2 w-full" min={-1500} max={4000}
                step={1} value={Math.min(4000, Math.max(-1500, center))}
                onChange={(e) => setCenter(Number(e.target.value))}/>
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Ancho de ventana ({width})</span>
              <input type="range" className="mt-2 w-full" min={1} max={6000}
                step={1} value={Math.min(6000, Math.max(1, width))}
                onChange={(e) => setWidth(Number(e.target.value))}/>
            </label>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#65756a]">
              <div><dt>Cortes</dt><dd className="font-semibold">{volume.slices.length}</dd></div>
              <div><dt>Dimensiones</dt><dd className="font-semibold">{first.columns} × {first.rows}</dd></div>
              <div><dt>Espaciado axial</dt><dd className="font-semibold">{volume.sliceSpacingMm.toFixed(2)} mm</dd></div>
              <div><dt>Espaciado de píxel</dt><dd className="font-semibold">{first.pixelSpacing.join(" × ")} mm</dd></div>
            </dl>
          </div>
          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-xl bg-[#10161b] p-4">
            <canvas
              ref={canvasRef}
              aria-label={"Imagen médica exploratoria en plano " + plane}
              role="img"
              className="block max-h-[70vh] max-w-full"
              style={{ imageRendering: "auto", height: "auto", objectFit: "contain" }}
            />
          </div>
        </div>
      )}

      <p className="mt-5 border-t pt-4 text-xs leading-5 text-[#697971]">
        Prototipo exploratorio, no apto para interpretación diagnóstica. La visualización
        se basa en píxeles y orientación DICOM, no reemplaza un visor clínico validado.
        El renderizado volumétrico 3D y la revisión de convenciones de presentación
        radiológica permanecen pendientes.
      </p>
    </section>
  );
}
