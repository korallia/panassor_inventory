import sys,re
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
# toggle group
i=s.index('          <div className="flex" role="group" aria-label="Affichage">')
j=s.index('          </div>\n',s.index('          </div>\n',i)+1)  # closing of the group (after the map closing)
# safer: find the end of the map block ")}" then the group's closing div
k=s.index('            ))}\n',i)+len('            ))}\n')
assert s[k:k+len('          </div>\n')]=='          </div>\n'
s=s[:i]+s[k+len('          </div>\n'):]
s=s.replace('''  const [view, setView] = useState("registre");
''','')
assert s.count('{view === "registre" ? <RegisterTable groups={groups} /> : <CardsView groups={groups} />}')==1
s=s.replace('{view === "registre" ? <RegisterTable groups={groups} /> : <CardsView groups={groups} />}','<RegisterTable groups={groups} />')
i=s.index('function CardsView({ groups }) {')
s=s[:i].rstrip('\n')+'\n'
s=s.replace("// 1A — Registre (et 1B — vue en cartes).","// 1A — Registre.")
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
