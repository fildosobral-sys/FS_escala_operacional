/* FS Nuvem v718 - identidade preservada na limpeza + recuperação administrativa */
(function(){
  'use strict';

  const CFG=window.FS_CLOUD_CONFIG||{};
  const ENDPOINT_KEY='fs_cloud_endpoint';
  const TOKEN_KEY='fs_cloud_token';
  const SESSION_KEY='fs_cloud_session_v703';
  const SAVED_ACCESS_KEY='fs_cloud_saved_accesses_v1';
  const PROFILE_KEY='fs_cloud_profile';
  const BRANCH_KEY='fs_cloud_branch_v703';
  const VERSION_KEY='fs_cloud_version';
  const LAST_SYNC_KEY='fs_cloud_last_sync';
  const DEVICE_KEY='fs_cloud_device_id';
  const APPLY_FLAG='fs_cloud_apply_reload';
  const CANONICAL_KEY='fs_escala_limpa_v381';
  const LOCAL_MODE_KEY='fs_cloud_local_mode_v1';
  const FIRST_CHOICE_KEY='fs_cloud_first_choice_v1';
  const SUPPORT_WHATSAPP='5588988222564';
  const CLOUD_PREFIX='fs_cloud_';
  const LOCAL_BRANCH_CACHE_PREFIX='fs_cloud_local_branch_';
  const LOCAL_ONLY=new Set([
    'fs_access_data_v1','fs_access_token','fs_access_verified_at','fs_access_verified_fingerprint',
    'fs_cargo','fs_genero','fs_nome','fs_nome_vendedor','fs_nome_vendedor_sessao','fs_pode_compartilhar',
    'fs_whatsapp','nomeVendedor','nomeVendedorLogado','vendedor_nome','colaboradorNome','nomeColaborador',
    'usuarioAutorizado','vendedorLogado','autorizado','dispositivoAutorizado','fsAuthGlobal','fs_device_id'
  ]);

  let profile=null, cloudVersion=0, lastSnapshot='', saveTimer=null, pollTimer=null, versionPollTimer=null;
  let writeInFlight=false, applying=false, bootComplete=false, viewerGuardInstalled=false;

  function uuid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():'fs-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
  function deviceId(){let id=localStorage.getItem(DEVICE_KEY);if(!id){id=uuid();localStorage.setItem(DEVICE_KEY,id)}return id}
  function endpoint(){return String(CFG.WEB_APP_URL||localStorage.getItem(ENDPOINT_KEY)||'').trim()}
  function setEndpoint(v){localStorage.setItem(ENDPOINT_KEY,String(v||'').trim())}
  function token(){return localStorage.getItem(TOKEN_KEY)||''}
  function session(){return localStorage.getItem(SESSION_KEY)||''}
  function inviteToken(){try{return new URLSearchParams(location.search).get('fsinvite')||''}catch(_){return ''}}
  function branchId(){return String(profile?.branchId||localStorage.getItem(BRANCH_KEY)||'')}
  function isGlobalAdmin(){return !!profile?.globalAdmin}
  function role(){return profile?.role||''}
  function canWrite(){return isGlobalAdmin()||role()==='branch_admin'||role()==='editor'}
  function canShare(){return isGlobalAdmin()||role()==='branch_admin'||!!profile?.canShare}
  function roleLabel(r){return r==='global_admin'?'Administrador geral':r==='branch_admin'?'Administrador':r==='editor'?'Editor':'Visualizador'}
  function esc(s){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
  function authParams(extra={}){const p=session()?{session:session()}:{token:token()};if(isGlobalAdmin()&&branchId())p.branchId=branchId();return {...p,deviceId:deviceId(),...extra}}

  function platformStorage(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(!k||k.startsWith(CLOUD_PREFIX)||LOCAL_ONLY.has(k))continue;
      try{out[k]=localStorage.getItem(k)}catch(_){ }
    }
    return out;
  }
  function buildSnapshot(){return JSON.stringify({schema:1,app:'FS Escala Operacional Inteligente',canonicalKey:CANONICAL_KEY,savedAt:new Date().toISOString(),storage:platformStorage()})}
  function stableSnapshot(){return JSON.stringify(platformStorage())}
  function snapshotHasOperationalData(snapshot){try{const x=typeof snapshot==='string'?JSON.parse(snapshot):snapshot;const raw=x?.storage?.[CANONICAL_KEY];const state=raw?JSON.parse(raw):null;return !!(state&&Array.isArray(state.pessoas))}catch(_){return false}}

  function overlayHtml(inner,wide=false){
    let root=document.getElementById('fsCloudOverlay');if(!root){root=document.createElement('div');root.id='fsCloudOverlay';document.documentElement.appendChild(root)}
    root.innerHTML=`<style>
      #fsCloudOverlay{position:fixed;inset:0;z-index:2147483646;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e7eb;overflow:auto}
      #fsCloudOverlay .fsc-card{position:relative;width:min(${wide?'920':'560'}px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid #334155;border-radius:18px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      #fsCloudOverlay h2{margin:0 0 8px;font-size:20px}#fsCloudOverlay h3{font-size:14px;margin:20px 0 8px;color:#dbeafe}#fsCloudOverlay p{margin:8px 0;line-height:1.45;color:#cbd5e1}
      #fsCloudOverlay label{display:block;margin-top:12px;font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
      #fsCloudOverlay input,#fsCloudOverlay select{width:100%;box-sizing:border-box;margin-top:5px;padding:11px 12px;border-radius:10px;border:1px solid #475569;background:#020617;color:#fff;font-size:14px}
      #fsCloudOverlay input[type=checkbox]{width:auto;margin:0 7px 0 0;vertical-align:middle}
      #fsCloudOverlay .fsc-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px}#fsCloudOverlay .fsc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#fsCloudOverlay .fsc-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #fsCloudOverlay button{border:0;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer;background:#2563eb;color:#fff}#fsCloudOverlay button.secondary{background:#334155}#fsCloudOverlay button.danger{background:#991b1b}#fsCloudOverlay button.good{background:#166534}
      #fsCloudOverlay .fsc-note{font-size:12px;color:#94a3b8;margin-top:10px}.fsc-closeX{position:absolute;right:14px;top:12px;width:34px;height:34px;border-radius:999px!important;padding:0!important;background:#1e293b!important;color:#e2e8f0!important;font-size:22px!important;line-height:1!important}.fsc-menuGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}.fsc-menuCard{border:1px solid #334155;background:#111827;border-radius:14px;padding:13px}.fsc-menuCard h3{margin:0 0 8px!important;color:#fff!important;font-size:13px!important}.fsc-menuCard p{font-size:11px!important;margin:0 0 10px!important}.fsc-menuCard button{width:100%;margin-top:7px;text-align:left}.fsc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0 16px}.fsc-kpi{border:1px solid #334155;background:#111827;border-radius:12px;padding:11px}.fsc-kpi b{display:block;font-size:20px;color:#fff}.fsc-kpi span{font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:800}.fsc-section{border:1px solid #334155;border-radius:14px;padding:12px;margin:10px 0;background:#0b1220}.fsc-section>h3{margin:0 0 8px!important}.fsc-accessBtn{display:flex!important;align-items:center;justify-content:space-between;width:100%;margin:7px 0;text-align:left}.fsc-error{color:#fecaca!important}.fsc-ok{color:#bbf7d0!important}.fsc-cardline{padding:11px;border:1px solid #334155;border-radius:12px;margin:8px 0;background:#111827}.fsc-cardline b{color:#fff}.fsc-mini{font-size:11px;color:#94a3b8}.fsc-pill{display:inline-block;padding:3px 7px;border-radius:999px;background:#1e293b;font-size:10px;font-weight:800;margin-left:5px}.fsc-sep{height:1px;background:#334155;margin:16px 0}.fsc-reflect{text-align:center;padding:18px 8px 10px}.fsc-reflectMark{width:54px;height:54px;margin:0 auto 12px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#1d4ed8,#38bdf8);font-size:28px;box-shadow:0 12px 28px rgba(56,189,248,.22)}.fsc-reflectKicker{font-size:11px;letter-spacing:1.8px;font-weight:950;color:#93c5fd;margin-bottom:12px}.fsc-reflect blockquote{margin:0 auto;max-width:560px;font-size:20px;line-height:1.45;font-weight:850;color:#f8fafc}.fsc-reflectLine{width:54px;height:3px;border-radius:999px;background:#38bdf8;margin:18px auto 13px}.fsc-reflect p{margin:0!important;color:#dbeafe!important;font-weight:850}.fsc-reflect small{display:block;margin-top:5px;color:#94a3b8;font-size:11px}
      @media(max-width:680px){#fsCloudOverlay .fsc-grid,#fsCloudOverlay .fsc-grid3,#fsCloudOverlay .fsc-menuGrid{grid-template-columns:1fr}#fsCloudOverlay .fsc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#fsCloudOverlay .fsc-card{padding:16px}}
    </style><div class="fsc-card">${inner}</div>`;return root;
  }
  function closeOverlay(){document.getElementById('fsCloudOverlay')?.remove()}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('fsCloudOverlay'))closeOverlay()});
  const FS_REFLEXOES=[
    'Toda melhoria começa quando a gente observa com atenção o que pode ser feito melhor.',
    'Consistência transforma pequenas escolhas em grandes resultados.',
    'Liderar também é criar clareza para que cada pessoa saiba onde está e para onde vai.',
    'O que é bem organizado hoje libera tempo e energia para as decisões de amanhã.',
    'Crescimento não acontece apenas quando avançamos; acontece também quando aprendemos a ajustar a rota.',
    'Disciplina é fazer com intenção aquilo que, repetido, constrói o resultado que queremos.',
    'Um bom processo não substitui as pessoas: ele ajuda as pessoas a trabalharem melhor.',
    'Autodesenvolvimento começa pela coragem de rever hábitos, decisões e prioridades.',
    'Quem cuida dos detalhes fortalece o todo.',
    'A clareza de hoje evita o retrabalho de amanhã.',
    'Resultados sustentáveis nascem de processos simples, compreendidos e bem executados.',
    'Evoluir é manter o que funciona e ter maturidade para melhorar o que ainda pode funcionar melhor.'
  ];
  let fsReflexaoAnterior=-1;
  function proximaReflexao(){let i=Math.floor(Math.random()*FS_REFLEXOES.length);if(FS_REFLEXOES.length>1&&i===fsReflexaoAnterior)i=(i+1)%FS_REFLEXOES.length;fsReflexaoAnterior=i;return FS_REFLEXOES[i]}
  function showBusy(msg){
    const frase=proximaReflexao();
    overlayHtml(`<div class="fsc-reflect"><div class="fsc-reflectMark">✦</div><div class="fsc-reflectKicker">REFLEXÃO DO MOMENTO</div><blockquote>“${esc(frase)}”</blockquote><div class="fsc-reflectLine"></div><p>Preparando seu ambiente…</p><small>${esc(msg||'Atualizando informações')}</small></div>`)
  }
  function showError(msg,retry=true){overlayHtml(`<h2>Não foi possível concluir</h2><p class="fsc-error">${esc(msg)}</p><div class="fsc-row">${retry?'<button id="fscRetry">Tentar novamente</button>':''}<button class="secondary" id="fscLogout">Trocar acesso</button></div>`);document.getElementById('fscRetry')?.addEventListener('click',boot);document.getElementById('fscLogout')?.addEventListener('click',logout)}
  function toast(msg){let t=document.getElementById('fsCloudToast');if(!t){t=document.createElement('div');t.id='fsCloudToast';t.style.cssText='position:fixed;left:50%;bottom:62px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font:700 12px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:90vw;text-align:center';document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(t._x);t._x=setTimeout(()=>t.hidden=true,2800)}

  function jsonp(params){return new Promise((resolve,reject)=>{const base=endpoint();if(!base)return reject(new Error('URL do Apps Script ainda não configurada.'));const cb='__fsCloudCb_'+Math.random().toString(36).slice(2),script=document.createElement('script');const timer=setTimeout(()=>finish(new Error('Tempo de resposta excedido.')),Number(CFG.REQUEST_TIMEOUT_MS||18000));function finish(err,data){clearTimeout(timer);try{delete window[cb]}catch(_){window[cb]=undefined}script.remove();err?reject(err):resolve(data)}window[cb]=data=>finish(null,data);const q=new URLSearchParams({...params,callback:cb,_:Date.now().toString()});script.onerror=()=>finish(new Error('Falha ao acessar o serviço da nuvem.'));script.src=base+(base.includes('?')?'&':'?')+q.toString();document.head.appendChild(script)})}
  function postForm(params){const base=endpoint();if(!base)throw new Error('URL do Apps Script não configurada.');let iframe=document.getElementById('fsCloudPostFrame');if(!iframe){iframe=document.createElement('iframe');iframe.id='fsCloudPostFrame';iframe.name='fsCloudPostFrame';iframe.style.display='none';document.body.appendChild(iframe)}const form=document.createElement('form');form.method='POST';form.action=base;form.target='fsCloudPostFrame';form.style.display='none';Object.entries(params).forEach(([k,v])=>{const inp=document.createElement('input');inp.type='hidden';inp.name=k;inp.value=String(v??'');form.appendChild(inp)});document.body.appendChild(form);form.submit();setTimeout(()=>form.remove(),1500)}

  function showEndpointSetup(){overlayHtml(`<h2>☁ Ativar FS Nuvem</h2><p>Cole a URL <b>/exec</b> do Web App do Google Apps Script.</p><label>URL do Web App</label><input id="fscEndpoint"><div class="fsc-row"><button id="fscSaveEndpoint">Salvar e conectar</button></div>`);document.getElementById('fscSaveEndpoint').onclick=()=>{const v=document.getElementById('fscEndpoint').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(v))return alert('Cole a URL /exec do Apps Script.');setEndpoint(v);boot()}}

  function savedAccesses(){try{return JSON.parse(localStorage.getItem(SAVED_ACCESS_KEY)||'[]')}catch(_){return []}}
  function writeSavedAccesses(list){localStorage.setItem(SAVED_ACCESS_KEY,JSON.stringify((list||[]).slice(0,12)))}
  function rememberCurrentAccess(){
    if(!profile)return;
    const cred=session()?{kind:'session',value:session()}:(token()?{kind:'token',value:token()}:null);if(!cred)return;
    const key=(profile.globalAdmin?'ADMIN':(profile.memberId||profile.name||'USER'))+'|'+(profile.branchId||'');
    const item={key,name:profile.name||'Usuário',role:role(),globalAdmin:!!profile.globalAdmin,branchId:profile.branchId||'',branchName:profile.branchName||'',sector:profile.sector||'',kind:cred.kind,value:cred.value,updatedAt:new Date().toISOString()};
    const list=savedAccesses().filter(x=>x.key!==key);list.unshift(item);writeSavedAccesses(list);
  }
  function releaseViewerMode(){document.documentElement.dataset.fsCloudRole='';document.querySelectorAll('[data-fs-viewer-disabled="1"]').forEach(el=>{el.disabled=false;el.removeAttribute('data-fs-viewer-disabled')});document.querySelectorAll('[data-fs-viewer-contenteditable]').forEach(el=>{el.setAttribute('contenteditable',el.getAttribute('data-fs-viewer-contenteditable')||'true');el.removeAttribute('data-fs-viewer-contenteditable')})}
  function clearActiveAccess(){releaseViewerMode();localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(BRANCH_KEY);localStorage.removeItem(VERSION_KEY);profile=null;cloudVersion=0;bootComplete=false;clearInterval(pollTimer);clearInterval(versionPollTimer);document.getElementById('fsCloudHeaderBox')?.remove()}
  function useSavedAccess(item){
    localStorage.removeItem(LOCAL_MODE_KEY);localStorage.setItem(FIRST_CHOICE_KEY,'cloud');
    clearActiveAccess();if(item.kind==='session')localStorage.setItem(SESSION_KEY,item.value);else localStorage.setItem(TOKEN_KEY,item.value);if(item.branchId)localStorage.setItem(BRANCH_KEY,item.branchId);location.reload();
  }
  function supportWhatsAppUrl(){
    const msg='Olá, Fildo. Quero solicitar acesso à plataforma Escala 5x2 na nuvem. Pode liberar minhas credenciais/acesso?';
    return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }
  function requestCredentials(){window.open(supportWhatsAppUrl(),'_blank','noopener,noreferrer')}
  function installLocalHeaderControls(){
    document.getElementById('fsCloudHeaderBox')?.remove();
    const host=document.querySelector('header.top')||document.querySelector('.top')||document.body;
    const box=document.createElement('div');box.id='fsCloudHeaderBox';box.style.cssText='display:flex;align-items:center;gap:7px;margin-left:auto;padding:0 6px;z-index:50;font-family:Inter,system-ui,sans-serif';
    box.innerHTML=`<span title="Uso independente neste aparelho" style="font-size:10px;font-weight:800;padding:5px 8px;border-radius:999px;background:#fef3c7;color:#92400e;white-space:nowrap">Modo local</span><button id="fsCloudDots" title="Menu" style="border:0;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;padding:2px 7px">⋮</button>`;
    host.appendChild(box);document.getElementById('fsCloudDots')?.addEventListener('click',showLocalMenu);
  }
  function enterLocalMode(persist=true){
    clearActiveAccess();if(persist){localStorage.setItem(LOCAL_MODE_KEY,'1');localStorage.setItem(FIRST_CHOICE_KEY,'local')}
    closeOverlay();bootComplete=true;document.documentElement.dataset.fsCloudRole='local';installLocalHeaderControls();startWatchers();
    window.dispatchEvent(new CustomEvent('fscloudready',{detail:{profile:null,version:0,local:true}}));
  }
  function showLocalMenu(){
    overlayHtml(`<button class="fsc-closeX" id="fscCloseX" aria-label="Fechar">×</button><h2>💻 Modo local</h2><p>Esta escala está funcionando somente neste aparelho. As alterações ficam salvas localmente e nada é enviado para a nuvem.</p><div class="fsc-menuGrid"><section class="fsc-menuCard"><h3>☁ Conectar à nuvem</h3><p>Use um acesso recebido ou entre como Administrador.</p><button id="fscConnectCloud">Entrar na nuvem</button><button class="secondary" id="fscRequestCred">Solicitar credenciais pelo WhatsApp</button></section><section class="fsc-menuCard"><h3>💾 Uso independente</h3><p>Continue trabalhando normalmente neste aparelho. Backups e importações continuam disponíveis nas Configurações.</p><button class="secondary" id="fscStayLocal">Continuar no modo local</button></section></div><p class="fsc-note">Para sincronizar entre aparelhos ou compartilhar uma filial, conecte um acesso à FS Nuvem.</p>`,true);
    document.getElementById('fscCloseX').onclick=closeOverlay;document.getElementById('fscStayLocal').onclick=closeOverlay;document.getElementById('fscConnectCloud').onclick=()=>{localStorage.removeItem(LOCAL_MODE_KEY);localStorage.setItem(FIRST_CHOICE_KEY,'cloud');showAccessChooser('Escolha um acesso salvo, entre como administrador ou solicite seu acesso.')};document.getElementById('fscRequestCred').onclick=requestCredentials;
  }
  function showFirstChoice(){
    overlayHtml(`<h2>Como você quer usar a Escala 5x2?</h2><p>Escolha o modo deste aparelho. Você poderá mudar depois pelo menu ⋮.</p><div class="fsc-menuGrid"><section class="fsc-menuCard"><h3>💻 Usar somente neste aparelho</h3><p>Abre normalmente, salva tudo localmente e não usa a nuvem.</p><button class="good" id="fscChooseLocal">Usar modo local</button></section><section class="fsc-menuCard"><h3>☁ Usar FS Nuvem</h3><p>Para compartilhar/sincronizar filiais, use um acesso autorizado.</p><button id="fscChooseCloud">Entrar na nuvem</button><button class="secondary" id="fscRequestCred">Solicitar credenciais</button></section></div><p class="fsc-note">Sem credenciais? Toque em “Solicitar credenciais” e o WhatsApp abrirá uma mensagem pronta para o administrador.</p>`,true);
    document.getElementById('fscChooseLocal').onclick=()=>enterLocalMode(true);document.getElementById('fscChooseCloud').onclick=()=>{localStorage.removeItem(LOCAL_MODE_KEY);localStorage.setItem(FIRST_CHOICE_KEY,'cloud');showAccessChooser('Escolha um acesso já utilizado ou entre com um acesso autorizado.')};document.getElementById('fscRequestCred').onclick=requestCredentials;
  }
  function showAccessChooser(message){
    const list=savedAccesses();const rows=list.map((a,i)=>`<button class="secondary fsc-accessBtn" data-i="${i}"><span><b>${esc(a.name)}</b><br><small>${esc(roleLabel(a.role))} · ${esc(a.branchName||'Filial')}${a.sector?' · '+esc(a.sector):''}</small></span><span>Entrar ›</span></button>`).join('');
    overlayHtml(`<button class="fsc-closeX" id="fscCloseX" aria-label="Fechar e usar localmente">×</button><h2>Entrar na FS Nuvem</h2><p>${esc(message||'Escolha um acesso já utilizado neste aparelho.')}</p>${rows||'<p class="fsc-note">Nenhum acesso salvo neste aparelho.</p>'}<div class="fsc-sep"></div><div class="fsc-row"><button id="fscAdminLogin">Entrar como administrador</button><button class="secondary" id="fscRequestCred">Solicitar credenciais</button></div><p class="fsc-note">Editor, Administrador da filial e Visualizador entram pelo convite individual recebido. Fechar no × mantém a plataforma em modo local.</p>`,true);
    document.getElementById('fscCloseX').onclick=()=>enterLocalMode(true);document.getElementById('fscAdminLogin').onclick=()=>showAdminLogin('Acesso do Administrador geral.');document.getElementById('fscRequestCred').onclick=requestCredentials;document.querySelectorAll('.fsc-accessBtn').forEach(b=>b.onclick=()=>useSavedAccess(list[Number(b.dataset.i)]));
  }

  function isTimeoutError(e){return /tempo de resposta excedido|timeout|demorou/i.test(String(e&&e.message||e||''))}
  async function authenticateResilient(){
    try{return await authenticate()}catch(e){
      if(!isTimeoutError(e))throw e;
      showBusy('Conectando à nuvem...');
      await new Promise(r=>setTimeout(r,1200));
      return await authenticate();
    }
  }
  function showAdminLogin(message){localStorage.removeItem(LOCAL_MODE_KEY);localStorage.setItem(FIRST_CHOICE_KEY,'cloud');overlayHtml(`<h2>FS Escala 5x2</h2><p>${esc(message||'Acesso administrativo.')}</p><label>Senha do Administrador</label><input id="fscToken" type="password" autocomplete="current-password"><div class="fsc-row"><button id="fscLogin">Entrar</button></div><p class="fsc-note">Os demais usuários entram por convites individuais gerados dentro da plataforma.</p>`);const go=async()=>{const input=document.getElementById('fscToken');const t=input.value.trim();if(!t)return;localStorage.setItem(TOKEN_KEY,t);localStorage.removeItem(SESSION_KEY);showBusy('Validando acesso...');try{await authenticateResilient();finalizeBoot({version:cloudVersion});if(!snapshotHasOperationalData(buildSnapshot()))toast('Use o menu ⋮ para carregar a versão oficial da nuvem.')}catch(e){if(isTimeoutError(e)){return showAdminLogin('A nuvem demorou para responder. Sua senha não foi descartada. Tente entrar novamente em alguns segundos.')}localStorage.removeItem(TOKEN_KEY);showAdminLogin(e.message||'Senha inválida.')}};document.getElementById('fscLogin').onclick=go;document.getElementById('fscToken').onkeydown=e=>{if(e.key==='Enter')go()}}

  async function showInviteClaim(raw){
    localStorage.removeItem(LOCAL_MODE_KEY);localStorage.setItem(FIRST_CHOICE_KEY,'cloud');
    showBusy('Validando convite...');
    try{
      const info=await jsonp({action:'inviteInfo',invite:raw,deviceId:deviceId()});if(!info?.ok)throw new Error(info?.message||'Convite inválido.');
      overlayHtml(`<h2>Você recebeu acesso à Escala 5x2</h2><p>Destino: <b>${esc(info.branchName||'')}</b>${info.sector?` · ${esc(info.sector)}`:''}</p><p>Perfil: <b>${esc(roleLabel(info.role))}</b>${info.canShare?' · poderá compartilhar novos acessos':''}</p><label>Informe seu nome</label><input id="fscClaimName" placeholder="Nome da pessoa convidada" autocomplete="name"><div class="fsc-row"><button id="fscClaim">Ativar meu acesso</button></div><p class="fsc-note">Este convite é individual. O nome precisa corresponder à pessoa para quem o acesso foi criado e o link só pode ser ativado uma vez.</p>`);
      const claim=async()=>{const name=document.getElementById('fscClaimName').value.trim();if(!name)return;showBusy('Ativando seu acesso...');const res=await jsonp({action:'claimInvite',invite:raw,name,deviceId:deviceId()});if(!res?.ok)return showInviteClaimError(raw,res?.message||'Não foi possível ativar.');localStorage.setItem(SESSION_KEY,res.session);localStorage.removeItem(TOKEN_KEY);localStorage.setItem(BRANCH_KEY,res.branchId);const u=new URL(location.href);u.searchParams.delete('fsinvite');history.replaceState({},'',u.toString());await authenticate();finalizeBoot({version:cloudVersion});toast('Acesso ativado. Use o menu ⋮ para carregar a escala oficial desta filial.')};
      document.getElementById('fscClaim').onclick=claim;document.getElementById('fscClaimName').onkeydown=e=>{if(e.key==='Enter')claim()};
    }catch(e){showInviteClaimError(raw,e.message)}
  }
  function showInviteClaimError(raw,msg){overlayHtml(`<h2>Convite não ativado</h2><p class="fsc-error">${esc(msg)}</p><div class="fsc-row"><button id="fscInviteRetry">Tentar novamente</button></div>`);document.getElementById('fscInviteRetry').onclick=()=>showInviteClaim(raw)}

  async function authenticate(){
    const res=await jsonp({action:'auth',...authParams()});if(!res?.ok)throw new Error(res?.message||'Acesso não autorizado.');
    profile={name:res.name||'',role:res.role||'viewer',globalAdmin:!!res.globalAdmin,canShare:!!res.canShare,memberId:res.memberId||'',branchId:res.branchId||'',branchName:res.branchName||'',sector:res.sector||''};
    localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));localStorage.setItem(BRANCH_KEY,profile.branchId);
    // v709: a versao local representa a ultima versao realmente carregada/salva neste aparelho.
    // Nao substitua esse numero apenas porque o servidor informou uma versao mais nova no login,
    // pois isso preserva a protecao contra sobrescrita de alteracoes feitas em outro dispositivo.
    cloudVersion=Number(localStorage.getItem(VERSION_KEY)||0);rememberCurrentAccess();return res;
  }

  function cachedProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch(_){return null}}
  function branchCacheKey(id){return LOCAL_BRANCH_CACHE_PREFIX+String(id||'')}
  function saveCurrentBranchCache(){
    if(!profile?.branchId)return;try{localStorage.setItem(branchCacheKey(profile.branchId),JSON.stringify({payload:JSON.stringify(buildSnapshot()),version:cloudVersion,savedAt:new Date().toISOString()}))}catch(_){ }
  }
  function restoreBranchCache(id){
    try{const raw=localStorage.getItem(branchCacheKey(id));if(!raw)return false;const c=JSON.parse(raw);if(!c?.payload)return false;applySnapshot(c.payload,Number(c.version||0));sessionStorage.removeItem(APPLY_FLAG);return true}catch(e){console.warn('FS Nuvem: cache local da filial inválido',e);return false}
  }
  function clearOperationalLocal(){
    const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&!k.startsWith(CLOUD_PREFIX)&&!LOCAL_ONLY.has(k))keys.push(k)}keys.forEach(k=>localStorage.removeItem(k));
  }
  function localBoot(){
    const cp=cachedProfile();if(!cp)return false;
    profile=cp;cloudVersion=Number(localStorage.getItem(VERSION_KEY)||0);lastSnapshot=stableSnapshot();
    finalizeBoot({version:cloudVersion});return true;
  }
  async function validateAccessInBackground(){
    try{
      const res=await jsonp({action:'auth',...authParams()});if(!res?.ok)throw new Error(res?.message||'Acesso não autorizado.');
      const fresh={name:res.name||'',role:res.role||'viewer',globalAdmin:!!res.globalAdmin,canShare:!!res.canShare,memberId:res.memberId||'',branchId:res.branchId||'',branchName:res.branchName||'',sector:res.sector||''};
      profile=fresh;localStorage.setItem(PROFILE_KEY,JSON.stringify(fresh));localStorage.setItem(BRANCH_KEY,fresh.branchId);rememberCurrentAccess();installHeaderControls();
    }catch(e){console.warn('FS Nuvem: validacao em segundo plano falhou:',e)}
  }

  function applySnapshot(payload,version){
    const x=JSON.parse(payload);if(!x?.storage)throw new Error('Estado oficial inválido.');applying=true;
    try{
      const incoming=x.storage;
      // Remove dados operacionais atuais que nao existem no snapshot recebido, evitando mistura entre filiais.
      const existing=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&!k.startsWith(CLOUD_PREFIX)&&!LOCAL_ONLY.has(k))existing.push(k)}
      existing.forEach(k=>{if(!(k in incoming))localStorage.removeItem(k)});
      Object.entries(incoming).forEach(([k,v])=>localStorage.setItem(k,String(v??'')));
      cloudVersion=Number(version||0);localStorage.setItem(VERSION_KEY,String(cloudVersion));localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());lastSnapshot=stableSnapshot();sessionStorage.setItem(APPLY_FLAG,'1');
    }finally{applying=false}
  }

  async function loadOfficialState(){
    const res=await jsonp({action:'read',...authParams()});if(!res?.ok)throw new Error(res?.message||'Falha ao carregar a filial.');
    profile.branchId=res.branchId||profile.branchId;profile.branchName=res.branchName||profile.branchName;profile.sector=res.sector||profile.sector;localStorage.setItem(BRANCH_KEY,profile.branchId);
    if(res.empty){
      if(canWrite() && snapshotHasOperationalData(buildSnapshot())) return showInitialize();
      throw new Error('Esta filial ainda não possui uma escala oficial.');
    }
    const cameFromReload=sessionStorage.getItem(APPLY_FLAG)==='1';if(cameFromReload)sessionStorage.removeItem(APPLY_FLAG);
    const current=stableSnapshot();applySnapshot(res.payload,res.version);saveCurrentBranchCache();
    // Recarrega uma unica vez para que toda a aplicacao leia o snapshot da filial.
    if(!cameFromReload && current!==stableSnapshot()){location.reload();return}
    // Se applySnapshot marcou reload mas nao foi necessario, remova a marca.
    sessionStorage.removeItem(APPLY_FLAG);
    finalizeBoot(res);
  }

  function showInitialize(){overlayHtml(`<h2>Inicializar filial</h2><p>Esta filial ainda não possui uma versão oficial. Este aparelho tem dados válidos que podem ser publicados como a primeira versão.</p><div class="fsc-row"><button id="fscInit">Publicar como versão oficial</button><button class="secondary" id="fscLogout">Sair</button></div>`);document.getElementById('fscInit').onclick=async()=>{showBusy('Publicando primeira versão...');await sendSnapshot(true,true);location.reload()};document.getElementById('fscLogout').onclick=logout}

  function finalizeBoot(res){closeOverlay();bootComplete=true;cloudVersion=Number(res.version||cloudVersion);lastSnapshot=stableSnapshot();if(canWrite())releaseViewerMode();document.documentElement.dataset.fsCloudRole=canWrite()?'editor':'viewer';installHeaderControls();if(!canWrite())enforceViewerMode();startWatchers();window.dispatchEvent(new CustomEvent('fscloudready',{detail:{profile,version:cloudVersion}}))}

  function installHeaderControls(){
    document.getElementById('fsCloudHeaderBox')?.remove();
    const host=document.querySelector('header.top')||document.querySelector('.top')||document.body;
    const box=document.createElement('div');box.id='fsCloudHeaderBox';box.style.cssText='display:flex;align-items:center;gap:7px;margin-left:auto;padding:0 6px;z-index:50;font-family:Inter,system-ui,sans-serif';
    const branch=`${profile?.branchName||'Filial'}${profile?.sector?' · '+profile.sector:''}`;
    box.innerHTML=`<span id="fsCloudBranchChip" title="Filial atual" style="font-size:10px;font-weight:800;padding:5px 8px;border-radius:999px;background:#e2e8f0;color:#0f172a;white-space:nowrap;max-width:210px;overflow:hidden;text-overflow:ellipsis">${esc(branch)}</span><span title="Modo de acesso" style="font-size:10px;font-weight:800;padding:5px 8px;border-radius:999px;background:${canWrite()?'#dcfce7':'#f1f5f9'};color:${canWrite()?'#166534':'#475569'}">${esc(roleLabel(role()))}</span><button id="fsCloudDots" title="Menu da nuvem" style="border:0;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;padding:2px 7px">⋮</button>`;
    host.appendChild(box);document.getElementById('fsCloudDots')?.addEventListener('click',showManagerHome);
  }

  function showManagerHome(){
    const who=`${esc(profile?.name||'Usuário')} · ${esc(roleLabel(role()))}`;
    const filial=`${esc(profile?.branchName||'')}${profile?.sector?' · '+esc(profile.sector):''}`;
    const accessCard=canShare()?`<section class="fsc-menuCard"><h3>👥 Acessos e pessoas</h3><p>Convites, usuários e permissões desta estrutura.</p><button id="fscShare">Gerar novo acesso</button><button class="secondary" id="fscDash">Painel de acessos</button></section>`:'';
    const branchCard=(isGlobalAdmin()||role()==='branch_admin')?`<section class="fsc-menuCard"><h3>🏢 Filial e ambiente</h3><p>Identificação e navegação entre ambientes independentes.</p><button class="secondary" id="fscRename">Identificação da filial</button>${isGlobalAdmin()?'<button class="secondary" id="fscBranches">Trocar filial</button>':''}</section>`:'';
    const syncButtons=canWrite()?`<button id="fscSaveCloud">Salvar na nuvem</button><button class="secondary" id="fscReload">Carregar da nuvem</button>`:`<button class="secondary" id="fscReload">Carregar da nuvem</button>`;
    overlayHtml(`<button class="fsc-closeX" id="fscCloseX" aria-label="Fechar">×</button><h2>☁ FS Nuvem</h2><p><b>${who}</b><br>Filial: <b>${filial}</b> · versão local <b>${cloudVersion}</b></p><div class="fsc-menuGrid">${accessCard}${branchCard}<section class="fsc-menuCard"><h3>☁ Sincronização manual</h3><p>O trabalho fica salvo neste aparelho. A nuvem só muda quando você escolher salvar.</p>${syncButtons}</section><section class="fsc-menuCard"><h3>👤 Sessão</h3><p>Troque de pessoa sem apagar o acesso já ativado neste aparelho.</p><button class="secondary" id="fscSwitchUser">Trocar usuário</button>${!isGlobalAdmin()?'<button id="fscAdminRecover">Entrar como administrador geral</button>':''}<button class="danger" id="fscLogout">Remover este acesso do aparelho</button></section></div><p class="fsc-note">Alterações, importações e backups permanecem locais até você tocar em “Salvar na nuvem”. “Carregar da nuvem” substitui os dados locais pela versão oficial.</p>`,true);
    document.getElementById('fscCloseX').onclick=closeOverlay;document.getElementById('fscShare')?.addEventListener('click',showCreateInvite);document.getElementById('fscDash')?.addEventListener('click',showDashboard);document.getElementById('fscRename')?.addEventListener('click',showRenameBranch);document.getElementById('fscBranches')?.addEventListener('click',showBranchSwitcher);
    document.getElementById('fscSaveCloud')?.addEventListener('click',async()=>{showBusy('Salvando versão oficial...');try{await sendSnapshot(false,true);closeOverlay();toast('✓ Versão oficial atualizada na nuvem')}catch(e){showError(e.message)}});
    document.getElementById('fscReload').onclick=()=>{if(!confirm('Carregar a versão oficial da nuvem? As alterações locais ainda não publicadas serão substituídas.'))return;showBusy('Carregando versão oficial...');loadOfficialState().catch(e=>showError(e.message))};document.getElementById('fscSwitchUser').onclick=()=>{rememberCurrentAccess();clearActiveAccess();showAccessChooser()};document.getElementById('fscAdminRecover')?.addEventListener('click',()=>{rememberCurrentAccess();clearActiveAccess();showAdminLogin('Entre com a senha do Administrador geral. O acesso atual ficará salvo neste aparelho.')});document.getElementById('fscLogout').onclick=logout;
  }

  async function showCreateInvite(){
    const current=`${profile.branchName||''}${profile.sector?' · '+profile.sector:''}`;
    overlayHtml(`<h2>Gerar novo acesso</h2><p>O convite será individual e poderá ser ativado somente uma vez.</p><div class="fsc-grid"><div><label>Nome da pessoa</label><input id="fscInvName"></div><div><label>WhatsApp / telefone</label><input id="fscInvPhone" inputmode="tel" placeholder="85999999999"></div></div><div class="fsc-grid"><div><label>Destino</label><select id="fscInvMode"><option value="same">Mesma filial — ${esc(current)}</option><option value="new">Outra filial / setor (cópia independente)</option></select></div><div><label>Perfil</label><select id="fscInvRole"><option value="viewer">Visualizador</option><option value="editor">Editor</option><option value="branch_admin">Administrador da filial</option></select></div></div><div id="fscNewBranch" style="display:none"><div class="fsc-grid"><div><label>Nova filial / unidade</label><input id="fscBranchName" placeholder="Ex.: Loja 03 - Iguatu"></div><div><label>Setor (opcional)</label><input id="fscSector" placeholder="Ex.: Vendas / CDZ / RH"></div></div><p class="fsc-note">A nova filial receberá uma cópia da escala atual como modelo. Depois disso, os dados ficam totalmente independentes.</p></div><label style="text-transform:none;font-size:13px;color:#dbeafe"><input type="checkbox" id="fscCanShare"> Esta pessoa poderá gerar novos acessos</label><div class="fsc-row"><button id="fscCreateInvite">Gerar acesso</button><button class="secondary" id="fscBack">Voltar</button></div>`);
    const mode=document.getElementById('fscInvMode');mode.onchange=()=>document.getElementById('fscNewBranch').style.display=mode.value==='new'?'block':'none';document.getElementById('fscBack').onclick=showManagerHome;
    document.getElementById('fscCreateInvite').onclick=async()=>{const params={action:'createInvite',...authParams(),name:document.getElementById('fscInvName').value.trim(),phone:document.getElementById('fscInvPhone').value.trim(),mode:mode.value,role:document.getElementById('fscInvRole').value,canShare:document.getElementById('fscCanShare').checked?'1':'0',branchName:document.getElementById('fscBranchName')?.value.trim()||'',sector:document.getElementById('fscSector')?.value.trim()||''};showBusy('Gerando acesso individual...');try{const r=await jsonp(params);if(!r?.ok)throw new Error(r?.message||'Falha ao gerar acesso.');showInviteResult(r)}catch(e){showError(e.message)}};
  }

  function baseShareUrl(invite){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('fsinvite',invite);return u.toString()}
  function normalizeWhatsPhone(phone){let d=String(phone||'').replace(/\D/g,'');if((d.length===10||d.length===11)&&!d.startsWith('55'))d='55'+d;return d}
  function inviteMessage(r,link){return `Olá, ${r.name}. Você recebeu acesso à plataforma Escala 5x2.\n\nDestino: ${r.branchName}${r.sector?' - '+r.sector:''}\nPerfil: ${roleLabel(r.role)}\n\nAbra o link abaixo e informe seu nome para ativar o acesso. O convite é individual e só funciona uma vez.\n\n${link}`}
  function showInviteResult(r){const link=baseShareUrl(r.invite),msg=inviteMessage(r,link),phone=normalizeWhatsPhone(r.phone);overlayHtml(`<h2>Acesso criado ✓</h2><p><b>${esc(r.name)}</b> · ${esc(roleLabel(r.role))}</p><p>${esc(r.branchName||'')}${r.sector?` · ${esc(r.sector)}`:''}</p><label>Link individual</label><input id="fscInviteLink" readonly value="${esc(link)}"><div class="fsc-row"><button id="fscWhats">Abrir WhatsApp</button><button class="secondary" id="fscCopy">Copiar link</button><button class="secondary" id="fscNew">Gerar outro acesso</button><button class="secondary" id="fscDone">Concluir</button></div><p class="fsc-note">Não encaminhe este mesmo link para outra pessoa. Para cada novo usuário, gere um novo acesso.</p>`);document.getElementById('fscCopy').onclick=()=>copyText(link);document.getElementById('fscWhats').onclick=()=>{const url=phone?`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`;window.open(url,'_blank','noopener')};document.getElementById('fscNew').onclick=showCreateInvite;document.getElementById('fscDone').onclick=closeOverlay}

  async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copiado.')}catch(_){prompt('Copie:',t)}}

  async function showDashboard(){showBusy('Carregando painel...');try{const d=await jsonp({action:'dashboard',...authParams()});if(!d?.ok)throw new Error(d?.message||'Sem acesso ao painel.');const branchMap=Object.fromEntries((d.branches||[]).map(b=>[b.id,b]));const activeMembers=(d.members||[]).filter(m=>m.active);const pendingInvites=(d.invites||[]).filter(i=>i.active&&!i.usedAt);const branches=(d.branches||[]).map(b=>`<div class="fsc-cardline"><b>${esc(b.name)}</b>${b.sector?` · ${esc(b.sector)}`:''}<span class="fsc-pill">v${b.version||0}</span><div class="fsc-mini">Última alteração: ${esc(formatDate(b.updatedAt))}${b.updatedBy?' · '+esc(b.updatedBy):''}</div></div>`).join('')||'<p class="fsc-note">Nenhuma filial.</p>';const members=activeMembers.map(m=>`<div class="fsc-cardline"><b>${esc(m.name)}</b> <span class="fsc-pill">${esc(roleLabel(m.role))}</span>${m.canShare?'<span class="fsc-pill">pode compartilhar</span>':''}<div class="fsc-mini">${esc(branchMap[m.branchId]?.name||m.branchId)} · criado por ${esc(m.createdBy||'-')} · último acesso ${esc(formatDate(m.lastAccess))}</div>${(isGlobalAdmin()||role()==='branch_admin')?`<div class="fsc-row"><button class="danger fscRevokeMember" data-id="${esc(m.id)}">Bloquear acesso</button></div>`:''}</div>`).join('')||'<p class="fsc-note">Nenhum usuário por convite ainda.</p>';const invites=pendingInvites.map(i=>`<div class="fsc-cardline"><b>${esc(i.name)}</b> <span class="fsc-pill">${esc(roleLabel(i.role))}</span><div class="fsc-mini">Pendente · criado por ${esc(i.createdBy||'-')} · expira ${esc(formatDate(i.expiresAt))}</div><div class="fsc-row"><button class="danger fscRevokeInvite" data-id="${esc(i.id)}">Cancelar convite</button></div></div>`).join('')||'<p class="fsc-note">Nenhum convite pendente.</p>';const recent=(d.recent||[]).slice(0,20).map(h=>`<div class="fsc-cardline"><b>${esc(h.user||'Sistema')}</b> · ${esc(h.event)} <span class="fsc-pill">${esc(h.result)}</span><div class="fsc-mini">${esc(formatDate(h.date))} · ${esc(h.message||'')}</div></div>`).join('')||'<p class="fsc-note">Sem histórico recente.</p>';overlayHtml(`<button class="fsc-closeX" id="fscCloseX" aria-label="Fechar">×</button><h2>Painel de acessos</h2><p>Visão administrativa organizada por ambiente, pessoas e atividade.</p><div class="fsc-kpis"><div class="fsc-kpi"><b>${(d.branches||[]).length}</b><span>Filiais</span></div><div class="fsc-kpi"><b>${activeMembers.length}</b><span>Usuários ativos</span></div><div class="fsc-kpi"><b>${pendingInvites.length}</b><span>Convites pendentes</span></div><div class="fsc-kpi"><b>${(d.recent||[]).length}</b><span>Atividades</span></div></div><section class="fsc-section"><h3>🏢 Filiais</h3>${branches}</section><section class="fsc-section"><h3>👥 Usuários ativos</h3>${members}</section><section class="fsc-section"><h3>✉️ Convites pendentes</h3>${invites}</section><section class="fsc-section"><h3>🕘 Atividade recente</h3>${recent}</section><div class="fsc-row"><button class="secondary" id="fscDashBack">Voltar ao menu</button></div>`,true);document.getElementById('fscCloseX').onclick=closeOverlay;document.getElementById('fscDashBack').onclick=showManagerHome;document.querySelectorAll('.fscRevokeInvite').forEach(b=>b.onclick=async()=>{if(!confirm('Cancelar este convite?'))return;showBusy('Cancelando...');await jsonp({action:'revokeInvite',...authParams(),inviteId:b.dataset.id});showDashboard()});document.querySelectorAll('.fscRevokeMember').forEach(b=>b.onclick=async()=>{if(!confirm('Bloquear este acesso? A pessoa não conseguirá mais abrir a plataforma neste acesso.'))return;showBusy('Bloqueando...');await jsonp({action:'revokeMember',...authParams(),memberId:b.dataset.id});showDashboard()})}catch(e){showError(e.message)}}

  async function showBranchSwitcher(){showBusy('Carregando filiais...');try{const d=await jsonp({action:'dashboard',...authParams()});if(!d?.ok)throw new Error(d?.message||'Falha.');const rows=(d.branches||[]).map(b=>`<button class="secondary fscBranchPick" data-id="${esc(b.id)}" style="width:100%;text-align:left;margin:5px 0">${esc(b.name)}${b.sector?' · '+esc(b.sector):''} — v${b.version||0}</button>`).join('');overlayHtml(`<h2>Trocar filial</h2><p>Como Administrador geral, você pode acompanhar qualquer filial sem misturar os dados.</p>${rows}<div class="fsc-row"><button class="secondary" id="fscBack">Voltar</button></div>`);document.getElementById('fscBack').onclick=showManagerHome;document.querySelectorAll('.fscBranchPick').forEach(b=>b.onclick=async()=>{showBusy('Trocando filial...');saveCurrentBranchCache();const r=await jsonp({action:'switchBranch',...authParams(),branchId:b.dataset.id});if(!r?.ok)return showError(r?.message||'Falha.');profile.branchId=r.branchId;profile.branchName=r.branchName;profile.sector=r.sector;localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));localStorage.setItem(BRANCH_KEY,r.branchId);if(restoreBranchCache(r.branchId)){closeOverlay();installHeaderControls();toast('Filial aberta com os dados locais deste aparelho.');setTimeout(()=>location.reload(),250)}else{clearOperationalLocal();cloudVersion=0;localStorage.setItem(VERSION_KEY,'0');closeOverlay();installHeaderControls();toast('Esta filial ainda não tem dados locais neste aparelho. Use ⋮ → Carregar da nuvem.');setTimeout(()=>location.reload(),250)}})}catch(e){showError(e.message)}}

  function showRenameBranch(){overlayHtml(`<h2>Identificação da filial</h2><p>Essa informação aparece no cabeçalho para deixar claro qual ambiente está aberto.</p><label>Filial / unidade</label><input id="fscRenameName" value="${esc(profile.branchName||'')}"><label>Setor (opcional)</label><input id="fscRenameSector" value="${esc(profile.sector||'')}"><div class="fsc-row"><button id="fscRenameSave">Salvar</button><button class="secondary" id="fscBack">Voltar</button></div>`);document.getElementById('fscBack').onclick=showManagerHome;document.getElementById('fscRenameSave').onclick=async()=>{showBusy('Salvando identificação...');const r=await jsonp({action:'renameBranch',...authParams(),name:document.getElementById('fscRenameName').value.trim(),sector:document.getElementById('fscRenameSector').value.trim()});if(!r?.ok)return showError(r?.message||'Falha.');profile.branchName=r.name;profile.sector=r.sector;closeOverlay();installHeaderControls();toast('Identificação da filial atualizada.')}}

  function formatDate(s){if(!s)return '—';try{return new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(_){return s}}

  function mutatingElement(el){if(!el||el.closest?.('#fsCloudOverlay,#fsCloudHeaderBox'))return false;if(el.matches?.('input,textarea,select,[contenteditable="true"]'))return true;const btn=el.closest?.('button,a,[role="button"]');if(!btn)return false;const text=((btn.textContent||'')+' '+(btn.getAttribute('title')||'')+' '+(btn.getAttribute('onclick')||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /(salvar|aplicar|editar|excluir|limpar|novo colaborador|novo |distribui|sugerir|programar|confirmar|concluir|corrigir|restaurar|importar|ajustar horario|abrir.*modal)/.test(text)||btn.classList.contains('editBtn')}
  function enforceViewerMode(){if(viewerGuardInstalled)return;viewerGuardInstalled=true;const style=document.createElement('style');style.id='fsCloudViewerCss';style.textContent=`html[data-fs-cloud-role="viewer"] .editBtn{display:none!important}`;document.head.appendChild(style);document.addEventListener('click',e=>{if(document.documentElement.dataset.fsCloudRole==='viewer'&&mutatingElement(e.target)){e.preventDefault();e.stopImmediatePropagation();toast('Modo Visualizador: somente consulta.')}},true);const lock=()=>{if(document.documentElement.dataset.fsCloudRole!=='viewer')return;document.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach(el=>{if(el.closest('#fsCloudOverlay,#fsCloudHeaderBox'))return;if(el.hasAttribute('contenteditable')){if(!el.hasAttribute('data-fs-viewer-contenteditable'))el.setAttribute('data-fs-viewer-contenteditable',el.getAttribute('contenteditable')||'true');el.setAttribute('contenteditable','false')}else if(!el.disabled){el.dataset.fsViewerDisabled='1';el.disabled=true}})};lock();let mt=0;new MutationObserver(()=>{clearTimeout(mt);mt=setTimeout(lock,60)}).observe(document.body,{subtree:true,childList:true})}

  function startWatchers(){
    // v709: sincronizacao totalmente manual. Nenhuma alteracao local dispara escrita ou leitura da nuvem.
    clearInterval(pollTimer);clearInterval(versionPollTimer);clearTimeout(saveTimer);
  }
  function queueSave(force){
    if(!force){toast('Alterações salvas localmente. Use o menu ⋮ para publicar na nuvem.');return}
    return sendSnapshot(false,true).catch(e=>{writeInFlight=false;toast('Falha ao salvar na nuvem: '+e.message);throw e})
  }
  async function sendSnapshot(initializing,force){if(writeInFlight)return;const current=stableSnapshot();if(!force&&!initializing&&current===lastSnapshot)return;writeInFlight=true;const requestId=uuid(),payload=buildSnapshot();postForm({action:'write',...authParams(),requestId,baseVersion:initializing?0:cloudVersion,payload});let result=null;for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,650));try{result=await jsonp({action:'writeStatus',...authParams(),requestId})}catch(_){continue}if(result?.done)break}writeInFlight=false;if(!result?.done)throw new Error('A gravação foi enviada, mas ainda não foi confirmada.');if(!result.ok){if(result.code==='CONFLICT'){overlayHtml(`<h2>Alteração não publicada</h2><p>Outra pessoa salvou esta filial antes. Sua versão não sobrescreveu a versão mais recente.</p><div class="fsc-row"><button id="fscReload">Carregar versão oficial</button><button class="secondary" id="fscClose">Fechar</button></div>`);document.getElementById('fscReload').onclick=()=>loadOfficialState().catch(e=>showError(e.message));document.getElementById('fscClose').onclick=closeOverlay;return}throw new Error(result.message||'Gravação recusada.')}cloudVersion=Number(result.version||cloudVersion+1);localStorage.setItem(VERSION_KEY,String(cloudVersion));localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());lastSnapshot=current;saveCurrentBranchCache();toast('✓ Filial salva na nuvem')}

  function logout(){
    const currentKey=profile?((profile.globalAdmin?'ADMIN':(profile.memberId||profile.name||'USER'))+'|'+(profile.branchId||'')):'';
    if(currentKey)writeSavedAccesses(savedAccesses().filter(x=>x.key!==currentKey));clearActiveAccess();showAccessChooser('O acesso atual foi removido deste aparelho. Escolha outro acesso salvo ou entre como administrador.');
  }

  async function boot(){
    try{
      if(!endpoint())return showEndpointSetup();
      const inv=inviteToken();
      if(inv&&!session())return showInviteClaim(inv);
      if(session()||token()){
        localStorage.removeItem(LOCAL_MODE_KEY);localStorage.setItem(FIRST_CHOICE_KEY,'cloud');
        // v709: se este aparelho ja conhece o perfil, abre imediatamente usando os dados locais.
        if(localBoot()){
          if(inv){const u=new URL(location.href);u.searchParams.delete('fsinvite');history.replaceState({},'',u.toString())}
          setTimeout(validateAccessInBackground,250);return;
        }
        // Primeiro acesso neste aparelho ainda precisa validar a credencial uma vez.
        showBusy('Validando acesso...');
        await authenticateResilient();
        if(inv){const u=new URL(location.href);u.searchParams.delete('fsinvite');history.replaceState({},'',u.toString())}
        finalizeBoot({version:cloudVersion});
        if(!snapshotHasOperationalData(buildSnapshot()))setTimeout(()=>toast('Este aparelho ainda não tem escala local. Use ⋮ → Carregar da nuvem.'),400);
        return;
      }
      if(localStorage.getItem(LOCAL_MODE_KEY)==='1')return enterLocalMode(false);
      if(!localStorage.getItem(FIRST_CHOICE_KEY))return showFirstChoice();
      if(localStorage.getItem(FIRST_CHOICE_KEY)==='local')return enterLocalMode(false);
      showAccessChooser();
    }catch(e){
      if(session()){localStorage.removeItem(SESSION_KEY);return showError(e?.message||'Acesso expirado.',false)}
      showError(e?.message||'Erro inesperado.');
    }
  }

  window.FSCloud={boot,reload:loadOfficialState,save:()=>queueSave(true),saveNow:async()=>{if(!canWrite())throw new Error('Este acesso é somente visualização.');await sendSnapshot(false,true);return {ok:true,version:cloudVersion};},logout,switchUser:()=>{rememberCurrentAccess();clearActiveAccess();showAccessChooser()},showManagerHome,showCreateInvite,showDashboard,getProfile:()=>profile,getVersion:()=>cloudVersion};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
