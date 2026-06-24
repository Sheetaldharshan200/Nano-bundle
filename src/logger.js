export class Logger {
  constructor({ verbose = false, quiet = false } = {}) {
    this.verbose = verbose;
    this.quiet = quiet;
  }

  info(message = "") {
    if (!this.quiet) console.log(message);
  }

  step(message) {
    this.info(`> ${message}`);
  }

  debug(message) {
    if (this.verbose && !this.quiet) console.log(`[debug] ${message}`);
  }

  warn(message) {
    if (!this.quiet) console.warn(`Warning: ${message}`);
  }

  error(message) {
    console.error(message);
  }
}
