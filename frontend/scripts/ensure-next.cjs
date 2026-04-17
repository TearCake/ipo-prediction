const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
const packageJsonPath = path.join(cwd, "package.json");

function fail(message) {
  console.error("\n[preflight] " + message + "\n");
  process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) {
  fail(
    "No package.json found in the current directory. Run commands from c:\\ml\\New folder\\frontend."
  );
}

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
} catch (error) {
  fail("Unable to parse package.json.");
}

const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
if (!deps.next) {
  fail("The project does not declare the next package in dependencies.");
}

try {
  require.resolve("next/package.json", { paths: [cwd] });
} catch (error) {
  fail(
    "next is not installed for this project. Run: npm install (from c:\\ml\\New folder\\frontend)."
  );
}

process.stdout.write("[preflight] Next.js resolution OK\n");