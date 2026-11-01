import * as S from "./src/data/sampleData.js";
import { computeInventory } from "./src/lib/inventory.js";
import { buildReportText, buildStockCsv, reportDate } from "./src/lib/rapport.js";
const d = { kits: S.kits ?? S.sampleKits, products: S.products ?? S.sampleProducts, collections: S.collections ?? S.sampleCollections, pendingOrders: [] };
const all={...d,...computeInventory(d)};
const t=buildReportText(all,{title:"Test"}); console.log(t.slice(t.indexOf("### Stock libre")));
const c=buildStockCsv(all); console.log(reportDate()); console.log(c.split("\r\n").slice(0,14).join("\n"));
