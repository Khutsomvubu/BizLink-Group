/* ============================================================
   BizLink — OTP / forgot-password flow
   Loaded only by forgot-password.html
   Depends on: config.js (BIZLINK_CONFIG), auth.js (BizAuth), EmailJS SDK
   ============================================================ */

/* ================= CONFIG (from config.js) ================= */
const CFG = window.BIZLINK_CONFIG;
const EJ = CFG.emailjs;
const R = CFG.reset;

/* ================= HELPERS ================= */
const $ = id => document.getElementById(id);
const SKEY = 'bizlink_reset_session';
const HKEY = 'bizlink_reset_sends';
const enc = new TextEncoder();
const timers = { resend: null };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const maskEmail = e => { const [u, d] = e.split('@'); return (u.length <= 2 ? u[0] + '*' : u[0] + '*'.repeat(Math.min(u.length - 2, 5)) + u.slice(-1)) + '@' + d; };

function show(id, text, kind) { const el = $(id); el.className = 'fp-msg show ' + kind; el.textContent = text; }
function hide(id) { $(id).className = 'fp-msg'; }

function go(step) {
  ['email', 'code', 'reset', 'done'].forEach(s => $('step-' + s).classList.toggle('active', s === step));
  const n = { email: 1, code: 2, reset: 3, done: 3 }[step];
  ['p1', 'p2', 'p3'].forEach((p, i) => $(p).classList.toggle('on', i < n));
  const scroller = document.querySelector('.fp'); if (scroller) scroller.scrollTop = 0;
}

/* Secure random code (rejection sampling = no bias) */
function secureCode(len) {
  const max = 10 ** len, limit = Math.floor(0x100000000 / max) * max, buf = new Uint32Array(1);
  let n;
  do { crypto.getRandomValues(buf); n = buf[0]; } while (n >= limit);
  return String(n % max).padStart(len, '0');
}
function randomHex(bytes) { const b = new Uint8Array(bytes); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }

/* We never keep the plain code — only a salted SHA-256 hash of it */
async function hashCode(code, salt, email) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${email}:${code}`));
  return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

const loadSession = () => { try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch (e) { return null; } };
const saveSession = s => { try { sessionStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} };
const clearSession = () => { try { sessionStorage.removeItem(SKEY); } catch (e) {} };

function sendsLastHour() {
  try { const now = Date.now(); const arr = (JSON.parse(localStorage.getItem(HKEY)) || []).filter(t => now - t < 3600000); localStorage.setItem(HKEY, JSON.stringify(arr)); return arr; } catch (e) { return []; }
}
function recordSend() { try { const arr = sendsLastHour(); arr.push(Date.now()); localStorage.setItem(HKEY, JSON.stringify(arr)); } catch (e) {} }

function startCooldown(sec) {
  const btn = $('resend-btn'); clearInterval(timers.resend); let left = sec; btn.disabled = true;
  const tick = () => { btn.textContent = left > 0 ? `Resend in ${left}s` : 'Resend code'; if (left <= 0) { btn.disabled = false; clearInterval(timers.resend); } left--; };
  tick(); timers.resend = setInterval(tick, 1000);
}

/* ================= STEP 1: SEND CODE ================= */
async function issueCode(email, msgId) {
  if (!window.BizAuth || !BizAuth.supported()) { show(msgId, 'Open this page from https:// or http://localhost so secure features work.', 'err'); return false; }
  await BizAuth.ready;
  if ([EJ.publicKey, EJ.serviceId, EJ.resetTemplateId].some(v => !v || v.startsWith('YOUR_')) || !window.emailjs) {
    show(msgId, 'Email service is not set up yet. Add your EmailJS keys in js/config.js.', 'err'); return false;
  }
  if (sendsLastHour().length >= R.maxSendsPerHour) { show(msgId, 'Too many requests. Please try again in an hour.', 'err'); return false; }

  const salt = randomHex(16);
  const known = BizAuth.exists(email);

  if (known) {
    const code = secureCode(R.codeLength);
    const hash = await hashCode(code, salt, email);
    try {
      await emailjs.send(EJ.serviceId, EJ.resetTemplateId, {
        to_email: email, passcode: code, expiry_minutes: String(R.expiryMinutes), app_name: CFG.appName
      }, { publicKey: EJ.publicKey });
    } catch (err) {
      console.error('EmailJS error', err);
      show(msgId, 'We could not send the email. Please check your connection and try again.', 'err'); return false;
    }
    saveSession({ email, salt, hash, expires: Date.now() + R.expiryMinutes * 60000, attempts: 0, verified: false });
  } else {
    // Unknown email: send nothing, but behave exactly the same so nobody can learn which emails are registered.
    await sleep(700 + Math.random() * 500);
    saveSession({ email, salt, hash: randomHex(32), expires: Date.now() + R.expiryMinutes * 60000, attempts: 0, verified: false });
  }
  recordSend();
  return true;
}

$('email-form').addEventListener('submit', async e => {
  e.preventDefault(); hide('email-msg');
  const email = $('email').value.trim().toLowerCase();
  if (!emailOk(email)) { show('email-msg', 'Please enter a valid email address.', 'err'); return; }
  const btn = $('send-btn'); btn.disabled = true; btn.textContent = 'Sending…';
  const ok = await issueCode(email, 'email-msg');
  btn.disabled = false; btn.textContent = 'Send verification code';
  if (!ok) return;
  $('masked-email').textContent = maskEmail(email);
  $('exp-min').textContent = R.expiryMinutes;
  go('code'); startCooldown(R.resendCooldownSec); clearBoxes(); $('c0').focus();
});

/* ================= STEP 2: VERIFY CODE ================= */
const boxes = () => Array.from($('codes').querySelectorAll('input'));
function clearBoxes() { boxes().forEach(b => b.value = ''); }
function readCode() { return boxes().map(b => b.value).join(''); }

boxes().forEach((b, i, all) => {
  b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && all[i + 1]) all[i + 1].focus(); });
  b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && all[i - 1]) all[i - 1].focus(); });
  b.addEventListener('paste', e => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, R.codeLength);
    if (!t) return; e.preventDefault(); t.split('').forEach((ch, k) => { if (all[k]) all[k].value = ch; });
    all[Math.min(t.length, all.length - 1)].focus();
  });
});

$('code-form').addEventListener('submit', async e => {
  e.preventDefault(); hide('code-msg');
  const s = loadSession();
  if (!s) { show('code-msg', 'Your session expired. Please request a new code.', 'err'); return; }
  if (Date.now() > s.expires) { clearSession(); show('code-msg', 'This code has expired. Please request a new one.', 'err'); return; }
  const code = readCode();
  if (code.length !== R.codeLength) { show('code-msg', `Enter all ${R.codeLength} digits.`, 'err'); return; }

  s.attempts++;
  const hash = await hashCode(code, s.salt, s.email);
  if (safeEqual(hash, s.hash)) {
    s.verified = true; s.hash = ''; saveSession(s);      // one-time use: destroy the hash after success
    go('reset'); $('pw1').focus();
  } else if (s.attempts >= R.maxVerifyAttempts) {
    clearSession(); clearBoxes();
    show('code-msg', 'Too many incorrect attempts. This code has been cancelled. Please request a new one.', 'err');
  } else {
    saveSession(s); clearBoxes(); $('c0').focus();
    show('code-msg', `Incorrect code. ${R.maxVerifyAttempts - s.attempts} attempt(s) left.`, 'err');
  }
});

$('resend-btn').addEventListener('click', async () => {
  const s = loadSession(); const email = s ? s.email : $('email').value.trim().toLowerCase();
  if (!emailOk(email)) { go('email'); return; }
  hide('code-msg'); $('resend-btn').disabled = true;
  const ok = await issueCode(email, 'code-msg');
  if (ok) { clearBoxes(); $('c0').focus(); show('code-msg', 'A new code has been sent. The previous code no longer works.', 'info'); startCooldown(R.resendCooldownSec); }
  else { startCooldown(5); }
});

$('change-email').addEventListener('click', () => { clearSession(); clearBoxes(); hide('code-msg'); go('email'); $('email').focus(); });

/* ================= STEP 3: NEW PASSWORD ================= */
$('pw1').addEventListener('input', () => {
  const v = $('pw1').value;
  document.querySelectorAll('#rules li').forEach(li => li.classList.toggle('ok', BizAuth.rules[li.dataset.r](v)));
});
document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
  const i = $(b.dataset.toggle); const hidden = i.type === 'password'; i.type = hidden ? 'text' : 'password'; b.textContent = hidden ? 'Hide' : 'Show';
}));

$('reset-form').addEventListener('submit', async e => {
  e.preventDefault(); hide('reset-msg');
  const s = loadSession();
  if (!s || !s.verified || Date.now() > s.expires) { clearSession(); go('email'); show('email-msg', 'Your session expired. Please start again.', 'err'); return; }
  const p1 = $('pw1').value, p2 = $('pw2').value;
  if (!BizAuth.passwordOk(p1)) { show('reset-msg', 'Your password does not meet all the requirements.', 'err'); return; }
  if (p1 !== p2) { show('reset-msg', 'Passwords do not match.', 'err'); return; }

  const btn = $('reset-btn'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (await BizAuth.verify(s.email, p1)) { show('reset-msg', 'Please choose a password different from your current one.', 'err'); return; }
    const saved = await BizAuth.setPassword(s.email, p1);
    if (!saved) throw new Error('No account for this email');
    clearSession();
    try { sessionStorage.setItem('bizlink_reset_done', s.email); } catch (err) {}   // lets the sign-in screen pre-fill the email
    $('pw1').value = ''; $('pw2').value = ''; go('done');
  } catch (err) {
    console.error(err); show('reset-msg', 'Could not update your password. Please start again.', 'err');
  } finally { btn.disabled = false; btn.textContent = 'Reset password'; }
});

/* ================= START ================= */
if (window.emailjs && EJ.publicKey && !EJ.publicKey.startsWith('YOUR_')) emailjs.init({ publicKey: EJ.publicKey });
const pre = new URLSearchParams(location.search).get('email');
if (pre) $('email').value = pre;
