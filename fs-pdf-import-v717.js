/* FS Escala Operacional - importador de PDF isolado v719 */
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

  function extrairMetadados(texto){
    const linhas=String(texto||'').split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    const pegar=re=>{const m=String(texto||'').match(re);return m?m[1].replace(/\s+/g,' ').trim():'';};
    let empregador=pegar(/EMPREGADOR\s*:\s*([^\n]+?)(?=\s+CNPJ|\n|$)/i);
    let denominacao=pegar(/DENOMINA[CÇ][AÃ]O\s*:\s*([^\n]+)/i);
    let atividade=pegar(/ATIVIDADE\s*:\s*([^\n]+)/i);
    let cidade=pegar(/CIDADE\s*:\s*([^\n]+)/i);
    const cnpj=(String(texto||'').match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)||[])[0]||'';
    const ie=pegar(/(?:^|\n)\s*IE\s*:\s*([^;\n]+)/im);
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
      const linhas=pagina.linhas;
      const fortes=/hor[aá]rio de trabalho/i.test(pagina.texto)&&/turno 1/i.test(pagina.texto);
      for(let i=0;i<linhas.length;i++){
        const linha=linhas[i];if(!/^\s*\d{1,3}\s+[A-Za-zÀ-ÿ]/.test(linha))continue;
        const papel=papelNaLinha(linha);if(!papel)continue;
        const nome=limparNome(linha.slice(0,papel.indice));if(!nomeValido(nome))continue;
        const depois=linha.slice(papel.indice+papel.m[0].length),ts=tempos(depois);
        const pessoa={nome,funcao:papel.nome,horariosIndividuais:{},diasTrabalho:[]};
        const h=horario(ts.slice(0,4));
        if(h)DIAS_UTEIS.forEach(d=>{pessoa.horariosIndividuais[d]={ativo:true,...h};pessoa.diasTrabalho.push(d);});
        if(fortes){
          const proxima=linhas[i+1]||'';
          if(!/^\s*\d{1,3}\s+[A-Za-zÀ-ÿ]/.test(proxima)){
            const hs=horario(tempos(proxima).slice(0,4));if(hs){pessoa.horariosIndividuais.sabado={ativo:true,...hs};pessoa.diasTrabalho.push('sabado');}
          }
        }
        saida.push(pessoa);
      }
    }
    const mapa=new Map();
    saida.forEach(p=>{const k=chave(p.nome),at=mapa.get(k);if(!at)mapa.set(k,p);else{Object.assign(at.horariosIndividuais,p.horariosIndividuais);p.diasTrabalho.forEach(d=>{if(!at.diasTrabalho.includes(d))at.diasTrabalho.push(d);});}});
    return [...mapa.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
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
      out.push({nome:file.name+' - página '+n,linhas,texto:linhas.join('\n')});
    }
    return out;
  }

  const leituraAnterior=window.lerArquivoAssistido;
  async function processarArquivosPdf(files){
    const area=document.getElementById('importText');
    if(!files.length)return alert('Selecione um ou mais PDFs.');
    if(!files.some(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf'))return leituraAnterior?.apply(this,arguments);
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
      window.fsImportacaoPdfPendente={itens,metadados,arquivos:files.length};
      if(area)area.value=itens.map(x=>`${x.nome} - ${x.funcao}`).join('\n');
      const modo=document.getElementById('importMode');if(modo)modo.value='replace';
      const unidade=[metadados.filial,metadados.cnpj].filter(Boolean).join(' - ');
      status(`${itens.length} colaborador(es) reconhecido(s) em ${files.length} arquivo(s). ${unidade?'Unidade identificada: '+unidade+'. ':''}Confira a lista e clique em importar.`);
    }catch(e){console.error('[FS PDF]',e);status('Falha na leitura do PDF: '+e.message);alert('Não consegui concluir a leitura do PDF: '+e.message);}
    finally{if(botao){botao.disabled=false;botao.textContent=rotulo||'Ler arquivos selecionados';}}
  }
  window.lerArquivoAssistido=async function(){
    const input=document.getElementById('listaInput');
    return processarArquivosPdf([...(input?.files||[])]);
  };

  window.fsSelecionarELerPdf=function(){
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
    if(String(area?.value||'').trim()!==pend.itens.map(x=>`${x.nome} - ${x.funcao}`).join('\n').trim()){window.fsImportacaoPdfPendente=null;return importacaoAnterior?.apply(this,arguments);}
    if(!window.state||!Array.isArray(state.pessoas))throw new Error('Base local de colaboradores indisponível.');
    const modo=document.getElementById('importMode')?.value||'replace';if(modo==='replace')state.pessoas=[];
    const mapa=new Map(state.pessoas.map(p=>[chave(p.nome),p]));
    pend.itens.forEach((it,i)=>{let p=mapa.get(chave(it.nome));if(!p){p={id:'p'+Date.now()+'_'+i,nome:it.nome,funcao:it.funcao,especialSlot:null,sabadoSim:false,folgaDistribuida:['terca','quarta','quinta'][i%3],equipeBase:0,slots:{}};state.pessoas.push(p);}p.nome=it.nome;p.funcao=it.funcao;p.horariosIndividuais={...(p.horariosIndividuais||{}),...it.horariosIndividuais};if(it.diasTrabalho.includes('sabado'))p.sabadoSim=true;mapa.set(chave(it.nome),p);});
    state.colaboradores=state.pessoas;
    const novos=Object.fromEntries(Object.entries(pend.metadados||{}).filter(([,v])=>String(v||'').trim()));
    if(Object.keys(novos).length){let atuais={};try{atuais=JSON.parse(localStorage.getItem('fsDadosEmpresa')||'{}')||{};}catch(_){}localStorage.setItem('fsDadosEmpresa',JSON.stringify({...atuais,...novos}));}
    window.fsImportacaoPdfPendente=null;
    if(typeof save==='function')save();
    if(typeof fsForcarRedistribuicaoIgualitaria==='function')fsForcarRedistribuicaoIgualitaria();else if(typeof aplicarDistribuicao==='function')aplicarDistribuicao();
    if(typeof render==='function')render();
    status(`${pend.itens.length} colaborador(es) importado(s). Dados da unidade, nomes, funções e horários reconhecidos foram aplicados.`);
    alert('Importação do PDF concluída. Confira o cabeçalho, a lista de colaboradores e os horários.');
  };

  function prepararSeletorPdf(){
    const input=document.getElementById('listaInput');if(!input)return;
    input.accept='.pdf,application/pdf';
    input.removeAttribute('capture');
    input.dataset.fsPdfV='719';
    if(input.dataset.fsPdfChange==='1')return;
    input.dataset.fsPdfChange='1';
    input.addEventListener('change',()=>{
      const files=[...(input.files||[])];
      window.fsImportacaoPdfPendente=null;
      status(files.length?`PDF recebido: ${files.map(f=>f.name).join(', ')}. Iniciando leitura...`:'Nenhum PDF selecionado.');
      if(files.length)processarArquivosPdf(files);
    });
    const card=input.closest('.toolCard');
    if(card&&!card.querySelector('#fsPdfDirectButton')){
      const aviso=document.createElement('div');aviso.id='fsPdfReaderVersion';aviso.textContent='✓ Leitor PDF v719 ativo';aviso.style.cssText='margin:8px 0;padding:8px 10px;border-radius:10px;background:#ecfdf3;color:#166534;font-weight:900;font-size:12px;text-align:center';
      const botao=document.createElement('button');botao.id='fsPdfDirectButton';botao.type='button';botao.className='primary';botao.textContent='📄 Selecionar e ler PDF';botao.onclick=window.fsSelecionarELerPdf;
      input.style.display='none';
      const antigo=[...card.querySelectorAll('button')].find(b=>/ler arquivos selecionados/i.test(b.textContent||''));if(antigo)antigo.style.display='none';
      input.before(aviso,botao);
    }
  }
  const observar=new MutationObserver(prepararSeletorPdf);observar.observe(document.documentElement,{childList:true,subtree:true});
  prepararSeletorPdf();
  document.addEventListener('click',e=>{if(e.target?.closest?.('button')?.textContent?.match(/configura[cç][oõ]es/i))setTimeout(prepararSeletorPdf,80);},true);
})();
