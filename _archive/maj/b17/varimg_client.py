import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
i=s.index('function Images({ entry, update, readOnly }) {'); j=s.index('  return (',i)
s=s[:i]+'''function Images({ entry, update, readOnly }) {
  const [url, setUrl] = useState("");
  const variants = entry.variants || [];
  // Filtre : "all" = toutes, "general" = sans couleur, sinon le nom de la couleur.
  const [variant, setVariant] = useState("all");
  const all = entry.images.map((img, i) => ({ ...img, _i: i }));
  const images = variant === "all" ? all : all.filter((img) => (img.color || null) === (variant === "general" ? null : variant));
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((img) => img.main)));
  const count = images.length;
  const at = Math.max(0, Math.min(index, count - 1));
  const current = images[at];
  const clean = (list) => list.map(({ _i, ...img }) => img);
  const set = (next) => update({ images: clean(next) });
  const go = (step) => setIndex((i) => (count ? (i + step + count) % count : 0));
  const patchCurrent = (patch) => set(all.map((im) => (im._i === current._i ? { ...im, ...patch } : im)));
  const makeMain = () => set(all.map((im) => ({ ...im, main: im._i === current._i })));
  const pick = (value) => {
    setVariant(value);
    setIndex(0);
  };

  function add() {
    const link = url.trim();
    if (!link) return;
    const color = variant === "all" || variant === "general" ? null : variant;
    set([...all, { url: link, altFr: "", altEn: "", main: all.length === 0, color }]);
    setIndex(count);
    setUrl("");
  }

  function removeCurrent() {
    const rest = all.filter((im) => im._i !== current._i);
    if (current?.main && rest.length) rest[0] = { ...rest[0], main: true };
    set(rest);
    setIndex((i) => Math.max(0, i - 1));
  }

'''+s[j:]
rep('''                  <button type="button" className="btn-ghost" onClick={() => set(images.map((im, i) => ({ ...im, main: i === at })))}>''','''                  <button type="button" className="btn-ghost" onClick={makeMain}>''')
# chips under the title
rep('''      <ColumnTitle>
        Images {count > 0 && <span className="ml-2 text-faint">{at + 1} / {count}</span>}
      </ColumnTitle>
''','''      <ColumnTitle>
        Images {count > 0 && <span className="ml-2 text-faint">{at + 1} / {count}</span>}
      </ColumnTitle>
      {variants.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Images par variante">
          {[
            { value: "all", label: "Toutes", n: all.length },
            { value: "general", label: "Générales", n: all.filter((im) => !im.color).length },
            ...variants.map((v) => ({ value: v.color, label: v.color, swatch: v.swatch, n: all.filter((im) => im.color === v.color).length })),
          ].map((chip) => (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={variant === chip.value}
              onClick={() => pick(chip.value)}
              className={`flex cursor-pointer items-center gap-2 border px-3 py-1.5 text-[15px] ${
                variant === chip.value ? "border-gold bg-gold/15 text-cream" : "border-line bg-transparent text-muted2 hover:text-cream"
              }`}
            >
              {chip.swatch && <span className="inline-block h-3.5 w-3.5 border border-line" style={{ background: chip.swatch }} />}
              {chip.label}
              <span className="text-[13px] text-faint">{chip.n}</span>
            </button>
          ))}
        </div>
      )}
''')
rep('''              {current.main && (''','''              {current.color && (
                <span className="absolute top-2 right-2 border border-line bg-ink/80 px-2 py-0.5 text-[13px] text-cream">{current.color}</span>
              )}
              {current.main && (''')
# variant rows: small thumbnail of first image of that color, clickable to filter -> need access; keep simple thumbnail
rep('''          <span className="flex items-center gap-3">
            <span className="h-6 w-6 shrink-0 border border-line" style={{ background: v.swatch }} />
            <span className="text-[18px] text-cream">{v.color}</span>
          </span>''','''          <span className="flex items-center gap-3">
            <span className="h-6 w-6 shrink-0 border border-line" style={{ background: v.swatch }} />
            {(() => {
              const img = entry.images.find((im) => im.color === v.color && im.main) ?? entry.images.find((im) => im.color === v.color);
              return img ? <Thumb url={img.url} size={40} /> : null;
            })()}
            <span className="text-[18px] text-cream">{v.color}</span>
            <span className="text-[13px] text-faint">
              {entry.images.filter((im) => im.color === v.color).length} photo(s)
            </span>
          </span>''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
