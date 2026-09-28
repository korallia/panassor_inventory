// État de l'application, en mémoire seulement : chaque rechargement de la
// page repart des données d'exemple. Les boutons + / − servent à tester les
// calculs. Plus tard, ces actions deviendront des appels à l'API.
import { createContext, useContext, useMemo, useReducer } from "react";

import * as sample from "./data/sampleData.js";
import { computeInventory } from "./lib/inventory.js";

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
        kits: state.kits.map((kit) => (kit.id === action.kitId ? { ...kit, min: clampStock(action.value) } : kit)),
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
      return initialState;
    default:
      return state;
  }
}

const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const computed = useMemo(() => computeInventory(state), [state]);
  const value = useMemo(() => ({ ...state, ...computed, dispatch }), [state, computed]);
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory doit être utilisé dans <InventoryProvider>");
  return context;
}
