const assert=require('node:assert/strict');const m=require('../docs/model.js');
const N=6,SPLIT=3,ids=m.IDS,near=(a,b)=>Math.abs(a-b)<1e-9;
const currents=Object.fromEntries(ids.map((id,i)=>[id,1+i*.1])),cables={},voltages={};let v=30;
for(let n=1;n<=N;n++){if(n===SPLIT+1)v=25;let end=n<=SPLIT?SPLIT:N;let it=ids.filter(id=>+id[0]>=n&&+id[0]<=end).reduce((s,id)=>s+currents[id],0);cables['Rc'+n]=n*.1;v-=it*cables['Rc'+n];voltages[n]=v}
const input={VA:30,VB:25,voltages,currents},r=m.dimension(input);
for(let n=1;n<=N;n++)assert.ok(near(r.cables[n],cables['Rc'+n]),'Rc'+n);
for(const id of ids)assert.ok(near(r.fixed[id]*currents[id],voltages[id[0]]));
const zero=Object.fromEntries(ids.map(id=>[id,0]));const targets=Object.fromEntries(ids.map(id=>[id,.2]));
const op=m.simulate({V:30,...cables,fixed:r.fixed,rheostats:zero});
for(let n=1;n<=N;n++){assert.ok(near(op.trunks[n],op.currents[n+'1']+op.currents[n+'2']+(n<N?op.trunks[n+1]:0)));assert.ok(near((n===1?op.V:op.voltages[n-1])-op.voltages[n],op.trunks[n]*cables['Rc'+n]))}assert.ok(near(op.pError,0));
const adj=m.adjust({...cables,fixed:r.fixed,targets,maxReo:1000});assert.equal(adj.feasible,true);let solved=m.simulate({V:adj.V,...cables,fixed:r.fixed,rheostats:adj.rheostats});for(const id of ids)assert.ok(near(solved.currents[id],targets[id]));
assert.equal(m.adjust({...cables,fixed:r.fixed,targets,maxReo:.0001}).feasible,false);
assert.throws(()=>m.dimension({...input,voltages:{...voltages,1:31}}),/voltage-rise/);assert.throws(()=>m.dimension({...input,currents:{...currents,11:0}}),/invalid-input/);
if(SPLIT<N)assert.throws(()=>m.dimension({...input,voltages:{...voltages,[SPLIT+1]:26}}),/voltage-rise/);
console.log('Calibración y regulación: correctas');

// Siete ramas: R42 no existe y el resto mantiene el balance eléctrico.
const missing='62',other='61';const active=Object.fromEntries(ids.map(id=>[id,id!==missing]));
const measured={...currents,[missing]:0},cal=m.dimension({...input,currents:measured,active});
assert.equal(cal.fixed[missing],null);assert.equal(cal.currents[missing],0);
const derived=Object.fromEntries(m.NODES.map(n=>['Rc'+n,cal.cables[n]]));
const inactiveOp=m.simulate({V:30,...derived,fixed:cal.fixed,rheostats:zero,active});
assert.equal(inactiveOp.currents[missing],0);assert.ok(near(inactiveOp.pError,0));
for(let n=1;n<=N;n++){assert.ok(near(inactiveOp.trunks[n],inactiveOp.currents[n+'1']+inactiveOp.currents[n+'2']+(n<N?inactiveOp.trunks[n+1]:0)));assert.ok(near((n===1?inactiveOp.V:inactiveOp.voltages[n-1])-inactiveOp.voltages[n],inactiveOp.trunks[n]*derived['Rc'+n]))}
const inactiveTargets=Object.fromEntries(ids.map(id=>[id,active[id]?.325:0]));
const inactiveAdj=m.adjust({...derived,fixed:cal.fixed,targets:inactiveTargets,active,maxReo:1000});assert.equal(inactiveAdj.feasible,true);assert.equal(inactiveAdj.rheostats[missing],0);
const opAdjusted=m.simulate({V:inactiveAdj.V,...derived,fixed:cal.fixed,rheostats:inactiveAdj.rheostats,active});for(const id of ids)assert.ok(near(opAdjusted.currents[id],active[id]?.325:0));
assert.throws(()=>m.dimension({...input,currents:{...measured,[other]:0},active:{...active,[other]:false}}),e=>e.message==='cable-undetermined'&&e.node===6);

// Verificar una rama ausente en cada nodo, con todos los tramos medibles.
for(const absent of ids){const selection=Object.fromEntries(ids.map(id=>[id,id!==absent]));const sample=m.dimension({...input,active:selection});assert.equal(sample.fixed[absent],null);const network=Object.fromEntries(m.NODES.map(n=>['Rc'+n,sample.cables[n]]));const sim=m.simulate({V:30,...network,fixed:sample.fixed,rheostats:zero,active:selection});assert.equal(sim.currents[absent],0);assert.ok(near(sim.pError,0));}
if(SPLIT<N){const sel=Object.fromEntries(ids.map(id=>[id,!id.startsWith(String(SPLIT))]));assert.throws(()=>m.dimension({...input,active:sel}),e=>e.message==='cable-undetermined'&&e.node===SPLIT);}
