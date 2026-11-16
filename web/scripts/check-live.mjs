const base = process.env.RYVO_TEST_URL || 'http://localhost:3014';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const retired = await fetch(`${base}/api/demo`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'fund',state:{balance:1000000}})});
assert(retired.status === 410, 'Browser-supplied wallet mutations must be rejected.');
for (const route of ['/', '/signup', '/signin', '/onboarding', '/wallet', '/explore', '/discover', '/ryvo-credit', '/ryvo-token']) {
 const response = await fetch(`${base}${route}`);
 assert(response.ok, `${route} must load.`);
 const html = await response.text();
 const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ');
 assert(!/\bdemo\b|simulat(?:ed|ion)|sample winner/i.test(text), `${route} contains obsolete public copy.`);
}
console.log('Passed: public routes, obsolete-copy removal, and rejection of browser-owned money mutations.');
