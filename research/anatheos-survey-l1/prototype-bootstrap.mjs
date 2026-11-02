// Only injected into the portable prototype, never changes the installed station.
const start=()=>{
 const top=document.querySelector('.brand small');if(top)top.textContent='SURVEY-BASE L1 · prototipo privado separado de tu instalación';
 const button=document.createElement('button');button.type='button';button.id='openSurveyPrototype';button.className='primary';button.textContent='Abrir mi volumen SURVEY · L1';
 button.onclick=()=>window.dispatchEvent(new CustomEvent('anatheos:open-survey-prototype',{detail:{level:'L1'}}));
 document.getElementById('seriesList').before(button);
 for(const id of ['loadIncluded','zipButton','folderButton','cmrNativeZipOpen']){const b=document.getElementById(id);if(b){b.disabled=true;b.title='Este prototipo portable abre el SURVEY preparado; la instalación original conserva la ingesta completa';}}
 for(const b of document.querySelectorAll('[role=menuitem]'))if(/Leeds|TC de ejemplo|Abrir ZIP DICOM|Abrir carpeta DICOM/.test(b.textContent))b.refresh=()=>b.disabled=true;
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
