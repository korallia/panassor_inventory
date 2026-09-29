import sys,re
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
# extract blocks
i=s.index('      <DetailLayout\n'); j=s.index('      </DetailLayout>\n')+len('      </DetailLayout>\n')
block=s[i:j]
e0=block.index('        {/* Étuis */}'); e1=block.index('        {/* Composants */}')
etuis=block[e0:e1].rstrip()+'\n'
c0=e1; c1=block.index('      </DetailLayout>')
comps=block[c0:c1]
comps=comps.replace('<section className="flex flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">','<section className="flex h-full flex-col gap-2 border border-line/50 bg-panel/60 px-6 py-5">',1)
new='''      <div className="grid w-full items-stretch justify-center gap-8 lg:grid-cols-[minmax(0,620px)_minmax(0,480px)] lg:gap-12">
        <div className="order-2 min-w-0 lg:order-1">
'''+comps+'''        </div>
        <div className="order-1 flex flex-col gap-8 lg:order-2">
          <GaugePanel>
            <GaugeColumn label="Kits prêts" note={`sur ${target} étuis · minimum ${kit.min}`} have={ready} need={target} unit="kits" />
          </GaugePanel>
'''+etuis+'''        </div>
      </div>
'''
s=s[:i]+new+s[j:]
s=s.replace('  DetailLayout,\n','')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
