/**
 * Graceful shutdown manager
 * Handles cleanup of resources and graceful termination
 */

import { createLogger } from '../server/logger.js';

const logger = createLogger('shutdown-manager');

export interface ShutdownHandler {
  name: string;
  priority: number; // Lower numbers run first
  handler: () => Promise<void> | void;
  timeout?: number; // Timeout in milliseconds
}

export class ShutdownManager {
  private static instance: ShutdownManager;
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  private constructor() {
    // Register signal handlers
    this.registerSignalHandlers();
  }

  static getInstance(): ShutdownManager {
    if (!ShutdownManager.instance) {
      ShutdownManager.instance = new ShutdownManager();
    }
    return ShutdownManager.instance;
  }

  /**
   * Register a shutdown handler
   */
  register(handler: ShutdownHandler): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot register handler during shutdown', { name: handler.name });
      return;
    }

    this.handlers.push(handler);
    this.handlers.sort((a, b) => a.priority - b.priority);
    
    logger.debug('Registered shutdown handler', { 
      name: handler.name, 
      priority: handler.priority,
      totalHandlers: this.handlers.length 
    });
  }

  /**
   * Unregister a shutdown handler
   */
  unregister(name: string): void {
    const index = this.handlers.findIndex(h => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
      logger.debug('Unregistered shutdown handler', { name });
    }
  }

  /**
   * Execute graceful shutdown
   */
  async shutdown(reason: string = 'Unknown', exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      logger.info('Shutdown already in progress');
      return this.shutdownPromise!;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown', { reason, exitCode });

    this.shutdownPromise = this.executeShutdown(exitCode);
    return this.shutdownPromise;
  }

  /**
   * Execute all shutdown handlers
   */
  private async executeShutdown(exitCode: number): Promise<void> {
    const startTime = Date.now();
    const results: { name: string; success: boolean; error?: string }[] = [];

    // Execute handlers in priority order
    for (const handler of this.handlers) {
      try {
        logger.info(`Executing shutdown handler: ${handler.name}`);
        
        // Create timeout promise if specified
        const timeoutPromise = handler.timeout
          ? new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), handler.timeout)
            )
          : null;

        // Execute handler with optional timeout
        const handlerPromise = Promise.resolve(handler.handler());
        
        if (timeoutPromise) {
          await Promise.race([handlerPromise, timeoutPromise]);
        } else {
          await handlerPromise;
        }

        results.push({ name: handler.name, success: true });
        logger.info(`Shutdown handler completed: ${handler.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ name: handler.name, success: false, error: errorMessage });
        logger.error(`Shutdown handler failed: ${handler.name}`, { error: errorMessage });
        
        // Continue with other handlers even if one fails
      }
    }

    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('Graceful shutdown completed', {
      duration,
      successful,
      failed,
      totalHandlers: results.length
    });

    // Exit process
    process.exit(exitCode);
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal} signal`);
        await this.shutdown(`Received ${signal} signal`);
      });
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error: Error) => {
      logger.error('Uncaught exception', { 
        error: error.message, 
        stack: error.stack 
      });
      await this.shutdown('Uncaught exception', 1);
    });

    process.on('unhandledRejection', async (reason: any) => {
      logger.error('Unhandled rejection', { 
        reason: reason instanceof Error ? reason.message : String(reason) 
      });
      await this.shutdown('Unhandled rejection', 1);
    });
  }

  /**
   * Get shutdown status
   */
  getStatus(): { isShuttingDown: boolean; handlersCount: number } {
    return {
      isShuttingDown: this.isShuttingDown,
      handlersCount: this.handlers.length
    };
  }
}

/**
 * Convenience function to register a shutdown handler
 */
export function registerShutdownHandler(
  name: string,
  handler: () => Promise<void> | void,
  priority: number = 50,
  timeout?: number
): void {
  const manager = ShutdownManager.getInstance();
  manager.register({ name, handler, priority, timeout });
}

/**
 * Convenience function to trigger shutdown
 */
export async function gracefulShutdown(
  reason: string = 'Manual shutdown',
  exitCode: number = 0
): Promise<void> {
  const manager = ShutdownManager.getInstance();
  await manager.shutdown(reason, exitCode);
}

/**
 * Register common cleanup handlers
 */
export function registerCommonHandlers(): void {
  // Close active handles
  registerShutdownHandler(
    'close-handles',
    async () => {
      // Allow some time for connections to close gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
    },
    90,
    5000
  );

  // Log final message
  registerShutdownHandler(
    'final-log',
    () => {
      logger.info('Shutdown complete. Goodbye!');
    },
    100
  );
}