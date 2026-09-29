import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className={`sc cursor-pointer border px-2.5 py-0.5 text-[13px] tracking-[.08em] ${
            open ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-gold-light hover:text-cream"
          }`}
        >
          {open ? "Fermer" : "Modifier"}
        </button>
''','')
rep('''    <div className="border-t border-line/35 py-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onToggleOpen} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left">''','''    <div className="border-t border-line/35 py-3">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggleOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggleOpen())}
        className={`-mx-2 flex cursor-pointer items-center justify-between gap-3 px-2 py-1 hover:bg-gold/5 ${open ? "bg-gold/8" : ""}`}
      >
        <div className="min-w-0 flex-1 text-left">''')
rep('''            {scheduleText(report)} · {report.channel.toLowerCase()}
          </div>
        </button>''','''            {scheduleText(report)} · {report.channel.toLowerCase()}
          </div>
        </div>''')
rep('''          onClick={() => update({ active: !report.active })}''','''          onClick={(e) => {
            e.stopPropagation();
            update({ active: !report.active });
          }}''')
rep('''          onClick={() => setConfirming(true)}''','''          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
