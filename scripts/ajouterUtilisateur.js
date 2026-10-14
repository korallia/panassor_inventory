// Prépare l'ajout (ou le changement de mot de passe) d'un utilisateur de
// l'atelier. Le mot de passe est demandé sans s'afficher, puis le script
// imprime une ligne SQL à coller dans pgAdmin (base du site). Le mot de
// passe n'est jamais écrit nulle part en clair.
//
// Usage : node scripts/ajouterUtilisateur.js courriel@exemple.com
import readline from "node:readline";

import { hashPassword } from "../server/passwords.js";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage : node scripts/ajouterUtilisateur.js courriel@exemple.com");
  process.exit(1);
}

// Une seule interface pour les deux questions ; ce qu'on tape ne s'affiche pas.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let hidden = false;
rl._writeToOutput = (text) => {
  if (!hidden) process.stdout.write(text);
};

function askHidden(question) {
  return new Promise((resolve) => {
    hidden = false;
    process.stdout.write(question);
    hidden = true;
    rl.question("", (answer) => {
      hidden = false;
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askHidden(`Mot de passe pour ${email} (12 caractères minimum) : `);
if (password.length < 12) {
  rl.close();
  console.error("Trop court : 12 caractères minimum.");
  process.exit(1);
}
const confirm = await askHidden("Encore une fois : ");
rl.close();
if (confirm !== password) {
  console.error("Les deux mots de passe ne sont pas pareils.");
  process.exit(1);
}

const hash = hashPassword(password);
console.log("\nColle cette ligne dans pgAdmin (Query Tool sur la base du site), puis F5 :\n");
console.log(
  `INSERT INTO atelier_users (email, password_hash) VALUES ('${email}', '${hash}')\n` +
    `ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true;`
);
