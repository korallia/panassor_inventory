# Panassor · Atelier (inventaire)

Application séparée du site, avec **données d'exemple seulement**. Rien n'est relié à la base, au site ni à Square.

## Lancer

```bash
npm install
npm run dev      # http://localhost:5180  (serveur local + interface)
npm test         # vérifie les règles de calcul
```

## Vraies données (lecture seule)

1. Copie `env.atelier.example` en `.env.atelier` et remplis-le (base Postgres du site,
   jeton + emplacement Square, mot de passe de l'atelier). Ce fichier reste sur ton ordi.
2. `npm run dev`, puis ouvre http://localhost:5180 et entre le mot de passe.

Le serveur local (`server/`) lit la base (produits, images, kits, couleurs) et le stock
Square. Il n'écrit nulle part : chaque requête Postgres tourne dans une transaction
READ ONLY et Square n'est interrogé qu'en lecture. Il n'écoute que sur 127.0.0.1.

Sans `.env.atelier` (ou si le serveur ne répond pas), l'atelier affiche les données d'exemple.

Les boutons − / + (fiches, kits, alertes) changent les quantités pour tester les calculs.
Tout revient aux valeurs d'exemple au rechargement (ou avec « Réinitialiser »).

## Où est quoi

| Fichier | Rôle |
| --- | --- |
| `src/data/sampleData.js` | Données d'exemple (collections, produits, kits, objectifs, rapports) |
| `src/lib/inventory.js` | **Toutes les règles de calcul** (réservé, libre, kits prêts, ensembles, paquets, objectifs) |
| `tests/inventory.test.js` | Tests des règles |
| `src/store.jsx` | État en mémoire + actions (futurs appels à l'API) |
| `src/pages/` | Inventaire (1A/1B), ProduitDetail (1C, 1D paquet, 1D ensemble), Kits, Objectifs, Alertes, Catalogue |
| `src/components/ui.jsx` | Cases, légendes, tuiles, états |

## Règles

- **Kits visés** = total des étuis de cuir (couleurs affichées à part seulement).
- **Réservé** = étuis × quantité par kit, pour chaque composant (outil par défaut pour les « au choix »), sans dépasser le stock.
- **Libre** = stock − réservé. **État** : « Sous le min. » si libre < minimum, sinon « OK ».
- **Kits prêts** = min(étuis, stock de chaque composant ÷ qté).
- **Ensembles** : aucune réservation ; calculés sur le stock **libre** seulement.
  Couches : 1 réservé kits · 2 pour les ensembles · 3 vendable seul · manque.
- **Paquets** (aiguilles) : 1 paquet = 1 de chaque type. Stock = paquets réguliers ; le surplus d'un type = orphelines, hors stock.
- **Objectif** : par pièce = base à l'unité + N kits × qté par kit, comparé au stock total.
