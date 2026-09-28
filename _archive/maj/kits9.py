import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
# remove footer from GaugePanel
i=s.index('          <GaugePanel\n            footer={')
j=s.index('          >\n',i)+len('          >\n')
s=s[:i]+'          <GaugePanel>\n'+s[j:]
# add étuis inside left section before its closing
k=s.index('{plural(fromTools, "kit faisable", "kits faisables")} avec ces pièces</span>')
end=s.index('          </div>\n',k)+len('          </div>\n')
etuis='''
          <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-gold/60 pt-5">
            <div className="sc text-[16px] tracking-[.16em] text-gold">Étuis de cuir</div>
            <div className="text-[15px] text-faint">fixent les kits visés</div>
          </div>
          {kit.leather.map((leather) => (
            <div key={leather.color} className="flex items-center justify-between gap-4 border-t border-line/35 py-3">
              <span className="flex items-center gap-3">
                <span className="h-7 w-7 shrink-0 border border-line" style={{ background: leather.swatch }} />
                <span className="text-[19px] text-cream">{leather.color}</span>
              </span>
              <Stepper
                small
                label={`Étuis ${leather.color}`}
                value={leather.stock}
                onChange={(value) => dispatch({ type: "setLeather", kitId: kit.id, color: leather.color, value })}
              />
            </div>
          ))}
          <div className="flex w-fit flex-wrap items-baseline gap-x-3 gap-y-1 border border-gold bg-panel2 px-4 py-2.5">
            <span className="text-[30px] leading-none text-cream">{target}</span>
            <span className="text-[17px] text-muted">{plural(target, "étui", "étuis")} · kits visés</span>
          </div>
'''
s=s[:end]+etuis+s[end:]
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
