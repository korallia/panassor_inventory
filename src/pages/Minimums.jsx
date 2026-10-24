// Minimums : la page de configuration.
// Tout le reste (kits prêts, manquants, alertes) découle de ces chiffres
// avec les règles de métier, donc il n'y a plus d'objectif à saisir à la main.
//   - kit      : minimum de kits prêts
//   - étuis    : minimum par couleur
//   - outils   : minimum libre (vente à l'unité)
//   - ensembles: nombre d'ensembles à pouvoir faire
import { useInventory } from "../store.jsx";
import { PageHeader, SampleNote, Stepper } from "../components/ui.jsx";

export default function Minimums() {
  const { collections, kits, products, dispatch, source, saveMinimum } = useInventory();
  // Vraies données : chaque changement est aussi enregistré en base (table minimums).
  const save = (productId, value, variantId = null) => {
    if (source === "live") saveMinimum({ productId, variantId, minimum: Math.max(0, Math.round(Number(value) || 0)) });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Configuration" title="Minimums" />

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
        {collections.map((collection) => {
          const kit = kits.find((k) => k.collectionId === collection.id);
          const tools = products.filter((p) => p.collectionId === collection.id && p.type !== "ensemble");
          const ensembles = products.filter((p) => p.collectionId === collection.id && p.type === "ensemble");
          return (
            <section key={collection.id} className="flex flex-col border border-line/50 bg-panel/60 px-6 py-5">
              {kit ? (
                <Row
                  strong
                  name={kit.name}
                  hint="kits prêts"
                  value={kit.min}
                  onChange={(value) => {
                    dispatch({ type: "setKitMin", kitId: kit.id, value });
                    save(kit.id, value);
                  }}
                />
              ) : (
                <div className="sc py-3 text-[16px] tracking-[.16em] text-gold">{collection.name}</div>
              )}

              {kit && (
                <>
                  <Subtitle>Étuis de cuir</Subtitle>
                  {kit.leather.map((leather) => (
                    <Row
                      key={leather.color}
                      swatch={leather.swatch}
                      name={leather.color}
                      hint="étuis"
                      value={leather.min ?? 0}
                      onChange={(value) => {
                        dispatch({ type: "setLeatherMin", kitId: kit.id, color: leather.color, value });
                        if (leather.variantId) save(kit.id, value, leather.variantId);
                      }}
                    />
                  ))}
                </>
              )}

              <Subtitle>Outils · minimum libre</Subtitle>
              {tools.map((product) => (
                <Row
                  key={product.id}
                  name={product.name}
                  hint={product.type === "paquet" ? "paquets" : null}
                  value={product.min ?? 0}
                  onChange={(value) => {
                    dispatch({ type: "setMin", productId: product.id, value });
                    save(product.id, value);
                  }}
                />
              ))}

              {ensembles.length > 0 && (
                <>
                  <Subtitle>Ensembles</Subtitle>
                  {ensembles.map((product) => (
                    <Row
                      key={product.id}
                      name={product.name}
                      hint="ensembles"
                      value={product.objective ?? 0}
                      onChange={(value) => {
                        dispatch({ type: "setObjective", productId: product.id, value });
                        save(product.id, value);
                      }}
                    />
                  ))}
                </>
              )}
            </section>
          );
        })}
      </div>
      <SampleNote />
    </div>
  );
}

function Subtitle({ children }) {
  return <div className="sc mt-4 border-t border-gold/60 pt-3 pb-1 text-[14px] tracking-[.16em] text-gold">{children}</div>;
}

function Row({ name, hint, value, onChange, swatch, strong = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${strong ? "-mx-3 px-3" : "border-t border-line/35"}`}
      style={strong ? { background: "linear-gradient(90deg,rgba(200,155,60,.16),rgba(200,155,60,.03))" } : undefined}
    >
      <span className="flex items-center gap-3">
        {swatch && <span className="h-6 w-6 shrink-0 border border-line" style={{ background: swatch }} />}
        <span className={strong ? "text-[22px] font-semibold text-cream" : "text-[19px] text-cream"}>{name}</span>
      </span>
      <span className="flex items-center gap-3">
        {hint && <span className="sub">{hint}</span>}
        <Stepper small label={`Minimum ${name}`} value={value} onChange={onChange} />
      </span>
    </div>
  );
}
