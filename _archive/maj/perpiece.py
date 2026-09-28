import sys
root=sys.argv[1]
def patch(p, pairs):
    s=open(p,newline='').read(); nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
    for a,b in pairs:
        assert s.count(a)==1,(p,a[:70]); s=s.replace(a,b)
    open(p,'w',newline='').write(s.replace('\n',nl))
patch(root+'/lib/inventory.js',[('''    const base = objective.basePerTool || 0;''','''    // Quantité à l'unité propre à chaque pièce, sinon la valeur par défaut.
    const base = objective.perPiece?.[component.productId] ?? objective.basePerTool ?? 0;''')])
patch(root+'/pages/Objectifs.jsx',[
('''              {objective.basePerTool} à l'unité + {objective.kitCount} × qté par kit''','''              à l'unité + {objective.kitCount} × qté par kit'''),
('''          <Setting label="Base à l'unité">
            <Stepper
              small
              label="Base à l'unité"
              value={objective.basePerTool}
              onChange={(v) => update({ basePerTool: Math.max(0, Number(v) || 0) })}
            />
          </Setting>''','''          <PerPieceList
            kit={kit}
            values={objective.perPiece ?? {}}
            fallback={objective.basePerTool ?? 0}
            onChange={(productId, value) => update({ perPiece: { ...(objective.perPiece ?? {}), [productId]: value } })}
          />'''),
('''            note={`${objective.kitCount} ${kitName} + ${objective.basePerTool} à l'unité · pour le ${formatDate(objective.date)}`}''','''            note={`${objective.kitCount} ${kitName} + quantités à l'unité · pour le ${formatDate(objective.date)}`}'''),
('''function Setting({ label, children }) {''','''/** Liste horizontale : combien on veut de chaque pièce à l'unité. */
function PerPieceList({ kit, values, fallback, onChange }) {
  const { productsById } = useInventory();
  if (!kit) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-line/35 py-3">
      <span className="text-[19px] text-cream">Quantité à l'unité</span>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {kit.components.map((component) => {
          const product = productsById[component.productId];
          const value = values[component.productId] ?? fallback;
          return (
            <div key={component.productId} className="flex shrink-0 flex-col items-center gap-2 border border-line/50 bg-panel2 px-3 py-3">
              <span className="max-w-[130px] truncate text-center text-[16px] text-cream" title={product.name}>
                {product.name}
              </span>
              <Stepper
                small
                label={`Quantité ${product.name}`}
                value={value}
                onChange={(v) => onChange(component.productId, Math.max(0, Number(v) || 0))}
              />
              {product.type === "paquet" && <span className="text-[13px] text-faint">paquets</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Setting({ label, children }) {'''),
('''  const [base, setBase] = useState(10);
''','''  const [perPiece, setPerPiece] = useState({});
'''),
('''      basePerTool: Math.max(0, Number(base) || 0),''','''      basePerTool: 10,
      perPiece,'''),
('''      <Setting label="Base à l'unité">
        <Stepper small label="Base à l'unité" value={base} onChange={(v) => setBase(Math.max(0, Number(v) || 0))} />
      </Setting>''','''      <PerPieceList
        kit={kits.find((k) => k.id === kitId)}
        values={perPiece}
        fallback={10}
        onChange={(productId, value) => setPerPiece((current) => ({ ...current, [productId]: value }))}
      />'''),
])
print('ok')
