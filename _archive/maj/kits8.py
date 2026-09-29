import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
a='''                  {!isPack && (
                    <div className="mt-2">
                      <Stepper
                        small
                        label={`Stock ${product.name}`}
                        value={product.stock}
                        onChange={(value) => dispatch({ type: "setStock", productId: product.id, value })}
                      />
                    </div>
                  )}
'''
assert s.count(a)==1
s=s.replace(a,'')
s=s.replace('''            const isPack = product.type === "paquet";
''','')
s=s.replace('<div key={component.productId} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-3">','<div key={component.productId} className="flex flex-wrap items-center gap-4 border-t border-line/35 py-4">')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
