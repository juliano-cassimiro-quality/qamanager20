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
let unsubscribeCoverage = null;
let storesCache = [];
let environmentsCache = [];

let lojaSelecionada = null;
let ambienteSelecionado = null;
let confirmHandler = null;
let unsubscribeAmbientes = null;
let unsubscribeAmbiente = null;
let scenarioCategoryFilterValue = "all";
let pendingScenarioImportType = null;
let jsPDFConstructor = null;
const externalScriptPromises = new Map();
let dashboardStoreSnapshot = [];
let dashboardSearchTerm = "";
let dashboardSortMode = "recent";
let dashboardFilterMode = "all";
const DASHBOARD_VIEW_STORAGE_KEY = "qa-dashboard-view-mode";
const VALID_DASHBOARD_VIEWS = new Set(["grid", "list"]);
const storedViewMode = localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
let dashboardViewMode = VALID_DASHBOARD_VIEWS.has(storedViewMode)
  ? storedViewMode
  : "grid";
let dashboardLastSyncedAt = null;

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

const toDateOrNull = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const millis = value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
    return new Date(millis);
  }
  return null;
};

const formatShortDate = (value) => {
  const date = toDateOrNull(value);
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCount = (value) => Number(value || 0).toLocaleString("pt-BR");

const getDashboardViewLabel = (mode = dashboardViewMode) =>
  mode === "list" ? "Lista" : "Cards";

const applyDashboardViewMode = () => {
  if (!dashboardStoresContainer) return;
  dashboardStoresContainer.dataset.view =
    dashboardViewMode === "list" ? "list" : "grid";
};

const updateDashboardQuickView = () => {
  const label = getDashboardViewLabel();
  if (dashboardViewModeLabel) {
    dashboardViewModeLabel.textContent = label;
  }
  if (dashboardQuickView) {
    dashboardQuickView.textContent = label;
  }
};

const updateDashboardViewButtons = () => {
  if (!dashboardViewButtons.length) {
    updateDashboardQuickView();
    return;
  }

  dashboardViewButtons.forEach((button) => {
    const value = button.dataset.dashboardView || "grid";
    const isActive = value === dashboardViewMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  updateDashboardQuickView();
};

const setDashboardViewMode = (mode, { persist = true } = {}) => {
  const normalized = VALID_DASHBOARD_VIEWS.has(mode) ? mode : "grid";
  if (dashboardViewMode === normalized) {
    applyDashboardViewMode();
    updateDashboardViewButtons();
    return;
  }

  dashboardViewMode = normalized;
  if (persist) {
    localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, normalized);
  }

  applyDashboardViewMode();
  updateDashboardViewButtons();
};

const updateDashboardFilterChips = () => {
  if (!dashboardFilterChips.length) return;
  dashboardFilterChips.forEach((chip) => {
    const value = chip.dataset.dashboardFilter || "all";
    const isActive = value === dashboardFilterMode;
    chip.classList.toggle("is-active", isActive);
    chip.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
};

const updateDashboardFilterChipCounts = () => {
  if (!dashboardFilterCountElements.length) return;

  const counts = {
    all: dashboardStoreSnapshot.length,
    "with-execution": dashboardStoreSnapshot.filter((entry) => entry?.hasEnvironment).length,
    "without-execution": dashboardStoreSnapshot.filter((entry) => !entry?.hasEnvironment).length,
  };

  dashboardFilterCountElements.forEach((element) => {
    const key = element.getAttribute("data-dashboard-filter-count");
    const value = counts[key] ?? 0;
    element.textContent = formatCount(value);
  });
};

const formatLastSynced = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 30_000) {
    return "Agora mesmo";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    const plural = diffMinutes === 1 ? "minuto" : "minutos";
    return `Há ${diffMinutes} ${plural}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    const plural = diffHours === 1 ? "hora" : "horas";
    return `Há ${diffHours} ${plural}`;
  }

  const dateLabel = date.toLocaleDateString("pt-BR");
  const timeLabel = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel} às ${timeLabel}`;
};

const updateDashboardLastSyncedLabel = () => {
  if (!dashboardLastSyncedLabel) return;
  dashboardLastSyncedLabel.textContent = formatLastSynced(dashboardLastSyncedAt);
};

const markDashboardSynced = (date = new Date()) => {
  dashboardLastSyncedAt = date;
  updateDashboardLastSyncedLabel();
};

const getTimeValue = (date) => (date instanceof Date ? date.getTime() : 0);

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

const authShell = el("authShell");
const appShell = el("appShell");
const userActions = el("userActions");
const userDisplayName = el("userDisplayName");
const btnOpenProfile = el("btnOpenProfile");
const btnSignOut = el("btnSignOut");
const btnProfileBack = el("btnProfileBack");
const dashboardStoresContainer = el("dashboardStores");
const dashboardCoverageList = el("dashboardCoverageList");
const dashboardCoverageSummary = el("dashboardCoverageSummary");
const dashboardStatStores = el("dashboardStatStores");
const dashboardStatActive = el("dashboardStatActive");
const dashboardStatScenarios = el("dashboardStatScenarios");
const dashboardStatCoverage = el("dashboardStatCoverage");
const dashboardStatEnvironments = el("dashboardStatEnvironments");
const dashboardStatIdle = el("dashboardStatIdle");
const dashboardQuickIdle = el("dashboardQuickIdle");
const dashboardQuickView = el("dashboardQuickView");
const dashboardViewModeLabel = el("dashboardViewModeLabel");
const dashboardLastSyncedLabel = el("dashboardLastSynced");
const btnDashboardRefresh = el("btnDashboardRefresh");
const dashboardViewButtons = Array.from(
  document.querySelectorAll("[data-dashboard-view]")
);
const dashboardFilterChips = Array.from(
  document.querySelectorAll("[data-dashboard-filter]")
);
const dashboardFilterCountElements = Array.from(
  document.querySelectorAll("[data-dashboard-filter-count]")
);
const dashboardSearchInput = el("dashboardSearch");
const dashboardSortSelect = el("dashboardSort");
const dashboardFilterSelect = el("dashboardFilter");
const btnDashboardResetFilters = el("btnDashboardResetFilters");
const btnDashboardNewStore = el("btnDashboardNewStore");
const btnDashboardOpenProfile = el("btnDashboardOpenProfile");
let btnDashboardToggleTheme = el("btnDashboardToggleTheme");
const btnNovaLoja = el("btnNovaLoja");

const updateThemeToggleButtonLabel = (theme = currentTheme) => {
  if (!btnDashboardToggleTheme) return;
  btnDashboardToggleTheme.textContent =
    theme === "dark" ? "Usar modo claro" : "Usar modo escuro";
};

document.addEventListener("qa-theme-change", (event) => {
  updateThemeToggleButtonLabel(event.detail?.theme || currentTheme);
});

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
  document.dispatchEvent(
    new CustomEvent("qa-theme-change", { detail: { theme: normalized } })
  );
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
    if (unsubscribeCoverage) {
      unsubscribeCoverage();
      unsubscribeCoverage = null;
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
const scenarioCluster = el("scenarioCluster");
const scenarioObs = el("scenarioObs");
const scenarioCategoryFilter = el("scenarioCategoryFilter");
const btnImportCsv = el("btnImportCsv");
const btnImportJson = el("btnImportJson");
const btnExportMarkdown = el("btnExportMarkdown");
const btnExportPdf = el("btnExportPdf");
const scenarioImportInput = el("scenarioImportInput");

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


const computeDashboardEntry = (store) => {
  if (!store) return null;

  const scenarioCount = Array.isArray(store.scenarios)
    ? store.scenarios.length
    : typeof store.scenarioCount === "number"
    ? store.scenarioCount
    : 0;

  const normalizedSite = normalizeUrl(store.site || "");
  const siteLabel = normalizedSite ? formatUrlLabel(normalizedSite) : "";
  const descriptionText = toText(store.description);

  const relatedEnvironments = environmentsCache.filter(
    (env) => env.storeId === store.id
  );

  let latestEnv = null;
  let latestEnvValue = 0;

  relatedEnvironments.forEach((env) => {
    const envDate = toDateOrNull(env.updatedAt || env.createdAt);
    const envValue = getTimeValue(envDate);
    if (envValue > latestEnvValue) {
      latestEnvValue = envValue;
      latestEnv = env;
    }
  });

  let total = scenarioCount;
  let done = 0;
  let running = 0;
  let pending = scenarioCount;
  let coverage = 0;

  if (latestEnv && Array.isArray(latestEnv.scenarios)) {
    const envScenarios = latestEnv.scenarios;
    total = envScenarios.length;
    envScenarios.forEach((scenario) => {
      const status = toText(scenario.status).toLowerCase();
      if (status === "concluido") {
        done += 1;
      } else if (status === "andamento") {
        running += 1;
      }
    });
    pending = Math.max(total - done - running, 0);
    coverage = total ? Math.round((done / total) * 100) : 0;
  } else {
    pending = scenarioCount;
    total = scenarioCount;
    coverage = total ? Math.round((done / total) * 100) : 0;
  }

  const environmentLabel = latestEnv
    ? [latestEnv.kind, latestEnv.identifier || latestEnv.testType]
        .filter(Boolean)
        .join(" • ")
    : "";

  const lastRun = latestEnvValue ? new Date(latestEnvValue) : null;
  const storeUpdated = toDateOrNull(store.updatedAt);
  const storeCreated = toDateOrNull(store.createdAt);
  const lastActivityValue = Math.max(
    latestEnvValue,
    getTimeValue(storeUpdated),
    getTimeValue(storeCreated)
  );
  const lastActivity = lastActivityValue ? new Date(lastActivityValue) : null;

  const searchIndex = removeDiacritics(
    `${store.name || ""} ${descriptionText} ${siteLabel}`
  )
    .toLowerCase()
    .trim();

  return {
    id: store.id,
    name: store.name || "Loja",
    description: descriptionText,
    scenarioCount,
    environmentCount: relatedEnvironments.length,
    coverage,
    total,
    done,
    running,
    pending: Math.max(pending, 0),
    environmentLabel,
    lastRun,
    hasEnvironment: relatedEnvironments.length > 0,
    lastActivity,
    lastActivityValue,
    storeCreatedAt: storeCreated,
    storeUpdatedAt: storeUpdated,
    searchIndex,
    siteNormalized: normalizedSite,
    siteLabel,
    hasCoverageData: Boolean(latestEnv && total > 0),
    scenariosDefined: scenarioCount > 0,
    source: store,
  };
};

const updateDashboardSnapshot = () => {
  dashboardStoreSnapshot = storesCache
    .map((store) => computeDashboardEntry(store))
    .filter(Boolean);
};

const calculateAverageCoverage = (entries) => {
  let sum = 0;
  let count = 0;
  entries.forEach((entry) => {
    if (entry?.hasCoverageData) {
      sum += entry.coverage;
      count += 1;
    }
  });
  return {
    value: count > 0 ? Math.round(sum / count) : 0,
    hasData: count > 0,
  };
};

const getFilteredDashboardStores = () => {
  let entries = dashboardStoreSnapshot.slice().filter(Boolean);
  const normalizedTerm = removeDiacritics(dashboardSearchTerm || "")
    .toLowerCase()
    .trim();

  if (normalizedTerm) {
    entries = entries.filter((entry) => entry.searchIndex.includes(normalizedTerm));
  }

  if (dashboardFilterMode === "with-execution") {
    entries = entries.filter((entry) => entry.hasEnvironment);
  } else if (dashboardFilterMode === "without-execution") {
    entries = entries.filter((entry) => !entry.hasEnvironment);
  }

  entries.sort((a, b) => {
    switch (dashboardSortMode) {
      case "name":
        return a.name.localeCompare(b.name, "pt-BR");
      case "coverage":
        if (b.coverage !== a.coverage) return b.coverage - a.coverage;
        if (b.scenarioCount !== a.scenarioCount) {
          return b.scenarioCount - a.scenarioCount;
        }
        return a.name.localeCompare(b.name, "pt-BR");
      case "scenarios":
        if (b.scenarioCount !== a.scenarioCount) {
          return b.scenarioCount - a.scenarioCount;
        }
        return a.name.localeCompare(b.name, "pt-BR");
      case "recent":
      default: {
        if ((b.lastActivityValue || 0) !== (a.lastActivityValue || 0)) {
          return (b.lastActivityValue || 0) - (a.lastActivityValue || 0);
        }
        return a.name.localeCompare(b.name, "pt-BR");
      }
    }
  });

  return entries;
};

function updateDashboardStats() {
  if (dashboardStatStores) {
    dashboardStatStores.textContent = formatCount(dashboardStoreSnapshot.length);
  }

  const withExecutions = dashboardStoreSnapshot.filter(
    (entry) => entry?.hasEnvironment
  ).length;

  if (dashboardStatActive) {
    dashboardStatActive.textContent = formatCount(withExecutions);
  }

  if (dashboardStatScenarios) {
    const totalScenarios = dashboardStoreSnapshot.reduce(
      (sum, entry) => sum + (entry?.scenarioCount || 0),
      0
    );
    dashboardStatScenarios.textContent = formatCount(totalScenarios);
  }

  if (dashboardStatEnvironments) {
    const totalEnvironments = dashboardStoreSnapshot.reduce(
      (sum, entry) => sum + (entry?.environmentCount || 0),
      0
    );
    dashboardStatEnvironments.textContent = formatCount(totalEnvironments);
  }

  const awaitingAttention = dashboardStoreSnapshot.filter(
    (entry) => !entry?.hasEnvironment || !entry?.hasCoverageData
  ).length;

  if (dashboardStatIdle) {
    dashboardStatIdle.textContent = formatCount(awaitingAttention);
  }

  if (dashboardQuickIdle) {
    dashboardQuickIdle.textContent = formatCount(awaitingAttention);
  }

  if (dashboardStatCoverage) {
    const average = calculateAverageCoverage(dashboardStoreSnapshot);
    dashboardStatCoverage.textContent = average.hasData
      ? `${average.value}%`
      : "—";
  }
}

function renderDashboardStores() {
  if (!dashboardStoresContainer) return;

  applyDashboardViewMode();
  dashboardStoresContainer.innerHTML = "";

  const entries = getFilteredDashboardStores();
  const hasFiltersActive =
    Boolean(dashboardSearchTerm && dashboardSearchTerm.trim()) ||
    dashboardFilterMode !== "all" ||
    dashboardSortMode !== "recent";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("h3");
    title.textContent = hasFiltersActive
      ? "Nenhuma loja encontrada"
      : "Nenhuma loja cadastrada";

    const text = document.createElement("p");
    text.className = "muted";
    text.textContent = hasFiltersActive
      ? "Ajuste os filtros ou limpe a busca para visualizar todas as lojas."
      : "Clique em "+ Nova Loja" para iniciar sua organização.";

    empty.append(title, text);

    if (hasFiltersActive) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "ghost";
      action.textContent = "Limpar filtros";
      action.addEventListener("click", () => {
        resetDashboardFilters(true);
      });
      empty.appendChild(action);
    }

    dashboardStoresContainer.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "store-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.dataset.storeId = entry.id;

    const header = document.createElement("div");
    header.className = "store-card__header";

    const title = document.createElement("strong");
    title.className = "store-card__title";
    title.textContent = entry.name;
    header.appendChild(title);

    const coverageBadge = document.createElement("span");
    coverageBadge.className = `badge store-card__coverage${
      entry.hasCoverageData ? "" : " is-idle"
    }`;
    coverageBadge.textContent = entry.hasCoverageData
      ? `${entry.coverage}% cobertura`
      : entry.scenariosDefined
      ? "Aguardando execução"
      : "Nova loja";
    header.appendChild(coverageBadge);

    card.appendChild(header);

    const scenarioTag = document.createElement("span");
    scenarioTag.className = "tag";
    scenarioTag.textContent = `${formatCount(entry.scenarioCount)} ${
      entry.scenarioCount === 1 ? "cenário" : "cenários"
    }`;
    card.appendChild(scenarioTag);

    if (entry.siteNormalized) {
      const siteLink = document.createElement("a");
      siteLink.className = "link store-card__site";
      siteLink.href = entry.siteNormalized;
      siteLink.target = "_blank";
      siteLink.rel = "noopener";
      siteLink.textContent = entry.siteLabel;
      siteLink.addEventListener("click", (event) => event.stopPropagation());
      card.appendChild(siteLink);
    } else {
      const site = document.createElement("span");
      site.className = "muted store-card__site";
      site.textContent = "Nenhum site cadastrado";
      card.appendChild(site);
    }

    if (entry.description) {
      const desc = document.createElement("p");
      desc.className = "scenario-note";
      desc.textContent = entry.description;
      card.appendChild(desc);
    }

    const metrics = document.createElement("div");
    metrics.className = "store-card__metrics";

    const addMetric = (value, label) => {
      const pill = document.createElement("span");
      pill.className = "metric-pill";
      const strong = document.createElement("strong");
      strong.textContent = value;
      const meta = document.createElement("span");
      meta.textContent = label;
      pill.append(strong, meta);
      return pill;
    };

    metrics.appendChild(
      addMetric(entry.hasCoverageData ? `${entry.coverage}%` : "—", "Cobertura")
    );
    metrics.appendChild(
      addMetric(
        formatCount(entry.scenarioCount),
        entry.scenarioCount === 1 ? "Cenário" : "Cenários"
      )
    );
    metrics.appendChild(
      addMetric(
        formatCount(entry.environmentCount),
        entry.environmentCount === 1 ? "Ambiente" : "Ambientes"
      )
    );
    card.appendChild(metrics);

    if (entry.environmentLabel) {
      const env = document.createElement("span");
      env.className = "store-card__environment";
      env.textContent = entry.environmentLabel;
      card.appendChild(env);
    }

    const footer = document.createElement("div");
    footer.className = "store-card__footer";

    const activity = document.createElement("span");
    activity.className = "store-card__activity";
    if (entry.lastRun) {
      activity.textContent = `Última execução: ${formatShortDate(entry.lastRun)}`;
    } else if (entry.hasEnvironment) {
      activity.textContent = "Execuções sem dados registrados";
    } else if (entry.scenariosDefined) {
      activity.textContent = "Aguardando criação de ambiente";
    } else {
      activity.textContent = "Cadastre cenários para começar";
    }
    footer.appendChild(activity);

    const hint = document.createElement("span");
    hint.className = "store-card__action";
    hint.textContent = "Ver detalhes";
    footer.appendChild(hint);

    card.appendChild(footer);

    card.addEventListener("click", () => abrirLoja(entry.id, entry.source));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        abrirLoja(entry.id, entry.source);
      }
    });

    dashboardStoresContainer.appendChild(card);
  });
}

function updateTestCoverageCard() {
  if (!dashboardCoverageList) return;

  dashboardCoverageList.innerHTML = "";

  if (!dashboardStoreSnapshot.length) {
    const empty = document.createElement("div");
    empty.className = "coverage-empty";
    empty.textContent = "Cadastre uma loja para acompanhar a cobertura.";
    dashboardCoverageList.appendChild(empty);
    if (dashboardCoverageSummary) {
      dashboardCoverageSummary.textContent = "Média geral: —";
    }
    return;
  }

  const coverageEntries = dashboardStoreSnapshot
    .slice()
    .filter(Boolean)
    .sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  coverageEntries.forEach((item) => {
    const row = document.createElement("div");
    row.className = "coverage-row";

    const header = document.createElement("div");
    header.className = "coverage-row__header";

    const name = document.createElement("strong");
    name.className = "coverage-row__name";
    name.textContent = item.name;

    const value = document.createElement("span");
    value.className = "coverage-row__value";
    if (item.hasCoverageData) {
      value.textContent = `${item.coverage}%`;
    } else {
      value.textContent = "—";
      value.classList.add("is-idle");
    }

    header.append(name, value);
    row.appendChild(header);

    const progress = document.createElement("div");
    progress.className = "coverage-progress";

    if (item.hasCoverageData && item.total > 0) {
      const appendBar = (percent, className) => {
        const normalized = Math.max(0, Math.min(100, percent));
        if (normalized <= 0) return;
        const bar = document.createElement("span");
        bar.className = `coverage-progress__bar ${className}`;
        bar.style.width = `${normalized}%`;
        progress.appendChild(bar);
      };

      const donePercent = (item.done / item.total) * 100;
      const runningPercent = (item.running / item.total) * 100;
      const pendingPercent = Math.max(100 - donePercent - runningPercent, 0);

      appendBar(donePercent, "is-done");
      appendBar(runningPercent, "is-running");
      appendBar(pendingPercent, "is-pending");
    }

    row.appendChild(progress);

    const meta = document.createElement("div");
    meta.className = "coverage-row__meta";

    if (item.environmentLabel) {
      const env = document.createElement("span");
      env.className = "coverage-row__env";
      env.textContent = item.environmentLabel;
      meta.appendChild(env);
    }

    if (item.hasCoverageData && item.total > 0) {
      const makeStatus = (label, value, statusClass) => {
        const status = document.createElement("span");
        status.className = "coverage-row__status";
        const dot = document.createElement("span");
        dot.className = `coverage-row__dot ${statusClass}`;
        status.append(dot, document.createTextNode(`${label}: ${value}`));
        return status;
      };

      meta.appendChild(
        makeStatus("Concluídos", formatCount(item.done), "is-done")
      );
      meta.appendChild(
        makeStatus("Em andamento", formatCount(item.running), "is-running")
      );
      meta.appendChild(
        makeStatus("Pendentes", formatCount(item.pending), "is-pending")
      );

      const lastRunLabel = formatShortDate(item.lastRun);
      const note = document.createElement("span");
      note.className = "coverage-row__note";
      note.textContent = lastRunLabel
        ? `Última execução: ${lastRunLabel}`
        : "Dados de execução indisponíveis";
      meta.appendChild(note);
    } else if (item.hasEnvironment) {
      const note = document.createElement("span");
      note.className = "coverage-row__note";
      note.textContent = "Execuções sem dados registrados";
      meta.appendChild(note);
    } else if (item.scenariosDefined) {
      const note = document.createElement("span");
      note.className = "coverage-row__note";
      note.textContent = "Cadastre um ambiente para iniciar as execuções";
      meta.appendChild(note);
    } else {
      const note = document.createElement("span");
      note.className = "coverage-row__note";
      note.textContent = "Nenhum cenário cadastrado";
      meta.appendChild(note);
    }

    row.appendChild(meta);
    dashboardCoverageList.appendChild(row);
  });

  const average = calculateAverageCoverage(dashboardStoreSnapshot);
  if (dashboardCoverageSummary) {
    dashboardCoverageSummary.textContent = average.hasData
      ? `Média geral: ${average.value}%`
      : "Média geral: —";
  }
}

const refreshDashboardView = () => {
  updateDashboardSnapshot();
  updateDashboardStats();
  updateDashboardFilterChipCounts();
  renderDashboardStores();
  updateTestCoverageCard();
  updateDashboardFilterChips();
  updateDashboardViewButtons();
};

function resetDashboardFilters(focusSearch = false) {
  dashboardSearchTerm = "";
  dashboardSortMode = "recent";
  dashboardFilterMode = "all";
  if (dashboardSearchInput) {
    dashboardSearchInput.value = "";
    if (focusSearch) {
      dashboardSearchInput.focus();
    }
  }
  if (dashboardSortSelect) {
    dashboardSortSelect.value = "recent";
  }
  if (dashboardFilterSelect) {
    dashboardFilterSelect.value = "all";
  }
  updateDashboardFilterChips();
  renderDashboardStores();
}

if (dashboardSearchInput) {
  dashboardSearchInput.value = dashboardSearchTerm;
  dashboardSearchInput.addEventListener("input", (event) => {
    dashboardSearchTerm = event.target.value || "";
    renderDashboardStores();
  });
}

if (dashboardSortSelect) {
  dashboardSortSelect.value = dashboardSortMode;
  dashboardSortSelect.addEventListener("change", (event) => {
    dashboardSortMode = event.target.value || "recent";
    renderDashboardStores();
  });
}

if (dashboardFilterSelect) {
  dashboardFilterSelect.value = dashboardFilterMode;
  dashboardFilterSelect.addEventListener("change", (event) => {
    dashboardFilterMode = event.target.value || "all";
    updateDashboardFilterChips();
    renderDashboardStores();
  });
}

if (dashboardViewButtons.length) {
  dashboardViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.dashboardView || "grid";
      setDashboardViewMode(value);
    });
  });
}

if (dashboardFilterChips.length) {
  dashboardFilterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.dataset.dashboardFilter || "all";
      dashboardFilterMode = value;
      if (dashboardFilterSelect) {
        dashboardFilterSelect.value = value;
      }
      updateDashboardFilterChips();
      renderDashboardStores();
    });
  });
}

if (btnDashboardRefresh) {
  btnDashboardRefresh.addEventListener("click", () => {
    if (btnDashboardRefresh.disabled) return;
    const original = btnDashboardRefresh.textContent;
    btnDashboardRefresh.textContent = "Atualizando...";
    btnDashboardRefresh.disabled = true;
    try {
      markDashboardSynced(new Date());
      refreshDashboardView();
    } finally {
      setTimeout(() => {
        btnDashboardRefresh.textContent = original;
        btnDashboardRefresh.disabled = false;
      }, 320);
    }
  });
}

if (btnDashboardResetFilters) {
  btnDashboardResetFilters.addEventListener("click", () => {
    resetDashboardFilters(true);
  });
}

applyDashboardViewMode();
updateDashboardViewButtons();
updateDashboardFilterChips();
updateDashboardFilterChipCounts();
updateDashboardLastSyncedLabel();
setInterval(updateDashboardLastSyncedLabel, 60_000);

if (btnDashboardNewStore) {
  btnDashboardNewStore.addEventListener("click", () => {
    if (btnNovaLoja) {
      btnNovaLoja.click();
    }
  });
}

if (btnDashboardOpenProfile) {
  btnDashboardOpenProfile.addEventListener("click", () => {
    if (btnOpenProfile) {
      btnOpenProfile.click();
    }
  });
}

if (btnDashboardToggleTheme) {
  btnDashboardToggleTheme.addEventListener("click", () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    updateThemeToggleButtonLabel(nextTheme);
  });
  updateThemeToggleButtonLabel(currentTheme);
}


function clearDashboard() {
  storesCache = [];
  environmentsCache = [];
  dashboardStoreSnapshot = [];
  dashboardSearchTerm = "";
  dashboardSortMode = "recent";
  dashboardFilterMode = "all";
  dashboardLastSyncedAt = null;
  if (dashboardSearchInput) {
    dashboardSearchInput.value = "";
  }
  if (dashboardSortSelect) {
    dashboardSortSelect.value = "recent";
  }
  if (dashboardFilterSelect) {
    dashboardFilterSelect.value = "all";
  }
  updateDashboardFilterChipCounts();
  updateDashboardFilterChips();
  updateDashboardLastSyncedLabel();
  updateDashboardViewButtons();
  updateDashboardStats();
  renderDashboardStores();
  updateTestCoverageCard();
}

const subscribeCoverageEnvironments = () => {
  if (unsubscribeCoverage) return;
  unsubscribeCoverage = onSnapshot(
    query(collection(db, "environments"), orderBy("createdAt", "desc")),
    (snapshot) => {
      environmentsCache = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() || {}),
      }));
      markDashboardSynced();
      refreshDashboardView();
    }
  );
};

const subscribeDashboard = () => {
  if (unsubscribeDashboard) return;
  subscribeCoverageEnvironments();
  unsubscribeDashboard = onSnapshot(
    query(collection(db, "stores"), orderBy("createdAt", "desc")),
    (snapshot) => {
      storesCache = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() || {}),
      }));
      markDashboardSynced();
      refreshDashboardView();
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

if (btnNovaLoja) {
  btnNovaLoja.addEventListener("click", () => {
    storeForm.reset();
    storeForm.dataset.mode = "create";
    storeFormTitle.textContent = "Nova loja";
    storeFormSubmit.textContent = "Criar loja";
    abrirModal("modalStore");
  });
}

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
        <th>Cluster</th>
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
    cell.colSpan = 6;
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

    row.append(
      cellTitulo,
      cellCategoria,
      cellAuto,
      cellCluster,
      cellObs,
      cellActions
    );
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
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    console.error("Arquivo JSON inválido:", error);
    return [];
  }

  const maxDepth = 6;
  const findScenarioArray = (input, depth = 0) => {
    if (!input || depth > maxDepth) return null;

    if (Array.isArray(input)) {
      const onlyObjects = input.filter((item) => item && typeof item === "object");
      if (onlyObjects.length && onlyObjects.length === input.length) {
        return onlyObjects;
      }
      return null;
    }

    if (typeof input !== "object") return null;

    const preferredKeys = ["scenarios", "cenarios", "data", "items", "lista", "results"];
    for (const key of preferredKeys) {
      if (input[key] !== undefined) {
        const found = findScenarioArray(input[key], depth + 1);
        if (found) return found;
      }
    }

    for (const value of Object.values(input)) {
      const found = findScenarioArray(value, depth + 1);
      if (found) return found;
    }

    return null;
  };

  const found = findScenarioArray(parsed);
  return Array.isArray(found) ? found : [];
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

  const cluster = toText(
    normalized.cluster ||
      normalized.plataforma ||
      normalized.platform
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
    cluster,
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

const getGlobalJsPdfConstructor = () => {
  const candidates = [
    globalThis.jspdf?.jsPDF,
    globalThis.jspdf?.default?.jsPDF,
    globalThis.jsPDF?.jsPDF,
    globalThis.jsPDF,
  ];
  return candidates.find((candidate) => typeof candidate === "function") || null;
};

const loadExternalScript = (source) => {
  if (externalScriptPromises.has(source)) {
    return externalScriptPromises.get(source);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${source}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener(
        "load",
        () => {
          existing.dataset.loaded = "true";
          resolve();
        },
        { once: true }
      );
      existing.addEventListener(
        "error",
        () => reject(new Error(`Falha ao carregar script ${source}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = source;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error(`Falha ao carregar script ${source}`));
      },
      { once: true }
    );
    document.head.appendChild(script);
  });

  externalScriptPromises.set(source, promise);
  promise.catch(() => externalScriptPromises.delete(source));
  return promise;
};

async function loadJsPDF() {
  if (jsPDFConstructor) return jsPDFConstructor;

  const globalCandidate = getGlobalJsPdfConstructor();
  if (globalCandidate) {
    jsPDFConstructor = globalCandidate;
    return jsPDFConstructor;
  }

  const moduleSources = [
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  ];

  let lastError = null;

  for (const source of moduleSources) {
    try {
      const module = await import(source);
      const candidate =
        module.jsPDF ||
        (module.default && module.default.jsPDF) ||
        module.default;
      if (typeof candidate === "function") {
        jsPDFConstructor = candidate;
        return jsPDFConstructor;
      }
    } catch (error) {
      lastError = error;
      console.warn(`Falha ao carregar jsPDF de ${source}:`, error);
    }
  }

  const scriptSources = [
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  ];

  for (const source of scriptSources) {
    try {
      await loadExternalScript(source);
      const candidate = getGlobalJsPdfConstructor();
      if (candidate) {
        jsPDFConstructor = candidate;
        return jsPDFConstructor;
      }
    } catch (error) {
      lastError = error;
      console.warn(`Falha ao carregar jsPDF via script de ${source}:`, error);
    }
  }

  if (!jsPDFConstructor) {
    throw lastError || new Error("jsPDF não carregado");
  }

  return jsPDFConstructor;
}

function exportScenariosAsMarkdown() {
  if (!lojaSelecionada) {
    alert("Abra uma loja para exportar os cenários.");
    return;
  }

  const scenarios = getFilteredScenarios(lojaSelecionada.scenarios || []);
  if (!scenarios.length) {
    alert("Não há cenários disponíveis para exportação com o filtro atual.");
    return;
  }

  const lines = [
    `# Cenários - ${lojaSelecionada.name || "Loja"}`,
    "",
    "| Título | Categoria | Automação | Cluster | Observações |",
    "| --- | --- | --- | --- | --- |",
    ...scenarios.map(
      (sc) =>
        `| ${escapeMarkdownCell(sc.title || "-")} | ${escapeMarkdownCell(
          sc.category || "-"
        )} | ${escapeMarkdownCell(sc.automation || "-")} | ${escapeMarkdownCell(
          sc.cluster || "-"
        )} | ${escapeMarkdownCell(
          sc.obs || ""
        )} |`
    ),
  ];

  downloadFile(
    lines.join("\n"),
    `cenarios-${slugify(lojaSelecionada.name || "loja")}.md`,
    "text/markdown;charset=utf-8"
  );
}

async function exportScenariosAsPdf() {
  if (!lojaSelecionada) {
    alert("Abra uma loja para exportar os cenários.");
    return;
  }

  const scenarios = getFilteredScenarios(lojaSelecionada.scenarios || []);
  if (!scenarios.length) {
    alert("Não há cenários disponíveis para exportação com o filtro atual.");
    return;
  }

  try {
    const JsPDF = await loadJsPDF();
    const pdf = new JsPDF();
    pdf.setFontSize(16);
    pdf.text(`Cenários - ${lojaSelecionada.name || "Loja"}`, 14, 20);
    pdf.setFontSize(12);

    let y = 30;
    const lineHeight = 6;
    const maxY = 280;

    const ensureSpace = (lines = 1) => {
      if (y + lineHeight * lines > maxY) {
        pdf.addPage();
        y = 20;
      }
    };

    scenarios.forEach((sc, index) => {
      const entries = [
        `${index + 1}. ${toText(sc.title) || "Cenário"}`,
        `Categoria: ${sc.category || "-"}`,
        `Automação: ${sc.automation || "-"}`,
        `Cluster: ${sc.cluster || "-"}`,
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

    pdf.save(`cenarios-${slugify(lojaSelecionada.name || "loja")}.pdf`);
  } catch (error) {
    console.error("Erro ao exportar cenários em PDF:", error);
    alert("Não foi possível exportar os cenários em PDF. Tente novamente.");
  }
}

if (scenarioCategoryFilter) {
  scenarioCategoryFilter.addEventListener("change", () => {
    scenarioCategoryFilterValue = scenarioCategoryFilter.value || "all";
    updateScenarioTable();
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
  btnExportPdf.addEventListener("click", async () => {
    if (btnExportPdf.disabled) return;
    const originalText = btnExportPdf.textContent;
    btnExportPdf.textContent = "Exportando...";
    btnExportPdf.disabled = true;
    try {
      await exportScenariosAsPdf();
    } finally {
      btnExportPdf.disabled = false;
      btnExportPdf.textContent = originalText;
    }
  });
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

  ambienteSelecionado = {
    id,
    ...env,
    scenarios: Array.isArray(env.scenarios)
      ? env.scenarios.map(stripScenarioStage)
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
        ? data.scenarios.map(stripScenarioStage)
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
    const details = [sc.category, sc.cluster, sc.automation]
      .filter(Boolean)
      .join(" • ");
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
