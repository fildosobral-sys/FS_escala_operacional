(function(){
  'use strict';
  if(window.__fsV916Installed)return;
  window.__fsV916Installed=true;
  const DAYS=['segunda','terca','quarta','quinta','sexta','sabado'];
  const clone=o=>JSON.parse(JSON.stringify(o||{}));
  function dayFromCard(card){const cards=[...document.querySelectorAll('#configContent .dayScheduleCard:not(.fsDomingoScheduleCard)')];return DAYS[cards.indexOf(card)]||''}
  function syncGeneratedPeople(day){
    const rows=state?.horarios?.[day]||[];
    (state?.pessoas||[]).forEach(p=>{if(!p.fsAssistidoGerado||p.fs42ManualLock===true||!p.usarDiasIndividuais||!p.diasAtivosIndividuais?.includes(day))return;const slot=Math.max(0,Number(p.slots?.[day]??(day==='sabado'?p.equipeSabado:p.equipeBase)??0)),source=rows[slot]||rows[0];if(!source)return;p.horariosIndividuais=p.horariosIndividuais||{};p.horariosIndividuais[day]=Object.assign({},clone(source),{ativo:true,fsAssistido:true})});
    const key=state?.config?.modo==='42h'?'42h':state?.config?.modo,profile=state?.config?.perfisEscala?.[key];if(profile){profile.horarios=clone(state.horarios);profile.equipesDia=clone(state.config?.equipesDia)}try{save()}catch(_){}
  }
  document.addEventListener('change',e=>{const card=e.target?.closest?.('#configContent .dayScheduleCard');if(!card||!e.target.matches('input[type="time"]'))return;const day=dayFromCard(card);if(!day)return;setTimeout(()=>{syncGeneratedPeople(day);try{renderDia(day);renderVisao();renderBase()}catch(_){}},80)});
  function reconcileSaturday(p,wants,slot){
    if(!p||state?.config?.modo!=='42h')return;p.usarDiasIndividuais=true;p.diasAtivosIndividuais=Array.isArray(p.diasAtivosIndividuais)?p.diasAtivosIndividuais:[];p.horariosIndividuais=p.horariosIndividuais||{};
    if(wants){if(!p.diasAtivosIndividuais.includes('sabado'))p.diasAtivosIndividuais.push('sabado');const n=Math.max(0,Number(slot??p.equipeSabado??p.equipeBase??0)),h=state.horarios?.sabado?.[n]||state.horarios?.sabado?.[0];p.equipeSabado=n;p.slots=p.slots||{};p.slots.sabado=n;if(h&&!p.horariosIndividuais.sabado?.ativo)p.horariosIndividuais.sabado=Object.assign({},clone(h),{ativo:true})}else{p.diasAtivosIndividuais=p.diasAtivosIndividuais.filter(d=>d!=='sabado');delete p.horariosIndividuais.sabado}
  }
  function installPersonSave(){const old=window.salvarPessoaModal;if(typeof old!=='function'||old.__fsV916)return;const fn=function(){const idx=document.getElementById('editIndex')?.value,id=idx!==''?state?.pessoas?.[Number(idx)]?.id:'',name=document.getElementById('mNome')?.value?.trim(),wants=document.getElementById('mSabado')?.value==='Sim',slot=document.getElementById('mEquipeSabadoIndividual')?.value,result=old.apply(this,arguments);setTimeout(()=>{const p=(state?.pessoas||[]).find(x=>x.id===id)||(state?.pessoas||[]).find(x=>x.nome===name);if(!p)return;reconcileSaturday(p,wants,slot);p.fs42ManualLock=true;p.fsAssistidoGerado=false;try{save();renderVisao();renderBase();renderDia('sabado')}catch(_){}},520);return result};fn.__fsV916=true;window.salvarPessoaModal=fn;try{salvarPessoaModal=fn}catch(_){} }
  setTimeout(installPersonSave,1900);setInterval(installPersonSave,1800);
})();
