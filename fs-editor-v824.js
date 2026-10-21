(function(){
  'use strict';
  const WEEK=['segunda','terca','quarta','quinta','sexta'];
  function modal(){return document.getElementById('pessoaModal')}
  function current(){const v=document.getElementById('editIndex')?.value;return v===''?null:state?.pessoas?.[Number(v)]||null}
  function setLabel(select,text){const box=select?.parentElement,label=box?.querySelector(':scope>label');if(label&&label.textContent!==text)label.textContent=text}
  function consolidate(){
    const m=modal(),base=document.getElementById('mEquipe');if(!m||!base||m.style.display==='none')return;
    const grid=base.closest('.modalGrid');if(!grid)return;grid.classList.add('fsV824EditorGrid');
    const saturday=document.getElementById('mSabado'),off=document.getElementById('mFolga'),satTeam=document.getElementById('mEquipeSabadoIndividual');
    setLabel(saturday,'Trabalha no sábado?');setLabel(off,'Dia da folga distribuída');setLabel(base,'Equipe / horário de segunda a sexta');setLabel(satTeam,'Equipe / horário de sábado');
    [saturday?.parentElement,off?.parentElement,base.parentElement,satTeam?.closest('.fsV562EquipeSabado')].filter(Boolean).forEach(x=>grid.appendChild(x));
    const apprentice=m.querySelector('.fsAprendizCadastro');if(apprentice){apprentice.classList.add('fsV824Aprendiz');grid.appendChild(apprentice);const ck=apprentice.querySelector('#mJovemAprendiz'),input=apprentice.querySelector('#mCargaSemanalAprendiz'),lab=apprentice.querySelector('label[for="mCargaSemanalAprendiz"]'),help=apprentice.querySelector('.fsAprendizAjuda'),out=apprentice.querySelector('.fsV610Confirm');if(lab)lab.textContent='Meta oficial do jovem aprendiz';if(input){if(ck?.checked&&Number(input.value)!==12)input.value='12';input.readOnly=true;input.min='12';input.max='12';input.step='1'}if(help)help.textContent='Jornada protegida de 12 horas semanais. A plataforma compara o realizado com 12h, sem usar a meta geral de 40h, 42h ou 44h.';if(out&&ck?.checked){out.classList.remove('off');out.textContent='✓ Meta individual ativa: 12h por semana'}}
    m.classList.add('fsV824Ready');
  }
  function applyTeams(person,week,saturday){
    if(!person)return;person.slots=person.slots||{};person.fsSlotsManuais=person.fsSlotsManuais||{};person._manualPorDia=person._manualPorDia||{};
    WEEK.forEach(d=>{person.slots[d]=week;person.fsSlotsManuais[d]=week;person._manualPorDia[d]=true});person.equipeBase=week;
    person.slots.sabado=saturday;person.fsSlotsManuais.sabado=saturday;person._manualPorDia.sabado=true;person.equipeSabado=saturday;person._manualEquipe=true;
  }
  function installSave(){
    const old=window.salvarPessoaModal||((typeof salvarPessoaModal==='function')?salvarPessoaModal:null);if(typeof old!=='function'||old.__fsV824)return;
    const fn=function(){const before=current(),id=before?.id,name=document.getElementById('mNome')?.value?.trim(),week=Math.max(0,Number(document.getElementById('mEquipe')?.value)||0),sat=Math.max(0,Number(document.getElementById('mEquipeSabadoIndividual')?.value)||0),young=!!document.getElementById('mJovemAprendiz')?.checked,input=document.getElementById('mCargaSemanalAprendiz');if(young&&input)input.value='12';const r=old.apply(this,arguments),person=(id&&state.pessoas?.find(x=>x.id===id))||state.pessoas?.slice().reverse().find(x=>x.nome===name);if(person){applyTeams(person,week,sat);person.jovemAprendiz=young;person.fsMetaIndividualAtiva=young;person.cargaSemanalAprendiz=young?12:Number(person.cargaSemanalAprendiz||12);try{save()}catch(_){}try{render()}catch(_){}}return r};fn.__fsV824=true;fn.__fsV609=true;fn.__fsV562=true;window.salvarPessoaModal=fn;try{salvarPessoaModal=fn}catch(_){}}
  document.addEventListener('change',e=>{if(!e.target?.closest?.('#pessoaModal'))return;if(e.target.id==='mJovemAprendiz'){const input=document.getElementById('mCargaSemanalAprendiz');if(e.target.checked&&input){input.value='12';input.dispatchEvent(new Event('input',{bubbles:true}))}}setTimeout(consolidate,0)},true);
  let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{installSave();consolidate()},25)}).observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{installSave();consolidate()},500);setTimeout(()=>{installSave();consolidate()},120);
})();
