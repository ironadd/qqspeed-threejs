const assert = require('assert');
const { loadSim } = require('./loadqq');
const QQ = loadSim();
const dt = 1 / 60;
const wide = QQ.straightTrack({ hw: 220, len: 3000 });
function run(k, inp, n, tr) { let ev = []; for (let i = 0; i < n; i++) ev.push(QQ.stepKart(k, typeof inp === 'function' ? inp(i, k) : inp, tr || wide, dt)); return ev; }
const kmh = v => v * 3.6;

// 1. 基础极速 150-170 km/h，氮气约 +30%
{
  const k = QQ.createKart(wide, 0); run(k, { accel: 1 }, 900);
  assert.ok(kmh(k.speed) >= 150 && kmh(k.speed) <= 170, 'base top ' + kmh(k.speed));
  assert.ok(Math.abs(k.speed - QQ.BASE_TOP) < 1e-6);
  const ratio = (QQ.BASE_TOP + QQ.NITRO_EXTRA) / QQ.BASE_TOP;
  assert.ok(ratio > 1.22 && ratio < 1.38, 'nitro ratio ' + ratio);
  k.bottles = 1; run(k, { accel: 1, nitro: 1 }, 1); run(k, { accel: 1 }, 100);
  assert.ok(k.speed <= QQ.BASE_TOP + QQ.NITRO_EXTRA + 1e-6 && k.speed > QQ.BASE_TOP + 5, 'nitro speed ' + k.speed);
}
// 2. 加速放缓：0→100km/h 约 2 s 以上
{
  const k = QQ.createKart(wide, 0); let t = 0; while (kmh(k.speed) < 100 && t < 10) { QQ.stepKart(k, { accel: 1 }, wide, dt); t += dt; }
  assert.ok(t > 1.6 && t < 3.5, '0-100 ' + t.toFixed(2));
}
// 3. 普通转向掉速：越打方向越慢，满舵明显低于直线
function steady(steer) { const k = QQ.createKart(wide, 0); run(k, { accel: 1 }, 700); run(k, { accel: 1, steer }, 300); return k.speed; }
{
  const s0 = steady(0), s5 = steady(0.5), s1 = steady(1);
  assert.ok(s0 > s5 && s5 > s1, `steer scrub monotonic ${s0} ${s5} ${s1}`);
  assert.ok(s1 < s0 * 0.85, 'full lock should cost >15%: ' + (s1 / s0));
  assert.ok(s5 > s0 * 0.85, 'half lock mild: ' + (s5 / s0));
}
// 4. 撞墙掉速明显，漂移撞墙更狠
{
  const narrow = QQ.straightTrack({ hw: 8.5, len: 3000 });
  const k = QQ.createKart(narrow, 0); run(k, { accel: 1 }, 600, narrow);
  const v0 = k.speed; k.yaw += 0.5; k.vyaw = k.yaw; let hit = false;
  for (let i = 0; i < 200 && !hit; i++) hit = QQ.stepKart(k, { accel: 1 }, narrow, dt).wall;
  assert.ok(hit, 'reaches the wall'); assert.ok(k.speed < v0 * 0.62, 'wall loss ' + k.speed / v0);
}
// 5. 漂移太久/甩太开掉速更多
function driftFor(sec, steer) { const k = QQ.createKart(wide, 0); run(k, { accel: 1 }, 700); const v0 = k.speed; run(k, { accel: 1, steer: 1, drift: 1 }, 6); run(k, { accel: 1, steer, drift: 1 }, Math.round(sec / dt)); return k.speed / v0; }
{
  assert.ok(driftFor(3.0, 0.2) < driftFor(1.2, 0.2) - 0.02, 'long drift penalised');
  assert.ok(driftFor(1.4, 1) < driftFor(1.4, -0.3), 'wide drift penalised');
}
// 6. 漂移+小喷的出弯速度比满舵硬转更快（技术有回报），且集气仍然有效
{
  const a = QQ.createKart(wide, 0); run(a, { accel: 1 }, 700);
  run(a, { accel: 1, steer: 1, drift: 1 }, 50); assert.ok(a.gauge > 0 || a.bottles > 0, 'drift still charges');
  run(a, { accel: 0, steer: 0, drift: 0 }, 1); run(a, { accel: 1, steer: 0, spray: 1 }, 1); run(a, { accel: 1 }, 90);
  const b = QQ.createKart(wide, 0); run(b, { accel: 1 }, 700); run(b, { accel: 1, steer: 1 }, 50); run(b, { accel: 1 }, 92);
  assert.ok(a.speed > b.speed, `drift+jet ${a.speed.toFixed(1)} vs grip ${b.speed.toFixed(1)}`);
}
// 7. 路面平滑：无高频起伏、无逐点扭转（跳台附近除外）
for (const d of QQ.TRACKS) {
  const t = QQ.sampleTrack(d), p = t.pts, n = p.length, h = t.spacing; let m2 = 0, mb = 0, m3 = 0;
  for (let i = 0; i < n; i++) {
    let skip = false; for (let q = -22; q <= 22; q++) { const r = p[(i + q + n) % n]; if (r.gap || r.lip) skip = true; }
    if (skip) continue;
    const y = q => p[(i + q + n) % n].y;
    m2 = Math.max(m2, Math.abs(y(-1) - 2 * y(0) + y(1)) / (h * h));
    m3 = Math.max(m3, Math.abs(y(2) - 2 * y(1) + 2 * y(-1) - y(-2)) / (2 * h * h * h));
    mb = Math.max(mb, Math.abs(p[(i + 1) % n].bank - p[i].bank));
  }
  assert.ok(m2 < 0.006, d.name + " y'' " + m2);
  assert.ok(m3 < 0.002, d.name + " y''' " + m3);
  assert.ok(mb < 0.04, d.name + ' bank jitter ' + mb);
}
console.log('handling + smoothness passed');
