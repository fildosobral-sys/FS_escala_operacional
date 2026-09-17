/* FS Nuvem v704 - multi-filial, convites individuais e rastreabilidade */
(function(){
  'use strict';

  const CFG=window.FS_CLOUD_CONFIG||{};
  const ENDPOINT_KEY='fs_cloud_endpoint';
  const TOKEN_KEY='fs_cloud_token';
  const SESSION_KEY='fs_cloud_session_v703';
  const PROFILE_KEY='fs_cloud_profile';
  const BRANCH_KEY='fs_cloud_branch_v703';
  const VERSION_KEY='fs_cloud_version';
  const LAST_SYNC_KEY='fs_cloud_last_sync';
  const DEVICE_KEY='fs_cloud_device_id';
  const APPLY_FLAG='fs_cloud_apply_reload';
  const CANONICAL_KEY='fs_escala_limpa_v381';
  const CLOUD_PREFIX='fs_cloud_';
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
      #fsCloudOverlay .fsc-card{width:min(${wide?'920':'560'}px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid #334155;border-radius:18px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      #fsCloudOverlay h2{margin:0 0 8px;font-size:20px}#fsCloudOverlay h3{font-size:14px;margin:20px 0 8px;color:#dbeafe}#fsCloudOverlay p{margin:8px 0;line-height:1.45;color:#cbd5e1}
      #fsCloudOverlay label{display:block;margin-top:12px;font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
      #fsCloudOverlay input,#fsCloudOverlay select{width:100%;box-sizing:border-box;margin-top:5px;padding:11px 12px;border-radius:10px;border:1px solid #475569;background:#020617;color:#fff;font-size:14px}
      #fsCloudOverlay input[type=checkbox]{width:auto;margin:0 7px 0 0;vertical-align:middle}
      #fsCloudOverlay .fsc-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px}#fsCloudOverlay .fsc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#fsCloudOverlay .fsc-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      #fsCloudOverlay button{border:0;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer;background:#2563eb;color:#fff}#fsCloudOverlay button.secondary{background:#334155}#fsCloudOverlay button.danger{background:#991b1b}#fsCloudOverlay button.good{background:#166534}
      #fsCloudOverlay .fsc-note{font-size:12px;color:#94a3b8;margin-top:10px}.fsc-error{color:#fecaca!important}.fsc-ok{color:#bbf7d0!important}.fsc-cardline{padding:11px;border:1px solid #334155;border-radius:12px;margin:8px 0;background:#111827}.fsc-cardline b{color:#fff}.fsc-mini{font-size:11px;color:#94a3b8}.fsc-pill{display:inline-block;padding:3px 7px;border-radius:999px;background:#1e293b;font-size:10px;font-weight:800;margin-left:5px}.fsc-sep{height:1px;background:#334155;margin:16px 0}
      @media(max-width:680px){#fsCloudOverlay .fsc-grid,#fsCloudOverlay .fsc-grid3{grid-template-columns:1fr}#fsCloudOverlay .fsc-card{padding:16px}}
    </style><div class="fsc-card">${inner}</div>`;return root;
  }
  function closeOverlay(){document.getElementById('fsCloudOverlay')?.remove()}
  function showBusy(msg){overlayHtml(`<h2>☁ FS Nuvem</h2><p>${esc(msg||'Sincronizando...')}</p>`)}
  function showError(msg,retry=true){overlayHtml(`<h2>Não foi possível concluir</h2><p class="fsc-error">${esc(msg)}</p><div class="fsc-row">${retry?'<button id="fscRetry">Tentar novamente</button>':''}<button class="secondary" id="fscLogout">Trocar acesso</button></div>`);document.getElementById('fscRetry')?.addEventListener('click',boot);document.getElementById('fscLogout')?.addEventListener('click',logout)}
  function toast(msg){let t=document.getElementById('fsCloudToast');if(!t){t=document.createElement('div');t.id='fsCloudToast';t.style.cssText='position:fixed;left:50%;bottom:62px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font:700 12px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:90vw;text-align:center';document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(t._x);t._x=setTimeout(()=>t.hidden=true,2800)}

  function jsonp(params){return new Promise((resolve,reject)=>{const base=endpoint();if(!base)return reject(new Error('URL do Apps Script ainda não configurada.'));const cb='__fsCloudCb_'+Math.random().toString(36).slice(2),script=document.createElement('script');const timer=setTimeout(()=>finish(new Error('Tempo de resposta excedido.')),Number(CFG.REQUEST_TIMEOUT_MS||18000));function finish(err,data){clearTimeout(timer);try{delete window[cb]}catch(_){window[cb]=undefined}script.remove();err?reject(err):resolve(data)}window[cb]=data=>finish(null,data);const q=new URLSearchParams({...params,callback:cb,_:Date.now().toString()});script.onerror=()=>finish(new Error('Falha ao acessar o serviço da nuvem.'));script.src=base+(base.includes('?')?'&':'?')+q.toString();document.head.appendChild(script)})}
  function postForm(params){const base=endpoint();if(!base)throw new Error('URL do Apps Script não configurada.');let iframe=document.getElementById('fsCloudPostFrame');if(!iframe){iframe=document.createElement('iframe');iframe.id='fsCloudPostFrame';iframe.name='fsCloudPostFrame';iframe.style.display='none';document.body.appendChild(iframe)}const form=document.createElement('form');form.method='POST';form.action=base;form.target='fsCloudPostFrame';form.style.display='none';Object.entries(params).forEach(([k,v])=>{const inp=document.createElement('input');inp.type='hidden';inp.name=k;inp.value=String(v??'');form.appendChild(inp)});document.body.appendChild(form);form.submit();setTimeout(()=>form.remove(),1500)}

  function showEndpointSetup(){overlayHtml(`<h2>☁ Ativar FS Nuvem</h2><p>Cole a URL <b>/exec</b> do Web App do Google Apps Script.</p><label>URL do Web App</label><input id="fscEndpoint"><div class="fsc-row"><button id="fscSaveEndpoint">Salvar e conectar</button></div>`);document.getElementById('fscSaveEndpoint').onclick=()=>{const v=document.getElementById('fscEndpoint').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(v))return alert('Cole a URL /exec do Apps Script.');setEndpoint(v);boot()}}

  function showAdminLogin(message){overlayHtml(`<h2>FS Escala 5x2</h2><p>${esc(message||'Acesso administrativo.')}</p><label>Senha do Administrador</label><input id="fscToken" type="password" autocomplete="current-password"><div class="fsc-row"><button id="fscLogin">Entrar</button></div><p class="fsc-note">Os demais usuários entram por convites individuais gerados dentro da plataforma.</p>`);const go=async()=>{const t=document.getElementById('fscToken').value.trim();if(!t)return;localStorage.setItem(TOKEN_KEY,t);localStorage.removeItem(SESSION_KEY);showBusy('Validando acesso...');try{await authenticate();await loadOfficialState()}catch(e){localStorage.removeItem(TOKEN_KEY);showAdminLogin(e.message||'Senha inválida.')}};document.getElementById('fscLogin').onclick=go;document.getElementById('fscToken').onkeydown=e=>{if(e.key==='Enter')go()}}

  async function showInviteClaim(raw){
    showBusy('Validando convite...');
    try{
      const info=await jsonp({action:'inviteInfo',invite:raw,deviceId:deviceId()});if(!info?.ok)throw new Error(info?.message||'Convite inválido.');
      overlayHtml(`<h2>Você recebeu acesso à Escala 5x2</h2><p>Destino: <b>${esc(info.branchName||'')}</b>${info.sector?` · ${esc(info.sector)}`:''}</p><p>Perfil: <b>${esc(roleLabel(info.role))}</b>${info.canShare?' · poderá compartilhar novos acessos':''}</p><label>Informe seu nome</label><input id="fscClaimName" placeholder="Nome da pessoa convidada" autocomplete="name"><div class="fsc-row"><button id="fscClaim">Ativar meu acesso</button></div><p class="fsc-note">Este convite é individual. O nome precisa corresponder à pessoa para quem o acesso foi criado e o link só pode ser ativado uma vez.</p>`);
      const claim=async()=>{const name=document.getElementById('fscClaimName').value.trim();if(!name)return;showBusy('Ativando seu acesso...');const res=await jsonp({action:'claimInvite',invite:raw,name,deviceId:deviceId()});if(!res?.ok)return showInviteClaimError(raw,res?.message||'Não foi possível ativar.');localStorage.setItem(SESSION_KEY,res.session);localStorage.removeItem(TOKEN_KEY);localStorage.setItem(BRANCH_KEY,res.branchId);const u=new URL(location.href);u.searchParams.delete('fsinvite');history.replaceState({},'',u.toString());await authenticate();await loadOfficialState()};
      document.getElementById('fscClaim').onclick=claim;document.getElementById('fscClaimName').onkeydown=e=>{if(e.key==='Enter')claim()};
    }catch(e){showInviteClaimError(raw,e.message)}
  }
  function showInviteClaimError(raw,msg){overlayHtml(`<h2>Convite não ativado</h2><p class="fsc-error">${esc(msg)}</p><div class="fsc-row"><button id="fscInviteRetry">Tentar novamente</button></div>`);document.getElementById('fscInviteRetry').onclick=()=>showInviteClaim(raw)}

  async function authenticate(){
    const res=await jsonp({action:'auth',...authParams()});if(!res?.ok)throw new Error(res?.message||'Acesso não autorizado.');
    profile={name:res.name||'',role:res.role||'viewer',globalAdmin:!!res.globalAdmin,canShare:!!res.canShare,memberId:res.memberId||'',branchId:res.branchId||'',branchName:res.branchName||'',sector:res.sector||''};
    localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));localStorage.setItem(BRANCH_KEY,profile.branchId);cloudVersion=Number(res.version||0);return res;
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
    const current=stableSnapshot();applySnapshot(res.payload,res.version);
    // Recarrega uma unica vez para que toda a aplicacao leia o snapshot da filial.
    if(!cameFromReload && current!==stableSnapshot()){location.reload();return}
    // Se applySnapshot marcou reload mas nao foi necessario, remova a marca.
    sessionStorage.removeItem(APPLY_FLAG);
    finalizeBoot(res);
  }

  function showInitialize(){overlayHtml(`<h2>Inicializar filial</h2><p>Esta filial ainda não possui uma versão oficial. Este aparelho tem dados válidos que podem ser publicados como a primeira versão.</p><div class="fsc-row"><button id="fscInit">Publicar como versão oficial</button><button class="secondary" id="fscLogout">Sair</button></div>`);document.getElementById('fscInit').onclick=async()=>{showBusy('Publicando primeira versão...');await sendSnapshot(true,true);location.reload()};document.getElementById('fscLogout').onclick=logout}

  function finalizeBoot(res){closeOverlay();bootComplete=true;cloudVersion=Number(res.version||cloudVersion);lastSnapshot=stableSnapshot();document.documentElement.dataset.fsCloudRole=canWrite()?'editor':'viewer';installHeaderControls();if(!canWrite())enforceViewerMode();startWatchers();window.dispatchEvent(new CustomEvent('fscloudready',{detail:{profile,version:cloudVersion}}))}

  function installHeaderControls(){
    document.getElementById('fsCloudHeaderBox')?.remove();
    const host=document.querySelector('header.top')||document.querySelector('.top')||document.body;
    const box=document.createElement('div');box.id='fsCloudHeaderBox';box.style.cssText='display:flex;align-items:center;gap:7px;margin-left:auto;padding:0 6px;z-index:50;font-family:Inter,system-ui,sans-serif';
    const branch=`${profile?.branchName||'Filial'}${profile?.sector?' · '+profile.sector:''}`;
    box.innerHTML=`<span id="fsCloudBranchChip" title="Filial atual" style="font-size:10px;font-weight:800;padding:5px 8px;border-radius:999px;background:#e2e8f0;color:#0f172a;white-space:nowrap;max-width:210px;overflow:hidden;text-overflow:ellipsis">${esc(branch)}</span><span title="Modo de acesso" style="font-size:10px;font-weight:800;padding:5px 8px;border-radius:999px;background:${canWrite()?'#dcfce7':'#f1f5f9'};color:${canWrite()?'#166534':'#475569'}">${esc(roleLabel(role()))}</span>${(canShare()||isGlobalAdmin())?'<button id="fsCloudDots" title="Gerenciar acessos" style="border:0;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;padding:2px 7px">⋮</button>':''}`;
    host.appendChild(box);document.getElementById('fsCloudDots')?.addEventListener('click',showManagerHome);
  }

  function showManagerHome(){
    overlayHtml(`<h2>☁ FS Nuvem</h2><p><b>${esc(profile?.name||'Usuário')}</b> · ${esc(roleLabel(role()))}</p><p>Filial atual: <b>${esc(profile?.branchName||'')}</b>${profile?.sector?` · ${esc(profile.sector)}`:''}<br>Versão oficial: <b>${cloudVersion}</b></p><div class="fsc-row"><button id="fscShare">Gerar novo acesso</button><button class="secondary" id="fscDash">Painel de acessos</button>${(isGlobalAdmin()||role()==='branch_admin')?'<button class="secondary" id="fscRename">Identificação da filial</button>':''}${isGlobalAdmin()?'<button class="secondary" id="fscBranches">Trocar filial</button>':''}<button class="secondary" id="fscReload">Recarregar nuvem</button><button class="secondary" id="fscClose">Fechar</button><button class="danger" id="fscLogout">Sair deste aparelho</button></div>`,true);
    document.getElementById('fscShare').onclick=showCreateInvite;document.getElementById('fscDash').onclick=showDashboard;document.getElementById('fscRename')?.addEventListener('click',showRenameBranch);document.getElementById('fscBranches')?.addEventListener('click',showBranchSwitcher);document.getElementById('fscReload').onclick=()=>{showBusy('Carregando versão oficial...');loadOfficialState().catch(e=>showError(e.message))};document.getElementById('fscClose').onclick=closeOverlay;document.getElementById('fscLogout').onclick=logout;
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

  async function showDashboard(){showBusy('Carregando painel...');try{const d=await jsonp({action:'dashboard',...authParams()});if(!d?.ok)throw new Error(d?.message||'Sem acesso ao painel.');const branchMap=Object.fromEntries((d.branches||[]).map(b=>[b.id,b]));const branches=(d.branches||[]).map(b=>`<div class="fsc-cardline"><b>${esc(b.name)}</b>${b.sector?` · ${esc(b.sector)}`:''}<span class="fsc-pill">v${b.version||0}</span><div class="fsc-mini">Última alteração: ${esc(formatDate(b.updatedAt))}${b.updatedBy?' · '+esc(b.updatedBy):''}</div></div>`).join('')||'<p class="fsc-note">Nenhuma filial.</p>';const members=(d.members||[]).map(m=>`<div class="fsc-cardline"><b>${esc(m.name)}</b> <span class="fsc-pill">${esc(roleLabel(m.role))}</span>${m.canShare?'<span class="fsc-pill">compartilha</span>':''}<div class="fsc-mini">${esc(branchMap[m.branchId]?.name||m.branchId)} · criado por ${esc(m.createdBy||'-')} · último acesso ${esc(formatDate(m.lastAccess))}</div>${(isGlobalAdmin()||role()==='branch_admin')&&m.active?`<div class="fsc-row"><button class="danger fscRevokeMember" data-id="${esc(m.id)}">Bloquear acesso</button></div>`:''}</div>`).join('')||'<p class="fsc-note">Nenhum usuário por convite ainda.</p>';const invites=(d.invites||[]).filter(i=>i.active&&!i.usedAt).map(i=>`<div class="fsc-cardline"><b>${esc(i.name)}</b> <span class="fsc-pill">${esc(roleLabel(i.role))}</span><div class="fsc-mini">Pendente · criado por ${esc(i.createdBy||'-')} · expira ${esc(formatDate(i.expiresAt))}</div><div class="fsc-row"><button class="danger fscRevokeInvite" data-id="${esc(i.id)}">Cancelar convite</button></div></div>`).join('')||'<p class="fsc-note">Nenhum convite pendente.</p>';const recent=(d.recent||[]).slice(0,20).map(h=>`<div class="fsc-cardline"><b>${esc(h.user||'Sistema')}</b> · ${esc(h.event)} <span class="fsc-pill">${esc(h.result)}</span><div class="fsc-mini">${esc(formatDate(h.date))} · ${esc(h.message||'')}</div></div>`).join('')||'<p class="fsc-note">Sem histórico recente.</p>';overlayHtml(`<h2>Painel de acessos</h2><p>Visão administrativa das filiais, usuários e atividades.</p><h3>Filiais</h3>${branches}<h3>Usuários ativos</h3>${members}<h3>Convites pendentes</h3>${invites}<h3>Atividade recente</h3>${recent}<div class="fsc-row"><button class="secondary" id="fscDashBack">Voltar</button></div>`,true);document.getElementById('fscDashBack').onclick=showManagerHome;document.querySelectorAll('.fscRevokeInvite').forEach(b=>b.onclick=async()=>{if(!confirm('Cancelar este convite?'))return;showBusy('Cancelando...');await jsonp({action:'revokeInvite',...authParams(),inviteId:b.dataset.id});showDashboard()});document.querySelectorAll('.fscRevokeMember').forEach(b=>b.onclick=async()=>{if(!confirm('Bloquear este acesso? A pessoa não conseguirá mais abrir a plataforma neste acesso.'))return;showBusy('Bloqueando...');await jsonp({action:'revokeMember',...authParams(),memberId:b.dataset.id});showDashboard()})}catch(e){showError(e.message)}}

  async function showBranchSwitcher(){showBusy('Carregando filiais...');try{const d=await jsonp({action:'dashboard',...authParams()});if(!d?.ok)throw new Error(d?.message||'Falha.');const rows=(d.branches||[]).map(b=>`<button class="secondary fscBranchPick" data-id="${esc(b.id)}" style="width:100%;text-align:left;margin:5px 0">${esc(b.name)}${b.sector?' · '+esc(b.sector):''} — v${b.version||0}</button>`).join('');overlayHtml(`<h2>Trocar filial</h2><p>Como Administrador geral, você pode acompanhar qualquer filial sem misturar os dados.</p>${rows}<div class="fsc-row"><button class="secondary" id="fscBack">Voltar</button></div>`);document.getElementById('fscBack').onclick=showManagerHome;document.querySelectorAll('.fscBranchPick').forEach(b=>b.onclick=async()=>{showBusy('Abrindo filial...');const r=await jsonp({action:'switchBranch',...authParams(),branchId:b.dataset.id});if(!r?.ok)return showError(r?.message||'Falha.');profile.branchId=r.branchId;profile.branchName=r.branchName;profile.sector=r.sector;localStorage.setItem(BRANCH_KEY,r.branchId);cloudVersion=Number(r.version||0);await loadOfficialState()})}catch(e){showError(e.message)}}

  function showRenameBranch(){overlayHtml(`<h2>Identificação da filial</h2><p>Essa informação aparece no cabeçalho para deixar claro qual ambiente está aberto.</p><label>Filial / unidade</label><input id="fscRenameName" value="${esc(profile.branchName||'')}"><label>Setor (opcional)</label><input id="fscRenameSector" value="${esc(profile.sector||'')}"><div class="fsc-row"><button id="fscRenameSave">Salvar</button><button class="secondary" id="fscBack">Voltar</button></div>`);document.getElementById('fscBack').onclick=showManagerHome;document.getElementById('fscRenameSave').onclick=async()=>{showBusy('Salvando identificação...');const r=await jsonp({action:'renameBranch',...authParams(),name:document.getElementById('fscRenameName').value.trim(),sector:document.getElementById('fscRenameSector').value.trim()});if(!r?.ok)return showError(r?.message||'Falha.');profile.branchName=r.name;profile.sector=r.sector;closeOverlay();installHeaderControls();toast('Identificação da filial atualizada.')}}

  function formatDate(s){if(!s)return '—';try{return new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch(_){return s}}

  function mutatingElement(el){if(!el||el.closest?.('#fsCloudOverlay,#fsCloudHeaderBox'))return false;if(el.matches?.('input,textarea,select,[contenteditable="true"]'))return true;const btn=el.closest?.('button,a,[role="button"]');if(!btn)return false;const text=((btn.textContent||'')+' '+(btn.getAttribute('title')||'')+' '+(btn.getAttribute('onclick')||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /(salvar|aplicar|editar|excluir|limpar|novo colaborador|novo |distribui|sugerir|programar|confirmar|concluir|corrigir|restaurar|importar|ajustar horario|abrir.*modal)/.test(text)||btn.classList.contains('editBtn')}
  function enforceViewerMode(){if(viewerGuardInstalled)return;viewerGuardInstalled=true;const style=document.createElement('style');style.id='fsCloudViewerCss';style.textContent=`html[data-fs-cloud-role="viewer"] .editBtn{display:none!important}`;document.head.appendChild(style);document.addEventListener('click',e=>{if(document.documentElement.dataset.fsCloudRole==='viewer'&&mutatingElement(e.target)){e.preventDefault();e.stopImmediatePropagation();toast('Modo Visualizador: somente consulta.')}},true);const lock=()=>{if(document.documentElement.dataset.fsCloudRole!=='viewer')return;document.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach(el=>{if(el.closest('#fsCloudOverlay,#fsCloudHeaderBox'))return;if(el.hasAttribute('contenteditable'))el.setAttribute('contenteditable','false');else el.disabled=true})};lock();let mt=0;new MutationObserver(()=>{clearTimeout(mt);mt=setTimeout(lock,60)}).observe(document.body,{subtree:true,childList:true})}

  function startWatchers(){clearInterval(pollTimer);clearInterval(versionPollTimer);if(canWrite()){pollTimer=setInterval(()=>{if(applying||writeInFlight||!bootComplete)return;const now=stableSnapshot();if(now!==lastSnapshot)queueSave(false)},Number(CFG.SYNC_INTERVAL_MS||2500))}versionPollTimer=setInterval(async()=>{if(!bootComplete||writeInFlight)return;try{const s=await jsonp({action:'status',...authParams()});if(s?.ok&&Number(s.version||0)>cloudVersion){if(!canWrite()){toast('Atualizando nova versão da filial...');setTimeout(()=>loadOfficialState().catch(()=>{}),500)}else toast('Existe uma versão mais recente desta filial na nuvem.')}}catch(_){ }},30000)}
  function queueSave(force){if(!canWrite()||applying)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>sendSnapshot(false,force).catch(e=>{writeInFlight=false;toast('Falha ao sincronizar: '+e.message)}),force?50:Number(CFG.WRITE_DEBOUNCE_MS||1400))}
  async function sendSnapshot(initializing,force){if(writeInFlight)return;const current=stableSnapshot();if(!force&&!initializing&&current===lastSnapshot)return;writeInFlight=true;const requestId=uuid(),payload=buildSnapshot();postForm({action:'write',...authParams(),requestId,baseVersion:initializing?0:cloudVersion,payload});let result=null;for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,650));try{result=await jsonp({action:'writeStatus',...authParams(),requestId})}catch(_){continue}if(result?.done)break}writeInFlight=false;if(!result?.done)throw new Error('A gravação foi enviada, mas ainda não foi confirmada.');if(!result.ok){if(result.code==='CONFLICT'){overlayHtml(`<h2>Alteração não publicada</h2><p>Outra pessoa salvou esta filial antes. Sua versão não sobrescreveu a versão mais recente.</p><div class="fsc-row"><button id="fscReload">Carregar versão oficial</button><button class="secondary" id="fscClose">Fechar</button></div>`);document.getElementById('fscReload').onclick=()=>loadOfficialState().catch(e=>showError(e.message));document.getElementById('fscClose').onclick=closeOverlay;return}throw new Error(result.message||'Gravação recusada.')}cloudVersion=Number(result.version||cloudVersion+1);localStorage.setItem(VERSION_KEY,String(cloudVersion));localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());lastSnapshot=current;toast('✓ Filial salva na nuvem')}

  function logout(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(BRANCH_KEY);localStorage.removeItem(VERSION_KEY);profile=null;cloudVersion=0;bootComplete=false;clearInterval(pollTimer);clearInterval(versionPollTimer);document.getElementById('fsCloudHeaderBox')?.remove();showAdminLogin('Informe a senha do Administrador ou abra um convite individual.')}

  async function boot(){
    try{
      if(!endpoint())return showEndpointSetup();
      const inv=inviteToken();
      if(inv&&!session())return showInviteClaim(inv);
      if(session()||token()){
        showBusy('Abrindo ambiente da filial...');
        await authenticate();
        if(inv){const u=new URL(location.href);u.searchParams.delete('fsinvite');history.replaceState({},'',u.toString())}
        await loadOfficialState();return;
      }
      showAdminLogin();
    }catch(e){
      if(session()){localStorage.removeItem(SESSION_KEY);return showError(e?.message||'Acesso expirado.',false)}
      showError(e?.message||'Erro inesperado.');
    }
  }

  window.FSCloud={boot,reload:loadOfficialState,save:()=>queueSave(true),logout,showManagerHome,showCreateInvite,showDashboard,getProfile:()=>profile,getVersion:()=>cloudVersion};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
