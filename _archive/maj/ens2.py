import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
a='''            <span className="text-[17px] text-muted">{plural(state.possible)} possibles</span>
            {missingParts.map((part) => (
              <span key={part.product.id} className="flex items-baseline gap-2 border-l border-line pl-3">
                <span className="text-[22px] leading-none text-alert-soft">{part.missing}</span>
                <span className="text-[16px] text-alert-muted">{part.product.name.toLowerCase()} manquants</span>
              </span>
            ))}'''
assert s.count(a)==1
s=s.replace(a,'''            <span className="text-[17px] text-muted">{plural(state.possible)}</span>
            {state.parts
              .map((part) => ({ part, orphans: part.free - state.possible * part.qty }))
              .filter(({ orphans }) => orphans > 0)
              .map(({ part, orphans }) => (
                <span key={part.product.id} className="flex items-baseline gap-2 border-l border-line pl-3">
                  <span className="text-[22px] leading-none text-muted2">+ {orphans}</span>
                  <span className="text-[16px] text-faint">
                    {orphans === 1 ? "orpheline" : "orphelines"} ({part.product.name.toLowerCase()})
                  </span>
                </span>
              ))}''')
s=s.replace('''  const missingParts = state.parts.filter((part) => part.missing > 0);
  const composition''','''  const composition''')
open(p,'w',newline='').write(s.replace('\n',nl))
print('ok')
