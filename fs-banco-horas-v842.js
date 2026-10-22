/* V842 — Gestão isolada de banco de horas. Não altera escalas ou horários. */
(function(){
  'use strict';
  const VERSION=2, CFG='fsBancoHoras', STATUS={normal:'Dentro do padrão',atencao:'Atenção',critico:'Crítico'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const uid=()=>`bh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const cfg=()=>{
    state.config=state.config||{};
    const base={version:VERSION,settings:{creditNormalMax:240,creditAttentionMax:720,debitAttentionMax:240,maxExtraDay:120,minLunch:60},imports:[],plans:[]};
    state.config[CFG]=state.config[CFG]||base;
    state.config[CFG].version=VERSION;
    state.config[CFG].settings={...base.settings,...(state.config[CFG].settings||{})};
    state.config[CFG].imports=Array.isArray(state.config[CFG].imports)?state.config[CFG].imports:[];
    state.config[CFG].plans=Array.isArray(state.config[CFG].plans)?state.config[CFG].plans:[];
    return state.config[CFG];
  };
  const persist=()=>{save(); renderHomeCard();};
  const latest=()=>cfg().imports.slice().sort((a,b)=>String(b.periodEnd||b.importedAt).localeCompare(String(a.periodEnd||a.importedAt)))[0]||null;
  const hm=m=>`${m<0?'-':''}${String(Math.floor(Math.abs(m)/60)).padStart(2,'0')}:${String(Math.abs(m)%60).padStart(2,'0')}`;
  const parseHM=v=>{const m=String(v||'').match(/(\d+):(\d{2})\s*([CD])?/i);if(!m)return 0;const n=Number(m[1])*60+Number(m[2]);return m[3]?.toUpperCase()==='D'?-n:n};
  const level=m=>{const a=Math.abs(m),s=cfg().settings;if(m<0)return a<=s.debitAttentionMax?'atencao':'critico';return a<=s.creditNormalMax?'normal':a<=s.creditAttentionMax?'atencao':'critico'};
  const activePeople=()=>Array.isArray(state.pessoas)?state.pessoas:[];
  const personName=s=>norm(s).split(' ').map(w=>w==='FCO'?'FRANCISCO':w).join(' ');
  const edit=(a,b)=>{a=String(a);b=String(b);const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}return d[b.length]};
  function personMatch(code,name){
    const nn=personName(name),codeN=String(code||'').replace(/\D/g,'');
    let p=activePeople().find(x=>[x.codigo,x.matricula,x.chapa].some(v=>String(v||'').replace(/\D/g,'')===codeN&&codeN));
    if(p)return p;
    p=activePeople().find(x=>personName(x.nome)===nn); if(p)return p;
    let best=null,score=0;const words=nn.split(' ').filter(x=>x.length>2);
    activePeople().forEach(x=>{const other=personName(x.nome),w=other.split(' ').filter(y=>y.length>2),hit=words.filter(y=>w.some(z=>y===z||(y.length>4&&z.length>4&&edit(y,z)<=1))).length,token=hit/Math.max(words.length,w.length,1),full=1-edit(nn,other)/Math.max(nn.length,other.length,1),sc=Math.max(token,full);if(sc>score){score=sc;best=x}});
    return score>=.74?best:null;
  }
  function parseReport(text){
    const flat=String(text||'').replace(/\s+/g,' ').trim();
    const period=(flat.match(/Per[ií]odo\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:a|até)\s*(\d{2}\/\d{2}\/\d{4})/i)||[]);
    const estab=(flat.match(/Estabelecimento\s*:?\s*(.+?)(?=\s+(?:Lota[cç][aã]o|Cargo|Obra|Empregados|Jornada|Per[ií]odo)\s*:)/i)||[])[1]||'';
    const rows=[];
    const re=/(\d{6})\s+(.+?)\s+(\d+:\d{2}[CD]?)\s+(\d+:\d{2})\s+(\d+:\d{2})\s+(\d+:\d{2}[CD]?)\s+(\d+:\d{2})\s+(\d+:\d{2})\s+(\d+:\d{2}[CD])(?=\s+\d{6}\s+|\s+Total\b|$)/gi;
    let m;while((m=re.exec(flat))){
      const p=personMatch(m[1],m[2]);
      rows.push({code:m[1],name:m[2].trim(),previous:parseHM(m[3]),creditPeriod:parseHM(m[4]),debitPeriod:parseHM(m[5]),difference:parseHM(m[6]),creditTotal:parseHM(m[7]),debitTotal:parseHM(m[8]),balance:parseHM(m[9]),personId:p?.id||'',role:p?.funcao||'',matchedName:p?.nome||''});
    }
    if(!rows.length)throw new Error('Não encontrei as linhas de colaboradores no padrão esperado do Resumo do Banco de Horas.');
    return {establishment:estab.trim(),periodStart:period[1]||'',periodEnd:period[2]||'',rows};
  }
  async function pdfText(file){
    let pdf=window.pdfjsLib;
    if(!pdf?.getDocument){pdf=await import('./pdf.min.mjs');window.pdfjsLib=pdf;pdf.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs',document.baseURI).href}
    const doc=await pdf.getDocument({data:await file.arrayBuffer()}).promise;let out='';
    for(let i=1;i<=doc.numPages;i++){
      const pg=await doc.getPage(i),ct=await pg.getTextContent(),lines=[];
      ct.items.filter(x=>String(x.str||'').trim()).forEach(item=>{const y=Math.round(Number(item.transform?.[5]||0)*2)/2;let line=lines.find(x=>Math.abs(x.y-y)<=1);if(!line){line={y,items:[]};lines.push(line)}line.items.push({x:Number(item.transform?.[4]||0),text:String(item.str).trim()})});
      out+=lines.sort((a,b)=>b.y-a.y).map(line=>line.items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ')).join('\n')+'\n';
    }
    return out;
  }
  const company=()=>{try{return typeof fsGetDadosEmpresa==='function'?fsGetDadosEmpresa():JSON.parse(localStorage.getItem('fsDadosEmpresa')||'{}')}catch(_){return{}}};
  async function importPdf(input){
    const file=input.files?.[0];if(!file)return;
    try{
      input.disabled=true;const data=parseReport(await pdfText(file)),co=company(),branch=co.filial||co.cidade||'filial atual';
      const unmatched=data.rows.filter(x=>!x.personId).length;
      const msg=`Documento: ${data.establishment||'estabelecimento não identificado'}\nPeríodo: ${data.periodStart||'?'} a ${data.periodEnd||'?'}\nFilial atual: ${branch}\nReconhecidos: ${data.rows.length-unmatched} de ${data.rows.length}.\n\nConfirmar esta fotografia como saldo oficial mais recente desta filial?`;
      if(!confirm(msg))return;
      const signature=norm([data.establishment,data.periodStart,data.periodEnd,...data.rows.map(x=>`${x.code}:${x.balance}`)].join('|'));
      if(cfg().imports.some(x=>x.signature===signature))return alert('Este mesmo resumo já foi importado.');
      cfg().imports.push({id:uid(),fileName:file.name,importedAt:new Date().toISOString(),signature,excludedCodes:[],...data});persist();renderPanel();
      alert(`Resumo importado: ${data.rows.length-unmatched} colaborador(es) reconhecido(s). ${unmatched} registro(s) sem correspondência foram ignorados.`);
    }catch(e){alert(`Não foi possível importar o PDF. ${e.message||e}`)}finally{input.disabled=false;input.value=''}
  }
  function reportRows(snap){if(!snap)return[];const excluded=new Set(snap.excludedCodes||[]);return(snap.rows||[]).map(x=>{let p=activePeople().find(y=>y.id===x.personId);if(!p)p=personMatch(x.code,x.name);if(p){x.personId=p.id;x.matchedName=p.nome;x.role=p.funcao||''}else{x.personId='';x.matchedName='';x.role=''}return x}).filter(x=>x.personId&&!excluded.has(x.code))}
  function totals(snap){const r=reportRows(snap),credit=r.filter(x=>x.balance>0),debit=r.filter(x=>x.balance<0);return{all:r.length,credit:credit.length,debit:debit.length,creditMin:credit.reduce((a,x)=>a+x.balance,0),debitMin:debit.reduce((a,x)=>a+Math.abs(x.balance),0),priority:r.filter(x=>level(x.balance)==='critico').length,ignored:(snap?.rows||[]).length-r.length}}
  function renderHomeCard(){
    const root=document.getElementById('visaoContent');if(!root)return;
    let el=root.querySelector('.fsBHHome');if(!el){el=document.createElement('section');el.className='overviewBlock fsBHHome noPrint';root.prepend(el)}
    const snap=latest(),t=totals(snap);el.innerHTML=`<button type="button" class="fsBHCard" onclick="fsBHOpen()"><span class="fsBHIcon">🗓️</span><span><strong>Gestão do banco de horas</strong><small>${snap?`Atualizado até ${esc(snap.periodEnd||'data não identificada')} • ${t.all} colaborador(es)`:'Importe o resumo do ponto para iniciar a análise'}</small></span><span class="fsBHStats">${snap?`<b>${t.credit} crédito</b><b>${t.debit} débito</b><b class="${t.priority?'hot':''}">${t.priority} crítico(s)</b>`:'Abrir painel →'}</span></button>`;
  }
  function shell(){
    let m=document.getElementById('fsBHModal');if(m)return m;
    m=document.createElement('div');m.id='fsBHModal';m.className='fsBHModal';m.innerHTML=`<div class="fsBHDialog"><header><div><h2>🗓️ Gestão do banco de horas</h2><p>Análise isolada do ponto. Nenhuma sugestão altera a escala.</p></div><button onclick="fsBHClose()" aria-label="Fechar">×</button></header><main id="fsBHBody"></main></div>`;document.body.appendChild(m);return m;
  }
  function rowHtml(x){const lv=level(x.balance),p=activePeople().find(y=>y.id===x.personId),plan=cfg().plans.filter(y=>y.importId===latest()?.id&&y.rowCode===x.code).slice(-1)[0];return `<tr data-code="${esc(x.code)}"><td><strong>${esc(x.matchedName||x.name)}</strong><small>${esc(p?.funcao||x.role)}</small></td><td>${x.balance>=0?'Crédito':'Débito'}</td><td class="fsBHAmt ${x.balance<0?'neg':'pos'}">${hm(x.balance)}</td><td><span class="fsBHLevel ${lv}">${STATUS[lv]}</span></td><td>✓ Cadastro ativo</td><td>${plan?esc(plan.status):'Sem plano'}</td><td><div class="fsBHRowActions">${plan?`<button onclick="fsBHPlanView('${plan.id}')">Acompanhar</button>`:`<button onclick="fsBHPlan('${esc(x.code)}')">Planejar</button>`}<button class="remove" title="Remover somente deste relatório" onclick="fsBHRemoveRow('${esc(x.code)}')">Excluir</button></div></td></tr>`}
  function renderPanel(){
    const b=document.getElementById('fsBHBody');if(!b)return;const snap=latest(),t=totals(snap),hist=cfg().imports.slice().sort((a,b)=>String(b.importedAt).localeCompare(a.importedAt));
    if(!snap){b.innerHTML=`<section class="fsBHEmpty"><div>📄</div><h3>Importe o Resumo do Banco de Horas</h3><p>O arquivo será lido como uma fotografia do saldo. Uma atualização futura substitui a referência de cálculo, sem somar saldos novamente.</p><label class="fsBHUpload">Selecionar PDF<input type="file" accept="application/pdf,.pdf" onchange="fsBHImport(this)"></label></section>`;return}
    b.innerHTML=`<div class="fsBHToolbar"><div><strong>Referência vigente</strong><span>${esc(snap.periodStart||'?')} a ${esc(snap.periodEnd||'?')} • ${esc(snap.fileName)}</span></div><label class="fsBHUpload">Atualizar PDF<input type="file" accept="application/pdf,.pdf" onchange="fsBHImport(this)"></label></div>
    <section class="fsBHKpis"><div><small>Colaboradores</small><b>${t.all}</b></div><div><small>Saldo credor</small><b>${hm(t.creditMin)}</b></div><div><small>Saldo devedor</small><b>${hm(-t.debitMin)}</b></div><div><small>Casos críticos</small><b>${t.priority}</b></div></section>
    ${t.ignored?`<div class="fsBHWarn">ℹ ${t.ignored} registro(s) do PDF não aparecem porque não existem no cadastro ativo ou foram removidos deste relatório.</div>`:''}
    <section class="fsBHFilters"><input id="fsBHSearch" placeholder="Buscar colaborador ou função" oninput="fsBHFilter()"><select id="fsBHLevelFilter" onchange="fsBHFilter()"><option value="">Todos os níveis</option><option value="normal">Dentro do padrão</option><option value="atencao">Atenção</option><option value="critico">Crítico</option></select></section>
    <div class="fsBHTable"><table><thead><tr><th>Colaborador / função</th><th>Tipo</th><th>Saldo</th><th>Nível</th><th>Cadastro</th><th>Plano</th><th>Ação</th></tr></thead><tbody>${reportRows(snap).map(rowHtml).join('')}</tbody></table></div>
    <details class="fsBHHistory"><summary>Histórico de importações (${hist.length})</summary>${hist.map((x,i)=>`<div><span>${esc(x.periodStart||'?')} a ${esc(x.periodEnd||'?')} • ${esc(x.fileName)}</span><b>${i?'Histórico':'Vigente'}</b></div>`).join('')}</details>
    <div class="fsBHDanger"><button onclick="fsBHClear()">Limpar somente o módulo de banco de horas</button></div>`;
  }
  function filter(){const q=norm(document.getElementById('fsBHSearch')?.value),lv=document.getElementById('fsBHLevelFilter')?.value,snap=latest();document.querySelectorAll('#fsBHBody tbody tr[data-code]').forEach(tr=>{const x=snap?.rows.find(r=>r.code===tr.dataset.code);tr.hidden=!!(x&&(q&&!norm(`${x.name} ${x.matchedName} ${x.role}`).includes(q)||lv&&level(x.balance)!==lv))})}
  function suggestions(x){const n=Math.abs(x.balance),credit=x.balance>0;let per=n>=480?120:n>=180?60:30;per=Math.min(per,cfg().settings.maxExtraDay);return{mode:credit?(n>=480?'folga':'saida_antecipada'):'compensar',per,days:Math.max(1,Math.ceil(n/per))}}
  function addDays(date,count){const d=new Date(`${date}T12:00:00`),out=[];while(out.length<count){d.setDate(d.getDate()+1);if(d.getDay()!==0)out.push(d.toISOString().slice(0,10))}return out}
  function plan(code){
    const snap=latest(),x=snap?.rows.find(r=>r.code===code);if(!x)return;const p=activePeople().find(y=>y.id===x.personId),s=suggestions(x),same=activePeople().filter(y=>y.id!==p?.id&&norm(y.funcao)===norm(p?.funcao)),start=new Date().toISOString().slice(0,10);
    const box=document.createElement('div');box.className='fsBHPlanModal';box.innerHTML=`<div><header><h3>Planejar ajuste — ${esc(p?.nome||x.name)}</h3><button>×</button></header><section><div class="fsBHPlanNote"><b>Saldo ${x.balance>=0?'credor':'devedor'}: ${hm(x.balance)}</b><span>${esc(p?.funcao||'Função não conciliada')} • ${same.length+1} pessoa(s) nesta função</span></div><label>Forma de ajuste<select id="fsBHPMode"><option value="${s.mode}">${s.mode==='folga'?'Folga compensatória':s.mode==='saida_antecipada'?'Saída antecipada':'Compensação diária'}</option>${x.balance>0?'<option value="saida_antecipada">Saída antecipada</option>':'<option value="entrada_antecipada">Entrada antecipada</option><option value="saida_posterior">Saída posterior</option><option value="intervalo">Redução de intervalo (mínimo 1h)</option>'}</select></label><div class="fsBHPlanGrid"><label>Minutos por dia<input id="fsBHPPer" type="number" min="15" max="120" step="15" value="${s.per}"></label><label>Data inicial<input id="fsBHPStart" type="date" value="${start}"></label></div><label>Apoio / substituto<select id="fsBHPSupport"><option value="">Não definido</option>${activePeople().filter(y=>y.id!==p?.id).map(y=>`<option value="${esc(y.id)}">${esc(y.nome)} — ${esc(y.funcao||'Sem função')}</option>`).join('')}</select></label><label>Destino do informativo<select id="fsBHPScope"><option value="individual">Individual</option><option value="setor">Setor / função</option><option value="geral">Geral da filial</option></select></label>${same.length?'':`<div class="fsBHWarn">Esta é uma função única. Para uma folga, informe quem dará apoio antes de aprovar.</div>`}<label>Observação<textarea id="fsBHPNote" placeholder="Orientação adicional para a gestão"></textarea></label></section><footer><button class="secondary">Cancelar</button><button class="primary" onclick="fsBHSavePlan('${esc(code)}')">Salvar plano e gerar informativo</button></footer></div>`;box.querySelector('header button').onclick=box.querySelector('footer .secondary').onclick=()=>box.remove();document.body.appendChild(box);
  }
  function savePlan(code){
    const snap=latest(),x=snap?.rows.find(r=>r.code===code),p=activePeople().find(y=>y.id===x?.personId);if(!x)return;
    const mode=document.getElementById('fsBHPMode').value,per=Math.min(120,Math.max(15,Number(document.getElementById('fsBHPPer').value)||30)),support=document.getElementById('fsBHPSupport').value;
    if(mode==='folga'&&activePeople().filter(y=>y.id!==p?.id&&norm(y.funcao)===norm(p?.funcao)).length===0&&!support)return alert('Informe um apoio para liberar folga de uma função única.');
    const days=mode==='folga'?1:Math.max(1,Math.ceil(Math.abs(x.balance)/per)),dates=addDays(document.getElementById('fsBHPStart').value||new Date().toISOString().slice(0,10),days);
    const plan={id:uid(),importId:snap.id,rowCode:code,personId:x.personId,personName:p?.nome||x.name,role:p?.funcao||x.role,mode,minutesPerDay:per,dates,supportPersonId:support,scope:document.getElementById('fsBHPScope').value,note:document.getElementById('fsBHPNote').value.trim(),status:'Aprovado — aguardando comunicação',createdAt:new Date().toISOString(),balance:x.balance};cfg().plans.push(plan);persist();document.querySelector('.fsBHPlanModal')?.remove();renderPanel();showNotice(plan);
  }
  function noticeText(p){const support=activePeople().find(x=>x.id===p.supportPersonId),action={folga:'folga compensatória',saida_antecipada:'saída antecipada',entrada_antecipada:'entrada antecipada',saida_posterior:'saída posterior',intervalo:'ajuste do intervalo'}[p.mode]||p.mode,dates=p.dates.map(x=>x.split('-').reverse().join('/')).join(', ');return `INFORMATIVO DO PONTO\n\nColaborador(a): ${p.personName}\nFunção: ${p.role||'Não informada'}\nSaldo de referência: ${hm(p.balance)}\nAjuste aprovado: ${action}${p.mode==='folga'?'':` de ${p.minutesPerDay} minuto(s) por dia`}\nData(s): ${dates}\n${support?`Apoio: ${support.nome} — ${support.funcao||'sem função'}\n`:''}${p.note?`Observação: ${p.note}\n`:''}\nO cumprimento será confirmado pela gestão após conferência no ponto oficial.`}
  function showNotice(p){let m=document.getElementById('fsBHNotice');if(!m){m=document.createElement('div');m.id='fsBHNotice';m.className='fsBHPlanModal';document.body.appendChild(m)}m.innerHTML=`<div><header><h3>Informativo pronto</h3><button onclick="this.closest('.fsBHPlanModal').remove()">×</button></header><section><textarea id="fsBHNoticeText" readonly>${esc(noticeText(p))}</textarea></section><footer><button class="secondary" onclick="fsBHCopy('${p.id}')">Copiar texto</button><button class="primary" onclick="fsBHMarkCommunicated('${p.id}')">Marcar como comunicado</button></footer></div>`}
  async function copy(id){const p=cfg().plans.find(x=>x.id===id),text=noticeText(p);try{await navigator.clipboard.writeText(text)}catch(_){const ta=document.getElementById('fsBHNoticeText');ta.select();document.execCommand('copy')}alert('Informativo copiado.')}
  function mark(id){const p=cfg().plans.find(x=>x.id===id);if(p){p.status='Comunicado — aguardando conferência';p.communicatedAt=new Date().toISOString();persist()}document.getElementById('fsBHNotice')?.remove();renderPanel()}
  function planView(id){const p=cfg().plans.find(x=>x.id===id);if(!p)return;showNotice(p);const foot=document.querySelector('#fsBHNotice footer');if(foot)foot.insertAdjacentHTML('afterbegin',`<button class="secondary" onclick="fsBHPlanResult('${p.id}',false)">Não cumprido</button><button class="primary" onclick="fsBHPlanResult('${p.id}',true)">Confirmar cumprido</button>`)}
  function planResult(id,ok){const p=cfg().plans.find(x=>x.id===id);if(!p)return;if(!confirm(ok?'Confirmar que a execução foi conferida no ponto oficial?':'Registrar que o plano não foi cumprido?'))return;p.status=ok?'Cumprido — conferido no ponto':'Não cumprido — revisar';p.checkedAt=new Date().toISOString();persist();document.getElementById('fsBHNotice')?.remove();renderPanel()}
  function removeRow(code){const snap=latest(),x=snap?.rows.find(r=>r.code===code);if(!snap||!x)return;if(!confirm(`Remover ${x.matchedName||x.name} somente deste relatório de banco de horas?\n\nO cadastro do colaborador e as escalas não serão alterados.`))return;snap.excludedCodes=Array.isArray(snap.excludedCodes)?snap.excludedCodes:[];if(!snap.excludedCodes.includes(code))snap.excludedCodes.push(code);persist();renderPanel()}
  function clearAll(){if(!confirm('Limpar somente importações e planos do Banco de Horas? Escalas, colaboradores e demais módulos não serão alterados.'))return;delete state.config[CFG];persist();renderPanel()}
  function open(){shell().classList.add('open');renderPanel()}
  function close(){document.getElementById('fsBHModal')?.classList.remove('open')}
  window.fsBHOpen=open;window.fsBHClose=close;window.fsBHImport=importPdf;window.fsBHFilter=filter;window.fsBHPlan=plan;window.fsBHSavePlan=savePlan;window.fsBHCopy=copy;window.fsBHMarkCommunicated=mark;window.fsBHPlanView=planView;window.fsBHPlanResult=planResult;window.fsBHRemoveRow=removeRow;window.fsBHClear=clearAll;
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(renderHomeCard,80)}).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{cfg();renderHomeCard()},900);
  setInterval(renderHomeCard,750);
})();
