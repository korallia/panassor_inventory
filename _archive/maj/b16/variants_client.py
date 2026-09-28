import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
# swatches in the list row, under the EN name
rep('''          <div className="text-[14px] text-faint">{entry.nameEn || "— nom anglais à remplir"}</div>''','''          <div className="flex flex-wrap items-center gap-2 text-[14px] text-faint">
            {entry.nameEn || "— nom anglais à remplir"}
            {(entry.variants || []).length > 0 && (
              <span className="flex items-center gap-1" title={`${entry.variants.length} variantes`}>
                {entry.variants.map((v) => (
                  <span key={v.color} className="inline-block h-3 w-3 border border-line" style={{ background: v.swatch }} />
                ))}
              </span>
            )}
          </div>''')
# variants section before the text fieldset
rep('''        <Images entry={entry} update={update} readOnly={readOnly} />''','''        <Images entry={entry} update={update} readOnly={readOnly} />
        {(entry.variants || []).length > 0 && <Variants entry={entry} update={update} readOnly={readOnly} />}''')
rep('''function ColumnTitle(''','''/** Sous-produits : variantes de couleur avec leur prix (prix de base + écart) et leur stock. */
function Variants({ entry, update, readOnly }) {
  const base = Number(String(entry.price).replace(",", ".")) || 0;
  const money = (n) => `${n.toFixed(2).replace(".", ",")} $`;
  const set = (index, patch) => update({ variants: entry.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  return (
    <div className="flex flex-col gap-2">
      <ColumnTitle>
        Variantes <span className="ml-2 text-faint">{entry.variants.length}</span>
      </ColumnTitle>
      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_90px] items-center gap-x-4 px-1 text-[12px] tracking-[.14em] text-gold">
        <span className="sc">Couleur</span>
        <span className="sc text-right">Écart</span>
        <span className="sc text-right">Prix final</span>
        <span className="sc text-right">Stock</span>
      </div>
      {entry.variants.map((v, index) => (
        <div key={v.color} className="grid grid-cols-[minmax(0,1fr)_120px_120px_90px] items-center gap-x-4 border-t border-line/35 px-1 py-2.5">
          <span className="flex items-center gap-3">
            <span className="h-6 w-6 shrink-0 border border-line" style={{ background: v.swatch }} />
            <span className="text-[18px] text-cream">{v.color}</span>
          </span>
          <span className="text-right">
            {readOnly ? (
              <span className={`text-[17px] tabular-nums ${v.priceDelta ? "text-gold-light" : "text-faint"}`}>
                {v.priceDelta ? `+ ${money(v.priceDelta)}` : "—"}
              </span>
            ) : (
              <input
                className="field w-[110px]! text-right"
                inputMode="decimal"
                value={v.priceDelta}
                onChange={(e) => set(index, { priceDelta: Number(e.target.value.replace(",", ".")) || 0 })}
              />
            )}
          </span>
          <span className="text-right text-[17px] text-cream tabular-nums">{money(base + (v.priceDelta || 0))}</span>
          <span className="text-right text-[17px] tabular-nums text-muted">{v.stock ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function ColumnTitle(''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
