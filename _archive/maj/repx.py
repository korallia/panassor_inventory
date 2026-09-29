import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''function ReportItem({ report, open, onToggleOpen, update, remove }) {
  return (''','''function ReportItem({ report, open, onToggleOpen, update, remove }) {
  const [confirming, setConfirming] = useState(false);
  return (''')
rep('''          {report.active ? "Actif" : "En pause"}
        </button>
      </div>
''','''          {report.active ? "Actif" : "En pause"}
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className={`sc cursor-pointer border px-2.5 py-0.5 text-[13px] tracking-[.08em] ${
            open ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-gold-light hover:text-cream"
          }`}
        >
          {open ? "Fermer" : "Modifier"}
        </button>
        <button
          type="button"
          aria-label={`Retirer ${report.name}`}
          title="Retirer ce rapport"
          onClick={() => setConfirming(true)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center border border-line bg-transparent text-[18px] leading-none text-muted2 hover:border-alert-line hover:text-alert"
        >
          ×
        </button>
      </div>

      {confirming && (
        <div className="mt-2 flex items-center justify-between gap-3 border border-alert-line bg-alert-bg px-3 py-2 text-[15px]">
          <span className="text-alert-soft">Retirer « {report.name} » ?</span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost h-8! px-3! text-[13px]!" onClick={() => setConfirming(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="sc h-8 cursor-pointer border border-alert-line bg-[#9b4a36] px-3 text-[13px] tracking-[.1em] text-cream"
              onClick={remove}
            >
              Retirer
            </button>
          </span>
        </div>
      )}
''')
rep('''          <button type="button" className="btn-ghost w-fit" onClick={remove}>
            Supprimer ce rapport
          </button>
''','')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
