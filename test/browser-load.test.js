const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadQQ, loadSim } = require('./loadqq');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sim = fs.readFileSync(path.join(root, 'sim.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

assert.ok(html.includes('id="lap"'), 'lap readout');
assert.ok(html.includes('id="nbar"') && html.includes('id="n1"') && html.includes('id="nitro"'), 'nitro gauge');
assert.ok(html.includes('id="minimap"'), 'minimap');
assert.ok(html.includes('id="count"'), 'countdown');
assert.ok(html.includes('id="bA"'), 'accel button');
assert.ok(!/\brequire\s*\(/.test(sim) && !/module\.exports/.test(sim));
assert.ok(game.includes('QQ.stepKart') && game.includes('QQ.sampleTrack'));
assert.ok(html.includes(sim), 'built page must inline the shipped sim.js');
assert.ok(html.includes('QQ.stepKart'));

const parts = [];
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) parts.push(m[1]);
const shipped = parts.filter(function (src) { return src.indexOf('root.QQ = QQ') !== -1 && src.indexOf('WebGLRenderer') === -1; });
assert.strictEqual(shipped.length, 1, 'page should ship one classic rules script');
assert.strictEqual(shipped[0], sim);

const QQ = loadQQ(shipped[0], 'index.html#qq-sim');
const fromFile = loadSim();
assert.strictEqual(typeof QQ.stepKart, 'function');
assert.strictEqual(typeof QQ.sampleTrack, 'function');
assert.strictEqual(QQ.TRACKS.length, 3);
assert.strictEqual(QQ.stepKart.toString(), fromFile.stepKart.toString());
assert.strictEqual(QQ.sampleTrack.toString(), fromFile.sampleTrack.toString());
const names = QQ.TRACKS.map(function (t) { return t.name; }).join(',');
assert.strictEqual(names, fromFile.TRACKS.map(function (t) { return t.name; }).join(','));
const sampled = QQ.sampleTrack(QQ.TRACKS[0]);
assert.strictEqual(sampled.name, QQ.TRACKS[0].name);
assert.ok(sampled.pts.length > 40);

console.log('browser load passed');
