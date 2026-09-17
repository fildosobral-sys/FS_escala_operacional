/* FS Escala 5x2 - v710
   Gerenciador persistente de seleção de arquivos.
   Impede que re-renderizações da tela de Configurações apaguem a seleção de PDF/imagem/backup.
*/
(function(){
  'use strict';
  const q={docs:[],backup:[]};
  const baseRead=window.lerArquivoAssistido;
  const baseRestore=window.importarDadosJson;

  function fmt(n){
    n=Number(n)||0;
    if(n<1024)return n+' B';
    if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
    return (n/(1024*1024)).toFixed(1)+' MB';
  }
  function key(f){return [f.name,f.size,f.lastModified,f.type].join('|')}
  function dedupe(files){const m=new Map();files.forEach(f=>m.set(key(f),f));return [...m.values()]}
  function esc(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}

  function ensureStyles(){
    if(document.getElementById('fsImportQueueStyle'))return;
    const st=document.createElement('style');st.id='fsImportQueueStyle';st.textContent=`
      .fsFileQueue{margin-top:10px;padding:10px 12px;border:1px solid rgba(56,189,248,.32);border-radius:12px;background:rgba(15,23,42,.46);font-size:12px;line-height:1.4}
      .fsFileQueueHead{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:6px}
      .fsFileQueueHead b{font-size:12px;color:#e2e8f0}.fsFileQueueClear{border:0!important;padding:4px 8px!important;min-height:0!important;width:auto!important;background:rgba(239,68,68,.15)!important;color:#fecaca!important;border-radius:8px!important;font-size:11px!important}
      .fsFileItem{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:5px 0;border-top:1px solid rgba(148,163,184,.12);color:#cbd5e1}
      .fsFileItem:first-of-type{border-top:0}.fsFileName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fsFileSize{white-space:nowrap;color:#94a3b8}
      .fsFileEmpty{color:#94a3b8}.fsFileReady{color:#67e8f9;font-weight:700}
      input[type=file][data-fs-managed="1"]{outline:1px solid rgba(56,189,248,.18);outline-offset:3px}
    `;document.head.appendChild(st)
  }

  function queueBox(input,type){
    if(!input)return null;
    let box=input.parentElement?.querySelector(`.fsFileQueue[data-type="${type}"]`);
    if(!box){box=document.createElement('div');box.className='fsFileQueue';box.dataset.type=type;input.insertAdjacentElement('afterend',box)}
    return box;
  }
  function draw(type){
    ensureStyles();
    const id=type==='docs'?'listaInput':'backupInput',input=document.getElementById(id);if(!input)return;
    input.dataset.fsManaged='1';
    const files=q[type],box=queueBox(input,type);if(!box)return;
    const titulo=type==='docs'?'Arquivos para leitura':'Backup selecionado';
    box.innerHTML=`<div class="fsFileQueueHead"><b>${titulo}</b>${files.length?`<button type="button" class="fsFileQueueClear" data-clear="${type}">Limpar</button>`:''}</div>`+
      (files.length?`<div class="fsFileReady">✓ ${files.length} arquivo(s) pronto(s)</div>`+files.map(f=>`<div class="fsFileItem"><span class="fsFileName" title="${esc(f.name)}">${esc(f.name)}</span><span class="fsFileSize">${fmt(f.size)}</span></div>`).join(''):`<div class="fsFileEmpty">Nenhum arquivo selecionado.</div>`);
  }
  function drawAll(){draw('docs');draw('backup')}

  function capture(input,type){
    const files=[...(input.files||[])];if(!files.length)return;
    q[type]=type==='docs'?dedupe([...q[type],...files]):files.slice(0,1);
    draw(type);
    try{
      if(typeof setImportStatus==='function'&&type==='docs')setImportStatus(`${q.docs.length} arquivo(s) selecionado(s) e mantido(s) na fila. Clique em “Ler e aplicar arquivos”.`);
    }catch(e){}
  }

  function putFiles(input,files){
    if(!input||!files.length)return false;
    try{
      const dt=new DataTransfer();files.forEach(f=>dt.items.add(f));input.files=dt.files;return input.files.length===files.length;
    }catch(e){console.warn('FS v710: não consegui recolocar arquivos no input',e);return false}
  }

  async function runRead(){
    const input=document.getElementById('listaInput');
    if(input?.files?.length)capture(input,'docs');
    if(!q.docs.length){alert('Selecione pelo menos um PDF, PNG, JPG, TXT ou CSV. Assim que selecionar, o nome do arquivo precisa aparecer na caixa “Arquivos para leitura”.');return}
    if(!putFiles(input,q.docs)){alert('O navegador não permitiu preparar os arquivos selecionados. Atualize a página e tente novamente.');return}
    try{
      if(typeof setImportStatus==='function')setImportStatus(`Abrindo ${q.docs.length} arquivo(s)…`);
      if(typeof baseRead!=='function')throw new Error('Leitor de documentos não foi carregado.');
      return await baseRead.apply(window,arguments);
    }catch(e){console.error('FS v710 leitura:',e);alert('Falha ao abrir os arquivos: '+(e?.message||e));}
    finally{draw('docs')}
  }

  async function runRestore(){
    const input=document.getElementById('backupInput');
    if(input?.files?.length)capture(input,'backup');
    if(!q.backup.length){alert('Selecione o arquivo .json do backup. O nome dele precisa aparecer em “Backup selecionado”.');return}
    if(!putFiles(input,q.backup)){alert('O navegador não permitiu preparar o backup selecionado. Atualize a página e tente novamente.');return}
    try{
      if(typeof baseRestore!=='function')throw new Error('Restaurador de backup não foi carregado.');
      return await baseRestore.apply(window,arguments);
    }catch(e){console.error('FS v710 backup:',e);alert('Falha ao restaurar backup: '+(e?.message||e));}
    finally{draw('backup')}
  }

  // Captura o arquivo imediatamente quando o seletor fecha, antes de qualquer renderização apagar o input.
  document.addEventListener('change',e=>{
    const t=e.target;if(!(t instanceof HTMLInputElement)||t.type!=='file')return;
    if(t.id==='listaInput')capture(t,'docs');
    if(t.id==='backupInput')capture(t,'backup');
  },true);

  // Botão limpar da fila.
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-clear]');if(!b)return;e.preventDefault();e.stopPropagation();
    const type=b.dataset.clear;if(type!=='docs'&&type!=='backup')return;q[type]=[];
    const inp=document.getElementById(type==='docs'?'listaInput':'backupInput');if(inp)try{inp.value=''}catch(_){}
    draw(type);
  },true);

  // Substitui as funções globais finais sem alterar a lógica de OCR/PDF já existente.
  window.lerArquivoAssistido=runRead;
  window.importarDadosJson=runRestore;
  try{lerArquivoAssistido=runRead}catch(e){}
  try{importarDadosJson=runRestore}catch(e){}

  function wire(){
    drawAll();
    document.querySelectorAll('button').forEach(btn=>{
      const t=(btn.textContent||'').toLowerCase();
      if(t.includes('ler e aplicar arquivos')||t.includes('ler arquivos selecionados')||t.includes('ler arquivo / imagem')){
        btn.textContent='Ler e aplicar arquivos';btn.onclick=e=>{e.preventDefault();e.stopPropagation();runRead();return false};
      }
      if(t.includes('restaurar backup'))btn.onclick=e=>{e.preventDefault();e.stopPropagation();runRestore();return false};
    });
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,250));
  const mo=new MutationObserver(()=>{clearTimeout(window.__fsImpWireTimer);window.__fsImpWireTimer=setTimeout(wire,80)});
  mo.observe(document.documentElement,{childList:true,subtree:true});
})();
