const assert = require('assert');
const { loadSim } = require('./loadqq');

const QQ = loadSim();

function analyze(pts) {
  const n = pts.length;
  const head = [];
  const ds = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    head.push(Math.atan2(b.x - a.x, b.z - a.z));
    ds.push(Math.hypot(b.x - a.x, b.z - a.z));
  }
  const dth = head.map(function (h, i) {
    let d = h - head[(i - 1 + n) % n];
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  });
  function win(i, count) {
    let s = 0, len = 0, opp = 0, sign = 0;
    for (let k = 0; k < count; k++) {
      const t = dth[(i + k) % n];
      if (Math.abs(t) > 0.004) {
        const sg = Math.sign(t);
        if (!sign) sign = sg;
        else if (sg !== sign) opp += Math.abs(t);
      }
      s += t;
      len += ds[(i + k) % n];
    }
    return { s: s, len: len, opp: opp };
  }
  let hair = false, ell = false, sweep = false;
  for (let i = 0; i < n; i++) {
    for (let count = 4; count <= 80; count += 2) {
      const w = win(i, count);
      if (w.opp < 0.5 && Math.abs(w.s) >= 2.3 && w.len <= 100) hair = true;
      if (w.opp < 0.35 && Math.abs(w.s) >= 1.15 && Math.abs(w.s) <= 2.0 && w.len <= 55) ell = true;
      if (w.opp < 0.6 && Math.abs(w.s) >= 1.35 && w.len >= 90) sweep = true;
    }
  }
  const uniq = [];
  for (let i = 0; i < n; i++) {
    const w = win(i, 8);
    if (Math.abs(w.s) > 0.55 && w.opp < 0.35) {
      if (!uniq.some(function (u) {
        let di = Math.abs(u.i - i);
        di = Math.min(di, n - di);
        return di < 10 && Math.sign(u.s) === Math.sign(w.s);
      })) uniq.push({ i: i, s: w.s });
    }
  }
  let ess = false;
  for (let a = 0; a < uniq.length; a++) {
    for (let b = a + 1; b < uniq.length; b++) {
      if (Math.sign(uniq[a].s) === Math.sign(uniq[b].s)) continue;
      if (Math.abs(uniq[a].s) < 0.6 || Math.abs(uniq[b].s) < 0.6) continue;
      let di = Math.abs(uniq[a].i - uniq[b].i);
      di = Math.min(di, n - di);
      const along = di * 2.5;
      if (along >= 12 && along <= 80) ess = true;
    }
  }
  return { hair: hair, ell: ell, sweep: sweep, ess: ess };
}

function follow(k, tr) {
  const n = tr.pts.length;
  const i = ((Math.round(k.idx) % n) + n) % n;
  const p = tr.pts[i];
  const want = Math.atan2(-p.tx, -p.tz);
  const d = Math.atan2(Math.sin(want - k.yaw), Math.cos(want - k.yaw));
  return Math.max(-1, Math.min(1, d * 2.5));
}

assert.strictEqual(QQ.TRACKS.length, 3);
const themes = QQ.TRACKS.map(function (t) { return t.theme; });
const names = QQ.TRACKS.map(function (t) { return t.name; });
assert.strictEqual(new Set(themes).size, 3);
assert.strictEqual(new Set(names).size, 3);
const cities = QQ.TRACKS.filter(function (t) { return t.type === 'city'; });
assert.ok(cities.length >= 2);

const lengths = [];
for (let ti = 0; ti < QQ.TRACKS.length; ti++) {
  const def = QQ.TRACKS[ti];
  const tr = QQ.sampleTrack(def);
  assert.strictEqual(tr.name, def.name);
  assert.strictEqual(tr.theme, def.theme);
  assert.ok(tr.pts.length > 40);
  const pts = tr.pts;
  const n = pts.length;
  const close = Math.hypot(pts[0].x - pts[n - 1].x, pts[0].z - pts[n - 1].z);
  assert.ok(close < 6, def.name + ' not closed ' + close);
  let loop = 0;
  let minY = 1e9, maxY = -1e9;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    loop += Math.hypot(b.x - a.x, b.z - a.z);
    if (a.y < minY) minY = a.y;
    if (a.y > maxY) maxY = a.y;
  }
  lengths.push(Math.round(loop));
  assert.ok(maxY - minY > 4, def.name + ' flat ' + minY + '..' + maxY);
  const cls = analyze(pts);
  assert.ok(cls.hair, def.name + ' missing hairpin/U');
  assert.ok(cls.ess, def.name + ' missing S or opposite corners');
  assert.ok(cls.ell, def.name + ' missing L or right-angle');
  assert.ok(cls.sweep, def.name + ' missing long sweep');
  assert.ok(pts.some(function (p) { return p.lip; }), def.name + ' missing jump lip');
  assert.ok(pts.some(function (p) { return p.gap; }), def.name + ' missing jump gap');
  assert.ok(pts.some(function (p) { return p.pad; }), def.name + ' missing boost pad');
  assert.ok(pts.some(function (p) { return p.marker; }), def.name + ' missing turn marker');
  const bends = pts.filter(function (p) { return Math.abs(p.curv) > 0.02; });
  assert.ok(bends.length > 8, def.name + ' bends');
  const banks = bends.map(function (p) { return Math.abs(p.bank); }).sort(function (a, b) { return a - b; });
  assert.ok(banks[banks.length >> 1] > 0.05, def.name + ' banking ' + banks[banks.length >> 1]);
  if (def.type === 'city') {
    assert.ok(banks[banks.length >> 1] > 0.05, def.name + ' city bank forced low');
    assert.ok(pts.some(function (p) { return Math.abs(p.bank) > 0.1; }));
  }

  const lip = pts.findIndex(function (p) { return p.lip; });
  const k = QQ.createKart(tr, (lip - 18 + tr.n) % tr.n);
  assert.strictEqual(k.speed, 0);
  assert.strictEqual(k.airborne, false);
  let air = false;
  for (let i = 0; i < 500 && !air; i++) {
    QQ.stepKart(k, { accel: 1, steer: follow(k, tr), drift: 0 }, tr, 1 / 60);
    if (k.airborne) air = true;
  }
  assert.ok(air, def.name + ' jump did not leave the kart airborne');
}

assert.strictEqual(new Set(lengths).size, 3, 'circuits should not be the same length ' + lengths.join(','));
console.log('track tests passed');
