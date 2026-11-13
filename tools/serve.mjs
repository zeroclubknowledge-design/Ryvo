// Dependency-free status server for the Ryvo workflow documents.
// Serves a rendered view of requirements.md, ux-brief.md and design-brief.md.
// Run: node tools/serve.mjs   → http://localhost:4321

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4321;

const DOCS = [
  { file: 'requirements.md', label: 'Requirements', phase: 'Phase 1' },
  { file: 'ux-brief.md', label: 'UX brief', phase: 'Phase 2' },
  { file: 'design-brief.md', label: 'Design brief', phase: 'Phase 2' },
];

const PHASES = [
  { n: 1, name: 'Requirements', state: 'done', detail: '34 decisions · 10 assumptions · 6 open' },
  { n: 2, name: 'UX discovery', state: 'done', detail: '3 concepts · 1 chosen · 12 screens mapped' },
  { n: 3, name: 'UI', state: 'next', detail: 'Not started — 3 board directions, then 3 variations' },
];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

function toHtml(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) =>
        r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        '<div class="scroll"><table><thead><tr>' +
          head.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>'
      );
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      }
      out.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      }
      out.push('<ol>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ol>');
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|\s*\||\s*[-*]\s+|\s*\d+\.\s+|>)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f6f4; color: #17171a;
    font: 16px/1.65 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 48px 28px 96px; }
  header.top { border-bottom: 1px solid #dcdcd6; padding-bottom: 28px; margin-bottom: 32px; }
  .kicker { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #6d6d70; }
  h1 { font-size: 30px; line-height: 1.15; margin: 10px 0 8px; letter-spacing: -.02em; }
  .lede { color: #4a4a4d; max-width: 62ch; margin: 0; }
  .notice { margin-top: 22px; padding: 14px 16px; border: 1px solid #dcdcd6; background: #fff;
    border-radius: 8px; font-size: 14px; color: #3a3a3d; }
  .phases { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 28px 0 36px; }
  .phase { border: 1px solid #dcdcd6; border-radius: 8px; background: #fff; padding: 14px 16px; }
  .phase[data-state="done"] { border-color: #c9c9c1; }
  .phase[data-state="next"] { border-style: dashed; }
  .phase b { display: block; font-size: 13px; letter-spacing: .02em; }
  .phase span { display: block; font-size: 12.5px; color: #6d6d70; margin-top: 5px; }
  nav.tabs { display: flex; gap: 4px; border-bottom: 1px solid #dcdcd6; margin-bottom: 28px; flex-wrap: wrap; }
  nav.tabs a { padding: 10px 14px; text-decoration: none; color: #57575a; font-size: 14px;
    border-bottom: 2px solid transparent; margin-bottom: -1px; }
  nav.tabs a[aria-current="page"] { color: #17171a; border-bottom-color: #17171a; font-weight: 600; }
  main h1 { font-size: 26px; margin-top: 34px; }
  main h2 { font-size: 20px; margin-top: 40px; padding-top: 18px; border-top: 1px solid #e6e6e0; letter-spacing: -.01em; }
  main h3 { font-size: 16px; margin-top: 28px; }
  main h4 { font-size: 14px; margin-top: 22px; color: #3a3a3d; }
  main p, main li { max-width: 74ch; }
  code { font: 13px/1.5 ui-monospace, "Cascadia Code", Menlo, monospace;
    background: #ecece6; padding: 1.5px 5px; border-radius: 4px; }
  pre { background: #1d1d20; color: #eaeae6; padding: 16px 18px; border-radius: 8px;
    overflow-x: auto; font-size: 12.5px; line-height: 1.5; }
  pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
  blockquote { margin: 20px 0; padding: 2px 0 2px 16px; border-left: 2px solid #b9b9b2; color: #3a3a3d; }
  hr { border: 0; border-top: 1px solid #e6e6e0; margin: 34px 0; }
  .scroll { overflow-x: auto; margin: 18px 0; border: 1px solid #dcdcd6; border-radius: 8px; background: #fff; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th, td { text-align: left; padding: 9px 13px; border-bottom: 1px solid #ecece6; vertical-align: top; }
  th { background: #fafaf7; font-size: 12px; letter-spacing: .04em; text-transform: uppercase;
    color: #57575a; font-weight: 600; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: 0; }
  a { color: #17171a; text-underline-offset: 2px; }
  footer.meta { margin-top: 64px; padding-top: 20px; border-top: 1px solid #dcdcd6;
    font-size: 12.5px; color: #6d6d70; }
`;

function shell(activeFile, content) {
  const tabs = DOCS.map(
    (d) =>
      `<a href="/?doc=${d.file}"${d.file === activeFile ? ' aria-current="page"' : ''}>${d.label}</a>`
  ).join('');

  const phases = PHASES.map(
    (p) =>
      `<div class="phase" data-state="${p.state}"><b>Phase ${p.n} · ${p.name}</b><span>${
        p.state === 'done' ? 'Complete · ' : ''
      }${p.detail}</span></div>`
  ).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ryvo · workflow status</title>
<style>${STYLE}</style>
</head><body><div class="wrap">
<header class="top">
  <div class="kicker">Ryvo · design workflow</div>
  <h1>Requirements → UX → UI</h1>
  <p class="lede">Where the work actually stands. These are the specification documents produced so far — the product itself does not exist yet.</p>
  <div class="notice"><strong>No application yet.</strong> There are no screens, components or routes to run. Phase 3 designs the UI; the app gets built from whatever direction is picked there. Everything below is documentation, rendered so it can be read.</div>
</header>
<div class="phases">${phases}</div>
<nav class="tabs">${tabs}</nav>
<main>${content}</main>
<footer class="meta">Served locally from the project root · documents are read from disk on every request</footer>
</div></body></html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const doc = url.searchParams.get('doc') || DOCS[0].file;
  const known = DOCS.find((d) => d.file === doc);

  if (!known) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Unknown document');
    return;
  }

  try {
    const raw = await readFile(resolve(ROOT, known.file), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(shell(known.file, toHtml(raw)));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Could not read ${known.file}: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Ryvo status → http://localhost:${PORT}`);
});
