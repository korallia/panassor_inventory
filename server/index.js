// Serveur local de l'atelier : écoute seulement sur 127.0.0.1 (ton ordi).
// Les clés restent dans .env.atelier. Les routes sont dans server/app.js.
import { config } from "./config.js";
import app from "./app.js";

app.listen(config.port, "127.0.0.1", () => {
  console.log(`[atelier] serveur sur http://127.0.0.1:${config.port}`);
  console.log(`[atelier] base : ${config.databaseHost}`);
});
