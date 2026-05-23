/**
 * Validate Command
 *
 * Handles the 'validate' CLI command for checking Pine Script syntax.
 */

import { canTranspilePineScript } from '../../index.js';
import type { CLIOptions } from '../types';
import { readInput } from '../utils';

/**
 * Execute the validate command
 */
export function commandValidate(
  file: string | undefined,
  _options: CLIOptions,
): void {
  if (!file) {
    process.stderr.write('Error: No input file specified\n');
    process.stderr.write('Usage: pine-transpiler validate <file>\n');
    process.exit(1);
  }

  const code = readInput(file);
  const result = canTranspilePineScript(code);

  if (result.valid) {
    process.stdout.write(`✓ ${file} is valid Pine Script\n`);
    process.exit(0);
  } else {
    process.stderr.write(`✗ ${file} has syntax errors:\n`);
    process.stderr.write(`  ${result.reason}\n`);
    process.exit(1);
  }
}
