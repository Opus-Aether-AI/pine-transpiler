import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDrawingFn,
  getDrawingNamespace,
  getInputFn,
  listDrawingConstants,
  listDrawingFunctionNames,
  listDrawingNamespaceNames,
  listInputFunctionNames,
} from './index';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SUPPORTED_SURFACE_DOC_PATH = join(
  ROOT_DIR,
  'docs',
  'supported-pine-surface.md',
);

function formatSignature(name: string, args: readonly string[]): string {
  return `\`${name}(${args.join(', ')})\``;
}

function renderDrawingNamespaceSection(namespaceName: string): string[] {
  const namespace = getDrawingNamespace(namespaceName);
  if (!namespace) {
    throw new Error(
      `Missing drawing namespace registry entry for "${namespaceName}"`,
    );
  }

  const lines = [`### \`${namespace.name}\``, '', 'Functions:'];

  for (const fnName of listDrawingFunctionNames(namespace.name)) {
    const fn = getDrawingFn(namespace.name, fnName);
    if (!fn) {
      throw new Error(
        `Missing drawing function registry entry for "${namespace.name}.${fnName}"`,
      );
    }
    lines.push(
      `- ${formatSignature(`${namespace.name}.${fnName}`, fn.canonicalArgs)}`,
    );
  }

  lines.push('', 'Constants:');

  const constants = listDrawingConstants(namespace.name);
  if (constants.length === 0) {
    lines.push('- None.');
  } else {
    for (const constant of constants) {
      lines.push(
        `- \`${namespace.name}.${constant.name}\` = \`${String(constant.value)}\``,
      );
    }
  }

  lines.push('');
  return lines;
}

export function renderSupportedSurfaceDoc(): string {
  const lines = [
    '# Supported Pine Surface',
    '',
    'Generated from `src/registry/` by `bun run docs:surface`. Do not edit by hand.',
    '',
    '## Drawing Namespaces',
    '',
  ];

  for (const namespaceName of listDrawingNamespaceNames()) {
    lines.push(...renderDrawingNamespaceSection(namespaceName));
  }

  lines.push('## `input.*` Functions', '', 'Supported input helpers:');

  for (const inputName of listInputFunctionNames()) {
    const inputFn = getInputFn(inputName);
    if (!inputFn) {
      throw new Error(`Missing input registry entry for "${inputName}"`);
    }
    lines.push(`- ${formatSignature(inputName, inputFn.canonicalArgs)}`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function writeSupportedSurfaceDoc(): {
  changed: boolean;
  content: string;
  path: string;
} {
  const content = renderSupportedSurfaceDoc();
  const previous = existsSync(SUPPORTED_SURFACE_DOC_PATH)
    ? readFileSync(SUPPORTED_SURFACE_DOC_PATH, 'utf8')
    : null;

  writeFileSync(SUPPORTED_SURFACE_DOC_PATH, content, 'utf8');

  return {
    changed: previous !== content,
    content,
    path: SUPPORTED_SURFACE_DOC_PATH,
  };
}
