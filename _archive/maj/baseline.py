import sys
root=sys.argv[1]
def patch(p, pairs):
    s=open(p,newline='').read(); nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
    for a,b in pairs:
        assert s.count(a)==1,(p,a[:80]); s=s.replace(a,b)
    open(p,'w',newline='').write(s.replace('\n',nl))
patch(root+'/pages/Objectifs.jsx',[
('''    const rows = chosen.map(({ kit, count }) => ({
      id: `etuis-${kit.id}`,
      name: `Étuis · ${kit.name.replace(/^Kit (du |de la |de |)/i, "")}`,
      have: leatherTotal(kit),
      need: count,
    }));''','''    // Un objectif = du NOUVEAU stock. On compte ce qui a été fabriqué depuis
    // la création : stock actuel − stock noté à la création (jamais négatif).
    const baseline = objective.baseline ?? {};
    const made = (key, current) => Math.max(0, current - (baseline[key] ?? current));

    const rows = chosen.map(({ kit, count }) => ({
      id: `etuis-${kit.id}`,
      name: `Étuis · ${kit.name.replace(/^Kit (du |de la |de |)/i, "")}`,
      have: made(`etuis-${kit.id}`, leatherTotal(kit)),
      need: count,
    }));'''),
('''      rows.push({ id: product.id, name: product.name, have: productStock(product), need, pack: product.type === "paquet" });''','''      rows.push({ id: product.id, name: product.name, have: made(product.id, productStock(product)), need, pack: product.type === "paquet" });'''),
('''      kits: Object.fromEntries(Object.entries(kitsWanted).filter(([, n]) => n > 0)),''','''      kits: Object.fromEntries(Object.entries(kitsWanted).filter(([, n]) => n > 0)),
      // Stock noté à la création : le suivi compte ce qui s'ajoute par-dessus.
      baseline: Object.fromEntries([
        ...products.map((p) => [p.id, productStock(p)]),
        ...kits.map((k) => [`etuis-${k.id}`, leatherTotal(k)]),
      ]),'''),
('''            <span className="text-[17px] text-muted">pièces prêtes sur {need}</span>''','''            <span className="text-[17px] text-muted">
              {have <= 1 ? "pièce fabriquée" : "pièces fabriquées"} sur {need}
            </span>'''),
])
patch(root+'/data/sampleData.js',[
('''    kitCount: 8,
    basePerTool: 10,''','''    kitCount: 8,
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
    },'''),
])
print('ok')
