import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
i=s.index('      <PageHeader eyebrow="Registre" title="Inventaire">')
j=s.index('      </PageHeader>\n',i)+len('      </PageHeader>\n')
header=s[i:j]
controls=header[header.index('        <div className="flex flex-wrap items-center gap-3">'):header.index('      </PageHeader>')]
s=s[:i]+'      <PageHeader eyebrow="Registre" title="Inventaire" />\n'+s[j:]
a='''      <div role="tablist" aria-label="Collection" className="flex overflow-x-auto border-b border-line">'''
assert s.count(a)==1
k=s.index(a); end=s.index('      </div>\n',s.index('        })}\n',k))+len('      </div>\n')
tabs=s[k:end]
tabs=tabs.replace('className="flex overflow-x-auto border-b border-line"','className="flex overflow-x-auto"')
tabs='\n'.join('  '+l if l.strip() else l for l in tabs.rstrip('\n').split('\n'))+'\n'
controls='\n'.join('  '+l if l.strip() else l for l in controls.rstrip('\n').split('\n'))+'\n'
controls=controls.replace('className="flex flex-wrap items-center gap-3"','className="flex flex-wrap items-center gap-3 py-2"',1)
s=s[:k]+'''      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-line">
'''+tabs+controls+'''      </div>
'''+s[end:]
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
