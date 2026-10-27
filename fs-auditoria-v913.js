(function(){
  'use strict';
  if(window.__fsV913Installed)return;
  window.__fsV913Installed=true;

  const DAYS=['segunda','terca','quarta','quinta','sexta'];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const initials=name=>{const p=String(name||'').trim().split(/\s+/).filter(Boolean);return((p[0]?.[0]||'')+(p.length>1?p[1]?.[0]||'':'')).toUpperCase()||'—'};

  /* Uma única identidade visual. O número antigo pode continuar sendo
     reescrito por código legado, mas fica invisível e não remove o avatar. */
  function stabilizeIdentities(){
    document.querySelectorAll('.board .tableWrap tbody tr,.execBoard tbody tr').forEach(row=>{
      const cell=row.querySelector('td.ncol')||row.children[0],nameCell=row.querySelector('td.name');
      if(!cell||!nameCell)return;
      const name=nameCell.textContent?.trim()||'',nameKey=norm(name),person=(state?.pessoas||[]).find(p=>nameKey===norm(p.nome)||nameKey.endsWith(norm(p.nome)));
      cell.classList.add('fsV913Identity');cell.dataset.fsInitials=initials(person?.nome||name);
      if(person?.fsFoto){cell.classList.add('hasPhoto');cell.style.setProperty('--fs-v913-photo',`url("${String(person.fsFoto).replaceAll('"','\\"')}")`)}
      else{cell.classList.remove('hasPhoto');cell.style.removeProperty('--fs-v913-photo')}
      const head=cell.closest('table')?.querySelector('thead th:first-child');if(head&&head.textContent!=='Foto')head.textContent='Foto';
    });
  }

  let ruleDraft=null;
  function cloneRows(day){return(state?.horarios?.[day]||[]).map((h,i)=>({titulo:h.titulo||`Equipe ${String(i+1).padStart(2,'0')}`,entrada:h.entrada||'08:00',almocoIni:h.almocoIni||'12:00',almocoFim:h.almocoFim||'13:00',saida:h.saida||'18:00'}))}
  function selectedRuleKey(){return document.querySelector('#fsV806Rules .fsV806RulesModels button.active')?.dataset?.key||''}
  function ensureDraft(){if(!ruleDraft)ruleDraft={key:selectedRuleKey(),week:cloneRows('segunda'),sat:cloneRows('sabado')};return ruleDraft}
  window.fsV913GetRuleDraft=function(key){const d=ruleDraft;if(!d||!d.week?.length||!d.sat?.length)return null;if(key&&d.key&&key!==d.key)return null;return JSON.parse(JSON.stringify(d))};
  function timeField(group,index,key,label,value){return`<label><span>${label}</span><input type="time" value="${esc(value)}" onchange="fsV913RuleTime('${group}',${index},'${key}',this.value)"></label>`}
  function teamCard(group,row,index){return`<article><b>Equipe ${String(index+1).padStart(2,'0')}</b><div>${timeField(group,index,'entrada','Entrada',row.entrada)}${timeField(group,index,'almocoIni','Início intervalo',row.almocoIni)}${timeField(group,index,'almocoFim','Fim intervalo',row.almocoFim)}${timeField(group,index,'saida','Saída',row.saida)}</div></article>`}
  function decorateSummary(d){
    const root=document.querySelector('#fsV806Rules .fsV821Plan');if(!root||!d)return;
    const mins=h=>{const[a,b]=String(h||'00:00').split(':').map(Number);return(a||0)*60+(b||0)},fmt=n=>`${String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')}h${String(Math.max(0,n)%60).padStart(2,'0')}`;
    const work=h=>Math.max(0,mins(h.saida)-mins(h.entrada)-Math.max(0,mins(h.almocoFim)-mins(h.almocoIni))),key=d.key||selectedRuleKey(),days=(key==='42h-5x2'||key==='distribuido'||key==='atual')?4:5,teams=Math.max(d.week.length,d.sat.length);
    const totals=Array.from({length:teams},(_,i)=>days*work(d.week[i]||d.week[0])+work(d.sat[i]||d.sat[0]));
    const title=root.querySelector('.fsV821PlanTitle b');if(title)title.textContent=`Quadro editável • ${totals.map((n,i)=>`Equipe ${String(i+1).padStart(2,'0')}: ${fmt(n)} semanais`).join(' • ')}`;
    const info=root.querySelector('.fsV822Breaks');if(info)info.innerHTML=`<div><b>Intervalos definidos por equipe</b><span>O resumo e a validação usam exatamente os horários do quadro editável abaixo.</span></div><div>${d.week.map((h,i)=>`<button type="button" class="active" disabled>Equipe ${String(i+1).padStart(2,'0')} • ${fmt(Math.max(0,mins(h.almocoFim)-mins(h.almocoIni)))}</button>`).join('')}</div>`;
    const loads=root.querySelectorAll('td[data-label="Carga efetiva"]');if(loads[0])loads[0].textContent=d.week.map((h,i)=>`Eq. ${String(i+1).padStart(2,'0')}: ${fmt(work(h))}`).join(' • ');if(loads[1])loads[1].textContent=d.sat.map((h,i)=>`Eq. ${String(i+1).padStart(2,'0')}: ${fmt(work(h))}`).join(' • ');
  }
  function injectRuleEditor(){
    const detail=document.querySelector('#fsV806Rules .fsV806RulesDetail'),plan=detail?.querySelector('.fsV821Plan');if(!detail||!plan)return;
    let box=detail.querySelector('.fsV913TeamEditor');if(box)return;
    const d=ensureDraft();box=document.createElement('section');box.className='fsV913TeamEditor';
    box.innerHTML=`<header><div><b>Horários editáveis das equipes</b><span>Estes são os horários atualmente configurados. Ajuste cada equipe sem alterar a abertura oficial da filial.</span></div></header><h4>Segunda a sexta</h4><div class="fsV913Teams">${d.week.map((x,i)=>teamCard('week',x,i)).join('')}</div><h4>Sábado</h4><div class="fsV913Teams">${d.sat.map((x,i)=>teamCard('sat',x,i)).join('')}</div><footer><span>Entrada, intervalo e saída são independentes por equipe.</span><button type="button" onclick="fsV913ApplyRuleTimes()">Salvar horários das equipes</button></footer>`;
    plan.insertAdjacentElement('afterend',box);
    decorateSummary(d);
  }
  function refreshRuleModel(){const key=selectedRuleKey();if(key&&typeof window.fsV913RefreshRuleModel==='function')window.fsV913RefreshRuleModel(key)}
  window.fsV913RuleTime=function(group,index,key,value){if(!/^\d{2}:\d{2}$/.test(value))return;const d=ensureDraft();d.key=selectedRuleKey()||d.key;if(d[group]?.[index])d[group][index][key]=value;refreshRuleModel()};
  window.fsV913ApplyRuleTimes=function(){
    const d=ensureDraft();if(!d.week.length||!d.sat.length)return alert('Nenhuma equipe foi localizada para salvar.');
    const mins=h=>{const [a,b]=String(h||'00:00').split(':').map(Number);return(a||0)*60+(b||0)};
    const invalid=[...d.week,...d.sat].some(h=>h.entrada>=h.saida||h.almocoIni>h.almocoFim||h.almocoIni<h.entrada||h.almocoFim>h.saida||((mins(h.saida)-mins(h.entrada)-Math.max(0,mins(h.almocoFim)-mins(h.almocoIni)))>360&&(mins(h.almocoFim)-mins(h.almocoIni))<60));
    if(invalid)return alert('Revise os horários: entrada, intervalo e saída precisam seguir a ordem correta. Em jornadas acima de 6 horas, o intervalo configurado deve ter no mínimo 1 hora.');
    state.horarios=state.horarios||{};state.config=state.config||{};state.config.equipesDia=state.config.equipesDia||{};
    DAYS.forEach(day=>{state.horarios[day]=JSON.parse(JSON.stringify(d.week));state.config.equipesDia[day]=d.week.length});
    state.horarios.sabado=JSON.parse(JSON.stringify(d.sat));state.config.equipesDia.sabado=d.sat.length;
    try{save()}catch(e){return alert('Não foi possível salvar os horários: '+(e?.message||e))}
    d.key=selectedRuleKey()||d.key;refreshRuleModel();
    const t=typeof toast==='function'?toast:null;t&&t('Horários das equipes salvos. Configurações e Regras agora usam o mesmo padrão.');
  };

  /* A cadeia antiga continua preservando todos os campos, mas save/render são
     agrupados em uma única operação. Isso impede reconstruções concorrentes. */
  function installStableSave(){
    const old=window.salvarPessoaModal;if(typeof old!=='function'||old.__fsV913)return;
    const actualSave=window.save,actualRender=window.render;
    let busy=false;
    const stable=function(){
      if(busy)return false;busy=true;window.__fsSalvando535=false;
      const button=document.querySelector('#pessoaModal button.primary[onclick*="salvarPessoaModal"]');if(button){button.disabled=true;button.dataset.fsOldText=button.textContent;button.textContent='Salvando…'}
      let wantsSave=false,wantsRender=false,result;
      const saveGate=function(){wantsSave=true},renderGate=function(){wantsRender=true};
      window.save=saveGate;window.render=renderGate;try{save=saveGate;render=renderGate}catch(_){ }
      try{result=old.apply(this,arguments);wantsSave=true;wantsRender=true}catch(error){console.error('Falha ao salvar colaborador',error);alert('Não foi possível concluir o salvamento. Os dados da tela foram preservados para nova tentativa.');}
      const finish=()=>{
        window.save=actualSave;window.render=actualRender;try{save=actualSave;render=actualRender}catch(_){ }
        try{if(wantsSave&&typeof actualSave==='function')actualSave()}catch(e){console.error(e)}
        try{if(wantsRender&&typeof actualRender==='function')actualRender()}catch(e){console.error(e)}
        busy=false;window.__fsSalvando535=false;window.__fsBloquearRenderAte=0;
        document.querySelectorAll('#fsV903SundayBusy,.fsGlobalLoading,.fsLoadingOverlay').forEach(x=>x.remove());document.body.classList.remove('fsV903SundayLocked');
        if(button){button.disabled=false;button.textContent=button.dataset.fsOldText||'Salvar';delete button.dataset.fsOldText}
      };
      setTimeout(finish,420);setTimeout(()=>{if(busy)finish()},3500);return result;
    };
    ['__fsV913','__fsV824','__fsV808','__fsV858','__fsV609','__fsV562','__fsV911ApprenticeAuto','__fs535'].forEach(k=>stable[k]=true);
    window.salvarPessoaModal=stable;try{salvarPessoaModal=stable}catch(_){ }
  }

  function audit(){stabilizeIdentities();injectRuleEditor();installStableSave()}
  let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(audit,35)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('#fsBotaoRegrasConfigFixo,.fsV806RulesModels button')){ruleDraft=null;setTimeout(audit,50)}},true);
  setTimeout(audit,1600);setInterval(()=>{installStableSave();stabilizeIdentities()},1600);
})();
