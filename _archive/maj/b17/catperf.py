import sys,re
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
rep('import { useState } from "react";','import { memo, useCallback, useMemo, useState } from "react";')
# list: memoized grouping, stable toggle
rep('''      <div className="mx-auto flex w-full max-w-[1150px] flex-col border border-line/50 bg-panel/60">
        {collections.map((collection) => {
          const entries = catalog.filter((e) => e.collectionId === collection.id && matches(e));
          if (!entries.length) return null;
          const sorted = [...entries.filter((e) => e.isKit), ...entries.filter((e) => !e.isKit)];
          return sorted.map((entry) => (
            <CatalogRow
              key={entry.id}
              entry={entry}
              collectionName={collection.name}
              open={openId === entry.id}
              onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
            />
          ));
        })}
      </div>''','''      <div className="mx-auto flex w-full max-w-[1150px] flex-col border border-line/50 bg-panel/60">
        {groups.map(({ collection, entries }) =>
          entries.map((entry) => (
            <CatalogRow
              key={entry.id}
              entry={entry}
              collectionName={collection.name}
              open={openId === entry.id}
              onToggle={toggle}
              dispatch={dispatch}
              collections={collections}
              readOnly={readOnly}
            />
          ))
        )}
      </div>''')
rep('''  const needle = query.trim().toLowerCase();
  const matches = (e) => !needle || `${e.nameFr} ${e.nameEn}`.toLowerCase().includes(needle);
''','''  const needle = query.trim().toLowerCase();
  const toggle = useCallback((id) => setOpenId((current) => (current === id ? null : id)), []);
  const groups = useMemo(() => {
    const matches = (e) => !needle || `${e.nameFr} ${e.nameEn}`.toLowerCase().includes(needle);
    return collections
      .map((collection) => {
        const entries = catalog.filter((e) => e.collectionId === collection.id && matches(e));
        return { collection, entries: [...entries.filter((e) => e.isKit), ...entries.filter((e) => !e.isKit)] };
      })
      .filter((g) => g.entries.length);
  }, [catalog, collections, needle]);
''')
# row: memo, no context
rep('''function CatalogRow({ entry, collectionName, open, onToggle }) {
  const { dispatch, collections, readOnly } = useInventory();
  const update = (patch) => dispatch({ type: "updateCatalog", id: entry.id, patch });''','''// Ligne mémorisée : elle ne se redessine que si SON produit change (pas à chaque frappe ailleurs).
const CatalogRow = memo(function CatalogRow({ entry, collectionName, open, onToggle, dispatch, collections, readOnly }) {
  const update = useCallback((patch) => dispatch({ type: "updateCatalog", id: entry.id, patch }), [dispatch, entry.id]);''')
rep('''  const empty = ["nameEn", "titleFr", "titleEn", "descriptionFr", "descriptionEn"].filter((k) => !entry[k]).length + (entry.images.length ? 0 : 1);
''','')
rep('''        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}''','''        onClick={() => onToggle(entry.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(entry.id))}''')
rep('''        <div className="w-[120px] text-right text-[13px]">
          {empty > 0 ? <span className="text-warn">{empty} à remplir</span> : <span className="text-ok">Complet</span>}
        </div>
''','')
# close memo: find end of CatalogRow function (next "\n}\n" after its start)
i=s.index('const CatalogRow = memo(function CatalogRow(')
j=s.index('\n}\n',i)
s=s[:j]+'\n});\n'+s[j+3:]
# variants: remove stock column
rep('''      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_90px] items-center gap-x-4 px-1 text-[12px] tracking-[.14em] text-gold">''','''      <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-x-4 px-1 text-[12px] tracking-[.14em] text-gold">''')
rep('''        <span className="sc text-right">Stock</span>
''','')
rep('''        <div key={v.color} className="grid grid-cols-[minmax(0,1fr)_120px_120px_90px] items-center gap-x-4 border-t border-line/35 px-1 py-2.5">''','''        <div key={v.color} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-x-4 border-t border-line/35 px-1 py-2.5">''')
rep('''          <span className="text-right text-[17px] tabular-nums text-muted">{v.stock ?? "—"}</span>
''','')
# lazy images
s=s.replace('<img src={assetUrl(url)} alt="" className="h-full w-full object-cover"','<img src={assetUrl(url)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover"')
s=s.replace('<img key={url} src={assetUrl(url)} alt="" className="h-full w-full object-contain"','<img key={url} src={assetUrl(url)} alt="" decoding="async" className="h-full w-full object-contain"')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
