/**
 * CLI Utilities
 *
 * Shared utility functions for CLI commands.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { CLIOptions, ParsedArgs } from './types';

// Cache the version after first read
let cachedVersion: string | null = null;

/**
 * Read version from package.json
 */
export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(__dirname, '..', '..', 'package.json');
  let version = '0.1.3'; // fallback

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    version = pkg.version || version;
  } catch {
    // Use fallback version if package.json cannot be read
  }

  cachedVersion = version;
  return version;
}

/**
 * Generate help text
 */
export function getHelpText(): string {
  const VERSION = getVersion();
  return `
Pine Script Transpiler v${VERSION}

USAGE:
  pine-transpiler <command> [options] [file]

COMMANDS:
  transpile <file>   Transpile a Pine Script file to JavaScript
  validate <file>    Validate Pine Script syntax without transpiling
  info               Show supported features and mapping statistics

OPTIONS:
  -o, --output <file>   Output file path (default: stdout)
  -f, --format <type>   Output format: 'js' or 'pinejs' (default: js)
  -n, --name <name>     Indicator name (for pinejs format)
  -i, --id <id>         Indicator ID (for pinejs format, default: derived from filename)
  -h, --help            Show this help message
  -v, --version         Show version number

EXAMPLES:
  # Transpile to JavaScript (stdout)
  pine-transpiler transpile script.pine

  # Transpile to file
  pine-transpiler transpile script.pine -o output.js

  # Transpile to PineJS factory format
  pine-transpiler transpile script.pine -f pinejs -o indicator.js

  # Validate syntax
  pine-transpiler validate script.pine

  # Show supported features
  pine-transpiler info
`;
}

/**
 * Parse command-line arguments
 */
export function parseArguments(): ParsedArgs {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f', default: 'js' },
      name: { type: 'string', short: 'n' },
      id: { type: 'string', short: 'i' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const [command, file] = positionals;

  return {
    command: command || '',
    file,
    options: values as CLIOptions,
  };
}

/**
 * Read input file content
 */
export function readInput(filePath: string): string {
  const resolvedPath = resolve(filePath);
  if (!existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  return readFileSync(resolvedPath, 'utf-8');
}

/**
 * Write output to file or stdout
 */
export function writeOutput(content: string, outputPath?: string): void {
  if (outputPath) {
    writeFileSync(resolve(outputPath), content, 'utf-8');
    console.error(`Written to: ${outputPath}`);
  } else {
    console.log(content);
  }
}

/**
 * Derive indicator ID from file path
 */
export function deriveIndicatorId(filePath: string): string {
  const name = basename(filePath, '.pine');
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
