import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parse, printSchema } from "graphql";
import { federateSubgraphs as federateFromIndex } from "@wundergraph/composition";

// Try to import the v2 surface explicitly with fall back to the top-level export.
let federateFromV2;
try {
  const mod = await import("@wundergraph/composition/dist/federation/federation.js");
  federateFromV2 = mod.federateSubgraphs;
} catch {
}

const federateSubgraphs = federateFromV2 ?? federateFromIndex;
const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
const configPath = path.resolve(workspace, "supergraph-config.yaml");

const cfg = yaml.load(readFileSync(configPath, "utf8"));
if (!cfg?.subgraphs || !Array.isArray(cfg.subgraphs) || cfg.subgraphs.length === 0) {
  console.error("No subgraphs found in", configPath);
  process.exit(1);
}

const subgraphs = cfg.subgraphs.map((sg) => {
  const sdlPath = path.resolve(path.dirname(configPath), sg.schema.file);
  const sdl = readFileSync(sdlPath, "utf8");
  return {
    name: sg.name,
    url: sg.routing_url,
    definitions: parse(sdl),
  };
});

console.log("subgraphs are", subgraphs.map(s => ({ name: s.name, url: s.url })));

function composeWithCompatibility() {
  // Support two signatures
  // federateSubgraphs(subgraphsArray)
  // federateSubgraphs({ subgraphs, ...options })
  try {
    // Try the subgraph array signature first
    // https://cosmo-docs.wundergraph.com/tutorial/composing-graphs
    // https://www.npmjs.com/package/@wundergraph/composition
    const r = federateSubgraphs(subgraphs);
    return r;
  } catch (e) {
    return federateSubgraphs({ subgraphs });
  }
}

const result = composeWithCompatibility();

// --- Handle both result shapes:
// Legacy: { errors?: Error[], federatedGraphSchema?: GraphQLSchema }
// Newer: { success: boolean, errors?: Error[], federatedGraphSchema?: GraphQLSchema }
const errors = result?.errors ?? (result?.success === false ? result.errors : undefined);
const schema = result?.federatedGraphSchema;

if (errors?.length) {
  console.error("Composition errors:");
  for (const err of errors) console.error("-", err?.message ?? String(err));
  process.exit(1);
}

if (!schema) {
  console.error("Composition did not return a federatedGraphSchema.");
  console.error("Raw result keys:", Object.keys(result || {}));
  process.exit(1);
}

const outPath = path.resolve(path.dirname(configPath), "charts/graph/files/supergraph.graphql");
writeFileSync(outPath, printSchema(schema), "utf8");
console.log("Wrote supergraph schema to:", outPath);
