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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let lojaSelecionada = null,
  ambienteSelecionado = null;

// Helpers
const el = (id) => document.getElementById(id);

// ---------- DASHBOARD ----------
onSnapshot(
  query(collection(db, "stores"), orderBy("createdAt", "desc")),
  (snapshot) => {
    const dash = el("dashboardStores");
    dash.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const d = docSnap.data(),
        id = docSnap.id;
      const card = document.createElement("div");
      card.className = "store-card";
      card.innerHTML = `<strong>${d.name}</strong><span>${
        (d.scenarios || []).length
      } cenários</span>`;
      card.onclick = () => abrirLoja(id, d);
      dash.appendChild(card);
    });
  }
);

el("btnNovaLoja").onclick = async () => {
  const nome = prompt("Nome da loja:");
  if (!nome) return;
  const site = prompt("Site:", "https://");
  if (!site) return;
  await addDoc(collection(db, "stores"), {
    name: nome,
    site,
    scenarios: [],
    createdAt: serverTimestamp(),
  });
};

// ---------- LOJA ----------
function abrirLoja(id, data) {
  lojaSelecionada = { id, ...data };
  el("secDashboard").style.display = "none";
  el("secLoja").style.display = "block";
  el("lojaTitulo").textContent = data.name;
  loadCenariosTabela(id);
  loadAmbientes(id);
}
el("btnVoltarDashboard").onclick = () => {
  el("secLoja").style.display = "none";
  el("secDashboard").style.display = "block";
};

// editar/excluir loja
el("btnEditarLoja").onclick = async () => {
  if (!lojaSelecionada) return;
  const nome = prompt("Novo nome:", lojaSelecionada.name);
  const site = prompt("Novo site:", lojaSelecionada.site);
  if (nome && site)
    await updateDoc(doc(db, "stores", lojaSelecionada.id), {
      name: nome,
      site,
    });
};
el("btnExcluirLoja").onclick = async () => {
  if (!lojaSelecionada) return;
  if (confirm("Excluir loja e ambientes?")) {
    const envSnap = await getDocs(collection(db, "environments"));
    envSnap.forEach(async (eDoc) => {
      if (eDoc.data().storeId === lojaSelecionada.id)
        await deleteDoc(doc(db, "environments", eDoc.id));
    });
    await deleteDoc(doc(db, "stores", lojaSelecionada.id));
    el("secLoja").style.display = "none";
    el("secDashboard").style.display = "block";
  }
};

// ---------- CENÁRIOS ----------
el("scenarioForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const sc = {
    title: el("scenarioTitle").value,
    category: el("scenarioCategory").value,
    automation: el("scenarioAutomation").value,
    cluster: el("scenarioCluster").value,
    obs: el("scenarioObs").value,
  };
  const ref = doc(db, "stores", lojaSelecionada.id);
  const snap = await getDoc(ref);
  let arr = snap.data().scenarios || [];
  arr.push(sc);
  await updateDoc(ref, { scenarios: arr });
  e.target.reset();
  loadCenariosTabela(lojaSelecionada.id);
});

async function loadCenariosTabela(id) {
  const ref = doc(db, "stores", id);
  const snap = await getDoc(ref);
  const data = snap.data();
  const tab = el("cenariosTabela");
  tab.innerHTML =
    "<tr><th>Título</th><th>Categoria</th><th>Auto</th><th>Cluster</th><th>Obs</th><th></th></tr>";
  (data.scenarios || []).forEach((sc, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${sc.title}</td><td>${sc.category}</td><td>${
      sc.automation
    }</td><td>${sc.cluster}</td><td>${sc.obs || ""}</td>`;
    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "X";
    btn.onclick = async () => {
      let arr = data.scenarios;
      arr.splice(idx, 1);
      await updateDoc(ref, { scenarios: arr });
      loadCenariosTabela(id);
    };
    td.appendChild(btn);
    tr.appendChild(td);
    tab.appendChild(tr);
  });
}

// ---------- AMBIENTES ----------
el("btnNovoAmbiente").onclick = async () => {
  const kind = prompt("Tipo de ambiente (WS/TM):", "WS");
  const testType = prompt("Tipo de teste:", "regressivo");
  const identifier = prompt("Identificador:", "ws-qa");
  const sRef = doc(db, "stores", lojaSelecionada.id);
  const snap = await getDoc(sRef);
  const d = snap.data();
  const scenarios = (d.scenarios || []).map((sc) => ({
    ...sc,
    status: "pendente",
  }));
  await addDoc(collection(db, "environments"), {
    storeId: lojaSelecionada.id,
    storeName: d.name,
    kind,
    testType,
    identifier,
    scenarios,
    createdAt: serverTimestamp(),
  });
};

function loadAmbientes(storeId) {
  onSnapshot(
    query(collection(db, "environments"), orderBy("createdAt", "desc")),
    (snap) => {
      const list = el("ambientesList");
      list.innerHTML = "";
      snap.forEach((docSnap) => {
        const env = docSnap.data(),
          id = docSnap.id;
        if (env.storeId === storeId) {
          const card = document.createElement("div");
          card.className = "store-card";
          card.innerHTML = `<strong>${env.kind}</strong> - ${
            env.testType
          }<div>${(env.scenarios || []).length} cenários</div>`;
          card.onclick = () => abrirAmbiente(env, id);
          list.appendChild(card);
        }
      });
    }
  );
}

// ---------- AMBIENTE DETALHE ----------
function abrirAmbiente(env, id) {
  ambienteSelecionado = { id, ...env };
  el("secLoja").style.display = "none";
  el("secAmbiente").style.display = "block";
  el("ambienteTitulo").textContent = `${env.kind} - ${env.testType} (${
    env.identifier || ""
  })`;
  const ul = el("cenariosExecucao");
  ul.innerHTML = "";
  (env.scenarios || []).forEach((sc, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `${sc.title} (${sc.category})`;
    const select = document.createElement("select");
    select.className = "status";
    ["pendente", "andamento", "concluido"].forEach((opt) => {
      const o = new Option(opt, opt, opt === sc.status, opt === sc.status);
      select.appendChild(o);
    });
    select.onchange = async () => {
      let newSc = [...env.scenarios];
      newSc[idx].status = select.value;
      await updateDoc(doc(db, "environments", id), { scenarios: newSc });
    };
    li.appendChild(select);
    ul.appendChild(li);
  });
}
el("btnVoltarLoja").onclick = () => {
  el("secAmbiente").style.display = "none";
  el("secLoja").style.display = "block";
};
