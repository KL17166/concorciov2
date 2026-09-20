const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Filter out 3rd party ads/analytics
const ignoredHosts = [
  'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'securepubads.g.doubleclick.net',
  'www.google-analytics.com',
  'analytics.google.com',
  'www.google.com',
  'adservice.google.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'bat.bing.com',
  'analytics.tiktok.com',
  'sb.scorecardresearch.com',
  'maps.gstatic.com',
  'www.gstatic.com'
];

const appRequests = data.filter(r => {
  try {
    const host = new URL(r.url).hostname;
    return !ignoredHosts.some(h => host.includes(h));
  } catch (e) {
    return true;
  }
});

console.log(`=== APPLICATION REQUESTS: ${appRequests.length} ===`);

const report = [];

appRequests.forEach(r => {
  const item = {
    id: r.id,
    time: r.timestamp,
    method: r.method,
    status: r.statusCode,
    url: r.url,
    ip: r.ip,
    initiator: r.initiator,
    error: r.error,
    fromCache: r.fromCache,
    requestHeaders: r.requestHeaders,
    responseHeaders: r.responseHeaders,
    requestBody: r.requestBody,
    responseBody: r.responseBody
  };
  report.push(item);
});

fs.writeFileSync(path.join(__dirname, 'diagnose_report.json'), JSON.stringify(report, null, 2), 'utf8');

// Summary for console
report.forEach((r, i) => {
  console.log(`\n[#${i+1}] ${r.method} ${r.status || 'ERR'} -> ${r.url}`);
  console.log(`  IP: ${r.ip} | Time: ${r.time}`);
  if (r.error) console.log(`  Error: ${r.error}`);
  if (r.requestBody) {
    const bodyStr = typeof r.requestBody === 'object' ? JSON.stringify(r.requestBody) : String(r.requestBody);
    console.log(`  Req Body (${bodyStr.length} chars): ${bodyStr.substring(0, 300)}`);
  }
  if (r.responseBody) {
    const bodyStr = typeof r.responseBody === 'object' ? JSON.stringify(r.responseBody) : String(r.responseBody);
    console.log(`  Resp Body (${bodyStr.length} chars): ${bodyStr.substring(0, 400)}`);
  }
});
