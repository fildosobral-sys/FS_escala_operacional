/* FS Escala 5x2 - v713
   Importação assistida estável: trabalha diretamente com os File objects capturados,
   sem recolocar arquivos no <input> e sem depender de DataTransfer (instável no Android).
   Fluxo: selecionar -> mostrar fila -> ler -> aplicar localmente automaticamente.
*/
(function(){
  'use strict';

  const fila={docs:[],backup:[]};
  const baseRestore=window.importarDadosJson;
  const LIB={
    pdf:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    ocr:'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
  };

  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
  const key=f=>[f.name,f.size,f.lastModified,f.type].join('|');
  const dedupe=arr=>[...new Map(arr.map(f=>[key(f),f])).values()];
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
  function status(t){try{if(typeof setImportStatus==='function')setImportStatus(t)}catch(_){}; const e=document.getElementById('fsImportLiveStatus');if(e)e.textContent=t;}

  function css(){
    if(document.getElementById('fsImport713Style'))return;
    const st=document.createElement('style');st.id='fsImport713Style';st.textContent=`
      .fsFileQueue{margin-top:10px;padding:11px 12px;border:1px solid rgba(56,189,248,.34);border-radius:13px;background:rgba(15,23,42,.48);font-size:12px;line-height:1.4}
      .fsFileQueueHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.fsFileQueueHead b{color:#e2e8f0}.fsFileQueueClear{border:0!important;width:auto!important;min-height:0!important;padding:5px 9px!important;border-radius:8px!important;background:rgba(239,68,68,.14)!important;color:#fecaca!important;font-size:11px!important}
      .fsFileReady{font-weight:850;color:#67e8f9;margin-bottom:5px}.fsFileItem{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid rgba(148,163,184,.12);color:#cbd5e1}.fsFileName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fsFileSize{white-space:nowrap;color:#94a3b8}.fsFileEmpty{color:#94a3b8}
      #fsImportLiveStatus{margin-top:8px;padding:9px 10px;border-radius:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.18);font-size:12px;font-weight:750;color:#0f3f83}
      .fsImportReading{opacity:.72;pointer-events:none}
    `;document.head.appendChild(st);
  }

  function getInput(type){return document.getElementById(type==='docs'?'listaInput':'backupInput')}
  function queueBox(input,type){
    if(!input)return null;let box=input.parentElement?.querySelector(`.fsFileQueue[data-type="${type}"]`);
    if(!box){box=document.createElement('div');box.className='fsFileQueue';box.dataset.type=type;input.insertAdjacentElement('afterend',box)}return box;
  }
  function draw(type){
    css();const input=getInput(type);if(!input)return;input.dataset.fsManaged='713';const files=fila[type],box=queueBox(input,type);if(!box)return;
    box.innerHTML=`<div class="fsFileQueueHead"><b>${type==='docs'?'Arquivos para leitura':'Backup selecionado'}</b>${files.length?`<button type="button" class="fsFileQueueClear" data-clear="${type}">Limpar</button>`:''}</div>`+
      (files.length?`<div class="fsFileReady">✓ ${files.length} arquivo(s) selecionado(s)</div>${files.map(f=>`<div class="fsFileItem"><span class="fsFileName" title="${esc(f.name)}">${esc(f.name)}</span><span class="fsFileSize">${fmt(f.size)}</span></div>`).join('')}`:`<div class="fsFileEmpty">Nenhum arquivo selecionado.</div>`);
    if(type==='docs'&&!document.getElementById('fsImportLiveStatus')){const live=document.createElement('div');live.id='fsImportLiveStatus';live.textContent='Selecione PDF, PNG, JPG, TXT ou CSV. O arquivo permanecerá na fila até a leitura terminar.';box.insertAdjacentElement('afterend',live)}
  }
  function drawAll(){draw('docs');draw('backup')}
  function capture(input,type){
    const files=[...(input.files||[])];if(!files.length)return;
    fila[type]=type==='docs'?dedupe([...fila[type],...files]):files.slice(0,1);draw(type);
    if(type==='docs')status(`${fila.docs.length} arquivo(s) selecionado(s). Clique em “Ler e aplicar arquivos”.`);
  }

  function load(src,keyName){
    if(window[keyName])return Promise.resolve(window[keyName]);window.__fsImport713=window.__fsImport713||{};if(window.__fsImport713[src])return window.__fsImport713[src];
    window.__fsImport713[src]=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';const to=setTimeout(()=>reject(new Error('Tempo excedido ao preparar o leitor de arquivos.')),30000);s.onload=()=>{clearTimeout(to);window[keyName]?resolve(window[keyName]):reject(new Error('Leitor carregado, mas não inicializado.'))};s.onerror=()=>{clearTimeout(to);reject(new Error('Não foi possível carregar o leitor. Verifique a internet.'))};document.head.appendChild(s)}).catch(e=>{delete window.__fsImport713[src];throw e});
    return window.__fsImport713[src];
  }
  function pdfLines(items){
    const groups=[];for(const it of items){const y=Math.round((it.transform&&it.transform[5])||0);let g=groups.find(x=>Math.abs(x.y-y)<=3);if(!g){g={y,items:[]};groups.push(g)}g.items.push(it)}
    return groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>((a.transform&&a.transform[4])||0)-((b.transform&&b.transform[4])||0)).map(x=>x.str).join(' ')).join('\n');
  }
  async function ocrCanvas(canvas,label){
    if(!window.Tesseract)await load(LIB.ocr,'Tesseract');
    const r=await Tesseract.recognize(canvas,'por+eng',{logger:m=>{if(m.status==='recognizing text')status(`${label}: reconhecendo ${Math.round((m.progress||0)*100)}%`)},tessedit_pageseg_mode:'4',preserve_interword_spaces:'1'});return r?.data?.text||'';
  }
  async function imageCanvas(file){
    let src,cleanup=()=>{};if('createImageBitmap' in window){try{src=await createImageBitmap(file);cleanup=()=>{try{src.close()}catch(_){}}}catch(_){}}
    if(!src){const u=URL.createObjectURL(file);cleanup=()=>URL.revokeObjectURL(u);src=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('Não consegui abrir '+file.name));im.src=u})}
    try{const w=src.width||src.naturalWidth,h=src.height||src.naturalHeight;if(!w||!h)throw new Error('Imagem sem dimensões válidas.');const scale=Math.min(2.6,3000/w),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,c.width,c.height);return c}finally{cleanup()}
  }
  function parsedCount(text,name){try{return (window.fsAnalisarTextosEscala?.([{texto:text,nome:name}])||[]).length}catch(_){return 0}}
  async function readFile(file,i,total){
    const label=`${i+1}/${total} • ${file.name}`;status(`${label}: abrindo…`);
    if(file.type.includes('text')||/\.(txt|csv)$/i.test(file.name))return [{texto:await file.text(),nome:file.name}];
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
      if(!window.pdfjsLib)await load(LIB.pdf,'pdfjsLib');pdfjsLib.GlobalWorkerOptions.workerSrc=LIB.worker;const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
      for(let p=1;p<=pdf.numPages;p++){status(`${label}: lendo página ${p}/${pdf.numPages}`);const page=await pdf.getPage(p),ct=await page.getTextContent();let text=pdfLines(ct.items);if(parsedCount(text,`${file.name} — página ${p}`)<2){try{const vp=page.getViewport({scale:2.4}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;text+='\n'+await ocrCanvas(c,`${label} • página ${p}`)}catch(e){console.warn('OCR PDF complementar:',e)}}out.push({texto:text,nome:`${file.name} — página ${p}`})}return out;
    }
    if(file.type.startsWith('image/')||/\.(png|jpe?g|webp|bmp)$/i.test(file.name)){const c=await imageCanvas(file);let t=await ocrCanvas(c,label);if(parsedCount(t,file.name)<3){try{const r=await Tesseract.recognize(c,'por+eng',{logger:m=>{if(m.status==='recognizing text')status(`${label}: segunda leitura ${Math.round((m.progress||0)*100)}%`)},tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});t+='\n'+(r?.data?.text||'')}catch(_){}}return [{texto:t,nome:file.name}]}
    throw new Error('Formato não reconhecido: '+file.name);
  }

  async function runRead(){
    if(!fila.docs.length){const inp=getInput('docs');if(inp?.files?.length)capture(inp,'docs')}
    const files=fila.docs.slice();if(!files.length){status('Nenhum arquivo selecionado.');return}
    if(files.length>12){status('Use no máximo 12 arquivos por vez.');return}
    const btn=[...document.querySelectorAll('button')].find(b=>/ler e aplicar arquivos|ler arquivos selecionados|ler arquivo \/ imagem/i.test(b.textContent||''));
    if(btn){btn.disabled=true;btn.classList.add('fsImportReading');btn.dataset.oldText=btn.textContent;btn.textContent='Lendo…'}
    try{
      let pages=[],errors=[];for(let i=0;i<files.length;i++){try{pages.push(...await readFile(files[i],i,files.length))}catch(e){console.error(e);errors.push(`${files[i].name}: ${e.message||e}`)}}
      if(!pages.length)throw new Error(errors[0]||'Nenhum conteúdo pôde ser lido.');
      const analyzer=window.fsAnalisarTextosEscala;if(typeof analyzer!=='function')throw new Error('Analisador da escala não foi carregado.');
      const items=analyzer(pages)||[];const raw=pages.map(p=>`### ${p.nome}\n${p.texto}`).join('\n\n');const ta=document.getElementById('importText');
      if(!items.length){if(ta)ta.value=raw;status(`Arquivo(s) lido(s), mas nenhum colaborador foi reconhecido com segurança.${errors.length?' '+errors.length+' arquivo(s) falharam.':''} O texto extraído ficou disponível para conferência.`);return}
      const week=pages.some(p=>/segunda|segunda[- ]?feira/i.test(p.texto)),sat=pages.some(p=>/s[aá]bado/i.test(p.texto)),sun=pages.some(p=>/domingo|descanso\s+semanal/i.test(p.texto));
      window.fsImportacaoEstruturadaPendente={itens:items,modoDetectado:(week&&(sat||sun))?'6x1':null,arquivos:files.length,arquivosLidos:files.length-errors.length,falhas:errors};
      if(ta)ta.value=items.map(x=>`${x.nome} - ${x.funcao}`).join('\n');const mode=document.getElementById('importMode');if(mode)mode.value='replace';
      const withHours=items.filter(x=>Object.keys(x.horariosIndividuais||{}).length).length;status(`${items.length} colaborador(es) reconhecido(s), ${withHours} com horários. Aplicando localmente…`);
      if(typeof window.importarListaColaboradores!=='function')throw new Error('Aplicador dos dados não foi carregado.');
      await Promise.resolve(window.importarListaColaboradores());
      status(`Importação concluída ✓ ${items.length} colaborador(es) aplicados localmente${withHours?`, ${withHours} com horários`:''}.${errors.length?' '+errors.length+' arquivo(s) tiveram falha parcial.':''} Use “Salvar na nuvem” somente quando quiser publicar.`);
    }catch(e){console.error('FS v713 importação:',e);status('Falha na importação: '+(e.message||e));}
    finally{if(btn){btn.disabled=false;btn.classList.remove('fsImportReading');btn.textContent=btn.dataset.oldText||'Ler e aplicar arquivos';delete btn.dataset.oldText}draw('docs')}
  }

  async function runRestore(){
    if(!fila.backup.length){const inp=getInput('backup');if(inp?.files?.length)capture(inp,'backup')}
    if(!fila.backup.length){status('Selecione o backup JSON.');return}
    // Para backup, ainda usamos o restaurador já validado, mas sem depender de DataTransfer quando houver API direta.
    if(typeof window.fsRestaurarBackupCompleto==='function')return window.fsRestaurarBackupCompleto(fila.backup[0]);
    if(typeof baseRestore==='function'){
      const inp=getInput('backup');try{const dt=new DataTransfer();dt.items.add(fila.backup[0]);inp.files=dt.files}catch(_){}
      return baseRestore();
    }
  }

  document.addEventListener('change',e=>{const t=e.target;if(!(t instanceof HTMLInputElement)||t.type!=='file')return;if(t.id==='listaInput')capture(t,'docs');if(t.id==='backupInput')capture(t,'backup')},true);
  document.addEventListener('click',e=>{const clear=e.target.closest?.('[data-clear]');if(clear){e.preventDefault();e.stopPropagation();const type=clear.dataset.clear;fila[type]=[];const inp=getInput(type);if(inp)try{inp.value=''}catch(_){};draw(type);if(type==='docs')status('Fila limpa. Selecione novos arquivos.');return}
    const btn=e.target.closest?.('button');if(!btn)return;const text=(btn.textContent||'').toLowerCase();if(text.includes('ler e aplicar arquivos')||text.includes('ler arquivos selecionados')||text.includes('ler arquivo / imagem')){e.preventDefault();e.stopImmediatePropagation();runRead()}else if(text.includes('restaurar backup')){e.preventDefault();e.stopImmediatePropagation();runRestore()}},true);

  function wire(){drawAll();document.querySelectorAll('button').forEach(btn=>{const t=(btn.textContent||'').toLowerCase();if(t.includes('ler arquivos selecionados')||t.includes('ler arquivo / imagem'))btn.textContent='Ler e aplicar arquivos'})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,250));else setTimeout(wire,100);
  new MutationObserver(()=>{clearTimeout(window.__fsImp713Wire);window.__fsImp713Wire=setTimeout(wire,80)}).observe(document.documentElement,{childList:true,subtree:true});
  window.fsImport713Queue=fila;window.lerArquivoAssistido=runRead;try{lerArquivoAssistido=runRead}catch(_){};
})();
