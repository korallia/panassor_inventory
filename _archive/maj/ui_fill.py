import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''    <div className="mx-auto flex w-full max-w-[84px] flex-col bg-track" style={{ height }}>''','''    <div className="mx-auto flex w-full max-w-[84px] flex-1 flex-col bg-track" style={{ minHeight: height }}>''')
rep('''    <div className="flex min-w-0 flex-col items-center gap-3 text-center">''','''    <div className="flex h-full min-w-0 flex-col items-center gap-3 text-center">''')
rep('''      <div className="grid auto-cols-fr grid-flow-col gap-3">{children}</div>''','''      <div className="grid flex-1 auto-cols-fr grid-flow-col gap-3">{children}</div>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
