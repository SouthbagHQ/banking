// Minimal stand-in for 'cloudflare:workers' so worker.js can load under node:test.
export class WorkerEntrypoint {
  constructor(...args) { Object.assign(this, ...args.filter(a => a && typeof a === 'object')); }
}
