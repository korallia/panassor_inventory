import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
a='''  const computed = useMemo(() => computeInventory(state), [state]);'''
assert s.count(a)==1
s=s.replace(a,'''  // Recalcule l'inventaire seulement quand les produits ou les kits changent (pas à chaque frappe dans le catalogue).
  const computed = useMemo(() => computeInventory({ products: state.products, kits: state.kits }), [state.products, state.kits]);''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
