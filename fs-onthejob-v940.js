/* v940 — Atalho "Primeiro acesso On The Job"
   - Botão com o símbolo do On The Job no topo da Escala e na tela de entrada da Central.
   - Controlado em Configurações: desativado (padrão), liberado para todos ou só para usuários específicos.
   - A preferência fica em state.config.onTheJob (cronograma principal), então acompanha o
     salvamento local e a sincronização da filial como as demais configurações da escala.
   - Não guarda telefone, senha nem token: só o modo, a URL e a lista de usuários liberados
     (id do membro da Central e nome). */
(function () {
  'use strict';
  const STORAGE_KEY = 'fs_escala_limpa_v381',
    ACCESS_KEY = 'fs_access_data_v1',
    TOKEN_KEY = 'fs_access_token',
    MODE_KEY = 'fs_cloud_mode_v705',
    BRANCH_KEY = 'fs_cloud_branch_v705',
    DASH_CACHE_KEY = 'fs_management_dashboard_cache_v892',
    SYMBOL = './on-the-job-simbolo.svg',
    LOGO = './on-the-job-logo.svg',
    MODES = ['off', 'todos', 'especificos'],
    ROLES = { developer: 'Desenvolvedor', global_admin: 'Desenvolvedor', consultant: 'Consultor', regional_admin: 'Administrador regional', branch_admin: 'Administrador da filial', manager: 'Gerente', editor: 'Gerente', viewer: 'Visualizador' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const json = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch (_) { return fb; } };

  function liveState() { try { return typeof state !== 'undefined' && state && state.config ? state : null; } catch (_) { return null; } }
  function sanitize(raw) {
    const c = raw && typeof raw === 'object' ? raw : {};
    const membros = (Array.isArray(c.membros) ? c.membros : [])
      .filter((m) => m && (m.id || m.nome))
      .map((m) => ({ id: String(m.id || '').slice(0, 120), nome: String(m.nome || '').slice(0, 160) }));
    const nomes = (Array.isArray(c.nomes) ? c.nomes : []).map((n) => String(n || '').trim().slice(0, 160)).filter(Boolean);
    return { modo: MODES.includes(c.modo) ? c.modo : 'off', url: String(c.url || '').trim().slice(0, 600), membros, nomes };
  }
  function getConfig() {
    const s = liveState();
    if (s) return sanitize(s.config.onTheJob);
    return sanitize(json(STORAGE_KEY, {})?.config?.onTheJob);
  }
  function setConfig(next) {
    const s = liveState(), clean = sanitize(next);
    if (!s) throw new Error('A escala ainda não terminou de carregar. Tente novamente em alguns segundos.');
    s.config.onTheJob = clean;
    if (typeof save === 'function') save();
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return clean;
  }
  function safeUrl(u) {
    try {
      const x = new URL(String(u || '').trim());
      if (x.protocol === 'https:') return x.href;
      if (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname)) return x.href;
    } catch (_) {}
    return '';
  }
  function currentUser() {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    const a = json(ACCESS_KEY, {}) || {};
    const nome = a.name || a.memberName || a.userName || a.nome || a.context?.name || '';
    const id = a.memberId || a.context?.memberId || '';
    return id || nome ? { id: String(id), nome: String(nome), role: a.role || a.context?.role || '' } : null;
  }
  function userAllowed(cfg, user) {
    if (cfg.modo === 'todos') return true;
    if (cfg.modo !== 'especificos' || !user) return false;
    if (user.id && cfg.membros.some((m) => m.id && m.id === user.id)) return true;
    const n = norm(user.nome);
    if (!n) return false;
    return cfg.membros.some((m) => !m.id && norm(m.nome) === n) || cfg.nomes.some((x) => norm(x) === n);
  }
  function enabledFor(cfg) { return !!safeUrl(cfg.url) && userAllowed(cfg, currentUser()); }
  function readOnly() { return localStorage.getItem(MODE_KEY) === 'viewer' || /[?&]view=/.test(location.search); }
  function knownMembers() {
    const d = json(DASH_CACHE_KEY, null), branch = localStorage.getItem(BRANCH_KEY) || '';
    const all = (Array.isArray(d?.members) ? d.members : []).filter((m) => m && m.active !== false && (m.id || m.name));
    const inBranch = branch ? all.filter((m) => !m.branchId || m.branchId === branch) : all;
    const seen = new Set();
    return (inBranch.length ? inBranch : all)
      .map((m) => ({ id: String(m.id || ''), nome: String(m.name || ''), role: m.role || '' }))
      .filter((m) => { const k = m.id || norm(m.nome); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  function linkHtml(cls, url, label) {
    return `<a class="${cls} noPrint" data-html2canvas-ignore="true" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir o primeiro acesso do On The Job em uma nova aba"><img src="${SYMBOL}" alt="" width="22" height="24" decoding="async"><span>${label}</span></a>`;
  }
  function paintHeader(cfg) {
    const header = document.querySelector('.top .header');
    let a = document.getElementById('fsOtjHeaderLink');
    const url = enabledFor(cfg) ? safeUrl(cfg.url) : '';
    if (!url || !header) { a?.remove(); return; }
    if (a && a.getAttribute('href') === url && a.parentElement === header) return;
    a?.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = linkHtml('fsOtjLink', url, 'Primeiro acesso <b>On The Job</b>');
    a = tmp.firstElementChild; a.id = 'fsOtjHeaderLink';
    header.appendChild(a);
  }
  function paintGateway(cfg) {
    const form = document.querySelector('#fsCentralGatewayV812 form');
    let a = document.getElementById('fsOtjGatewayLink');
    // Antes da entrada não se sabe quem é o usuário: aqui o atalho só aparece no modo "todos".
    const url = cfg.modo === 'todos' ? safeUrl(cfg.url) : '';
    if (!url || !form) { a?.remove(); return; }
    if (a && a.getAttribute('href') === url) return;
    a?.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = linkHtml('fsOtjLink fsOtjGate', url, 'Primeiro acesso <b>On The Job</b>');
    a = tmp.firstElementChild; a.id = 'fsOtjGatewayLink';
    const help = form.querySelector('.fsCentralGateHelp');
    help ? help.after(a) : form.appendChild(a);
  }

  function panelHtml(cfg) {
    const ro = readOnly(), dis = ro ? 'disabled' : '', user = currentUser(), members = knownMembers();
    const ids = new Set(cfg.membros.map((m) => m.id).filter(Boolean));
    const extras = cfg.membros.filter((m) => m.id && !members.some((x) => x.id === m.id));
    const list = members.concat(extras.map((m) => ({ id: m.id, nome: m.nome || m.id, role: '', stale: true })));
    const rows = list.length
      ? list.map((m) => `<label class="fsOtjUser"><input type="checkbox" name="fsOtjMember" value="${esc(m.id)}" data-nome="${esc(m.nome)}" ${ids.has(m.id) ? 'checked' : ''} ${dis}><span><b>${esc(m.nome || 'Sem nome')}</b><small>${m.stale ? 'Liberado anteriormente' : esc(ROLES[m.role] || m.role || 'Usuário')}</small></span></label>`).join('')
      : '<div class="fsOtjEmpty">Nenhum usuário da Central encontrado neste aparelho. Abra a Central Gerencial uma vez para carregar a lista ou informe os nomes abaixo.</div>';
    const nomes = cfg.nomes.concat(cfg.membros.filter((m) => !m.id).map((m) => m.nome)).join('\n');
    const who = user ? `Este aparelho está conectado como <b>${esc(user.nome || 'usuário da Central')}</b>.` : 'Este aparelho não tem sessão da Central: no modo <b>usuários específicos</b> o botão não aparece aqui.';
    const urlOk = safeUrl(cfg.url);
    return `<div class="panelTitle">🎓 ON THE JOB — PRIMEIRO ACESSO</div><div class="content">
      <div class="fsOtjHead"><img src="${LOGO}" alt="On The Job" class="fsOtjLogo" decoding="async"><p>Mostra o botão <b>Primeiro acesso On The Job</b> no topo da Escala e abre a plataforma de treinamento em uma nova aba. Fica desligado até ser ativado aqui.</p></div>
      ${ro ? '<div class="note">Modo somente leitura: esta configuração só pode ser alterada por quem edita a escala.</div>' : ''}
      <div class="gridForm fsOtjGrid">
        <div><label for="fsOtjModo">Exibir o botão</label><select id="fsOtjModo" ${dis}>
          <option value="off" ${cfg.modo === 'off' ? 'selected' : ''}>Desativado</option>
          <option value="todos" ${cfg.modo === 'todos' ? 'selected' : ''}>Liberado para todos</option>
          <option value="especificos" ${cfg.modo === 'especificos' ? 'selected' : ''}>Somente usuários específicos</option>
        </select></div>
        <div><label for="fsOtjUrl">Endereço do primeiro acesso</label><input id="fsOtjUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false" value="${esc(cfg.url)}" placeholder="https://endereco-do-on-the-job/primeiro-acesso" ${dis}></div>
      </div>
      <div class="fsOtjWarn" id="fsOtjUrlWarn" ${cfg.modo !== 'off' && !urlOk ? '' : 'hidden'}>Informe um endereço começando com https:// — sem ele o botão fica oculto.</div>
      <div class="fsOtjUsers" id="fsOtjUsers" ${cfg.modo === 'especificos' ? '' : 'hidden'}>
        <h4>Usuários liberados</h4><p class="fsOtjHint">${who}</p>
        <div class="fsOtjUserList">${rows}</div>
        <label for="fsOtjNomes">Outros nomes (um por linha, igual ao nome usado na entrada da Central)</label>
        <textarea id="fsOtjNomes" rows="3" ${dis}>${esc(nomes)}</textarea>
      </div>
      ${ro ? '' : '<button class="primary" type="button" id="fsOtjSalvar">Salvar configuração do On The Job</button>'}
      <div class="fsOtjStatus" id="fsOtjStatus" role="status" hidden></div>
    </div>`;
  }
  function bindPanel(box) {
    const modo = box.querySelector('#fsOtjModo'), url = box.querySelector('#fsOtjUrl'), warn = box.querySelector('#fsOtjUrlWarn'), users = box.querySelector('#fsOtjUsers'), status = box.querySelector('#fsOtjStatus');
    const sync = () => { users.hidden = modo.value !== 'especificos'; warn.hidden = modo.value === 'off' || !!safeUrl(url.value); };
    modo.onchange = sync; url.oninput = sync;
    const btn = box.querySelector('#fsOtjSalvar');
    if (!btn) return;
    btn.onclick = () => {
      const value = url.value.trim();
      if (value && !safeUrl(value)) { status.hidden = false; status.className = 'fsOtjStatus err'; status.textContent = 'Endereço inválido. Use um link completo começando com https://.'; return; }
      const membros = [...box.querySelectorAll('input[name="fsOtjMember"]:checked')].map((i) => ({ id: i.value, nome: i.dataset.nome || '' }));
      const nomes = String(box.querySelector('#fsOtjNomes')?.value || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      try {
        const saved = setConfig({ modo: modo.value, url: value ? safeUrl(value) : '', membros, nomes });
        url.value = saved.url;
        refresh();
        status.hidden = false; status.className = 'fsOtjStatus ok';
        status.textContent = saved.modo === 'off' ? 'Salvo. O botão do On The Job está desativado.' : enabledFor(saved) ? 'Salvo. O botão já aparece neste aparelho.' : 'Salvo. Neste aparelho o botão continua oculto (usuário não liberado ou endereço vazio).';
      } catch (e) { status.hidden = false; status.className = 'fsOtjStatus err'; status.textContent = e.message; }
    };
  }
  function paintPanel(cfg) {
    const root = document.getElementById('configContent');
    if (!root || root.querySelector('#fsOtjConfigPanel')) return;
    const box = document.createElement('div');
    box.id = 'fsOtjConfigPanel'; box.className = 'panel noPrint fsOtjPanel';
    box.innerHTML = panelHtml(cfg);
    const backup = [...root.children].find((c) => /BACKUP/i.test(c.querySelector('.panelTitle')?.textContent || ''));
    backup ? root.insertBefore(box, backup) : root.appendChild(box);
    bindPanel(box);
  }

  function refresh() { const cfg = getConfig(); paintHeader(cfg); paintGateway(cfg); paintPanel(cfg); }
  window.fsOnTheJob = { getConfig, enabledFor: () => enabledFor(getConfig()), refresh };
  function install() {
    refresh();
    // Outros módulos alteram o DOM a cada ~35 ms; um debounce nunca dispararia. Throttle garante a execução.
    let t = 0;
    new MutationObserver(() => { if (!t) t = setTimeout(() => { t = 0; refresh(); }, 150); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', (e) => { if ([STORAGE_KEY, ACCESS_KEY, TOKEN_KEY].includes(e.key)) refresh(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
