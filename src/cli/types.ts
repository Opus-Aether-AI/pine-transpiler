/**
 * CLI Types
 *
 * Type definitions for CLI options and configuration.
 */

/**
 * CLI options parsed from command-line arguments
 */
export interface CLIOptions {
  /** Output file path */
  output?: string;
  /** Output format: 'js' or 'pinejs' */
  format?: string;
  /** Indicator name (for pinejs format) */
  name?: string;
  /** Indicator ID (for pinejs format) */
  id?: string;
  /** Show help message */
  help?: boolean;
  /** Show version number */
  version?: boolean;
}

/**
 * Parsed CLI arguments
 */
export interface ParsedArgs {
  /** Command to execute */
  command: string;
  /** Input file path */
  file?: string;
  /** CLI options */
  options: CLIOptions;
}
