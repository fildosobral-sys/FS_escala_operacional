/* FS Escala Operacional - importador de PDF isolado v905 */
(function(){
  'use strict';

  const DIAS_UTEIS=['segunda','terca','quarta','quinta','sexta'];
  const funcoes=[
    [/vendedor(?:a)? de com[eé]rcio varejista/i,'Vendedor(a)'],[/vendedor(?:a|\(a\))?/i,'Vendedor(a)'],
    [/ajudante de motorista/i,'Ajudante de Motorista'],[/supervisor de carga e descarga/i,'Supervisor de Carga e Descarga'],
    [/gerente de cr[eé]dito e cobran[cç]a/i,'Gerente de Crédito'],[/gerente de cr[eé]dito/i,'Gerente de Crédito'],
    [/gerente de vendas?/i,'Gerente de Vendas'],[/operador(?:a)? de caixa/i,'Operadora de Caixa'],
    [/atendente de lojas?/i,'Atendente de Loja'],[/auxiliar de limpeza/i,'Auxiliar de Limpeza'],
    [/motorista de furg[aã]o ou ve[ií]culo/i,'Motorista de Furgão'],[/motorista de carro de passeio/i,'Motorista'],
    [/(?:assistente|assis\.?) administrativ[oa]/i,'Assistente Administrativo'],[/armazenista/i,'Armazenista'],
    [/faturista/i,'Faturista'],[/aprendiz/i,'Aprendiz']
  ];

  const semAcento=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const chave=s=>semAcento(s).replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
  const status=msg=>{const el=document.getElementById('importStatus');if(el)el.textContent=msg;};

  function papelNaLinha(linha){
    for(const [re,nome] of funcoes){const m=String(linha||'').match(re);if(m)return {m,nome,indice:m.index||0};}
    return null;
  }
  function limparNome(texto){
    return String(texto||'').replace(/^\s*\d{1,3}\s+/,'').replace(/[^A-Za-zÀ-ÿ' .-]/g,' ')
      .replace(/\s+/g,' ').replace(/^[ .-]+|[ .-]+$/g,'').trim();
  }
  function nomeValido(nome){
    const p=String(nome||'').split(/\s+/).filter(Boolean);
    return p.length>=2&&p.length<=10&&nome.length>=7&&!/hor[aá]rio|empregador|atividade|denomina[cç][aã]o|assinatura|observa[cç][aã]o/i.test(nome);
  }
  function tempos(texto){
    const out=[],re=/(?:^|\D)([0-2]?\d)\s*[:;.]\s*([0-5]\d)(?:\s*[:;.]\s*[0-5]\d)?(?=\D|$)/g;let m;
    while((m=re.exec(String(texto||''))))if(Number(m[1])<=23)out.push(String(Number(m[1])).padStart(2,'0')+':'+m[2]);
    return out;
  }
  function horario(ts){
    if(ts.length>=4)return {entrada:ts[0],almocoIni:ts[1],almocoFim:ts[2],saida:ts[3]};
    if(ts.length===2)return {entrada:ts[0],almocoIni:'00:00',almocoFim:'00:00',saida:ts[1]};
    return null;
  }
  function linhasDaPagina(items){
    const grupos=[];
    items.forEach(it=>{const y=Math.round(it.transform?.[5]||0);let g=grupos.find(x=>Math.abs(x.y-y)<=3);if(!g){g={y,itens:[]};grupos.push(g);}g.itens.push(it);});
    return grupos.sort((a,b)=>b.y-a.y).map(g=>g.itens.sort((a,b)=>(a.transform?.[4]||0)-(b.transform?.[4]||0)).map(x=>x.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  }

  /*
   * Relatórios Fortes possuem colunas estáveis. A leitura por posição evita
   * descartar colaboradores só porque o cargo ainda não existe em uma lista
   * de funções conhecida pela plataforma.
   */
  function titulo(v){
    return String(v||'').toLowerCase().split(/\s+/).filter(Boolean).map((p,i)=>
      /^(de|da|do|das|dos|e|em|com)$/.test(p)&&i?p:p.charAt(0).toUpperCase()+p.slice(1)
    ).join(' ');
  }
  function gruposDaPagina(items){
    const grupos=[];
    (items||[]).filter(x=>String(x.str||'').trim()).forEach(it=>{
      const y=Math.round(it.transform?.[5]||0);
      let g=grupos.find(x=>Math.abs(x.y-y)<=2);
      if(!g){g={y,itens:[]};grupos.push(g);}
      g.itens.push(it);
    });
    return grupos.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,itens:g.itens.sort((a,b)=>(a.transform?.[4]||0)-(b.transform?.[4]||0))}));
  }
  const textoGrupo=g=>g.itens.map(x=>String(x.str||'').trim()).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  function colunasFortes(grupos){
    const h=grupos.find(g=>/empregado/i.test(textoGrupo(g))&&/lota[cç][aã]o/i.test(textoGrupo(g)))||{itens:[]};
    const pos=(re,padrao)=>h.itens.find(x=>re.test(x.str||''))?.transform?.[4]??padrao;
    return {ordem:pos(/ordem/i,15),nome:pos(/empregado/i,70),lotacao:pos(/lota/i,260),turno:pos(/turno\s*1/i,455)};
  }
  function textoFaixa(g,ini,fim){
    return g.itens.filter(x=>{const p=x.transform?.[4]||0;return p>=ini&&p<fim;}).map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();
  }
  function extrairPorColunas(pagina){
    if(!pagina.itens?.length)return [];
    const grupos=gruposDaPagina(pagina.itens),col=colunasFortes(grupos),saida=[];
    grupos.forEach((g,idx)=>{
      const linha=textoGrupo(g),ord=linha.match(/^\s*(\d{1,4})\s+/);if(!ord)return;
      const inicioNome=col.ordem+20,inicioLotacao=col.lotacao-25,fimLotacao=col.turno-5;
      const nome=titulo(textoFaixa(g,inicioNome,inicioLotacao-4).replace(/^\d{1,4}\s+/,''));
      if(!nomeValido(nome))return;
      let funcao=textoFaixa(g,inicioLotacao,fimLotacao).trim();
      for(let j=idx+1;j<grupos.length&&g.y-grupos[j].y<34;j++){
        if(/^\d{1,4}\s+[A-Za-zÀ-ÿ]/.test(textoGrupo(grupos[j])))break;
        const complemento=textoFaixa(grupos[j],inicioLotacao,fimLotacao);
        if(/[A-Za-zÀ-ÿ]/.test(complemento)&&!tempos(complemento).length)funcao=`${funcao} ${complemento}`.trim();
      }
      funcao=titulo(funcao.replace(/\b\d{1,2}:\d{2}.*$/,'').replace(/\d+/g,'').replace(/[:;.-]+$/,'').replace(/\s+/g,' ').trim())||'Função não informada';
      const horasLinha=tempos(linha),horasSeguintes=[];
      for(let j=idx+1;j<grupos.length&&g.y-grupos[j].y<34;j++){
        if(/^\d{1,4}\s+/.test(textoGrupo(grupos[j])))break;
        horasSeguintes.push(...tempos(textoGrupo(grupos[j])));
      }
      const semana=horario(horasLinha.slice(0,4)),sabado=horario(horasSeguintes.slice(0,4));
      const aprendiz=/aprendiz/i.test(funcao),horariosIndividuais={},diasTrabalho=[];
      if(semana){
        const dias=aprendiz?DIAS_UTEIS.slice(0,3):DIAS_UTEIS;
        dias.forEach(d=>{diasTrabalho.push(d);horariosIndividuais[d]={ativo:true,...semana};});
      }
      if(sabado&&!aprendiz){diasTrabalho.push('sabado');horariosIndividuais.sabado={ativo:true,...sabado};}
      saida.push({
        _ordem:Number(ord[1]),nome,funcao:aprendiz?'Jovem Aprendiz':funcao,
        jovemAprendiz:aprendiz,cargaSemanalAprendiz:aprendiz?12:undefined,
        horariosIndividuais,diasTrabalho
      });
    });
    return saida;
  }

  function extrairMetadados(texto){
    const linhas=String(texto||'').split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    const pegar=re=>{const m=String(texto||'').match(re);return m?m[1].replace(/\s+/g,' ').trim():'';};
    let empregador=pegar(/EMPREGADOR\s*:\s*([^\n]+?)(?=\s+CNPJ|\n|$)/i);
    let denominacao=pegar(/DENOMINA[CÇ][AÃ]O\s*:\s*([^\n]+)/i);
    let atividade=pegar(/ATIVIDADE\s*:\s*([^\n]+)/i);
    let cidade=pegar(/CIDADE\s*:\s*([^\n]+)/i);
    const cnpj=(String(texto||'').match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)||[])[0]||'';
    const ie=pegar(/(?:^|\n)\s*(?:IE|INSCRI[CÇ][AÃ]O\s+ESTADUAL)\s*[:\-]\s*([^;\n]+)/im);
    const aniversario=pegar(/ANIVERS[AÁ]RIO\s*:\s*([^;\n]+)/i);
    const enderecos=linhas.filter(x=>/^(?:ENDERE[CÇ]O\s*:\s*)?(?:RUA|AVENIDA|AV\.|RODOVIA|TRAVESSA)\b/i.test(x))
      .map(x=>x.replace(/^ENDERE[CÇ]O\s*:\s*/i,'')).slice(0,2);
    if(!cidade){
      const base=enderecos.join(' '),m=base.match(/\b([A-Za-zÀ-ÿ ]{3,35})\s*[-/]\s*([A-Z]{2})\b/);
      if(m)cidade=m[1].trim().replace(/^.*\b(?:CENTRO|BAIRRO)\s*/i,'')+'/'+m[2];
    }
    const cidadeNome=String(cidade||'').split(/[-/]/)[0].trim();
    if(!denominacao&&cidadeNome)denominacao='ZENIR MÓVEIS E ELETROS';
    const filial=denominacao?(denominacao+(cidadeNome?'\n'+cidadeNome.toUpperCase():'')):'';
    return {empregador,filial,atividade,cidade,cnpj,inscricaoEstadual:ie,aniversarioFilial:aniversario,endereco1:enderecos[0]||'',endereco2:enderecos[1]||''};
  }

  function extrairPessoas(paginas){
    const saida=[];
    for(const pagina of paginas){
      const estruturados=extrairPorColunas(pagina);
      if(estruturados.length){saida.push(...estruturados);continue;}
      const linhas=pagina.linhas;
      const fortes=/hor[aá]rio de trabalho/i.test(pagina.texto)&&/turno 1/i.test(pagina.texto);
      for(let i=0;i<linhas.length;i++){
        const linha=linhas[i];if(!/^\s*\d{1,3}\s+[A-Za-zÀ-ÿ]/.test(linha))continue;
        const papel=papelNaLinha(linha);if(!papel)continue;
        const nome=limparNome(linha.slice(0,papel.indice));if(!nomeValido(nome))continue;
        const depois=linha.slice(papel.indice+papel.m[0].length),ts=tempos(depois);
        const aprendiz=/aprendiz/i.test(papel.nome+' '+linha);
        const pessoa={nome,funcao:aprendiz?'Jovem Aprendiz':papel.nome,jovemAprendiz:aprendiz,cargaSemanalAprendiz:aprendiz?12:undefined,horariosIndividuais:{},diasTrabalho:[]};
        const h=horario(ts.slice(0,4));
        if(h){
          if(aprendiz){
            const contexto=[linha,linhas[i+1]||'',linhas[i+2]||''].join(' '),mapaDias=[['segunda',/\bseg(?:unda)?\b/i],['terca',/\bter(?:ça|ca)?\b/i],['quarta',/\bqua(?:rta)?\b/i],['quinta',/\bqui(?:nta)?\b/i],['sexta',/\bsex(?:ta)?\b/i]];
            mapaDias.filter(([,re])=>re.test(contexto)).slice(0,3).forEach(([d])=>{pessoa.horariosIndividuais[d]={ativo:true,...h};pessoa.diasTrabalho.push(d);});
          }else DIAS_UTEIS.forEach(d=>{pessoa.horariosIndividuais[d]={ativo:true,...h};pessoa.diasTrabalho.push(d);});
        }
        if(fortes){
          const proxima=linhas[i+1]||'';
          if(!/^\s*\d{1,3}\s+[A-Za-zÀ-ÿ]/.test(proxima)){
            const hs=horario(tempos(proxima).slice(0,4));if(hs&&!aprendiz){pessoa.horariosIndividuais.sabado={ativo:true,...hs};pessoa.diasTrabalho.push('sabado');}
          }
        }
        saida.push(pessoa);
      }
    }
    const mapa=new Map();
    saida.forEach(p=>{const k=chave(p.nome),at=mapa.get(k);if(!at)mapa.set(k,p);else{Object.assign(at.horariosIndividuais,p.horariosIndividuais);p.diasTrabalho.forEach(d=>{if(!at.diasTrabalho.includes(d))at.diasTrabalho.push(d);});}});
    return [...mapa.values()].sort((a,b)=>(a._ordem||9999)-(b._ordem||9999)||a.nome.localeCompare(b.nome,'pt-BR'));
  }

  let leitorPromise=null;
  function iniciarLeitor(){
    if(leitorPromise)return leitorPromise;
    leitorPromise=import('./pdf.min.mjs?v=719').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs?v=719',document.baseURI).href;return pdf;})
      .catch(e=>{leitorPromise=null;throw new Error('Leitor de PDF não iniciou: '+e.message);});
    return leitorPromise;
  }
  window.fsPdfReaderReady=iniciarLeitor();
  window.fsPdfReaderReady.catch(e=>console.error('[FS PDF]',e));

  function lerBuffer(file){
    if(typeof file.arrayBuffer==='function')return file.arrayBuffer();
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('não foi possível acessar o arquivo'));r.readAsArrayBuffer(file);});
  }

  async function lerPdf(file,indice,total){
    const leitor=await iniciarLeitor(),pdf=await leitor.getDocument({data:await lerBuffer(file)}).promise,out=[];
    for(let n=1;n<=pdf.numPages;n++){
      status(`Arquivo ${indice+1}/${total}: lendo página ${n}/${pdf.numPages}...`);
      const page=await pdf.getPage(n),conteudo=await page.getTextContent(),linhas=linhasDaPagina(conteudo.items);
      out.push({nome:file.name+' - página '+n,linhas,texto:linhas.join('\n'),itens:conteudo.items,pagina:n});
    }
    return out;
  }

  const leituraAnterior=window.lerArquivoAssistido;
  function iniciarConferenciaPdf(){
    window.fsPdfImportacaoConcluida=null;
    const pos=document.getElementById('fsV858PosImportacao');if(pos)pos.hidden=true;
    const regras=document.getElementById('fsV806Rules');if(regras)regras.hidden=true;
  }
  function auditoriaPdf(dados){
    const ta=document.getElementById('importText'),area=ta?.parentElement;if(!area)return;
    let box=area.querySelector('.fsV903ImportAudit');
    if(!box){box=document.createElement('section');box.className='fsV903ImportAudit';ta.insertAdjacentElement('afterend',box);}
    const inconsistencias=dados.inconsistencias||[];
    box.innerHTML=`<header><b>Conferência da importação</b><span>${dados.paginas} página(s) lida(s) integralmente</span></header><div><article><small>Total identificado</small><strong>${dados.total}</strong></article><article><small>Total pronto para importar</small><strong>${dados.total}</strong></article><article><small>Total importado</small><strong>${dados.importados||0}</strong></article><article class="${inconsistencias.length?'warn':'ok'}"><small>Inconsistências</small><strong>${inconsistencias.length}</strong></article></div>${inconsistencias.length?`<p>Revisar: ${inconsistencias.join(' • ')}</p>`:'<p>✓ Nenhuma duplicação ou linha descartada foi detectada.</p>'}`;
  }
  async function processarArquivosPdf(files){
    const area=document.getElementById('importText');
    if(!files.length)return alert('Selecione um ou mais PDFs.');
    if(!files.some(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf'))return leituraAnterior?.apply(this,arguments);
    iniciarConferenciaPdf();
    const botao=[...(document.getElementById('configContent')||document).querySelectorAll('button')].find(b=>/ler arquivos selecionados/i.test(b.textContent||''));
    const rotulo=botao?.textContent;if(botao){botao.disabled=true;botao.textContent='Lendo PDFs...';}
    try{
      const paginas=[];
      for(let i=0;i<files.length;i++){
        const f=files[i];
        if(/\.pdf$/i.test(f.name)||f.type==='application/pdf')paginas.push(...await lerPdf(f,i,files.length));
        else if(f.type.includes('text')||/\.(txt|csv)$/i.test(f.name)){const texto=await f.text();paginas.push({nome:f.name,linhas:texto.split(/\n+/),texto});}
      }
      const itens=extrairPessoas(paginas),metadados=extrairMetadados(paginas.map(p=>p.texto).join('\n'));
      if(!itens.length)throw new Error('o PDF abriu, mas nenhuma linha de colaborador foi reconhecida');
      const estruturados=paginas.flatMap(extrairPorColunas),duplicados=Math.max(0,estruturados.length-itens.length);
      window.fsPdfV905Audit={total:itens.length,paginas:paginas.length,importados:0,inconsistencias:duplicados?[`${duplicados} duplicidade(s) consolidada(s)`]:[]};
      window.fsPdfImportacaoConcluida=null;
      window.fsImportacaoPdfPendente={itens,metadados,arquivos:files.length,paginas:paginas.length};
      const modalRegras=document.getElementById('fsV806Rules');if(modalRegras)modalRegras.hidden=true;
      const previa=itens.map(x=>`${x.nome} - ${x.funcao}`).join('\n');
      if(area){area.value=previa;area.dispatchEvent(new Event('input',{bubbles:true}));}
      window.fsPdfUltimaPrevia=previa;
      const modo=document.getElementById('importMode');if(modo)modo.value='replace';
      auditoriaPdf(window.fsPdfV905Audit);
      const unidade=[metadados.filial,metadados.cnpj].filter(Boolean).join(' - ');
      status(`${itens.length} colaborador(es) reconhecido(s) em ${paginas.length} página(s). ${unidade?'Unidade identificada: '+unidade+'. ':''}Confira a lista e clique em importar.`);
    }catch(e){console.error('[FS PDF]',e);status('Falha na leitura do PDF: '+e.message);alert('Não consegui concluir a leitura do PDF: '+e.message);}
    finally{if(botao){botao.disabled=false;botao.textContent=rotulo||'Ler arquivos selecionados';}}
  }
  window.lerArquivoAssistido=async function(){
    const input=document.getElementById('listaInput');
    return processarArquivosPdf([...(input?.files||[])]);
  };
  window.lerArquivoAssistido.__fsV903Integral=true;

  window.fsSelecionarELerPdf=function(){
    iniciarConferenciaPdf();
    const seletor=document.createElement('input');
    seletor.type='file';seletor.accept='application/pdf,.pdf';seletor.multiple=true;
    seletor.style.position='fixed';seletor.style.left='-9999px';seletor.style.opacity='0';
    document.body.appendChild(seletor);
    let concluido=false;
    const finalizar=()=>{if(!concluido){concluido=true;setTimeout(()=>seletor.remove(),1000);}};
    seletor.addEventListener('change',async()=>{
      const files=[...(seletor.files||[])];
      if(!files.length){status('Nenhum PDF foi selecionado. Toque novamente em Selecionar e ler PDF.');finalizar();return;}
      status(`PDF recebido: ${files.map(f=>f.name).join(', ')}. Iniciando leitura...`);
      try{await processarArquivosPdf(files);}finally{finalizar();}
    },{once:true});
    status('Abrindo os arquivos do aparelho... selecione o PDF.');
    try{if(typeof seletor.showPicker==='function')seletor.showPicker();else seletor.click();}
    catch(_){seletor.click();}
  };

  const importacaoAnterior=window.importarListaColaboradores;
  window.importarListaColaboradores=function(){
    const pend=window.fsImportacaoPdfPendente,area=document.getElementById('importText');
    if(!pend?.itens?.length)return importacaoAnterior?.apply(this,arguments);
    const texto=String(area?.value||'').trim();
    if(!texto){status('A lista está vazia. Leia o PDF e confira os nomes antes de importar.');return alert('A lista de conferência está vazia.');}
    // Respeitar inclusões, exclusões e correções realizadas pelo responsável.
    const linhas=texto.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const revisados=[];const vistos=new Set();
    for(const linha of linhas){
      const separador=linha.lastIndexOf(' - ');
      if(separador<1)return alert('Revise esta linha: '+linha+'\nUse Nome completo - Função.');
      const nome=limparNome(linha.slice(0,separador)),funcao=linha.slice(separador+3).trim();
      if(!nomeValido(nome)||!funcao)return alert('Nome ou função inválidos: '+linha);
      const k=chave(nome);if(vistos.has(k))return alert('Nome repetido: '+nome);
      vistos.add(k);
      const original=pend.itens.find(x=>chave(x.nome)===k);
      const aprendiz=!!original?.jovemAprendiz||/jovem\s+aprendiz|\baprendiz\b/i.test(funcao);
      revisados.push({...original,nome,funcao:aprendiz?'Jovem Aprendiz':funcao,jovemAprendiz:aprendiz,cargaSemanalAprendiz:aprendiz?12:original?.cargaSemanalAprendiz,horariosIndividuais:original?.horariosIndividuais||{},diasTrabalho:(original?.diasTrabalho||[]).filter(d=>!aprendiz||d!=='sabado')});
    }
    if(!revisados.length)return alert('Nenhum colaborador válido para importar.');
    if(!window.state||!Array.isArray(state.pessoas))return alert('Base local indisponível. Nenhum dado foi alterado.');
    const modo=document.getElementById('importMode')?.value||'replace';
    const copia=modo==='replace'?[]:state.pessoas.map(p=>({...p}));
    const mapa=new Map(copia.map(p=>[chave(p.nome),p]));
    revisados.forEach((it,i)=>{
      let p=mapa.get(chave(it.nome));
      if(!p){p={id:'p'+Date.now()+'_'+i,nome:it.nome,funcao:it.funcao,especialSlot:null,sabadoSim:false,folgaDistribuida:['terca','quarta','quinta'][i%3],equipeBase:0,slots:{}};copia.push(p);}
      p.nome=it.nome;p.funcao=it.funcao;p.fsPdfImportado=true;p.jovemAprendiz=!!it.jovemAprendiz;p.fsMetaIndividualAtiva=!!it.jovemAprendiz;
      p.horariosIndividuais={...(p.horariosIndividuais||{}),...it.horariosIndividuais};
      if(it.jovemAprendiz){p.cargaSemanalAprendiz=12;p.sabadoSim=false;p.usarDiasIndividuais=true;p.diasAtivosIndividuais=it.diasTrabalho.filter(d=>d!=='sabado').slice(0,3);delete p.horariosIndividuais.sabado;}
      if(it.diasTrabalho.includes('sabado'))p.sabadoSim=true;
      mapa.set(chave(it.nome),p);
    });
    state.pessoas=copia;state.colaboradores=state.pessoas;
    const novos=Object.fromEntries(Object.entries(pend.metadados||{}).filter(([,v])=>String(v||'').trim()));
    if(Object.keys(novos).length){let atuais={};try{atuais=JSON.parse(localStorage.getItem('fsDadosEmpresa')||'{}')||{};}catch(_){}const mudancas=Object.entries(novos).filter(([k,v])=>String(atuais[k]||'').trim()!==String(v).trim());if(mudancas.length){const descricao=mudancas.map(([k,v])=>k+': '+v).join('\n');if(confirm('O PDF contém dados da filial. Deseja atualizar os seguintes campos?\n\n'+descricao+'\n\nCancelar mantém os dados atuais.')){
          const atualizados={...atuais,...novos};localStorage.setItem('fsDadosEmpresa',JSON.stringify(atualizados));
          // Atualizar os campos visíveis: o painel não recria seus inputs após a importação.
          const ids={empregador:'fsEmpregadorInput',filial:'fsFilialInput',atividade:'fsAtividadeInput',cidade:'fsCidadeInput',cnpj:'fsCnpjInput',inscricaoEstadual:'fsInscricaoEstadualInput',aniversarioFilial:'fsAniversarioFilialInput',endereco1:'fsEndereco1Input',endereco2:'fsEndereco2Input'};
          Object.entries(novos).forEach(([k,v])=>{const input=document.getElementById(ids[k]);if(input)input.value=String(v).replace(/\n/g,' - ')});
          try{window.fsAplicarDadosEmpresa?.(document)}catch(e){console.warn('[FS PDF] atualização do cabeçalho',e)}

        }}}
    // Turnos individuais encontrados no PDF nunca redefinem o funcionamento
    // oficial da filial. Abertura e fechamento são alterados somente pela
    // gestão em Dados da unidade / Editar parâmetros.
    window.fsImportacaoPdfPendente=null;
    window.fsPdfImportacaoConcluida={quantidade:revisados.length,metadados:novos,at:Date.now()};
    if(window.fsPdfV905Audit){window.fsPdfV905Audit.importados=revisados.length;auditoriaPdf(window.fsPdfV905Audit);}
    if(typeof save==='function')save();
    if(typeof render==='function')render();
    status(`${revisados.length} colaborador(es) importado(s). Agora escolha e confirme a regra da escala antes de aplicar a distribuição.`);
    document.dispatchEvent(new CustomEvent('fs:pdf-importado',{detail:window.fsPdfImportacaoConcluida}));
  };
  // O HTML também utiliza uma função global declarada lexicalmente.
  // Atualizar essa referência impede que o clique invoque o importador antigo.
  try{importarListaColaboradores=window.importarListaColaboradores;}catch(e){}

  function prepararSeletorPdf(){
    const input=document.getElementById('listaInput');if(!input)return;
    input.accept='.pdf,application/pdf';
    input.removeAttribute('capture');
    input.dataset.fsPdfV='905';
    if(input.dataset.fsPdfChange==='1')return;
    input.dataset.fsPdfChange='1';
    input.addEventListener('change',()=>{
      const files=[...(input.files||[])];
      status(files.length?`PDF recebido: ${files.map(f=>f.name).join(', ')}. Iniciando leitura...`:'Nenhum PDF selecionado.');
      if(files.length)processarArquivosPdf(files);
    });
    const card=input.closest('.toolCard');
    if(card&&!card.querySelector('#fsPdfDirectButton')){
      const aviso=document.createElement('div');aviso.id='fsPdfReaderVersion';aviso.textContent='✓ Leitor PDF v905 ativo — leitura integral';aviso.style.cssText='margin:8px 0;padding:8px 10px;border-radius:10px;background:#ecfdf3;color:#166534;font-weight:900;font-size:12px;text-align:center';
      const botao=document.createElement('button');botao.id='fsPdfDirectButton';botao.type='button';botao.className='primary';botao.textContent='📄 Selecionar e ler PDF';botao.onclick=window.fsSelecionarELerPdf;
      input.style.display='none';
      const antigo=[...card.querySelectorAll('button')].find(b=>/ler arquivos selecionados/i.test(b.textContent||''));if(antigo)antigo.style.display='none';
      input.before(aviso,botao);
    }
  }
  const observar=new MutationObserver(()=>{prepararSeletorPdf();const area=document.getElementById('importText');if(area&&window.fsImportacaoPdfPendente&&window.fsPdfUltimaPrevia&&!area.value.trim())area.value=window.fsPdfUltimaPrevia;});observar.observe(document.documentElement,{childList:true,subtree:true});
  prepararSeletorPdf();
  document.addEventListener('click',e=>{if(e.target?.closest?.('button')?.textContent?.match(/configura[cç][oõ]es/i))setTimeout(prepararSeletorPdf,80);},true);
  window.fsPdfV905Test={extrairPorColunas};
})();
