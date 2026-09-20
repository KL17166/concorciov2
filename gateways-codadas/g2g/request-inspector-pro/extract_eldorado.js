const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const eldorado = data.filter(r => (r.url || '').toLowerCase().includes('eldorado.gg'));

console.log(`Eldorado requests count: ${eldorado.length}`);

eldorado.forEach((r, idx) => {
  console.log(`\n=== [#${idx+1}] ${r.method} ${r.statusCode || 'NO_STATUS'} | ${r.type} ===`);
  console.log(`URL: ${r.url}`);
  console.log(`Time: ${r.timestamp}`);
  if (r.requestHeaders) {
    console.log(`Req Headers:`, r.requestHeaders);
  }
  if (r.requestBody) {
    console.log(`Req Body:`, JSON.stringify(r.requestBody, null, 2));
  }
  if (r.responseHeaders) {
    console.log(`Resp Headers:`, r.responseHeaders);
  }
  if (r.responseBody) {
    console.log(`Resp Body:`, JSON.stringify(r.responseBody, null, 2));
  }
});
