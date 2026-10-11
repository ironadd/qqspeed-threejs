const assert = require('assert');
const { loadSim } = require('./loadqq');

const QQ = loadSim();
const dt = 1 / 60;
const track = QQ.straightTrack({ hw: 220, len: 1200 });

function step(k, input, n, tr) {
  tr = tr || track;
  let last;
  for (let i = 0; i < n; i++) last = QQ.stepKart(k, input, tr, dt);
  return last;
}
function slip(k) {
  return Math.abs(Math.atan2(Math.sin(k.yaw - k.vyaw), Math.cos(k.yaw - k.vyaw)));
}
function fresh() {
  const k = QQ.createKart(track, 0);
  assert.strictEqual(k.speed, 0);
  assert.strictEqual(k.drift, false);
  assert.strictEqual(k.bottles, 0);
  assert.strictEqual(k.gauge, 0);
  return k;
}
function runup(n) {
  const k = fresh();
  step(k, { accel: 1, steer: 0, drift: 0 }, n || 160);
  assert.ok(k.speed > 20, 'runup speed ' + k.speed);
  assert.strictEqual(k.drift, false);
  return k;
}
function beginDrift(frames) {
  const k = runup();
  step(k, { accel: 1, steer: 1, drift: 1 }, frames || 24);
  assert.strictEqual(k.drift, true, 'drift must be entered by holding drift+steer');
  return k;
}
function release(k) {
  QQ.stepKart(k, { accel: 0, steer: 0, drift: 0 }, track, dt);
  assert.ok(k.sprayWindow > 0, 'releasing drift opens the 小喷 window');
  assert.strictEqual(k.drift, false);
  return k;
}
function settle(k, n) {
  let guard = 0;
  while (k.sprayWindow > 0 && guard++ < 90) {
    QQ.stepKart(k, { accel: 0, steer: 0, drift: 0, nitro: 0 }, track, dt);
  }
  step(k, { accel: 1, steer: 0, drift: 0, nitro: 0 }, n || 80);
  return k;
}
function withBottle() {
  const k = runup(140);
  for (let i = 0; i < 800 && k.bottles < 1; i++) {
    QQ.stepKart(k, { accel: k.speed < 34, steer: 1, drift: 1 }, track, dt);
  }
  assert.ok(k.bottles >= 1, 'a full gauge should have added a bottle');
  assert.ok(k.drift, 'still sliding');
  return k;
}

// Gauge formula, from a standing start into a real drift, one coasting tick.
{
  const k = beginDrift(20);
  const before = k.speed;
  const g0 = k.gauge;
  const b0 = k.bottles;
  QQ.stepKart(k, { accel: 0, steer: 1, drift: 1, brake: 0 }, track, dt);
  const lost = before - k.speed;
  assert.ok(lost > 0, 'drift tick loses speed');
  const expect = Math.max(lost * QQ.DRIFT_GAS, dt * QQ.FLOOR_GAS);
  const got = (k.gauge - g0) + (k.bottles - b0);
  assert.ok(Math.abs(got - expect) < 1e-9, 'gauge gain ' + got + ' != ' + expect);
}

// Bottle cap is 2.
{
  const k = runup(120);
  for (let i = 0; i < 900; i++) {
    QQ.stepKart(k, { accel: k.speed < 36, steer: 1, drift: 1 }, track, dt);
  }
  assert.strictEqual(k.bottles, QQ.BOTTLE_CAP);
  assert.ok(k.gauge < 1, 'full gauge must not mint a third bottle');
  const g = k.gauge;
  for (let i = 0; i < 180; i++) QQ.stepKart(k, { accel: k.speed < 36, steer: 1, drift: 1 }, track, dt);
  assert.strictEqual(k.bottles, 2);
  assert.ok(k.gauge < 1);
  assert.ok(k.gauge >= g - 1e-9);
}

// Early 小喷 ceiling beats a later edge in the same window.
function sprayAt(waitFrames) {
  const k = beginDrift(18);
  release(k);
  step(k, { accel: 0, steer: 0, drift: 0 }, waitFrames);
  assert.ok(k.sprayWindow > 0, 'window still open after ' + waitFrames);
  const ev = QQ.stepKart(k, { accel: 1, steer: 0, drift: 0 }, track, dt);
  assert.strictEqual(ev.spray, true);
  assert.strictEqual(k.sprays, 1);
  return k;
}
{
  const early = sprayAt(0);
  const late = sprayAt(18);
  assert.ok(early.smallExtra > late.smallExtra);
  assert.ok(early.ceiling > late.ceiling);
  settle(early, 90);
  settle(late, 90);
  assert.ok(early.speed > late.speed + 2, early.speed + ' vs ' + late.speed);
  assert.ok(Math.abs(early.speed - early.ceiling) < 1.5);
  assert.ok(Math.abs(late.speed - late.ceiling) < 1.5);
}

// Second accelerate edge while the first small boost is active is 双喷.
{
  const once = sprayAt(0);
  const twice = sprayAt(0);
  QQ.stepKart(twice, { accel: 0, steer: 0 }, track, dt);
  const ev = QQ.stepKart(twice, { accel: 1, steer: 0 }, track, dt);
  assert.strictEqual(ev.double, true);
  assert.strictEqual(twice.sprays, 2);
  assert.ok(twice.ceiling > once.ceiling);
  settle(once, 80);
  settle(twice, 80);
  assert.ok(twice.speed > once.speed + 2, twice.speed + ' vs ' + once.speed);
}

// Nitro alone, nitro+小喷, nitro+双喷.
function nitroScenario(kind) {
  const k = withBottle();
  release(k);
  if (kind === 'nitro') {
    const ev = QQ.stepKart(k, { accel: 0, nitro: 1, steer: 0 }, track, dt);
    assert.strictEqual(ev.nitro, true);
    assert.strictEqual(k.sprays, 0);
  } else {
    const ev = QQ.stepKart(k, { accel: 1, steer: 0, nitro: 0 }, track, dt);
    assert.strictEqual(ev.spray, true);
    if (kind === 'cww') {
      QQ.stepKart(k, { accel: 0 }, track, dt);
      const ev2 = QQ.stepKart(k, { accel: 1, nitro: 1 }, track, dt);
      assert.strictEqual(ev2.double, true);
      assert.strictEqual(ev2.nitro, true);
    } else {
      const ev2 = QQ.stepKart(k, { accel: 1, nitro: 1 }, track, dt);
      assert.strictEqual(ev2.nitro, true);
      assert.strictEqual(k.sprays, 1);
    }
  }
  return k;
}
{
  const small = sprayAt(0);
  const nitro = nitroScenario('nitro');
  const cw = nitroScenario('cw');
  const cww = nitroScenario('cww');
  assert.ok(cww.ceiling > cw.ceiling, 'CWW ' + cww.ceiling + ' CW ' + cw.ceiling);
  assert.ok(cw.ceiling > nitro.ceiling, 'CW ' + cw.ceiling + ' nitro ' + nitro.ceiling);
  assert.ok(cw.ceiling > small.ceiling, 'CW ' + cw.ceiling + ' small ' + small.ceiling);
  assert.ok(cww.ceiling > small.ceiling);
  const cwwFrac = (cww.ceiling - QQ.BASE_TOP - QQ.NITRO_EXTRA) / cww.smallExtra;
  const cwFrac = (cw.ceiling - QQ.BASE_TOP - QQ.NITRO_EXTRA) / cw.smallExtra;
  assert.ok(Math.abs(cwwFrac - 0.8) < 0.02, 'cww frac ' + cwwFrac);
  assert.ok(cwFrac < cwwFrac - 0.2, 'single overlap frac ' + cwFrac);
  settle(small, 75);
  settle(nitro, 75);
  settle(cw, 75);
  settle(cww, 75);
  assert.ok(Math.abs(cww.speed - cww.ceiling) < 2);
  assert.ok(Math.abs(cw.speed - cw.ceiling) < 2);
  assert.ok(Math.abs(nitro.speed - nitro.ceiling) < 2);
  assert.ok(Math.abs(small.speed - small.ceiling) < 2);
  assert.ok(cww.speed > cw.speed + 2);
  assert.ok(cw.speed > nitro.speed + 1);
  assert.ok(cw.speed > small.speed + 2);
  assert.ok(nitro.speed > QQ.BASE_TOP + 4);
}

// 侧身: counter-steer bends the path and does not end the drift or clear the gauge.
{
  function arm() {
    const k = runup(150);
    step(k, { accel: 1, steer: 1, drift: 1 }, 16);
    assert.strictEqual(k.drift, true);
    return k;
  }
  const hold = arm();
  const counter = arm();
  const g0 = counter.gauge;
  const b0 = counter.bottles;
  for (let i = 0; i < 50; i++) {
    QQ.stepKart(hold, { accel: 1, steer: 1, drift: 1 }, track, dt);
    QQ.stepKart(counter, { accel: 1, steer: -1, drift: 1 }, track, dt);
  }
  const dist = Math.hypot(hold.x - counter.x, hold.z - counter.z);
  assert.ok(dist > 4, 'counter-steer path delta ' + dist);
  assert.strictEqual(counter.drift, true);
  assert.strictEqual(hold.drift, true);
  assert.ok(counter.bottles >= b0);
  assert.ok(counter.gauge > 0.02, 'gauge cleared');
  assert.ok(counter.gauge + counter.bottles >= g0 + b0 - 1e-6);
}

// 断位: quick opposite re-drift cuts the slide and still opens the window.
{
  function arm() {
    const k = runup(150);
    step(k, { accel: 0, steer: 1, drift: 1 }, 36);
    assert.ok(slip(k) > 0.4, 'slip ' + slip(k));
    return k;
  }
  const cut = arm();
  const coast = arm();
  QQ.stepKart(cut, { accel: 0, steer: 0, drift: 0 }, track, dt);
  QQ.stepKart(coast, { accel: 0, steer: 0, drift: 0 }, track, dt);
  const dir = cut.driftDir || 1;
  QQ.stepKart(cut, { accel: 0, steer: -dir, drift: 1 }, track, dt);
  QQ.stepKart(coast, { accel: 0, steer: 0, drift: 0 }, track, dt);
  assert.ok(slip(cut) < slip(coast) * 0.55, 'cut ' + slip(cut) + ' coast ' + slip(coast));
  assert.ok(cut.sprayWindow > 0, '断位 keeps the 小喷 window');
}

// GO-instant accelerate edge grants a start boost. A held throttle, or an edge off the instant, does not.
{
  const hit = fresh();
  const ev = QQ.stepKart(hit, { accel: 1, go: true, steer: 0 }, track, dt);
  assert.strictEqual(ev.start, true);
  assert.ok(hit.startT > 0);
  assert.ok(hit.ceiling > QQ.BASE_TOP);
  const early = fresh();
  QQ.stepKart(early, { accel: 1, go: false }, track, dt);
  QQ.stepKart(early, { accel: 1, go: true }, track, dt);
  assert.strictEqual(early.startT, 0);
  const none = fresh();
  QQ.stepKart(none, { accel: 0, go: true }, track, dt);
  assert.strictEqual(none.startT, 0);
  settle(hit, 70);
  const plain = fresh();
  step(plain, { accel: 1, steer: 0 }, 71);
  assert.ok(hit.speed > plain.speed + 4, hit.speed + ' vs ' + plain.speed);
}

// Landing-frame edge grants 落地喷. The same edge while airborne does not.
{
  const tr = QQ.sampleTrack(QQ.TRACKS[0]);
  const lip = tr.pts.findIndex(function (p) { return p.lip; });
  assert.ok(lip > 10);
  function follow(k) {
    const n = tr.pts.length;
    const i = ((Math.round(k.idx) % n) + n) % n;
    const p = tr.pts[i];
    const want = Math.atan2(-p.tx, -p.tz);
    const d = Math.atan2(Math.sin(want - k.yaw), Math.cos(want - k.yaw));
    return Math.max(-1, Math.min(1, d * 2.5));
  }
  function spawn() {
    const k = QQ.createKart(tr, (lip - 18 + tr.n) % tr.n);
    assert.strictEqual(k.speed, 0);
    assert.strictEqual(k.airborne, false);
    return k;
  }
  // airborne edge
  {
    const k = spawn();
    let phase = 'run';
    let edged = false;
    let landed = false;
    let bad = false;
    for (let i = 0; i < 800 && !landed; i++) {
      const steer = follow(k);
      let accel = phase === 'run' || phase === 'hold';
      if (phase === 'gap') accel = false;
      if (phase === 'poke') accel = true;
      const ev = QQ.stepKart(k, { accel: accel, steer: steer, drift: 0 }, tr, dt);
      if (ev.land) bad = true;
      if (phase === 'run' && k.airborne) phase = 'gap';
      else if (phase === 'gap' && k.airborne) phase = 'poke';
      else if (phase === 'poke') { edged = true; phase = 'hold'; }
      else if (phase === 'hold' && !k.airborne) landed = true;
    }
    assert.ok(edged, 'airborne edge did not happen');
    assert.ok(landed, 'did not land');
    assert.strictEqual(bad, false);
    assert.ok(!(k.landT > 0), 'airborne edge must not grant 落地喷');
  }
  // landing edge
  {
    const k = spawn();
    let sawAir = false;
    let granted = false;
    for (let i = 0; i < 800 && !granted; i++) {
      const steer = follow(k);
      if (!sawAir) {
        QQ.stepKart(k, { accel: 1, steer: steer, drift: 0 }, tr, dt);
        if (k.airborne) sawAir = true;
        continue;
      }
      const probe = JSON.parse(JSON.stringify(k));
      QQ.stepKart(probe, { accel: 1, steer: steer, drift: 0 }, tr, dt);
      if (probe.justLanded) {
        const ev = QQ.stepKart(k, { accel: 1, steer: steer, drift: 0 }, tr, dt);
        assert.strictEqual(ev.land, true);
        assert.ok(k.justLanded);
        assert.ok(k.landT > 0);
        granted = true;
      } else {
        QQ.stepKart(k, { accel: 0, steer: steer, drift: 0 }, tr, dt);
        assert.ok(k.airborne, 'fell out of the air before the landing edge');
      }
    }
    assert.ok(sawAir);
    assert.ok(granted, 'landing edge did not fire');
    const before = k.speed;
    settle(k, 70);
    assert.ok(k.speed > QQ.BASE_TOP - 1 || k.ceiling >= QQ.BASE_TOP + QQ.LAND_EXTRA - 0.1);
    assert.ok(k.speed >= before - 1);
  }
}

// Barrier contact removes a large fraction of speed.
{
  const wall = QQ.straightTrack({ hw: 8.5, len: 600 });
  const k = QQ.createKart(wall, 0);
  let hit = null;
  for (let i = 0; i < 500 && !hit; i++) {
    const before = k.speed;
    const ev = QQ.stepKart(k, { accel: 1, steer: 1, drift: 0 }, wall, dt);
    if (ev.wall) hit = { before: before, after: k.speed };
  }
  assert.ok(hit, 'never reached a barrier');
  assert.ok(hit.before > 8, 'hit too slow ' + hit.before);
  assert.ok(hit.after < hit.before * 0.97, hit.after + ' / ' + hit.before);
}

// One tick from rest with forward and steer both set moves and yaws.
{
  const k = fresh();
  const y0 = k.yaw, x0 = k.x, z0 = k.z;
  QQ.stepKart(k, { accel: 1, steer: 1 }, track, dt);
  assert.ok(Math.hypot(k.x - x0, k.z - z0) > 0, 'did not advance');
  assert.ok(Math.abs(k.yaw - y0) > 0, 'did not yaw');
}

// A forward hold already true at GO is not 起步喷. A 小喷 edge on that same hold is.
{
  const held = fresh();
  QQ.stepKart(held, { accel: 1, steer: 0 }, track, dt);
  const ev = QQ.stepKart(held, { accel: 1, go: true, steer: 0 }, track, dt);
  assert.strictEqual(ev.start, false);
  assert.strictEqual(held.startT, 0);
  const tap = fresh();
  QQ.stepKart(tap, { accel: 1, steer: 0 }, track, dt);
  const ev2 = QQ.stepKart(tap, { accel: 1, go: true, spray: 1, steer: 0 }, track, dt);
  assert.strictEqual(ev2.start, true);
  assert.ok(tap.startT > 0);
}

// 小喷 and 双喷 still fire when forward stays held and only the spray control edges.
{
  const k = beginDrift(18);
  QQ.stepKart(k, { accel: 1, steer: 0, drift: 0, spray: 0 }, track, dt);
  assert.ok(k.sprayWindow > 0);
  const ev = QQ.stepKart(k, { accel: 1, spray: 1, steer: 0 }, track, dt);
  assert.strictEqual(ev.spray, true);
  assert.strictEqual(k.sprays, 1);
  QQ.stepKart(k, { accel: 1, spray: 0 }, track, dt);
  const ev2 = QQ.stepKart(k, { accel: 1, spray: 1 }, track, dt);
  assert.strictEqual(ev2.double, true);
  assert.ok(k.ceiling > QQ.BASE_TOP + k.smallExtra);
}

console.log('drift tests passed');
