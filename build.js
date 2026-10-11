const fs = require('fs');
let h = fs.readFileSync('shell.html', 'utf8');
const inline = (mark, file) => h = h.replace('<script>/*' + mark + '*/</script>', () => '<script>' + fs.readFileSync(file, 'utf8') + '</script>');
inline('THREE', 'three.min.js');
inline('SIM', 'sim.js');
inline('GAME', 'game.js');
fs.writeFileSync('qqspeed.html', h);
fs.writeFileSync('index.html', h);
