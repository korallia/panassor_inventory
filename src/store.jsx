// État de l'application. Sans serveur : données d'exemple en mémoire, les
// boutons + / − servent à tester les calculs. Avec les vraies données : le
// stock se change par le panneau « Ajuster » (appel à l'API, voir stock.js).
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";

import * as sample from "./data/sampleData.js";
import { computeInventory, withLeatherMinimums } from "./lib/inventory.js";

const clampStock = (value) => Math.max(0, Math.round(Number(value) || 0));

const initialState = {
  collections: sample.collections,
  products: sample.products,
  kits: sample.kits,
  objectives: sample.objectives,
  reports: sample.reports,
  // Canal d'alerte par produit (Discord par défaut).
  alertChannels: {},
  // Fiches du catalogue (mêmes champs que la table products + product_images du site).
  catalog: buildCatalog(),
  // "exemple" = données d'exemple ; "live" = vraies données lues par le serveur local (lecture seule).
  source: "exemple",
  environment: null,
  loadedAt: null,
};

function blankEntry(id, collectionId, nameFr, extra = {}) {
  return {
    id,
    collectionId,
    nameFr,
    nameEn: "",
    titleFr: "",
    titleEn: "",
    descriptionFr: "",
    descriptionEn: "",
    longDescriptionFr: "",
    longDescriptionEn: "",
    price: "",
    images: [],
    ...extra,
  };
}

function buildCatalog() {
  return [
    ...sample.kits.map((kit) => blankEntry(kit.id, kit.collectionId, kit.name, { isKit: true })),
    ...sample.products.map((p) => blankEntry(p.id, p.collectionId, p.name, { type: p.type })),
  ];
}

function reducer(state, action) {
  switch (action.type) {
    case "setStock":
      return {
        ...state,
        products: state.products.map((product) =>
          product.id === action.productId ? { ...product, stock: clampStock(action.value) } : product
        ),
      };
    case "setPackStock":
      return {
        ...state,
        products: state.products.map((product) =>
          product.id === action.productId
            ? {
                ...product,
                packTypes: product.packTypes.map((type) =>
                  type.id === action.typeId ? { ...type, stock: clampStock(action.value) } : type
                ),
              }
            : product
        ),
      };
    case "setMin":
      return {
        ...state,
        products: state.products.map((product) =>
          product.id === action.productId ? { ...product, min: clampStock(action.value) } : product
        ),
      };
    case "setObjective":
      return {
        ...state,
        products: state.products.map((product) =>
          product.id === action.productId ? { ...product, objective: clampStock(action.value) } : product
        ),
      };
    case "setLeather":
      return {
        ...state,
        kits: state.kits.map((kit) =>
          kit.id === action.kitId
            ? {
                ...kit,
                leather: kit.leather.map((leather) =>
                  leather.color === action.color ? { ...leather, stock: clampStock(action.value) } : leather
                ),
              }
            : kit
        ),
      };
    case "setLeatherMin":
      return {
        ...state,
        kits: state.kits.map((kit) =>
          kit.id === action.kitId
            ? {
                ...kit,
                leather: kit.leather.map((leather) =>
                  leather.color === action.color ? { ...leather, min: clampStock(action.value) } : leather
                ),
              }
            : kit
        ),
      };
    case "setKitMin":
      return {
        ...state,
        // Les étuis suivent : minimum de kits partagé entre les couleurs (voir withLeatherMinimums).
        kits: state.kits.map((kit) => (kit.id === action.kitId ? withLeatherMinimums({ ...kit, min: clampStock(action.value) }) : kit)),
      };
    case "addObjective":
      return { ...state, objectives: [action.objective, ...state.objectives] };
    case "updateObjective":
      return {
        ...state,
        objectives: state.objectives.map((objective) =>
          objective.id === action.id ? { ...objective, ...action.patch } : objective
        ),
      };
    case "removeObjective":
      return { ...state, objectives: state.objectives.filter((objective) => objective.id !== action.id) };
    case "toggleReport":
      return {
        ...state,
        reports: state.reports.map((report) =>
          report.id === action.id ? { ...report, active: !report.active } : report
        ),
      };
    case "updateReport":
      return {
        ...state,
        reports: state.reports.map((report) => (report.id === action.id ? { ...report, ...action.patch } : report)),
      };
    case "removeReport":
      return { ...state, reports: state.reports.filter((report) => report.id !== action.id) };
    case "addReport":
      return { ...state, reports: [...state.reports, action.report] };
    case "setAlertChannel":
      return { ...state, alertChannels: { ...state.alertChannels, [action.productId]: action.value } };
    case "updateCatalog":
      return {
        ...state,
        catalog: state.catalog.map((entry) => (entry.id === action.id ? { ...entry, ...action.patch } : entry)),
      };
    case "addCatalog":
      return { ...state, catalog: [action.entry, ...state.catalog] };
    case "removeCatalog":
      return { ...state, catalog: state.catalog.filter((entry) => entry.id !== action.id) };
    case "addProduct":
      return { ...state, products: [...state.products, action.product] };
    case "reset":
      return state.source === "live" ? state : initialState;
    case "loadLive":
      return {
        ...state,
        collections: action.data.collections,
        products: action.data.products,
        kits: action.data.kits,
        catalog: action.data.catalog,
        objectives: [],
        source: "live",
        loadedAt: action.data.loadedAt,
        user: action.data.user || null,
      };
    default:
      return state;
  }
}

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // "chargement" → "connexion" (mot de passe requis) → "pret". Sans serveur local : données d'exemple.
  const [status, setStatus] = useState("chargement");
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/data", { credentials: "same-origin" });
      if (response.status === 401) return setStatus("connexion");
      if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) return setStatus("pret");
      const body = await response.json();
      if (!response.ok) {
        setError(body.detail || body.error || "Lecture impossible");
        return setStatus("pret");
      }
      dispatch({ type: "loadLive", data: body });
      setStatus("pret");
    } catch {
      setStatus("pret"); // serveur local absent : on reste sur les données d'exemple
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Connexion en deux temps : le courriel reçoit un code, puis on le vérifie.
  const requestCode = useCallback(async (email, password) => {
    const response = await fetch("/api/login/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: body.error || "Envoi impossible." };
    // Appareil reconnu : la session est déjà ouverte, pas de code.
    if (body.trusted) {
      setStatus("chargement");
      await reload();
    }
    return { ok: true, trusted: Boolean(body.trusted) };
  }, [reload]);

  const verifyCode = useCallback(
    async (code, remember) => {
      const response = await fetch("/api/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, remember }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, error: body.error || "Code invalide." };
      setStatus("chargement");
      await reload();
      return { ok: true };
    },
    [reload]
  );

  // Panneau « Ajuster » : l'id de la ligne de stock ouverte (null = fermé).
  const [adjusting, setAdjusting] = useState(null);
  const openAdjust = useCallback((stockId) => setAdjusting(stockId), []);
  const closeAdjust = useCallback(() => setAdjusting(null), []);

  // Retrouve une ligne de stock (pièce, sorte d'aiguille ou étui) par son id.
  const findStockLine = useCallback(
    (stockId) => {
      const collectionName = (id) => state.collections.find((c) => c.id === id)?.name ?? "";
      for (const product of state.products) {
        if (product.stockId === stockId) {
          return { name: product.name, detail: collectionName(product.collectionId), stock: product.stock };
        }
        for (const type of product.packTypes || []) {
          if (type.stockId === stockId) {
            return { name: `${product.name} · ${type.name.toLowerCase()}`, detail: collectionName(product.collectionId), stock: type.stock };
          }
        }
      }
      for (const kit of state.kits) {
        for (const leather of kit.leather) {
          if (leather.stockId === stockId) {
            return { name: `Étui ${leather.color.toLowerCase()}`, detail: kit.name, stock: leather.stock };
          }
        }
      }
      return null;
    },
    [state.collections, state.products, state.kits]
  );

  // Ajoute ou retire du stock, puis relit les données (le chiffre change partout).
  const adjustStock = useCallback(
    async (stockId, payload) => {
      const response = await fetch(`/api/stock/${stockId}/ajuster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);
      const body = await response?.json().catch(() => ({}));
      if (!response?.ok) return { ok: false, error: body?.error || "Enregistrement impossible." };
      await reload();
      return { ok: true, ...body };
    },
    [reload]
  );

  // Minimums (vraies données) : enregistrés en base, 400 ms après le dernier clic,
  // pour ne pas envoyer une requête à chaque − / +.
  const minimumTimers = useRef({});
  const saveMinimum = useCallback(({ productId, variantId = null, minimum }) => {
    const key = `${productId}:${variantId ?? ""}`;
    clearTimeout(minimumTimers.current[key]);
    minimumTimers.current[key] = setTimeout(() => {
      fetch("/api/minimum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: Number(productId), variantId: variantId == null ? null : Number(variantId), minimum }),
      })
        .then((response) => {
          if (!response.ok) setError("Minimum non enregistré.");
        })
        .catch(() => setError("Minimum non enregistré."));
    }, 400);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    setStatus("connexion");
  }, []);

  // Recalcule l'inventaire seulement quand les produits ou les kits changent (pas à chaque frappe dans le catalogue).
  const computed = useMemo(() => computeInventory({ products: state.products, kits: state.kits }), [state.products, state.kits]);
  const value = useMemo(
    () => ({
      ...state,
      ...computed,
      dispatch,
      status,
      error,
      requestCode,
      verifyCode,
      logout,
      reload,
      readOnly: state.source === "live",
      adjusting,
      openAdjust,
      closeAdjust,
      findStockLine,
      adjustStock,
      saveMinimum,
    }),
    [state, computed, status, error, requestCode, verifyCode, logout, reload, adjusting, openAdjust, closeAdjust, findStockLine, adjustStock, saveMinimum]
  );
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory doit être utilisé dans <InventoryProvider>");
  return context;
}
