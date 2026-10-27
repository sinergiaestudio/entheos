"use client";

import { useEffect, useRef, useState } from "react";
import { pixelValue, type DicomSlice } from "@/lib/anatheos/dicom";
import { importLocalDicom, type IntakeSeries, type IntakeInput } from "@/lib/anatheos/dicom-intake";
import { unpackDicomZip, ZIP_ERROR_MESSAGES } from "@/lib/anatheos/site-demo-zip";

type Series = IntakeSeries;
type Pan = { x: number; y: number };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const normalOf = (s: DicomSlice) => {
  const r = s.rowDirection, c = s.columnDirection;
  return [r[1]*c[2]-r[2]*c[1],r[2]*c[0]-r[0]*c[2],r[0]*c[1]-r[1]*c[0]];
};
const projection = (s: DicomSlice) =>
  s.imagePosition.reduce((v, x, i) => v + x * normalOf(s)[i], 0);

function startingWindow(slice: DicomSlice): { center: number; width: number } {
  const values: number[] = [];
  const view = new DataView(slice.buffer);
  for (let y = 0; y < slice.rows; y += 12)
    for (let x = 0; x < slice.columns; x += 12)
      values.push(pixelValue(slice, x, y, view));
  values.sort((a, b) => a - b);
  const lo = values[Math.floor(values.length * 0.02)] ?? 0;
  const hi = values[Math.floor(values.length * 0.98)] ?? 2048;
  return { center: (lo + hi)/2, width: Math.max(1, hi-lo) };
}

function drawCanvas(
  canvas: HTMLCanvasElement, slice: DicomSlice, center: number, width: number,
  brightness: number, contrast: number, zoom: number, pan: Pan,
) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(200, Math.round(rect.width * dpr));
  const h = Math.max(200, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.fillStyle = "#15191d";
  ctx.fillRect(0, 0, w, h);
  const scratch = document.createElement("canvas");
  scratch.width = slice.columns;
  scratch.height = slice.rows;
  const other = scratch.getContext("2d", { alpha: false });
  if (!other) return;
  const image = other.createImageData(slice.columns, slice.rows);
  const raw = new DataView(slice.buffer);
  const lower = center - width/2, gain = contrast/100, brightnessShift = brightness/100;
  const inverted = slice.photometric === "MONOCHROME1";
  for (let y = 0; y < slice.rows; y++) {
    for (let x = 0; x < slice.columns; x++) {
      const intensity = pixelValue(slice, x, y, raw);
      let level = clamp((intensity - lower)/Math.max(width, 1),0,1);
      level = clamp((level-0.5)*gain+0.5+brightnessShift,0,1);
      const value = Math.round((inverted ? 1-level : level)*255);
      const k=(y*slice.columns+x)*4;
      image.data[k]=image.data[k+1]=image.data[k+2]=value; image.data[k+3]=255;
    }
  }
  other.putImageData(image, 0, 0);
  const fit=Math.min(w/slice.columns,h/slice.rows)*0.91*zoom;
  ctx.save();
  ctx.translate(w/2+pan.x*dpr,h/2+pan.y*dpr);
  ctx.scale(fit,fit);
  ctx.drawImage(scratch,-slice.columns/2,-slice.rows/2);
  ctx.restore();
  // Releasing scratch/image references is cooperative; GC is browser managed.
}

export function AnatheosSiteDemoClient() {
  const [series,setSeries]=useState<Series[]>([]);
  const [selected,setSelected]=useState(0);
  const [sliceIndex,setSliceIndex]=useState(0);
  const [center,setCenter]=useState(800);
  const [width,setWidth]=useState(1200);
  const [brightness,setBrightness]=useState(0);
  const [contrast,setContrast]=useState(100);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState<Pan>({x:0,y:0});
  const [feedback,setFeedback]=useState("Abrí el ZIP DESS o una carpeta DICOM de tu equipo.");
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");
  const [resizeTick,setResizeTick]=useState(0);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const zipInput=useRef<HTMLInputElement>(null);
  const folderInput=useRef<HTMLInputElement>(null);
  const dragging=useRef<{x:number;y:number}|null>(null);
  const controller=useRef<AbortController|null>(null);
  const current=series[selected]?.volume ?? null;
  const image=current?.slices[sliceIndex] ?? null;

  function reset() {
    controller.current?.abort();
    controller.current=null;
    setSeries([]);setSelected(0);setSliceIndex(0);setBusy(false);
    setProgress("");setZoom(1);setPan({x:0,y:0});
  }

  async function load(inputs: IntakeInput[] | File[], source: "zip" | "folder") {
    reset();
    const ctrl=new AbortController();
    controller.current=ctrl;
    setBusy(true);
    setFeedback("Leyendo archivos solo en la memoria de este navegador…");
    try {
      const files=source==="zip"
        ? await unpackDicomZip(inputs[0] as Blob,ctrl.signal)
        : inputs;
      if(ctrl.signal.aborted) return;
      const result=await importLocalDicom(files,{signal:ctrl.signal,
        onProgress:(done,total)=>{if(!ctrl.signal.aborted) setProgress(String(done)+" / "+String(total));}
      });
      if(ctrl.signal.aborted) return;
      if(!result.series.length) throw new Error("INCOMPATIBLE");
      const first=result.series[0].volume.slices;
      const idx=Math.floor(first.length/2);
      const defaults=startingWindow(first[idx]);
      setSeries(result.series);setSliceIndex(idx);
      setCenter(defaults.center);setWidth(defaults.width);
      setContrast(100);setBrightness(0);setZoom(1);setPan({x:0,y:0});
      setFeedback(String(first.length)+" cortes compatibles, "+
        String(result.rejectedFiles)+" archivos excluidos. Ningún DICOM fue enviado al servidor.");
    } catch(error) {
      if(ctrl.signal.aborted) return;
      const kind=error instanceof Error?error.message:"";
      setFeedback(ZIP_ERROR_MESSAGES[kind] ??
        (kind==="INCOMPATIBLE"
          ? "No se encontró una serie compatible: revisá formato, integridad y geometría."
          : "No se pudo cargar la serie. Solo se admiten cortes DICOM monocromáticos sin compresión."));
    } finally {
      if(controller.current===ctrl){controller.current=null;setBusy(false);setProgress("");}
    }
  }

  useEffect(()=>{
    const observer=new ResizeObserver(()=>setResizeTick(n=>n+1));
    if(canvasRef.current) observer.observe(canvasRef.current);
    return ()=>observer.disconnect();
  },[series]);

  useEffect(()=>{
    if(!image||!canvasRef.current) return;
    const animation=requestAnimationFrame(()=>{
      if(canvasRef.current) drawCanvas(canvasRef.current,image,center,width,brightness,contrast,zoom,pan);
    });
    return ()=>cancelAnimationFrame(animation);
  },[image,center,width,brightness,contrast,zoom,pan,resizeTick]);

  useEffect(()=>()=>controller.current?.abort(),[]);
  const chooseSlice=(i:number)=>{if(current) setSliceIndex(clamp(i,0,current.slices.length-1));};
  const available=current?.slices.length ?? 0;
  const fieldStyle="w-full accent-[#c12940]";
  const buttonStyle="rounded-lg border border-[#d8dce0] bg-white px-3 py-2 text-sm font-semibold text-[#434a50] hover:bg-[#f3f4f5]";
  return (
    <section className="min-h-screen bg-[#f5f6f7] text-[#252a2f]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4">
        <div>
          <span className="text-lg font-black tracking-[0.12em] text-[#b61e33]">ANATHEOS <span className="text-[#252a2f]">3D</span></span>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737a82]">Demo web experimental · archivos locales</p>
        </div>
        <span className="rounded-md border border-[#e1b8bf] px-3 py-1 text-[11px] font-semibold text-[#a92135]">NO DIAGNÓSTICO</span>
      </header>
      <div className="grid min-h-[760px] grid-cols-1 gap-0 lg:grid-cols-[295px_minmax(0,1fr)]">
        <aside className="space-y-6 border-r border-[#e2e5e8] bg-white p-5">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#b61e33]">01 · Importar</div>
            <h2 className="text-lg font-semibold">Serie DICOM local</h2>
            <p className="mt-2 text-sm text-[#68717a]">Seleccioná el ZIP original DESS de Leeds, su contenedor A o una carpeta de imágenes.</p>
            <button type="button" disabled={busy} onClick={()=>zipInput.current?.click()}
              className="mt-4 w-full rounded-lg bg-[#b61e33] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">
              Abrir ZIP DESS desde el equipo
            </button>
            <button type="button" disabled={busy} onClick={()=>folderInput.current?.click()} className={buttonStyle+" mt-2 w-full"}>
              Abrir carpeta DICOM
            </button>
            <input ref={zipInput} type="file" accept=".zip,application/zip" hidden
              onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void load([f],"zip");e.currentTarget.value="";}}/>
            <input ref={folderInput} type="file" multiple hidden
              {...({webkitdirectory:"",directory:""} as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={e=>{const f=[...(e.currentTarget.files??[])];if(f.length)void load(f,"folder");e.currentTarget.value="";}}/>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#b61e33]">02 · Estado</div>
            <p role="status" className="rounded-lg border bg-[#fafbfb] p-3 text-xs leading-5 text-[#566169]">
              {busy?"Leyendo "+progress+" instancias…":feedback}
            </p>
            {busy&&<button type="button" onClick={()=>{reset();setFeedback("Lectura cancelada. Los resultados descartados no se muestran.");}} className={buttonStyle+" mt-3 w-full"}>Cancelar carga</button>}
            {!!available&&<>
              <p className="mt-3 text-sm font-semibold">{available} cortes · {series.length} serie(s)</p>
              <select aria-label="Seleccionar serie" className="mt-2 w-full rounded-lg border px-2 py-2 text-sm" value={selected}
                onChange={e=>{const n=Number(e.target.value);setSelected(n);const newSeries=series[n].volume.slices;const idx=Math.floor(newSeries.length/2);setSliceIndex(idx);const w=startingWindow(newSeries[idx]);setCenter(w.center);setWidth(w.width);}}>
                {series.map((s,i)=><option key={s.key} value={i}>Serie {i+1} · {s.modality} · {s.volume.slices.length} cortes</option>)}
              </select>
            </>}
          </div>
          <div className="border-t pt-4 text-xs leading-5 text-[#707a81]">
            Imágenes procesadas en tu navegador. No se cargan estudios al servidor Entheos, D1 ni R2.
            <p className="mt-3">Leeds RTKN0668 · CC BY 4.0.</p>
            <a className="underline" href="https://archive.researchdata.leeds.ac.uk/1609/" target="_blank" rel="noopener noreferrer">
              Fuente y atribución de la investigación
            </a>
          </div>
        </aside>
        <main className="min-w-0 space-y-4 p-5 lg:p-7">
          <div className="flex flex-wrap justify-between gap-2">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#a92135]">VISOR DICOM</p>
              <h1 className="text-xl font-bold">Resonancia · cortes originales</h1>
              <p className="text-xs text-[#68717a]">Orientación DICOM LPS · lateralidad no validada con 3D Slicer</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonStyle} onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>Restablecer</button>
              <button type="button" disabled={!image} className={buttonStyle} onClick={()=>setZoom(z=>clamp(z/1.25,0.25,8))}>−</button>
              <button type="button" disabled={!image} className={buttonStyle} onClick={()=>setZoom(z=>clamp(z*1.25,0.25,8))}>+</button>
              <button type="button" className={buttonStyle} onClick={()=>{reset();setFeedback("Datos desvinculados. La liberación real de memoria depende del navegador.");}}>Liberar</button>
            </div>
          </div>
          <div className="relative h-[430px] overflow-hidden rounded-xl bg-[#15191d] md:h-[540px]">
            {!image&&<div className="absolute inset-0 grid place-items-center text-center text-sm text-[#b3b8bd]">Seleccioná un estudio DICOM del equipo para ver sus cortes.</div>}
            <canvas ref={canvasRef} aria-label="Imagen DICOM experimental" role="img" className="h-full w-full touch-none"
              onWheel={e=>{if(!current)return;if(e.ctrlKey||e.metaKey)setZoom(z=>clamp(z*(e.deltaY>0?0.9:1.1),0.25,8));else chooseSlice(sliceIndex+(e.deltaY>0?1:-1));}}
              onPointerDown={e=>{if(!image)return;dragging.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
              onPointerMove={e=>{if(!dragging.current)return;const last=dragging.current;setPan(p=>({x:p.x+e.clientX-last.x,y:p.y+e.clientY-last.y}));dragging.current={x:e.clientX,y:e.clientY};}}
              onPointerUp={()=>dragging.current=null} onPointerCancel={()=>dragging.current=null}/>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-[11px] text-[#e2e4e6]">
              <span>{image?"Corte "+(sliceIndex+1)+" / "+available:"SIN IMÁGENES"}</span>
              <span>Rueda: cortes · Ctrl+rueda: zoom · arrastrar: mover</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
            <button type="button" disabled={!image} className={buttonStyle} onClick={()=>chooseSlice(sliceIndex-1)}>‹</button>
            <label htmlFor="anatheosSlice" className="whitespace-nowrap text-xs font-bold">Corte {image?sliceIndex+1:"—"} / {image?available:"—"}</label>
            <input id="anatheosSlice" aria-label="Corte DICOM" type="range" min={0} max={Math.max(0,available-1)} value={sliceIndex} disabled={!image}
              onChange={e=>chooseSlice(Number(e.target.value))} className={fieldStyle+" flex-1"}/>
            <button type="button" disabled={!image} className={buttonStyle} onClick={()=>chooseSlice(sliceIndex+1)}>›</button>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl border bg-white p-4 md:grid-cols-4">
            <label className="text-xs font-semibold">Ventana <output className="float-right text-[#8b9299]">{Math.round(width)}</output>
              <input aria-label="Ventana" type="range" min={1} max={6000} value={clamp(width,1,6000)} disabled={!image} onChange={e=>setWidth(Number(e.target.value))} className={fieldStyle+" mt-3"}/></label>
            <label className="text-xs font-semibold">Nivel <output className="float-right text-[#8b9299]">{Math.round(center)}</output>
              <input aria-label="Nivel" type="range" min={-2000} max={6000} value={clamp(center,-2000,6000)} disabled={!image} onChange={e=>setCenter(Number(e.target.value))} className={fieldStyle+" mt-3"}/></label>
            <label className="text-xs font-semibold">Brillo <output className="float-right text-[#8b9299]">{brightness}</output>
              <input aria-label="Brillo" type="range" min={-100} max={100} value={brightness} onChange={e=>setBrightness(Number(e.target.value))} className={fieldStyle+" mt-3"}/></label>
            <label className="text-xs font-semibold">Contraste <output className="float-right text-[#8b9299]">{contrast}%</output>
              <input aria-label="Contraste" type="range" min={25} max={250} value={contrast} onChange={e=>setContrast(Number(e.target.value))} className={fieldStyle+" mt-3"}/></label>
          </div>
          <div className="grid gap-3 rounded-xl border bg-white p-4 text-xs text-[#58616b] md:grid-cols-3">
            <div><p className="font-bold">Dimensiones</p><p>{image?String(image.columns)+" × "+String(image.rows):"—"}</p></div>
            <div><p className="font-bold">PixelSpacing</p><p>{image?image.pixelSpacing.map(v=>v.toFixed(4)).join(" × ")+" mm":"—"}</p></div>
            <div><p className="font-bold">Posición proyectada</p><p>{image?projection(image).toFixed(3)+" mm":"—"}</p></div>
            <div><p className="font-bold">Transfer Syntax</p><p>{image?image.transferSyntax:"—"}</p></div>
            <div className="md:col-span-2"><p className="font-bold">Image Orientation Patient (LPS)</p><p>{image?[...image.rowDirection,...image.columnDirection].map(x=>x.toFixed(4)).join(", "):"—"}</p></div>
          </div>
          <p className="text-xs text-[#7b525a]">Visualización experimental de imágenes originales. No se muestra MPR ni reconstrucción 3D sin validación geométrica externa.</p>
        </main>
      </div>
    </section>
  );
}
