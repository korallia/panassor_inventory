import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''  // Stock utilisable pour les kits = stock − minimum libre (le quota de vente est exclu).
  const forKits = (product) => Math.max(0, productStock(product) - (product.min ?? 0));
''','''  // Les kits passent en premier : tout le stock sert aux kits, le minimum libre vient après.
  const forKits = (product) => productStock(product);
''')
rep('''<div className="sc text-[16px] tracking-[.16em] text-gold">Pièces disponibles</div>''','''<div className="sc text-[16px] tracking-[.16em] text-gold">Pièces en stock</div>''')
rep('''<div className="text-[15px] text-faint">total − minimum libre</div>''','''<div className="text-[15px] text-faint">les kits passent en premier</div>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
