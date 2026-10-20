(function(){
  'use strict';
  const PORTAL='fs_central_portal_v812', URL_KEY='fs_cloud_url_v705';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function hasCredential(){return !!(localStorage.getItem('fs_access_token')||localStorage.getItem('fs_cloud_admin_v705'))}
  function centralRequired(){return localStorage.getItem(PORTAL)==='1'&&!!localStorage.getItem(URL_KEY)&&!hasCredential()}
  function gateway(){
    if(!centralRequired())return;
    document.documentElement.classList.remove('fsDashBooting');
    document.getElementById('fsDashBoot')?.remove();
    let root=document.getElementById('fsCentralGatewayV812');
    if(root)return;
    root=document.createElement('div');root.id='fsCentralGatewayV812';
    root.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="fsCentralGateTitle"><div class="fsCentralGateBrand"><i>FS</i><div><b id="fsCentralGateTitle">Central Gerencial</b><small>Entrada do ambiente online</small></div></div><div class="fsCentralGateBody"><span class="fsCentralGateLock">🔐</span><h1>Acesso à Central encerrado</h1><p>Este aparelho continua vinculado ao ambiente online. Para proteger as filiais, a planilha não será aberta diretamente.</p><label>Link individual de acesso<input id="fsCentralAccessLink" type="url" inputmode="url" placeholder="Cole aqui o novo link enviado pela Central"></label><button class="primary" id="fsCentralEnter">Entrar pela Central</button><div class="fsCentralGateHelp"><b>Precisa entrar novamente?</b><span>Solicite ao administrador um novo link individual. O link anterior é inutilizado depois da ativação.</span></div><button class="local" id="fsCentralLocal">Usar somente o modo local neste aparelho</button><small class="fsCentralGateFoot">O modo local não acessa a Central nem as filiais online.</small></div></section>`;
    document.body.appendChild(root);
    const input=root.querySelector('#fsCentralAccessLink');
    root.querySelector('#fsCentralEnter').onclick=()=>{
      const raw=input.value.trim();
      if(!raw){input.focus();input.setCustomValidity('Cole o link individual de acesso.');input.reportValidity();return}
      try{const u=new URL(raw,location.href);if(!u.searchParams.get('invite')||!u.searchParams.get('cloud'))throw 0;location.href=u.href}catch(_){input.setCustomValidity('Este não é um link individual válido da Central.');input.reportValidity()}
    };
    input.oninput=()=>input.setCustomValidity('');
    root.querySelector('#fsCentralLocal').onclick=()=>{
      if(!confirm('Desvincular este aparelho da Central e continuar somente no modo local?'))return;
      localStorage.removeItem(PORTAL);localStorage.removeItem(URL_KEY);localStorage.removeItem('fs_cloud_mode_v705');location.reload();
    };
  }
  function repairDays(scope=document){
    scope.querySelectorAll?.('#configContent .dayScheduleCard').forEach(card=>{
      const head=card.querySelector('.dayScheduleHead');if(!head)return;
      let btn=head.querySelector('.fsV812DayToggle');
      head.querySelectorAll('.fsV806DayToggle').forEach(x=>x.remove());
      if(!btn){btn=document.createElement('button');btn.type='button';btn.className='fsV812DayToggle';head.appendChild(btn)}
      const paint=()=>{const open=card.classList.contains('fsV806Open');btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'Fechar horários do dia':'Abrir horários do dia');btn.innerHTML=`<span>${open?'⌃':'⌄'}</span>`};
      if(btn.dataset.ready!=='1'){btn.dataset.ready='1';btn.onclick=e=>{e.preventDefault();e.stopPropagation();const open=!card.classList.contains('fsV806Open');document.querySelectorAll('#configContent .dayScheduleCard.fsV806Open').forEach(x=>x.classList.remove('fsV806Open'));card.classList.toggle('fsV806Open',open);repairDays(document)};}
      paint();
    });
  }
  function install(){gateway();repairDays();let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{gateway();repairDays()},45)}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
