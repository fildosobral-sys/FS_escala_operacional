(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  function fixPhotos(){
    const table=document.querySelector('#baseContent .baseAgrupadaTable');if(!table)return;
    const head=table.querySelector('thead th:first-child');if(head)head.textContent='Foto';
    table.querySelectorAll('tbody tr:not(.baseGrupoLinha)').forEach(tr=>{
      const edit=tr.querySelector('[onclick*="editarPessoa"]'),match=edit?.getAttribute('onclick')?.match(/editarPessoa\(['"]([^'"]+)/),p=(state.pessoas||[]).find(x=>String(x.id)===String(match?.[1]));
      if(!p||!tr.cells[0])return;
      const sig=String(p.id)+'|'+String(p.fsFoto||'').length+'|'+String(p.fsFoto||'').slice(-16);
      if(tr.cells[0].dataset.fsV810!==sig){tr.cells[0].innerHTML=p.fsFoto?`<img class="fsV810ListAvatar fsV809ScreenAvatar" src="${p.fsFoto}" alt="Foto de ${esc(p.nome)}">`:`<span class="fsV810ListAvatar fsV809ScreenAvatar">${esc(initials(p.nome))}</span>`;tr.cells[0].dataset.fsV810=sig}
      tr.querySelector('td.name')?.classList.add('fsV809NameClean');
    });
  }
  function syncFab(){const b=document.querySelector('.fsV807Fab'),page=document.querySelector('#nav button.active')?.dataset.page||document.querySelector('.page.active')?.id;b?.classList.toggle('fsV810Visible',page==='visao')}
  function run(){fixPhotos();syncFab()}
  function install(){run();let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,35)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.addEventListener('click',()=>setTimeout(run,20),true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();
