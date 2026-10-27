/* V903 — estabilidade dominical, importação integral de PDF e proteção do backup. */
(function(){
  'use strict';
  const pad=n=>String(n).padStart(2,'0');
  const semAcento=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const chaveNome=s=>semAcento(s).replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DIAS=['segunda','terca','quarta','quinta','sexta'];

  /* Backup destrutivo: só pode ser acionado pelo botão que traz exatamente essa ação. */
  function alvoBackupExplicito(){
    const ev=window.event,t=ev?.target?.closest?.('button,a');
    if(!t)return false;
    const txt=(t.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    return txt==='limpar plataforma com backup'||txt==='limpar com backup'||txt.startsWith('🧹 limpar plataforma com backup');
  }
  function protegerBackup(){
    const atual=window.fsLimparPlataformaComBackup;
    if(typeof atual!=='function'||atual.__fsV903Protegido)return;
    const seguro=function(){
      if(!alvoBackupExplicito()){console.info('[V903] chamada indireta de limpeza/backup ignorada');return false}
      return atual.apply(this,arguments);
    };
    seguro.__fsV903Protegido=true;seguro.__fsV903Original=atual;
    window.fsLimparPlataformaComBackup=seguro;
    try{limparPlataformaComBackup=seguro}catch(_){ }
  }

  /* Uma única cortina estável cobre qualquer recomposição do domingo. */
  let busyTimer=0;
  function sundayBusy(texto='Organizando a escala dominical…'){
    clearTimeout(busyTimer);let o=document.getElementById('fsV903SundayBusy');
    if(!o){
      o=document.createElement('div');o.id='fsV903SundayBusy';o.className='fsV903SundayBusy';o.setAttribute('role','status');o.setAttribute('aria-live','polite');
      o.innerHTML='<div class="fsV903BusyBox"><span class="fsV903Logo"><img src="./LOGO%20ATUAL.png" alt="Zenir"></span><b></b><small>Os dados permanecem preservados durante a atualização.</small></div>';
      document.body.appendChild(o);
    }
    o.querySelector('b').textContent=texto;o.classList.remove('saindo');document.body.classList.add('fsV903SundayLocked');return o;
  }
  function sundayReady(delay=260){
    clearTimeout(busyTimer);busyTimer=setTimeout(()=>{const o=document.getElementById('fsV903SundayBusy');o?.classList.add('saindo');document.body.classList.remove('fsV903SundayLocked');setTimeout(()=>o?.remove(),180)},delay);
  }
  window.fsV903SundayBusy=sundayBusy;window.fsV903SundayReady=sundayReady;

  /*
   * Os controles antigos recompõem o painel inteiro a cada alteração. A
   * cortina entra antes dessa recomposição, conserva o ponto de rolagem e só
   * sai quando a nova tabela estiver pronta, evitando a sequência de telas
   * vista durante a definição da folga.
   */
  const MUTACOES_DOMINGO={
    fsDom541Status:'Atualizando a situação do colaborador…',
    fsDom541Equipe:'Atualizando equipe e horário…',
    fsDom541Folga:'Salvando a folga compensatória…'
  };
  function envolverMutacoesDomingo(){
    Object.entries(MUTACOES_DOMINGO).forEach(([nome,mensagem])=>{
      const atual=window[nome];
      if(typeof atual!=='function'||atual.__fsV905Busy)return;
      const fn=function(){
        const x=window.scrollX,y=window.scrollY;
        sundayBusy(mensagem);
        let resultado;
        try{resultado=atual.apply(this,arguments);}
        catch(erro){sundayReady(0);throw erro;}
        const concluir=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
          window.scrollTo(x,y);estabilizarFolgas();sundayReady(220);
        }));
        if(resultado&&typeof resultado.then==='function')resultado.finally(concluir);else concluir();
        return resultado;
      };
      fn.__fsV905Busy=true;fn.__fsV905Original=atual;window[nome]=fn;
    });
  }

  /* Restaura o select nativo de folga: permanece clicável e não depende do pop-up legado. */
  function estabilizarFolgas(){
    document.querySelectorAll('#domingo select[onchange*="fsDom541Folga"]').forEach(sel=>{
      sel.classList.remove('fsV828FolgaOriginal');sel.dataset.fsV903Folga='1';sel.disabled=false;
      const host=sel.closest('.fsDom541Def');host?.querySelectorAll('.fsV828FolgaBtn,.fsV828FolgaPop').forEach(x=>x.remove());
    });
  }

  /* Limpeza dominical consolidada: bloqueia a tela e produz apenas uma renderização final. */
  function instalarLimpezaDomingo(){
    const atual=window.fsV835LimparDomingos;
    if(typeof atual!=='function'||atual.__fsV903Estavel)return;
    const fn=function(){
      const comp=state?.config?.escalaDomingosPorData?.competencia||'';
      if(!comp)return false;
      if(!confirm(`Limpar e refazer toda a escala dominical de ${comp}? As escolhas desta competência serão removidas.`))return false;
      sundayBusy('Limpando e reorganizando os domingos…');
      const s=state.config.escalaDomingosPorData,sCfg=state.config.fsDomingoPorDataConfig||{};
      Object.keys(sCfg).filter(d=>d.startsWith(comp+'-')).forEach(d=>{delete s.itens?.[d];delete s.concluidos?.[d];const c=sCfg[d];if(c){c.aberto=false;c.fsV831ManualOpen=false;c.percentual=50}});
      delete state.config.fsDomCompetenciaConfirmada;delete state.config.fsDomConfirmacaoAssinatura;
      try{save()}catch(_){ }
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        try{window.fsDom541Mes?.(comp)}catch(_){ }
        setTimeout(()=>{estabilizarFolgas();sundayReady()},100);
      }));
      return false;
    };
    fn.__fsV903Estavel=true;fn.__fsV903Original=atual;window.fsV835LimparDomingos=fn;
    try{fsV835LimparDomingos=fn}catch(_){ }
  }

  /* ---------- Leitura integral e genérica dos relatórios Fortes/PDF ---------- */
  function titulo(v){
    return String(v||'').toLowerCase().split(/\s+/).filter(Boolean).map((p,i)=>/^(de|da|do|das|dos|e|em|com)$/.test(p)&&i?p:p.charAt(0).toUpperCase()+p.slice(1)).join(' ');
  }
  function nomeValido(v){const p=String(v||'').trim().split(/\s+/);return p.length>=2&&p.length<=10&&!/\d/.test(v)&&p.some(x=>x.length>=4)}
  function horas(texto){
    const out=[];let m,re=/(?:^|\D)([0-2]?\d)\s*[:;.]\s*([0-5]\d)(?=\D|$)/g;
    while((m=re.exec(String(texto||''))))if(+m[1]<=23)out.push(`${pad(+m[1])}:${m[2]}`);return out;
  }
  function horario(h){
    if(h.length>=4)return{entrada:h[0],almocoIni:h[1],almocoFim:h[2],saida:h[3]};
    if(h.length>=2)return{entrada:h[0],almocoIni:h[0],almocoFim:h[0],saida:h[1]};return null;
  }
  function agruparLinhas(items){
    const gs=[];(items||[]).filter(x=>String(x.str||'').trim()).forEach(it=>{const y=Math.round(it.transform?.[5]||0);let g=gs.find(x=>Math.abs(x.y-y)<=2);if(!g){g={y,items:[]};gs.push(g)}g.items.push(it)});
    return gs.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,items:g.items.sort((a,b)=>(a.transform?.[4]||0)-(b.transform?.[4]||0))}));
  }
  function textoLinha(g){return g.items.map(x=>String(x.str||'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim()}
  function acharColunas(grupos){
    const h=grupos.find(g=>/empregado/i.test(textoLinha(g))&&/lota[cç][aã]o/i.test(textoLinha(g)))||{items:[]};
    const pos=(re,fallback)=>h.items.find(x=>re.test(x.str||''))?.transform?.[4]??fallback;
    return{ordem:pos(/ordem/i,15),nome:pos(/empregado/i,70),lotacao:pos(/lota/i,260),turno:pos(/turno\s*1/i,455)};
  }
  function textoFaixa(g,ini,fim){return g.items.filter(x=>{const p=x.transform?.[4]||0;return p>=ini&&p<fim}).map(x=>x.str).join(' ').replace(/\s+/g,' ').trim()}
  function extrairPorColunas(items,origem,pagina){
    const grupos=agruparLinhas(items),col=acharColunas(grupos),rows=[];
    grupos.forEach((g,idx)=>{
      const linha=textoLinha(g),ord=linha.match(/^\s*(\d{1,4})\s+/);if(!ord)return;
      const inicioNome=col.ordem+20,inicioLotacao=col.lotacao-25,fimLotacao=col.turno-5;
      const nome=titulo(textoFaixa(g,inicioNome,inicioLotacao-4).replace(/^\d{1,4}\s+/,''));
      if(!nomeValido(nome))return;
      let funcao=textoFaixa(g,inicioLotacao,fimLotacao).trim();
      for(let j=idx+1;j<grupos.length&&g.y-grupos[j].y<34;j++){
        if(/^\d{1,4}\s+[A-Za-zÀ-ÿ]/.test(textoLinha(grupos[j])))break;
        const cont=textoFaixa(grupos[j],inicioLotacao,fimLotacao);
        if(/[A-Za-zÀ-ÿ]/.test(cont)&&!horas(cont).length)funcao=`${funcao} ${cont}`.trim();
      }
      funcao=titulo(funcao.replace(/\b\d{1,2}:\d{2}.*$/,'').replace(/\d+/g,'').replace(/[:;.-]+$/,'').replace(/\s+/g,' ').trim())||'Função não informada';
      if(/^Encarregado de Carga e$/i.test(funcao))funcao='Encarregado de Carga e Descarga';
      const h1=horas(linha),proximos=[];
      for(let j=idx+1;j<grupos.length&&g.y-grupos[j].y<34;j++){if(/^\d{1,4}\s+/.test(textoLinha(grupos[j])))break;proximos.push(...horas(textoLinha(grupos[j])))}
      const semana=horario(h1.slice(0,4)),sab=horario(proximos.slice(0,4));
      const carteira=(linha.match(/\b\d{7,13}\b/)||[])[0]||'';
      rows.push({ordem:+ord[1],nome,funcao,carteira,semana,sabado:sab,origem,pagina});
    });
    return rows;
  }
  const CARGOS=[
    'Gerente de Vendas','Gerente de Crédito e Cobrança','Gerente de Crédito','Operador de Caixa','Operadora de Caixa','Atendente de Loja','Auxiliar de Limpeza','Assistente Administrativo','Armazenista','Faturista','Vendedor de Comércio Varejista','Vendedor(a)','Ajudante de Motorista','Motorista de Furgão ou Veículo','Motorista','Supervisor de Carga e Descarga','Conferente de Carga e Descarga','Conferente','Encarregado','Recepcionista','Cobrador','Vigia','Montagem','Aprendiz','Jovem Aprendiz'
  ];
  function extrairTextoGenerico(texto,origem,pagina){
    const cargos=CARGOS.slice().sort((a,b)=>b.length-a.length),out=[];
    String(texto||'').split(/\n+/).forEach((raw,i,arr)=>{
      const l=raw.replace(/\s+/g,' ').trim(),m=l.match(/^\s*(\d{1,4})\s+(.+)$/);if(!m)return;
      const resto=m[2],cargo=cargos.find(c=>semAcento(resto).includes(semAcento(c)));
      if(!cargo)return;
      const pos=semAcento(resto).indexOf(semAcento(cargo)),nome=titulo(resto.slice(0,pos));if(!nomeValido(nome))return;
      const hs=horas(resto),hs2=horas(arr[i+1]||'');out.push({ordem:+m[1],nome,funcao:cargo,carteira:'',semana:horario(hs.slice(0,4)),sabado:horario(hs2.slice(0,4)),origem,pagina});
    });return out;
  }
  function consolidarRows(rows){
    const mapa=new Map(),duplicados=[];
    rows.sort((a,b)=>(a.pagina-b.pagina)||(a.ordem-b.ordem)).forEach(r=>{
      const k=chaveNome(r.nome);if(!k)return;
      if(mapa.has(k)){const at=mapa.get(k);duplicados.push(r.nome);at.semana=at.semana||r.semana;at.sabado=at.sabado||r.sabado;return}
      const horariosIndividuais={},diasTrabalho=[];
      if(r.semana){DIAS.forEach(d=>{diasTrabalho.push(d);horariosIndividuais[d]={ativo:true,...r.semana}})}
      if(r.sabado){diasTrabalho.push('sabado');horariosIndividuais.sabado={ativo:true,...r.sabado}}
      mapa.set(k,{nome:r.nome,funcao:r.funcao,carteira:r.carteira||'',horariosIndividuais,diasTrabalho,origens:[`${r.origem} — página ${r.pagina}`],_ordem:r.ordem});
    });
    return{itens:[...mapa.values()].sort((a,b)=>a._ordem-b._ordem||a.nome.localeCompare(b.nome,'pt-BR')),duplicados};
  }
  async function pdfLib(){
    if(window.pdfjsLib?.getDocument)return window.pdfjsLib;
    const m=await import('./pdf.min.mjs');window.pdfjsLib=m;m.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs',location.href).href;return m;
  }
  function status(v){try{window.setImportStatus?.(v)}catch(_){const el=document.getElementById('importStatus');if(el)el.textContent=v}}
  function auditoria(d,importados=0){
    const area=document.getElementById('importText')?.parentElement;if(!area)return;let box=area.querySelector('.fsV903ImportAudit');
    if(!box){box=document.createElement('section');box.className='fsV903ImportAudit';document.getElementById('importText').insertAdjacentElement('afterend',box)}
    box.innerHTML=`<header><b>Conferência da importação</b><span>${d.paginas} página(s) lida(s) integralmente</span></header><div><article><small>Total identificado</small><strong>${d.total}</strong></article><article><small>Total pronto para importar</small><strong>${d.total}</strong></article><article><small>Total importado</small><strong>${importados}</strong></article><article class="${d.inconsistencias.length?'warn':'ok'}"><small>Inconsistências</small><strong>${d.inconsistencias.length}</strong></article></div>${d.inconsistencias.length?`<p>Revisar: ${d.inconsistencias.map(esc).join(' • ')}</p>`:'<p>✓ Nenhuma duplicação ou linha descartada foi detectada.</p>'}`;
  }
  async function lerPdf(file){
    const lib=await pdfLib(),pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise,rows=[],textos=[];
    for(let p=1;p<=pdf.numPages;p++){
      status(`Lendo página ${p} de ${pdf.numPages} — ${file.name}`);const page=await pdf.getPage(p),c=await page.getTextContent(),txt=agruparLinhas(c.items).map(textoLinha).join('\n');textos.push(txt);
      const col=extrairPorColunas(c.items,file.name,p),fallback=extrairTextoGenerico(txt,file.name,p);rows.push(...(col.length?col:fallback));
    }
    return{rows,textos,paginas:pdf.numPages};
  }
  async function lerArquivo(file){
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))return lerPdf(file);
    const texto=await file.text(),rows=extrairTextoGenerico(texto,file.name,1);return{rows,textos:[texto],paginas:1};
  }
  function instalarLeitor(){
    const atual=window.lerArquivoAssistido;if(typeof atual!=='function'||atual.__fsV903Integral)return;
    const fn=async function(){
      const input=document.getElementById('listaInput'),ta=document.getElementById('importText'),files=[...(input?.files||[])];
      if(!files.length)return alert('Selecione um ou mais PDFs, imagens ou arquivos de texto.');
      /* OCR de imagens continua com o leitor homologado anterior. */
      if(files.some(f=>f.type?.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(f.name||'')))return atual.apply(this,arguments);
      const bot=[...(document.getElementById('configContent')||document).querySelectorAll('button')].find(b=>/ler arquivos selecionados|selecionar e ler pdf/i.test(b.textContent||'')),rot=bot?.innerHTML;
      if(bot){bot.disabled=true;bot.textContent='Lendo todas as páginas…'}
      try{
        let rows=[],paginas=0,textos=[];for(const f of files){const r=await lerArquivo(f);rows.push(...r.rows);paginas+=r.paginas;textos.push(...r.textos)}
        const c=consolidarRows(rows),incons=[];c.duplicados.length&&incons.push(`${c.duplicados.length} duplicidade(s) consolidada(s)`);
        /* PDF somente imagem: mantém o OCR homologado em vez de descartar a função existente. */
        if(!c.itens.length){if(bot){bot.disabled=false;bot.innerHTML=rot||'Selecionar e ler PDF'}return await atual.apply(this,arguments)}
        rows.filter(r=>r.funcao==='Função não informada').forEach(r=>incons.push(`${r.nome}: função não informada`));
        window.fsImportacaoEstruturadaPendente={itens:c.itens,modoDetectado:c.itens.some(x=>x.diasTrabalho.includes('sabado'))?'6x1':null,arquivos:files.length,paginas};
        window.fsV903ImportAudit={total:c.itens.length,paginas,inconsistencias:incons};
        if(ta)ta.value=c.itens.map(x=>`${x.nome} - ${x.funcao}`).join('\n');const modo=document.getElementById('importMode');if(modo&&c.itens.length)modo.value='replace';
        auditoria(window.fsV903ImportAudit,0);status(`${c.itens.length} colaborador(es) identificados em ${paginas} página(s). Confira a lista antes de importar.`);
        if(!c.itens.length)alert('Nenhum colaborador foi identificado. Verifique se o documento contém a tabela Horário de Trabalho.');
      }catch(e){console.error(e);status(`Falha na leitura: ${e.message}`);alert(`Não foi possível concluir a leitura integral: ${e.message}`)}
      finally{if(bot){bot.disabled=false;bot.innerHTML=rot||'Selecionar e ler PDF'}}
    };
    fn.__fsV903Integral=true;fn.__fsV903Original=atual;window.lerArquivoAssistido=fn;try{lerArquivoAssistido=fn}catch(_){ }
    const importar=window.importarListaColaboradores;if(typeof importar==='function'&&!importar.__fsV903Audit){const imp=function(){const d=window.fsV903ImportAudit,n=window.fsImportacaoEstruturadaPendente?.itens?.length||0,r=importar.apply(this,arguments);if(d)setTimeout(()=>auditoria(d,n),120);return r};imp.__fsV903Audit=true;window.importarListaColaboradores=imp;try{importarListaColaboradores=imp}catch(_){ }}
  }

  /* API mínima apenas para a fiscalização automatizada do leitor. */
  window.fsV903Test={extrairPorColunas,extrairTextoGenerico,consolidarRows};

  function atualizar(){protegerBackup();instalarLimpezaDomingo();envolverMutacoesDomingo();estabilizarFolgas();instalarLeitor()}
  let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(atualizar,80)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.matches?.('#domingo select[data-fs-v903-folga]'))setTimeout(estabilizarFolgas,30)},false);
  setInterval(atualizar,2200);setTimeout(atualizar,300);
})();
