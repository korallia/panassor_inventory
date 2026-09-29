// Données d'EXEMPLE pour tester l'interface. Rien ici ne vient de la vraie
// base : quand l'API existera, elle renverra ces mêmes formes et ce fichier
// disparaîtra.
//
// Types de produit :
//   "piece"    : pièce fixe d'un kit (ex. Pince)
//   "outil"    : outil au choix, remplaçable dans les kits (ex. Scalpel)
//   "ensemble" : plusieurs pièces vendues ensemble, sans réservation
//   "paquet"   : ensemble dont les pièces ne se vendent jamais seules
//                (ex. aiguilles de suture : 1 droite + 1 courbe)
//   "kit"      : kit complet, formé d'un étui de cuir + ses composants
//
// Toutes les quantités (réservé, libre, kits prêts, ensembles possibles…)
// sont CALCULÉES dans src/lib/inventory.js à partir de ces stocks.

export const collections = [
  { id: "chirurgien", name: "Chirurgien" },
  { id: "tortionnaire", name: "Tortionnaire" },
  { id: "voleur", name: "Kit du voleur" },
];

export const products = [
  // ---------- Chirurgien ----------
  { id: "pince", collectionId: "chirurgien", name: "Pince", type: "piece", stock: 20, min: 6 },
  {
    id: "aiguilles-suture",
    collectionId: "chirurgien",
    name: "Aiguilles de suture",
    type: "paquet",
    min: 5,
    // Un paquet = 1 de chaque type. Le surplus d'un type = aiguilles orphelines.
    packTypes: [
      { id: "droite", name: "Droites", stock: 13 },
      { id: "courbe", name: "Courbes", stock: 9 },
    ],
  },
  { id: "crochet-chir", collectionId: "chirurgien", name: "Crochet", type: "outil", stock: 17, min: 6 },
  { id: "curette", collectionId: "chirurgien", name: "Curette", type: "outil", stock: 19, min: 6 },
  { id: "scalpel", collectionId: "chirurgien", name: "Scalpel", type: "outil", stock: 10, min: 10 },
  { id: "spatule", collectionId: "chirurgien", name: "Spatule", type: "outil", stock: 24, min: 6 },

  // ---------- Tortionnaire ----------
  { id: "aiguille-couleur", collectionId: "tortionnaire", name: "Aiguille de couleur", type: "outil", stock: 70, min: 10 },
  { id: "correcteur", collectionId: "tortionnaire", name: "Le Correcteur", type: "outil", stock: 50, min: 10 },
  { id: "pacificateur", collectionId: "tortionnaire", name: "Le Pacificateur", type: "outil", stock: 49, min: 10 },
  { id: "redresseur", collectionId: "tortionnaire", name: "Le Redresseur", type: "outil", stock: 48, min: 10 },
  { id: "dernier-argument", collectionId: "tortionnaire", name: "Dernier Argument", type: "outil", stock: 46, min: 10 },

  // ---------- Kit du voleur ----------
  { id: "cle-vierge", collectionId: "voleur", name: "Clé vierge", type: "piece", stock: 15, min: 5 },
  { id: "crochet-voleur", collectionId: "voleur", name: "Crochet", type: "piece", stock: 14, min: 5 },
  { id: "lime", collectionId: "voleur", name: "Lime", type: "outil", stock: 12, min: 4 },
  { id: "passe-droite", collectionId: "voleur", name: "Passe droite", type: "outil", stock: 9, min: 4 },
  { id: "passe-exterieur", collectionId: "voleur", name: "Passe extérieur", type: "outil", stock: 8, min: 4 },
  { id: "passe-interieur", collectionId: "voleur", name: "Passe intérieur", type: "outil", stock: 8, min: 4 },
  { id: "tourne-serrure", collectionId: "voleur", name: "Tourne-serrure", type: "outil", stock: 7, min: 4 },
  {
    id: "crochet-tourne",
    collectionId: "voleur",
    name: "Crochet + tourne-serrure",
    type: "ensemble",
    objective: 6,
    components: [
      { productId: "crochet-voleur", qty: 1 },
      { productId: "tourne-serrure", qty: 1 },
    ],
  },
  {
    id: "cle-lime",
    collectionId: "voleur",
    name: "Clé vierge + lime",
    type: "ensemble",
    objective: 5,
    components: [
      { productId: "cle-vierge", qty: 1 },
      { productId: "lime", qty: 1 },
    ],
  },
];

// Un kit = son étui de cuir (par couleur, affichage seulement) + ses
// composants. Le nombre d'étuis (toutes couleurs) fixe combien de kits on
// vise, donc combien de chaque composant est réservé.
export const kits = [
  {
    id: "kit-chirurgien",
    collectionId: "chirurgien",
    name: "Kit du chirurgien",
    min: 3,
    leather: [
      { color: "Noir", swatch: "#141414", stock: 5, min: 2 },
      { color: "Brun foncé", swatch: "#2a180c", stock: 3, min: 1 },
    ],
    components: [
      { productId: "pince", qty: 1 },
      { productId: "aiguilles-suture", qty: 1 },
      { productId: "crochet-chir", qty: 1, choice: true },
      { productId: "curette", qty: 1, choice: true },
      { productId: "scalpel", qty: 1, choice: true },
      { productId: "spatule", qty: 1, choice: true },
    ],
  },
  {
    id: "kit-tortionnaire",
    collectionId: "tortionnaire",
    name: "Kit tortionnaire",
    min: 3,
    leather: [{ color: "Noir", swatch: "#141414", stock: 6, min: 2 }],
    components: [
      { productId: "aiguille-couleur", qty: 1, choice: true },
      { productId: "correcteur", qty: 1, choice: true },
      { productId: "pacificateur", qty: 1, choice: true },
      { productId: "redresseur", qty: 1, choice: true },
      { productId: "dernier-argument", qty: 1, choice: true },
    ],
  },
  {
    id: "kit-voleur",
    collectionId: "voleur",
    name: "Kit du voleur",
    min: 2,
    leather: [
      { color: "Noir", swatch: "#141414", stock: 2, min: 1 },
      { color: "Brun foncé", swatch: "#2a180c", stock: 1, min: 1 },
    ],
    components: [
      { productId: "cle-vierge", qty: 1 },
      { productId: "crochet-voleur", qty: 1 },
      { productId: "lime", qty: 1, choice: true },
      { productId: "passe-droite", qty: 1, choice: true },
      { productId: "passe-exterieur", qty: 1, choice: true },
      { productId: "passe-interieur", qty: 1, choice: true },
      { productId: "tourne-serrure", qty: 1, choice: true },
    ],
  },
];

export const objectives = [
  {
    id: "obj-1",
    reason: "[Nom de l'événement]",
    date: "",
    kitId: "kit-chirurgien",
    kitCount: 8,
    basePerTool: 10,
    // Stock au moment de créer l'objectif (le suivi compte ce qui s'ajoute).
    baseline: {
      "etuis-kit-chirurgien": 3,
      pince: 8,
      "aiguilles-suture": 5,
      "crochet-chir": 5,
      curette: 4,
      scalpel: 4,
      spatule: 10,
    },
  },
];

export const reports = [
  { id: "rep-1", name: "Rapport hebdomadaire", schedule: "Chaque lundi, 8 h", channel: "Courriel", active: true, contents: "Stock par collection, kits prêts, alertes, objectifs" },
  { id: "rep-2", name: "Bilan mensuel", schedule: "Le 1er du mois, 9 h", channel: "Discord", active: false, contents: "Ventes du mois, pièces consommées, à refaire" },
];
