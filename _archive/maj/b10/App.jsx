import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import Inventaire from "./pages/Inventaire.jsx";
import ProduitDetail from "./pages/ProduitDetail.jsx";
import Kits from "./pages/Kits.jsx";
import Objectifs from "./pages/Objectifs.jsx";
import Alertes from "./pages/Alertes.jsx";
import Catalogue from "./pages/Catalogue.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/inventaire" replace />} />
        <Route path="/inventaire" element={<Inventaire />} />
        <Route path="/produits/:id" element={<ProduitDetail />} />
        <Route path="/kits" element={<Kits />} />
        <Route path="/kits/:id" element={<Kits />} />
        <Route path="/objectifs" element={<Objectifs />} />
        <Route path="/objectifs/:id" element={<Objectifs />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="*" element={<Navigate to="/inventaire" replace />} />
      </Route>
    </Routes>
  );
}
