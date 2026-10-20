(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const avatar=p=>p.fsFoto?`<img class="fsV811BaseAvatar" src="${p.fsFoto}" alt="Foto de ${esc(p.nome)}">`:`<span class="fsV811BaseAvatar">${esc(initials(p.nome))}</span>`;
  function stableRenderBase(){
    const root=document.getElementById('baseContent');if(!root||!window.state)return;
    const groups=typeof byFunc==='function'?byFunc(state.pessoas):[],filter=typeof baseFuncFilter!=='undefined'?baseFuncFilter:null,list=filter?state.pessoas.filter(p=>p.funcao===filter):state.pessoas;
    const sorted=list.slice().sort((a,b)=>String(a.funcao||'Sem função').localeCompare(String(b.funcao||'Sem função'),'pt-BR')||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
    let previous='';
    const rows=sorted.map(p=>{const fn=String(p.funcao||'Sem função').trim()||'Sem função',head=fn!==previous?`<tr class="baseGrupoLinha"><td colspan="5"><span class="fsGrupoFuncaoNome fsGrupoUnico">${typeof formatarFuncao==='function'?formatarFuncao(fn):esc(fn)}</span></td></tr>`:'';previous=fn;const st=typeof status==='function'&&typeof totalPessoa==='function'?status(totalPessoa(p)):['—','',''];return head+`<tr data-person-id="${esc(p.id)}"><td class="fsV811PhotoCell">${avatar(p)}</td><td class="name fsV809NameClean">${esc(p.nome)}</td><td class="func">${typeof formatarFuncao==='function'?formatarFuncao(p.funcao):esc(p.funcao)}</td><td><span class="badge ${esc(st[1])}">${st[0]==='OK'?'✅ Jornada OK':'⚠ Divergência '+esc(st[2]||'')}</span></td><td class="noPrint"><button class="editBtn" onclick="editarPessoa('${esc(p.id)}')">✏️</button></td></tr>`}).join('');
    const cards=groups.map(([f,q])=>`<div class="summaryCard ${filter===f?'filterActive':''}" onclick="limparFiltroBase()" ondblclick="filtrarBaseFuncao('${esc(f)}')" title="Clique duas vezes para filtrar"><b>${typeof formatarFuncao==='function'?formatarFuncao(f):esc(f)}</b><span>${q}</span></div>`).join('');
    const notice=filter?`<div class="note"><b>Filtro ativo:</b> ${typeof formatarFuncao==='function'?formatarFuncao(filter):esc(filter)}. Clique uma vez em qualquer card para mostrar todos novamente.</div>`:'';
    root.innerHTML=`<div class="summaryCards">${cards}</div>${notice}<div class="tableWrap fsV811StableTable"><table class="baseAgrupadaTable fsFinalEstavel" data-fs-stable-v816="1"><colgroup><col class="photo"><col class="person"><col class="role"><col class="journey"><col class="edit"></colgroup><thead><tr><th>Foto</th><th>Nome</th><th>Função</th><th>Situação da jornada</th><th>Editar</th></tr></thead><tbody>${rows}</tbody></table></div><button class="secondary noPrint" onclick="novoPessoa()">+ Novo colaborador</button>`;
  }
  function install(){window.renderBase=stableRenderBase;try{renderBase=stableRenderBase}catch(e){}stableRenderBase()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,350));else setTimeout(install,350);
})();
