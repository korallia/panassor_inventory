import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces en stock</div>
            <div className="text-[15px] text-faint">
              Objectif : {target} {plural(target, "étui", "étuis")} × qté · minimum libre exclu
            </div>''','''            <div className="sc text-[16px] tracking-[.16em] text-gold">Pièces disponibles</div>
            <div className="text-[15px] text-faint">total − libres</div>''')
rep('''                  <div className="text-[13px] text-faint">
                    {component.choice ? "au choix · défaut" : "fixe"}
                    {isPack ? " · paquets" : ""}
                  </div>
''','')
rep('''                  <RatioValue
                    have={stock}
                    need={need}
                    note={`${product.min ?? 0} gardés libres${stock > need ? ` · +${stock - need}` : ""}`}
                  />''','''                  <RatioValue have={stock} need={need} />''')
rep('''          <div className="mb-1.5 text-[15px] text-faint">
            Outils au choix : on réserve l'outil par défaut. Si le client le remplace, l'outil choisi est retiré à la vente et le
            défaut redevient libre.
          </div>
''','')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
