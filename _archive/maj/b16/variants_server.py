import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''      SELECT pcv.product_id, pcv.square_variation_id, c.name_fr AS color, c.hex_code''','''      SELECT pcv.product_id, pcv.square_variation_id, pcv.price_delta_cents, c.name_fr AS color, c.hex_code''')
rep('''    images: (imagesByProduct[p.id] || []).map((img) => ({ url: img.url, altFr: img.alt_fr || "", altEn: img.alt_en || "", main: img.is_main })),''','''    images: (imagesByProduct[p.id] || []).map((img) => ({ url: img.url, altFr: img.alt_fr || "", altEn: img.alt_en || "", main: img.is_main })),
    // Sous-produits : variantes de couleur (table product_color_variants), avec écart de prix et stock Square.
    variants: (variantsByProduct[p.id] || []).map((v) => ({
      color: v.color,
      swatch: v.hex_code || "#2a180c",
      priceDelta: Number(v.price_delta_cents || 0) / 100,
      stock: v.square_variation_id ? counts[v.square_variation_id] || 0 : null,
    })),''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
