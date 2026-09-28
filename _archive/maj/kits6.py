import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a; s=s.replace(a,b)
rep('''    ...kit.components.map((c) => Math.floor(productStock(productsById[c.productId]) / c.qty))''','''    ...kit.components.map((c) => Math.floor(forKits(productsById[c.productId]) / c.qty))''')
rep('''  // Kits faisables avec les pièces seulement (sans compter les étuis).''','''  // Stock utilisable pour les kits = stock − minimum libre (le quota de vente est exclu).
  const forKits = (product) => Math.max(0, productStock(product) - (product.min ?? 0));
  // Kits faisables avec les pièces seulement (sans compter les étuis).''')
rep('''              Objectif par pièce : {target} {plural(target, "étui", "étuis")} × qté''','''              Objectif : {target} {plural(target, "étui", "étuis")} × qté · minimum libre exclu''')
rep('''            const stock = productStock(product);''','''            const stock = forKits(product);''')
rep('''                    note={stock > need ? `+${stock - need} libres` : isPack ? "paquets" : null}''','''                    note={`${product.min ?? 0} gardés libres${stock > need ? ` · +${stock - need}` : ""}`}''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
