const fs=require('fs');let h=fs.readFileSync('shell.html','utf8');
h=h.replace('<script>/*THREE*/</script>',()=>'<script>'+fs.readFileSync('three.min.js','utf8')+'</script>').replace('<script>/*GAME*/</script>',()=>'<script>'+fs.readFileSync('game.js','utf8')+'</script>');
fs.writeFileSync('qqspeed.html',h);fs.writeFileSync('index.html',h);
