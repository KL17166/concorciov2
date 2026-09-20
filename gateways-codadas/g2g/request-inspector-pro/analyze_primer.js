const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('Total requests in file:', data.length);

// Filter requests related to eldorado.gg or primer or payment
const relevant = data.filter(r => {
  const url = (r.url || '').toLowerCase();
  return url.includes('eldorado.gg') || 
         url.includes('primer') || 
         url.includes('payment') || 
         url.includes('checkout') || 
         url.includes('card') ||
         url.includes('order') ||
         url.includes('fraud') ||
         url.includes('3ds') ||
         url.includes('risk') ||
         url.includes('fingerprint') ||
         url.includes('sift') ||
         url.includes('device') ||
         url.includes('sec-fetch');
});

console.log(`Found ${relevant.length} relevant requests.`);

// Print summary of relevant requests chronologically
relevant.forEach((r, i) => {
  console.log(`\n========================================`);
  console.log(`[${i + 1}] ID: ${r.id} | ${r.method} ${r.statusCode || 'NO_STATUS'} | ${r.type}`);
  console.log(`URL: ${r.url}`);
  console.log(`Time: ${r.timestamp} | IP: ${r.ip}`);
  if (r.error) console.log(`ERROR: ${r.error}`);
  
  if (r.requestHeaders) {
    console.log('Request Headers:');
    const interestingHeaders = ['cookie', 'authorization', 'x-forwarded-for', 'user-agent', 'origin', 'referer', 'content-type', 'x-client-data'];
    Object.entries(r.requestHeaders).forEach(([k, v]) => {
      if (interestingHeaders.includes(k.toLowerCase()) || k.toLowerCase().startsWith('x-') || k.toLowerCase().startsWith('sec-ch')) {
        console.log(`  ${k}: ${String(v).substring(0, 150)}`);
      }
    });
  }

  if (r.requestBody) {
    console.log('Request Body:', JSON.stringify(r.requestBody, null, 2).substring(0, 800));
  }

  if (r.responseHeaders) {
    console.log('Response Headers:');
    const respHeaders = ['set-cookie', 'location', 'content-type', 'server', 'cf-ray', 'x-cache', 'retry-after'];
    Object.entries(r.responseHeaders).forEach(([k, v]) => {
      if (respHeaders.includes(k.toLowerCase()) || k.toLowerCase().startsWith('x-')) {
        console.log(`  ${k}: ${String(v).substring(0, 150)}`);
      }
    });
  }

  if (r.responseBody) {
    console.log('Response Body:', JSON.stringify(r.responseBody, null, 2).substring(0, 1500));
  }
});
