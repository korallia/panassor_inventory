import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''  const update = (patch) => dispatch({ type: "updateCatalog", id: entry.id, patch });''','''  const update = (patch) => dispatch({ type: "updateCatalog", id: entry.id, patch });
  const [confirming, setConfirming] = useState(false);''')
rep('''          {empty > 0 ? <span className="text-warn">{empty} à remplir</span> : <span className="text-ok">Complet</span>}
        </div>
      </div>
''','''          {empty > 0 ? <span className="text-warn">{empty} à remplir</span> : <span className="text-ok">Complet</span>}
        </div>
        <button
          type="button"
          aria-label={`Retirer ${entry.nameFr}`}
          title="Retirer ce produit"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center border border-line bg-transparent text-[18px] leading-none text-muted2 hover:border-alert-line hover:text-alert"
        >
          ×
        </button>
      </div>

      {confirming && (
        <div className="flex items-center justify-between gap-3 border-t border-alert-line bg-alert-bg px-5 py-2 text-[15px]">
          <span className="text-alert-soft">Retirer « {entry.nameFr} » du catalogue ?</span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost h-8! px-3! text-[13px]!" onClick={() => setConfirming(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="sc h-8 cursor-pointer border border-alert-line bg-[#9b4a36] px-3 text-[13px] tracking-[.1em] text-cream"
              onClick={() => dispatch({ type: "removeCatalog", id: entry.id })}
            >
              Retirer
            </button>
          </span>
        </div>
      )}
''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
