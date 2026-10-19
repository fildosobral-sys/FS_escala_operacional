/* FS Escala: perfil independente de 42 horas. Sem efeitos sobre nuvem ou leitor PDF. */
(function(){'use strict';
const DAYS=['segunda','terca','quarta','quinta','sexta','sabado'], WEEK=DAYS.slice(0,5), FOLGAS=['terca','quarta','quinta'];
const copy=x=>JSON.parse(JSON.stringify(x));
const mins=s=>{const m=String(s||'00:00').split(':').map(Number);return(m[0]||0)*60+(m[1]||0)};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const active=()=>typeof state!=='undefined'&&state?.config?.modo==='42h';
function snapshot(){const c=state.config;c.perfisEscala=c.perfisEscala||{};c.perfisEscala['42h']={modo:'42h',cargaMeta:42,fs42Tipo:c.fs42Tipo||'6x1',horarios:copy(state.horarios),equipesDia:copy(c.equipesDia),pessoas:Object.fromEntries((state.pessoas||[]).map(p=>[p.id,{horariosIndividuais:copy(p.horariosIndividuais||{}),diasAtivosIndividuais:copy(p.diasAtivosIndividuais||[]),usarDiasIndividuais:!!p.usarDiasIndividuais,sabadoSim:!!p.sabadoSim,equipeBase:p.equipeBase,slots:copy(p.slots||{}),fs42AutoGerado:!!p.fs42AutoGerado,folgaDistribuida:p.folgaDistribuida}]))};}
function configUI(){const root=document.getElementById('configContent');if(!root||typeof state==='undefined')return;const sel=root.querySelector('select[onchange*="fsAlterarModoEscala"]');if(!sel)return;
const c=state.config;[['atual','Folga semanal + sábado — 40h'],['distribuido','Folga distribuída — 40h'],['6x1','Jornada padrão 6×1 — 44h'],['42h','Jornada flexível — 42h']].forEach(([v,t])=>{let e=Array.from(sel.options).find(o=>o.value===v);if(!e){e=document.createElement('option');e.value=v;sel.appendChild(e)}e.textContent=t});sel.value=c.modo;
let panel=root.querySelector('#fs42Options');if(!panel){panel=document.createElement('div');panel.id='fs42Options';panel.style.cssText='padding:15px;border:1px solid #cad7ef;border-radius:14px;margin:12px 0;background:#f6f9ff';(root.querySelector('.strategyGrid')||sel.parentElement).after(panel)}
panel.hidden=!active();panel.style.display=active()?'block':'none';if(active()){panel.innerHTML='<b>Distribuição da jornada de 42h</b><div style="display:flex;gap:22px;margin:12px 0;flex-wrap:wrap"><label style="display:inline-flex;align-items:center;gap:7px"><input style="width:auto" type="radio" name="fs42type" value="6x1" '+(c.fs42Tipo!=='5x2'?'checked':'')+'> 6×1</label><label style="display:inline-flex;align-items:center;gap:7px"><input style="width:auto" type="radio" name="fs42type" value="5x2" '+(c.fs42Tipo==='5x2'?'checked':'')+'> 5×2</label></div><p id="fs42Description" style="margin:6px 0">'+(c.fs42Tipo==='5x2'?'Folga geral no domingo e segunda folga distribuída entre terça, quarta e quinta. Sábado em operação, como na folga distribuída de 40h.':'Segunda a sábado, com domingo de folga e pelo menos quatro horas efetivas no sábado.')+'</p><strong>Jornada semanal: 42 horas</strong><p style="margin:7px 0 0">A seleção prepara a configuração. A distribuição só acontece após clicar em Gerar distribuição inteligente.</p>';
panel.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{c.fs42Tipo=i.value;snapshot();save();render();configUI();integrar42()}));}
const strategy=root.querySelector('.strategyBox');if(strategy&&!strategy.querySelector('.fsPerfilBanner')){const el=document.createElement('div');el.className='fsPerfilBanner';strategy.prepend(el)}const banner=root.querySelector('.fsPerfilBanner');if(banner){if(!banner.querySelector('b'))banner.innerHTML='<b></b><small>Horários gerais e ajustes do modelo são preservados separadamente.</small>';const title=banner.querySelector('b');if(title)title.textContent=active()?'Perfil ativo: '+(c.fs42Tipo==='5x2'?'5×2':'6×1')+' — jornada flexível (42h)':('Perfil ativo: '+(c.modo==='6x1'?'6×1 — padrão (44h)':c.modo==='distribuido'?'Folga distribuída (40h)':'Dia especial + sábado (40h)'));}
const grid=root.querySelector('.strategyGrid');if(grid){Array.from(grid.children).slice(1,3).forEach(e=>e.style.display=active()?'none':'');}if(grid&&active()){const note=grid.nextElementSibling;if(note?.classList.contains('note'))note.textContent='Jornada flexível de 42h: selecione 6×1 ou 5×2. O sistema só redistribui colaboradores após a confirmação em Gerar distribuição inteligente.'} }
function change(mode){if(mode!=='42h'){if(active()){snapshot();const before=state.config.fs42BeforeProfile;if(before){state.horarios=copy(before.horarios);state.config.equipesDia=copy(before.equipesDia);(state.pessoas||[]).forEach(p=>{if(before.pessoas[p.id])Object.assign(p,copy(before.pessoas[p.id]))})}state.config.modo=state.config.fs42Anterior||'6x1';state.cargaMeta=state.config.modo==='6x1'?44:40;}if(mode===state.config.modo){save();renderConfig();configUI();return}return window.fs42LegacyChange(mode)}if(active())return;const c=state.config;const previous=c.modo;const existing=c.perfisEscala?.['42h'];
// Guardar o perfil anterior por meio do gerenciador legado: a transição de volta
// ao mesmo modo não altera pessoas e não destrói o perfil anterior.
c.fs42Anterior=previous;c.fs42BeforeProfile={horarios:copy(state.horarios),equipesDia:copy(c.equipesDia),pessoas:Object.fromEntries((state.pessoas||[]).map(p=>[p.id,{horariosIndividuais:copy(p.horariosIndividuais||{}),diasAtivosIndividuais:copy(p.diasAtivosIndividuais||[]),usarDiasIndividuais:!!p.usarDiasIndividuais,sabadoSim:!!p.sabadoSim,equipeBase:p.equipeBase,slots:copy(p.slots||{})}]))};if(existing){state.horarios=copy(existing.horarios||state.horarios);c.equipesDia=copy(existing.equipesDia||c.equipesDia);c.fs42Tipo=existing.fs42Tipo||c.fs42Tipo||'6x1';(state.pessoas||[]).forEach(p=>{if(existing.pessoas?.[p.id])Object.assign(p,copy(existing.pessoas[p.id]))})}
c.modo='42h';c.fs42Tipo=c.fs42Tipo||'6x1';state.cargaMeta=42;snapshot();save();renderConfig();configUI();integrar42();document.getElementById('tituloCarga')&&(document.getElementById('tituloCarga').textContent='42H')}
window.fs42Activate=()=>change('42h');
function limits(d){const e=Object.assign({},window.fsGetDadosEmpresa?.()||{},state.config.funcionamentoUnidade||{});const sat=d==='sabado';return{open:mins(sat?e.horarioSabadoEntrada||'08:00':e.horarioSemanaEntrada||'08:00'),close:mins(sat?e.horarioSabadoSaida||'14:00':e.horarioSemanaSaida||'18:00')}}
function target(p,d,minutes){
 const lim=limits(d),width=lim.close-lim.open;
 if(width<minutes)return null;
 const old=p.horariosIndividuais?.[d]||state.horarios?.[d]?.[p.slots?.[d]||p.equipeBase||0]||{};
 // Respeitar os limites da unidade: primeiro tentar preservar entrada e saída do turno.
 const oldStart=mins(old.entrada||clock(lim.open)),oldEnd=mins(old.saida||clock(lim.close));
 const fixedStart=Math.max(lim.open,oldStart),fixedEnd=Math.min(lim.close,oldEnd);
 let start=fixedStart,end=fixedEnd,pause=end-start-minutes;
 if(pause<0||pause>120){
   // Uma jornada inviável não pode ser 'corrigida' encurtando silenciosamente o expediente.
   return null;
 }
 const a=mins(old.almocoIni||'00:00');
 const lunch=Math.max(start+Math.floor(minutes/3),Math.min(a||start+Math.floor(minutes/2),end-pause));
 return {ativo:true,entrada:clock(start),almocoIni:clock(lunch),almocoFim:clock(lunch+pause),saida:clock(end)};
}
function distribuirFolgas42(people){
 // Mesmo princípio da folga distribuída de 40h: balancear por função e por dia.
 const roles={};people.forEach(p=>(roles[p.funcao||'Sem função']??=[]).push(p));
 Object.values(roles).forEach(group=>group.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR')).forEach((p,i)=>{p.folgaDistribuida=FOLGAS[i%3]}));
}
function generate(){
 if(!active())return window.fs42LegacyGenerate();
 const c=state.config,type=c.fs42Tipo||'6x1',people=state.pessoas||[],errors=[];
 const roles={};people.forEach(p=>(roles[p.funcao||'Sem função']??=[]).push(p));
 let changed=0;
 const hasPdf=people.some(p=>p.fsPdfImportado&&!p.fs42AutoGerado);
 const allowPdf=hasPdf&&confirm('Existem horários importados do PDF. Deseja permitir a redistribuição automática desses horários?\n\nCancelar mantém os horários individuais importados.');
 if(type==='5x2')distribuirFolgas42(people.filter(p=>!p.fs42ManualLock));
 Object.values(roles).forEach(group=>group.forEach((p,index)=>{
  if(p.jovemAprendiz)return;
  const locked=p.fs42ManualLock===true||(p.usarDiasIndividuais===true&&!p.fs42AutoGerado)||(Object.values(p.horariosIndividuais||{}).some(h=>h?.ativo)&&!p.fs42AutoGerado);
  if(locked&&!(p.fsPdfImportado&&allowPdf&&!p.fs42ManualLock))return;
  const days=type==='6x1'?[...DAYS]:DAYS.filter(d=>d!==p.folgaDistribuida);
  const satWindow=limits('sabado').close-limits('sabado').open;
  if(satWindow<240){errors.push(p.nome+': sábado tem menos de 4h disponíveis');return}
  // A carga do sábado segue o horário real da filial/PDF, não o modelo de 40h.
  const existingSat=p.horariosIndividuais?.sabado||state.horarios?.sabado?.[p.equipeBase||0]||{};
  const existingSatMinutes=existingSat.entrada&&existingSat.saida?mins(existingSat.saida)-mins(existingSat.entrada)-Math.max(0,mins(existingSat.almocoFim)-mins(existingSat.almocoIni)):satWindow;
  const satMinutes=Math.max(240,Math.min(satWindow,existingSatMinutes));
  const weekdays=days.filter(d=>d!=='sabado');const remaining=2520-satMinutes;
  const base=Math.floor(remaining/weekdays.length),rest=remaining%weekdays.length,computed={};
  weekdays.forEach((d,i)=>{computed[d]=target(p,d,base+(i<rest?1:0));if(!computed[d])errors.push(p.nome+': não é possível fechar 42h mantendo entrada/saída e intervalo máximo de 2h em '+d)});
  computed.sabado=target(p,'sabado',satMinutes);
  if(!computed.sabado)errors.push(p.nome+': horário do sábado incompatível com 42h');
  if(Object.values(computed).some(v=>!v))return;
  p.usarDiasIndividuais=true;p.fs42AutoGerado=true;p.diasAtivosIndividuais=days;
  p.horariosIndividuais={...p.horariosIndividuais,...computed};
  p.sabadoSim=true;p.equipeBase=index%Math.max(1,c.equipesDia?.segunda||1);changed++;
 }));
 snapshot();save();render();configUI();
 alert((errors.length?'Há horários que precisam de ajuste manual: '+errors.slice(0,5).join('; '):'Distribuição de 42h concluída.')+' Colaboradores atualizados: '+changed+'.');
}
function integrar42(){
 if(active()&&!window.fs42DisplayInstalled){
   const originalWorking=window.workingOn;
   const work=function(p,d){if(active()&&state.config.fs42Tipo==='5x2')return d!=='domingo'&&d!==(p.folgaDistribuida||'terca')&&(p.usarDiasIndividuais&&p.fs42AutoGerado? p.diasAtivosIndividuais.includes(d):true);return originalWorking(p,d)};
   window.workingOn=work;try{workingOn=work}catch(e){}
   const originalOperation=window.operacaoDia;
   const operation=function(d){if(active()){
     if(state.config.fs42Tipo==='6x1')return '100% operação';
     const total=state.pessoas?.length||0;
     return total?Math.round(100*(state.pessoas||[]).filter(p=>work(p,d)).length/total)+'% operação':'0% operação';
   }return originalOperation(d)};
   window.operacaoDia=operation;try{operacaoDia=operation}catch(e){}
   window.fs42DisplayInstalled=true;
 }

 if(!active())return;
 const tipo=state.config.fs42Tipo||'6x1';state.cargaMeta=42;
 const descricao='JORNADA FLEXÍVEL — 42 HORAS ('+tipo.toUpperCase()+')';
 const cv=window.cronoModeLabel;if(typeof cv==='function'&&!cv.__fs42){const fn=function(){return active()?descricao:cv.apply(this,arguments)};fn.__fs42=true;window.cronoModeLabel=fn;try{cronoModeLabel=fn}catch(e){}}
 const cr=window.cronoRegraAplicada;if(typeof cr==='function'&&!cr.__fs42){const fn=function(){return active()?'<div class="cronoRuleBox"><b>Regras aplicadas</b><span>Jornada flexível de 42 horas • '+tipo+' • horários efetivos individuais • domingo de folga. A distribuição considera o horário de funcionamento da filial.</span></div>':cr.apply(this,arguments)};fn.__fs42=true;window.cronoRegraAplicada=fn;try{cronoRegraAplicada=fn}catch(e){}}
 const ex=window.cronogramaExecutivoHtml;if(typeof ex==='function'&&!ex.__fs42){const fn=function(){let h=String(ex.apply(this,arguments));if(!active())return h;const t=state.config.fs42Tipo||'6x1';return h.replace(/CRONOGRAMA 40 HORAS SEMANAIS \(5X2\)/gi,'CRONOGRAMA 42 HORAS SEMANAIS ('+t.toUpperCase()+')').replace(/CRONOGRAMA 44 HORAS SEMANAIS \(6X1\)/gi,'CRONOGRAMA 42 HORAS SEMANAIS ('+t.toUpperCase()+')').replace(/DIA ESPECIAL \+ SÁBADO[^<]*/gi,'JORNADA FLEXÍVEL 42H — '+t.toUpperCase()).replace(/FOLGA DISTRIBUÍDA[^<]*/gi,'JORNADA FLEXÍVEL 42H — '+t.toUpperCase())};fn.__fs42=true;window.cronogramaExecutivoHtml=fn;try{cronogramaExecutivoHtml=fn}catch(e){}}
 const rp=window.renderRelatoriosPreview;if(typeof rp==='function'&&!rp.__fs42){const fn=function(){const r=rp.apply(this,arguments);if(active()){const box=document.getElementById('relatoriosPreview');if(box)box.querySelectorAll('.summaryCard').forEach(e=>{if(/Dia especial \+ sábado|Dias normais 6x1|Folga distribuída/.test(e.textContent))e.innerHTML=e.innerHTML.replace(/Dia especial \+ sábado|Dias normais 6x1|Folga distribuída/g,'Jornada flexível 42h — '+(state.config.fs42Tipo||'6x1'))})}return r};fn.__fs42=true;window.renderRelatoriosPreview=fn;try{renderRelatoriosPreview=fn}catch(e){}}
}
function install(){if(typeof window.fsAlterarModoEscala!=='function'||typeof window.aplicarDistribuicao!=='function'||typeof window.renderConfig!=='function')return;
if(window.fsAlterarModoEscala!==change){window.fs42LegacyChange=window.fsAlterarModoEscala;window.fsAlterarModoEscala=change;try{fsAlterarModoEscala=change}catch(e){}}
if(window.aplicarDistribuicao!==generate){window.fs42LegacyGenerate=window.aplicarDistribuicao;window.aplicarDistribuicao=generate;try{aplicarDistribuicao=generate}catch(e){}}
if(!window.fs42RenderWrapped){const old=window.render;window.render=function(){const r=old.apply(this,arguments);queueMicrotask(()=>{configUI();integrar42()});return r};try{render=window.render}catch(e){}window.fs42RenderWrapped=true}
configUI();integrar42();}
// Intercepta o seletor ANTES do onchange legado: o gerenciador anterior rejeita o modo 42h.
document.addEventListener('change',function(ev){const sel=ev.target;if(!sel?.matches?.('#configContent select[onchange*="fsAlterarModoEscala"]'))return;if(sel.value==='42h'||active()){ev.stopImmediatePropagation();ev.preventDefault();change(sel.value)}},true);
// Um leitor PDF não é um backup. Não permitir que callbacks legados tentem ler PDF como JSON.
function protegerRestauracao(){const old=window.fsRestaurarBackupCompleto;if(typeof old==='function'&&!old.__fsPdfGuard){const safe=function(file){if(file&&(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf'))return;return old.apply(this,arguments)};safe.__fsPdfGuard=true;window.fsRestaurarBackupCompleto=safe;try{fsRestaurarBackupCompleto=safe}catch(e){}}const inp=document.getElementById('listaInput');if(inp&&inp.onchange&&inp.onchange.toString().includes('fsRestaurarBackupCompleto'))inp.onchange=null;}
window.addEventListener('load',()=>{setTimeout(()=>{install();protegerRestauracao()},1800);setTimeout(()=>{install();protegerRestauracao()},3200)});
if(document.readyState==='complete')setTimeout(()=>{install();protegerRestauracao()},100);

})();
