import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:90]; s=s.replace(a,b)
rep('''  const groups = visibleCollections.map((collection) => ({
    collection,
    kits: kitRows.filter((row) => row.kit.collectionId === collection.id && matches(row.kit.name)),
    rows: rows.filter((row) => row.product.collectionId === collection.id && matches(row.name)).sort(SORTS[sort].fn),
  }));''','''  // Tri par nom : on garde les collections, le kit sert de séparateur.
  // Les autres tris sont globaux : une seule liste, toutes collections mêlées.
  const grouped = sort === "nom";
  const collectionNames = Object.fromEntries(collections.map((c) => [c.id, c.name]));
  const groups = grouped
    ? visibleCollections.map((collection) => ({
        collection,
        kits: kitRows.filter((row) => row.kit.collectionId === collection.id && matches(row.kit.name)),
        rows: rows.filter((row) => row.product.collectionId === collection.id && matches(row.name)).sort(SORTS[sort].fn),
      }))
    : [
        {
          collection: { id: "global" },
          kits: [],
          rows: rows
            .filter((row) => visibleCollections.some((c) => c.id === row.product.collectionId) && matches(row.name))
            .sort(SORTS[sort].fn),
          collectionNames,
        },
      ];''')
# pass collectionNames down
rep('''              <GroupRows key={collection.id} collection={collection} kits={kits} rows={rows} />''','''              <GroupRows key={collection.id} collection={collection} kits={kits} rows={rows} collectionNames={collectionNames} />''')
rep('''          {groups.map(({ collection, kits, rows }) =>
            kits.length === 0 && rows.length === 0 ? null : (
              <GroupRows''','''          {groups.map(({ collection, kits, rows, collectionNames }) =>
            kits.length === 0 && rows.length === 0 ? null : (
              <GroupRows''')
rep('''function GroupRows({ collection, kits, rows }) {''','''function GroupRows({ collection, kits, rows, collectionNames }) {''')
rep('''              <Link to={`/produits/${row.product.id}`} className="text-parch!">
                {row.name}
              </Link>
            </td>''','''              <Link to={`/produits/${row.product.id}`} className="text-parch!">
                {row.name}
              </Link>
              {collectionNames && <div className="text-[13px] text-faint">{collectionNames[row.product.collectionId]}</div>}
            </td>''')
rep('''                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[20px] text-cream">{row.name}</span>''','''                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[20px] text-cream">
                        {row.name}
                        {collectionNames && <span className="block text-[13px] text-faint">{collectionNames[row.product.collectionId]}</span>}
                      </span>''')
rep('''      {groups.map(({ collection, kits, rows }) =>
        kits.length === 0 && rows.length === 0 ? null : (
          <section''','''      {groups.map(({ collection, kits, rows, collectionNames }) =>
        kits.length === 0 && rows.length === 0 ? null : (
          <section''')
open(p,'w',newline='').write(s.replace('\n',nl))
print('ok')
