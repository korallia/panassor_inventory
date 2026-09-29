import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''const RANK = { out: 0, low: 1 };''','''const RANK = { out: 0, low: 1 };
const plural = (n, one, many) => (n === 1 ? one : many);
const manque = (n, one, many) => `Manque ${n} ${plural(n, one, many)}`;''')
rep('''detail: `${ready} kits prêts · minimum ${kit.min}`''','''detail: manque(kit.min - ready, "kit", "kits")''')
rep('''            detail: `${leather.stock} en stock · minimum ${leather.min ?? 0}`,''','''            detail: manque((leather.min ?? 0) - leather.stock, "étui", "étuis"),''')
rep('''detail: `${state.possible} possibles · minimum ${state.objective}`''','''detail: manque(state.objective - state.possible, "ensemble", "ensembles")''')
rep('''        const unit = product.type === "paquet" ? (state.free === 1 ? " paquet" : " paquets") : "";
''','')
rep('''          detail: `${state.free}${unit} ${state.free === 1 ? "libre" : "libres"} · minimum ${state.min}`,''','''          detail:
            product.type === "paquet"
              ? manque(state.missingForMin, "paquet", "paquets")
              : manque(state.missingForMin, product.name.toLowerCase(), product.name.toLowerCase()),''')
rep('''              <div className="text-right text-[16px] text-muted">{alert.detail}</div>''','''              <div className="text-right text-[17px] text-alert-soft">{alert.detail}</div>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
