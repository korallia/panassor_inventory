import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
e0=s.index('        {/* Étuis */}'); e1=s.index('        </section>\n',e0)+len('        </section>\n')
s=s[:e0]+s[e1:]
a='''          <GaugePanel>
            <GaugeColumn'''
assert s.count(a)==1
s=s.replace(a,'''          <GaugePanel
            footer={
              <div className="flex flex-col gap-2 border-t border-line/40 pt-4">
                <div className="sc text-center text-[15px] tracking-[.16em] text-gold">Étuis de cuir</div>
                {kit.leather.map((leather) => (
                  <div key={leather.color} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="h-6 w-6 shrink-0 border border-line" style={{ background: leather.swatch }} />
                      <span className="text-[18px] text-cream">{leather.color}</span>
                    </span>
                    <Stepper
                      small
                      label={`Étuis ${leather.color}`}
                      value={leather.stock}
                      onChange={(value) => dispatch({ type: "setLeather", kitId: kit.id, color: leather.color, value })}
                    />
                  </div>
                ))}
                <div className="flex items-baseline justify-between border-t border-line/40 pt-2">
                  <span className="text-[16px] text-gold-light">Total · kits visés</span>
                  <span className="w-[138px] text-center text-[24px] text-cream tabular-nums">{target}</span>
                </div>
              </div>
            }
          >
            <GaugeColumn''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
