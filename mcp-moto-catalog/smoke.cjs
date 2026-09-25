// Smoke: initialize + tools/list + list_models(yamaha) via protocolo MCP.
const { spawn } = require('child_process');
const p = spawn(process.execPath, ['index.js'], { cwd: __dirname });
let buf = '';
const send = o => p.stdin.write(JSON.stringify(o) + '\n');
p.stdout.on('data', d => {
  buf += d.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const l of lines) {
    if (!l.trim()) continue;
    const m = JSON.parse(l);
    if (m.id === 1) {
      console.log('HELLO:' + m.result.serverInfo.name + ' v' + m.result.serverInfo.version);
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    } else if (m.id === 2) {
      console.log('TOOLS:' + m.result.tools.map(t => t.name).join(','));
      send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_models', arguments: { brand: 'yamaha' } } });
    } else if (m.id === 3) {
      if (m.error) { console.log('ERR:' + JSON.stringify(m.error).slice(0, 300)); p.kill(); process.exit(1); }
      const cards = JSON.parse(m.result.content[0].text);
      console.log('YAMAHA CARDS:' + cards.length);
      console.log(cards.slice(0, 3).map(c => c.slug).join(' ; '));
      console.log(cards.length > 10 ? 'SMOKE OK' : 'SMOKE FALHOU');
      p.kill(); process.exit(cards.length > 10 ? 0 : 1);
    }
  }
});
p.stderr.on('data', d => process.stderr.write('[srv] ' + d));
setTimeout(() => { console.log('TIMEOUT'); p.kill(); process.exit(1); }, 300000);
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } } });
