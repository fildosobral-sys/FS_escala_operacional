(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  function fixPhotos(){/* V811: sem pós-processamento concorrente na lista. */}
  function syncFab(){const b=document.querySelector('.fsV807Fab'),page=document.querySelector('#nav button.active')?.dataset.page||document.querySelector('.page.active')?.id;b?.classList.toggle('fsV810Visible',page==='visao')}
  function personFromEditor(){const raw=document.getElementById('editIndex')?.value;if(raw===''||raw==null)return null;const current=typeof state!=='undefined'?state:window.state;return current?.pessoas?.[Number(raw)]||null}
  function decorateIndividualStage(stage){
    if(!stage?.classList?.contains('fsInd523Stage')||stage.dataset.fsV817Photo==='1')return;
    const p=personFromEditor(),head=stage.querySelector('.fsInd523Header');if(!p||!head)return;
    stage.dataset.fsV817Photo='1';
    const photo=document.createElement('div');photo.className='fsInd523Photo';
    photo.innerHTML=p.fsFoto?`<img src="${esc(p.fsFoto)}" alt="Foto de ${esc(p.nome)}">`:`<span>${esc(initials(p.nome))}</span>`;
    head.insertBefore(photo,head.firstChild);
  }
  function run(){fixPhotos();syncFab()}
  function install(){
    run();
    const append=document.body.appendChild;
    document.body.appendChild=function(node){decorateIndividualStage(node);return append.call(this,node)};
    let timer;new MutationObserver(mutations=>{mutations.forEach(m=>m.addedNodes.forEach(n=>decorateIndividualStage(n)));clearTimeout(timer);timer=setTimeout(run,35)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',()=>setTimeout(run,20),true)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,300));else setTimeout(install,300);
})();
