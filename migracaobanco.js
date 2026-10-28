/* FS Escala Operacional - Migracao do banco para a plataforma nova (v905)
 *
 * Inclua no index.html do GitHub Pages, depois dos outros scripts:
 *   <script src="./migracaobanco.js?v=905"></script>
 *
 * O que faz: na Central de Acessos, para o Desenvolvedor (ou administrador geral), aparece o cartao
 * "Migracao para a plataforma nova" com dois botoes. Os dois chamam a acao migrateToPlatform da nuvem
 * (code.gs v905):
 *  - "Enviar direto para a plataforma nova": a nuvem manda filial por filial para o banco novo e, no fim,
 *    regionais e acessos. Seu usuario na plataforma nova recebe o aviso "Dados importados diretamente".
 *  - "Gerar arquivo no Drive": a exportacao vai para a pasta "FS Nuvem - Exportacoes" do Meu Drive e a
 *    plataforma nova avisa "Dados importados pro Drive". O envio direto tambem cai aqui quando nao e possivel
 *    (sem chave configurada, chave recusada ou plataforma fora do ar).
 * A chave da plataforma fica so na nuvem (Propriedades do script); este arquivo nunca a ve.
 * Tambem da para abrir pelo console: fsMigracaoBanco.abrir()
 */
(function () {
  'use strict';
  if (window.fsMigracaoBanco) return;

  const K = { url: 'fs_cloud_url_v705', token: 'fs_cloud_admin_v705', branch: 'fs_cloud_branch_v705', session: 'fs_access_token', device: 'fs_device_id' };
  const TEMPO_MAXIMO_MS = 6.5 * 60 * 1000; // o Apps Script encerra em 6 minutos
  const ROTULO = { criada: 'Criada', atualizada: 'Atualizada', pulada: 'Sem mudança', conferida: 'Sem mudança', erro: 'Com erro', pendente: 'Pendente' };
  let info = null;
  let infoEm = 0;
  let infoPromise = null;
  let rodando = false;

  const ler = (k) => {
    try {
      return localStorage.getItem(k) || '';
    } catch (_) {
      return '';
    }
  };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const linkGoogle = (u) => (/^https:\/\/(drive|docs)\.google\.com\//.test(String(u || '')) ? String(u) : '');
  const quando = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  /** Chamada JSONP para a nuvem com a sessao (ou o codigo de administrador) deste aparelho, como a Central faz. */
  function nuvem(acao, extra, tempoMs) {
    return new Promise((resolve, reject) => {
      const url = ler(K.url);
      if (!url) return reject(new Error('A nuvem não está configurada neste aparelho.'));
      const p = Object.assign({ action: acao, branchId: ler(K.branch), deviceId: ler(K.device) }, extra || {});
      const sessao = ler(K.session);
      if (sessao) p.session = sessao;
      else p.token = ler(K.token);
      const cb = 'fsMigCb' + Date.now() + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const fim = (erro, dados) => {
        clearTimeout(timer);
        try {
          delete window[cb];
          s.remove();
        } catch (_) {}
        erro ? reject(erro) : resolve(dados);
      };
      const timer = setTimeout(() => fim(new Error('A nuvem não respondeu a tempo. Confira o histórico da planilha antes de tentar de novo.')), tempoMs || 20000);
      window[cb] = (dados) => fim(null, dados);
      p.callback = cb;
      s.src = url + (url.includes('?') ? '&' : '?') + new URLSearchParams(p);
      s.onerror = () => fim(new Error('Não foi possível falar com a nuvem.'));
      document.head.appendChild(s);
    });
  }

  function estilos() {
    if (document.getElementById('fsMigEstilos')) return;
    const st = document.createElement('style');
    st.id = 'fsMigEstilos';
    st.textContent = `
.fsMigCard{border:1px solid #c7d2fe;background:linear-gradient(180deg,#eef2ff,#fff);border-radius:16px;padding:16px;margin:12px 0;color:#0f172a}
.fsMigCard h2{margin:0;font-size:17px;color:#071d68}.fsMigCard p{margin:6px 0 0;font-size:13px;color:#475569}
.fsMigAcoes{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.fsMigBtn{border:0;border-radius:10px;padding:10px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#071d68;color:#fff}
.fsMigBtn.sec{background:#fff;color:#071d68;border:1px solid #c7d2fe}.fsMigBtn:disabled{opacity:.55;cursor:wait}
.fsMigOpcoes{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:12px;color:#334155}.fsMigOpcoes label{display:flex;gap:6px;align-items:center}
.fsMigEstado{display:inline-flex;gap:6px;align-items:center;margin-top:8px;font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px;background:#ecfdf5;color:#065f46}
.fsMigEstado.alerta{background:#fffbeb;color:#92400e}
.fsMigFundo{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.fsMigJanela{background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:90vh;overflow:auto;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);color:#0f172a;font-size:14px}
.fsMigJanela h3{margin:0 0 6px;font-size:18px;color:#071d68}.fsMigJanela ul{margin:8px 0;padding-left:18px}.fsMigJanela li{margin:3px 0}
.fsMigNumeros{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:12px 0}
.fsMigNumeros div{background:#f1f5f9;border-radius:10px;padding:8px 10px}.fsMigNumeros b{display:block;font-size:20px;color:#071d68}.fsMigNumeros small{color:#475569}
.fsMigAviso{background:#fffbeb;color:#92400e;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:13px}
.fsMigOk{background:#ecfdf5;color:#065f46;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:13px}
.fsMigRodape{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}
.fsMigGiro{width:34px;height:34px;border-radius:50%;border:4px solid #c7d2fe;border-top-color:#071d68;animation:fsMigGira 1s linear infinite;margin:6px auto 12px}
@keyframes fsMigGira{to{transform:rotate(360deg)}}`;
    document.head.appendChild(st);
  }

  function janela(html) {
    estilos();
    document.getElementById('fsMigJanela')?.remove();
    const fundo = document.createElement('div');
    fundo.id = 'fsMigJanela';
    fundo.className = 'fsMigFundo';
    fundo.innerHTML = `<div class="fsMigJanela" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(fundo);
    fundo.querySelectorAll('[data-fechar]').forEach((b) => (b.onclick = () => fundo.remove()));
    return fundo;
  }

  async function carregarInfo(forcar) {
    if (!forcar && info && Date.now() - infoEm < 60000) return info;
    if (infoPromise) return infoPromise;
    infoPromise = nuvem('migrationInfo', {}, 20000)
      .then((r) => {
        info = r && r.ok ? r : null;
        infoEm = Date.now();
        return info;
      })
      .finally(() => {
        infoPromise = null;
      });
    return infoPromise;
  }

  function textoUltima(u) {
    if (!u) return 'Nenhuma migração feita por aqui ainda.';
    return `Última: ${esc(u.title || '')} em ${esc(quando(u.when))}${u.by ? ` por ${esc(u.by)}` : ''}.`;
  }

  function cartao(i) {
    const sec = document.createElement('section');
    sec.className = 'fsAccessCard fsAccessWide fsMigCard';
    sec.id = 'fsMigCard';
    sec.innerHTML = `<h2>Migração para a plataforma nova</h2>
<p>Leva filiais, regionais e acessos para o FS Escala novo. Filiais que não mudaram desde a última migração ficam como estão.</p>
<span class="fsMigEstado ${i.keyConfigured ? '' : 'alerta'}">${i.keyConfigured ? `Envio direto pronto: ${esc(i.platformUrl)}` : 'Chave da plataforma não configurada: o envio vai para o Drive'}</span>
<p>${textoUltima(i.last)}</p>
<div class="fsMigOpcoes"><label><input type="checkbox" data-mig-forcar> Substituir também filiais editadas na plataforma nova</label><label><input type="checkbox" data-mig-completo> Incluir as versões anteriores no arquivo do Drive</label></div>
<div class="fsMigAcoes"><button class="fsMigBtn" data-mig-modo="direct">Enviar direto para a plataforma nova</button><button class="fsMigBtn sec" data-mig-modo="drive">Gerar arquivo no Drive</button></div>`;
    sec.querySelectorAll('[data-mig-modo]').forEach((b) => (b.onclick = () => confirmar(b.dataset.migModo, sec.querySelector('[data-mig-forcar]').checked, sec.querySelector('[data-mig-completo]').checked)));
    return sec;
  }

  function confirmar(modo, forcar, completo) {
    if (rodando) return;
    const direto = modo === 'direct';
    const j = janela(`<h3>${direto ? 'Enviar direto para a plataforma nova?' : 'Gerar o arquivo no Drive?'}</h3>
<p>${direto ? 'A nuvem envia cada filial ao banco novo e, no fim, as regionais e os acessos. Se o envio direto não for possível, o arquivo vai para o Drive.' : 'A exportação completa vai para a pasta “FS Nuvem - Exportacoes” do Meu Drive (arquivo privado).'}</p>
${forcar && direto ? '<div class="fsMigAviso">Filiais editadas na plataforma nova serão substituídas pelos dados daqui.</div>' : ''}
<p>Pode levar alguns minutos. Não feche esta página até terminar.</p>
<div class="fsMigRodape"><button class="fsMigBtn sec" data-fechar>Cancelar</button><button class="fsMigBtn" data-mig-ir>${direto ? 'Enviar agora' : 'Gerar agora'}</button></div>`);
    j.querySelector('[data-mig-ir]').onclick = () => executar(modo, forcar, completo);
  }

  async function executar(modo, forcar, completo) {
    if (rodando) return;
    rodando = true;
    document.querySelectorAll('[data-mig-modo]').forEach((b) => (b.disabled = true));
    const inicio = Date.now();
    const j = janela(`<div class="fsMigGiro" aria-hidden="true"></div><h3 style="text-align:center">${modo === 'direct' ? 'Enviando para a plataforma nova…' : 'Gerando o arquivo no Drive…'}</h3><p style="text-align:center" data-mig-tempo>Isto pode levar alguns minutos.</p>`);
    const relogio = setInterval(() => {
      const t = j.querySelector('[data-mig-tempo]');
      if (t) t.textContent = `Trabalhando há ${Math.round((Date.now() - inicio) / 1000)} s. Não feche esta página.`;
    }, 1000);
    try {
      const r = await nuvem('migrateToPlatform', { mode: modo, force: forcar ? '1' : '0', complete: completo ? '1' : '0' }, TEMPO_MAXIMO_MS);
      if (!r || !r.ok) throw new Error((r && r.message) || 'A nuvem recusou a migração.');
      resultado(r);
      info = null;
      atualizarCartao(true);
    } catch (e) {
      janela(`<h3>Migração não concluída</h3><div class="fsMigAviso">${esc(e && e.message ? e.message : e)}</div><div class="fsMigRodape"><button class="fsMigBtn" data-fechar>Fechar</button></div>`);
    } finally {
      clearInterval(relogio);
      rodando = false;
      document.querySelectorAll('[data-mig-modo]').forEach((b) => (b.disabled = false));
    }
  }

  function resultado(r) {
    const s = r.summary;
    const numeros = s
      ? `<div class="fsMigNumeros"><div><b>${s.criadas}</b><small>criada(s)</small></div><div><b>${s.atualizadas}</b><small>atualizada(s)</small></div><div><b>${s.puladas}</b><small>sem mudança</small></div><div><b>${s.erros + (s.pendentes || 0)}</b><small>com erro ou pendente</small></div>${r.accesses != null ? `<div><b>${esc(r.accesses)}</b><small>acesso(s) antigo(s)</small></div>` : ''}</div>`
      : '';
    const filiais = (r.branches || []).length
      ? `<ul>${r.branches.map((b) => `<li><b>${esc(b.name || b.id)}</b>: ${esc(ROTULO[b.result] || b.result)}${b.reason ? ` — ${esc(b.reason)}` : ''}</li>`).join('')}</ul>`
      : '';
    const f = r.file;
    const arquivo = f
      ? `<p>Arquivo <b>${esc(f.name)}</b> na pasta “${esc(f.folderName)}” do Meu Drive.</p><p>${linkGoogle(f.url) ? `<a href="${esc(linkGoogle(f.url))}" target="_blank" rel="noopener">Abrir o arquivo</a>` : ''}${linkGoogle(f.folderUrl) ? ` • <a href="${esc(linkGoogle(f.folderUrl))}" target="_blank" rel="noopener">Abrir a pasta</a>` : ''}</p>`
      : '';
    const aviso = r.notified ? `<div class="fsMigOk">Aviso “${esc(r.title)}” enviado para o seu usuário na plataforma nova.</div>` : '<div class="fsMigAviso">O aviso não chegou à plataforma nova (veja os avisos abaixo).</div>';
    const motivo = r.fallback && r.reason ? `<div class="fsMigAviso">${esc(r.reason)}</div>` : '';
    const avisos = (r.warnings || []).length ? `<p><b>Avisos</b></p><ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '';
    janela(`<h3>${esc(r.title)}</h3>${motivo}${numeros}${filiais}${arquivo}${aviso}${avisos}<div class="fsMigRodape"><button class="fsMigBtn" data-fechar>Fechar</button></div>`);
  }

  /** Coloca (ou recoloca) o cartao na Central de Acessos aberta, so para quem pode migrar. */
  async function atualizarCartao(forcar) {
    const raiz = document.getElementById('fsAccessRoot');
    if (!raiz || (raiz.querySelector('#fsMigCard') && !forcar)) return;
    let i;
    try {
      i = await carregarInfo(forcar);
    } catch (_) {
      return;
    }
    if (!i || !document.body.contains(raiz)) return;
    estilos();
    raiz.querySelector('#fsMigCard')?.remove();
    const novo = cartao(i);
    const alvo = raiz.querySelector('.fsAccessBranches') || raiz.querySelector('.fsAccessGrid > :first-child');
    if (alvo) alvo.insertAdjacentElement('afterend', novo);
    else (raiz.querySelector('main') || raiz).appendChild(novo);
  }

  let espera = 0;
  const observar = () =>
    new MutationObserver(() => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const raiz = document.getElementById('fsAccessRoot');
        if (raiz && raiz.querySelector('.fsAccessGrid') && !raiz.querySelector('#fsMigCard')) atualizarCartao(false);
      }, 250);
    }).observe(document.body, { childList: true, subtree: true });

  window.fsMigracaoBanco = {
    /** Abre a escolha da migracao em qualquer tela (para o Desenvolvedor). */
    async abrir() {
      try {
        const i = await carregarInfo(true);
        if (!i) throw new Error('Somente o Desenvolvedor pode migrar o banco.');
        const j = janela(`<h3>Migração para a plataforma nova</h3><p>${textoUltima(i.last)}</p><div class="fsMigRodape"><button class="fsMigBtn sec" data-fechar>Fechar</button><button class="fsMigBtn sec" data-mig-j="drive">Gerar arquivo no Drive</button><button class="fsMigBtn" data-mig-j="direct">Enviar direto</button></div>`);
        j.querySelectorAll('[data-mig-j]').forEach((b) => (b.onclick = () => confirmar(b.dataset.migJ, false, false)));
      } catch (e) {
        janela(`<h3>Migração indisponível</h3><div class="fsMigAviso">${esc(e && e.message ? e.message : e)}</div><div class="fsMigRodape"><button class="fsMigBtn" data-fechar>Fechar</button></div>`);
      }
    },
  };

  if (document.body) observar();
  else document.addEventListener('DOMContentLoaded', observar);
})();
