/**
 * ANATHEOS UX-N4 — progressive disclosure WITHOUT modifying DICOM, masks,
 * geometry, renderers, network behavior or existing control IDs/listeners.
 * Rehomes the existing DOM nodes in accessible native <details> disclosures.
 * All controls remain reachable by mouse, keyboard and assistive technology.
 */
const byId=id=>document.getElementById(id);
const make=(tag,cls,contents)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(contents!==undefined)el.textContent=contents;
 return el;
};
function disclosure(id,label,cls){
 const node=make('details','ux-clean-disclosure '+(cls||''));
 node.id=id;
 const summary=make('summary','',label);
 node.append(summary);
 return node;
}
const cleanBody=document.body;
cleanBody.classList.add('ux-streamlined');
const toolbar=document.querySelector('.viewerTools');
const sidebar=document.querySelector('.sidebar');
const layers=byId('uxLayerDicom');

// Group modes together visually, keeping all five real mode buttons visible.
const modes=make('div','ux-clean-mode-group');
for(const [id,short] of [
 ['twoDButton','2D'],['threeDButton','Volumen 3D'],
 ['mixedButton','2D + 3D'],['tripleButton','3 ventanas'],['surfaceButton','Superficies']
]){
 const el=byId(id);
 el.textContent=short;
 el.classList.add('ux-clean-mode');
 modes.append(el);
}
toolbar.prepend(modes);
// Move the SAME advanced editor toggle: it still changes body.b5-advanced.
const advanced=byId('b5AdvancedToggle');
advanced.classList.add('ux-clean-editor');
advanced.title='Mostrar u ocultar edición, propuestas 3D y exportaciones';
advanced.textContent='Editar';
toolbar.append(advanced);

// Preserve focus and fullscreen as one-click actions; put occasional
// zoom/reset/destructive memory actions behind the explicit More menu.
byId('focusButton').textContent='Ampliar';
byId('fullscreenButton').textContent='⛶';
byId('fullscreenButton').setAttribute('aria-label','Pantalla completa');
const more=disclosure('uxMoreViewer','Más herramientas','ux-clean-menu');
more.querySelector('summary').title='Zoom, ajustar y liberar memoria';
const moreItems=make('div','ux-clean-menu-content');
for(const id of ['fitButton','zoomOut','zoomIn','clearButton'])moreItems.append(byId(id));
more.append(moreItems);
toolbar.append(more);

// Hide redundant flow/status copy but retain it in DOM for existing observers.
const studyBlock=sidebar.querySelector('.sideblock');
const imports=disclosure('uxStudyImport','Importar estudio','ux-clean-sidebar-disclosure');
const importContent=make('div','ux-clean-import-content');
importContent.append(byId('b5OpenStudy'),studyBlock.querySelector('.pickerRow'));
const hint=studyBlock.querySelector('.hint');
if(hint)importContent.append(hint);
imports.append(importContent);
studyBlock.append(imports);
byId('loadIncluded').textContent='Cargar RM de ejemplo · Leeds';

const warnBlock=[...sidebar.querySelectorAll('.sideblock')].find(n=>n.contains(byId('warnings')));
if(warnBlock){
 const warning=disclosure('uxTechnicalDetails','Estado y datos técnicos','ux-clean-sidebar-disclosure');
 const warningContent=make('div','ux-clean-warnings');
 warningContent.append(byId('warnings'));
 const label=warnBlock.querySelector('.overline');
 if(label)label.remove();
 warning.append(warningContent);
 warnBlock.append(warning);
}
const credits=disclosure('uxStudyCredits','Fuente y atribución','ux-clean-sidebar-disclosure');
const creditsBox=sidebar.querySelector('.sidebottom');
if(creditsBox){credits.append(creditsBox);sidebar.append(credits);}

// Style/opacity are working controls, but not essential to see constantly.
// Keep their true IDs and event handlers under one native, keyboard-accessible
// disclosure. Change handlers still receive input events unchanged.
const appearance=disclosure('uxAppearanceDetails','Apariencia 3D','ux-clean-inspector-disclosure');
appearance.append(byId('uxVolumeOpacityControl'),byId('uxRenderMaterials'));
layers.append(appearance);
const provenance=disclosure('uxProvenanceDetails','Información y procedencia','ux-clean-inspector-disclosure ux-clean-provenance');
provenance.append(byId('uxDicomDescription'),layers.querySelector('.ux-not-yet'));
const sideFooter=document.querySelector('.ux-side-footer');
if(sideFooter)provenance.append(sideFooter);
layers.append(provenance);

// Native details already implement accessible keyboard/Space/Enter and click.
// Keep menus mutually exclusive without changing program state.
for(const d of [more,imports,appearance,provenance,credits]){
 d.addEventListener('toggle',()=>{
  if(!d.open||d===appearance||d===provenance)return;
  for(const other of [more,imports,credits])if(other!==d)other.open=false;
 });
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  for(const d of [more,imports,appearance,provenance,credits])d.open=false;
 }
});
document.addEventListener('pointerdown',e=>{
 if(more.open&&!more.contains(e.target))more.open=false;
},{capture:true});

// Close the floating menu whenever a real view choice is selected. Never
// manually call mode handlers or recreate a control.
for(const el of modes.querySelectorAll('button'))el.addEventListener('click',()=>{more.open=false;});

// Error details should be discoverable without adding permanent warning copy.
const warnings=byId('warnings'),warningPanel=byId('uxTechnicalDetails');
if(warnings&&warningPanel){
 const syncWarning=()=>{
  const failed=warnings.querySelector('.error')!==null;
  warningPanel.classList.toggle('ux-has-error',failed);
  warningPanel.querySelector('summary').textContent=failed?'Revisar error de lectura':'Estado y datos técnicos';
  if(failed)warningPanel.open=true;
 };
 new MutationObserver(syncWarning).observe(warnings,{childList:true,subtree:true,characterData:true});
 syncWarning();
}
// The view label stays a source-of-truth for mode, no custom fake anatomies.
// Explicitly label tools hidden in disclosures so users can find them.
