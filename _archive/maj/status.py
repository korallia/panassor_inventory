import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
# row badge becomes a plain indicator
rep('''        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            update({ active: !report.active });
          }}
          className="sc cursor-pointer border bg-transparent px-2.5 py-0.5 text-[13px] tracking-[.08em]"
          style={report.active ? { color: "#9fc7a4", borderColor: "#3f6b48" } : { color: "#b9a888", borderColor: "#6f5423" }}
        >
          {report.active ? "Actif" : "En pause"}
        </button>''','''        <span
          className="sc border px-2.5 py-0.5 text-[13px] tracking-[.08em]"
          style={report.active ? { color: "#9fc7a4", borderColor: "#3f6b48" } : { color: "#b9a888", borderColor: "#6f5423" }}
        >
          {report.active ? "Actif" : "En pause"}
        </span>''')
# status field in menu
rep('''          <Field label="Nom">''','''          <Field label="Statut">
            <div className="flex" role="radiogroup" aria-label="Statut">
              {[
                [true, "Actif"],
                [false, "En pause"],
              ].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={report.active === value}
                  onClick={() => update({ active: value })}
                  className={`sc h-10 w-[110px] cursor-pointer border text-[13px] tracking-[.1em] ${
                    report.active === value
                      ? value
                        ? "border-ok-line bg-[#0e1a10] text-ok"
                        : "border-gold bg-gold/15 text-cream"
                      : "border-line bg-transparent text-muted2 hover:text-cream"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Nom">''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
