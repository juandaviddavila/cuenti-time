import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve as resolvePath } from "node:path";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(pathToFileURL(`${root}/package.json`).href);
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/") || (specifier.startsWith(".") && context.parentURL?.endsWith(".ts"))) {
    const base = specifier.startsWith("@/") ? `${root}/src/${specifier.slice(2)}` : resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") || specifier.startsWith("node:") || specifier.startsWith("file:")) throw error;
    return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
  }
}
