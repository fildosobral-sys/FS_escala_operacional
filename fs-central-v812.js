(function(){
  'use strict';
  const PORTAL='fs_central_portal_v812', URL_KEY='fs_cloud_url_v705';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function hasCredential(){return !!(localStorage.getItem('fs_access_token')||localStorage.getItem('fs_cloud_admin_v705'))}
  function centralRequired(){return localStorage.getItem(PORTAL)==='1'&&!!localStorage.getItem(URL_KEY)&&!hasCredential()}
  function device(){let x=localStorage.getItem('fs_device_id')||'';if(!/^DEV-[A-Za-z0-9_-]{8,80}$/.test(x)){x='DEV-'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('fs_device_id',x)}return x}
  function jsonp(action,extra){return new Promise((resolve,reject)=>{const url=localStorage.getItem(URL_KEY)||'',cb='fsCentralCb'+Date.now()+Math.random().toString(36).slice(2),s=document.createElement('script'),timer=setTimeout(()=>done(new Error('A Central não respondeu. Verifique a internet.')),18000);function done(err,data){clearTimeout(timer);try{delete window[cb];s.remove()}catch(_){}err?reject(err):resolve(data)}window[cb]=x=>done(null,x);s.src=url+(url.includes('?')?'&':'?')+new URLSearchParams(Object.assign({action,callback:cb,deviceId:device()},extra||{}));s.onerror=()=>done(new Error('Não foi possível acessar a Central.'));document.head.appendChild(s)})}
  function gateway(){
    if(!centralRequired())return;
    document.documentElement.classList.remove('fsDashBooting');
    document.getElementById('fsDashBoot')?.remove();
    let root=document.getElementById('fsCentralGatewayV812');
    if(root)return;
    root=document.createElement('div');root.id='fsCentralGatewayV812';
    root.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="fsCentralGateTitle"><div class="fsCentralGateBrand"><i>FS</i><div><b id="fsCentralGateTitle">Central Gerencial</b><small>Entrada segura para lideranças</small></div></div><form class="fsCentralGateBody"><span class="fsCentralGateLock">🔐</span><h1>Entrar na Central</h1><p>Use os mesmos dados confirmados quando o seu convite individual foi ativado.</p><label>Nome completo<input id="fsCentralName" autocomplete="name" required></label><label>4 últimos números do telefone<input id="fsCentralPhone" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label><button class="primary" id="fsCentralEnter" type="submit">Entrar</button><div class="fsCentralGateStatus" id="fsCentralStatus" hidden></div><div class="fsCentralGateHelp"><b>Primeiro acesso?</b><span>Abra o link individual enviado pelo administrador. Depois da ativação, nome e os quatro números permitem novas entradas neste aparelho.</span></div><button class="local" id="fsCentralLocal" type="button">Usar somente o modo local neste aparelho</button><small class="fsCentralGateFoot">A Central controla a entrada. A nuvem só será carregada se este usuário tiver autorização.</small></form></section>`;
    document.body.appendChild(root);
    const form=root.querySelector('form'),status=root.querySelector('#fsCentralStatus'),submit=root.querySelector('#fsCentralEnter');
    form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;submit.textContent='Verificando acesso…';status.hidden=true;try{const r=await jsonp('leaderLogin',{name:root.querySelector('#fsCentralName').value,phoneLast4:root.querySelector('#fsCentralPhone').value});if(!r.ok)throw new Error(r.message||'Acesso não autorizado.');localStorage.setItem('fs_access_token',r.session);localStorage.setItem('fs_access_data_v1',JSON.stringify(r));localStorage.setItem('fs_cloud_branch_v705',r.branchId||'');localStorage.setItem('fs_cloud_branch_name_v708',r.branchName||'Filial');localStorage.setItem('fs_cloud_version_v705',String(r.version||0));localStorage.setItem('fs_cloud_mode_v705',r.cloudAccess===false?'local':'admin');sessionStorage.removeItem('fs_dashboard_branch_mode');sessionStorage.removeItem('fs_cloud_admin_loaded');location.reload()}catch(err){status.hidden=false;status.textContent=err.message;submit.disabled=false;submit.textContent='Entrar'}};
    root.querySelector('#fsCentralLocal').onclick=()=>{
      if(!confirm('Desvincular este aparelho da Central e continuar somente no modo local?'))return;
      localStorage.removeItem(PORTAL);localStorage.removeItem(URL_KEY);localStorage.removeItem('fs_cloud_mode_v705');location.reload();
    };
  }
  function localExit(){let d={};try{d=JSON.parse(localStorage.getItem('fs_access_data_v1')||'{}')}catch(_){}if(!localStorage.getItem('fs_access_token')||d.cloudAccess!==false)return;let b=document.getElementById('fsCentralLogoutV813');if(b)return;b=document.createElement('button');b.id='fsCentralLogoutV813';b.type='button';b.textContent='Sair da Central';b.onclick=()=>{if(!confirm('Sair deste acesso? Os dados locais da escala serão preservados.'))return;localStorage.removeItem('fs_access_token');localStorage.removeItem('fs_access_data_v1');localStorage.setItem(PORTAL,'1');location.reload()};(document.querySelector('.top .header')||document.body).appendChild(b)}
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
  function install(){gateway();localExit();repairDays();let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{gateway();localExit();repairDays()},45)}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
