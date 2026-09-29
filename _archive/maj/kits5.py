import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
a='''  const idleCases = target - ready;
'''
assert s.count(a)==1
s=s.replace(a,'''  const idleCases = target - ready;
  // Kits faisables avec les pièces seulement (sans compter les étuis).
  const fromTools = Math.min(
    ...kit.components.map((c) => Math.floor(productStock(productsById[c.productId]) / c.qty))
  );
''')
b='''            <span className="text-[30px] leading-none text-cream">{ready}</span>
            <span className="text-[17px] text-muted">{plural(ready, "kit prêt", "kits prêts")}</span>
            {idleCases > 0 && (
              <span className="flex items-baseline gap-2 border-l border-line pl-3">
                <span className="text-[22px] leading-none text-muted2">+ {idleCases}</span>
                <span className="text-[16px] text-faint">{plural(idleCases, "étui orphelin", "étuis orphelins")}</span>
              </span>
            )}'''
assert s.count(b)==1
s=s.replace(b,'''            <span className="text-[30px] leading-none text-cream">{fromTools}</span>
            <span className="text-[17px] text-muted">{plural(fromTools, "kit faisable", "kits faisables")} avec ces pièces</span>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
