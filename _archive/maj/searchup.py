import sys,re
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
m=re.search(r'\n( *)<input\n\s*aria-label="Rechercher".*?/>\n', s, re.S)
assert m
s=s[:m.start()]+'\n'+s[m.end():]
a='''      <PageHeader eyebrow="Registre" title="Inventaire" />'''
assert s.count(a)==1
s=s.replace(a,'''      <PageHeader eyebrow="Registre" title="Inventaire">
        <input
          aria-label="Rechercher"
          placeholder="Rechercher un produit…"
          className="field w-[260px]!"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </PageHeader>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
