const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'requests_2026-08-22T04-13-53-665Z.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('--- FINDING FORTER & ANTIFRAUD REQUESTS ---');
const forter = data.filter(r => (r.url || '').toLowerCase().includes('forter') || (r.url || '').toLowerCase().includes('ftr'));
console.log('Forter requests count:', forter.length);
forter.forEach(r => console.log(`  ${r.method} ${r.statusCode} -> ${r.url}`));

console.log('\n--- FINDING PRIMER REQUESTS ---');
const primer = data.filter(r => (r.url || '').toLowerCase().includes('primer'));
console.log('Primer requests count:', primer.length);
primer.forEach(r => console.log(`  ${r.method} ${r.statusCode} -> ${r.url}`));

console.log('\n--- FINDING API / XHR / FETCH REQUESTS TO ELDORADO ---');
const eldoradoApi = data.filter(r => {
  const u = (r.url || '').toLowerCase();
  return u.includes('eldorado.gg') && (r.type === 'xmlhttprequest' || r.type === 'fetch' || u.includes('/api/'));
});
console.log('Eldorado API / XHR count:', eldoradoApi.length);
eldoradoApi.forEach(r => {
  console.log(`  ${r.method} ${r.statusCode} -> ${r.url}`);
  if (r.requestBody) console.log('    Body:', JSON.stringify(r.requestBody).substring(0, 200));
  if (r.responseBody) console.log('    Resp:', JSON.stringify(r.responseBody).substring(0, 200));
});

console.log('\n--- NAVIGATION CHRONOLOGY (Pages visited) ---');
const pages = data.filter(r => r.type === 'main_frame' || (r.url.startsWith('http') && !r.url.includes('.png') && !r.url.includes('.jpg') && !r.url.includes('.svg') && !r.url.includes('.js') && !r.url.includes('.css') && !r.url.includes('google') && !r.url.includes('doubleclick') && !r.url.includes('scorecard')));
pages.slice(0, 30).forEach(r => console.log(`  [${r.timestamp}] ${r.method} ${r.statusCode} (${r.type}) -> ${r.url}`));
