import sys
p=sys.argv[1]; s=open(p,newline='').read()
nl='\r\n' if '\r\n' in s else '\n'; s=s.replace('\r\n','\n')
def rep(a,b):
    global s
    assert s.count(a)==1,a[:70]; s=s.replace(a,b)
rep('''    readOnly(`SELECT product_id, url, alt_fr, alt_en, is_main, sort_order FROM product_images ORDER BY product_id, sort_order`),''','''    readOnly(`
      SELECT pi.product_id, pi.url, pi.alt_fr, pi.alt_en, pi.is_main, pi.sort_order, c.name_fr AS color
      FROM product_images pi LEFT JOIN colors c ON c.id = pi.color_id
      ORDER BY pi.product_id, pi.sort_order`),''')
rep('''    images: (imagesByProduct[p.id] || []).map((img) => ({ url: img.url, altFr: img.alt_fr || "", altEn: img.alt_en || "", main: img.is_main })),''','''    images: (imagesByProduct[p.id] || []).map((img) => ({
      url: img.url,
      altFr: img.alt_fr || "",
      altEn: img.alt_en || "",
      main: img.is_main,
      color: img.color || null, // photo propre à une variante de couleur (product_images.color_id)
    })),''')
open(p,'w',newline='').write(s.replace('\n',nl)); print('ok')
