/* V895 — Simulador executivo regional de transição. Somente leitura. */
(function(){
  'use strict';
  const KEY='fsScenarioRulesV895',ALLOWED=new Set(['developer','global_admin','regional_admin']);
  let details=new Map(),loading=false,observerTimer=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v||0),pad=n=>String(Math.max(0,Math.round(n))).padStart(2,'0');
  const mins=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN};
  const clock=m=>Number.isFinite(m)?`${pad(Math.floor((m+1440)%1440/60))}:${pad((m+1440)%1440%60)}`:'—';
  const duration=m=>{m=Math.max(0,Math.round(num(m)));return`${pad(Math.floor(m/60))}h${pad(m%60)}`};
  const parse=x=>{try{return typeof x==='string'?JSON.parse(x):x||{}}catch(_){return{}}};
  const dashboard=()=>window.fsDashGetData?.()||null;
  const saved=()=>{try{return Object.assign({target:42,maxDay:540,weekBreak:60,satBreak:15,teams:2},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){return{target:42,maxDay:540,weekBreak:60,satBreak:15,teams:2}}};

  function eligible(){const d=dashboard(),role=d?.context?.role;return!!(d&&ALLOWED.has(role)&&(document.getElementById('fsDashRoot')||document.getElementById('fsRegionalRoot')))}
  function launcher(){
    let b=document.getElementById('fsSimLauncher');
    if(!eligible()){if(!document.getElementById('fsDashRoot')&&!document.getElementById('fsRegionalRoot'))b?.remove();return}
    if(!document.getElementById('fsSimPeopleStyle')){const s=document.createElement('style');s.id='fsSimPeopleStyle';s.textContent='.fsSimPeople{display:grid;gap:4px;border-top:1px solid #e6edf5;padding:7px}.fsSimPeople p{display:grid;grid-template-columns:62px 1fr;gap:6px;margin:0;color:#5d7088;font-size:7px;line-height:1.35}.fsSimPeople b{color:#20477d}';document.head.appendChild(s)}
    if(b)return;
    b=document.createElement('button');b.id='fsSimLauncher';b.type='button';b.className='fsSimLauncher noPrint';b.innerHTML='<span>⇄</span><b>Simular</b>';b.title='Simulador regional de transição da jornada';b.onclick=open;document.body.appendChild(b);
  }

  function extract(raw,branch){
    if(!raw?.ok||raw.empty||!raw.payload)return{branch,error:raw?.message||'Filial sem versão publicada'};
    const pack=parse(raw.payload),storage=pack.storage||pack;
    const state=parse(storage.fs_escala_limpa_v381||storage.FS_ESCALA_OPERACIONAL_STATE||storage.FS_ESCALA_STATE||storage.fs_state||storage.state);
    const company=parse(storage.fsDadosEmpresa),hours=Object.assign({},company,state?.config?.funcionamentoUnidade||{});
    const required=['horarioSemanaEntrada','horarioSemanaSaida','horarioSabadoEntrada','horarioSabadoSaida'];
    if(required.some(k=>!/^\d{1,2}:\d{2}$/.test(String(hours[k]||''))))return{branch,error:'Horários de funcionamento não publicados'};
    return{branch,state,hours,version:raw.version||branch.version||0,updatedAt:raw.updatedAt||branch.lastActivity||'',employees:Array.isArray(state?.pessoas)?state.pessoas.length:num(branch.summary?.employees),weekly:num(state?.cargaMeta||branch.summary?.weeklyHours)};
  }
  async function fetchOne(branch){try{return extract(await window.fsDashJsonp('read',{branchId:branch.id},30000),branch)}catch(e){return{branch,error:e?.message||'Falha ao consultar a filial'}}}
  async function loadAll(force){
    const data=dashboard(),branches=data?.branches||[];if(loading)return;if(!force&&details.size===branches.length&&branches.length)return renderResults();
    loading=true;details=new Map();progress(0,branches.length);
    let cursor=0,done=0;
    async function worker(){while(cursor<branches.length){const item=branches[cursor++],value=await fetchOne(item);details.set(String(item.id),value);progress(++done,branches.length)}}
    await Promise.all(Array.from({length:Math.min(4,Math.max(1,branches.length))},worker));loading=false;renderResults();
  }

  function values(){const f=document.getElementById('fsSimControls');if(!f)return saved();return{target:num(f.target.value),maxDay:num(f.maxDay.value),weekBreak:num(f.weekBreak.value),satBreak:num(f.satBreak.value),teams:num(f.teams.value)}}
  function calc(item,v){
    if(item.error)return{level:'nodata',label:'Sem dados',title:item.error};
    const h=item.hours,wo=mins(h.horarioSemanaEntrada),wc=mins(h.horarioSemanaSaida),so=mins(h.horarioSabadoEntrada),sc=mins(h.horarioSabadoSaida),target=v.target*60;
    const weekWindow=Math.max(0,wc-wo),satWindow=Math.max(0,sc-so),weekCapacity=Math.max(0,weekWindow-v.weekBreak),satCapacity=Math.max(0,satWindow-v.satBreak);
    const weekUsable=Math.min(v.maxDay,weekCapacity),satUsable=Math.min(v.maxDay,satCapacity),current=4*weekUsable+satUsable,structural=target>v.maxDay*5;
    let level='ok',label='Atende',title='A janela atual comporta o cenário selecionado.';
    if(structural){level='blocked';label='Incompatível';title=`${v.target}h em cinco dias não cabem no teto de ${duration(v.maxDay)} por dia.`}
    else if(current<target){level='pending';label='Ajuste necessário';title=`Faltam ${duration(target-current)} de capacidade semanal.`}
    const satRequired=Math.max(0,target-4*weekUsable),weekRequired=Math.max(0,(target-satUsable)/4);
    const recSatClose=so+satRequired+v.satBreak,recWeekClose=wo+weekRequired+v.weekBreak,recWeekOpen=wc-weekRequired-v.weekBreak;
    const satWorks=satRequired<=v.maxDay,weekWorks=weekRequired<=v.maxDay;
    let exactWeek=weekRequired,exactSat=satUsable;
    if(exactWeek>v.maxDay||exactWeek>weekCapacity){exactWeek=Math.min(v.maxDay,weekCapacity);exactSat=Math.max(0,target-4*exactWeek)}
    if(exactSat>v.maxDay){exactSat=v.maxDay;exactWeek=Math.max(0,(target-exactSat)/4)}
    const adjustedWeekClose=Math.max(wc,wo+exactWeek+v.weekBreak),adjustedSatClose=Math.max(sc,so+exactSat+v.satBreak);
    return{level,label,title,wo,wc,so,sc,weekWindow,satWindow,weekCapacity,satCapacity,current,target,structural,satRequired,weekRequired,recSatClose,recWeekClose,recWeekOpen,satWorks,weekWorks,exactWeek,exactSat,adjustedWeekClose,adjustedSatClose};
  }
  function shifts(open,close,work,breakMin,teams){
    if(!Number.isFinite(open)||!Number.isFinite(close)||work<=0)return[];
    const presence=work+breakMin,count=Math.max(1,teams),first=open,last=Math.max(open,close-presence),step=count>1?(last-first)/(count-1):0;
    return Array.from({length:count},(_,i)=>{const start=Math.round(first+step*i),end=start+presence,breakStart=start+Math.max(120,Math.round(work*.42)),breakEnd=breakStart+breakMin;return{team:i+1,start,end,breakStart,breakEnd,work}});
  }
  function recommendation(c,v){
    if(c.level==='nodata')return'Publicar ou atualizar os dados da filial para liberar o diagnóstico.';
    if(c.structural)return`Rever a regra escolhida: o máximo matemático é ${duration(v.maxDay*5)} semanais.`;
    if(c.level==='ok')return v.teams>1?`Cenário viável; organizar ${v.teams} equipes para preservar abertura e fechamento.`:'Cenário viável; validar a cobertura das funções com equipe única.';
    const options=[];
    if(c.satWorks)options.push(`sábado até ${clock(c.recSatClose)} (${duration(c.satRequired)} efetivas)`);
    if(c.weekWorks){options.push(`dias úteis até ${clock(c.recWeekClose)}, preservando a abertura`);options.push(`ou abrir às ${clock(c.recWeekOpen)}, preservando o fechamento`)}
    return options.length?'Alternativas: '+options.join('; ')+'.':'O cenário exige rever jornada, teto diário ou regra coletiva.';
  }
  function projectedPeople(item,v){
    const people=(item.state?.pessoas||[]).filter(p=>p&&!p.desligado),groups={};people.forEach(p=>{const role=String(p.funcao||p.cargo||'Sem função').trim()||'Sem função';(groups[role]=groups[role]||[]).push(p)});
    const teams=Array.from({length:Math.max(1,v.teams)},()=>[]);let offset=0;Object.keys(groups).sort().forEach(role=>{groups[role].sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR')).forEach((p,i)=>teams[(i+offset)%teams.length].push(p));offset=(offset+groups[role].length)%teams.length});
    if(!people.length)return'';
    return`<div class="fsSimPeople">${teams.map((list,i)=>`<p><b>Equipe ${String(i+1).padStart(2,'0')}</b><span>${list.map(p=>esc(p.nome||'Sem nome')).join(' • ')||'Sem colaborador projetado'}</span></p>`).join('')}</div>`;
  }
  function shiftsHtml(c,v,item){
    if(c.structural||c.level==='nodata')return'';
    const week=shifts(c.wo,c.adjustedWeekClose,c.exactWeek,v.weekBreak,v.teams),sat=shifts(c.so,c.adjustedSatClose,c.exactSat,v.satBreak,v.teams);
    const rows=(list,label)=>list.map(x=>`<tr><td>${label} • Equipe ${String(x.team).padStart(2,'0')}</td><td>${clock(x.start)}</td><td>${clock(x.breakStart)}–${clock(x.breakEnd)}</td><td>${clock(x.end)}</td><td>${duration(x.work)}</td></tr>`).join('');
    return`<details class="fsSimSchedule"><summary>Ver horários e colaboradores projetados</summary><table><thead><tr><th>Período</th><th>Entrada</th><th>Intervalo</th><th>Saída</th><th>Efetivas</th></tr></thead><tbody>${rows(week,'Seg–sex')}${rows(sat,'Sábado')}</tbody></table>${projectedPeople(item,v)}</details>`;
  }
  function branchCard(item,v){
    const c=calc(item,v),b=item.branch,h=item.hours||{},updated=item.updatedAt?new Date(item.updatedAt).toLocaleString('pt-BR'):'—';
    return`<article class="fsSimBranch ${c.level}"><header><div><small>${esc(b.summary?.city||'FILIAL')}</small><h4>${esc(b.name)}</h4></div><mark>${esc(c.label)}</mark></header><div class="fsSimHours"><span><small>SEGUNDA A SEXTA</small><b>${h.horarioSemanaEntrada||'—'}–${h.horarioSemanaSaida||'—'}</b></span><span><small>SÁBADO</small><b>${h.horarioSabadoEntrada||'—'}–${h.horarioSabadoSaida||'—'}</b></span><span><small>PUBLICAÇÃO</small><b>v${item.version||b.version||'—'}</b></span></div><p class="fsSimDiagnosis"><b>${esc(c.title)}</b><span>${esc(recommendation(c,v))}</span></p>${shiftsHtml(c,v,item)}<footer><span>${item.employees||b.summary?.employees||0} colaborador(es)</span><span>Atualizado: ${esc(updated)}</span></footer></article>`;
  }
  function regionsHtml(data,v){
    const listed=(data.regions||[]).slice().sort((a,b)=>num(a.order)-num(b.order)),known=new Set(listed.map(r=>String(r.id))),regions=listed.concat((data.branches||[]).some(b=>!known.has(String(b.regionId)))?[{id:'',name:'Sem regional definida',order:999}]:[]);
    return regions.map((r,i)=>{const bs=(data.branches||[]).filter(b=>String(b.regionId||'')===String(r.id||'')),cards=bs.map(b=>branchCard(details.get(String(b.id))||{branch:b,error:'Carregando dados publicados…'},v)).join('');return`<section class="fsSimRegion" style="--region:${i}"><header><div><small>REGIONAL ${String(i+1).padStart(2,'0')}</small><h3>${esc(r.name)}</h3></div><b>${bs.length} filial(is)</b></header><div>${cards||'<p class="fsSimEmpty">Nenhuma filial vinculada a esta regional.</p>'}</div></section>`}).join('')
  }
  function summaryHtml(data,v){
    const items=(data.branches||[]).map(b=>calc(details.get(String(b.id))||{branch:b,error:'Carregando dados publicados…'},v)),count=k=>items.filter(x=>x.level===k).length;
    return`<section class="fsSimSummary"><article><small>FILIAIS ANALISADAS</small><b>${items.length}</b></article><article class="ok"><small>ATENDEM</small><b>${count('ok')}</b></article><article class="pending"><small>EXIGEM AJUSTE</small><b>${count('pending')}</b></article><article class="blocked"><small>INCOMPATÍVEIS</small><b>${count('blocked')}</b></article><article class="nodata"><small>SEM DADOS</small><b>${count('nodata')}</b></article></section>`
  }
  function renderResults(){const data=dashboard(),root=document.getElementById('fsSimResults');if(!data||!root)return;const v=values();root.innerHTML=summaryHtml(data,v)+`<div class="fsSimRegions">${regionsHtml(data,v)}</div>`}
  function progress(done,total){const x=document.getElementById('fsSimProgress');if(!x)return;x.hidden=done>=total&&total>0;x.querySelector('b').textContent=`Consultando versões publicadas: ${done}/${total}`;x.querySelector('i').style.width=(total?done*100/total:0)+'%'}
  function controls(v){return`<form id="fsSimControls" class="fsSimControls"><label>Jornada semanal<select name="target"><option value="42" ${v.target===42?'selected':''}>5×2 • 42h</option><option value="40" ${v.target===40?'selected':''}>5×2 • 40h</option></select></label><label>Teto efetivo diário<select name="maxDay"><option value="480" ${v.maxDay===480?'selected':''}>08h00</option><option value="504" ${v.maxDay===504?'selected':''}>08h24</option><option value="540" ${v.maxDay===540?'selected':''}>09h00</option></select></label><label>Intervalo seg–sex<select name="weekBreak"><option value="60" ${v.weekBreak===60?'selected':''}>01h00</option><option value="90" ${v.weekBreak===90?'selected':''}>01h30</option><option value="120" ${v.weekBreak===120?'selected':''}>02h00</option></select></label><label>Pausa sábado<select name="satBreak"><option value="15" ${v.satBreak===15?'selected':''}>00h15</option><option value="60" ${v.satBreak===60?'selected':''}>01h00</option></select></label><label>Equipes projetadas<select name="teams">${[1,2,3].map(n=>`<option value="${n}" ${v.teams===n?'selected':''}>${n} equipe(s)</option>`).join('')}</select></label></form>`}
  function modal(){
    let m=document.getElementById('fsSimModal');if(m)return m;const v=saved();m=document.createElement('div');m.id='fsSimModal';m.className='fsSimModal';m.hidden=true;m.innerHTML=`<section class="fsSimExecutive"><header><div><small>INTELIGÊNCIA DE JORNADAS</small><h2>Simulador regional de transição</h2><p>Compare todas as filiais por regional usando somente as versões publicadas na nuvem.</p></div><button data-close>×</button></header><div class="fsSimToolbar">${controls(v)}<div><button data-refresh>↻ Atualizar</button><button data-print>⇩ Imprimir estudo</button></div></div><div id="fsSimProgress" class="fsSimProgress"><b>Preparando consulta…</b><span><i></i></span></div><main id="fsSimResults"></main><footer><p><b>Estudo gerencial:</b> nenhuma escala é alterada. A aplicação ocorrerá somente depois da validação e do ajuste individual de cada filial.</p><button data-close>Fechar</button></footer></section>`;document.body.appendChild(m);
    m.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>m.hidden=true);m.addEventListener('click',e=>{if(e.target===m)m.hidden=true});
    const f=m.querySelector('#fsSimControls'),change=()=>{localStorage.setItem(KEY,JSON.stringify(values()));renderResults()};f.onchange=change;f.oninput=change;
    m.querySelector('[data-refresh]').onclick=()=>loadAll(true);m.querySelector('[data-print]').onclick=()=>window.print();return m;
  }
  function open(){if(!eligible())return;const m=modal();m.hidden=false;details.clear();renderResults();loadAll(true)}
  function mount(){launcher()}
  window.fsSimuladorTransicaoOpen=open;
  new MutationObserver(()=>{clearTimeout(observerTimer);observerTimer=setTimeout(mount,120)}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,600));setTimeout(mount,900);
})();
