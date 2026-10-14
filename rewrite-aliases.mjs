import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDirectory = fileURLToPath(new URL('./dist/', import.meta.url));
const aliasTargets = {
  '#auth': 'modules/auth/index.js',
  '#common': 'common/index.js',
  '#database': 'database/index.js',
  '#email': 'modules/email/index.js',
  '#modules': 'modules/index.js',
  '#workers': 'workers/index.js',
};

async function rewriteDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteDirectory(entryPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const source = await readFile(entryPath, 'utf8');
    const rewritten = source.replace(/\b(from\s*|import\s*)['"](#(?:auth|common|database|email|modules|workers))['"]/g,
      (match, importKind, alias) => {
        const targetPath = path.join(distDirectory, aliasTargets[alias]);
        let relativePath = path.relative(path.dirname(entryPath), targetPath).replaceAll(path.sep, '/');
        if (!relativePath.startsWith('.')) relativePath = `./${relativePath}`;
        return `${importKind}'${relativePath}'`;
      });

    if (rewritten !== source) await writeFile(entryPath, rewritten);
  }
}

await rewriteDirectory(distDirectory);
