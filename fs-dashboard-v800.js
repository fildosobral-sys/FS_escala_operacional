(function () {
  "use strict";
  const K = {
      url: "fs_cloud_url_v705",
      token: "fs_cloud_admin_v705",
      branch: "fs_cloud_branch_v705",
      branchName: "fs_cloud_branch_name_v708",
      version: "fs_cloud_version_v705",
    },
    ROLES = {
      developer: "Desenvolvedor",
      global_admin: "Desenvolvedor",
      consultant: "Consultor",
      regional_admin: "Administrador regional",
      branch_admin: "Administrador da filial",
      manager: "Gerente",
      editor: "Gerente",
      viewer: "Visualizador",
    };
  let data = null,
    region = "all",
    query = "",
    busy = false,
    autoEntry = true;
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
  const esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    norm = (s) =>
      String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    cfg = () => ({
      url: localStorage.getItem(K.url) || "",
      token: localStorage.getItem(K.token) || "",
      session: localStorage.getItem("fs_access_token") || "",
      branch: localStorage.getItem(K.branch) || "",
    }),
    role = (r) => ROLES[r] || r || "Usuário";
  function when(v) {
    if (!v) return "Não informado";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "Não informado"
      : d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
  }
  function params(action, extra) {
    const c = cfg(),
      p = Object.assign(
        {
          action,
          branchId: c.branch,
          deviceId: localStorage.getItem("fs_device_id") || "",
        },
        extra || {},
      );
    if (c.session) p.session = c.session;
    else p.token = c.token;
    return p;
  }
  function jsonp(action, extra) {
    return new Promise((resolve, reject) => {
      const c = cfg();
      if (!c.url) return reject(new Error("Nuvem não configurada."));
      const cb = "fsDashCb" + Date.now() + Math.random().toString(36).slice(2),
        s = document.createElement("script"),
        timer = setTimeout(
          () =>
            done(new Error("Tempo excedido ao consultar a Central Gerencial.")),
          25000,
        );
      function done(e, x) {
        clearTimeout(timer);
        try {
          delete window[cb];
          s.remove();
        } catch (_) {}
        e ? reject(e) : resolve(x);
      }
      window[cb] = (x) => done(null, x);
      const p = params(action, extra);
      p.callback = cb;
      s.src =
        c.url + (c.url.includes("?") ? "&" : "?") + new URLSearchParams(p);
      s.onerror = () => done(new Error("Não foi possível consultar a nuvem."));
      document.head.appendChild(s);
    });
  }
  function publicJsonp(action, extra, serviceUrl) {
    return new Promise((resolve, reject) => {
      const url = serviceUrl || cfg().url;
      if (!url) return reject(new Error("Endereço da nuvem ausente."));
      const cb =
          "fsPublicCb" + Date.now() + Math.random().toString(36).slice(2),
        s = document.createElement("script"),
        timer = setTimeout(
          () => done(new Error("Tempo excedido ao validar o acesso.")),
          25000,
        );
      function done(e, value) {
        clearTimeout(timer);
        try {
          delete window[cb];
          s.remove();
        } catch (_) {}
        e ? reject(e) : resolve(value);
      }
      window[cb] = (value) => done(null, value);
      const p = Object.assign({ action, callback: cb }, extra || {});
      s.src = url + (url.includes("?") ? "&" : "?") + new URLSearchParams(p);
      s.onerror = () =>
        done(new Error("Não foi possível validar o acesso na nuvem."));
      document.head.appendChild(s);
    });
  }
  function localState() {
    try {
      if (window.state && Array.isArray(window.state.pessoas))
        return window.state;
    } catch (_) {}
    for (const key of [
      "fs_escala_limpa_v381",
      "FS_ESCALA_STATE",
      "FS_ESCALA_OPERACIONAL_STATE",
    ])
      try {
        const x = JSON.parse(localStorage.getItem(key) || "null");
        if (x && Array.isArray(x.pessoas)) return x;
      } catch (_) {}
    return null;
  }
  function summary() {
    const s = localState();
    if (!s) return null;
    const ps = s.pessoas || [],
      fc = {};
    ps.forEach((p) => {
      const f =
        String(p.funcao || p.cargo || "Sem função").trim() || "Sem função";
      fc[f] = (fc[f] || 0) + 1;
    });
    const dias = [
        "segunda",
        "terca",
        "quarta",
        "quinta",
        "sexta",
        "sabado",
        "domingo",
      ],
      teams = Math.max(
        0,
        ...dias.map((d) =>
          Number(s.config?.equipesDia?.[d] || s.horarios?.[d]?.length || 0),
        ),
      );
    let divergences = 0;
    try {
      ps.forEach((p) => {
        const total = Number(window.totalPessoa?.(p) || 0),
          meta = Number(window.fsMetaSemanalPessoa?.(p) || s.cargaMeta || 0);
        if (Math.abs(total - meta) > 0.08) divergences++;
      });
    } catch (_) {}
    let company = {};
    try {
      company =
        window.fsGetDadosEmpresa?.() ||
        JSON.parse(localStorage.getItem("fsDadosEmpresa") || "{}") ||
        {};
    } catch (_) {}
    return {
      branchName: company.filial || localStorage.getItem(K.branchName) || "",
      city: company.cidade || "",
      manager: company.gestor || "",
      employees: ps.length,
      functions: Object.keys(fc).length,
      teams,
      weeklyHours: Number(s.cargaMeta || 0),
      mode: String(s.config?.modo || ""),
      coverage: ps.length
        ? Math.max(0, Math.round(((ps.length - divergences) * 100) / ps.length))
        : 0,
      divergences,
      pending: divergences,
      functionCounts: fc,
    };
  }
  function publish() {
    const c = cfg(),
      x = summary();
    if (!c.url || (!c.token && !c.session) || !x) return;
    fetch(c.url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(
        params("publishSummary", { summary: JSON.stringify(x) }),
      ),
    }).catch(() => {});
  }
  function boot(on, text) {
    document.documentElement.classList.toggle("fsDashBooting", !!on);
    let x = document.getElementById("fsDashBoot");
    if (on && !x) {
      x = document.createElement("div");
      x.id = "fsDashBoot";
      x.innerHTML =
        '<div class="fsDashBootCard"><span></span><b>Central Gerencial</b><small></small></div>';
      document.body.appendChild(x);
    }
    if (x)
      x.querySelector("small").textContent =
        text || "Organizando informações das filiais…";
    if (!on) x?.remove();
  }
  const sum = (a, k) => a.reduce((n, x) => n + Number(x.summary?.[k] || 0), 0);
  function regionName(id) {
    return (
      data?.regions?.find((r) => r.id === id)?.name || "Sem regional definida"
    );
  }
  function filtered() {
    return (data?.branches || []).filter(
      (b) =>
        (region === "all" || b.regionId === region) &&
        (!query ||
          norm(
            [
              b.name,
              b.summary?.city,
              b.summary?.manager,
              regionName(b.regionId),
            ].join(" "),
          ).includes(norm(query))),
    );
  }
  function totals(bs) {
    const funcs = {};
    bs.forEach((b) =>
      Object.entries(b.summary?.functionCounts || {}).forEach(
        ([k, v]) => (funcs[k] = (funcs[k] || 0) + Number(v || 0)),
      ),
    );
    return {
      branches: bs.length,
      employees: sum(bs, "employees"),
      functions: Object.keys(funcs).length,
      online: bs.filter((b) => b.presence === "online").length,
      divergences: sum(bs, "divergences"),
      coverage: bs.length
        ? Math.round(
            bs.reduce((n, b) => n + Number(b.summary?.coverage || 0), 0) /
              bs.length,
          )
        : 0,
      funcs,
    };
  }
  function health(b) {
    if (b.presence === "offline") return { c: "critical", t: "Sem atividade" };
    if (Number(b.summary?.divergences || 0) > 0)
      return { c: "warning", t: "Requer atenção" };
    return { c: "healthy", t: "Regular" };
  }
  function kpis(bs) {
    const t = totals(bs);
    return [
      {
        k: "branches",
        i: "🏢",
        t: "Filiais no escopo",
        v: t.branches,
        c: "blue",
      },
      {
        k: "employees",
        i: "👥",
        t: "Colaboradores",
        v: t.employees,
        c: "blue",
      },
      { k: "functions", i: "🧩", t: "Funções", v: t.functions, c: "blue" },
      { k: "online", i: "🟢", t: "Online agora", v: t.online, c: "green" },
      {
        k: "coverage",
        i: "📈",
        t: "Cobertura média",
        v: t.coverage + "%",
        c: t.coverage >= 90 ? "green" : "orange",
      },
      {
        k: "divergences",
        i: "⚠️",
        t: "Divergências",
        v: t.divergences,
        c: t.divergences ? "red" : "green",
      },
    ];
  }
  function loading(text) {
    let x = document.getElementById("fsDashLoading");
    if (!x) {
      x = document.createElement("div");
      x.id = "fsDashLoading";
      x.innerHTML = "<div><span></span><b></b></div>";
      document.body.appendChild(x);
    }
    x.querySelector("b").textContent = text || "Carregando…";
    requestAnimationFrame(() => x.classList.add("show"));
  }
  function stopLoading() {
    const x = document.getElementById("fsDashLoading");
    if (!x) return;
    x.classList.remove("show");
    setTimeout(() => {
      if (!x.classList.contains("show")) x.remove();
    }, 180);
  }
  function kpiDetails(kind) {
    const bs = filtered();
    let title = "Detalhamento",
      description = "Filiais incluídas neste indicador",
      rows = [];
    if (kind === "branches") {
      title = "Filiais no escopo";
      rows = bs.map((b) => ({ b, value: regionName(b.regionId) }));
    } else if (kind === "employees") {
      title = "Colaboradores por filial";
      rows = bs
        .filter((b) => Number(b.summary?.employees || 0) > 0)
        .map((b) => ({
          b,
          value: `${Number(b.summary?.employees || 0)} colaborador(es)`,
        }));
    } else if (kind === "functions") {
      title = "Funções por filial";
      rows = bs
        .filter((b) => Number(b.summary?.functions || 0) > 0)
        .map((b) => ({
          b,
          value: `${Number(b.summary?.functions || 0)} função(ões)`,
        }));
    } else if (kind === "online") {
      title = "Filiais online agora";
      rows = bs
        .filter((b) => b.presence === "online")
        .map((b) => ({ b, value: `Atualizada ${when(b.lastActivity)}` }));
    } else if (kind === "coverage") {
      title = "Cobertura por filial";
      rows = bs
        .map((b) => ({
          b,
          value: `${Number(b.summary?.coverage || 0)}% de cobertura`,
        }))
        .sort(
          (a, b) =>
            Number(a.b.summary?.coverage || 0) -
            Number(b.b.summary?.coverage || 0),
        );
    } else if (kind === "divergences") {
      title = "Divergências por filial";
      rows = bs
        .filter((b) => Number(b.summary?.divergences || 0) > 0)
        .map((b) => ({
          b,
          value: `${Number(b.summary?.divergences || 0)} divergência(s)`,
        }))
        .sort(
          (a, b) =>
            Number(b.b.summary?.divergences || 0) -
            Number(a.b.summary?.divergences || 0),
        );
    }
    const wrap = document.createElement("div");
    wrap.className = "fsKpiModal";
    wrap.innerHTML = `<section><header><div><b>${esc(title)}</b><small>${esc(description)}</small></div><button type="button">×</button></header><main>${rows.map((x) => `<article><div><b>${esc(x.b.name)}</b><small>${esc(regionName(x.b.regionId))}</small></div><strong>${esc(x.value)}</strong><button data-kpi-branch="${esc(x.b.id)}">Abrir filial</button></article>`).join("") || '<div class="fsDashEmpty">Nenhuma filial neste indicador.</div>'}</main></section>`;
    document.body.appendChild(wrap);
    wrap.querySelector("header button").onclick = () => wrap.remove();
    wrap.onclick = (e) => {
      if (e.target === wrap) wrap.remove();
    };
    wrap.querySelectorAll("[data-kpi-branch]").forEach(
      (b) =>
        (b.onclick = () => {
          wrap.remove();
          openBranch(b.dataset.kpiBranch);
        }),
    );
  }
  function regionalCards() {
    return (
      (data.regions || [])
        .map((r) => {
          const rb = (data.branches || []).filter((b) => b.regionId === r.id),
            t = totals(rb);
          return `<button class="fsDashRegion ${region === r.id ? "active" : ""}" data-region-card="${esc(r.id)}"><span>${esc(r.name)}</span><strong>${rb.length}</strong><small>${t.employees} colaboradores</small><em>${t.online} online • ${t.divergences} divergência(s)</em></button>`;
        })
        .join("") ||
      '<div class="fsDashEmpty">Nenhuma regional cadastrada.</div>'
    );
  }
  function branchCard(b) {
    const s = b.summary || {},
      h = health(b),
      dev = data.context?.globalAdmin || data.context?.role === "developer",
      select = dev
        ? `<label class="fsDashAssign"><span>Regional</span><select data-assign-branch="${esc(b.id)}"><option value="">Definir regional</option>${(data.regions || []).map((r) => `<option value="${esc(r.id)}" ${b.regionId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`
        : "";
    return `<article class="fsDashBranch ${h.c}"><div class="fsDashBranchTop"><div><h3>${esc(b.name)}</h3><p>${esc(regionName(b.regionId))}${s.city ? " • " + esc(s.city) : ""}</p></div><span class="fsDashStatus ${b.presence}">${b.presence === "online" ? "Online" : b.presence === "recent" ? "Atividade recente" : "Sem atividade"}</span></div><div class="fsDashHealth"><span class="${h.c}"></span><b>${h.t}</b><small>Atualizada ${when(b.lastActivity)}</small></div><div class="fsDashMini"><div><span>Colaboradores</span><b>${Number(s.employees || 0)}</b></div><div><span>Funções</span><b>${Number(s.functions || 0)}</b></div><div><span>Equipes</span><b>${Number(s.teams || 0)}</b></div><div><span>Jornada</span><b>${Number(s.weeklyHours || 0) || "—"}h</b></div><div><span>Cobertura</span><b>${Number(s.coverage || 0)}%</b></div><div><span>Divergências</span><b>${Number(s.divergences || 0)}</b></div></div><div class="fsDashBranchMeta"><span>☁️ Versão ${Number(b.version || 0)}</span><span>${s.manager ? "👤 " + esc(s.manager) : "Gestor não informado"}</span></div>${select}<button class="fsDashEnter" data-open-branch="${esc(b.id)}">Abrir filial <span>→</span></button></article>`;
  }
  function alerts(bs) {
    const a = bs
      .filter(
        (b) =>
          b.presence !== "online" || Number(b.summary?.divergences || 0) > 0,
      )
      .sort(
        (x, y) =>
          Number(y.summary?.divergences || 0) -
          Number(x.summary?.divergences || 0),
      )
      .slice(0, 6);
    return (
      a
        .map((b) => {
          const h = health(b);
          return `<div class="fsDashAlert ${h.c}"><span></span><div><b>${esc(b.name)}</b><small>${h.t} • ${Number(b.summary?.divergences || 0)} divergência(s)</small></div><button data-open-branch="${esc(b.id)}">Ver filial</button></div>`;
        })
        .join("") ||
      '<div class="fsDashAllGood">✓ Nenhuma filial exige atenção neste filtro.</div>'
    );
  }
  function chart(bs) {
    const f = totals(bs).funcs,
      max = Math.max(1, ...Object.values(f));
    return (
      Object.entries(f)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16)
        .map(
          ([k, v]) =>
            `<div class="fsDashBar"><label>${esc(k)}</label><div class="fsDashTrack"><div class="fsDashFill" style="width:${Math.max(3, (v * 100) / max)}%"></div></div><b>${v}</b></div>`,
        )
        .join("") ||
      '<div class="fsDashEmpty">Os resumos das filiais ainda não foram publicados.</div>'
    );
  }
  function branchName(id) {
    return (
      data?.branches?.find((b) => b.id === id)?.name ||
      "Filial não identificada"
    );
  }
  function scopeName(memberId) {
    const s = accessData?.scopes?.find(
      (x) => x.memberId === memberId && x.active,
    );
    if (!s)
      return (
        "Filial: " +
        branchName(
          accessData?.members?.find((m) => m.id === memberId)?.branchId,
        )
      );
    if (s.type === "global") return "Toda a empresa";
    if (s.type === "regional")
      return (
        "Regional: " +
        (accessData.regions?.find((r) => r.id === s.targetId)?.name ||
          s.targetId)
      );
    return "Filial: " + branchName(s.targetId);
  }
  let accessData = null;
  function accessKpis() {
    return `<section class="fsAccessKpis"><article><span>Usuários ativos</span><b>${(accessData.members || []).filter((x) => x.active).length}</b></article><article><span>Convites pendentes</span><b>${(accessData.invites || []).filter((x) => x.active && !x.usedAt).length}</b></article><article><span>Links ativos</span><b>${(accessData.viewLinks || []).filter((x) => x.active).length}</b></article><article><span>Registros recentes</span><b>${(accessData.recent || []).length}</b></article></section>`;
  }
  function accessRows() {
    const members = (accessData.members || []).filter((m) => m.active);
    const invites = (accessData.invites || []).filter(
      (i) => i.active && !i.usedAt,
    );
    const links = (accessData.viewLinks || []).filter((l) => l.active);
    return `<div class="fsAccessGrid"><section class="fsAccessCard fsAccessWide"><header><div><h2>Usuários ativos</h2><p>Quem pode acessar a plataforma e qual é o alcance.</p></div><div class="fsAccessHeaderActions">${["developer", "regional_admin"].includes(data.context?.role) || data.context?.globalAdmin ? '<button class="fsAccessSoft" id="fsAccessNewBranch">+ Nova filial</button>' : ""}<button class="fsAccessPrimary" id="fsAccessNew">+ Novo acesso</button></div></header><div class="fsAccessTable">${members.map((m) => `<article><div class="fsAccessAvatar">${esc((m.name || "U").slice(0, 1))}</div><div><b>${esc(m.name)}</b><small>${esc(role(m.role))} • ${esc(scopeName(m.id))}</small><em>${m.lastAccess ? "Último acesso " + when(m.lastAccess) : "Ainda não acessou"}</em></div><span class="fsAccessTag ${m.canShare ? "share" : ""}">${m.canShare ? "Pode compartilhar" : "Acesso padrão"}</span>${m.id !== data.context?.memberId ? `<button class="fsAccessMore" data-reissue-member="${esc(m.id)}">Novo link</button><button class="fsAccessMore" data-end-session="${esc(m.id)}">Encerrar sessão</button>${accessData.globalAdmin ? `<button class="fsAccessMore" data-scope-member="${esc(m.id)}" title="Alterar alcance">Alcance</button>` : ""}<button class="fsAccessDanger" data-revoke-member="${esc(m.id)}">Bloquear</button>` : ""}</article>`).join("") || '<div class="fsDashEmpty">Nenhum usuário cadastrado.</div>'}</div></section><section class="fsAccessCard"><header><div><h2>Convites pendentes</h2><p>Aguardando ativação pelo destinatário.</p></div></header><div class="fsAccessList">${invites.map((i) => `<article><div><b>${esc(i.name)}</b><small>${esc(role(i.role))} • ${esc(branchName(i.branchId || i.originBranchId))}</small><em>Expira ${when(i.expiresAt)}</em></div><button class="fsAccessDanger" data-revoke-invite="${esc(i.id)}">Cancelar</button></article>`).join("") || '<div class="fsDashEmpty">Nenhum convite pendente.</div>'}</div></section><section class="fsAccessCard"><header><div><h2>Links de visualização</h2><p>Consulta sem permissão de edição.</p></div><button class="fsAccessSoft" id="fsAccessNewLink">+ Gerar link</button></header><div class="fsAccessList">${links.map((l) => `<article><div><b>${esc(l.description || "Visualização")}</b><small>${esc(branchName(l.branchId))}</small><em>${l.lastAccess ? "Acessado " + when(l.lastAccess) : "Nunca acessado"}</em></div><button class="fsAccessDanger" data-revoke-link="${esc(l.id)}">Desativar</button></article>`).join("") || '<div class="fsDashEmpty">Nenhum link ativo.</div>'}</div></section><section class="fsAccessCard fsAccessWide"><header><div><h2>Atividade recente</h2><p>Auditoria dos acessos e alterações administrativas.</p></div></header><div class="fsAccessHistory">${
      (accessData.recent || [])
        .slice(0, 30)
        .map(
          (h) =>
            `<article><span>${when(h.date)}</span><b>${esc(h.user || "Sistema")}</b><small>${esc(h.message || h.event || "Atividade")}</small><em>${esc(h.result || "")}</em></article>`,
        )
        .join("") ||
      '<div class="fsDashEmpty">Nenhuma atividade registrada.</div>'
    }</div></section></div>`;
  }
  async function openAccess() {
    if (busy) return;
    busy = true;
    loading("Abrindo a Central de Acessos…");
    try {
      const r = await jsonp("dashboard");
      if (!r.ok)
        throw new Error(r.message || "Central de Acessos indisponível.");
      accessData = r;
      renderAccess();
    } catch (e) {
      error(e.message);
    } finally {
      busy = false;
      stopLoading();
    }
  }
  function renderAccess() {
    document.getElementById("fsAccessRoot")?.remove();
    const root = document.createElement("div");
    root.id = "fsAccessRoot";
    root.className = "fsAccessRoot";
    root.innerHTML = `<header class="fsAccessTop"><button id="fsAccessBack">← Visão geral</button><div><b>Central de Acessos</b><small>Usuários, permissões, convites e links</small></div><button id="fsAccessReload">↻ Atualizar</button></header><main><section class="fsAccessHero"><div><span>ADMINISTRAÇÃO</span><h1>Acessos da plataforma</h1><p>Controle os perfis e o alcance de cada pessoa sem entrar nas filiais.</p></div><button class="fsAccessUser" id="fsAccessUser"><b>${esc(data.context?.name || "Administrador")}</b><small>${esc(role(data.context?.role))} ▾</small></button></section>${accessKpis()}${accessRows()}</main>`;
    document.body.appendChild(root);
    root.querySelector("#fsAccessBack").onclick = () => root.remove();
    root.querySelector("#fsAccessReload").onclick = openAccess;
    root.querySelector("#fsAccessUser").onclick = (e) => {
      e.stopPropagation();
      toggleUserMenu(e.currentTarget);
    };
    root.querySelector("#fsAccessNew").onclick = newAccess;
    root.querySelector("#fsAccessNewLink").onclick = newViewLink;
    const newBranchButton = root.querySelector("#fsAccessNewBranch");
    if (newBranchButton) newBranchButton.onclick = newBranch;
    root
      .querySelectorAll("[data-revoke-invite]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            mutate(
              "revokeInvite",
              { inviteId: b.dataset.revokeInvite },
              "Cancelar este convite?",
            )),
      );
    root
      .querySelectorAll("[data-revoke-member]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            mutate(
              "revokeMember",
              { memberId: b.dataset.revokeMember },
              "Bloquear o acesso desta pessoa?",
            )),
      );
    root
      .querySelectorAll("[data-revoke-link]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            mutate(
              "revokeViewLink",
              { linkId: b.dataset.revokeLink },
              "Desativar este link?",
            )),
      );
    root
      .querySelectorAll("[data-scope-member]")
      .forEach((b) => (b.onclick = () => changeScope(b.dataset.scopeMember)));
    root
      .querySelectorAll("[data-end-session]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            mutate(
              "endMemberSessions",
              { memberId: b.dataset.endSession },
              "Encerrar a sessão desta pessoa em todos os aparelhos?",
            )),
      );
    root
      .querySelectorAll("[data-reissue-member]")
      .forEach(
        (b) => (b.onclick = () => reissueMember(b.dataset.reissueMember)),
      );
  }
  function modal(title, body, submitText, onSubmit) {
    const wrap = document.createElement("div");
    wrap.className = "fsAccessModal";
    wrap.innerHTML = `<form><header><div><b>${esc(title)}</b><small>Central de Acessos</small></div><button type="button" data-close>×</button></header><div class="fsAccessForm">${body}</div><footer><button type="button" data-close>Cancelar</button><button class="fsAccessPrimary" type="submit">${esc(submitText)}</button></footer></form>`;
    document.body.appendChild(wrap);
    wrap
      .querySelectorAll("[data-close]")
      .forEach((x) => (x.onclick = () => wrap.remove()));
    wrap.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const submit = e.currentTarget.querySelector('[type="submit"]'),
        previous = submit?.textContent;
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Processando…";
        submit.classList.add("is-loading");
      }
      try {
        await onSubmit(new FormData(e.currentTarget), wrap);
      } finally {
        if (submit?.isConnected) {
          submit.disabled = false;
          submit.textContent = previous;
          submit.classList.remove("is-loading");
        }
      }
    };
    return wrap;
  }
  function branchOptions() {
    return (accessData.branches || [])
      .map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`)
      .join("");
  }
  function regionOptions() {
    return (accessData.regions || [])
      .map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`)
      .join("");
  }
  function newAccess() {
    const m = modal(
      "Gerar novo acesso",
      `<label>Nome completo<input name="name" required autocomplete="name"></label><label>Telefone (opcional)<input name="phone" inputmode="tel"></label><label>Perfil<select name="role" id="fsAccessRole"><option value="manager">Gerente</option><option value="branch_admin">Administrador da filial</option><option value="regional_admin">Administrador regional</option><option value="consultant">Consultor</option>${accessData.globalAdmin ? '<option value="developer">Desenvolvedor</option>' : ""}<option value="viewer">Visualizador</option></select></label><label id="fsAccessBranchLabel">Filial<select name="branchId">${branchOptions()}</select></label><label id="fsAccessRegionLabel" hidden>Regional<select name="regionId">${regionOptions()}</select></label><label class="fsAccessCheck"><input type="checkbox" name="canShare" value="1"> Permitir que esta pessoa compartilhe acessos</label>`,
      "Gerar convite",
      async (f, w) => {
        const selectedRole = f.get("role"),
          scopeType = ["developer", "consultant"].includes(selectedRole)
            ? "global"
            : selectedRole === "regional_admin"
              ? "regional"
              : "filial",
          scopeTargetId =
            scopeType === "regional"
              ? f.get("regionId")
              : scopeType === "filial"
                ? f.get("branchId")
                : "";
        try {
          const r = await jsonp("createInvite", {
            name: f.get("name"),
            phone: f.get("phone"),
            role: selectedRole,
            canShare: f.get("canShare") || "0",
            mode: "same",
            branchId: f.get("branchId") || cfg().branch,
            scopeType,
            scopeTargetId,
          });
          if (!r.ok) throw new Error(r.message);
          const link =
            location.href.split("?")[0].split("#")[0] +
            "?cloud=" +
            encodeURIComponent(cfg().url) +
            "&invite=" +
            encodeURIComponent(r.invite);
          w.querySelector("form").innerHTML =
            `<div class="fsAccessResult"><span>✓</span><h2>Convite criado</h2><p>Envie este link somente para <b>${esc(r.name)}</b>.</p><textarea readonly>${esc(link)}</textarea><button type="button" class="fsAccessPrimary" id="fsCopyInvite">Copiar link</button><button type="button" data-close>Concluir</button></div>`;
          w.querySelector("#fsCopyInvite").onclick = async () => {
            await navigator.clipboard.writeText(link);
            w.querySelector("#fsCopyInvite").textContent = "Copiado ✓";
          };
          w.querySelector("[data-close]").onclick = () => {
            w.remove();
            openAccess();
          };
        } catch (e) {
          error(e.message);
        }
      },
    );
    const roleEl = m.querySelector("#fsAccessRole"),
      branchLabel = m.querySelector("#fsAccessBranchLabel"),
      regionLabel = m.querySelector("#fsAccessRegionLabel");
    roleEl.onchange = () => {
      const regional = roleEl.value === "regional_admin",
        global = ["developer", "consultant"].includes(roleEl.value);
      branchLabel.hidden = regional || global;
      regionLabel.hidden = !regional;
    };
  }
  function newViewLink() {
    modal(
      "Gerar link de visualização",
      `<label>Filial<select name="branchId">${branchOptions()}</select></label><label>Identificação<input name="description" value="Acompanhamento gerencial" required></label>`,
      "Gerar link",
      async (f, w) => {
        try {
          const r = await jsonp("createViewLink", {
            branchId: f.get("branchId"),
            description: f.get("description"),
          });
          if (!r.ok) throw new Error(r.message);
          const link =
            location.href.split("?")[0].split("#")[0] +
            "?cloud=" +
            encodeURIComponent(cfg().url) +
            "&view=" +
            encodeURIComponent(r.view);
          await navigator.clipboard.writeText(link).catch(() => {});
          w.remove();
          error("Link copiado para a área de transferência.");
          openAccess();
        } catch (e) {
          error(e.message);
        }
      },
    );
  }
  function newBranch() {
    modal(
      "Cadastrar nova filial",
      `<label>Nome da filial<input name="name" required placeholder="Ex.: Filial 32 - Centro"></label><label>Setor ou identificação<input name="sector" placeholder="Opcional"></label><label>Usar como modelo<select name="copyFrom">${branchOptions()}</select></label><p class="fsInviteNote">A nova filial será independente. Para Administrador Regional, ela será vinculada automaticamente à sua regional.</p>`,
      "Criar filial",
      async (f, w) => {
        try {
          const r = await jsonp("createBranch", {
            name: f.get("name"),
            sector: f.get("sector"),
            copyFrom: f.get("copyFrom"),
          });
          if (!r.ok) throw new Error(r.message);
          w.remove();
          await load(true);
          await openAccess();
        } catch (e) {
          error(e.message);
        }
      },
    );
  }
  async function reissueMember(memberId) {
    if (
      !confirm("Gerar um novo link e encerrar a sessão anterior desta pessoa?")
    )
      return;
    loading("Gerando novo link seguro…");
    try {
      const r = await jsonp("reissueMemberInvite", { memberId });
      if (!r.ok) throw new Error(r.message);
      const link =
        location.href.split("?")[0].split("#")[0] +
        "?cloud=" +
        encodeURIComponent(cfg().url) +
        "&invite=" +
        encodeURIComponent(r.invite);
      await navigator.clipboard.writeText(link).catch(() => {});
      modal(
        "Novo link gerado",
        `<div class="fsAccessResult"><span>✓</span><h2>Acesso reemitido</h2><p>A sessão anterior foi encerrada. O link abaixo é individual, expira em 48 horas e será inutilizado após a ativação.</p><textarea readonly>${esc(link)}</textarea><button type="button" class="fsAccessPrimary" id="fsCopyReissue">Copiar link</button></div>`,
        "Concluir",
        async (_, w) => w.remove(),
      );
      const copy = document.getElementById("fsCopyReissue");
      if (copy)
        copy.onclick = async () => {
          await navigator.clipboard.writeText(link);
          copy.textContent = "Copiado ✓";
        };
      await openAccess();
    } catch (e) {
      error(e.message);
    } finally {
      stopLoading();
    }
  }
  function changeScope(memberId) {
    modal(
      "Alterar alcance",
      `<label>Tipo<select name="scopeType" id="fsScopeType"><option value="filial">Uma filial</option><option value="regional">Uma regional</option><option value="global">Toda a empresa</option></select></label><label id="fsScopeTargetLabel">Destino<select name="branchTarget">${branchOptions()}</select><select name="regionTarget" hidden>${regionOptions()}</select></label>`,
      "Salvar alcance",
      async (f, w) => {
        const type = f.get("scopeType"),
          target =
            type === "filial"
              ? f.get("branchTarget")
              : type === "regional"
                ? f.get("regionTarget")
                : "";
        try {
          const r = await jsonp("setMemberScope", {
            memberId,
            scopeType: type,
            scopeTargetId: target,
          });
          if (!r.ok) throw new Error(r.message);
          w.remove();
          openAccess();
        } catch (e) {
          error(e.message);
        }
      },
    );
    const type = document.getElementById("fsScopeType"),
      branch = type.form.elements.branchTarget,
      regional = type.form.elements.regionTarget;
    type.onchange = () => {
      branch.hidden = type.value !== "filial";
      regional.hidden = type.value !== "regional";
    };
  }
  async function mutate(action, payload, question) {
    if (question && !confirm(question)) return;
    loading("Salvando a alteração…");
    try {
      const r = await jsonp(action, payload);
      if (!r.ok) throw new Error(r.message);
      await openAccess();
    } catch (e) {
      error(e.message);
    } finally {
      stopLoading();
    }
  }
  async function activateInvite() {
    const q = new URLSearchParams(location.search),
      invite = q.get("invite"),
      cloud = q.get("cloud");
    if (!invite || !cloud) return false;
    boot(true, "Validando seu convite…");
    try {
      const info = await publicJsonp("inviteInfo", { invite }, cloud);
      if (!info.ok) {
        boot(false);
        showInviteFailure(info.message, info.supportPhone);
        return true;
      }
      boot(false);
      const activation = modal(
        "Ativar acesso",
        `<div class="fsInviteIntro"><b>${esc(info.recipientHint || "Convite individual")}</b><span>${esc(role(info.role))}</span><small>${esc(info.branchName || "Acesso corporativo")}</small></div><div class="fsInstallBox"><b>Instale a FS Escala neste aparelho</b><p>Este link é individual e será inutilizado após a ativação. A instalação facilita o acesso seguro nas próximas entradas.</p><button type="button" id="fsInstallApp">⬇ Instalar / adicionar à tela inicial</button></div><label>Nome completo<input name="name" required autocomplete="name"></label>${info.requiresPhone ? '<label>Últimos 4 números do telefone<input name="phoneLast4" required inputmode="numeric" maxlength="4" pattern="[0-9]{4}"></label>' : ""}<p class="fsInviteNote">Por segurança, os dados precisam corresponder ao cadastro. A sessão será vinculada a este aparelho.</p>`,
        "Entrar na plataforma",
        async (f, w) => {
          try {
            const r = await publicJsonp(
              "claimInvite",
              {
                invite,
                name: f.get("name"),
                phoneLast4: f.get("phoneLast4") || "",
                deviceId: localStorage.getItem("fs_device_id") || "",
              },
              cloud,
            );
            if (!r.ok) throw new Error(r.message);
            localStorage.setItem(K.url, cloud);
            localStorage.setItem("fs_access_token", r.session);
            localStorage.setItem("fs_access_data_v1", JSON.stringify(r));
            localStorage.setItem(K.branch, r.branchId);
            localStorage.setItem(K.branchName, r.branchName || "Filial");
            localStorage.setItem(K.version, String(r.version || 0));
            localStorage.setItem("fs_cloud_mode_v705", "admin");
            localStorage.removeItem(K.token);
            w.remove();
            q.delete("invite");
            q.delete("cloud");
            history.replaceState(
              {},
              "",
              location.pathname + (q.toString() ? "?" + q : ""),
            );
            location.reload();
          } catch (e) {
            error(e.message);
          }
        },
      );
      activation.querySelector("#fsInstallApp").onclick = async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice.catch(() => {});
          deferredInstallPrompt = null;
        } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
          alert(
            "No iPhone/iPad: toque em Compartilhar e depois em Adicionar à Tela de Início.",
          );
        } else {
          alert(
            "No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial.",
          );
        }
      };
    } catch (e) {
      boot(false);
      error(e.message);
    }
    return true;
  }
  function showInviteFailure(message, supportPhone) {
    const phone = String(supportPhone || "").replace(/\D/g, ""),
      text = encodeURIComponent(
        "Olá. Meu acesso à FS Escala expirou ou foi utilizado e preciso solicitar uma reativação.",
      );
    const wrap = document.createElement("div");
    wrap.className = "fsAccessModal fsInviteExpired";
    wrap.innerHTML = `<section><span>🔒</span><h1>Acesso indisponível</h1><p>${esc(message || "Este link não pode mais ser utilizado.")}</p><small>Solicite ao responsável a emissão de um novo link de ativação.</small>${phone ? `<a href="https://wa.me/${phone}?text=${text}" target="_blank" rel="noopener">Falar com o suporte pelo WhatsApp</a>` : ""}<button type="button">Usar a plataforma no modo local</button></section>`;
    document.body.appendChild(wrap);
    wrap.querySelector("button").onclick = () => {
      history.replaceState({}, "", location.pathname);
      location.reload();
    };
  }
  function logoutOnline() {
    if (
      !confirm(
        "Sair deste acesso online? Os dados locais da escala serão preservados.",
      )
    )
      return;
    /* A Central continua sendo a porta de entrada deste aparelho. A URL e o
       marcador do portal ficam salvos; somente a credencial da pessoa sai. */
    localStorage.setItem("fs_central_portal_v812", "1");
    [
      K.token,
      "fs_access_token",
      "fs_access_data_v1",
      K.branch,
      K.branchName,
      K.version,
      "fs_cloud_mode_v705",
    ].forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("fs_dashboard_branch_mode");
    sessionStorage.removeItem("fs_cloud_admin_loaded");
    sessionStorage.removeItem("fs_dashboard_open_cloud");
    location.reload();
  }
  function toggleUserMenu(anchor) {
    document.getElementById("fsUserMenu")?.remove();
    const menu = document.createElement("div");
    menu.id = "fsUserMenu";
    menu.className = "fsUserMenu";
    menu.innerHTML = `<div><b>${esc(data.context?.name || "Usuário")}</b><small>${esc(role(data.context?.role))}</small></div><button id="fsUserOverview">⌂ Visão geral</button><button id="fsUserAccess">🔐 Central de Acessos</button><button id="fsUserLogout">↪ Sair / trocar usuário</button>`;
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 7}px`;
    menu.style.right = `${Math.max(10, innerWidth - rect.right)}px`;
    menu.querySelector("#fsUserOverview").onclick = () => {
      menu.remove();
      document.getElementById("fsAccessRoot")?.remove();
    };
    menu.querySelector("#fsUserAccess").onclick = () => {
      menu.remove();
      openAccess();
    };
    menu.querySelector("#fsUserLogout").onclick = logoutOnline;
    setTimeout(
      () =>
        document.addEventListener("click", function close(e) {
          if (!menu.contains(e.target) && e.target !== anchor) {
            menu.remove();
            document.removeEventListener("click", close);
          }
        }),
      0,
    );
  }
  function render() {
    if (!data) return;
    const bs = filtered();
    document.getElementById("fsDashRoot")?.remove();
    const root = document.createElement("div");
    root.id = "fsDashRoot";
    root.className = "fsDashShell";
    root.innerHTML = `<header class="fsDashTop"><div class="fsDashBrand"><i>FS</i><div><b>Central Gerencial</b><small>FS Escala • ${esc(role(data.context?.role))}</small></div></div><nav class="fsDashNav"><button class="active">Visão geral</button>${data.context?.canShare || data.context?.globalAdmin || ["developer", "regional_admin", "branch_admin"].includes(data.context?.role) ? '<button id="fsDashAccess">Central de Acessos</button>' : ""}</nav><div class="fsDashTopActions"><button class="fsDashUser" id="fsDashUser"><b>${esc(data.context?.name || "Administrador")}</b><small>${esc(role(data.context?.role))} ▾</small></button><span class="fsDashLive"><i></i> Monitoramento ativo</span><button class="fsDashGhost" id="fsDashRefresh">↻ Atualizar</button></div></header><main class="fsDashMain"><section class="fsDashWelcome"><div><span class="fsDashEyebrow">VISÃO CONSOLIDADA</span><h1>Olá, ${esc(data.context?.name || "Administrador")}</h1><p>Acompanhe regionais, filiais e indicadores operacionais em um só lugar.</p></div><span class="fsDashStamp">Última consulta<br><b>${new Date(data.generatedAt).toLocaleString("pt-BR")}</b></span></section><section class="fsDashToolbar"><div class="fsDashSearch"><span>⌕</span><input id="fsDashSearch" value="${esc(query)}" placeholder="Buscar filial, cidade, gestor ou regional"></div><div class="fsDashFilters"><button data-region="all" class="${region === "all" ? "active" : ""}">Todas</button>${(data.regions || []).map((r) => `<button data-region="${esc(r.id)}" class="${region === r.id ? "active" : ""}">${esc(r.name)}</button>`).join("")}</div></section><section class="fsDashKpis">${kpis(
      bs,
    )
      .map(
        (x) =>
          `<article class="fsDashKpi ${x.c}" data-kpi="${x.k}" title="Clique duas vezes para ver as filiais"><span><i>${x.i}</i>${x.t}</span><strong>${x.v}</strong><small>Ver detalhes</small></article>`,
      )
      .join(
        "",
      )}</section><div class="fsDashGrid"><section class="fsDashSection"><div class="fsDashSectionHead"><div><h2>Regionais</h2><p>Distribuição das unidades por território</p></div></div><div class="fsDashRegions">${regionalCards()}</div></section><section class="fsDashSection"><div class="fsDashSectionHead"><div><h2>Atenção operacional</h2><p>Filiais que merecem acompanhamento</p></div></div><div class="fsDashAlerts">${alerts(bs)}</div></section></div><section class="fsDashSection"><div class="fsDashSectionHead"><div><h2>Filiais</h2><p>Informações mais recentes publicadas por cada unidade</p></div><span class="fsDashCount">${bs.length} unidade(s)</span></div><div class="fsDashBranches">${bs.map(branchCard).join("") || '<div class="fsDashEmpty">Nenhuma filial encontrada neste filtro.</div>'}</div></section><section class="fsDashSection"><div class="fsDashSectionHead"><div><h2>Composição por função</h2><p>Distribuição consolidada de colaboradores</p></div></div><div class="fsDashChart">${chart(bs)}</div></section></main>`;
    document.body.appendChild(root);
    boot(false);
    bind(root);
  }
  function bind(root) {
    root.querySelector("#fsDashRefresh").onclick = () => load(true);
    const access = root.querySelector("#fsDashAccess");
    if (access) access.onclick = openAccess;
    root.querySelector("#fsDashUser").onclick = (e) => {
      e.stopPropagation();
      toggleUserMenu(e.currentTarget);
    };
    root.querySelectorAll("[data-kpi]").forEach((x) => {
      x.ondblclick = () => kpiDetails(x.dataset.kpi);
      x.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") kpiDetails(x.dataset.kpi);
      };
      x.tabIndex = 0;
    });
    root.querySelector("#fsDashSearch").addEventListener("input", (e) => {
      query = e.target.value;
      const p = e.target.selectionStart;
      render();
      const x = document.getElementById("fsDashSearch");
      x.focus();
      x.setSelectionRange(p, p);
    });
    root.querySelectorAll("[data-region]").forEach(
      (x) =>
        (x.onclick = () => {
          region = x.dataset.region;
          render();
        }),
    );
    root.querySelectorAll("[data-region-card]").forEach(
      (x) =>
        (x.onclick = () => {
          region =
            region === x.dataset.regionCard ? "all" : x.dataset.regionCard;
          render();
        }),
    );
    root
      .querySelectorAll("[data-open-branch]")
      .forEach((x) => (x.onclick = () => openBranch(x.dataset.openBranch)));
  }
  async function assignRegion(branchId, regionId) {
    if (!regionId || busy) return;
    busy = true;
    loading("Atualizando a regional…");
    try {
      const r = await jsonp("assignBranchRegion", {
        targetBranchId: branchId,
        regionId,
      });
      if (!r.ok)
        throw new Error(r.message || "Não foi possível definir a regional.");
      busy = false;
      await load(true);
    } catch (e) {
      error(e.message);
    } finally {
      busy = false;
      stopLoading();
    }
  }
  async function openBranch(id) {
    if (busy) return;
    busy = true;
    loading("Abrindo a filial…");
    try {
      const r = await jsonp("switchBranch", { branchId: id });
      if (!r.ok)
        throw new Error(r.message || "Não foi possível selecionar a filial.");
      localStorage.setItem(K.branch, r.branchId);
      localStorage.setItem(K.branchName, r.branchName || "Filial");
      localStorage.setItem(K.version, String(r.version || 0));
      sessionStorage.setItem("fs_dashboard_branch_mode", "1");
      sessionStorage.setItem("fs_dashboard_open_cloud", "1");
      location.reload();
    } catch (e) {
      error(e.message);
      busy = false;
      stopLoading();
    }
  }
  function error(msg) {
    let x = document.getElementById("fsDashError");
    if (!x) {
      x = document.createElement("div");
      x.id = "fsDashError";
      x.className = "fsDashError";
      document.body.appendChild(x);
    }
    x.textContent = msg;
    clearTimeout(x._t);
    x._t = setTimeout(() => x.remove(), 6000);
  }
  function centralButton() {
    let b = document.getElementById("fsDashboardButton");
    if (!b) {
      b = document.createElement("button");
      b.id = "fsDashboardButton";
      b.className = "fsDashBtn";
      b.innerHTML = "← <span>Central Gerencial</span>";
      b.onclick = () => {
        sessionStorage.removeItem("fs_dashboard_branch_mode");
        autoEntry = true;
        data ? render() : load(true);
      };
      (document.querySelector(".top .header") || document.body).appendChild(b);
    }
    b.classList.add("fsReady");
  }
  async function load(open) {
    if (busy) return;
    busy = true;
    if (open) loading("Atualizando a Central…");
    try {
      const r = await jsonp("managementDashboard");
      if (!r.ok) {
        if (r.code === "DIRECT_BRANCH") {
          boot(false);
          return;
        }
        throw new Error(r.message || "Central indisponível.");
      }
      data = r;
      centralButton();
      if (open || autoEntry || document.getElementById("fsDashRoot")) {
        autoEntry = false;
        render();
      } else boot(false);
    } catch (e) {
      boot(false);
      if (open) error(e.message);
    } finally {
      busy = false;
      if (open) stopLoading();
    }
  }
  async function start() {
    if (await activateInvite()) return;
    const c = cfg();
    if (!c.url || (!c.token && !c.session)) {
      boot(false);
      return;
    }
    const branchMode =
        sessionStorage.getItem("fs_dashboard_branch_mode") === "1",
      openCloud = sessionStorage.getItem("fs_dashboard_open_cloud") === "1";
    autoEntry = !branchMode;
    if (!branchMode) boot(true);
    else {
      boot(false);
      centralButton();
    }
    publish();
    load(false);
    document.addEventListener(
      "click",
      (e) => {
        if (e.target?.closest?.("#fsCloudSave,#fsCloudPendingSave"))
          setTimeout(publish, 10000);
      },
      true,
    );
    document.addEventListener(
      "change",
      (e) => {
        const x = e.target?.closest?.("[data-assign-branch]");
        if (x) assignRegion(x.dataset.assignBranch, x.value);
      },
      true,
    );
    setInterval(() => {
      if (!document.hidden) publish();
    }, 600000);
    setInterval(() => {
      if (!document.hidden && document.getElementById("fsDashRoot")) load(true);
    }, 60000);
    if (openCloud) {
      sessionStorage.removeItem("fs_dashboard_open_cloud");
      setTimeout(() => document.getElementById("fsCloudButton")?.click(), 900);
    }
  }
  const c = cfg();
  if (c.url && (c.token || c.session))
    document.documentElement.classList.add("fsDashBooting");
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
