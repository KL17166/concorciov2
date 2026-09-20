const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Filter for Eldorado and Primer / payment gateway requests
const paymentFlow = data.filter(r => {
  const url = (r.url || '').toLowerCase();
  // Exclude ad trackers, static images/fonts, google analytics
  if (url.includes('googlesyndication') || url.includes('doubleclick') || url.includes('google-analytics') || url.includes('google.com/ccm') || url.includes('google.com/rmkt') || url.includes('scorecardresearch') || url.includes('bing.com') || url.includes('tiktok.com')) {
    return false;
  }
  return true;
});

console.log(`Filtered out ads/analytics: ${paymentFlow.length} requests remaining.`);

paymentFlow.forEach((r, i) => {
  console.log(`\n------------------------------------------------------------`);
  console.log(`[${i+1}] ${r.method} ${r.statusCode} | ${r.type} | ID: ${r.id}`);
  console.log(`URL: ${r.url}`);
  console.log(`Time: ${r.timestamp} | IP: ${r.ip}`);
  if (r.error) console.log(`ERROR: ${r.error}`);

  if (r.requestBody) {
    console.log(`REQUEST BODY:`, JSON.stringify(r.requestBody, null, 2));
  }
  if (r.responseBody) {
    console.log(`RESPONSE BODY:`, JSON.stringify(r.responseBody, null, 2));
  }
  if (r.requestHeaders) {
    console.log(`REQUEST HEADERS:`, JSON.stringify(r.requestHeaders, null, 2));
  }
  if (r.responseHeaders) {
    console.log(`RESPONSE HEADERS:`, JSON.stringify(r.responseHeaders, null, 2));
  }
});
