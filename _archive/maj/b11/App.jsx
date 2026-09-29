import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import Inventaire from "./pages/Inventaire.jsx";
import ProduitDetail from "./pages/ProduitDetail.jsx";
import Kits from "./pages/Kits.jsx";
import Minimums from "./pages/Minimums.jsx";
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
        <Route path="/minimums" element={<Minimums />} />
        <Route path="/objectifs/*" element={<Navigate to="/minimums" replace />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="*" element={<Navigate to="/inventaire" replace />} />
      </Route>
    </Routes>
  );
}
