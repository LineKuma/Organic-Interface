/**
 * @organic/ui - UI module
 */

export {
  createLogger,
  type Logger,
  type LogLevel,
} from '@organic/utils';

/**
 * CLI interface
 */
export class CLI {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('cli');
  }

  async run(args: string[]): Promise<void> {
    this.logger.info(`CLI running with args: ${args.join(' ')}`);
  }
}
