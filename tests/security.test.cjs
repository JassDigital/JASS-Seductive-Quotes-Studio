const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const root=path.join(__dirname,'..');const main=fs.readFileSync(path.join(root,'electron','main.cjs'),'utf8');const css=fs.readFileSync(path.join(root,'src','styles.css'),'utf8');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('Electron renderer security defaults are enabled',()=>{assert.match(main,/contextIsolation:\s*true/);assert.match(main,/nodeIntegration:\s*false/);assert.match(main,/sandbox:\s*true/)});
test('app has no analytics or remote font dependency',()=>{assert.doesNotMatch(css,/fonts\.googleapis\.com|fonts\.gstatic\.com/i);assert.doesNotMatch(html,/googletagmanager|google-analytics|segment\.com/i)});

test('SQLite implementation does not require native better-sqlite3',()=>{const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));assert.ok(pkg.dependencies['sql.js']);assert.equal(pkg.dependencies['better-sqlite3'],undefined);assert.equal(pkg.scripts.postinstall,undefined);assert.match(main,/db\.export\(\)/);assert.match(main,/persistDb\(\)/)});
test('v1.2 collector includes heuristic quality filtering and bulk review controls',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const renderer=fs.readFileSync(path.join(root,'src','main.jsx'),'utf8');
  assert.equal(pkg.version,'1.2.0');
  assert.match(main,/function classifyCandidate\(text\)/);
  assert.match(main,/Boilerplate or navigation/);
  assert.match(main,/duplicates/);
  assert.match(renderer,/Keep recommended/);
  assert.match(renderer,/Select shown/);
  assert.match(renderer,/Deselect shown/);
  assert.match(renderer,/qualityScore/);
  assert.match(renderer,/REVIEW NEEDED/);
});
