const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
console.log('Loading JSON...');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log(`Total requests captured: ${data.length}`);

// Group by domains
const domains = {};
const statusCodes = {};
const suspiciousOrInteresting = [];

data.forEach((r, idx) => {
  try {
    const urlObj = new URL(r.url);
    domains[urlObj.hostname] = (domains[urlObj.hostname] || 0) + 1;
  } catch (e) {}

  statusCodes[r.statusCode || 'none'] = (statusCodes[r.statusCode || 'none'] || 0) + 1;

  const urlLower = (r.url || '').toLowerCase();
  const method = r.method || 'GET';
  const status = r.statusCode;

  // Check if it's related to payment, checkout, auth, card, 3ds, vbv, risk, fraud, fingerprint, bot
  const keywords = [
    'pay', 'checkout', 'card', 'cart', 'order', 'stripe', 'paypal', 'cielo', 'pagseguro',
    'mercadopago', 'adyen', 'braintree', '3ds', 'vbv', 'acs', 'risk', 'fraud', 'fingerprint',
    'auth', 'token', 'transact', 'charge', 'gateway', 'security', 'threat', 'bot', 'recaptcha',
    'arkose', 'datadome', 'perimeterx', 'cloudflare', 'turnstile', 'sift', 'kount', 'forter', 'clearale', 'cybersource'
  ];

  const matched = keywords.filter(k => urlLower.includes(k));
  if (matched.length > 0 || (status >= 400 && status < 600) || r.category === 'PAYMENT') {
    suspiciousOrInteresting.push({
      idx,
      id: r.id,
      timestamp: r.timestamp,
      method: r.method,
      url: r.url,
      statusCode: r.statusCode,
      statusLine: r.statusLine,
      category: r.category,
      matched,
      hasRequestBody: !!r.requestBody,
      requestBody: r.requestBody,
      hasResponseBody: !!r.responseBody,
      responseBody: r.responseBody,
      requestHeaders: r.requestHeaders,
      responseHeaders: r.responseHeaders,
      ip: r.ip,
      error: r.error
    });
  }
});

console.log('\n--- DOMAINS BREAKDOWN (Top 25) ---');
Object.entries(domains)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .forEach(([d, c]) => console.log(`  ${c.toString().padStart(5)} | ${d}`));

console.log('\n--- STATUS CODES ---');
console.log(statusCodes);

console.log(`\n--- INTERESTING / PAYMENT / ERROR REQUESTS (${suspiciousOrInteresting.length} found) ---`);
suspiciousOrInteresting.slice(0, 40).forEach(r => {
  console.log(`\n[#${r.idx}] ${r.method} ${r.statusCode} -> ${r.url}`);
  console.log(`  Timestamp: ${r.timestamp} | IP: ${r.ip} | Matches: ${r.matched.join(', ')}`);
  if (r.requestBody) {
    console.log('  Request Body:', typeof r.requestBody === 'object' ? JSON.stringify(r.requestBody).substring(0, 300) : String(r.requestBody).substring(0, 300));
  }
  if (r.responseBody) {
    console.log('  Response Body:', typeof r.responseBody === 'object' ? JSON.stringify(r.responseBody).substring(0, 300) : String(r.responseBody).substring(0, 300));
  }
  if (r.error) {
    console.log('  Error:', r.error);
  }
});

fs.writeFileSync(path.join(__dirname, 'analysis_summary.json'), JSON.stringify({
  total: data.length,
  domains,
  statusCodes,
  interesting: suspiciousOrInteresting
}, null, 2));
console.log('\nWrote full analysis to analysis_summary.json');
