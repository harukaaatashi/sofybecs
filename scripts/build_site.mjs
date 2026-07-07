import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";

const outDir = "_site";
const internalExport = process.env.INTERNAL_SITE_EXPORT === "1";
const allowedSources = new Set(["app_store", "google_play"]);

async function main() {
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/robots.txt`, "User-agent: *\nDisallow: /\n", "utf8");

  if (!internalExport) {
    await copyFile("web/internal-only.html", `${outDir}/index.html`);
    await writeFile(`${outDir}/items.json`, "[]\n", "utf8");
    return;
  }

  await copyFile("web/index.html", `${outDir}/index.html`);
  const raw = await readFile("data/items.json", "utf8");
  const items = JSON.parse(raw).filter(item => allowedSources.has(item.source));
  await writeFile(`${outDir}/items.json`, `${JSON.stringify(items, null, 1)}\n`, "utf8");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
