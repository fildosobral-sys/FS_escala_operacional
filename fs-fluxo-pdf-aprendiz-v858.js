(function(){
  'use strict';
  const DIAS=['segunda','terca','quarta','quinta','sexta','sabado'];
  const NOMES={segunda:'Segunda-feira',terca:'Terça-feira',quarta:'Quarta-feira',quinta:'Quinta-feira',sexta:'Sexta-feira',sabado:'Sábado'};
  const minuto=h=>{const [a,b]=String(h||'00:00').split(':').map(Number);return (a||0)*60+(b||0)};

  function regraPosImportacao(){
    const area=document.getElementById('importText');if(!area)return;
    let box=document.getElementById('fsV858PosImportacao');
    if(!box){box=document.createElement('section');box.id='fsV858PosImportacao';box.className='fsV858PosImportacao';area.closest('.toolCard,.content')?.appendChild(box)}
    const info=window.fsPdfImportacaoConcluida;if(!info){box.hidden=true;return}
    box.hidden=false;box.innerHTML=`<div><b>✓ Lista importada e dados da filial conferidos</b><span>${Number(info.quantidade)||0} colaborador(es). O próximo passo é escolher a regra; nada será distribuído sem sua confirmação.</span></div><button type="button" id="fsV858AbrirRegras">Configurar regras da escala</button>`;
    box.querySelector('button').onclick=()=>{window.__fsAberturaManualRegras=true;try{window.fsAbrirModalRegras?.(true)}finally{setTimeout(()=>window.__fsAberturaManualRegras=false,300)}};
  }

  function resumoLinha(row){
    const ck=row.querySelector('input[type="checkbox"]'),id=ck?.id||'',dia=id.replace('mIndAtivo_',''),ativo=!!ck?.checked;
    let head=row.querySelector('.fsV858DiaCab');
    if(!head){head=document.createElement('button');head.type='button';head.className='fsV858DiaCab fsV859Cab';row.prepend(head);head.onclick=e=>{if(e.target.closest('.fsV859DiaAcao'))return;row.classList.toggle('fsV858Aberto');atualizarDias()}}else head.classList.add('fsV859Cab');
    const ent=document.getElementById('mIndEntrada_'+dia)?.value||'--:--',sai=document.getElementById('mIndSaida_'+dia)?.value||'--:--';
    const aprendiz=!!document.getElementById('mJovemAprendiz')?.checked,bloqueado=aprendiz&&dia==='sabado';
    const markup=`<span class="fsV858Seta">›</span><b>${NOMES[dia]||dia}</b><em class="${ativo?'on':'off'}">${ativo?'Trabalha':'Folga'}</em><small>${ativo?ent+' às '+sai:'Dia não incluído'}</small><span class="fsV859DiaAcao ${ativo?'ativo':''}" role="button" tabindex="${bloqueado?'-1':'0'}" aria-disabled="${bloqueado}">${ativo?'Marcar folga':'Marcar trabalho'}</span>`;
    if(head.dataset.fsMarkup!==markup){head.innerHTML=markup;head.dataset.fsMarkup=markup}
    const acao=head.querySelector('.fsV859DiaAcao');if(acao&&!acao.__fsAcao){acao.__fsAcao=true;const alternar=e=>{e.preventDefault();e.stopPropagation();if(acao.getAttribute('aria-disabled')==='true')return;ck.checked=!ck.checked;ck.dispatchEvent(new Event('change',{bubbles:true}));atualizarDias()};acao.onclick=alternar;acao.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')alternar(e)}}
    row.classList.toggle('fsV858Folga',!ativo);
  }
  function atualizarDias(){document.querySelectorAll('#mHorarioIndividualBox .individualDayRow').forEach(resumoLinha)}

  function aplicarAprendiz(){
    const ck=document.getElementById('mJovemAprendiz');if(!ck?.checked)return;
    const sab=document.getElementById('mSabado');if(sab)sab.value='Não';
    const sabDia=document.getElementById('mIndAtivo_sabado');if(sabDia)sabDia.checked=false;
    const ativos=DIAS.slice(0,5).filter(d=>document.getElementById('mIndAtivo_'+d)?.checked);
    if(ativos.length>3)ativos.slice(3).forEach(d=>{const el=document.getElementById('mIndAtivo_'+d);if(el)el.checked=false});
    atualizarDias();
  }

  function validarIntervalos(){
    for(const d of DIAS){
      if(!document.getElementById('mIndAtivo_'+d)?.checked)continue;
      const entrada=minuto(document.getElementById('mIndEntrada_'+d)?.value),ini=minuto(document.getElementById('mIndIni_'+d)?.value),fim=minuto(document.getElementById('mIndFim_'+d)?.value),saida=minuto(document.getElementById('mIndSaida_'+d)?.value),pausa=Math.max(0,fim-ini),efetiva=Math.max(0,saida-entrada-pausa);
      if(efetiva>360&&pausa<60){alert(`${NOMES[d]}: jornadas acima de 6 horas exigem intervalo mínimo de 1 hora. Ajuste o intervalo antes de salvar.`);document.getElementById('mIndFim_'+d)?.focus();return false}
    }
    return true;
  }

  function estabilizarModal(){
    const modal=document.getElementById('pessoaModal');if(!modal||modal.style.display==='none')return;
    const sab=document.getElementById('mSabado');if(sab){const l=sab.parentElement?.querySelector(':scope > label');if(l)l.textContent='Trabalha no sábado?'}
    const rapido=document.querySelector('#mHorarioIndividualBox .fsHorarioRapido');if(rapido)rapido.classList.add('aberto');
    aplicarAprendiz();atualizarDias();
  }

  function instalarSalvar(){
    const old=window.salvarPessoaModal;if(typeof old!=='function'||old.__fsV858)return;
    const fn=function(){aplicarAprendiz();if(!validarIntervalos())return false;return old.apply(this,arguments)};fn.__fsV858=true;window.salvarPessoaModal=fn;try{salvarPessoaModal=fn}catch(_){ }
  }

  document.addEventListener('fs:pdf-importado',()=>setTimeout(regraPosImportacao,80));
  document.addEventListener('change',e=>{
    if(e.target?.id==='mJovemAprendiz'){aplicarAprendiz();setTimeout(atualizarDias,0)}
    if(e.target?.id?.startsWith('mIndAtivo_')){if(document.getElementById('mJovemAprendiz')?.checked&&e.target.checked){const ativos=DIAS.slice(0,5).filter(d=>document.getElementById('mIndAtivo_'+d)?.checked);if(ativos.length>3){e.target.checked=false;alert('Jovem aprendiz: selecione no máximo 3 dias úteis por semana.');}}setTimeout(atualizarDias,0)}
  },true);
  let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{instalarSalvar();estabilizarModal();regraPosImportacao()},45)}).observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{instalarSalvar();if(document.getElementById('pessoaModal')?.style.display!=='none')estabilizarModal()},700);
  setTimeout(()=>{instalarSalvar();regraPosImportacao()},300);
})();
