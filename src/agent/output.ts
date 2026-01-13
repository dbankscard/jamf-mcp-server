/**
 * Agent CLI Output Utilities
 *
 * Provides structured output methods for agent CLI tools.
 * This separates intentional CLI user output from debug/server logging.
 *
 * Note: CLI tools require stdout output for user interaction.
 * This is different from server/MCP code which must not write to stdout.
 */

/**
 * Print a message to stdout for CLI user output
 */
export function print(message: string): void {
  process.stdout.write(message + '\n');
}

/**
 * Print an error message to stderr for CLI error output
 */
export function printError(message: string): void {
  process.stderr.write(message + '\n');
}

/**
 * Print a warning message to stderr for CLI warnings
 */
export function printWarn(message: string): void {
  process.stderr.write(message + '\n');
}
