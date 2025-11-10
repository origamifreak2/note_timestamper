import fs from "fs";
import path from "path";

const from = "node_modules/@fortawesome/fontawesome-free";
const to = "static/fa"; // new folder in your app

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(to, { recursive: true });
for (const dir of ["css", "webfonts"]) {
  fs.cpSync(path.join(from, dir), path.join(to, dir), { recursive: true });
}
console.log("Font Awesome copied to static/fa");
