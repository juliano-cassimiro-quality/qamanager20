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
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const savedTheme = localStorage.getItem("qa-theme") || "dark";
document.body.dataset.theme = savedTheme;
let currentTheme = savedTheme;

let currentUser = null;
let userProfileData = { displayName: "", email: "", theme: currentTheme };
let lastMainView = "secDashboard";
let previousViewBeforeProfile = "secDashboard";
let unsubscribeDashboard = null;

let lojaSelecionada = null;
let ambienteSelecionado = null;
let confirmHandler = null;
let unsubscribeAmbientes = null;
let unsubscribeAmbiente = null;
let scenarioCategoryFilterValue = "all";
let ambienteScenarioCategoryFilterValue = "all";
let pendingScenarioImportType = null;
let jsPDFConstructor = null;

const el = (id) => document.getElementById(id);
const showView = (id) => {
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-visible", section.id === id);
  });
  if (id !== "secProfile") {
    lastMainView = id;
  }
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

const removeDiacritics = (value) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const toText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const stripScenarioStage = (scenario) => {
  if (!scenario || typeof scenario !== "object") return {};
  const { stage, ...rest } = scenario;
  return rest;
};

const normalizeAmbienteScenario = (scenario) => {
  if (!scenario || typeof scenario !== "object") return {};
  const normalized = { ...scenario };

  if (!statusLabels[normalized.status]) {
    normalized.status = "pendente";
  }

  return normalized;
};

const normalizeCategoryKey = (value) =>
  removeDiacritics(value)
    .toLowerCase()
    .trim();

const slugify = (value) => {
  const base = removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "cenarios";
};

const escapeMarkdownCell = (value) =>
  toText(value)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const setupTableCollapse = (button, target) => {
  if (!button || !target) return;

  const expandedLabel =
    button.getAttribute("data-expanded-label") || "Minimizar tabela";
  const collapsedLabel =
    button.getAttribute("data-collapsed-label") || "Expandir tabela";

  if (target.id && !button.getAttribute("aria-controls")) {
    button.setAttribute("aria-controls", target.id);
  }

  const updateLabel = () => {
    const isCollapsed = target.classList.contains("is-collapsed");
    button.textContent = isCollapsed ? collapsedLabel : expandedLabel;
    button.setAttribute("aria-expanded", String(!isCollapsed));
  };

  button.addEventListener("click", () => {
    target.classList.toggle("is-collapsed");
    updateLabel();
  });

  updateLabel();
};

const authShell = el("authShell");
const appShell = el("appShell");
const userActions = el("userActions");
const userDisplayName = el("userDisplayName");
const btnOpenProfile = el("btnOpenProfile");
const btnSignOut = el("btnSignOut");
const btnProfileBack = el("btnProfileBack");

const loginForm = el("loginForm");
const loginEmail = el("loginEmail");
const loginPassword = el("loginPassword");
const loginFeedback = el("loginFeedback");

const registerForm = el("registerForm");
const registerName = el("registerName");
const registerEmail = el("registerEmail");
const registerPassword = el("registerPassword");
const registerConfirm = el("registerConfirm");
const registerFeedback = el("registerFeedback");

const resetForm = el("resetForm");
const resetEmail = el("resetEmail");
const resetFeedback = el("resetFeedback");

const profileForm = el("profileForm");
const profileName = el("profileName");
const profileEmail = el("profileEmail");
const profileFeedback = el("profileFeedback");

const authSwitchButtons = document.querySelectorAll("[data-auth-target]");

const getThemeRadios = () =>
  Array.from(document.querySelectorAll('input[name="profileTheme"]'));

const applyTheme = (theme) => {
  const normalized = theme === "light" ? "light" : "dark";
  currentTheme = normalized;
  document.body.dataset.theme = normalized;
  localStorage.setItem("qa-theme", normalized);
  getThemeRadios().forEach((input) => {
    input.checked = input.value === normalized;
  });
};

const updateFeedback = (element, message = "", type = "error") => {
  if (!element) return;
  element.textContent = message;
  element.className = `form-feedback${message ? ` is-${type}` : ""}`;
};

const setFormLoading = (form, isLoading, loadingText = "Aguarde...") => {
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  if (isLoading) {
    if (!submit.dataset.originalText) {
      submit.dataset.originalText = submit.textContent;
    }
    submit.textContent = loadingText;
    submit.disabled = true;
  } else {
    submit.textContent = submit.dataset.originalText || submit.textContent;
    submit.disabled = false;
  }
};

const showAuthView = (id) => {
  document.querySelectorAll(".auth-card").forEach((card) => {
    card.classList.toggle("is-visible", card.id === id);
  });
};

const setAppVisibility = (isAuthenticated) => {
  if (!authShell || !appShell) return;
  if (isAuthenticated) {
    authShell.classList.add("is-hidden");
    appShell.classList.remove("is-hidden");
  } else {
    appShell.classList.add("is-hidden");
    authShell.classList.remove("is-hidden");
  }
};

const updateUserHeader = () => {
  if (!userDisplayName) return;
  const name =
    userProfileData.displayName ||
    userProfileData.email ||
    currentUser?.email ||
    "Usuário";
  userDisplayName.textContent = name;
  if (userActions) {
    userActions.classList.remove("is-hidden");
  }
};

const clearUserHeader = () => {
  if (userDisplayName) {
    userDisplayName.textContent = "Usuário";
  }
  if (userActions) {
    userActions.classList.add("is-hidden");
  }
};

const populateProfileForm = () => {
  if (!profileForm) return;
  if (profileName) {
    profileName.value = userProfileData.displayName || "";
  }
  if (profileEmail) {
    profileEmail.value = userProfileData.email || currentUser?.email || "";
  }
  updateFeedback(profileFeedback);
  const theme = userProfileData.theme || currentTheme;
  getThemeRadios().forEach((input) => {
    input.checked = input.value === theme;
  });
};

const getAuthErrorMessage = (code = "") => {
  const messages = {
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/missing-email": "Informe um e-mail válido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha inválida. Verifique os dados e tente novamente.",
    "auth/invalid-credential": "Credenciais inválidas. Revise e tente novamente.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/weak-password": "Utilize uma senha com pelo menos 6 caracteres.",
    "auth/network-request-failed": "Não foi possível conectar. Verifique sua internet.",
  };
  return messages[code] || "Não foi possível concluir a operação. Tente novamente.";
};

const ensureUserDocument = async (user) => {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    const payload = {
      displayName: user.displayName || "",
      email: user.email,
      theme: currentTheme,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, payload);
    return payload;
  }
  return snapshot.data();
};

const loadUserProfile = async (user) => {
  const data = await ensureUserDocument(user);
  const theme = data?.theme === "light" ? "light" : "dark";
  userProfileData = {
    displayName: data?.displayName || "",
    email: data?.email || user.email || "",
    theme,
  };
  applyTheme(theme);
  populateProfileForm();
  updateUserHeader();
};

applyTheme(currentTheme);
clearUserHeader();

authSwitchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-auth-target");
    if (!target) return;
    showAuthView(target);
    updateFeedback(loginFeedback);
    updateFeedback(registerFeedback);
    updateFeedback(resetFeedback);

    if (target === "authReset" && loginEmail && resetEmail && !resetEmail.value) {
      resetEmail.value = loginEmail.value;
    }

    if (target === "authLogin" && registerEmail && loginEmail && registerEmail.value) {
      loginEmail.value = registerEmail.value;
    }
  });
});

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginEmail || !loginPassword) return;

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      updateFeedback(loginFeedback, "Informe e-mail e senha.");
      return;
    }

    updateFeedback(loginFeedback);
    setFormLoading(loginForm, true, "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Erro ao entrar:", error);
      updateFeedback(loginFeedback, getAuthErrorMessage(error.code));
    } finally {
      setFormLoading(loginForm, false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!registerEmail || !registerPassword || !registerConfirm) return;

    const name = registerName?.value.trim() || "";
    const email = registerEmail.value.trim();
    const password = registerPassword.value;
    const confirm = registerConfirm.value;

    if (!email || !password) {
      updateFeedback(registerFeedback, "Informe e-mail e senha.");
      return;
    }

    if (password !== confirm) {
      updateFeedback(registerFeedback, "As senhas não coincidem.");
      return;
    }

    updateFeedback(registerFeedback);
    setFormLoading(registerForm, true, "Criando conta...");
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name && credential.user) {
        await updateProfile(credential.user, { displayName: name });
      }
      await setDoc(doc(db, "users", credential.user.uid), {
        displayName: name,
        email,
        theme: currentTheme,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      updateFeedback(registerFeedback, getAuthErrorMessage(error.code));
    } finally {
      setFormLoading(registerForm, false);
    }
  });
}

if (resetForm) {
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!resetEmail) return;

    const email = resetEmail.value.trim();
    if (!email) {
      updateFeedback(resetFeedback, "Informe um e-mail válido.");
      return;
    }

    updateFeedback(resetFeedback);
    setFormLoading(resetForm, true, "Enviando...");
    try {
      await sendPasswordResetEmail(auth, email);
      updateFeedback(
        resetFeedback,
        "Enviamos um e-mail com as instruções para redefinir sua senha.",
        "success"
      );
    } catch (error) {
      console.error("Erro ao solicitar redefinição de senha:", error);
      updateFeedback(resetFeedback, getAuthErrorMessage(error.code));
    } finally {
      setFormLoading(resetForm, false);
    }
  });
}

if (btnOpenProfile) {
  btnOpenProfile.addEventListener("click", () => {
    if (!currentUser) return;
    const activeView = document.querySelector(".view.is-visible");
    if (activeView && activeView.id !== "secProfile") {
      previousViewBeforeProfile = activeView.id;
    } else {
      previousViewBeforeProfile = lastMainView || "secDashboard";
    }
    populateProfileForm();
    showView("secProfile");
  });
}

if (btnProfileBack) {
  btnProfileBack.addEventListener("click", () => {
    showView(previousViewBeforeProfile || "secDashboard");
  });
}

if (btnSignOut) {
  btnSignOut.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  });
}

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) return;

    const name = profileName?.value.trim() || "";
    const selectedTheme =
      profileForm.querySelector('input[name="profileTheme"]:checked')?.value ||
      currentTheme;

    updateFeedback(profileFeedback);
    setFormLoading(profileForm, true, "Salvando...");
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        displayName: name,
        theme: selectedTheme,
        updatedAt: serverTimestamp(),
      });

      userProfileData = {
        ...userProfileData,
        displayName: name,
        email: currentUser.email,
        theme: selectedTheme === "light" ? "light" : "dark",
      };

      applyTheme(userProfileData.theme);
      updateUserHeader();

      if (name !== (currentUser.displayName || "")) {
        await updateProfile(currentUser, { displayName: name || "" });
      }

      updateFeedback(
        profileFeedback,
        "Preferências atualizadas com sucesso!",
        "success"
      );
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      updateFeedback(
        profileFeedback,
        "Não foi possível salvar as alterações. Tente novamente."
      );
    } finally {
      setFormLoading(profileForm, false);
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    try {
      await loadUserProfile(user);
    } catch (error) {
      console.error("Erro ao carregar perfil do usuário:", error);
      userProfileData = {
        displayName: user.displayName || "",
        email: user.email || "",
        theme: currentTheme,
      };
      updateUserHeader();
      populateProfileForm();
    }
    setAppVisibility(true);
    subscribeDashboard();
    showView("secDashboard");
  } else {
    currentUser = null;
    userProfileData = { displayName: "", email: "", theme: currentTheme };
    lastMainView = "secDashboard";
    previousViewBeforeProfile = "secDashboard";
    setAppVisibility(false);

    if (unsubscribeDashboard) {
      unsubscribeDashboard();
      unsubscribeDashboard = null;
    }
    if (unsubscribeAmbientes) {
      unsubscribeAmbientes();
      unsubscribeAmbientes = null;
    }
    if (unsubscribeAmbiente) {
      unsubscribeAmbiente();
      unsubscribeAmbiente = null;
    }

    lojaSelecionada = null;
    ambienteSelecionado = null;

    clearDashboard();
    clearUserHeader();
    updateFeedback(profileFeedback);
    updateFeedback(loginFeedback);
    updateFeedback(registerFeedback);
    updateFeedback(resetFeedback);
    profileForm?.reset();
    loginForm?.reset();
    registerForm?.reset();
    resetForm?.reset();
    showAuthView("authLogin");
  }
});

const lojaTitulo = el("lojaTitulo");
const lojaDescricao = el("lojaDescricao");
const lojaSite = el("lojaSite");
const lojaTotalCenarios = el("lojaTotalCenarios");
const lojaTotalAmbientes = el("lojaTotalAmbientes");

const scenarioForm = el("scenarioForm");
const scenarioTitle = el("scenarioTitle");
const scenarioCategory = el("scenarioCategory");
const scenarioAutomation = el("scenarioAutomation");
const scenarioObs = el("scenarioObs");
const scenarioCategoryFilter = el("scenarioCategoryFilter");
const btnImportCsv = el("btnImportCsv");
const btnImportJson = el("btnImportJson");
const btnExportMarkdown = el("btnExportMarkdown");
const btnExportPdf = el("btnExportPdf");
const btnExportJson = el("btnExportJson");
const scenarioImportInput = el("scenarioImportInput");
const storeScenarioTableWrapper = el("storeScenarioTableWrapper");
const btnToggleStoreScenarioTable = el("btnToggleStoreScenarioTable");

if (scenarioCategoryFilter) {
  scenarioCategoryFilter.value = "all";
  scenarioCategoryFilter.disabled = true;
}

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
const ambienteScenarioFilters = el("ambienteScenarioFilters");
const ambienteScenarioCategoryFilter = el("ambienteScenarioCategoryFilter");
const ambienteScenarioTable = el("ambienteCenariosTabela");
const ambienteScenarioTableWrapper = el("ambienteScenarioTableWrapper");
const btnToggleAmbienteScenarioTable = el("btnToggleAmbienteScenarioTable");
const btnAmbienteExportMarkdown = el("btnAmbienteExportMarkdown");
const btnAmbienteExportPdf = el("btnAmbienteExportPdf");

setupTableCollapse(btnToggleStoreScenarioTable, storeScenarioTableWrapper);
setupTableCollapse(
  btnToggleAmbienteScenarioTable,
  ambienteScenarioTableWrapper
);

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

const clearDashboard = () => {
  const dash = el("dashboardStores");
  if (dash) {
    dash.innerHTML = "";
  }
};

const subscribeDashboard = () => {
  if (unsubscribeDashboard) return;
  unsubscribeDashboard = onSnapshot(
    query(collection(db, "stores"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const dash = el("dashboardStores");
      if (!dash) return;
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
};

const abrirLoja = (id, data) => {
  if (unsubscribeAmbiente) {
    unsubscribeAmbiente();
    unsubscribeAmbiente = null;
  }

  scenarioCategoryFilterValue = "all";
  if (scenarioCategoryFilter) {
    scenarioCategoryFilter.value = "all";
    scenarioCategoryFilter.disabled = true;
  }

  lojaSelecionada = {
    id,
    ...data,
    description: data.description || "",
    site: normalizeUrl(data.site || ""),
    scenarios: Array.isArray(data.scenarios)
      ? data.scenarios.map(stripScenarioStage)
      : [],
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
  scenarioCategoryFilterValue = "all";
  if (scenarioCategoryFilter) {
    scenarioCategoryFilter.value = "all";
    scenarioCategoryFilter.disabled = true;
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
    obs: scenarioObs.value.trim(),
  };

  const ref = doc(db, "stores", lojaSelecionada.id);
  const snap = await getDoc(ref);
  const data = snap.data();
  const arr = Array.isArray(data?.scenarios)
    ? data.scenarios.map(stripScenarioStage)
    : [];
  arr.push(scenario);

  await updateDoc(ref, { scenarios: arr, scenarioCount: arr.length });
  scenarioForm.reset();
  loadCenariosTabela(lojaSelecionada.id);
});

async function loadCenariosTabela(id) {
  const ref = doc(db, "stores", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const tab = el("cenariosTabela");
  if (!tab) return;

  tab.innerHTML = `
    <thead>
      <tr>
        <th>Título</th>
        <th>Categoria</th>
        <th>Automação</th>
        <th>Observações</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const scenarios = Array.isArray(data.scenarios)
    ? data.scenarios.map(stripScenarioStage)
    : [];

  lojaSelecionada = {
    ...(lojaSelecionada || {}),
    ...data,
    id: lojaSelecionada?.id || id,
    site: normalizeUrl(data.site || lojaSelecionada?.site || ""),
    description: data.description || lojaSelecionada?.description || "",
    scenarios,
    scenarioCount: scenarios.length,
  };

  renderLojaResumo();
  renderScenarioFilters(scenarios);
  renderScenarioTableRows(scenarios);
}

function getFilteredScenarios(scenarios) {
  if (!Array.isArray(scenarios)) return [];
  if (scenarioCategoryFilterValue === "all") return scenarios;
  return scenarios.filter(
    (sc) => normalizeCategoryKey(sc.category) === scenarioCategoryFilterValue
  );
}

function getFilteredAmbienteScenarios(scenarios, withIndex = false) {
  if (!Array.isArray(scenarios)) return [];

  const results = [];
  scenarios.forEach((scenario, index) => {
    const categoria = normalizeCategoryKey(scenario?.category || "");
    if (
      ambienteScenarioCategoryFilterValue === "all" ||
      categoria === ambienteScenarioCategoryFilterValue
    ) {
      results.push(withIndex ? { scenario, index } : scenario);
    }
  });

  return results;
}

function renderScenarioFilters(scenarios) {
  if (!scenarioCategoryFilter) return;

  const categories = new Map();

  scenarios.forEach((sc) => {
    const label = toText(sc.category);
    const key = normalizeCategoryKey(label);
    if (!label || !key) return;
    if (!categories.has(key)) {
      categories.set(key, label);
    }
  });

  scenarioCategoryFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Todas as categorias";
  scenarioCategoryFilter.appendChild(allOption);

  categories.forEach((label, key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    scenarioCategoryFilter.appendChild(option);
  });

  if (scenarioCategoryFilterValue !== "all" && !categories.has(scenarioCategoryFilterValue)) {
    scenarioCategoryFilterValue = "all";
  }

  scenarioCategoryFilter.value = scenarioCategoryFilterValue;
  scenarioCategoryFilter.disabled = categories.size === 0;
}

function renderScenarioTableRows(scenarios) {
  const tab = el("cenariosTabela");
  if (!tab) return;

  const tbody = tab.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtered = getFilteredScenarios(scenarios);
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty";
    const hasScenarios = Array.isArray(scenarios) && scenarios.length > 0;
    cell.textContent = hasScenarios
      ? "Nenhum cenário encontrado para o filtro selecionado."
      : "Nenhum cenário cadastrado até o momento.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const storeId = lojaSelecionada?.id;

  filtered.forEach((sc) => {
    const row = document.createElement("tr");

    const cellTitulo = document.createElement("td");
    cellTitulo.textContent = sc.title || "-";

    const cellCategoria = document.createElement("td");
    cellCategoria.textContent = sc.category || "-";

    const cellAuto = document.createElement("td");
    cellAuto.textContent = sc.automation || "-";

    const cellObs = document.createElement("td");
    cellObs.textContent = sc.obs || "";

    const cellActions = document.createElement("td");
    cellActions.className = "actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-danger";
    btn.textContent = "Remover";
    btn.addEventListener("click", async () => {
      if (!storeId) return;
      const current = Array.isArray(lojaSelecionada?.scenarios)
        ? [...lojaSelecionada.scenarios]
        : [];
      const index = current.indexOf(sc);
      if (index === -1) return;
      current.splice(index, 1);
      try {
        await updateDoc(doc(db, "stores", storeId), {
          scenarios: current,
          scenarioCount: current.length,
        });
        loadCenariosTabela(storeId);
      } catch (error) {
        console.error("Erro ao remover cenário:", error);
      }
    });
    cellActions.appendChild(btn);

    row.append(cellTitulo, cellCategoria, cellAuto, cellObs, cellActions);
    tbody.appendChild(row);
  });
}

const updateScenarioTable = () => {
  renderScenarioTableRows(lojaSelecionada?.scenarios || []);
};

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsvScenarios(text) {
  if (!text) return [];

  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) return [];

  const headerLine = lines.shift();
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter);

  return lines.map((line) => {
    const values = splitCsvLine(line, delimiter);
    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index] !== undefined ? values[index] : "";
    });
    return item;
  });
}

function parseJsonScenarios(text) {
  if (!text) return [];
  const normalized = text.trim();
  if (!normalized) return [];
  const parsed = JSON.parse(normalized);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.scenarios)) return parsed.scenarios;
  if (parsed && Array.isArray(parsed.cenarios)) return parsed.cenarios;
  return [];
}

function sanitizeScenarioInput(raw) {
  if (!raw || typeof raw !== "object") return null;

  const normalized = {};
  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = removeDiacritics(key)
      .toLowerCase()
      .replace(/\s+/g, "");
    normalized[normalizedKey] = value;
  });

  const title = toText(
    normalized.titulo ||
      normalized.title ||
      normalized.nome ||
      normalized.name ||
      normalized.cenario ||
      normalized.scenario
  );
  if (!title) return null;

  const category = toText(
    normalized.categoria ||
      normalized.category ||
      normalized.grupo ||
      normalized.grupocenario
  );

  const automation = toText(
    normalized.automacao ||
      normalized.automation ||
      normalized.statusautomatizacao ||
      normalized.automatizacao
  );

  const obs = toText(
    normalized.observacoes ||
      normalized.obs ||
      normalized.observacao ||
      normalized.notas ||
      normalized.notes
  );

  return {
    title,
    category,
    automation,
    obs,
  };
}

async function handleScenarioImport(type, file) {
  if (!lojaSelecionada) {
    alert("Selecione uma loja para importar cenários.");
    return;
  }

  try {
    const text = await file.text();
    const rawItems = type === "csv" ? parseCsvScenarios(text) : parseJsonScenarios(text);
    const scenariosToAdd = rawItems
      .map(sanitizeScenarioInput)
      .filter(Boolean);

    if (!scenariosToAdd.length) {
      alert("Não encontramos cenários válidos no arquivo selecionado.");
      return;
    }

    const ref = doc(db, "stores", lojaSelecionada.id);
    const snap = await getDoc(ref);
    const data = snap.data() || {};
    const current = Array.isArray(data.scenarios)
      ? data.scenarios.map(stripScenarioStage)
      : [];

    const merged = [...current, ...scenariosToAdd];

    await updateDoc(ref, {
      scenarios: merged,
      scenarioCount: merged.length,
    });

    alert(`${scenariosToAdd.length} cenário(s) importado(s) com sucesso.`);
    loadCenariosTabela(lojaSelecionada.id);
  } catch (error) {
    console.error("Erro ao importar cenários:", error);
    alert("Não foi possível importar os cenários. Verifique o arquivo e tente novamente.");
  }
}

async function loadJsPDF() {
  if (jsPDFConstructor) return jsPDFConstructor;
  const module = await import(
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js"
  );
  jsPDFConstructor = module?.jsPDF;
  if (typeof jsPDFConstructor !== "function") {
    throw new Error("jsPDF não carregado");
  }
  return jsPDFConstructor;
}

function getScenarioExportContext() {
  if (!lojaSelecionada) {
    alert("Abra uma loja para exportar os cenários.");
    return null;
  }

  const rawScenarios = getFilteredScenarios(lojaSelecionada.scenarios || []);
  if (!rawScenarios.length) {
    alert("Não há cenários disponíveis para exportação com o filtro atual.");
    return null;
  }

  const storeName = toText(lojaSelecionada.name) || "Loja";
  const scenarios = rawScenarios.map((scenario) => ({
    title: toText(scenario.title),
    category: toText(scenario.category),
    automation: toText(scenario.automation),
    obs: toText(scenario.obs),
  }));

  const store = {
    id: lojaSelecionada.id || "",
    name: storeName,
    scenarioCount: scenarios.length,
  };

  const description = toText(lojaSelecionada.description);
  if (description) {
    store.description = description;
  }

  const site = normalizeUrl(lojaSelecionada.site);
  if (site) {
    store.site = site;
  }

  return {
    store,
    scenarios,
    filenameSlug: slugify(storeName),
  };
}

function exportScenariosAsMarkdown() {
  const context = getScenarioExportContext();
  if (!context) return;

  const { store, scenarios, filenameSlug } = context;

  const lines = [
    `# Cenários - ${store.name}`,
    "",
    "| Título | Categoria | Automação | Observações |",
    "| --- | --- | --- | --- |",
    ...scenarios.map(
      (sc) =>
        `| ${escapeMarkdownCell(sc.title || "-")} | ${escapeMarkdownCell(
          sc.category || "-"
        )} | ${escapeMarkdownCell(sc.automation || "-")} | ${escapeMarkdownCell(
          sc.obs || ""
        )} |`
    ),
  ];

  downloadFile(
    lines.join("\n"),
    `cenarios-${filenameSlug}.md`,
    "text/markdown;charset=utf-8"
  );
}

async function exportScenariosAsPdf() {
  const context = getScenarioExportContext();
  if (!context) return;

  const { store, scenarios, filenameSlug } = context;

  try {
    const JsPDF = await loadJsPDF();
    const pdf = new JsPDF({ unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "normal");

    const lineHeight = 6;
    const maxY = 280;
    let y = 30;

    const addHeader = () => {
      pdf.setFontSize(16);
      pdf.text(`Cenários - ${store.name}`, 14, 20);
      pdf.setFontSize(12);
      y = 30;
    };

    const ensureSpace = (lines = 1) => {
      if (y + lineHeight * lines > maxY) {
        pdf.addPage();
        addHeader();
      }
    };

    addHeader();

    scenarios.forEach((sc, index) => {
      const entries = [
        `${index + 1}. ${sc.title || "Cenário"}`,
        `Categoria: ${sc.category || "-"}`,
        `Automação: ${sc.automation || "-"}`,
      ];

      if (sc.obs) {
        entries.push(`Observações: ${sc.obs}`);
      }

      entries.forEach((entry, entryIndex) => {
        const wrapped = pdf.splitTextToSize(entry, 180);
        ensureSpace(wrapped.length);
        pdf.text(wrapped, 14, y);
        y += wrapped.length * lineHeight;
        if (entryIndex === entries.length - 1) {
          y += 4;
        }
      });
    });

    pdf.save(`cenarios-${filenameSlug}.pdf`);
  } catch (error) {
    console.error("Erro ao exportar cenários em PDF:", error);
    alert("Não foi possível exportar os cenários em PDF. Tente novamente.");
  }
}

function exportScenariosAsJson() {
  const context = getScenarioExportContext();
  if (!context) return;

  const { store, scenarios, filenameSlug } = context;
  const payload = {
    store,
    exportedAt: new Date().toISOString(),
    scenarios,
  };

  downloadFile(
    JSON.stringify(payload, null, 2),
    `cenarios-${filenameSlug}.json`,
    "application/json;charset=utf-8"
  );
}

function getAmbienteScenarioExportContext() {
  if (!ambienteSelecionado) {
    alert("Abra um ambiente para exportar os cenários.");
    return null;
  }

  const listaFiltrada = getFilteredAmbienteScenarios(
    ambienteSelecionado.scenarios || []
  );

  if (!listaFiltrada.length) {
    alert("Não há cenários disponíveis para exportação com o filtro atual.");
    return null;
  }

  const storeName =
    toText(ambienteSelecionado.storeName || lojaSelecionada?.name) || "Loja";
  const environmentKind = toText(ambienteSelecionado.kind) || "Ambiente";
  const identifier = toText(ambienteSelecionado.identifier);
  const environmentName = identifier
    ? `${environmentKind} (${identifier})`
    : environmentKind;

  const scenarios = listaFiltrada.map((scenario) => {
    const statusValue = statusLabels[scenario.status]
      ? scenario.status
      : "pendente";

    return {
      title: toText(scenario.title) || "Cenário",
      statusValue,
      statusLabel: statusLabels[statusValue],
    };
  });

  const filenameBase = `${storeName} ${environmentKind}${
    identifier ? ` ${identifier}` : ""
  }`;

  return {
    environment: {
      storeName,
      name: environmentName,
      kind: environmentKind,
      identifier,
      testType: toText(ambienteSelecionado.testType),
    },
    scenarios,
    filenameSlug: slugify(filenameBase),
  };
}

function exportAmbienteScenariosAsMarkdown() {
  const context = getAmbienteScenarioExportContext();
  if (!context) return;

  const { environment, scenarios, filenameSlug } = context;
  const heading = [environment.storeName, environment.name]
    .filter(Boolean)
    .join(" · ");

  const lines = [`# Cenários - ${heading}`, ""];

  const meta = [];
  if (environment.testType) {
    meta.push(`Tipo de teste do ambiente: ${environment.testType}`);
  }

  if (meta.length) {
    meta.forEach((entry) => lines.push(`- ${entry}`));
    lines.push("");
  }

  lines.push("| Nome | Status de teste |");
  lines.push("| --- | --- |");

  scenarios.forEach((sc) => {
    lines.push(
      `| ${escapeMarkdownCell(sc.title)} | ${escapeMarkdownCell(
        sc.statusLabel
      )} |`
    );
  });

  downloadFile(
    lines.join("\n"),
    `ambiente-cenarios-${filenameSlug}.md`,
    "text/markdown;charset=utf-8"
  );
}

async function exportAmbienteScenariosAsPdf() {
  const context = getAmbienteScenarioExportContext();
  if (!context) return;

  const { environment, scenarios, filenameSlug } = context;

  try {
    const JsPDF = await loadJsPDF();
    const pdf = new JsPDF({ unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "normal");

    const lineHeight = 6;
    const maxY = 280;
    let y = 30;

    const heading = `Cenários - ${environment.storeName}`;

    const addHeader = () => {
      pdf.setFontSize(16);
      pdf.text(heading, 14, 20);
      pdf.setFontSize(12);
      const subtitleParts = [environment.name];
      if (environment.testType) {
        subtitleParts.push(environment.testType);
      }
      const subtitle = subtitleParts.filter(Boolean).join(" • ");
      if (subtitle) {
        const wrapped = pdf.splitTextToSize(subtitle, 180);
        pdf.text(wrapped, 14, 28);
        y = 28 + wrapped.length * lineHeight + 4;
      } else {
        y = 30;
      }
    };

    const ensureSpace = (lines = 1) => {
      if (y + lineHeight * lines > maxY) {
        pdf.addPage();
        addHeader();
      }
    };

    addHeader();

    scenarios.forEach((sc, index) => {
      const entries = [
        `${index + 1}. ${sc.title}`,
        `Status de teste: ${sc.statusLabel}`,
      ];

      entries.forEach((entry, entryIndex) => {
        const wrapped = pdf.splitTextToSize(entry, 180);
        ensureSpace(wrapped.length);
        pdf.text(wrapped, 14, y);
        y += wrapped.length * lineHeight;
        if (entryIndex === entries.length - 1) {
          y += 4;
        }
      });
    });

    pdf.save(`ambiente-cenarios-${filenameSlug}.pdf`);
  } catch (error) {
    console.error("Erro ao exportar cenários do ambiente em PDF:", error);
    alert(
      "Não foi possível exportar os cenários do ambiente em PDF. Tente novamente."
    );
  }
}

if (scenarioCategoryFilter) {
  scenarioCategoryFilter.addEventListener("change", () => {
    scenarioCategoryFilterValue = scenarioCategoryFilter.value || "all";
    updateScenarioTable();
  });
}

if (ambienteScenarioCategoryFilter) {
  ambienteScenarioCategoryFilter.addEventListener("change", () => {
    ambienteScenarioCategoryFilterValue =
      ambienteScenarioCategoryFilter.value || "all";
    renderAmbienteScenarioTable(ambienteSelecionado?.scenarios || []);
  });
}

const triggerScenarioImport = (type) => {
  if (!scenarioImportInput) return;
  if (!lojaSelecionada) {
    alert("Selecione uma loja para importar cenários.");
    return;
  }
  pendingScenarioImportType = type;
  scenarioImportInput.accept =
    type === "csv" ? ".csv,text/csv" : ".json,application/json";
  scenarioImportInput.value = "";
  scenarioImportInput.click();
};

if (btnImportCsv) {
  btnImportCsv.addEventListener("click", () => triggerScenarioImport("csv"));
}

if (btnImportJson) {
  btnImportJson.addEventListener("click", () => triggerScenarioImport("json"));
}

if (scenarioImportInput) {
  scenarioImportInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (file && pendingScenarioImportType) {
      await handleScenarioImport(pendingScenarioImportType, file);
    }
    event.target.value = "";
    pendingScenarioImportType = null;
  });
}

if (btnExportMarkdown) {
  btnExportMarkdown.addEventListener("click", exportScenariosAsMarkdown);
}

if (btnExportPdf) {
  btnExportPdf.addEventListener("click", () => {
    exportScenariosAsPdf();
  });
}

if (btnExportJson) {
  btnExportJson.addEventListener("click", exportScenariosAsJson);
}

if (btnAmbienteExportMarkdown) {
  btnAmbienteExportMarkdown.addEventListener(
    "click",
    exportAmbienteScenariosAsMarkdown
  );
}

if (btnAmbienteExportPdf) {
  btnAmbienteExportPdf.addEventListener(
    "click",
    exportAmbienteScenariosAsPdf
  );
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
      ? data.scenarios.map((sc) => ({
          ...stripScenarioStage(sc),
          status: "pendente",
        }))
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

  ambienteScenarioCategoryFilterValue = "all";
  if (ambienteScenarioCategoryFilter) {
    ambienteScenarioCategoryFilter.innerHTML =
      '<option value="all">Todas as categorias</option>';
    ambienteScenarioCategoryFilter.value = "all";
    ambienteScenarioCategoryFilter.disabled = true;
  }
  if (ambienteScenarioFilters) {
    ambienteScenarioFilters.classList.add("is-hidden");
  }

  ambienteSelecionado = {
    id,
    ...env,
    scenarios: Array.isArray(env.scenarios)
      ? env.scenarios.map(normalizeAmbienteScenario)
      : [],
  };
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
    const data = snap.data();
    ambienteSelecionado = {
      id: snap.id,
      ...data,
      scenarios: Array.isArray(data.scenarios)
        ? data.scenarios.map(normalizeAmbienteScenario)
        : [],
    };
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

  const scenarios = Array.isArray(env.scenarios) ? env.scenarios : [];
  renderAmbienteScenarioFilters(scenarios);
  renderAmbienteScenarioTable(scenarios);
}

function renderAmbienteScenarioFilters(scenarios) {
  if (!ambienteScenarioCategoryFilter) return;

  const lista = Array.isArray(scenarios) ? scenarios : [];
  const hasScenarios = lista.length > 0;
  const categories = new Map();

  lista.forEach((sc) => {
    const label = toText(sc?.category);
    const key = normalizeCategoryKey(label);
    if (!label || !key) return;
    if (!categories.has(key)) {
      categories.set(key, label);
    }
  });

  ambienteScenarioCategoryFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Todas as categorias";
  ambienteScenarioCategoryFilter.appendChild(allOption);

  categories.forEach((label, key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    ambienteScenarioCategoryFilter.appendChild(option);
  });

  if (
    ambienteScenarioCategoryFilterValue !== "all" &&
    !categories.has(ambienteScenarioCategoryFilterValue)
  ) {
    ambienteScenarioCategoryFilterValue = "all";
  }

  ambienteScenarioCategoryFilter.value = ambienteScenarioCategoryFilterValue;
  ambienteScenarioCategoryFilter.disabled = categories.size === 0;

  if (ambienteScenarioFilters) {
    ambienteScenarioFilters.classList.remove("is-hidden");
  }

  if (btnAmbienteExportMarkdown) {
    btnAmbienteExportMarkdown.disabled = !hasScenarios;
  }
  if (btnAmbienteExportPdf) {
    btnAmbienteExportPdf.disabled = !hasScenarios;
  }
}

function renderAmbienteScenarioTable(scenarios) {
  if (!ambienteScenarioTable) return;

  ambienteScenarioTable.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Categoria</th>
        <th>Automação</th>
        <th>Status</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = ambienteScenarioTable.querySelector("tbody");
  if (!tbody) return;

  const lista = Array.isArray(scenarios) ? scenarios : [];
  if (!lista.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty";
    cell.textContent = "Sem cenários neste ambiente.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const itensFiltrados = getFilteredAmbienteScenarios(lista, true);

  if (!itensFiltrados.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty";
    cell.textContent =
      "Nenhum cenário encontrado para o filtro selecionado.";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  itensFiltrados.forEach(({ scenario: sc, index: idx }) => {
    const row = document.createElement("tr");

    const cellNome = document.createElement("td");
    cellNome.textContent = sc.title || "Cenário";

    const cellCategoria = document.createElement("td");
    cellCategoria.textContent = sc.category || "-";

    const cellAutomacao = document.createElement("td");
    cellAutomacao.textContent = sc.automation || "-";

    const statusAtual = statusLabels[sc.status] ? sc.status : "pendente";
    const cellStatus = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = `status status--${statusAtual}`;

    ["pendente", "andamento", "concluido"].forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = statusLabels[status];
      option.selected = status === statusAtual;
      statusSelect.appendChild(option);
    });

    statusSelect.addEventListener("change", async () => {
      const novoStatus = statusSelect.value;
      statusSelect.className = `status status--${novoStatus}`;
      statusSelect.disabled = true;
      try {
        await updateAmbienteScenario(idx, { status: novoStatus });
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
      } finally {
        statusSelect.disabled = false;
      }
    });

    cellStatus.appendChild(statusSelect);

    const cellObs = document.createElement("td");
    cellObs.textContent = sc.obs || "";

    row.append(
      cellNome,
      cellCategoria,
      cellAutomacao,
      cellStatus,
      cellObs
    );
    tbody.appendChild(row);
  });
}

async function updateAmbienteScenario(index, updates) {
  if (!ambienteSelecionado) return;
  const envId = ambienteSelecionado.id;
  if (!envId) return;

  const lista = Array.isArray(ambienteSelecionado.scenarios)
    ? ambienteSelecionado.scenarios
    : [];
  const atual = lista[index];
  if (!atual || !updates || typeof updates !== "object") return;

  const atualizado = normalizeAmbienteScenario({ ...atual, ...updates });
  const hasChanges = Object.keys(updates).some(
    (key) => atual[key] !== atualizado[key]
  );

  if (!hasChanges) return;

  const proximos = lista.map((item, idx) =>
    idx === index ? atualizado : item
  );

  ambienteSelecionado = { ...ambienteSelecionado, scenarios: proximos };

  await updateDoc(doc(db, "environments", envId), { scenarios: proximos });
}
