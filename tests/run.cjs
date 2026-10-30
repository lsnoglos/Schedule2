// Suite de regresión sin credenciales ni acceso a Google Sheets.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = vm.createContext({
  Logger: {log: function(x){ console.log(x); }},
  Utilities: {getUuid: function(){return 'test-' + Math.random().toString(36).slice(2);}}
});
const files = ['Code.gs','Scheduler.gs','Quality.gs','Tests.gs'];
files.forEach(function(file){
  const code = fs.readFileSync(path.join(root,'apps-script',file), 'utf8');
  new vm.Script(code, {filename:file}).runInContext(context);
});
const html = fs.readFileSync(path.join(root,'apps-script','Index.html'), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error('Index.html sin script');
new vm.Script(match[1], {filename:'Index.html'}); // validación de sintaxis sin DOM
const results = context.ejecutarPruebas();
if (results.total < 14 || results.pruebas.some(function(x){return !x.startsWith('OK ');})) {
  throw new Error('Suite incompleta: ' + JSON.stringify(results));
}
console.log('Pruebas completadas: ' + results.total);
