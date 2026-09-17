/* FS Escala 5x2 - v715
   Importação em duas etapas: 1) ler e preparar conferência; 2) importar somente após confirmação no botão azul.
   Mantém os File objects em memória, mostra progresso dentro do card e preserva horários estruturados.
*/
(function(){
  'use strict';

  const fila={docs:[],backup:[]};
  const baseRestore=window.importarDadosJson;
  const baseImport=window.importarListaColaboradores;
  const LIB={
    pdf:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    ocr:'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
  };

  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
  const key=f=>[f.name,f.size,f.lastModified,f.type].join('|');
  const dedupe=arr=>[...new Map(arr.map(f=>[key(f),f])).values()];
  function fmt(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
  function status(t,pct){
    ensureDocsUi();const e=document.getElementById('fsImportLiveStatus');if(e)e.textContent=t;
    if(Number.isFinite(pct))progress(pct,t);
  }
  function bottomStatus(t){try{if(typeof setImportStatus==='function')setImportStatus(t)}catch(_){} }
  function overallFromLabel(label,p){const m=String(label||'').match(/(\d+)\/(\d+)/);if(!m)return Math.round((p||0)*100);const i=Number(m[1]),n=Math.max(1,Number(m[2]));return Math.max(0,Math.min(100,Math.round((((i-1)+(p||0))/n)*100)));}
  function progress(pct,label){
    const p=Math.max(0,Math.min(100,Number(pct)||0));lastProgress={pct:p,label:label||lastProgress.label};ensureDocsUi();
    const box=docsCard()?.querySelector('.fsImportProgress')||document.querySelector('.fsImportProgress');if(!box)return;box.style.display='block';box.classList.add('fsActive');
    const fill=box.querySelector('.fsImportProgressFill'),num=box.querySelector('.fsImportProgressNum'),txt=box.querySelector('.fsImportProgressText');
    if(fill)fill.style.width=p+'%';if(num)num.textContent=Math.round(p)+'%';if(txt&&label)txt.textContent=label;
  }
  function resetProgress(){lastProgress={pct:0,label:'Preparando leitura…'};const box=docsCard()?.querySelector('.fsImportProgress')||document.querySelector('.fsImportProgress');if(box){box.style.display='none';box.classList.remove('fsActive');const f=box.querySelector('.fsImportProgressFill');if(f)f.style.width='0%';}}


  function css(){
    if(document.getElementById('fsImport713Style'))return;
    const st=document.createElement('style');st.id='fsImport715Style';st.textContent=`
      .fsFileQueue{margin-top:10px;padding:11px 12px;border:1px solid rgba(56,189,248,.34);border-radius:13px;background:rgba(15,23,42,.48);font-size:12px;line-height:1.4}
      .fsFileQueueHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.fsFileQueueHead b{color:#e2e8f0}.fsFileQueueClear{border:0!important;width:auto!important;min-height:0!important;padding:5px 9px!important;border-radius:8px!important;background:rgba(239,68,68,.14)!important;color:#fecaca!important;font-size:11px!important}
      .fsFileReady{font-weight:850;color:#67e8f9;margin-bottom:5px}.fsFileItem{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid rgba(148,163,184,.12);color:#cbd5e1}.fsFileName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fsFileSize{white-space:nowrap;color:#94a3b8}.fsFileEmpty{color:#94a3b8}
      #fsImportLiveStatus{margin-top:8px;padding:9px 10px;border-radius:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.18);font-size:12px;font-weight:750;color:#0f3f83}
      .fsImportReading{opacity:.72;pointer-events:none}
      .fsImportProgress{display:none;margin-top:9px;padding:10px;border-radius:11px;background:#eef5ff;border:1px solid #cfe0f7}
      .fsImportProgressHead{display:flex;justify-content:space-between;gap:10px;font-size:11px;font-weight:850;color:#123b72;margin-bottom:6px}.fsImportProgressText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fsImportProgressTrack{height:12px;border-radius:999px;background:#dbe7f6;overflow:hidden}.fsImportProgressFill{height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#0b2f82,#22c7e8);transition:width .18s ease}
      .fsImportSelectedNow{margin-top:8px;padding:8px 10px;border-radius:10px;background:#f0f8ff;border:1px solid #c9def4;color:#123b72;font-size:11px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fsImportProgress.fsActive{display:block!important}.fsFileQueue.fsReading{border-color:#6bb7ff;background:#eef6ff;color:#123b72}.fsFileQueue.fsReading .fsFileQueueHead b,.fsFileQueue.fsReading .fsFileItem{color:#123b72}
      .fsConferenceSummary{margin:9px 0 7px;padding:10px 12px;border-radius:11px;background:#eef9f2;border:1px solid #bfe7ca;color:#14532d;font-size:12px;font-weight:800;line-height:1.35}.fsConferenceSummary.warn{background:#fff8e8;border-color:#f5d48b;color:#7c4a03}
    `;document.head.appendChild(st);
  }

  let reading=false,lastProgress={pct:0,label:''};
  function getInput(type){return document.getElementById(type==='docs'?'listaInput':'backupInput')}
  function docsCard(){const input=getInput('docs');return input?.closest?.('.toolCard')||input?.parentElement||null}
  function ensureDocsUi(){
    const input=getInput('docs');if(!input)return null;
    const box=queueBox(input,'docs');
    let selected=input.parentElement?.querySelector('.fsImportSelectedNow');
    if(!selected){selected=document.createElement('div');selected.className='fsImportSelectedNow';input.insertAdjacentElement('afterend',selected)}
    selected.textContent=fila.docs.length?`✓ ${fila.docs.length} arquivo(s) selecionado(s): ${fila.docs.map(f=>f.name).join(' • ')}`:'Nenhum arquivo selecionado para leitura.';
    if(box){box.classList.toggle('fsReading',reading)}
    let live=document.getElementById('fsImportLiveStatus');if(!live&&box){live=document.createElement('div');live.id='fsImportLiveStatus';box.insertAdjacentElement('afterend',live)}
    if(live&&!live.textContent)live.textContent='Selecione PDF, PNG, JPG, TXT ou CSV. O arquivo permanecerá na fila até a leitura terminar.';
    let pg=docsCard()?.querySelector('.fsImportProgress');if(!pg&&live){pg=document.createElement('div');pg.className='fsImportProgress';pg.innerHTML='<div class="fsImportProgressHead"><span class="fsImportProgressText">Preparando leitura…</span><span class="fsImportProgressNum">0%</span></div><div class="fsImportProgressTrack"><div class="fsImportProgressFill"></div></div>';live.insertAdjacentElement('afterend',pg)}
    if(pg&&reading){pg.classList.add('fsActive');pg.style.display='block';const fill=pg.querySelector('.fsImportProgressFill'),num=pg.querySelector('.fsImportProgressNum'),txt=pg.querySelector('.fsImportProgressText');if(fill)fill.style.width=(lastProgress.pct||0)+'%';if(num)num.textContent=Math.round(lastProgress.pct||0)+'%';if(txt&&lastProgress.label)txt.textContent=lastProgress.label}
    return {box,live,pg,selected};
  }
  function queueBox(input,type){
    if(!input)return null;let box=input.parentElement?.querySelector(`.fsFileQueue[data-type="${type}"]`);
    if(!box){box=document.createElement('div');box.className='fsFileQueue';box.dataset.type=type;input.insertAdjacentElement('afterend',box)}return box;
  }
  function draw(type){
    css();const input=getInput(type);if(!input)return;input.dataset.fsManaged='715';const files=fila[type],box=queueBox(input,type);if(!box)return;
    box.innerHTML=`<div class="fsFileQueueHead"><b>${type==='docs'?'Arquivos para leitura':'Backup selecionado'}</b>${files.length?`<button type="button" class="fsFileQueueClear" data-clear="${type}">Limpar</button>`:''}</div>`+
      (files.length?`<div class="fsFileReady">✓ ${files.length} arquivo(s) selecionado(s)</div>${files.map(f=>`<div class="fsFileItem"><span class="fsFileName" title="${esc(f.name)}">${esc(f.name)}</span><span class="fsFileSize">${fmt(f.size)}</span></div>`).join('')}`:`<div class="fsFileEmpty">Nenhum arquivo selecionado.</div>`);
    if(type==='docs')setTimeout(ensureDocsUi,0);
  }
  function drawAll(){draw('docs');draw('backup')}
  function capture(input,type){
    const files=[...(input.files||[])];if(!files.length)return;
    fila[type]=type==='docs'?dedupe([...fila[type],...files]):files.slice(0,1);draw(type);
    if(type==='docs'){ensureDocsUi();status(`${fila.docs.length} arquivo(s) selecionado(s). Clique em “Ler arquivos para conferência”.`);requestAnimationFrame(ensureDocsUi);setTimeout(ensureDocsUi,120);}
  }

  function load(src,keyName){
    if(window[keyName])return Promise.resolve(window[keyName]);window.__fsImport715=window.__fsImport715||{};if(window.__fsImport715[src])return window.__fsImport715[src];
    window.__fsImport715[src]=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';const to=setTimeout(()=>reject(new Error('Tempo excedido ao preparar o leitor de arquivos.')),30000);s.onload=()=>{clearTimeout(to);window[keyName]?resolve(window[keyName]):reject(new Error('Leitor carregado, mas não inicializado.'))};s.onerror=()=>{clearTimeout(to);reject(new Error('Não foi possível carregar o leitor. Verifique a internet.'))};document.head.appendChild(s)}).catch(e=>{delete window.__fsImport715[src];throw e});
    return window.__fsImport715[src];
  }
  function pdfLines(items){
    const groups=[];for(const it of items){const y=Math.round((it.transform&&it.transform[5])||0);let g=groups.find(x=>Math.abs(x.y-y)<=3);if(!g){g={y,items:[]};groups.push(g)}g.items.push(it)}
    return groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>((a.transform&&a.transform[4])||0)-((b.transform&&b.transform[4])||0)).map(x=>x.str).join(' ')).join('\n');
  }
  async function ocrCanvas(canvas,label){
    if(!window.Tesseract)await load(LIB.ocr,'Tesseract');
    const r=await Tesseract.recognize(canvas,'por+eng',{logger:m=>{if(m.status==='recognizing text')status(`${label}: reconhecendo ${Math.round((m.progress||0)*100)}%`,overallFromLabel(label,m.progress||0))},tessedit_pageseg_mode:'4',preserve_interword_spaces:'1'});return r?.data?.text||'';
  }
  async function imageCanvas(file){
    let src,cleanup=()=>{};if('createImageBitmap' in window){try{src=await createImageBitmap(file);cleanup=()=>{try{src.close()}catch(_){}}}catch(_){}}
    if(!src){const u=URL.createObjectURL(file);cleanup=()=>URL.revokeObjectURL(u);src=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('Não consegui abrir '+file.name));im.src=u})}
    try{const w=src.width||src.naturalWidth,h=src.height||src.naturalHeight;if(!w||!h)throw new Error('Imagem sem dimensões válidas.');const scale=Math.min(2.6,3000/w),c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,c.width,c.height);return c}finally{cleanup()}
  }
  function parsedCount(text,name){try{return (window.fsAnalisarTextosEscala?.([{texto:text,nome:name}])||[]).length}catch(_){return 0}}
  async function readFile(file,i,total){
    const label=`${i+1}/${total} • ${file.name}`;status(`${label}: abrindo…`,overallFromLabel(label,.03));
    if(file.type.includes('text')||/\.(txt|csv)$/i.test(file.name))return [{texto:await file.text(),nome:file.name}];
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
      if(!window.pdfjsLib)await load(LIB.pdf,'pdfjsLib');pdfjsLib.GlobalWorkerOptions.workerSrc=LIB.worker;const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
      for(let p=1;p<=pdf.numPages;p++){status(`${label}: lendo página ${p}/${pdf.numPages}`,overallFromLabel(label,Math.max(.08,(p-1)/Math.max(1,pdf.numPages))));const page=await pdf.getPage(p),ct=await page.getTextContent();let text=pdfLines(ct.items);if(parsedCount(text,`${file.name} — página ${p}`)<2){try{const vp=page.getViewport({scale:2.4}),c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;text+='\n'+await ocrCanvas(c,`${label} • página ${p}`)}catch(e){console.warn('OCR PDF complementar:',e)}}out.push({texto:text,nome:`${file.name} — página ${p}`})}return out;
    }
    if(file.type.startsWith('image/')||/\.(png|jpe?g|webp|bmp)$/i.test(file.name)){const c=await imageCanvas(file);let t=await ocrCanvas(c,label);if(parsedCount(t,file.name)<3){try{const r=await Tesseract.recognize(c,'por+eng',{logger:m=>{if(m.status==='recognizing text')status(`${label}: segunda leitura ${Math.round((m.progress||0)*100)}%`,overallFromLabel(label,m.progress||0))},tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});t+='\n'+(r?.data?.text||'')}catch(_){}}return [{texto:t,nome:file.name}]}
    throw new Error('Formato não reconhecido: '+file.name);
  }

  const FUNCOES_FALLBACK=[
    [/gerente\s+de\s+cr[eé]dito/i,'Gerente de Crédito'],[/gerente\s+de\s+vendas/i,'Gerente de Vendas'],
    [/assist\.?\s*administrativ[oa]?|assistente\s+administrativ[oa]?/i,'Assistente Administrativo'],[/operador[a]?\s+de\s+caixa/i,'Operadora de Caixa'],
    [/auxiliar\s+de\s+limpe[zçc]a/i,'Auxiliar de Limpeza'],[/atendente\s+de\s+loja/i,'Atendente de Loja'],
    [/armazenista/i,'Armazenista'],[/faturista/i,'Faturista'],[/vendedor\s*\(?a?\)?|vendedora?/i,'Vendedor(a)']
  ];
  function normName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}
  function lev(a,b){a=normName(a);b=normName(b);const m=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let ant=m[0];m[0]=i;for(let j=1;j<=b.length;j++){const x=m[j];m[j]=Math.min(m[j]+1,m[j-1]+1,ant+(a[i-1]===b[j-1]?0:1));ant=x}}return m[b.length]}
  function matchBase(nome){const base=[...(window.state?.pessoas||[]),...((typeof DEFAULT_PESSOAS!=='undefined'&&Array.isArray(DEFAULT_PESSOAS))?DEFAULT_PESSOAS:[])];let best=null,score=1;for(const p of base){if(!p?.nome)continue;const d=lev(nome,p.nome)/Math.max(normName(nome).length,normName(p.nome).length,1);if(d<score){score=d;best=p}}return score<=.34?best:null}
  function looseTimes(t){const out=[];const re=/(?:^|\D)([0-2]?\d)\s*(?::|\.|h)?\s*([0-5]\d)(?=\D|$)/g;let m;while((m=re.exec(String(t||'')))){const h=Number(m[1]),mi=Number(m[2]);if(h<=23)out.push(String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0'))}return out}
  function h4(a){return a?.length>=4?{ativo:true,entrada:a[0],almocoIni:a[1],almocoFim:a[2],saida:a[3]}:a?.length>=2?{ativo:true,entrada:a[0],almocoIni:a[0],almocoFim:a[0],saida:a[1]}:null}
  function rowBlocks(text){const lines=String(text||'').replace(/\r/g,'\n').split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean),out=[];let cur=null;for(const line of lines){const m=line.match(/^\s*(\d{1,3})\s*[.)-]?\s+(.+)/);if(m&&Number(m[1])>0&&Number(m[1])<200){if(cur)out.push(cur);cur={n:Number(m[1]),txt:m[2]}}else if(cur)cur.txt+=' '+line}if(cur)out.push(cur);return out}
  function recoverRows(pages){const byNum=new Map();for(const p of pages||[]){for(const b of rowBlocks(p.texto)){const prev=byNum.get(b.n);if(!prev||String(prev.txt).length<String(b.txt).length)byNum.set(b.n,{...b,origem:p.nome})}}const rows=[];for(const b of [...byNum.values()].sort((a,b)=>a.n-b.n)){let txt=b.txt,funcao='',fi=-1,fl=0;for(const [re,f] of FUNCOES_FALLBACK){const m=txt.match(re);if(m){funcao=f;fi=m.index;fl=m[0].length;break}}let nome='';if(fi>=0)nome=txt.slice(0,fi);else nome=txt.split(/(?=\b(?:[0-2]?\d)\s*(?::|\.|h)?\s*[0-5]\d\b)/)[0];nome=nome.replace(/\b\d{4,8}\b/g,' ').replace(/[^A-Za-zÀ-ÿ' -]/g,' ').replace(/\s+/g,' ').trim();let base=matchBase(nome);if(base){nome=base.nome;if(!funcao)funcao=base.funcao||''}if(!nome||nome.length<3)nome=`Registro ${String(b.n).padStart(2,'0')} — nome a conferir`;if(!funcao)funcao='Função a conferir';const ts=looseTimes(fi>=0?txt.slice(fi+fl):txt);const hs={};if(ts.length>=4){const w=h4(ts.slice(0,4));['segunda','terca','quarta','quinta','sexta'].forEach(d=>hs[d]=w)}if(ts.length>=8){const sab=h4(ts.slice(4,8));if(sab)hs.sabado=sab}rows.push({_row:b.n,nome,funcao,horariosIndividuais:hs,diasTrabalho:Object.keys(hs),origens:[b.origem],_fallback:true,_raw:txt})}return rows}
  function mergeRecovered(items,pages){const rec=recoverRows(pages);if(!rec.length)return items||[];const out=[...(items||[])];for(const r of rec){const rn=normName(r.nome);let hit=out.find(x=>{const xn=normName(x.nome);if(!xn||!rn)return false;if(xn===rn||xn.includes(rn)||rn.includes(xn))return true;return lev(xn,rn)/Math.max(xn.length,rn.length,1)<=.28});if(hit){if(!hit.funcao||/a conferir/i.test(hit.funcao))hit.funcao=r.funcao;hit.horariosIndividuais={...(r.horariosIndividuais||{}),...(hit.horariosIndividuais||{})};hit.diasTrabalho=Array.from(new Set([...(r.diasTrabalho||[]),...(hit.diasTrabalho||[])]));hit._row=r._row}else out.push(r)}return out.sort((a,b)=>(a._row??999)-(b._row??999)||String(a.nome).localeCompare(String(b.nome),'pt-BR'))}

  function scheduleKey(h){return h?[h.entrada||'',h.almocoIni||'',h.almocoFim||'',h.saida||''].join('|'):'';}
  function scheduleText(h){if(!h)return 'horário não identificado';const ent=h.entrada||'—',sai=h.saida||'—',i=h.almocoIni||'',f=h.almocoFim||'';return `${ent} • ${i&&f?i+'/'+f:'sem intervalo'} • ${sai}`;}
  function hoursSummary(it){
    const hs=it?.horariosIndividuais||{},groups=new Map(),labels={segunda:'Seg',terca:'Ter',quarta:'Qua',quinta:'Qui',sexta:'Sex',sabado:'Sáb',domingo:'Dom'};
    ['segunda','terca','quarta','quinta','sexta','sabado','domingo'].forEach(d=>{if(!hs[d])return;const k=scheduleKey(hs[d]);if(!groups.has(k))groups.set(k,{h:hs[d],dias:[]});groups.get(k).dias.push(d)});
    if(!groups.size)return 'Horários: não identificados';
    return [...groups.values()].map(g=>{let dias=g.dias.map(d=>labels[d]||d).join('/');if(g.dias.join(',')==='segunda,terca,quarta,quinta,sexta')dias='Seg–Sex';return `${dias}: ${scheduleText(g.h)}`}).join(' | ');
  }
  function conferenceText(items){return (items||[]).map((x,i)=>{const n=Number.isFinite(Number(x._row))?Number(x._row):i+1;const pend=x._fallback&&(/a conferir/i.test(x.nome)||/a conferir/i.test(x.funcao))?' ⚠ CONFERIR':'';return `${String(n).padStart(2,'0')}. ${x.nome} | ${x.funcao}${pend} | ${hoursSummary(x)}`}).join('\n');}
  function inferExpected(pages,found){
    const nums=[];(pages||[]).forEach(p=>String(p.texto||'').split(/\n+/).forEach(l=>{const m=l.match(/^\s*(\d{1,3})\s+(?=[A-Za-zÀ-ÿ])/);if(m){const n=Number(m[1]);if(n>0&&n<200)nums.push(n)}}));
    if(!nums.length)return null;const max=Math.max(...nums),uniq=new Set(nums).size;if(max>=found&&max<=found+25)return max;if(uniq>=found&&uniq<=found+25)return uniq;return null;
  }
  function showConferenceSummary(found,expected,withHours,errors){
    const ta=document.getElementById('importText');if(!ta)return;let el=document.getElementById('fsConferenceSummary');if(!el){el=document.createElement('div');el.id='fsConferenceSummary';el.className='fsConferenceSummary';ta.insertAdjacentElement('beforebegin',el)}
    const miss=expected&&expected>found?expected-found:0;el.className='fsConferenceSummary'+(miss?' warn':'');el.innerHTML=miss?`⚠️ Documento sugere <b>${expected}</b> registro(s) e <b>${found}</b> foram recuperados para conferência. Há ${miss} possível(is) registro(s) ainda não separável(is) pelo OCR. • ${withHours} com horários.`:`✓ <b>${found}</b> colaborador(es) reconhecido(s) para conferência • ${withHours} com horários${errors?` • ${errors} arquivo(s) com falha parcial`:''}.`;
  }
  function syncPendingFromConference(){
    const pend=window.fsImportacaoEstruturadaPendente,ta=document.getElementById('importText');if(!pend?.itens?.length||!ta)return pend;
    const lines=String(ta.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean),out=[];
    lines.forEach((line,seq)=>{const m=line.match(/^(?:(\d+)\.\s*)?([^|]+?)\s*\|\s*([^|]+?)(?:\s*\||$)/);if(!m)return;const row=m[1]?Number(m[1]):null;const src=(row?pend.itens.find(x=>Number(x._row)===row):null)||pend.itens[seq];if(!src)return;out.push({...src,nome:m[2].replace(/⚠.*$/,'').trim(),funcao:m[3].replace(/⚠.*$/,'').trim()})});
    if(out.length){const used=new Set(out.map(x=>x._row).filter(x=>x!=null));pend.itens=[...out,...pend.itens.filter(x=>x._row!=null&&!used.has(x._row))]}return pend;
  }
  async function applyConference(){
    const pend=syncPendingFromConference(),ta=document.getElementById('importText');if(!pend?.itens?.length){bottomStatus('Nenhum colaborador conferido para importar.');return alert('Não há uma lista conferida pronta para importar. Primeiro leia o arquivo.')}
    if(typeof baseImport!=='function')return alert('O importador da plataforma não foi carregado.');
    const pretty=ta?.value||'',basic=pend.itens.map(x=>`${x.nome} - ${x.funcao}`).join('\n');if(ta)ta.value=basic;
    try{const total=pend.itens.length;await Promise.resolve(baseImport());bottomStatus(`Importação concluída ✓ ${total} colaborador(es) aplicados localmente. A nuvem continua manual.`);if(ta)ta.value=pretty;}
    catch(e){console.error(e);if(ta)ta.value=pretty;alert('Falha ao importar a lista conferida: '+(e.message||e))}
  }

  async function runRead(){
    if(!fila.docs.length){const inp=getInput('docs');if(inp?.files?.length)capture(inp,'docs')}
    const files=fila.docs.slice();if(!files.length){status('Nenhum arquivo selecionado.');return}
    if(files.length>12){status('Use no máximo 12 arquivos por vez.');return}
    const btn=[...document.querySelectorAll('button')].find(b=>/ler arquivos para conferência|ler e aplicar arquivos|ler arquivos selecionados|ler arquivo \/ imagem/i.test(b.textContent||''));
    if(btn){btn.disabled=true;btn.classList.add('fsImportReading');btn.dataset.oldText=btn.textContent;btn.textContent='Lendo…'}
    reading=true;ensureDocsUi();resetProgress();progress(1,'Preparando leitura…');bottomStatus('Leitura em andamento. Aguarde a conferência antes de importar.');
    try{
      let pages=[],errors=[];for(let i=0;i<files.length;i++){try{pages.push(...await readFile(files[i],i,files.length));progress(Math.round(((i+1)/files.length)*100),`${i+1}/${files.length} • ${files[i].name}: leitura concluída`)}catch(e){console.error(e);errors.push(`${files[i].name}: ${e.message||e}`)}}
      if(!pages.length)throw new Error(errors[0]||'Nenhum conteúdo pôde ser lido.');
      const analyzer=window.fsAnalisarTextosEscala;if(typeof analyzer!=='function')throw new Error('Analisador da escala não foi carregado.');
      let items=analyzer(pages)||[];items=mergeRecovered(items,pages);const ta=document.getElementById('importText');
      if(!items.length){const raw=pages.map(p=>`### ${p.nome}\n${p.texto}`).join('\n\n');if(ta)ta.value=raw;progress(100,'Leitura concluída sem registros seguros');bottomStatus('Arquivo lido, mas nenhum colaborador foi reconhecido com segurança. O texto bruto ficou disponível para revisão.');return}
      const week=pages.some(p=>/segunda|segunda[- ]?feira/i.test(p.texto)),sat=pages.some(p=>/s[aá]bado/i.test(p.texto)),sun=pages.some(p=>/domingo|descanso\s+semanal/i.test(p.texto));
      const expected=inferExpected(pages,items.length);
      window.fsImportacaoEstruturadaPendente={itens:items,modoDetectado:(week&&(sat||sun))?'6x1':null,arquivos:files.length,arquivosLidos:files.length-errors.length,falhas:errors,esperados:expected};
      if(ta){ta.value=conferenceText(items);ta.scrollIntoView({behavior:'smooth',block:'center'})}
      const mode=document.getElementById('importMode');if(mode)mode.value='replace';const withHours=items.filter(x=>Object.keys(x.horariosIndividuais||{}).length).length;
      showConferenceSummary(items.length,expected,withHours,errors.length);progress(100,'Leitura concluída • confira a lista antes de importar');
      const miss=expected&&expected>items.length?` Atenção: o documento sugere ${expected} registros; ${expected-items.length} pode(m) precisar de ajuste manual.`:'';
      status(`${items.length} colaborador(es) reconhecido(s), ${withHours} com horários. Confira abaixo e só depois clique no botão azul.`,100);
      bottomStatus(`Conferência pronta: ${items.length} colaborador(es) reconhecido(s).${miss} Nada foi importado ainda.`);
    }catch(e){console.error('FS v714 importação:',e);status('Falha na leitura: '+(e.message||e));bottomStatus('Falha na leitura: '+(e.message||e));}
    finally{reading=false;if(btn){btn.disabled=false;btn.classList.remove('fsImportReading');btn.textContent='Ler arquivos para conferência';delete btn.dataset.oldText}draw('docs');ensureDocsUi();const pg=docsCard()?.querySelector('.fsImportProgress');if(pg&&lastProgress.pct>=100){pg.classList.add('fsActive');pg.style.display='block'}}
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
    const btn=e.target.closest?.('button');if(!btn)return;const text=(btn.textContent||'').toLowerCase();if(text.includes('ler arquivos para conferência')||text.includes('ler e aplicar arquivos')||text.includes('ler arquivos selecionados')||text.includes('ler arquivo / imagem')){e.preventDefault();e.stopImmediatePropagation();runRead()}else if(text.includes('importar lista conferida')){e.preventDefault();e.stopImmediatePropagation();applyConference()}else if(text.includes('restaurar backup')){e.preventDefault();e.stopImmediatePropagation();runRestore()}},true);

  function wire(){drawAll();ensureDocsUi();document.querySelectorAll('button').forEach(btn=>{const t=(btn.textContent||'').toLowerCase();if(t.includes('ler e aplicar arquivos')||t.includes('ler arquivos selecionados')||t.includes('ler arquivo / imagem'))btn.textContent='Ler arquivos para conferência'})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,250));else setTimeout(wire,100);
  new MutationObserver(()=>{clearTimeout(window.__fsImp715Wire);window.__fsImp715Wire=setTimeout(wire,80)}).observe(document.documentElement,{childList:true,subtree:true});
  window.fsImport715Queue=fila;window.lerArquivoAssistido=runRead;window.fsAplicarImportacaoConferida=applyConference;try{lerArquivoAssistido=runRead}catch(_){};
})();
