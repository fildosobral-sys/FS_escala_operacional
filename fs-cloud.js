/* FS Nuvem v702 - Google Sheets + Apps Script
 * Mantem a logica operacional existente intacta e sincroniza apenas o estado persistido.
 */
(function(){
  'use strict';

  const CFG = window.FS_CLOUD_CONFIG || {};
  const ENDPOINT_KEY = 'fs_cloud_endpoint';
  const TOKEN_KEY = 'fs_cloud_token';
  const PROFILE_KEY = 'fs_cloud_profile';
  const VERSION_KEY = 'fs_cloud_version';
  const LAST_SYNC_KEY = 'fs_cloud_last_sync';
  const DEVICE_KEY = 'fs_cloud_device_id';
  const APPLY_FLAG = 'fs_cloud_apply_reload';
  const CANONICAL_KEY = 'fs_escala_limpa_v381';
  const CLOUD_PREFIX = 'fs_cloud_';
  const LOCAL_ONLY = new Set([
    'fs_access_data_v1','fs_access_token','fs_access_verified_at','fs_access_verified_fingerprint',
    'fs_cargo','fs_genero','fs_nome','fs_nome_vendedor','fs_nome_vendedor_sessao','fs_pode_compartilhar',
    'fs_whatsapp','nomeVendedor','nomeVendedorLogado','vendedor_nome','colaboradorNome','nomeColaborador',
    'usuarioAutorizado','vendedorLogado','autorizado','dispositivoAutorizado','fsAuthGlobal','fs_device_id'
  ]);

  let profile = null;
  let cloudVersion = Number(localStorage.getItem(VERSION_KEY) || 0);
  let lastSnapshot = '';
  let saveTimer = null;
  let pollTimer = null;
  let writeInFlight = false;
  let applying = false;
  let bootComplete = false;

  function uuid(){
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'fs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
  }
  function deviceId(){
    let id = localStorage.getItem(DEVICE_KEY);
    if(!id){ id = uuid(); localStorage.setItem(DEVICE_KEY,id); }
    return id;
  }
  function endpoint(){
    return String(CFG.WEB_APP_URL || localStorage.getItem(ENDPOINT_KEY) || '').trim();
  }
  function setEndpoint(v){ localStorage.setItem(ENDPOINT_KEY, String(v||'').trim()); }
  function token(){ return localStorage.getItem(TOKEN_KEY) || ''; }
  function publicKey(){
    try{ return new URLSearchParams(location.search).get('fsview') || ''; }catch(_){ return ''; }
  }
  function isPublicLink(){ return !!publicKey(); }
  function authParams(){
    const pk=publicKey();
    return pk ? {publicKey:pk,deviceId:deviceId()} : {token:token(),deviceId:deviceId()};
  }
  function role(){ return profile && profile.role || ''; }
  function canWrite(){ return role()==='admin' || role()==='editor'; }
  function isViewer(){ return role()==='viewer'; }
  function esc(s){ return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }

  function platformStorage(){
    const out = {};
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k || k.startsWith(CLOUD_PREFIX) || LOCAL_ONLY.has(k)) continue;
      try{ out[k] = localStorage.getItem(k); }catch(_){ }
    }
    return out;
  }
  function buildSnapshot(){
    return JSON.stringify({
      schema: 1,
      app: 'FS Escala Operacional Inteligente',
      canonicalKey: CANONICAL_KEY,
      savedAt: new Date().toISOString(),
      storage: platformStorage()
    });
  }
  function stableSnapshot(){
    const data = platformStorage();
    // savedAt nao participa da comparacao para evitar falso positivo.
    return JSON.stringify(data);
  }
  function snapshotHasOperationalData(snapshot){
    try{
      const x = typeof snapshot==='string' ? JSON.parse(snapshot) : snapshot;
      const raw = x?.storage?.[CANONICAL_KEY];
      const state = raw ? JSON.parse(raw) : null;
      return !!(state && Array.isArray(state.pessoas));
    }catch(_){ return false; }
  }

  function overlayHtml(inner){
    let root = document.getElementById('fsCloudOverlay');
    if(!root){
      root = document.createElement('div');
      root.id='fsCloudOverlay';
      document.documentElement.appendChild(root);
    }
    root.innerHTML = `<style>
      #fsCloudOverlay{position:fixed;inset:0;z-index:2147483646;background:rgba(2,6,23,.94);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e7eb}
      #fsCloudOverlay .fsc-card{width:min(520px,100%);background:#0f172a;border:1px solid #334155;border-radius:18px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      #fsCloudOverlay h2{margin:0 0 8px;font-size:20px} #fsCloudOverlay p{margin:8px 0;line-height:1.45;color:#cbd5e1}
      #fsCloudOverlay label{display:block;margin-top:14px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
      #fsCloudOverlay input{width:100%;box-sizing:border-box;margin-top:6px;padding:12px 13px;border-radius:10px;border:1px solid #475569;background:#020617;color:#fff;font-size:15px}
      #fsCloudOverlay .fsc-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
      #fsCloudOverlay button{border:0;border-radius:10px;padding:11px 14px;font-weight:800;cursor:pointer;background:#2563eb;color:#fff}
      #fsCloudOverlay button.secondary{background:#334155} #fsCloudOverlay button.danger{background:#991b1b}
      #fsCloudOverlay .fsc-note{font-size:12px;color:#94a3b8;margin-top:12px}.fsc-error{color:#fecaca!important}.fsc-ok{color:#bbf7d0!important}
    </style><div class="fsc-card">${inner}</div>`;
    return root;
  }
  function closeOverlay(){ const x=document.getElementById('fsCloudOverlay'); if(x) x.remove(); }
  function showBusy(msg){ overlayHtml(`<h2>☁ FS Nuvem</h2><p>${esc(msg||'Sincronizando dados oficiais...')}</p>`); }
  function showError(msg, allowRetry=true){
    overlayHtml(`<h2>Não foi possível sincronizar</h2><p class="fsc-error">${esc(msg)}</p><p>Os dados locais não serão enviados nem substituídos enquanto a conexão não for validada.</p><div class="fsc-row">${allowRetry?'<button id="fscRetry">Tentar novamente</button>':''}<button class="secondary" id="fscLogout">Trocar acesso</button></div>`);
    document.getElementById('fscRetry')?.addEventListener('click', boot);
    document.getElementById('fscLogout')?.addEventListener('click', logout);
  }

  function jsonp(params){
    return new Promise((resolve,reject)=>{
      const base=endpoint();
      if(!base) return reject(new Error('URL do Apps Script ainda não configurada.'));
      const cb='__fsCloudCb_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const timer=setTimeout(()=>finish(new Error('Tempo de resposta excedido. Verifique a internet e a implantação do Apps Script.')), Number(CFG.REQUEST_TIMEOUT_MS||15000));
      function finish(err,data){ clearTimeout(timer); try{delete window[cb]}catch(_){window[cb]=undefined} script.remove(); err?reject(err):resolve(data); }
      window[cb]=data=>finish(null,data);
      const q=new URLSearchParams({...params,callback:cb,_:Date.now().toString()});
      script.onerror=()=>finish(new Error('Falha ao acessar o serviço da nuvem.'));
      script.src=base+(base.includes('?')?'&':'?')+q.toString();
      document.head.appendChild(script);
    });
  }

  function postForm(params){
    const base=endpoint();
    if(!base) throw new Error('URL do Apps Script não configurada.');
    let iframe=document.getElementById('fsCloudPostFrame');
    if(!iframe){ iframe=document.createElement('iframe'); iframe.id='fsCloudPostFrame'; iframe.name='fsCloudPostFrame'; iframe.style.display='none'; document.body.appendChild(iframe); }
    const form=document.createElement('form'); form.method='POST'; form.action=base; form.target='fsCloudPostFrame'; form.style.display='none';
    Object.entries(params).forEach(([k,v])=>{ const inp=document.createElement('input'); inp.type='hidden'; inp.name=k; inp.value=String(v??''); form.appendChild(inp); });
    document.body.appendChild(form); form.submit(); setTimeout(()=>form.remove(),1500);
  }

  function showEndpointSetup(){
    overlayHtml(`<h2>☁ Ativar FS Nuvem</h2><p>Esta versão está preparada para usar Google Sheets como fonte oficial. Cole abaixo a URL <b>/exec</b> do Web App do Google Apps Script.</p><label>URL do Web App</label><input id="fscEndpoint" placeholder="https://script.google.com/macros/s/.../exec"><div class="fsc-row"><button id="fscSaveEndpoint">Salvar e conectar</button></div><p class="fsc-note">Depois você pode fixar essa URL em <b>fs-cloud-config.js</b> para que novos aparelhos não precisem digitá-la.</p>`);
    document.getElementById('fscSaveEndpoint').onclick=()=>{ const v=document.getElementById('fscEndpoint').value.trim(); if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(v)) return alert('Cole a URL /exec gerada na implantação do Apps Script.'); setEndpoint(v); boot(); };
  }

  function showLogin(message){
    overlayHtml(`<h2>☁ FS Escala — acesso à nuvem</h2><p>${esc(message||'Informe o código de acesso fornecido pelo administrador.')}</p><label>Código de acesso</label><input id="fscToken" autocomplete="off" spellcheck="false"><div class="fsc-row"><button id="fscLogin">Entrar</button></div><p class="fsc-note">Administrador e Editor usam código de acesso. Links de consulta entram diretamente em modo somente visualização.</p>`);
    const go=async()=>{ const t=document.getElementById('fscToken').value.trim(); if(!t)return; localStorage.setItem(TOKEN_KEY,t); showBusy('Validando acesso...'); try{ await authenticate(); await loadOfficialState(); }catch(e){ localStorage.removeItem(TOKEN_KEY); showLogin(e.message||'Código inválido.'); } };
    document.getElementById('fscLogin').onclick=go;
    document.getElementById('fscToken').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
  }

  async function authenticate(){
    if(!isPublicLink() && !token()) throw new Error('Informe seu código de acesso.');
    const res=await jsonp({action:'auth',...authParams()});
    if(!res || !res.ok) throw new Error(res?.message||'Acesso não autorizado.');
    profile={name:res.name||'',role:res.role||'viewer',publicAccess:!!res.publicAccess};
    localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
    return res;
  }

  function applySnapshot(payload, version){
    const data=typeof payload==='string'?JSON.parse(payload):payload;
    if(!data || typeof data.storage!=='object') throw new Error('Estado da nuvem inválido.');
    applying=true;
    const preserve={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(k&&(k.startsWith(CLOUD_PREFIX)||LOCAL_ONLY.has(k))) preserve[k]=localStorage.getItem(k);
    }
    // Remove somente dados sincronizaveis; mantem identidade local e credencial da nuvem.
    const toRemove=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i); if(k&&!k.startsWith(CLOUD_PREFIX)&&!LOCAL_ONLY.has(k)) toRemove.push(k);
    }
    toRemove.forEach(k=>localStorage.removeItem(k));
    Object.entries(data.storage).forEach(([k,v])=>{ if(v!==null&&v!==undefined) localStorage.setItem(k,String(v)); });
    Object.entries(preserve).forEach(([k,v])=>{ if(v!==null) localStorage.setItem(k,v); });
    localStorage.setItem(VERSION_KEY,String(version||0));
    localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
    sessionStorage.setItem(APPLY_FLAG,'1');
    applying=false;
    location.reload();
  }

  async function loadOfficialState(trustLocalOnce){
    showBusy('Carregando a versão oficial da escala...');
    const res=await jsonp({action:'read',...authParams()});
    if(!res?.ok) throw new Error(res?.message||'Não foi possível ler os dados da nuvem.');
    if(res.empty){
      cloudVersion=0;
      if(role()==='admin') return showInitialize();
      throw new Error('A nuvem ainda não foi inicializada. Peça ao administrador para publicar a escala oficial primeiro.');
    }
    cloudVersion=Number(res.version||0);
    localStorage.setItem(VERSION_KEY,String(cloudVersion));
    localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
    const current=stableSnapshot();
    if(trustLocalOnce){
      lastSnapshot=current;
      finalizeBoot(res);
      return;
    }
    let incomingStable='';
    try{ incomingStable=JSON.stringify(JSON.parse(res.payload).storage||{}); }catch(_){ }
    if(current!==incomingStable){ applySnapshot(res.payload,cloudVersion); return; }
    lastSnapshot=current;
    finalizeBoot(res);
  }

  function showInitialize(){
    const valid=snapshotHasOperationalData(buildSnapshot());
    overlayHtml(`<h2>Inicializar nuvem</h2><p>A planilha ainda não possui uma escala oficial.</p><p>${valid?'Este aparelho possui dados operacionais válidos e pode publicá-los como a primeira versão oficial.':'Este aparelho não possui uma escala operacional válida para publicar.'}</p><div class="fsc-row">${valid?'<button id="fscInit">Publicar este aparelho como versão oficial</button>':''}<button class="secondary" id="fscLogout">Trocar acesso</button></div><p class="fsc-note">Faça a primeira publicação no computador que contém a configuração correta que você deseja preservar.</p>`);
    document.getElementById('fscLogout').onclick=logout;
    if(valid) document.getElementById('fscInit').onclick=async()=>{ showBusy('Publicando a primeira versão oficial...'); try{ await sendSnapshot(true); setTimeout(()=>loadOfficialState().catch(e=>showError(e.message)),1000); }catch(e){showError(e.message)} };
  }

  function finalizeBoot(res){
    closeOverlay();
    bootComplete=true;
    document.documentElement.dataset.fsCloudRole=role();
    if(isViewer()) enforceViewerMode();
    if(role()==='admin') installAdminMenu();
    startWatchers();
    window.dispatchEvent(new CustomEvent('fscloudready',{detail:{profile,version:cloudVersion}}));
  }

  function installAdminMenu(){
    if(document.getElementById('fsCloudAdminMenu')) return;
    const host=document.querySelector('header.top') || document.querySelector('.top') || document.body;
    if(host!==document.body && getComputedStyle(host).position==='static') host.style.position='relative';
    const b=document.createElement('button');
    b.id='fsCloudAdminMenu'; b.type='button'; b.title='Gerenciar FS Nuvem'; b.setAttribute('aria-label','Gerenciar FS Nuvem');
    b.textContent='⋮';
    b.style.cssText='position:absolute;right:12px;top:10px;z-index:2147483000;width:34px;height:34px;border:1px solid rgba(7,29,104,.16);background:rgba(255,255,255,.88);color:#071d68;border-radius:11px;font:900 22px/30px system-ui;box-shadow:0 5px 16px rgba(7,29,104,.10);cursor:pointer;padding:0;text-align:center';
    b.onclick=showPanel;
    host.appendChild(b);
  }
  function updateBadge(){ /* mantido por compatibilidade; v702 usa menu discreto no cabeçalho */ }

  function showPanel(){
    const last=localStorage.getItem(LAST_SYNC_KEY); const when=last?new Date(last).toLocaleString('pt-BR'):'—';
    overlayHtml(`<h2>☁ FS Nuvem</h2><p><b>${esc(profile?.name||'Usuário')}</b> · Administrador</p><p>Versão oficial: <b>${cloudVersion}</b><br>Última sincronização: <b>${esc(when)}</b></p><div class="fsc-row"><button id="fscAccess">Gerenciar acessos</button><button class="secondary" id="fscReload">Carregar versão oficial</button><button class="secondary" id="fscPush">Salvar agora na nuvem</button><button class="secondary" id="fscClose">Fechar</button><button class="danger" id="fscLogout">Sair deste aparelho</button></div>`);
    document.getElementById('fscClose').onclick=closeOverlay;
    document.getElementById('fscLogout').onclick=logout;
    document.getElementById('fscReload').onclick=()=>loadOfficialState().catch(e=>showError(e.message));
    document.getElementById('fscPush').onclick=()=>{closeOverlay(); queueSave(true)};
    document.getElementById('fscAccess').onclick=showAccessManager;
  }

  async function adminAction(action){
    const res=await jsonp({action,token:token(),deviceId:deviceId()});
    if(!res?.ok) throw new Error(res?.message||'Não foi possível concluir a operação.');
    return res;
  }
  function publicShareUrl(key){
    const u=new URL(location.href);
    u.search=''; u.hash='';
    u.searchParams.set('fsview',key);
    return u.toString();
  }
  async function copyText(text){
    try{ await navigator.clipboard.writeText(text); toast('✓ Link copiado'); return true; }catch(_){
      const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
      try{document.execCommand('copy'); toast('✓ Link copiado');}finally{ta.remove();}
      return true;
    }
  }
  async function showAccessManager(){
    showBusy('Carregando controles de acesso...');
    try{
      const st=await adminAction('adminAccessStatus');
      const link=st.publicActive&&st.publicKey?publicShareUrl(st.publicKey):'';
      overlayHtml(`<h2>Gerenciar acessos</h2>
        <p><b>Administrador:</b> acesso total à plataforma, sincronização e controles.</p>
        <p><b>Editor / Operador:</b> pode alterar e salvar a escala.</p>
        <p><b>Consulta:</b> link direto, sem usuário e sem senha, sempre em modo somente visualização.</p>
        <label>Link de consulta</label>
        ${link?`<input id="fscPublicLink" readonly value="${esc(link)}">`:'<p class="fsc-note">Nenhum link público de consulta está ativo.</p>'}
        <div class="fsc-row">
          ${link?'<button id="fscCopyPublic">Copiar link</button><button class="secondary" id="fscRotatePublic">Gerar novo link</button><button class="danger" id="fscDisablePublic">Desativar link</button>':'<button id="fscGeneratePublic">Gerar link de consulta</button>'}
          <button class="secondary" id="fscRotateEditor">Gerar novo código de Editor</button>
          <button class="secondary" id="fscRotateAdmin">Trocar meu código de Administrador</button>
          <button class="secondary" id="fscBack">Voltar</button>
        </div>
        <p class="fsc-note">Ao gerar um novo link, o anterior deixa de funcionar. Ao trocar um código, o código anterior daquele perfil é desativado.</p>`);
      document.getElementById('fscBack').onclick=showPanel;
      document.getElementById('fscCopyPublic')?.addEventListener('click',()=>copyText(link));
      document.getElementById('fscGeneratePublic')?.addEventListener('click',async()=>{showBusy('Gerando link de consulta...');try{await adminAction('adminGeneratePublic');showAccessManager();}catch(e){showError(e.message)}});
      document.getElementById('fscRotatePublic')?.addEventListener('click',async()=>{if(!confirm('Gerar um novo link? O link de consulta atual deixará de funcionar.'))return;showBusy('Gerando novo link...');try{await adminAction('adminRotatePublic');showAccessManager();}catch(e){showError(e.message)}});
      document.getElementById('fscDisablePublic')?.addEventListener('click',async()=>{if(!confirm('Desativar o link de consulta atual?'))return;showBusy('Desativando link...');try{await adminAction('adminDisablePublic');showAccessManager();}catch(e){showError(e.message)}});
      document.getElementById('fscRotateEditor')?.addEventListener('click',async()=>{if(!confirm('Gerar um novo código de Editor? O código anterior será desativado.'))return;showBusy('Gerando código...');try{const r=await adminAction('adminRotateEditor');showOneTimeCode('Novo código de Editor',r.code,false);}catch(e){showError(e.message)}});
      document.getElementById('fscRotateAdmin')?.addEventListener('click',async()=>{if(!confirm('Trocar seu código de Administrador? O código atual será desativado.'))return;showBusy('Gerando novo código...');try{const r=await adminAction('adminRotateAdmin');localStorage.setItem(TOKEN_KEY,r.code);showOneTimeCode('Novo código de Administrador',r.code,true);}catch(e){showError(e.message)}});
    }catch(e){ showError(e.message); }
  }
  function showOneTimeCode(title,code,isAdmin){
    overlayHtml(`<h2>${esc(title)}</h2><p>Copie e guarde este código agora.</p><input id="fscOneCode" readonly value="${esc(code||'')}"><div class="fsc-row"><button id="fscCopyCode">Copiar código</button><button class="secondary" id="fscAccessBack">Voltar aos acessos</button></div><p class="fsc-note">${isAdmin?'Este aparelho já passou a usar o novo código de Administrador.':'Envie este código somente à pessoa que poderá editar a escala.'}</p>`);
    document.getElementById('fscCopyCode').onclick=()=>copyText(code||'');
    document.getElementById('fscAccessBack').onclick=showAccessManager;
  }

  function mutatingElement(el){
    if(!el || el.closest?.('#fsCloudOverlay,#fsCloudAdminMenu')) return false;
    if(el.matches?.('input,textarea,select,[contenteditable="true"]')) return true;
    const btn=el.closest?.('button,a,[role="button"]'); if(!btn) return false;
    const text=((btn.textContent||'')+' '+(btn.getAttribute('title')||'')+' '+(btn.getAttribute('onclick')||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /(salvar|aplicar|editar|excluir|limpar|novo colaborador|novo |distribui|sugerir|programar|confirmar|concluir|corrigir|restaurar|importar|ajustar horario|onclick="?editar|abrir.*modal)/.test(text) || btn.classList.contains('editBtn');
  }
  function enforceViewerMode(){
    const style=document.createElement('style'); style.id='fsCloudViewerCss'; style.textContent=`html[data-fs-cloud-role="viewer"] .editBtn{display:none!important} html[data-fs-cloud-role="viewer"] input:not(#fscToken):not(#fscEndpoint),html[data-fs-cloud-role="viewer"] textarea,html[data-fs-cloud-role="viewer"] select{pointer-events:none!important;opacity:.82}`; document.head.appendChild(style);
    document.addEventListener('click',e=>{ if(mutatingElement(e.target)){e.preventDefault();e.stopImmediatePropagation(); toast('Acesso de Consultor: somente visualização.');}},true);
    document.addEventListener('input',e=>{ if(mutatingElement(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
    const lock=()=>document.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach(el=>{if(!el.closest('#fsCloudOverlay')){ if(el.hasAttribute('contenteditable'))el.setAttribute('contenteditable','false'); else el.disabled=true; }});
    lock(); let t=0; new MutationObserver(()=>{clearTimeout(t);t=setTimeout(lock,50)}).observe(document.body,{subtree:true,childList:true});
  }
  function toast(msg){
    let t=document.getElementById('fsCloudToast'); if(!t){t=document.createElement('div');t.id='fsCloudToast';t.style.cssText='position:fixed;left:50%;bottom:62px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font:700 12px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35)';document.body.appendChild(t);} t.textContent=msg; t.hidden=false; clearTimeout(t._x); t._x=setTimeout(()=>t.hidden=true,2600);
  }

  function startWatchers(){
    clearInterval(pollTimer);
    if(canWrite()){
      pollTimer=setInterval(()=>{
        if(applying||writeInFlight||!bootComplete) return;
        const now=stableSnapshot();
        if(now!==lastSnapshot) queueSave(false);
      }, Number(CFG.SYNC_INTERVAL_MS||2500));
    }
    // Mesmo para consultor, verifica se existe versao nova sem alterar a tela no meio de uma leitura.
    setInterval(async()=>{
      if(!bootComplete||writeInFlight) return;
      try{
        const s=await jsonp({action:'status',...authParams()});
        if(s?.ok && Number(s.version||0)>cloudVersion){
          const msg='Existe uma nova versão oficial da escala na nuvem.';
          if(isViewer()) { toast(msg+' Atualizando...'); setTimeout(()=>loadOfficialState().catch(()=>{}),500); }
          else toast(msg+' Clique no indicador ☁ para carregar.');
        }
      }catch(_){ }
    }, 30000);
  }

  function queueSave(force){
    if(!canWrite()||applying) return;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>sendSnapshot(false,force).catch(e=>{writeInFlight=false;toast('Falha ao sincronizar: '+e.message)}), force?50:Number(CFG.WRITE_DEBOUNCE_MS||1400));
  }
  async function sendSnapshot(initializing, force){
    if(writeInFlight) return;
    const current=stableSnapshot();
    if(!force && !initializing && current===lastSnapshot) return;
    writeInFlight=true;
    const requestId=uuid();
    const payload=buildSnapshot();
    postForm({action:'write',token:token(),deviceId:deviceId(),requestId,baseVersion:initializing?0:cloudVersion,payload});
    let result=null;
    for(let i=0;i<10;i++){
      await new Promise(r=>setTimeout(r,650));
      try{ result=await jsonp({action:'writeStatus',token:token(),requestId,deviceId:deviceId()}); }catch(_){ continue; }
      if(result?.done) break;
    }
    writeInFlight=false;
    if(!result?.done) throw new Error('A gravação foi enviada, mas ainda não foi possível confirmar.');
    if(!result.ok){
      if(result.code==='CONFLICT'){
        toast('Conflito: outra pessoa salvou uma versão mais recente.');
        overlayHtml(`<h2>Alteração não publicada</h2><p>Outra pessoa salvou a escala antes desta gravação. Para proteger os dados, sua versão <b>não sobrescreveu</b> a versão oficial.</p><div class="fsc-row"><button id="fscReload">Carregar versão oficial</button><button class="secondary" id="fscClose">Fechar</button></div>`);
        document.getElementById('fscReload').onclick=()=>loadOfficialState().catch(e=>showError(e.message)); document.getElementById('fscClose').onclick=closeOverlay;
        return;
      }
      throw new Error(result.message||'Gravação recusada pela nuvem.');
    }
    cloudVersion=Number(result.version||cloudVersion+1);
    localStorage.setItem(VERSION_KEY,String(cloudVersion)); localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());
    lastSnapshot=current; updateBadge(); toast('✓ Versão oficial salva na nuvem');
  }

  function logout(){
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(VERSION_KEY); profile=null; cloudVersion=0; bootComplete=false;
    if(isPublicLink()){ const u=new URL(location.href); u.searchParams.delete('fsview'); location.href=u.toString(); return; }
    showLogin('Informe outro código de acesso.');
  }

  async function boot(){
    try{
      if(!endpoint()) return showEndpointSetup();
      showBusy(isPublicLink()?'Abrindo consulta da escala...':'Conectando à fonte oficial...');
      if(!isPublicLink() && !token()) return showLogin();
      await authenticate();
      const applied=sessionStorage.getItem(APPLY_FLAG)==='1'; if(applied) sessionStorage.removeItem(APPLY_FLAG);
      await loadOfficialState(applied);
    }catch(e){
      if(isPublicLink()) return showError(e?.message||'Este link de consulta não está disponível.',false);
      showError(e?.message||'Erro inesperado.');
    }
  }

  window.FSCloud={boot,reload:loadOfficialState,save:()=>queueSave(true),logout,showAccessManager,getProfile:()=>profile,getVersion:()=>cloudVersion};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
