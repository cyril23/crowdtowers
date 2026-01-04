/**
 * Timestamped logging helper for debugging connection/rejoin flow
 */

function log(prefix, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${prefix}`, ...args);
}

export { log };
