const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Filter out pure static assets (images, fonts, css) unless they contain interesting info
const timeline = data.filter(r => {
  const u = r.url.toLowerCase();
  if (r.type === 'font' || r.type === 'stylesheet') return false;
  if (u.includes('.png') || u.includes('.jpg') || u.includes('.svg') || u.includes('.ico') || u.includes('.woff') || u.includes('.mp3')) return false;
  if (u.includes('doubleclick') || u.includes('googlesyndication') || u.includes('googleadservices')) return false;
  return true;
});

console.log(`Timeline events: ${timeline.length}`);

timeline.forEach((r, idx) => {
  console.log(`\n------------------------------------------------------------`);
  console.log(`[${idx+1}] ${r.timestamp} | ${r.method} ${r.statusCode || 'ERR'} | Type: ${r.type} | Cat: ${r.category}`);
  console.log(`URL: ${r.url}`);
  if (r.error) console.log(`ERROR: ${r.error}`);
  if (r.requestBody) {
    console.log(`REQ BODY:`, JSON.stringify(r.requestBody, null, 2));
  }
  if (r.responseBody) {
    console.log(`RESP BODY:`, JSON.stringify(r.responseBody, null, 2));
  }
});
