/* UX-N1: visible controls are bound to actual volumes / imported meshes.
 * No fake femur, cartilage or meniscus layers are materialized.
 */
const find=id=>document.getElementById(id);
const layerPanel=find('uxLayersPanel');
const volumeOpacity=find('volumeOpacity');
const volumeProxy=find('uxVolumeOpacity');
function refreshLayers(){
 const view=document.body.dataset.b5View || 'slice';
 const dicom=view!=='surface';
 const triple=view==='triple';
 const sameStudy=find('surfaceLayers').dataset.origin==='same-study-manual';
 const loaded=find('studyTitle').textContent!=='Sin estudio cargado';
 find('uxLayerDicom').hidden=!dicom;
 find('uxLayerExternal').hidden=!(view==='surface'||(triple&&sameStudy));
 find('uxModelOriginTitle').textContent=sameStudy?'Máscaras MANUALES del mismo estudio':'Modelo anatómico externo';
 find('uxModelOriginDescription').textContent=sameStudy?'Superficies extraídas de regiones marcadas en la serie DICOM cargada. Coordenadas LPS mm; anatomía SIN validar.':'Referencia de otro espécimen. No registrada con la RM cargada.';
 find('uxVolumeOpacityControl').hidden=!(view==='volume'||view==='mixed'||triple)||!loaded;
 find('uxRenderMaterials').hidden=!(view==='volume'||view==='mixed'||triple)||!loaded;
 find('uxDicomTag').textContent=loaded?'Original':'Sin cargar';
 find('uxLayerContext').textContent=view==='surface'?'Mallas independientes · atlas externo':triple?'Tres paneles del mismo DICOM, mallas sólo de máscaras locales':loaded?(view==='mixed'?'2D + 3D del mismo estudio DICOM':view==='volume'?'Intensidades del estudio DICOM':'Cortes del estudio DICOM'):'Sin estudio activo';
 find('uxDicomDescription').textContent=loaded?(triple?'Corte original, volumen y superficies sólo de etiquetas segmentadas en este estudio. No se infieren tejidos automáticamente.':view==='mixed'?'Dos vistas del mismo estudio DICOM: cortes originales y volumen de intensidades, sin anatomía segmentada.':view==='volume'?'Volumen del mismo estudio: intensidades reales, no estructuras identificadas.':'Imagen original: los cortes no implican segmentación de huesos o tejidos.'):'Abrí tu estudio para explorar los cortes y el volumen original.';
 find('uxSourceExplanation').textContent=view==='surface'?(sameStudy?'Origen: máscara MANUAL del mismo estudio DICOM. Coordenadas LPS en mm; región sin interpretación anatómica ni validación Slicer.':'Las mallas STL/OBJ externas no tienen relación espacial comprobada con la resonancia cargada. SPL proviene de otro espécimen.'):loaded?'El volumen representa las imágenes originales. Las estructuras anatómicas requieren segmentación validada del mismo estudio.':'No se han cargado imágenes ni estructuras anatómicas.';
 volumeProxy.value=volumeOpacity.value;
 find('uxVolumeOpacityValue').textContent=volumeOpacity.value+' %';
 layerPanel.dataset.uxView=view;
}
volumeProxy.addEventListener('input',()=>{
 volumeOpacity.value=volumeProxy.value;
 volumeOpacity.dispatchEvent(new Event('input',{bubbles:true}));
 find('uxVolumeOpacityValue').textContent=volumeProxy.value+' %';
});
volumeOpacity.addEventListener('input',refreshLayers);
const observer=new MutationObserver(refreshLayers);
observer.observe(document.body,{attributes:true,attributeFilter:['data-b5-view']});
observer.observe(find('studyTitle'),{childList:true,subtree:true});
observer.observe(find('surfaceLayers'),{childList:true,subtree:true});
refreshLayers();
