import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
a='''            <GaugeColumn label="Kits prêts" note="sur le total des étuis" have={ready} need={target} unit="kits" />
            <GaugeColumn label="Minimum" note="kits prêts à garder" have={ready} need={kit.min} unit="kits" />'''
assert s.count(a)==1
s=s.replace(a,'''            <GaugeColumn label="Kits prêts" note={`sur ${target} étuis · minimum ${kit.min}`} have={ready} need={target} unit="kits" />''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
