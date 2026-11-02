// Dumb TCP relay: workerd's fetch to a workerd-served port dies in this sandbox ("Network
// connection lost"), while workerd->node and node->workerd both work. Relay bridges them so the
// rollout check still exercises real banking code + real identity code over real HTTP.
import { createServer, createConnection } from 'node:net';
const [,, listen, target] = process.argv;
createServer((client) => {
  const upstream = createConnection(Number(target), '127.0.0.1');
  client.pipe(upstream).pipe(client);
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
}).listen(Number(listen), '127.0.0.1', () => console.log(`relay :${listen} -> :${target}`));
