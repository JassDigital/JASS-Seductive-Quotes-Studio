const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');
const JSZip = require('jszip');

let db;
let dbFile;
let SQL;

function persistDb() {
  if (!db || !dbFile) return;
  const bytes = db.export();
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.writeFileSync(dbFile, Buffer.from(bytes));
}

async function initDb() {
  dbFile = path.join(app.getPath('userData'), 'jass-quotes.sqlite');
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  SQL = await initSqlJs({ locateFile: () => wasmPath });
  if (fs.existsSync(dbFile)) {
    try {
      db = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));
    } catch (error) {
      const backup = `${dbFile}.corrupt-${Date.now()}`;
      try { fs.copyFileSync(dbFile, backup); } catch {}
      db = new SQL.Database();
      console.error('Could not open quote database; created a new database. Backup attempt:', backup, error);
    }
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS quotes(
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Unknown / verify',
    work TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    source_location TEXT NOT NULL DEFAULT '',
    mood TEXT NOT NULL DEFAULT 'Imported',
    status TEXT NOT NULL DEFAULT 'REVIEW NEEDED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  persistDb();
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally { stmt.free(); }
}

function classifyCandidate(text) {
  const s = text.trim();
  const words = s.split(/\s+/).filter(Boolean);
  const lower = s.toLowerCase();
  const reasons = [];
  let score = 50;
  if (s.length >= 55 && s.length <= 260) score += 15;
  else if (s.length > 350) { score -= 18; reasons.push('Long passage'); }
  if (words.length >= 10 && words.length <= 42) score += 10;
  else if (words.length > 55) { score -= 12; reasons.push('Very long'); }
  if (/[.!?…][”’"']?$/.test(s)) score += 5;
  if (/[“”‘’"']/.test(s)) score += 4;
  if (/\b(heart|love|desire|kiss|eyes|soul|beautiful|beautifully|tender|longing|passion|dream|night|forever|remember|feel|felt|thought|whisper|smile|silence|hope|life|world|time)\b/i.test(s)) score += 8;
  if (/\b(the|a|an|and|but|or|to|of|in|on|for|with|was|were|is|are|he|she|they|you|i)\b/i.test(s)) score += 3;
  if (/^(chapter|contents|table of contents|copyright|all rights reserved|isbn|published by|printed in|cover design|edited by|illustrations? by|translator|ebook|epub|http|www\.)\b/i.test(s)) { score -= 80; reasons.push('Book metadata or navigation'); }
  if (/\b(table of contents|has been created for the (html|epub|pdf) version|minor punctuation errors have been corrected|click here|read more|previous chapter|next chapter|back to top|download this book|project gutenberg|this ebook is for the use|all rights reserved|contents may be subject to change)\b/i.test(lower)) { score -= 85; reasons.push('Boilerplate or navigation'); }
  if (/^[\d\s.\-–—:]+$/.test(s) || /^[\W_]*$/.test(s)) { score -= 100; reasons.push('No meaningful text'); }
  if (/^(\d+\s+)?(chapter|part|book)\s+([ivxlcdm]+|\d+|[a-z]+)$/i.test(s) || /^\.{3,}|^…{2,}/.test(s)) { score -= 55; reasons.push('Heading or fragment'); }
  if ((s.match(/[.!?]/g)||[]).length > 5) { score -= 12; reasons.push('Likely multi-sentence block'); }
  if (/(.)\1{7,}/.test(s) || /\b\w{28,}\b/.test(s)) { score -= 10; reasons.push('Possible extraction artifact'); }
  score = Math.max(0, Math.min(100, score));
  if (!reasons.length) reasons.push(score >= 70 ? 'Strong candidate signals' : score >= 50 ? 'Possible quote; review wording' : 'Low-confidence passage');
  return { score, reasons };
}

function splitCandidates(text, file) {
  const normalized = text.replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  const blocks = normalized.split(/\n\s*\n|(?<=[.!?])\s+(?=[“"A-Z])/).map(s => s.replace(/^\s*[“"'“”‘’—–-]+|[”"'“”‘’]+\s*$/g, '').trim()).filter(Boolean);
  const out = []; const seen = new Set(); let hardFiltered = 0; let duplicates = 0;
  blocks.forEach((s, i) => {
    if (s.length < 35 || s.length > 600 || /^\d+$/.test(s) || s.split(/\s+/).length < 7) { hardFiltered++; return; }
    const key = s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);
    const quality = classifyCandidate(s);
    if (quality.score < 18) { hardFiltered++; return; }
    out.push({ id: crypto.randomUUID(), text: s, author: 'Unknown / verify', work: '', sourceFile: path.basename(file), sourceLocation: `Text segment ${i + 1}`, mood: 'Imported', status: 'REVIEW NEEDED', qualityScore: quality.score, qualityReasons: quality.reasons, keep: quality.score >= 55 });
  });
  return { candidates: out, stats: { examined: blocks.length, candidates: out.length, hardFiltered, duplicates, recommended: out.filter(q => q.qualityScore >= 70).length, review: out.filter(q => q.qualityScore >= 40 && q.qualityScore < 70).length, lowConfidence: out.filter(q => q.qualityScore < 40).length } };
}
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function extractFile(file) {
  const ext = path.extname(file).toLowerCase(); let text = '';
  if (ext === '.txt' || ext === '.md' || ext === '.markdown') text = fs.readFileSync(file, 'utf8');
  else if (ext === '.html' || ext === '.htm') text = htmlToText(fs.readFileSync(file, 'utf8'));
  else if (ext === '.epub') {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const htmls = Object.values(zip.files).filter(f => !f.dir && /\.(xhtml|html|htm)$/i.test(f.name));
    for (const f of htmls) text += '\n\n' + htmlToText(await f.async('string'));
  } else if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fs.readFileSync(file)); text = data.text;
  } else throw new Error('Unsupported file type: ' + ext);
  return splitCandidates(text, file);
}

ipcMain.handle('collector:choose', async () => {
  const res = await dialog.showOpenDialog({ title: 'Collect quotes from your local documents', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Documents', extensions: ['txt', 'md', 'markdown', 'html', 'htm', 'epub', 'pdf'] }] });
  if (res.canceled) return { files: [], candidates: [], errors: [] };
  const candidates = []; const errors = []; const totals = { examined: 0, candidates: 0, hardFiltered: 0, duplicates: 0, recommended: 0, review: 0, lowConfidence: 0 };
  for (const f of res.filePaths) {
    try { const result = await extractFile(f); candidates.push(...result.candidates); for (const k of Object.keys(totals)) totals[k] += result.stats[k] || 0; }
    catch (e) { errors.push(`${path.basename(f)}: ${e.message}`); }
  }
  return { files: res.filePaths.map(f => path.basename(f)), candidates, errors, stats: totals };
});

ipcMain.handle('quotes:list', () => queryAll('SELECT * FROM quotes ORDER BY created_at DESC').map(r => ({ ...r, mood: r.mood.split(',').filter(Boolean) })));
ipcMain.handle('quotes:save', (_e, rows) => {
  if (!Array.isArray(rows)) throw new TypeError('Expected an array of quote records');
  let saved = 0;
  try {
    db.run('BEGIN TRANSACTION');
    for (const q of rows) {
      const quoteText = String(q.text || '').trim();
      if (!quoteText) continue;
      db.run('INSERT OR REPLACE INTO quotes(id,text,author,work,source_file,source_location,mood,status) VALUES(?,?,?,?,?,?,?,?)', [
        String(q.id || crypto.randomUUID()), quoteText, String(q.author || 'Unknown / verify'),
        String(q.work || ''), String(q.sourceFile || ''), String(q.sourceLocation || ''),
        Array.isArray(q.mood) ? q.mood.join(',') : String(q.mood || 'Imported'), String(q.status || 'REVIEW NEEDED')
      ]);
      saved++;
    }
    db.run('COMMIT');
    persistDb();
    return { saved };
  } catch (error) {
    try { db.run('ROLLBACK'); } catch {}
    throw error;
  }
});
ipcMain.handle('quotes:delete', (_e, id) => {
  db.run('DELETE FROM quotes WHERE id = ?', [String(id)]);
  const changes = db.getRowsModified();
  persistDb();
  return changes;
});

function createWindow() {
  const win = new BrowserWindow({ width: 1480, height: 940, minWidth: 1080, minHeight: 700, backgroundColor: '#111014', title: 'JASS Seductive Quotes Studio', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(async () => {
  await initDb();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(error => { console.error('Failed to initialize JASS Seductive Quotes Studio:', error); app.quit(); });
app.on('before-quit', () => { try { persistDb(); } catch (error) { console.error('Could not persist quote database:', error); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
