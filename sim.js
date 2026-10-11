/* QQ飞车竞速链与赛道采样。无 THREE、无 DOM、无 module。页面用经典 script 装上 window.QQ。 */
(function (root) {
  var QQ = {};
  QQ.BASE_TOP = 48;
  QQ.DRIFT_GAS = 0.12;
  QQ.FLOOR_GAS = 0.16;
  QQ.NITRO_EXTRA = 22;
  QQ.SMALL_LO = 7;
  QQ.SMALL_HI = 16;
  QQ.DOUBLE_MULT = 1.45;
  QQ.CW_FRAC = 0.3;
  QQ.CWW_FRAC = 0.8;
  QQ.WALL_MUL = 0.62;
  QQ.BOTTLE_CAP = 2;
  QQ.SMALL_TIME = 2.2;
  QQ.NITRO_TIME = 2.4;
  QQ.WINDOW = 0.5;
  QQ.CUT = 0.3;
  QQ.START_EXTRA = 13;
  QQ.START_TIME = 1.6;
  QQ.LAND_EXTRA = 12;
  QQ.LAND_TIME = 1.4;
  QQ.GO_WINDOW = 0.18;
  QQ.HW = 8.5;
  QQ.SPACING = 2.5;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function angDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function lerpAngle(a, b, t) { return a - angDiff(a, b) * clamp(t, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function ceilingOf(k) {
    var extra = 0;
    var smallOn = k.smallT > 0;
    var nitroOn = k.nitroT > 0;
    if (nitroOn && smallOn) {
      var frac = k.sprays >= 2 ? QQ.CWW_FRAC : QQ.CW_FRAC;
      extra = QQ.NITRO_EXTRA + frac * k.smallExtra;
    } else if (nitroOn) {
      extra = QQ.NITRO_EXTRA;
    } else if (smallOn) {
      extra = k.sprays >= 2 ? k.smallExtra * QQ.DOUBLE_MULT : k.smallExtra;
    }
    if (k.startT > 0) extra = Math.max(extra, QQ.START_EXTRA);
    if (k.landT > 0) extra = Math.max(extra, QQ.LAND_EXTRA);
    if (k.padT > 0) extra = Math.max(extra, 8);
    k.ceiling = QQ.BASE_TOP + extra;
    return k.ceiling;
  }

  function groundAt(track, k) {
    var pts = track.pts;
    var n = pts.length;
    var idx = k.idx || 0;
    if (track.open) idx = clamp(idx, 0, n - 1.000001);
    else idx = ((idx % n) + n) % n;
    var i0 = Math.floor(idx) % n;
    var i1 = (i0 + 1) % n;
    var f = idx - Math.floor(idx);
    if (f < 0) f = 0;
    var y = lerp(pts[i0].y, pts[i1].y, f);
    var bank = lerp(pts[i0].bank || 0, pts[i1].bank || 0, f);
    var lat = k.lat || 0;
    return {
      y: y + lat * Math.sin(bank),
      gap: !!(pts[i0].gap || pts[i1].gap),
      lip: !!(pts[i0].lip || pts[i1].lip),
      pad: !!(pts[i0].pad || pts[i1].pad),
      padLat: pts[i0].pad ? (pts[i0].padLat || 0) : (pts[i1].padLat || 0),
      i0: i0
    };
  }

  function project(k, track) {
    var pts = track.pts;
    var n = pts.length;
    var bi = Math.round(k.idx || 0);
    var span = track.open ? 15 : 40;
    var best = 1e18;
    var found = clamp(bi, 0, n - 1);
    for (var d = -span; d <= span; d++) {
      var i = track.open ? bi + d : ((bi + d) % n + n) % n;
      if (i < 0 || i >= n) continue;
      var p = pts[i];
      var dd = (p.x - k.x) * (p.x - k.x) + (p.z - k.z) * (p.z - k.z);
      if (dd < best) { best = dd; found = i; }
    }
    var p0 = pts[found];
    var along = (k.x - p0.x) * p0.tx + (k.z - p0.z) * p0.tz;
    var spacing = track.spacing || QQ.SPACING;
    var fi = found + along / spacing;
    if (track.open) k.idx = clamp(fi, 0, n - 1.000001);
    else k.idx = ((fi % n) + n) % n;
    k.lat = (k.x - p0.x) * p0.sx + (k.z - p0.z) * p0.sz;
    return found;
  }

  QQ.createKart = function (track, idx) {
    var n = track.pts.length;
    idx = idx == null ? 0 : idx;
    if (track.open) idx = clamp(idx, 0, n - 1);
    else idx = ((idx % n) + n) % n;
    var p = track.pts[Math.floor(idx) % n];
    var yaw = Math.atan2(-p.tx, -p.tz);
    return {
      x: p.x, y: p.y, z: p.z,
      yaw: yaw, vyaw: yaw, speed: 0, steer: 0,
      drift: false, driftDir: 1, driftT: 0,
      gauge: 0, bottles: 0,
      smallT: 0, smallExtra: 0, sprays: 0,
      nitroT: 0, startT: 0, landT: 0, padT: 0,
      sprayWindow: 0, sprayMax: 0, cutLeft: 0,
      goLeft: 0, startSpent: false,
      airborne: false, vy: 0, justLanded: false, lipLatch: false,
      ceiling: QQ.BASE_TOP,
      prevAccel: false, prevNitro: false, prevDrift: false, prevSpray: false,
      idx: idx, lat: 0, wallCd: 0, padCd: 0
    };
  };

  QQ.straightTrack = function (opts) {
    opts = opts || {};
    var len = opts.len || 800;
    var hw = opts.hw == null ? 200 : opts.hw;
    var n = Math.max(8, Math.floor(len / QQ.SPACING));
    var pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: 0, y: 0, z: -i * QQ.SPACING,
        tx: 0, tz: -1, sx: 1, sz: 0,
        bank: 0, curv: 0, gap: false, lip: false, pad: false, marker: 0, padLat: 0
      });
    }
    return { pts: pts, len: n * QQ.SPACING, n: n, hw: hw, open: true, spacing: QQ.SPACING, name: 'straight', theme: 'test', type: 'test' };
  };

  QQ.stepKart = function (k, input, track, dt) {
    input = input || {};
    dt = clamp(dt || (1 / 60), 0.001, 0.05);
    var ev = { bottle: false, spray: false, double: false, nitro: false, wall: false, land: false, start: false, pad: false, cut: false };
    var accel = !!input.accel;
    var steerIn = clamp(+input.steer || 0, -1, 1);
    var driftIn = !!input.drift;
    var nitroIn = !!input.nitro;
    var brake = !!input.brake;
    var sprayIn = !!input.spray;
    var accelEdge = (accel && !k.prevAccel) || (sprayIn && !k.prevSpray);
    var nitroEdge = nitroIn && !k.prevNitro;

    if (input.go) k.goLeft = QQ.GO_WINDOW;
    if (accelEdge && k.goLeft > 0 && !k.startSpent) {
      k.startT = QQ.START_TIME;
      k.startSpent = true;
      k.goLeft = 0;
      ev.start = true;
    } else if (k.goLeft > 0) {
      k.goLeft -= dt;
    }

    k.steer += (steerIn - k.steer) * Math.min(1, dt * 14);

    var cutNow = false;
    if (!k.drift && driftIn && k.cutLeft > 0 && steerIn * k.driftDir < -0.4) {
      k.vyaw = lerpAngle(k.vyaw, k.yaw, 0.82);
      k.cutLeft = 0;
      k.sprayWindow = Math.max(k.sprayWindow, QQ.WINDOW);
      k.sprayMax = Math.max(k.sprayMax || 0, QQ.WINDOW);
      cutNow = true;
      ev.cut = true;
    }
    if (!cutNow && driftIn && !k.drift && Math.abs(steerIn) > 0.45 && k.speed > 14 && !k.airborne) {
      k.drift = true;
      k.driftDir = Math.sign(steerIn) || 1;
      k.driftT = 0;
    } else if (k.drift && !driftIn) {
      k.drift = false;
      k.sprayWindow = QQ.WINDOW;
      k.sprayMax = QQ.WINDOW;
      k.cutLeft = QQ.CUT;
    }

    if (k.drift) {
      k.driftT += dt;
      var yawRate = k.driftDir * 1.55 + steerIn * 2.15;
      k.yaw += yawRate * dt;
      var follow = (steerIn * k.driftDir < -0.2) ? 3.6 : 1.65;
      k.vyaw = lerpAngle(k.vyaw, k.yaw, Math.min(1, dt * follow));
    }

    if (accelEdge && k.sprayWindow > 0 && k.smallT <= 0) {
      var early = clamp(k.sprayWindow / (k.sprayMax || QQ.WINDOW), 0, 1);
      k.smallExtra = QQ.SMALL_LO + (QQ.SMALL_HI - QQ.SMALL_LO) * early;
      k.smallT = QQ.SMALL_TIME;
      k.sprays = 1;
      k.sprayWindow = 0;
      ev.spray = true;
    } else if (accelEdge && k.smallT > 0 && k.sprays === 1) {
      k.sprays = 2;
      k.smallT = Math.max(k.smallT, QQ.SMALL_TIME * 0.75);
      ev.double = true;
    }
    if (nitroEdge && k.bottles > 0) {
      k.bottles -= 1;
      k.nitroT = QQ.NITRO_TIME;
      ev.nitro = true;
    }

    var capNow = ceilingOf(k);
    var charging = k.drift;
    var before = k.speed;
    var slip = Math.abs(angDiff(k.yaw, k.vyaw));
    if (k.drift) k.speed -= (2.4 + slip * 5) * dt;
    if (brake) k.speed -= 40 * dt;
    else if (!accel) k.speed -= 5 * dt;
    var boosting = k.smallT > 0 || k.nitroT > 0 || k.startT > 0 || k.landT > 0 || k.padT > 0;
    if (accel && !brake) {
      var rate = boosting ? 42 : 24;
      if (k.speed < capNow) k.speed = Math.min(capNow, k.speed + rate * dt);
      else k.speed = Math.max(capNow, k.speed - 16 * dt);
    }
    if (k.speed > capNow + 1e-8) k.speed = Math.max(capNow, k.speed - 30 * dt);
    if (k.speed < -8) k.speed = -8;
    if (!k.drift) {
      var grip = clamp(k.speed / 14, 0, 1);
      k.yaw += steerIn * 2.15 * grip * dt;
      k.vyaw = lerpAngle(k.vyaw, k.yaw, Math.min(1, dt * 8));
    }

    if (k.drift && k.speed < 8) {
      k.drift = false;
      k.sprayWindow = QQ.WINDOW;
      k.sprayMax = QQ.WINDOW;
      k.cutLeft = QQ.CUT;
    }
    if (charging) {
      var speedLost = Math.max(0, before - k.speed);
      var gain = Math.max(speedLost * QQ.DRIFT_GAS, dt * QQ.FLOOR_GAS);
      k.gauge += gain;
      while (k.gauge >= 1 && k.bottles < QQ.BOTTLE_CAP) {
        k.gauge -= 1;
        k.bottles += 1;
        ev.bottle = true;
      }
      if (k.bottles >= QQ.BOTTLE_CAP && k.gauge >= 1) k.gauge = 0.999999;
    }

    var vx = -Math.sin(k.vyaw);
    var vz = -Math.cos(k.vyaw);
    k.x += vx * k.speed * dt;
    k.z += vz * k.speed * dt;
    project(k, track);

    var hw = track.hw == null ? QQ.HW : track.hw;
    if (!k.airborne && Math.abs(k.lat) > hw) {
      var bi = Math.floor(k.idx) % track.pts.length;
      var s = track.pts[bi];
      var sgn = Math.sign(k.lat);
      var over = Math.abs(k.lat) - hw;
      k.x -= s.sx * sgn * over;
      k.z -= s.sz * sgn * over;
      k.lat = sgn * hw;
      if (k.speed > 8 && k.wallCd <= 0) {
        k.speed *= QQ.WALL_MUL;
        k.wallCd = 0.4;
        ev.wall = true;
        k.drift = false;
      }
    }
    if (k.wallCd > 0) k.wallCd -= dt;

    var g = groundAt(track, k);
    var wasAir = k.airborne;
    if (!k.airborne) {
      if (g.lip && k.speed > 10 && !k.lipLatch) {
        k.airborne = true;
        k.vy = 8 + k.speed * 0.11;
        k.y = g.y + 0.25;
        k.lipLatch = true;
      } else {
        k.y = g.y;
        k.vy = 0;
        if (!g.lip) k.lipLatch = false;
      }
    } else {
      k.vy -= 26 * dt;
      k.y += k.vy * dt;
      if (!g.gap && k.vy <= 0 && k.y <= g.y) {
        k.y = g.y;
        k.vy = 0;
        k.airborne = false;
        k.lipLatch = true;
      }
    }
    k.justLanded = wasAir && !k.airborne;
    if (k.justLanded && accelEdge) {
      k.landT = QQ.LAND_TIME;
      ev.land = true;
    }

    if (!k.airborne && g.pad && Math.abs(k.lat - (g.padLat || 0)) < 3.2 && k.padCd <= 0) {
      k.padT = 0.55;
      k.padCd = 0.9;
      ev.pad = true;
    }
    if (k.padCd > 0) k.padCd -= dt;

    if (k.smallT > 0) k.smallT = Math.max(0, k.smallT - dt);
    if (k.nitroT > 0) k.nitroT = Math.max(0, k.nitroT - dt);
    if (k.startT > 0) k.startT = Math.max(0, k.startT - dt);
    if (k.landT > 0) k.landT = Math.max(0, k.landT - dt);
    if (k.padT > 0) k.padT = Math.max(0, k.padT - dt);
    if (k.sprayWindow > 0) k.sprayWindow = Math.max(0, k.sprayWindow - dt);
    if (k.cutLeft > 0) k.cutLeft = Math.max(0, k.cutLeft - dt);

    ceilingOf(k);
    k.prevAccel = accel;
    k.prevNitro = nitroIn;
    k.prevDrift = driftIn;
    k.prevSpray = sprayIn;
    return ev;
  };

  QQ.groundAt = groundAt;

  function knot(x, z, y, r, jump) {
    return { x: x, z: z, y: y, r: r == null ? 16 : r, jump: jump ? 1 : 0 };
  }
  function arcKnots(cx, cz, radius, a0, a1, y0, y1, steps, fillet) {
    var out = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var a = a0 + (a1 - a0) * t;
      out.push(knot(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius, y0 + (y1 - y0) * t, fillet || 12, false));
    }
    return out;
  }
  // U-turn that leaves the exit leg a full diameter away from the entry leg.
  function hairpin(cx, cz, radius, y0, y1) {
    return arcKnots(cx, cz, radius, Math.PI, 0.08, y0, y1, 8, Math.min(12, radius * 0.45));
  }

  function sampleLoop(knots) {
    var nK = knots.length;
    var raw = [];
    function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
    function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
    function mul(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
    function horiz(a) { return Math.hypot(a.x, a.z); }
    var last = knots[nK - 1], first = knots[0];
    raw.push({ x: (last.x + first.x) / 2, y: (last.y + first.y) / 2, z: (last.z + first.z) / 2 });
    for (var i = 0; i < nK; i++) {
      var c = knots[i];
      var pv = knots[(i - 1 + nK) % nK];
      var nx = knots[(i + 1) % nK];
      var a = sub(c, pv), b = sub(nx, c);
      var la = horiz(a) || 1, lb = horiz(b) || 1;
      var au = { x: a.x / la, z: a.z / la };
      var bu = { x: b.x / lb, z: b.z / lb };
      var dot = clamp(au.x * bu.x + au.z * bu.z, -1, 1);
      var th = Math.acos(dot);
      var rad = c.r || 16;
      var t = rad * Math.tan(th / 2);
      if (!isFinite(t)) t = Math.min(la, lb) * 0.45;
      t = Math.min(Math.max(t, 0), la * 0.45, lb * 0.45);
      var p1 = { x: c.x - au.x * t, y: lerp(pv.y, c.y, 1 - t / la), z: c.z - au.z * t };
      var p2 = { x: c.x + bu.x * t, y: lerp(c.y, nx.y, t / lb), z: c.z + bu.z * t };
      var segs = th > 2.2 ? 28 : th > 1 ? 16 : 8;
      for (var k = 0; k <= segs; k++) {
        var u = k / segs;
        var omu = 1 - u;
        var p = add(add(mul(p1, omu * omu), mul({ x: c.x, y: c.y, z: c.z }, 2 * u * omu)), mul(p2, u * u));
        raw.push(p);
      }
    }
    var cum = [0];
    for (var r = 1; r <= raw.length; r++) {
      var A = raw[r - 1], B = raw[r % raw.length];
      cum.push(cum[cum.length - 1] + Math.hypot(B.x - A.x, B.z - A.z));
    }
    var total = cum[cum.length - 1];
    var M = Math.max(24, Math.floor(total / QQ.SPACING));
    var pts = [];
    var j = 0;
    for (var s = 0; s < M; s++) {
      var d = s * total / M;
      while (j + 1 < cum.length - 1 && cum[j + 1] < d) j++;
      var span = (cum[j + 1] - cum[j]) || 1;
      var f = clamp((d - cum[j]) / span, 0, 1);
      var P = raw[j], Q = raw[(j + 1) % raw.length];
      pts.push({
        x: lerp(P.x, Q.x, f), y: lerp(P.y, Q.y, f), z: lerp(P.z, Q.z, f),
        gap: false, lip: false, pad: false, marker: 0, padLat: 0, bank: 0, curv: 0
      });
    }
    for (var i2 = 0; i2 < M; i2++) {
      var nxt = pts[(i2 + 1) % M], prv = pts[(i2 - 1 + M) % M];
      var tx = nxt.x - prv.x, tz = nxt.z - prv.z;
      var L = Math.hypot(tx, tz) || 1;
      pts[i2].tx = tx / L;
      pts[i2].tz = tz / L;
      pts[i2].sx = -pts[i2].tz;
      pts[i2].sz = pts[i2].tx;
    }
    var curv = new Array(M);
    for (var i3 = 0; i3 < M; i3++) {
      var h0 = Math.atan2(pts[i3].tx, pts[i3].tz);
      var h1 = Math.atan2(pts[(i3 + 1) % M].tx, pts[(i3 + 1) % M].tz);
      var ds = Math.hypot(pts[(i3 + 1) % M].x - pts[i3].x, pts[(i3 + 1) % M].z - pts[i3].z) || QQ.SPACING;
      curv[i3] = angDiff(h0, h1) / ds * -1;
    }
    var sm = new Array(M);
    for (var i4 = 0; i4 < M; i4++) {
      var acc = 0;
      for (var k2 = -3; k2 <= 3; k2++) acc += curv[(i4 + k2 + M) % M];
      sm[i4] = acc / 7;
      pts[i4].curv = sm[i4];
      pts[i4].bank = clamp(-sm[i4] * 9, -0.42, 0.42);
    }
    for (var i5 = 0; i5 < nK; i5++) {
      if (!knots[i5].jump) continue;
      var best = 1e18, bi = 0;
      for (var i6 = 0; i6 < M; i6++) {
        var dd = (pts[i6].x - knots[i5].x) * (pts[i6].x - knots[i5].x) + (pts[i6].z - knots[i5].z) * (pts[i6].z - knots[i5].z);
        if (dd < best) { best = dd; bi = i6; }
      }
      var ramp = 6.5, drop = 8;
      for (var k3 = -16; k3 <= 18; k3++) {
        var ii = (bi + k3 + M) % M;
        var p = pts[ii];
        if (k3 < -1) {
          var u2 = (k3 + 16) / 15;
          p.y += ramp * u2 * u2;
        } else if (k3 <= 1) {
          p.y += ramp;
          p.lip = true;
        } else if (k3 <= 12) {
          p.y += ramp - drop;
          p.gap = true;
          p.pad = false;
        } else {
          var u3 = (k3 - 12) / 6;
          p.y += (ramp - drop) * (1 - u3);
        }
      }
    }
    var runs = [];
    var runS = -1;
    for (var i7 = 0; i7 <= M; i7++) {
      var low = i7 < M && Math.abs(sm[i7]) < 0.012 && !pts[i7].gap && !pts[i7].lip;
      if (low && runS < 0) runS = i7;
      if (!low && runS >= 0) { runs.push([runS, i7]); runS = -1; }
    }
    runs.sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); });
    var placed = 0;
    for (var ri = 0; ri < runs.length && placed < 4; ri++) {
      var a0 = runs[ri][0], b0 = runs[ri][1];
      if (b0 - a0 < 8) continue;
      var mid = (a0 + b0) >> 1;
      pts[mid].pad = true;
      pts[mid].padLat = placed % 2 ? 2.4 : -2.4;
      placed++;
    }
    var lastMk = -100;
    for (var i8 = 0; i8 < M; i8++) {
      if (Math.abs(sm[i8]) > 0.018 && i8 - lastMk > 12) {
        pts[i8].marker = sm[i8] > 0 ? 1 : -1;
        lastMk = i8;
      }
    }
    return { pts: pts, len: total, n: M, hw: QQ.HW, spacing: total / M, open: false, sm: sm };
  }

  function scenery(extra) {
    var o = {
      sky: extra.sky, fog: extra.fog, fogD: extra.fogD,
      sun: extra.sun, sunC: extra.sunC, sunI: extra.sunI,
      hemi: extra.hemi, hemiI: extra.hemiI, ground: extra.ground,
      bh: extra.bh, clouds: extra.clouds, night: !!extra.night, snow: !!extra.snow,
      water: false
    };
    return o;
  }

  function makeTrack(meta, knots) {
    var def = {
      name: meta.name, sub: meta.sub, theme: meta.theme, type: meta.type,
      night: !!meta.night, snow: !!meta.snow, knots: knots,
      sky: meta.sky, fog: meta.fog, fogD: meta.fogD, sun: meta.sun, sunC: meta.sunC,
      sunI: meta.sunI, hemi: meta.hemi, hemiI: meta.hemiI, ground: meta.ground,
      bh: meta.bh || [10, 40], clouds: meta.clouds !== false
    };
    def.sample = function () { return sampleLoop(def.knots); };
    return def;
  }

  function bayKnots() {
    // South straight is the closing edge, 460m. West leg, north U, inner leg, east sweep, forward S, then a perpendicular drop back onto the straight.
    return [knot(0, 0, 2, 18)].concat(
      [knot(0, 120, 3.5, 20), knot(0, 200, 6, 12, true), knot(0, 280, 9, 18)],
      hairpin(30, 280, 30, 9, 14).slice(1),
      [knot(60, 200, 12, 18), knot(60, 140, 10, 18), knot(170, 140, 9, 18)],
      arcKnots(170, 78, 62, Math.PI / 2, Math.PI / 2 - 1.75, 9, 6, 8, 16).slice(1),
      [knot(250, 70, 5, 16), knot(300, 42, 4, 16), knot(345, 74, 4, 16), knot(400, 46, 3, 18), knot(460, 0, 2, 18)]
    );
  }
  function duskKnots() {
    return [knot(40, -80, 1, 16)].concat(
      [knot(40, 20, 5, 18), knot(40, 110, 9, 12, true), knot(40, 190, 14, 16)],
      hairpin(64, 190, 24, 14, 20).slice(1),
      [knot(88, 120, 16, 16), knot(88, 70, 13, 16), knot(180, 70, 11, 16)],
      arcKnots(180, 40, 52, Math.PI / 2, Math.PI / 2 - 1.9, 11, 7, 8, 14).slice(1),
      [knot(200, -8, 5, 20), knot(250, -28, 4, 20), knot(300, -8, 3, 18), knot(430, -28, 2, 18), knot(430, -80, 1, 16)]
    );
  }
  function snowKnots() {
    return [knot(-100, 40, 8, 16)].concat(
      [knot(-100, 130, 14, 16), knot(-100, 210, 20, 12, true), knot(-100, 280, 24, 16)],
      hairpin(-74, 280, 26, 24, 30).slice(1),
      [knot(-48, 200, 26, 16), knot(-48, 130, 20, 16), knot(70, 130, 16, 16)],
      arcKnots(70, 110, 50, Math.PI / 2, Math.PI / 2 - 1.85, 16, 12, 8, 14).slice(1),
      [knot(112, 72, 13, 20), knot(165, 62, 11, 20), knot(220, 78, 10, 18), knot(250, 68, 9, 18), knot(250, 40, 8, 16)]
    );
  }

  QQ.TRACKS = [
    makeTrack({
      name: '晴湾高架', sub: '海岸高架 · 日间都市', theme: 'bay-overpass', type: 'city',
      sky: ['#1565e0', '#8fd0ff', '#e6f6ff'], fog: '#cfe8ff', fogD: [220, 1400],
      sun: [0.45, 0.82, -0.3], sunC: '#fff3df', sunI: 3.3, hemi: ['#ffffff', '#90a878'], hemiI: 1.65,
      ground: '#8fbe78', bh: [7, 16], clouds: true
    }, bayKnots()),
    makeTrack({
      name: '暮色环线', sub: '霓虹丘陵 · 黄昏都市', theme: 'neon-ridge', type: 'city', night: true,
      sky: ['#241454', '#ff6fa8', '#ffc27a'], fog: '#7a4e86', fogD: [160, 1100],
      sun: [-0.55, 0.32, -0.45], sunC: '#ffb48a', sunI: 1.7, hemi: ['#c8b8ff', '#4a3a68'], hemiI: 1.85,
      ground: '#3e3a52', bh: [8, 20], clouds: true
    }, duskKnots()),
    makeTrack({
      name: '雪岭回环', sub: '高山雪道 · 跳台森林', theme: 'snow-ridge', type: 'snow', snow: true,
      sky: ['#4a78c0', '#a9cdf0', '#eef6ff'], fog: '#d5e4f2', fogD: [90, 900],
      sun: [-0.35, 0.62, -0.5], sunC: '#ffffff', sunI: 2.4, hemi: ['#e7f3ff', '#8090a4'], hemiI: 1.25,
      ground: '#e7eef4', bh: [8, 20], clouds: true
    }, snowKnots())
  ];

  QQ.sampleTrack = function (def) {
    var loop = sampleLoop(def.knots);
    loop.name = def.name;
    loop.theme = def.theme;
    loop.type = def.type;
    loop.city = def.type === 'city';
    loop.def = def;
    return loop;
  };

  root.QQ = QQ;
})(typeof window !== 'undefined' ? window : this);
