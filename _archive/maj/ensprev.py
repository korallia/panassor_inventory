import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
a='''                      })}
                  </div>
                </div>
              ))}
            </div>
          </PreviewBlock>'''
assert s.count(a)==1
s=s.replace(a,'''                      })}
                    {products
                      .filter((p) => p.collectionId === c.id && p.type === "ensemble")
                      .map((p) => {
                        const st = ensembleState(p, productsById, reserved);
                        const low = st.possible < st.objective;
                        return (
                          <div key={p.id} className="flex justify-between border-t border-line/30 py-1.5 text-[16px]">
                            <span className="text-muted">
                              {p.name} <span className="text-[13px] text-faint">ensemble</span>
                            </span>
                            <span className={low ? "text-alert-soft" : "text-cream"}>{st.possible}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </PreviewBlock>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
