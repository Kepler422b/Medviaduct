import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const clientDir = path.join(dist, "client");
const prerenderDir = path.join(dist, "server", "prerendered-routes");

console.log("[build-static] 1. Running vinext build with --prerender-all...");
execSync("npx vinext build --prerender-all", { cwd: root, stdio: "inherit" });

console.log("[build-static] 2. Assembling production dist/ output for Vercel...");
if (fs.existsSync(clientDir)) {
  fs.cpSync(clientDir, dist, { recursive: true });
}

if (fs.existsSync(prerenderDir)) {
  fs.cpSync(prerenderDir, dist, { recursive: true });
  
  const files = fs.readdirSync(prerenderDir, { recursive: true });
  for (const file of files) {
    if (typeof file === "string" && file.endsWith(".html")) {
      const baseName = path.basename(file, ".html");
      const dirName = path.dirname(file);
      if (baseName !== "index") {
        const subDir = path.join(dist, dirName === "." ? baseName : path.join(dirName, baseName));
        fs.mkdirSync(subDir, { recursive: true });
        fs.copyFileSync(path.join(prerenderDir, file), path.join(subDir, "index.html"));
      }
    }
  }
}

if (fs.existsSync(path.join(dist, "index.html"))) {
  console.log("[build-static] SUCCESS: dist/index.html is ready for Vercel deployment!");
} else {
  console.error("[build-static] ERROR: dist/index.html was not found!");
  process.exit(1);
}
