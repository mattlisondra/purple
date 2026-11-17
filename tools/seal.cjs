#!/usr/bin/env node
// Encrypts the private files with the site password. Only the encrypted copies are published;
// the plain files stay on this computer (.gitignore leaves them out). The pages ask for the
// password and decrypt in the browser.
//
//   data/project.json    -> data/project.enc.json    the film, the budget and the Application kit
//   data/locations.json  -> data/locations.enc.json  scene breakdown, locations, shooting schedule
//
//   node tools/seal.cjs                  after editing either file (asks for the password)
//   node tools/seal.cjs --new-password   to change the password (asks for the new one twice)
//
// The password can also come from the PURPLE_PASSWORD environment variable.
// AES-256-GCM with a key from PBKDF2-SHA256. Every file uses the same salt, so one password
// unlocks every page, and the salt is kept between seals so browsers already unlocked stay unlocked.
'use strict';
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = [
  { src: 'project.json', out: 'project.enc.json', about: 'PURPLE project details, encrypted with the site password (AES-256-GCM, key from PBKDF2-SHA256). Made by tools/seal.cjs from data/project.json, which is not published.' },
  { src: 'locations.json', out: 'locations.enc.json', about: 'PURPLE scene breakdown, locations and shooting schedule, encrypted with the site password (AES-256-GCM, key from PBKDF2-SHA256). Made by tools/seal.cjs from data/locations.json, which is not published.' }
].map(f => Object.assign(f, { srcPath: path.join(ROOT, 'data', f.src), outPath: path.join(ROOT, 'data', f.out) }));
const ITER = 600000;
const fresh = process.argv.includes('--new-password');

function ask(q) {
  return new Promise(resolve => {
    const input = process.stdin;
    process.stdout.write(q);
    if (!input.isTTY) {               // piped: read one line
      let s = '';
      input.setEncoding('utf8');
      input.on('data', d => { s += d; if (s.includes('\n')) { input.pause(); resolve(s.split(/\r?\n/)[0]); } });
      input.on('end', () => resolve(s.split(/\r?\n/)[0]));
      return;
    }
    let s = '';
    input.setRawMode(true); input.resume(); input.setEncoding('utf8');
    const on = c => {
      for (const ch of c) {
        if (ch === '\r' || ch === '\n') { input.setRawMode(false); input.pause(); input.removeListener('data', on); process.stdout.write('\n'); return resolve(s); }
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u007f' || ch === '\b') s = s.slice(0, -1); else s += ch;
      }
    };
    input.on('data', on);
  });
}

function key(pw, salt, iter) { return crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256'); }
function open(box, k) {
  const raw = Buffer.from(box.ct, 'base64'), tag = raw.subarray(raw.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString('utf8');
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }

(async () => {
  // What is on this computer.
  for (const f of FILES) {
    f.box = fs.existsSync(f.outPath) ? readJson(f.outPath) : null;
    if (fs.existsSync(f.srcPath)) {
      try { f.plain = JSON.stringify(readJson(f.srcPath)); }
      catch (e) { console.error(`data/${f.src} is not valid JSON: ${e.message}`); process.exit(1); }
    }
  }
  if (!FILES.some(f => f.plain)) { console.error('Neither data/project.json nor data/locations.json is on this computer, so there is nothing to seal.'); process.exit(1); }

  const current = FILES.map(f => f.box).find(Boolean);   // any sealed file tells us the current salt
  const env = process.env.PURPLE_PASSWORD;
  let pw, salt;
  if (current && !fresh) {
    pw = (env != null ? env : await ask('Password: ')).trim();
    salt = Buffer.from(current.salt, 'base64');
    try { open(current, key(pw, salt, current.iter)); }
    catch (e) { console.error('That is not the current password. To change the password, run: node tools/seal.cjs --new-password'); process.exit(1); }
  } else {
    const missing = FILES.filter(f => f.box && !f.plain);
    if (missing.length) { console.error(`Changing the password re-seals every file, so it needs ${missing.map(f => 'data/' + f.src).join(' and ')} on this computer. Nothing changed.`); process.exit(1); }
    pw = (env != null ? env : await ask('New password: ')).trim();
    if (env == null && (await ask('Same password again: ')).trim() !== pw) { console.error('The two passwords are different. Nothing changed.'); process.exit(1); }
    if (pw.length < 10) { console.error('Use at least 10 characters. Nothing changed.'); process.exit(1); }
    salt = crypto.randomBytes(16);
  }

  const k = key(pw, salt, ITER), done = [], same = [];
  for (const f of FILES) {
    let text = f.plain;
    if (text == null) {
      // No plain copy here. Keep the sealed file if it already uses this salt, otherwise it cannot be re-sealed.
      if (f.box && f.box.salt === salt.toString('base64')) continue;
      if (f.box) { console.error(`data/${f.out} uses a different salt and data/${f.src} is not here to re-seal it.`); process.exit(1); }
      continue;
    }
    // Unchanged since the last seal: leave the file alone, so git shows no change.
    if (f.box && !fresh && f.box.salt === salt.toString('base64') && f.box.iter === ITER) {
      try { if (open(f.box, k) === text) { same.push(f); continue; } } catch (e) { /* re-seal below */ }
    }
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', k, iv);
    const ct = Buffer.concat([c.update(text, 'utf8'), c.final(), c.getAuthTag()]);
    const box = { v: 1, about: f.about, iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
    if (open(box, k) !== text) { console.error(`Encryption check failed for data/${f.src}. Nothing changed.`); process.exit(1); }
    f.next = box; done.push(f);
  }
  for (const f of done) fs.writeFileSync(f.outPath, JSON.stringify(f.next, null, 1) + '\n');
  if (done.length) console.log('Sealed ' + done.map(f => `data/${f.src} into data/${f.out}`).join(' and ') + (current && !fresh ? '.' : ' with the new password. Every browser will ask for it again.'));
  if (same.length) console.log('Unchanged, left as they are: ' + same.map(f => `data/${f.out}`).join(' and ') + '.');
})();
