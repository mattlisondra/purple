#!/usr/bin/env node
// Encrypts data/project.json (the film, the budget and the Application kit) into
// data/project.enc.json with the site password. Only the encrypted file is
// published; data/project.json stays on this computer (.gitignore leaves it out).
// The pages ask for the password and decrypt it in the browser.
//
//   node tools/seal.cjs                  after editing data/project.json (asks for the password)
//   node tools/seal.cjs --new-password   to change the password (asks for the new one twice)
//
// The password can also come from the PURPLE_PASSWORD environment variable.
// AES-256-GCM with a key from PBKDF2-SHA256; the salt is kept between seals so
// browsers that are already unlocked stay unlocked.
'use strict';
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'project.json');
const OUT = path.join(ROOT, 'data', 'project.enc.json');
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

(async () => {
  if (!fs.existsSync(SRC)) { console.error('data/project.json is not on this computer, so there is nothing to seal.'); process.exit(1); }
  let project;
  try { project = JSON.parse(fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { console.error('data/project.json is not valid JSON: ' + e.message); process.exit(1); }

  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const env = process.env.PURPLE_PASSWORD;
  let pw, salt;
  if (old && !fresh) {
    pw = (env != null ? env : await ask('Password: ')).trim();
    salt = Buffer.from(old.salt, 'base64');
    try { open(old, key(pw, salt, old.iter)); }
    catch (e) { console.error('That is not the current password. To change the password, run: node tools/seal.cjs --new-password'); process.exit(1); }
  } else {
    pw = (env != null ? env : await ask('New password: ')).trim();
    if (env == null && (await ask('Same password again: ')).trim() !== pw) { console.error('The two passwords are different. Nothing changed.'); process.exit(1); }
    if (pw.length < 10) { console.error('Use at least 10 characters. Nothing changed.'); process.exit(1); }
    salt = crypto.randomBytes(16);
  }

  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(pw, salt, ITER), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(project), 'utf8'), c.final(), c.getAuthTag()]);
  const box = {
    v: 1,
    about: 'PURPLE project details, encrypted with the site password (AES-256-GCM, key from PBKDF2-SHA256). Made by tools/seal.cjs from data/project.json, which is not published.',
    iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64')
  };
  // Check the result opens before writing it.
  if (open(box, key(pw, salt, ITER)) !== JSON.stringify(project)) { console.error('Encryption check failed. Nothing changed.'); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(box, null, 1) + '\n');
  console.log('Sealed data/project.json into data/project.enc.json' + (old && !fresh ? '.' : ' with the new password. Every browser will ask for it again.'));
})();
