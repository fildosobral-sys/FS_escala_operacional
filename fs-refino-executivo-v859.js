(function(){
  'use strict';
  const DIAS=['segunda','terca','quarta','quinta','sexta','sabado'];
  function fecharRegraPrematura(){const o=document.getElementById('fsV806Rules');if(o&&window.fsImportacaoPdfPendente)o.hidden=true}
  function instalarBloqueioPdf(){
    const old=window.fsAbrirModalRegras;if(typeof old!=='function'||old.__fsV859)return;
    const fn=function(){if(window.fsImportacaoPdfPendente&&!window.fsPdfImportacaoConcluida)return false;somente42h5x2();return old.apply(this,arguments)};fn.__fsV859=true;window.fsAbrirModalRegras=fn;try{fsAbrirModalRegras=fn}catch(_){ }
  }
  function somente42h5x2(){
    if(!window.state?.config)return;
    if(state.config.modo==='42h'&&state.config.fs42Tipo!=='5x2'){state.config.fs42Tipo='5x2';state.config.fs42Pendente=true;try{save()}catch(_){ }}
    document.querySelectorAll('#fsV806Rules [data-key="42h-6x1"]').forEach(x=>x.remove());
  }
  function estabilizarSabado(){const s=document.getElementById('mSabado');if(!s)return;const p=s.parentElement;p?.classList.add('fsV859Sabado');const l=p?.querySelector(':scope>label');if(l&&l.textContent!=='Trabalha no sábado?')l.textContent='Trabalha no sábado?'}
  function botaoDia(row){
    const ck=row.querySelector('input[id^="mIndAtivo_"]');if(!ck)return;const dia=ck.id.replace('mIndAtivo_',''),head=row.querySelector('.fsV858DiaCab');if(!head)return;
    head.classList.add('fsV859Cab');let acao=head.querySelector('.fsV859DiaAcao');
    if(!acao){acao=document.createElement('span');acao.setAttribute('role','button');acao.tabIndex=0;acao.className='fsV859DiaAcao';head.appendChild(acao);const alternar=e=>{e.preventDefault();e.stopPropagation();if(document.getElementById('mJovemAprendiz')?.checked&&dia==='sabado')return;ck.checked=!ck.checked;ck.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(prepararDias,20)};acao.onclick=alternar;acao.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')alternar(e)}}
    acao.textContent=ck.checked?'Marcar folga':'Marcar trabalho';acao.classList.toggle('ativo',ck.checked);acao.setAttribute('aria-disabled',String(!!document.getElementById('mJovemAprendiz')?.checked&&dia==='sabado'));
  }
  function prepararDias(){document.querySelectorAll('#mHorarioIndividualBox .individualDayRow').forEach(botaoDia)}
  function compactarResumo(){const r=document.querySelector('#pessoaModal .fsModoColaboradorResumo');if(r){r.innerHTML=state.config?.modo==='42h'?'<b>5×2 • Jornada semanal de 42h</b>':'<b>'+String(r.textContent||'').replace(/Modalidade ativa:\s*/i,'').replace(/\s+/g,' ').trim()+'</b>';r.classList.add('fsV859Resumo')}}
  function atualizar(){instalarBloqueioPdf();fecharRegraPrematura();somente42h5x2();estabilizarSabado();compactarResumo();prepararDias()}
  document.addEventListener('change',e=>{if(e.target?.matches?.('input[name="fs42type"]'))setTimeout(somente42h5x2,0)},true);
  let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(atualizar,25)}).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(atualizar,250);setTimeout(atualizar,120);
})();
