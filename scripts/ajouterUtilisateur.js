// Prépare l'ajout (ou le changement de mot de passe) d'un utilisateur de
// l'atelier. Le mot de passe est demandé deux fois (une étoile par
// caractère), puis le script imprime une ligne SQL à coller dans l'éditeur
// SQL (Neon ou pgAdmin). Le mot de passe n'est jamais écrit en clair :
// seule son empreinte sort de ton ordi.
//
// Usage : node scripts/ajouterUtilisateur.js courriel@exemple.com
import { hashPassword } from "../server/passwords.js";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage : node scripts/ajouterUtilisateur.js courriel@exemple.com");
  process.exit(1);
}

// Lit une ligne au clavier en affichant une étoile par caractère.
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let answer = "";

    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          return resolve(answer);
        }
        if (char === "\u0003") {
          // Ctrl+C
          process.stdout.write("\n");
          process.exit(1);
        }
        if (char === "\u007f" || char === "\b") {
          if (answer.length) {
            answer = answer.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        answer += char;
        process.stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

const password = await askHidden(`Mot de passe pour ${email} (12 caractères minimum) : `);
if (password.length < 12) {
  console.error("Trop court : 12 caractères minimum.");
  process.exit(1);
}

const confirm = await askHidden("Encore une fois : ");
if (confirm !== password) {
  console.error("Les deux mots de passe ne sont pas pareils.");
  process.exit(1);
}

const hash = hashPassword(password);
console.log("\nColle cette ligne dans l'éditeur SQL (Neon ou pgAdmin), puis lance-la :\n");
console.log(
  `INSERT INTO atelier_users (email, password_hash) VALUES ('${email}', '${hash}')\n` +
    `ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true;`
);
process.exit(0);
