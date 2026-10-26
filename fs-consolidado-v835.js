/* V835 — consolidação final da nuvem, domingos, cronograma e relatórios. */
(function(){
  'use strict';
  window.__fsV835Consolidado=true;
  const pad=n=>String(n).padStart(2,'0');
  const clone=o=>JSON.parse(JSON.stringify(o||{}));
  const min=h=>{const[a,b]=String(h||'00:00').split(':').map(Number);return(a||0)*60+(b||0)};
  const hh=n=>`${pad(Math.floor((((n%1440)+1440)%1440)/60))}:${pad(((n%1440)+1440)%1440%60)}`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function store(){
    state.config=state.config||{};
    const s=state.config.escalaDomingosPorData=state.config.escalaDomingosPorData||{competencia:'',itens:{}};
    if(!/^\d{4}-\d{2}$/.test(s.competencia||'')){const d=new Date();s.competencia=`${d.getFullYear()}-${pad(d.getMonth()+1)}`}
    s.itens=s.itens||{};s.concluidos=s.concluidos||{};return s;
  }
  function datas(){
    const c=store().competencia;if(!/^\d{4}-\d{2}$/.test(c||''))return[];
    const[a,m]=c.split('-').map(Number),out=[],d=new Date(a,m-1,1,12);
    while(d.getMonth()===m-1){if(d.getDay()===0)out.push(`${a}-${pad(m)}-${pad(d.getDate())}`);d.setDate(d.getDate()+1)}return out;
  }
  function empresa(){
    let local={},api={};try{local=JSON.parse(localStorage.getItem('fsDadosEmpresa')||'{}')}catch(_){ }
    try{api=window.fsGetDadosEmpresa?.()||{}}catch(_){ }
    return Object.assign({},local,api,state.config?.funcionamentoUnidade||{});
  }
  function faixa(){
    const e=empresa(),entrada=e.horarioDomingoEntrada||'08:00',saida=e.horarioDomingoSaida||'13:00',span=Math.max(0,min(saida)-min(entrada));
    const sugerido=span>360?60:span>240?15:0;
    const informado=Number(e.horarioDomingoIntervaloMinutos);
    const intervalo=Math.max(0,Math.min(240,Number.isFinite(informado)?informado:sugerido));
    return{entrada,saida,intervalo};
  }
  function intervalo(i,q,f){
    const ini=min(f.entrada),fim=min(f.saida),span=Math.max(0,fim-ini),dur=Math.min(f.intervalo,span);
    if(!dur)return{almocoIni:'00:00',almocoFim:'00:00'};
    const centro=ini+Math.floor((span-dur)/2),passo=q>1?Math.max(15,Math.ceil(dur/15)*15):0;
    let comeco=centro+(i-(q-1)/2)*passo;
    comeco=Math.round(comeco/15)*15;comeco=Math.max(ini,Math.min(fim-dur,comeco));
    return{almocoIni:hh(comeco),almocoFim:hh(comeco+dur)};
  }
  function cfg(d){
    state.config.fsDomingoPorDataConfig=state.config.fsDomingoPorDataConfig||{};
    return state.config.fsDomingoPorDataConfig[d]||window.fsV561ConfigData?.(d)||null;
  }
  function abertas(){if(empresa().abreDomingo!==true)return[];return datas().filter(d=>{const c=cfg(d);return c?.aberto===true&&c?.fsV831ManualOpen===true})}
  function reg(d,id,criar=false){
    const s=store();if(criar){s.itens[d]=s.itens[d]||{};s.itens[d][id]=s.itens[d][id]||{status:'pendente',trabalha:false,folgaData:''}}
    return s.itens?.[d]?.[id]||{};
  }
  function folgasData(data){const[a,m,d]=data.split('-').map(Number);return Array.from({length:5},(_,i)=>{const x=new Date(a,m-1,d+1+i,12);return`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`})}
  function br(data){return String(data||'').split('-').reverse().join('/')}
  function persistir(){
    try{save()}catch(_){ }
    try{localStorage.setItem('fsDomingosMensaisV550',JSON.stringify({competencia:store().competencia,itens:store().itens,concluidos:store().concluidos,at:Date.now()}))}catch(_){ }
  }
  function invalidar(){delete state.config.fsDomCompetenciaConfirmada;delete state.config.fsDomConfirmacaoAssinatura;datas().forEach(d=>delete store().concluidos[d])}
  function sincronizarData(d){
    const c=cfg(d);if(!c)return false;const f=faixa(),q=Math.max(1,Math.min(3,Number(c.equipes)||1));
    const novos=Array.from({length:q},(_,i)=>({entrada:f.entrada,...intervalo(i,q,f),saida:f.saida}));
    let mudou=JSON.stringify(c.horarios||[])!==JSON.stringify(novos);c.equipes=q;c.horarios=novos;
    Object.values(store().itens?.[d]||{}).forEach(r=>{if(r.status==='trabalha'||r.trabalha){const n=Math.max(0,Math.min(q-1,Number(r.equipe)||0));r.equipe=n;if(JSON.stringify(r.horario||{})!==JSON.stringify(novos[n])){r.horario=clone(novos[n]);mudou=true}}});
    return mudou;
  }
  function sincronizarTudo(){
    let mudou=false;datas().forEach(d=>{if(sincronizarData(d))mudou=true});
    const f=faixa(),q=Math.max(1,Math.min(3,Number(state.config?.equipesDia?.domingo)||1)),base=Array.from({length:q},(_,i)=>({titulo:`Equipe ${pad(i+1)}`,entrada:f.entrada,...intervalo(i,q,f),saida:f.saida}));
    state.horarios=state.horarios||{};if(JSON.stringify(state.horarios.domingo||[])!==JSON.stringify(base)){state.horarios.domingo=base;mudou=true}
    if(mudou)persistir();return mudou;
  }
  function aplicarEquipesPadrao(qtd){
    const q=Math.max(1,Math.min(3,Number(qtd)||1));
    state.config=state.config||{};state.config.equipesDia=state.config.equipesDia||{};state.config.equipesDia.domingo=q;
    datas().forEach(d=>{const c=cfg(d);if(c)c.equipes=q});
    sincronizarTudo();return q;
  }
  let fsV901BusyTimer=0,fsV901BloquearRender=false;
  function domingoOcupado(texto='Organizando escala dominical…'){
    let box=document.querySelector('.fsV901SundayBusy');
    if(!box){
      box=document.createElement('div');box.className='fsV901SundayBusy';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
      box.innerHTML='<div class="fsV901BusyCard"><div class="fsV901LogoRing"><img src="./LOGO%20ATUAL.png" alt="Zenir"></div><strong></strong><small>Aguarde um instante. Seus dados estão sendo preservados.</small></div>';
      document.body.appendChild(box);
    }
    box.querySelector('strong').textContent=texto;box.classList.remove('saindo');document.body.classList.add('fsV901SundayUpdating');clearTimeout(fsV901BusyTimer);return box;
  }
  function domingoPronto(atraso=420){clearTimeout(fsV901BusyTimer);fsV901BusyTimer=setTimeout(()=>{const box=document.querySelector('.fsV901SundayBusy');box?.classList.add('saindo');document.body.classList.remove('fsV901SundayUpdating');setTimeout(()=>box?.remove(),180)},atraso)}
  function atualizarLinhasData(data){(state.pessoas||[]).forEach(p=>atualizarLinhaDomingo(data,p.id));corrigirCabecalhos();corrigirRodape()}
  function instalarProtecaoRender(){
    const atual=window.fsDom541Mes;if(typeof atual!=='function'||atual.__fsV901Protegido)return;
    const fn=function(){if(fsV901BloquearRender)return null;return atual.apply(this,arguments)};fn.__fsV901Protegido=true;fn.__fsV901Original=atual;window.fsDom541Mes=fn;try{fsDom541Mes=fn}catch(_){ }
  }
  function instalarCabecalhoEstavel(){
    instalarProtecaoRender();const atual=window.fsV561Set;if(typeof atual!=='function'||atual.__fsV901Estavel)return;
    const fn=function(data,chave){
      domingoOcupado(chave==='equipes'?'Ajustando equipes e intervalos…':chave==='percentual'?'Recalculando o quadro do domingo…':'Atualizando o domingo…');
      fsV901BloquearRender=true;let retorno;try{retorno=atual.apply(this,arguments)}finally{fsV901BloquearRender=false}
      setTimeout(()=>{limparFolgasAutomaticas(data);sincronizarData(data);atualizarLinhasData(data);persistir();domingoPronto()},70);return retorno;
    };
    fn.__fsV901Estavel=true;fn.__fsV901Original=atual;window.fsV561Set=fn;try{fsV561Set=fn}catch(_){ }
  }
  function limparFolgasAutomaticas(data){
    const alvo=data?[data]:datas();let mudou=false;
    alvo.forEach(d=>Object.values(store().itens?.[d]||{}).forEach(r=>{if((r.status==='trabalha'||r.trabalha)&&r.folgaData){r.folgaData='';mudou=true}}));
    if(mudou){invalidar();persistir()}return mudou;
  }
  function migrarFolgaAutomaticaLegada(){
    const chave=`fsV899FolgaManual_${store().competencia}`;if(state.config[chave])return false;let mudou=false;
    datas().forEach(data=>{const[a,m,d]=data.split('-').map(Number),x=new Date(a,m-1,d+2,12),automatica=`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;Object.values(store().itens?.[data]||{}).forEach(r=>{if((r.status==='trabalha'||r.trabalha)&&r.folgaData===automatica){r.folgaData='';mudou=true}})});
    state.config[chave]=true;if(mudou)invalidar();persistir();return mudou;
  }
  function instalarGeradoresSemFolgaCravada(){
    [['fsV561GerarDomingo',true],['fsV551Sugerir',false]].forEach(([nome,porData])=>{
      const atual=window[nome];if(typeof atual!=='function'||atual.__fsV899SemFolga)return;
      const fn=function(){const data=porData?arguments[0]:'';if(porData)domingoOcupado('Aplicando a sugestão do domingo…');if(porData)fsV901BloquearRender=true;let retorno;try{retorno=atual.apply(this,arguments)}finally{if(porData)fsV901BloquearRender=false}setTimeout(()=>{limparFolgasAutomaticas(data);if(porData)atualizarLinhasData(data);else try{window.fsDom541Mes?.(store().competencia)}catch(_){ }setTimeout(atualizar,80);if(porData)domingoPronto()},100);return retorno};
      fn.__fsV899SemFolga=true;fn.__fsV899Original=atual;window[nome]=fn;try{if(nome==='fsV561GerarDomingo')fsV561GerarDomingo=fn;else fsV551Sugerir=fn}catch(_){ }
    });
  }
  function migrarFechados(){
    const chave=`fsV835DomingosIniciadosFechados_${store().competencia||'sem_competencia'}`;if(state.config[chave])return false;
    datas().forEach(d=>{const c=cfg(d);if(c){c.aberto=false;c.fsV831ManualOpen=false}});
    state.config[chave]=true;invalidar();persistir();return true;
  }
  function definido(d,p){const r=reg(d,p.id),c=cfg(d),eq=Number(r.equipe);return['trabalha','nao'].includes(r.status)&&(r.status!=='trabalha'||(!!r.folgaData&&Number.isFinite(eq)&&eq>=0&&eq<Math.max(1,Number(c?.equipes)||1)))}
  function assinatura(){
    if(typeof window.fsV558AssinaturaDomingos==='function')return window.fsV558AssinaturaDomingos();
    const ids=(state.pessoas||[]).map(p=>p.id).sort();return JSON.stringify([store().competencia,abertas().map(d=>[d,cfg(d),...ids.map(id=>reg(d,id))])]);
  }
  function confirmarCompetencia(){
    const ds=abertas();if(!ds.length)return alert('Abra pelo menos um domingo antes de concluir a competência.');
    const falt=ds.filter(d=>(state.pessoas||[]).some(p=>!definido(d,p)));if(falt.length)return alert(`Ainda existem pendências em ${falt.length} domingo(s) aberto(s). Defina a situação de todos e, para quem trabalhar, informe equipe e folga compensatória.`);
    if(!confirm(`Confirmar a programação de ${ds.length} domingo(s) aberto(s)? Os domingos fechados serão ignorados.`))return;
    state.config.fsDomCompetenciaConfirmada=store().competencia;state.config.fsDomConfirmacaoAssinatura=assinatura();persistir();atualizar();
  }
  window.fsBaixarDomingosMes=confirmarCompetencia;

  function linhaDomingo(data,id){return[...document.querySelectorAll('#domingo .fsV830StatusBtn')].find(b=>b.dataset.data===data&&b.dataset.id===id)?.closest('tr')||null}
  function atualizarLinhaDomingo(data,id){const row=linhaDomingo(data,id),r=reg(data,id),c=cfg(data);if(!row)return;row.classList.remove('fsDomSim','fsDomNao','fsDomPendente');row.classList.add(r.status==='trabalha'?'fsDomSim':r.status==='nao'?'fsDomNao':'fsDomPendente');const original=row.querySelector('.fsV830StatusOriginal'),btn=row.querySelector('.fsV830StatusBtn');if(original)original.value=r.status;if(btn)btn.textContent=r.status==='trabalha'?'✅ Trabalha':r.status==='nao'?'— Não trabalha':'⚠ Pendente';const td=row.lastElementChild;if(!td)return;if(r.status!=='trabalha'){td.innerHTML=r.status==='nao'?'<span class="fsDom541Nao">Não trabalha neste domingo</span>':'<span class="fsDom541Nao">Aguardando definição</span>';return}const q=Math.max(1,Number(c?.equipes)||1),eq=Math.max(0,Math.min(q-1,Number(r.equipe)||0)),hs=c?.horarios||[],eqs=Array.from({length:q},(_,i)=>`<option value="${i}" ${eq===i?'selected':''}>Equipe ${pad(i+1)} • ${esc(hs[i]?.entrada||'--:--')} às ${esc(hs[i]?.saida||'--:--')}</option>`).join(''),opts=folgasData(data).map(x=>`<option value="${x}" ${r.folgaData===x?'selected':''}>${br(x)}</option>`).join('');td.innerHTML=`<div class="fsDom541Def"><label>Equipe / horário</label><select onchange="fsDom541Equipe('${esc(data)}','${esc(id)}',this.value)">${eqs}</select><label>Folga compensatória</label><select onchange="fsDom541Folga('${esc(data)}','${esc(id)}',this.value)"><option value="">Definir folga</option>${opts}</select></div>`}
  window.fsDom541Status=function(data,id,v){
    if(!['pendente','trabalha','nao'].includes(v))return;const r=reg(data,id,true),c=cfg(data);r.status=v;r.trabalha=v==='trabalha';
    if(v==='trabalha'){
      r.equipe=Math.max(0,Math.min(Math.max(1,Number(c?.equipes)||1)-1,Number(r.equipe)||0));
      r.folgaData='';r.horario=clone(c?.horarios?.[r.equipe]||c?.horarios?.[0]||{});
    }else if(v==='nao'){r.folgaData='';delete r.equipe;delete r.horario}else{r.folgaData='';delete r.equipe;delete r.horario}
    invalidar();persistir();atualizarLinhaDomingo(data,id);setTimeout(atualizar,35);
  };
  window.fsDom541Equipe=function(data,id,v){const r=reg(data,id,true),c=cfg(data),n=Math.max(0,Math.min(Math.max(1,Number(c?.equipes)||1)-1,Number(v)||0));r.equipe=n;r.horario=clone(c?.horarios?.[n]||c?.horarios?.[0]||{});invalidar();persistir();setTimeout(atualizar,35)};
  window.fsDom541Folga=function(data,id,v){const r=reg(data,id,true);r.folgaData=v;invalidar();persistir();const row=linhaDomingo(data,id);row?.classList.add('fsV901DaySaved');clearTimeout(row?._fsV901Saved);if(row)row._fsV901Saved=setTimeout(()=>row.classList.remove('fsV901DaySaved'),520);setTimeout(()=>{corrigirRodape();corrigirCabecalhos()},90)};

  window.fsV835LimparDomingos=function(){
    const comp=store().competencia;if(!comp)return;if(!confirm(`Limpar e refazer toda a escala dominical de ${comp}? As escolhas desta competência serão removidas.`))return;
    datas().forEach(d=>{delete store().itens[d];delete store().concluidos[d];const c=cfg(d);if(c){c.aberto=false;c.fsV831ManualOpen=false;c.percentual=50;sincronizarData(d)}});
    invalidar();persistir();window.fsDom541Mes?.(comp);setTimeout(atualizar,80);
  };
  function acoesMes(){
    const topo=document.querySelector('#domingo .fsDomMesTopo');if(!topo)return;const input=topo.querySelector('input[type="month"]');if(!input)return;
    let box=topo.querySelector('.fsV835MesAcoes');if(!box){box=document.createElement('div');box.className='fsV835MesAcoes';input.insertAdjacentElement('beforebegin',box);box.appendChild(input);box.insertAdjacentHTML('beforeend','<button type="button" class="fsV835ResetDomingos" onclick="fsV835LimparDomingos()">↺ Limpar e refazer</button>')}
  }
  let nuvemPronta=false,nuvemSuja=false,assinaturaLocal='';
  const assinaturaEstado=()=>{try{return JSON.stringify(state)}catch(_){return''}};
  function estadoNuvem(sujo){nuvemSuja=!!sujo;document.body?.classList.toggle('fsV835CloudDirty',nuvemSuja)}
  function compactarSalvar(){const b=document.getElementById('fsCloudPendingSave');if(!b)return;if(b.textContent)b.textContent='';b.title='Backup';b.setAttribute('aria-label','Backup');if(!nuvemSuja)b.hidden=true}
  function verificarEdicaoReal(){if(!nuvemPronta)return;setTimeout(()=>{const atual=assinaturaEstado();if(atual&&atual!==assinaturaLocal)estadoNuvem(true)},80)}
  function prepararControleNuvem(){
    assinaturaLocal=assinaturaEstado();nuvemPronta=true;estadoNuvem(false);compactarSalvar();
    document.addEventListener('input',e=>{if(e.isTrusted&&!e.target?.closest?.('#fsCloudPanel'))verificarEdicaoReal()},true);
    document.addEventListener('change',e=>{if(e.isTrusted&&!e.target?.closest?.('#fsCloudPanel'))verificarEdicaoReal()},true);
    document.addEventListener('click',e=>{if(!e.isTrusted)return;const b=e.target?.closest?.('#fsCloudPendingSave');if(b){const vigiar=setInterval(()=>{if(b.hidden){clearInterval(vigiar);assinaturaLocal=assinaturaEstado();estadoNuvem(false)}},120);setTimeout(()=>clearInterval(vigiar),15000);return}const acao=e.target?.closest?.('button,[role="button"]');if(acao&&!acao.closest?.('.nav,#fsCloudPanel')&&!acao.matches?.('[data-page],.downloadIcon,.cronoExport,.cr40Export'))verificarEdicaoReal()},true);
  }
  function corrigirRodape(){
    const grade=document.querySelector('#domingo .fsDomMesGrade');if(!grade)return;let box=grade.querySelector('.fsV831Footer');if(!box){box=document.createElement('div');box.className='fsV831Footer';grade.appendChild(box)}const ds=abertas(),falt=ds.filter(d=>(state.pessoas||[]).some(p=>!definido(d,p))),feitos=ds.length-falt.length,ok=state.config?.fsDomCompetenciaConfirmada===store().competencia&&state.config?.fsDomConfirmacaoAssinatura===assinatura();
    const html=`<div><b>Conclusão da escala dominical</b><small class="${ds.length?'':'fsV835FooterZero'}"><strong>${feitos} de ${ds.length} domingo(s) aberto(s)</strong> totalmente classificados. Domingos fechados não geram pendência.</small></div><button class="${ok?'confirmado':''}" ${ds.length&&!falt.length?'':'disabled'} onclick="fsBaixarDomingosMes()">${ok?'✓ Competência confirmada':'✓ Confirmar conclusão da competência'}</button>`;if(box.innerHTML!==html)box.innerHTML=html;
  }
  function corrigirCabecalhos(){document.querySelectorAll('#domingo .fsDomDataCard').forEach(card=>{const txt=card.querySelector('.fsDomDataHead b')?.textContent||'',m=txt.match(/(\d{2})\/(\d{2})\/(\d{4})/);if(!m)return;const d=`${m[3]}-${m[2]}-${m[1]}`,c=cfg(d),aberto=c?.aberto===true&&c?.fsV831ManualOpen===true;card.classList.toggle('fsV831Aberto',aberto);card.classList.toggle('fsV831Fechado',!aberto);const regra=[...card.querySelectorAll('.fsV561Field')].find(x=>/regra aplicada/i.test(x.querySelector('span')?.textContent||''))?.querySelector('input');if(regra){const total=state.pessoas?.length||0,previsto=Math.round(total*Number(c?.percentual||0)/100);regra.value=aberto?`${c?.percentual||0}% • ${previsto} de ${total}`:'Unidade fechada'}})}
  function corrigirExpansores(){document.querySelectorAll('#configContent .dayScheduleCard').forEach(card=>{const head=card.querySelector('.dayScheduleHead');if(!head)return;let btn=head.querySelector('.fsV812DayToggle');if(!btn){btn=document.createElement('button');btn.type='button';btn.className='fsV812DayToggle';head.appendChild(btn)}const paint=()=>{const open=card.classList.contains('fsV806Open');btn.setAttribute('aria-expanded',String(open));btn.innerHTML=`<span>${open?'⌃':'⌄'}</span>`};if(btn.dataset.fsV848!=='1'){btn.dataset.fsV848='1';btn.onclick=e=>{e.preventDefault();e.stopPropagation();const open=!card.classList.contains('fsV806Open');document.querySelectorAll('#configContent .dayScheduleCard.fsV806Open').forEach(x=>x.classList.remove('fsV806Open'));card.classList.toggle('fsV806Open',open);paint()}}paint()})}

  function fecharPortalStatus(){document.querySelector('.fsV852StatusPortal')?.remove()}
  function abrirPortalStatus(btn){const atual=document.querySelector('.fsV852StatusPortal');if(atual?.dataset.data===btn.dataset.data&&atual?.dataset.id===btn.dataset.id){atual.remove();return}fecharPortalStatus();const r=btn.getBoundingClientRect(),w=176,h=118,top=r.bottom+6+h<=innerHeight?r.bottom+6:Math.max(8,r.top-h-6),left=Math.max(8,Math.min(innerWidth-w-8,r.left)),p=document.createElement('div');p.className='fsV852StatusPortal';p.dataset.data=btn.dataset.data;p.dataset.id=btn.dataset.id;p.style.left=`${left}px`;p.style.top=`${top}px`;p.innerHTML='<button type="button" data-value="pendente">⚠ Pendente</button><button type="button" data-value="trabalha">✅ Trabalha</button><button type="button" data-value="nao">— Não trabalha</button>';document.body.appendChild(p)}
  document.addEventListener('click',e=>{const btn=e.target.closest?.('.fsV830StatusBtn');if(btn){const ja=document.querySelector('.fsV852StatusPortal')?.dataset;const mesmo=ja?.data===btn.dataset.data&&ja?.id===btn.dataset.id;queueMicrotask(()=>{document.querySelectorAll('.fsV830StatusPop').forEach(x=>x.hidden=true);if(mesmo)fecharPortalStatus();else abrirPortalStatus(btn)});return}const op=e.target.closest?.('.fsV852StatusPortal button');if(op){e.preventDefault();e.stopImmediatePropagation();const p=op.closest('.fsV852StatusPortal'),row=linhaDomingo(p.dataset.data,p.dataset.id);row?.classList.add('fsV852RowUpdating');window.fsDom541Status?.(p.dataset.data,p.dataset.id,op.dataset.value);fecharPortalStatus();setTimeout(()=>row?.classList.remove('fsV852RowUpdating'),260);return}if(!e.target.closest?.('.fsV852StatusPortal'))fecharPortalStatus()},true);
  addEventListener('scroll',fecharPortalStatus,true);addEventListener('resize',fecharPortalStatus);

  function instalarCronograma(){
    const ant=window.cronogramaExecutivoHtml;if(typeof ant!=='function'||ant.__fsV835)return;
    const fn=function(){let out=ant.apply(this,arguments);const tmp=document.createElement('div');tmp.innerHTML=out;const model=tmp.querySelector('.cronoExecModel');if(!model)return out;
      model.querySelectorAll('[data-fs-v835-domingos]').forEach(x=>x.remove());
      const grade=model.querySelector('.fsCronoDomingoGrid');if(grade){const titulo=grade.previousElementSibling;if(titulo?.classList.contains('cronoWeekTitle'))titulo.remove();grade.remove()}
      model.querySelectorAll('.cronoOverviewTable').forEach(table=>{const linha=[...table.querySelectorAll('tr')].find(tr=>/dia da semana/i.test(tr.textContent||''));if(!linha)return;const celulas=[...linha.children],idx=celulas.findIndex(c=>/^domingo$/i.test((c.textContent||'').trim()));if(idx<0)return;table.querySelectorAll('tr').forEach(tr=>tr.children[idx]?.remove())});
      const visao=[...model.querySelectorAll('.cronoWeekTitle')].find(x=>/visão geral/i.test(x.textContent||'')),ds=abertas();
      if(visao&&ds.length){
        const sec=document.createElement('section'),d=ds[0],c=cfg(d),f=faixa(),q=Math.max(1,Number(c?.equipes)||Number(state.config?.equipesDia?.domingo)||1),hs=(c?.horarios||state.horarios?.domingo||[]).slice(0,q);
        const linhas=Array.from({length:q},(_,i)=>{const h=hs[i]||{entrada:f.entrada,saida:f.saida},intIni=h.almocoIni||'00:00',intFim=h.almocoFim||'00:00',pausa=Math.max(0,min(intFim)-min(intIni)),efet=Math.max(0,min(h.saida||f.saida)-min(h.entrada||f.entrada)-pausa);return`<tr><td>${pad(i+1)}</td><td>${esc(h.entrada||f.entrada)}</td><td>${pausa?`${esc(intIni)} às ${esc(intFim)}`:'—'}</td><td>${esc(h.saida||f.saida)}</td><td>${pad(Math.floor(efet/60))}h${pad(efet%60)}</td></tr>`}).join('');
        const datasHtml=ds.map(x=>`<span>${br(x)}</span>`).join(''),total=new Set(ds.flatMap(x=>(state.pessoas||[]).filter(p=>reg(x,p.id).status==='trabalha').map(p=>String(p.id)))).size,h=hs[0]||{entrada:f.entrada,saida:f.saida,almocoIni:'00:00',almocoFim:'00:00'},ef=Math.max(0,min(h.saida||f.saida)-min(h.entrada||f.entrada)-Math.max(0,min(h.almocoFim)-min(h.almocoIni)));
        sec.dataset.fsV835Domingos='1';sec.className='fsV835CronoDomingos';sec.innerHTML=`<div class="cronoWeekTitle">HORÁRIO PADRÃO DE DOMINGO</div><div class="fsV835CronoDomingo"><section class="fsV835CronoData"><h4>DOMINGO — ${q} EQUIPE${q>1?'S':''} / INTERVALOS INDEPENDENTES</h4><div class="fsV853CronoBody"><div class="fsV853CronoClock"><small>HORÁRIO<br>DA UNIDADE</small><strong>${esc(f.entrada)}</strong><em>às</em><strong>${esc(f.saida)}</strong></div><table class="fsV853CronoTable"><thead><tr><th>Equipe</th><th>Entrada</th><th>Intervalo</th><th>Saída</th><th>Efetivas</th></tr></thead><tbody>${linhas}</tbody></table></div><div class="fsV899SundayDates"><b>Datas abertas na competência:</b>${datasHtml}</div><div class="fsV853CronoSupport"><span>👥 <b>${total} colaborador(es) únicos escalados</b></span><span>◷ <b>Carga padrão: ${pad(Math.floor(ef/60))}h${pad(ef%60)}</b></span></div></section></div>`;model.insertBefore(sec,visao)
      }
      const jornada=[...model.querySelectorAll('.compCard')].find(x=>/jornada semanal/i.test(x.textContent||''));if(jornada){const sm=jornada.querySelector('small');if(sm)sm.innerHTML=ds.length?`Meta: ${state.cargaMeta}h por colaborador<br>Domingos abertos: ${ds.length} • escala calculada por data`:`Meta: ${state.cargaMeta}h por colaborador<br>Domingo: folga geral`}
      return tmp.innerHTML};fn.__fsV835=true;window.cronogramaExecutivoHtml=fn;try{cronogramaExecutivoHtml=fn}catch(_){ }
  }
  function atualizar(){compactarSalvar();acoesMes();sincronizarTudo();instalarCabecalhoEstavel();instalarGeradoresSemFolgaCravada();corrigirCabecalhos();corrigirRodape();corrigirExpansores();instalarCronograma()}
  function iniciar(){migrarFechados();migrarFolgaAutomaticaLegada();sincronizarTudo();instalarCabecalhoEstavel();instalarGeradoresSemFolgaCravada();instalarCronograma();atualizar();try{renderCronograma?.();renderRelatoriosPreview?.()}catch(_){ }setTimeout(prepararControleNuvem,500)}
  let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(atualizar,150)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{
    const equipes=e.target?.closest?.('.fsV561Field')?.querySelector?.('span')?.textContent||'';
    if(e.target?.matches?.('select')&&/equipes\s*\/\s*intervalos/i.test(equipes))setTimeout(()=>{const card=e.target.closest('.fsDomDataCard'),data=card?.dataset.fsDomData;if(data){sincronizarData(data);atualizarLinhasData(data);persistir()}},80);
    if(e.target?.matches?.('#fsAbreDomingo,#fsHorarioDomingoEntrada,#fsHorarioDomingoSaida,#fsHorarioDomingoIntervaloMinutos'))setTimeout(()=>{sincronizarTudo();atualizar();try{renderCronograma?.();renderRelatoriosPreview?.()}catch(_){ }},120)
  },true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('#domingo .fsV561Apply'))domingoOcupado('Aplicando a sugestão do domingo…')},true);
  setInterval(atualizar,2600);setTimeout(iniciar,850);
})();

/* V837 — finalização do organograma e parâmetros inteligentes de jornada. */
(function(){
  if(!document.querySelector('link[data-fs-v837]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./fs-finalizacao-v837.css?v=889';l.dataset.fsV837='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-fs-v837]')){const s=document.createElement('script');s.src='./fs-finalizacao-v837.js?v=848';s.dataset.fsV837='1';document.head.appendChild(s)}
})();

/* V842 — módulo isolado de gestão do banco de horas, exclusivo da Visão Geral. */
(function(){
  if(!document.querySelector('link[data-fs-bh-v842]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./fs-banco-horas-v842.css?v=883';l.dataset.fsBhV842='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-fs-bh-v842]')){const s=document.createElement('script');s.src='./fs-banco-horas-v842.js?v=883';s.dataset.fsBhV842='1';document.head.appendChild(s)}
  /* V865 — mapa mensal executivo, carregado depois do banco de horas. */
  if(!document.querySelector('link[data-fs-map-v865]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./fs-mapa-mensal-v865.css?v=882';l.dataset.fsMapV865='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-fs-map-v865]')){const s=document.createElement('script');s.src='./fs-mapa-mensal-v865.js?v=882';s.dataset.fsMapV865='1';document.head.appendChild(s)}
})();
