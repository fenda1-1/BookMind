import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'diagnostics_channel',
  'dns', 'events', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'readline', 'stream', 'timers', 'tls', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);
const UI_OWNERS = new Set(['app', 'components', 'features', 'pages']);

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return SOURCE_EXTENSIONS.includes(extname(entry.name)) ? [path] : [];
  });
}

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const basePath = resolve(dirname(fromFile), specifier);
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => resolve(basePath, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function ownerFor(sourceRoot, filePath) {
  return filePath.slice(sourceRoot.length + 1).replaceAll('\\', '/').split('/')[0];
}

function importDeclarations(sourceFile) {
  const imports = [];
  sourceFile.forEachChild((node) => {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;
    imports.push({ node, specifier: node.moduleSpecifier.text });
  });
  return imports;
}

function importsInvokeFromTauri(node) {
  if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings)) return false;
  return node.importClause.namedBindings.elements.some((element) => (element.propertyName?.text ?? element.name.text) === 'invoke');
}

function isReactUiModule(filePath) {
  const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.ESNext, true);
  let hasReactImport = false;
  let hasJsx = false;
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react') hasReactImport = true;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) hasJsx = true;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return hasReactImport || hasJsx;
}

export function evaluateModuleOwnership(sourceRoot) {
  const violations = [];
  for (const filePath of listSourceFiles(sourceRoot)) {
    const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.ESNext, true);
    const owner = ownerFor(sourceRoot, filePath);
    for (const { node, specifier } of importDeclarations(sourceFile)) {
      const targetPath = resolveRelativeImport(filePath, specifier);
      const targetOwner = targetPath ? ownerFor(sourceRoot, targetPath) : null;
      if (owner === 'services' && targetOwner && UI_OWNERS.has(targetOwner) && isReactUiModule(targetPath)) {
        violations.push({ code: 'service-imports-ui', filePath, specifier });
      }
      if (owner === 'services' && specifier === 'react') {
        violations.push({ code: 'service-imports-react', filePath, specifier });
      }
      if (UI_OWNERS.has(owner) && importsInvokeFromTauri(node) && specifier === '@tauri-apps/api/core') {
        violations.push({ code: 'ui-imports-tauri-invoke', filePath, specifier });
      }
      const bareSpecifier = specifier.replace(/^node:/u, '');
      if (UI_OWNERS.has(owner) && (NODE_BUILTINS.has(bareSpecifier) || specifier.includes('src-tauri'))) {
        violations.push({ code: 'ui-imports-backend-runtime', filePath, specifier });
      }
    }
  }
  return violations;
}
