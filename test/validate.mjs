// validate.mjs — validates cordis.patch.yml parses and the dsh-mcp-client
// config is accepted (bundle patch form: - insert: [ ... ]).
//
// Run: node test/validate.mjs
// If your DSH profiles dir differs, set DSH_PROFILE_DIR before running.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PROFILE_DIR = process.env.DSH_PROFILE_DIR ?? "C:/Users/Admin/.dsh/profiles";
const NM = `${PROFILE_DIR}/node_modules`;

// js-yaml is CJS; anchor resolution to the profiles dir.
const require = createRequire(`${PROFILE_DIR}/_anchor.js`);
const yaml = require("js-yaml");

// dsh packages are ESM; import by absolute file URL.
const { entryListSchema } = await import(
  `file:///${NM}/@deepseek-ai/cordis-plugin-include/lib/index.js`
);
const { Config } = await import(
  `file:///${NM}/@deepseek-ai/dsh-mcp-client/lib/index.js`
);

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, "..", "cordis.patch.yml"), "utf8");
const patches = yaml.load(raw, { schema: entryListSchema });

let checked = 0;
for (const patch of patches) {
  for (const row of patch?.insert ?? []) {
    if (row.name !== "@deepseek-ai/dsh-mcp-client") continue;
    const config = { ...row.config };
    // Replace the !!js headers value with a literal for schema validation
    // (!!js is evaluated at mount time).
    if (config.headers) {
      config.headers = Object.fromEntries(
        Object.entries(config.headers).map(([k, v]) => [
          k,
          v && typeof v === "object" && "__jsExpr" in v ? "Bearer <token>" : v,
        ])
      );
    }
    const validated = Config(config);
    new URL(validated.url);
    console.log(
      `OK  ${row.id}  serverName=${validated.serverName}  transport=${validated.transport}  url=${validated.url}`
    );
    checked++;
  }
}

if (checked === 0) {
  console.error("未找到任何 @deepseek-ai/dsh-mcp-client 插件行");
  process.exit(1);
}
console.log(`validated ${checked} mcp-client row(s)`);
