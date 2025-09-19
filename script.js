// --------- Substitua pela sua configuração do Firebase ---------
const firebaseConfig = {
  apiKey: "AIzaSyCgpDnp2Vbsr-ZPP5XfZ1_yVbjI95mz2Cc",
  authDomain: "qamanager20.firebaseapp.com",
  projectId: "qamanager20",
  storageBucket: "qamanager20.firebasestorage.app",
  messagingSenderId: "7536422420",
  appId: "1:7536422420:web:e7a74c9a94b7eb98f0c101",
};
// --------- Firebase Config ---------

// -----------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let lojaSelecionada = null;
let ambienteSelecionado = null;
let confirmHandler = null;
let unsubscribeAmbientes = null;
let unsubscribeAmbiente = null;

const el = (id) => document.getElementById(id);
const showView = (id) => {
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-visible", section.id === id);
  });
};

const normalizeUrl = (value) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "https://" || trimmed === "http://") return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const formatUrlLabel = (url) => {
  if (!url) return "";
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return "";
    const { hostname } = new URL(normalized);
    return hostname.replace(/^www\./, "");
  } catch (error) {
    return url.replace(/^https?:\/\//i, "");
  }
};

const statusLabels = {
  pendente: "Pendente",
  andamento: "Em andamento",
  concluido: "Concluído",
};

const lojaTitulo = el("lojaTitulo");
const lojaDescricao = el("lojaDescricao");
const lojaSite = el("lojaSite");
const lojaTotalCenarios = el("lojaTotalCenarios");
const lojaTotalAmbientes = el("lojaTotalAmbientes");

const scenarioForm = el("scenarioForm");
const scenarioTitle = el("scenarioTitle");
const scenarioCategory = el("scenarioCategory");
const scenarioAutomation = el("scenarioAutomation");
const scenarioCluster = el("scenarioCluster");
const scenarioObs = el("scenarioObs");

const storeForm = el("storeForm");
const storeFormTitle = el("storeFormTitle");
const storeFormSubmit = el("storeFormSubmit");
const storeNameInput = el("storeName");
const storeSiteInput = el("storeSite");
const storeDescriptionInput = el("storeDescription");

const environmentForm = el("environmentForm");
const environmentStoreName = el("environmentStoreName");
const environmentKindInput = el("environmentKind");
const environmentTestTypeInput = el("environmentTestType");
const environmentIdentifierInput = el("environmentIdentifier");
const environmentNotesInput = el("environmentNotes");

const confirmMessage = el("confirmMessage");
const confirmOk = el("confirmOk");

const ambienteTitulo = el("ambienteTitulo");
const ambienteLoja = el("ambienteLoja");
const ambienteKind = el("ambienteKind");
const ambienteIdentifier = el("ambienteIdentifier");
const ambienteTestType = el("ambienteTestType");
const ambienteTotalCenarios = el("ambienteTotalCenarios");
const ambienteNotes = el("ambienteNotes");
const cenariosExecucao = el("cenariosExecucao");

const abrirModal = (id) => {
  const modal = el(id);
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
};

const fecharModal = (target) => {
  const modal = typeof target === "string" ? el(target) : target;
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal.is-open")) {
    document.body.classList.remove("modal-open");
  }
};

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) fecharModal(modal);
  });
});

document.querySelectorAll("[data-modal-close]").forEach((button) => {
  button.addEventListener("click", () => fecharModal(button.closest(".modal")));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal.is-open").forEach((modal) => fecharModal(modal));
  }
});

const abrirConfirmacao = (mensagem, handler) => {
  confirmMessage.textContent = mensagem;
  confirmHandler = handler;
  abrirModal("modalConfirm");
};

confirmOk.addEventListener("click", async () => {
  if (typeof confirmHandler === "function") {
    try {
      await confirmHandler();
    } catch (error) {
      console.error("Erro ao executar confirmação:", error);
    }
  }
  fecharModal("modalConfirm");
  confirmHandler = null;
});

const renderLojaResumo = () => {
  if (!lojaSelecionada) return;
  lojaTitulo.textContent = lojaSelecionada.name || "Loja";

  const descricao = (lojaSelecionada.description || "").trim();
  lojaDescricao.textContent =
    descricao || "Nenhuma descrição cadastrada. Utilize o botão Editar para adicionar um resumo.";

  const siteNormalizado = normalizeUrl(lojaSelecionada.site || "");
  if (siteNormalizado) {
    lojaSite.textContent = formatUrlLabel(siteNormalizado);
    lojaSite.href = siteNormalizado;
    lojaSite.classList.remove("placeholder");
  } else {
    lojaSite.textContent = "Nenhum site cadastrado";
    lojaSite.removeAttribute("href");
    lojaSite.classList.add("placeholder");
  }

  const totalCenarios =
    typeof lojaSelecionada.scenarioCount === "number"
      ? lojaSelecionada.scenarioCount
      : (lojaSelecionada.scenarios || []).length;
  lojaTotalCenarios.textContent = totalCenarios;

  lojaTotalAmbientes.textContent = lojaSelecionada.environmentCount ?? 0;
};

const atualizarLojaSelecionada = (partial = {}) => {
  if (!lojaSelecionada) return;
  const updatedSite =
    partial.site !== undefined ? normalizeUrl(partial.site) : lojaSelecionada.site;
  lojaSelecionada = {
    ...lojaSelecionada,
    ...partial,
    site: updatedSite || "",
  };
  if (lojaSelecionada.description === undefined || lojaSelecionada.description === null) {
    lojaSelecionada.description = "";
  }
  renderLojaResumo();
};

onSnapshot(
  query(collection(db, "stores"), orderBy("createdAt", "desc")),
  (snapshot) => {
    const dash = el("dashboardStores");
    dash.innerHTML = "";
    let hasStores = false;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement("article");
      card.className = "store-card";

      const header = document.createElement("div");
      header.className = "store-card__header";

      const title = document.createElement("strong");
      title.className = "store-card__title";
      title.textContent = data.name || "Loja";

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = `${(data.scenarios || []).length} cenários`;

      header.append(title, badge);
      card.appendChild(header);

      const site = document.createElement("span");
      site.className = "muted";
      site.textContent = formatUrlLabel(data.site || "") || "Nenhum site cadastrado";
      card.appendChild(site);

      if (data.description) {
        const desc = document.createElement("p");
        desc.className = "scenario-note";
        desc.textContent = data.description;
        card.appendChild(desc);
      }

      card.addEventListener("click", () => abrirLoja(docSnap.id, data));

      dash.appendChild(card);
      hasStores = true;
    });

    if (!hasStores) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("h3");
      title.textContent = "Nenhuma loja cadastrada";
      const text = document.createElement("p");
      text.className = "muted";
      text.textContent = "Clique em \"+ Nova Loja\" para iniciar sua organização.";
      empty.append(title, text);
      dash.appendChild(empty);
    }
  }
);

const abrirLoja = (id, data) => {
  if (unsubscribeAmbiente) {
    unsubscribeAmbiente();
    unsubscribeAmbiente = null;
  }

  lojaSelecionada = {
    id,
    ...data,
    description: data.description || "",
    site: normalizeUrl(data.site || ""),
    scenarios: Array.isArray(data.scenarios) ? data.scenarios : [],
    scenarioCount: Array.isArray(data.scenarios) ? data.scenarios.length : 0,
    environmentCount: 0,
  };

  renderLojaResumo();
  showView("secLoja");
  loadCenariosTabela(id);
  loadAmbientes(id);
};

el("btnVoltarDashboard").addEventListener("click", () => {
  showView("secDashboard");
  lojaSelecionada = null;
  if (unsubscribeAmbientes) {
    unsubscribeAmbientes();
    unsubscribeAmbientes = null;
  }
  if (unsubscribeAmbiente) {
    unsubscribeAmbiente();
    unsubscribeAmbiente = null;
  }
});

el("btnVoltarLoja").addEventListener("click", () => {
  showView("secLoja");
  if (unsubscribeAmbiente) {
    unsubscribeAmbiente();
    unsubscribeAmbiente = null;
  }
  ambienteSelecionado = null;
});

el("btnNovaLoja").addEventListener("click", () => {
  storeForm.reset();
  storeForm.dataset.mode = "create";
  storeFormTitle.textContent = "Nova loja";
  storeFormSubmit.textContent = "Criar loja";
  abrirModal("modalStore");
});

el("btnEditarLoja").addEventListener("click", () => {
  if (!lojaSelecionada) return;
  storeForm.reset();
  storeForm.dataset.mode = "edit";
  storeFormTitle.textContent = "Editar loja";
  storeFormSubmit.textContent = "Salvar alterações";
  storeNameInput.value = lojaSelecionada.name || "";
  storeSiteInput.value = lojaSelecionada.site || "";
  storeDescriptionInput.value = lojaSelecionada.description || "";
  abrirModal("modalStore");
});

el("btnExcluirLoja").addEventListener("click", () => {
  if (!lojaSelecionada) return;
  abrirConfirmacao(
    `Excluir a loja "${lojaSelecionada.name}" removerá todos os ambientes associados. Deseja continuar?`,
    async () => {
      const storeId = lojaSelecionada.id;
      const envQuery = query(
        collection(db, "environments"),
        where("storeId", "==", storeId)
      );
      const envSnap = await getDocs(envQuery);
      await Promise.all(envSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "stores", storeId));
      showView("secDashboard");
      lojaSelecionada = null;
      if (unsubscribeAmbientes) {
        unsubscribeAmbientes();
        unsubscribeAmbientes = null;
      }
    }
  );
});

storeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = storeForm.dataset.mode || "create";
  const name = storeNameInput.value.trim();
  const site = normalizeUrl(storeSiteInput.value || "");
  const description = storeDescriptionInput.value.trim();

  if (!name) return;

  const payload = {
    name,
    site,
    description,
  };

  try {
    if (mode === "edit" && lojaSelecionada) {
      await updateDoc(doc(db, "stores", lojaSelecionada.id), payload);
      atualizarLojaSelecionada(payload);
    } else {
      await addDoc(collection(db, "stores"), {
        ...payload,
        scenarios: [],
        createdAt: serverTimestamp(),
      });
    }
    storeForm.reset();
    fecharModal("modalStore");
  } catch (error) {
    console.error("Erro ao salvar loja:", error);
  }
});

scenarioForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!lojaSelecionada) return;

  const scenario = {
    title: scenarioTitle.value.trim(),
    category: scenarioCategory.value.trim(),
    automation: scenarioAutomation.value,
    cluster: scenarioCluster.value,
    obs: scenarioObs.value.trim(),
  };

  const ref = doc(db, "stores", lojaSelecionada.id);
  const snap = await getDoc(ref);
  const data = snap.data();
  const arr = Array.isArray(data?.scenarios) ? [...data.scenarios] : [];
  arr.push(scenario);

  await updateDoc(ref, { scenarios: arr });
  scenarioForm.reset();
  loadCenariosTabela(lojaSelecionada.id);
});

async function loadCenariosTabela(id) {
  const ref = doc(db, "stores", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const tab = el("cenariosTabela");
  tab.innerHTML = `
    <thead>
      <tr>
        <th>Título</th>
        <th>Categoria</th>
        <th>Automação</th>
        <th>Cluster</th>
        <th>Observações</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = tab.querySelector("tbody");
  const scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];

  if (!scenarios.length) {
    const row = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "empty";
    td.textContent = "Nenhum cenário cadastrado até o momento.";
    row.appendChild(td);
    tbody.appendChild(row);
  } else {
    scenarios.forEach((sc, idx) => {
      const row = document.createElement("tr");

      const cellTitulo = document.createElement("td");
      cellTitulo.textContent = sc.title || "-";

      const cellCategoria = document.createElement("td");
      cellCategoria.textContent = sc.category || "-";

      const cellAuto = document.createElement("td");
      cellAuto.textContent = sc.automation || "-";

      const cellCluster = document.createElement("td");
      cellCluster.textContent = sc.cluster || "-";

      const cellObs = document.createElement("td");
      cellObs.textContent = sc.obs || "";

      const cellActions = document.createElement("td");
      cellActions.className = "actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-danger";
      btn.textContent = "Remover";
      btn.addEventListener("click", async () => {
        const newArr = [...scenarios];
        newArr.splice(idx, 1);
        await updateDoc(ref, { scenarios: newArr });
        loadCenariosTabela(id);
      });
      cellActions.appendChild(btn);

      row.append(cellTitulo, cellCategoria, cellAuto, cellCluster, cellObs, cellActions);
      tbody.appendChild(row);
    });
  }

  lojaSelecionada = {
    ...lojaSelecionada,
    ...data,
    site: normalizeUrl(data.site || lojaSelecionada?.site || ""),
    description: data.description || lojaSelecionada?.description || "",
    scenarios,
    scenarioCount: scenarios.length,
  };
  renderLojaResumo();
}

el("btnNovoAmbiente").addEventListener("click", () => {
  if (!lojaSelecionada) return;
  environmentForm.reset();
  environmentStoreName.textContent = lojaSelecionada.name;
  abrirModal("modalEnvironment");
});

environmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!lojaSelecionada) return;

  const kind = environmentKindInput.value.trim();
  const testType = environmentTestTypeInput.value;
  const identifier = environmentIdentifierInput.value.trim();
  const notes = environmentNotesInput.value.trim();

  if (!kind || !identifier) return;

  try {
    const sRef = doc(db, "stores", lojaSelecionada.id);
    const snap = await getDoc(sRef);
    const data = snap.data() || lojaSelecionada;
    const scenarios = Array.isArray(data.scenarios)
      ? data.scenarios.map((sc) => ({ ...sc, status: "pendente" }))
      : [];

    await addDoc(collection(db, "environments"), {
      storeId: lojaSelecionada.id,
      storeName: data.name || lojaSelecionada.name,
      kind,
      testType,
      identifier,
      notes,
      scenarios,
      createdAt: serverTimestamp(),
    });

    environmentForm.reset();
    fecharModal("modalEnvironment");
  } catch (error) {
    console.error("Erro ao criar ambiente:", error);
  }
});

function loadAmbientes(storeId) {
  if (unsubscribeAmbientes) {
    unsubscribeAmbientes();
  }

  const list = el("ambientesList");

  unsubscribeAmbientes = onSnapshot(
    query(collection(db, "environments"), orderBy("createdAt", "desc")),
    (snap) => {
      list.innerHTML = "";
      let count = 0;

      snap.forEach((docSnap) => {
        const env = docSnap.data();
        if (env.storeId !== storeId) return;
        count += 1;

        const card = document.createElement("article");
        card.className = "store-card";

        const header = document.createElement("div");
        header.className = "store-card__header";
        const title = document.createElement("strong");
        title.className = "store-card__title";
        title.textContent = env.kind || "Ambiente";
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `${(env.scenarios || []).length} cenários`;
        header.append(title, badge);
        card.appendChild(header);

        const meta = document.createElement("span");
        meta.className = "muted";
        const metaParts = [];
        if (env.testType) metaParts.push(env.testType);
        if (env.identifier) metaParts.push(env.identifier);
        meta.textContent = metaParts.join(" • ") || "Detalhes não informados";
        card.appendChild(meta);

        if (env.notes) {
          const notes = document.createElement("p");
          notes.className = "scenario-note";
          notes.textContent = env.notes;
          card.appendChild(notes);
        }

        card.addEventListener("click", () => abrirAmbiente(env, docSnap.id));
        list.appendChild(card);
      });

      if (count === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const title = document.createElement("h3");
        title.textContent = "Nenhum ambiente criado";
        const text = document.createElement("p");
        text.className = "muted";
        text.textContent = "Crie o primeiro ambiente para acompanhar execuções.";
        const action = document.createElement("button");
        action.className = "ghost";
        action.textContent = "Criar ambiente";
        action.addEventListener("click", () => el("btnNovoAmbiente").click());
        empty.append(title, text, action);
        list.appendChild(empty);
      }

      atualizarLojaSelecionada({ environmentCount: count });
    }
  );
}

function abrirAmbiente(env, id) {
  showView("secAmbiente");

  if (unsubscribeAmbiente) {
    unsubscribeAmbiente();
  }

  ambienteSelecionado = { id, ...env };
  renderAmbiente();

  unsubscribeAmbiente = onSnapshot(doc(db, "environments", id), (snap) => {
    if (!snap.exists()) {
      ambienteSelecionado = null;
      if (unsubscribeAmbiente) {
        unsubscribeAmbiente();
        unsubscribeAmbiente = null;
      }
      showView("secLoja");
      return;
    }
    ambienteSelecionado = { id: snap.id, ...snap.data() };
    renderAmbiente();
  });
}

function renderAmbiente() {
  if (!ambienteSelecionado) return;

  const env = ambienteSelecionado;
  const headerParts = [env.kind, env.testType].filter(Boolean).join(" · ");
  const suffix = env.identifier ? ` — ${env.identifier}` : "";
  ambienteTitulo.textContent = `${headerParts || "Ambiente"}${suffix}`;

  ambienteLoja.textContent = env.storeName || lojaSelecionada?.name || "-";
  ambienteKind.textContent = env.kind || "-";
  ambienteIdentifier.textContent = env.identifier || "—";
  ambienteTestType.textContent = env.testType || "—";
  ambienteTotalCenarios.textContent = env.scenarios?.length || 0;
  ambienteNotes.textContent = env.notes || "Nenhuma observação registrada para este ambiente.";
  ambienteNotes.classList.toggle("muted", !env.notes);

  cenariosExecucao.innerHTML = "";
  const scenarios = Array.isArray(env.scenarios) ? env.scenarios : [];

  if (!scenarios.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    const title = document.createElement("h3");
    title.textContent = "Sem cenários neste ambiente";
    const text = document.createElement("p");
    text.className = "muted";
    text.textContent = "Adicione cenários na loja para que apareçam aqui.";
    empty.append(title, text);
    cenariosExecucao.appendChild(empty);
    return;
  }

  scenarios.forEach((sc, idx) => {
    const item = document.createElement("li");
    item.className = "scenario-row";

    const info = document.createElement("div");
    info.className = "scenario-info";

    const title = document.createElement("strong");
    title.textContent = sc.title || "Cenário";

    const meta = document.createElement("span");
    meta.className = "scenario-meta";
    const details = [sc.category, sc.cluster, sc.automation].filter(Boolean).join(" • ");
    meta.textContent = details || "Detalhes não informados";

    info.append(title, meta);

    if (sc.obs) {
      const note = document.createElement("span");
      note.className = "scenario-note";
      note.textContent = sc.obs;
      info.appendChild(note);
    }

    const select = document.createElement("select");
    const statusAtual = sc.status || "pendente";
    select.className = `status status--${statusAtual}`;

    ["pendente", "andamento", "concluido"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = statusLabels[status];
      option.selected = status === statusAtual;
      select.appendChild(option);
    });

    select.addEventListener("change", async () => {
      const novoStatus = select.value;
      select.className = `status status--${novoStatus}`;

      const envId = ambienteSelecionado?.id;
      if (!envId) return;

      const atualizados = (ambienteSelecionado.scenarios || []).map((item, index) =>
        index === idx ? { ...item, status: novoStatus } : item
      );

      select.disabled = true;
      try {
        await updateDoc(doc(db, "environments", envId), { scenarios: atualizados });
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
      } finally {
        select.disabled = false;
      }
    });

    item.append(info, select);
    cenariosExecucao.appendChild(item);
  });
}
