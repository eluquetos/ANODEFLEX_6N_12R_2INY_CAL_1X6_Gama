const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const html=fs.readFileSync('docs/index.html','utf8'),elements={};
function el(id){return elements[id]??=({id,_value:'',get value(){return this._value},set value(v){this._value=String(v)},textContent:'',innerHTML:'',className:'',hidden:false,checked:false,disabled:false,addEventListener(){},click(){}})}
for(const m of html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]*)"/g))el(m[1]).value=m[2];const store={};
const context={document:{getElementById:el},window:{addEventListener(){},print(){}},navigator:{},localStorage:{setItem(k,v){store[k]=v},getItem(k){return store[k]}},AnodeflexModel:require('../docs/model.js'),FileReader:class{readAsText(file){this.result=file;this.onload()}},console};
vm.createContext(context);vm.runInContext(fs.readFileSync('docs/app.js','utf8'),context);const saved=vm.runInContext('caseData()',context);assert.ok(saved.calibration.voltages[1]);assert.ok(saved.calibration.cables[1]>=0);el('nom-v1').value='99';vm.runInContext('computeFixed()',context);assert.match(el('message').textContent,/supera/);context.file=JSON.stringify(saved);vm.runInContext('loadCase(file)',context);assert.equal(Number(el('nom-v1').value),saved.calibration.voltages[1]);assert.match(el('message').textContent,/importado/);const after=vm.runInContext('caseData()',context);assert.equal(after.calibration.voltages[1],saved.calibration.voltages[1]);assert.equal(after.calibration.cables[1],saved.calibration.cables[1]);console.log('Interacción y casos: correctos');

const targets=Array.from({length:6},(_,i)=>[`${i+1}1`,`${i+1}2`]).flat();
el('reo-11').value='2.5';el('common-current').value='0.325';vm.runInContext('applyCommonCurrent()',context);
for(const id of targets)assert.equal(el('target-'+id).value,'0.325');assert.equal(el('reo-11').value,'2.5');
for(const value of ['', '0', '-1']){el('common-current').value=value;vm.runInContext('applyCommonCurrent()',context);assert.match(el('common-current-message').textContent,/mayor que cero/);for(const id of targets)assert.equal(el('target-'+id).value,'0.325')}
vm.runInContext('assistedAdjustment()',context);assert.match(el('message').textContent,/Ajuste calculado/);for(const id of targets)assert.ok(Math.abs(vm.runInContext(`state.op.currents["${id}"]`,context)-.325)<.0002,`corriente ${id}`);


el('active-62').checked=true;vm.runInContext('computeFixed()',context);assert.equal(el('fixed-r62').textContent,'No instalada');assert.equal(el('target-62').disabled,true);assert.equal(el('reo-62').disabled,true);
el('common-current').value='0.325';vm.runInContext('applyCommonCurrent()',context);assert.equal(el('target-62').value,'');
vm.runInContext('assistedAdjustment()',context);assert.match(el('message').textContent,/Ajuste calculado/);assert.equal(vm.runInContext('state.op.currents["62"]',context),0);
const disabledCase=vm.runInContext('caseData()',context);assert.equal(disabledCase.calibration.active['62'],false);context.file=JSON.stringify(disabledCase);el('active-62').checked=false;vm.runInContext('loadCase(file)',context);assert.equal(el('active-62').checked,true);assert.equal(el('target-62').disabled,true);
el('active-61').checked=true;vm.runInContext('computeFixed()',context);assert.match(el('message').textContent,/No se puede determinar Rc6/);
