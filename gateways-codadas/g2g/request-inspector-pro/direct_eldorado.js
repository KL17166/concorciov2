const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Filter strictly eldorado.gg API or page navigations (not google analytics with referer eldorado)
const directEldorado = data.filter(r => {
  try {
    const u = new URL(r.url);
    return u.hostname.includes('eldorado.gg') || u.hostname.includes('primer.io');
  } catch {
    return false;
  }
});

console.log(`Direct Eldorado/Primer requests: ${directEldorado.length}`);

directEldorado.forEach((r, i) => {
  console.log(`\n========================================`);
  console.log(`[#${i+1}] ${r.method} ${r.statusCode || 'ERR'} | ${r.type}`);
  console.log(`URL: ${r.url}`);
  console.log(`Time: ${r.timestamp}`);
  if (r.requestBody) {
    console.log(`Request Body:`, JSON.stringify(r.requestBody, null, 2));
  }
  if (r.responseBody) {
    console.log(`Response Body:`, JSON.stringify(r.responseBody, null, 2));
  }
  if (r.requestHeaders) {
    console.log(`Request Headers:`, r.requestHeaders);
  }
  if (r.responseHeaders) {
    console.log(`Response Headers:`, r.responseHeaders);
  }
});
