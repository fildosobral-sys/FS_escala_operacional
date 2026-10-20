(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  function fixPhotos(){/* V811: sem pós-processamento concorrente na lista. */}
  function syncFab(){const b=document.querySelector('.fsV807Fab'),page=document.querySelector('#nav button.active')?.dataset.page||document.querySelector('.page.active')?.id;b?.classList.toggle('fsV810Visible',page==='visao')}
  function run(){fixPhotos();syncFab()}
  function install(){run();let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,35)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.addEventListener('click',()=>setTimeout(run,20),true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();
