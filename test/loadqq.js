const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadQQ(code, filename) {
  const context = {
    console, Math, Date, Number, Object, Array, String, Boolean, Error,
    parseInt, parseFloat, isFinite, isNaN, JSON, undefined
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filename || 'sim.js' });
  if (!context.QQ || typeof context.QQ.stepKart !== 'function') {
    throw new Error('shipped script did not install QQ.stepKart');
  }
  return context.QQ;
}

function loadSim() {
  const file = path.join(__dirname, '..', 'sim.js');
  const code = fs.readFileSync(file, 'utf8');
  if (/\brequire\s*\(/.test(code) || /module\.exports/.test(code)) {
    throw new Error('sim.js must stay a classic browser script');
  }
  return loadQQ(code, 'sim.js');
}

module.exports = { loadQQ, loadSim };
