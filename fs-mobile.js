(function(){
 const mq=window.matchMedia('(max-width:820px)');
 function mobile(){return mq.matches}
 function nav(){if(!mobile())return;const n=document.getElementById('nav');if(!n||n.dataset.fsV3==='1')return;n.dataset.fsV3='1';n.addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(!b)return;setTimeout(()=>{try{b.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}catch(_){}},60)});}
 function sunday(){if(!mobile())return;document.querySelectorAll('.fsDomDataCard table.fsDomDataTabela').forEach(t=>{if(t.parentElement?.classList.contains('fsDomTableMobileScroll'))return;const w=document.createElement('div');w.className='fsDomTableMobileScroll';t.parentNode.insertBefore(w,t);w.appendChild(t);});}
 function apply(){nav();sunday()}
 document.addEventListener('DOMContentLoaded',apply);window.addEventListener('load',apply);mq.addEventListener?.('change',apply);let tm;new MutationObserver(()=>{if(!mobile())return;clearTimeout(tm);tm=setTimeout(apply,40)}).observe(document.documentElement,{childList:true,subtree:true});setTimeout(apply,100);setTimeout(apply,500);
})();
