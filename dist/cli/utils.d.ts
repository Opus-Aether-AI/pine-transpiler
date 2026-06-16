import { ParsedArgs } from './types';
/**
 * Read version from package.json
 */
export declare function getVersion(): string;
/**
 * Generate help text
 */
export declare function getHelpText(): string;
/**
 * Parse command-line arguments
 */
export declare function parseArguments(): ParsedArgs;
/**
 * Read input file content
 */
export declare function readInput(filePath: string): string;
/**
 * Write output to file or stdout
 */
export declare function writeOutput(content: string, outputPath?: string): void;
/**
 * Derive indicator ID from file path
 */
export declare function deriveIndicatorId(filePath: string): string;
//# sourceMappingURL=utils.d.ts.map