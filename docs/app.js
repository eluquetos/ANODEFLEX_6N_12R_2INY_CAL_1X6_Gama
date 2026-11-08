const nodes=[1,2,3,4,5,6];
const ids=nodes.flatMap(node=>[`${node}1`,`${node}2`]);
const state={fixed:null,nominal:null,op:null};
const activeInputs=()=>Object.fromEntries(ids.map(id=>[id,!$("active-"+id).checked]));
const $=id=>document.getElementById(id);
const n=id=>$(id).value.trim()===""?NaN:Number($(id).value);
const fmt=(value,digits=3)=>Number.isFinite(value)?value.toLocaleString("es-EC",{minimumFractionDigits:digits,maximumFractionDigits:digits}):"—";
const powerFmt=value=>Number.isFinite(value)?value.toFixed(2):"—";
const voltageInputs=()=>Object.fromEntries(nodes.map(node=>[node,n(`nom-v${node}`)]));
const cableArgs=cables=>Object.fromEntries(nodes.map(node=>[`Rc${node}`,cables[node]]));
const fixedInputs=()=>Object.fromEntries(ids.map(id=>[id,n("system-r-"+id)]));
const nodeText=voltages=>nodes.map(node=>`V${node} ${fmt(voltages[node],2)} V`).join(" · ");

function buildBranches(){
  const defaults={"11":1.2,"12":1,"21":0.9,"22":0.9,"31":0.8,"32":0.7,"41":0.6,"42":0.5,"51":0.5,"52":0.4,"61":0.4,"62":0.3};
  $("branch-cards").innerHTML=ids.map(id=>`
    <article class="panel branch tone-${id}" data-id="${id}">
      <div class="branch-head"><div><span>NODO ${id[0]}</span><h3>RAMA ${id}</h3></div><div class="amp" id="amp-${id}">— A</div></div>
      <div class="branch-inputs">
        <label><span class="input-title">Corriente</span><input id="target-${id}" type="number" min="0.001" step="any" value="${defaults[id]}"><em>A</em></label>
        <label><span class="input-title"><span>Reo${id}</span><strong id="reo-power-${id}">0.00 W</strong></span><input id="reo-${id}" type="number" min="0" max="10000" step="0.01" value="0"><em>Ω</em></label>
      </div>
      <div class="fixed-note"><span>Resistencia del Sistema R${id}</span><label class="fixed-control"><input id="system-r-${id}" aria-label="Resistencia del Sistema R${id}" type="number" min="0.01" step="0.01"><em>Ω</em></label></div>
    </article>`).join("");
}

function calibrationInput(){return {VA:n("nom-va"),VB:n("nom-vb"),voltages:voltageInputs(),active:activeInputs(),currents:Object.fromEntries(ids.map(id=>[id,!$("active-"+id).checked?n("nom-i"+id):0]))}}

function computeFixed(){
  const input=calibrationInput(),values=[input.VA,input.VB,...Object.values(input.voltages),...ids.filter(id=>input.active[id]).map(id=>input.currents[id])];
  if(!values.every(value=>Number.isFinite(value)&&value>0)){
    showMessage("Revise los datos: los voltajes y las corrientes deben ser mayores que cero.","error");return;
  }
  let result;
  try{result=AnodeflexModel.dimension(input)}
  catch(error){showMessage(error.message==="cable-undetermined"?`No se puede determinar Rc${error.node}: no hay corriente aguas abajo. Active al menos una rama alimentada por ese tramo.`:error.message==="voltage-rise"?`El voltaje V${error.node} del lado ${error.side} supera el voltaje anterior; revise las mediciones.`:"No se pudo obtener un conjunto físico de resistencias.","error");return}
  state.fixed=result.fixed;state.nominal=result;
  ids.forEach(id=>{$("fixed-r"+id).textContent=input.active[id]?fmt(result.fixed[id],2)+" Ω":"No instalada";$("system-r-"+id).value=input.active[id]?String(result.fixed[id]):"";$("target-"+id).value=input.active[id]?input.currents[id]:"";["system-r-","target-","reo-"].forEach(prefix=>$(prefix+id).disabled=!input.active[id]);setRheostat(id,0)});
  nodes.forEach(node=>$("cable-r"+node).textContent=fmt(result.cables[node],3)+" Ω");$("fixed-nodes").textContent=nodeText(result.voltages);$("live-v").value=input.VA;
  persist();showMessage("Resistencias calculadas. Ya puede regular las ramas instaladas.","success");solve();
}

function solve(){
  if(!state.fixed||!state.nominal)return;
  const fixed=fixedInputs();
  if(ids.some(id=>state.nominal.active[id]&&(!Number.isFinite(fixed[id])||fixed[id]<=0))){showMessage("Las resistencias del sistema deben ser mayores que cero.","error");return}
  state.fixed=Object.fromEntries(ids.map(id=>[id,state.nominal.active[id]?fixed[id]:null]));
  const rheostats=Object.fromEntries(ids.map(id=>[id,Math.max(0,n("reo-"+id)||0)]));
  try{state.op=AnodeflexModel.simulate({V:n("live-v"),...cableArgs(state.nominal.cables),fixed:state.fixed,rheostats,active:state.nominal.active});render();persist()}
  catch{showMessage("La simulación contiene un valor no válido.","error")}
}

function render(){
  const o=state.op,tolerance=Math.max(.01,n("tolerance")||2);let allWithin=true;
  $("live-v-out").textContent=fmt(o.V,2)+" V";$("head-current").textContent=fmt(o.It)+" A";$("health-dot").className="health-dot ok";
  ids.forEach(id=>{if(!state.nominal.active[id]){$("amp-"+id).textContent="No instalada";$("reo-power-"+id).textContent="0.00 W";return}const target=n("target-"+id),pct=target>0?100*(o.currents[id]-target)/target:NaN,within=Number.isFinite(pct)&&Math.abs(pct)<=tolerance;allWithin&&=within;$("amp-"+id).textContent=fmt(o.currents[id])+" A";$("reo-power-"+id).textContent=powerFmt(o.currents[id]**2*o.rheostats[id])+" W"});
  $("health-label").textContent=allWithin?"Objetivos cumplidos":"Simulación válida";$("res-it").textContent=fmt(o.It)+" A";
  nodes.slice(1).forEach(node=>$("res-i"+node).textContent=fmt(o.trunks[node])+" A");nodes.forEach(node=>$("res-dv"+node).textContent=fmt(o.trunks[node]*o.cables[node],3)+" V");
  $("res-ps").textContent=fmt(o.pSource,2)+" W";$("res-pe").textContent=fmt(o.pError,6)+" W";
  $("results-body").innerHTML=ids.map(id=>{if(!state.nominal.active[id])return `<tr><td>I${id}</td><td>0 A</td><td colspan="5">No instalada</td></tr>`;const target=n("target-"+id),pct=target>0?100*(o.currents[id]-target)/target:NaN,power=o.currents[id]**2*o.branch[id];return `<tr><td>I${id}</td><td>${fmt(o.currents[id])} A</td><td>${fmt(target)} A</td><td class="${Math.abs(pct)<=tolerance?"status-ok":"status-warn"}">${Number.isFinite(pct)?fmt(pct,2)+" %":"—"}</td><td>${fmt(state.fixed[id],2)} Ω</td><td>${fmt(o.rheostats[id])} Ω</td><td>${fmt(power,2)} W</td></tr>`}).join("");
  const errors={};
  nodes.forEach(node=>{
    errors[`KCL nodo ${node}`]=o.trunks[node]-o.currents[`${node}1`]-o.currents[`${node}2`]-(node<nodes.length?o.trunks[node+1]:0);
    errors[node===1?"KVL fuente–nodo 1":`KVL nodo ${node-1}–${node}`]=(node===1?o.V:o.voltages[node-1])-o.voltages[node]-o.trunks[node]*o.cables[node];
  });
  errors["Balance de potencia"]=o.pError;
  $("checks").innerHTML=Object.entries(errors).map(([label,value])=>`<p><span>${label}</span><b>${fmt(value,8)}</b></p>`).join("");
}

function applyCommonCurrent(){
  const value=n("common-current"),message=$("common-current-message");
  if(!Number.isFinite(value)||value<=0){message.textContent="Ingrese una corriente mayor que cero.";return}
  ids.filter(id=>!$("active-"+id).checked).forEach(id=>$("target-"+id).value=value);
  message.textContent="Corriente aplicada a las ramas instaladas.";solve();
}

function setRheostat(id,value){$("reo-"+id).value=Math.round(Math.max(0,value)*1000)/1000}
function assistedAdjustment(){
  if(!state.fixed){showMessage("Calibre primero las resistencias del sistema.","error");return}
  const targets=Object.fromEntries(ids.map(id=>[id,n("target-"+id)])),maxReo=n("reo-max"),input={...cableArgs(state.nominal.cables),fixed:state.fixed,targets,maxReo,active:state.nominal.active};
  if(!ids.filter(id=>state.nominal.active[id]).every(id=>Number.isFinite(targets[id])&&targets[id]>0)||!Number.isFinite(maxReo)||maxReo<=0){showMessage("Las corrientes de las ramas instaladas y el reóstato máximo deben ser mayores que cero.","error");return}
  let result;try{result=AnodeflexModel.adjust(input)}catch{showMessage("No se pudo calcular el ajuste con los datos ingresados.","error");return}
  if(!result.feasible){const parts=[];if(result.negative.length)parts.push("Ramas "+result.negative.join(", ")+": requieren reducir la resistencia del sistema o aumentar la tensión");if(result.over.length)parts.push("Ramas "+result.over.join(", ")+": superan el máximo de "+fmt(maxReo,2)+" Ω");showMessage("Ajuste no alcanzable. "+parts.join(". ")+".","error");return}
  $("live-v").value=result.V;ids.forEach(id=>setRheostat(id,result.rheostats[id]));solve();showMessage("Ajuste calculado con la tensión mínima de "+fmt(result.V,2)+" V. Reóstato en 0 Ω: "+result.zero.join(", ")+".","success");
}

function persist(){localStorage.setItem("anodeflex-6n-12r-2iny-cal-1x6-gama-fixed",JSON.stringify({fixed:state.fixed,stateNominal:state.nominal}))}
function caseData(){return {format:"anodeflex-6n-12r-2iny-cal-1x6-gama-case",version:1,createdAt:new Date().toISOString(),calibration:{VA:state.nominal.VA,VB:state.nominal.VB,voltages:state.nominal.voltages,active:state.nominal.active,cables:state.nominal.cables,currents:state.nominal.currents,fixed:state.fixed},operation:{V:n("live-v"),targets:Object.fromEntries(ids.map(id=>[id,n("target-"+id)])),rheostats:Object.fromEntries(ids.map(id=>[id,n("reo-"+id)])),rheostatMax:n("reo-max"),tolerancePercent:n("tolerance")},results:state.op}}
function saveCase(){if(!state.op)return;const blob=new Blob([JSON.stringify(caseData(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="anodeflex-6n-12r-2iny-cal-1x6-gama-"+new Date().toISOString().slice(0,10)+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function loadCase(file){
  const reader=new FileReader();reader.onload=()=>{try{
    const data=JSON.parse(reader.result);if(data.format!=="anodeflex-6n-12r-2iny-cal-1x6-gama-case"||!data.calibration?.fixed||!data.calibration?.voltages||!data.operation)throw new Error();
    const calibration=AnodeflexModel.dimension({VA:data.calibration.VA,VB:data.calibration.VB,voltages:data.calibration.voltages,active:data.calibration.active,currents:data.calibration.currents});state.fixed=data.calibration.fixed;state.nominal=calibration;
    $("nom-va").value=calibration.VA;$("nom-vb").value=calibration.VB;nodes.forEach(node=>{$("nom-v"+node).value=calibration.voltages[node];$("cable-r"+node).textContent=fmt(calibration.cables[node],3)+" Ω"});
    ids.forEach(id=>{$("active-"+id).checked=!calibration.active[id];$("nom-i"+id).disabled=!calibration.active[id];$("nom-i"+id).value=calibration.active[id]?calibration.currents[id]:"";$("fixed-r"+id).textContent=calibration.active[id]?fmt(state.fixed[id],2)+" Ω":"No instalada";$("system-r-"+id).value=calibration.active[id]?String(state.fixed[id]):"";$("target-"+id).value=calibration.active[id]?data.operation.targets[id]:"";["system-r-","target-","reo-"].forEach(prefix=>$(prefix+id).disabled=!calibration.active[id]);setRheostat(id,data.operation.rheostats[id])});
    $("fixed-nodes").textContent=nodeText(calibration.voltages);$("live-v").value=data.operation.V;$("reo-max").value=data.operation.rheostatMax||100;$("tolerance").value=data.operation.tolerancePercent||2;persist();solve();showMessage("Caso importado y recalculado correctamente.","success");
  }catch{showMessage("El archivo no corresponde a un caso ANODEFLEX Gama válido.","error")}};reader.readAsText(file);
}

function showMessage(text,type){const element=$("message");element.textContent=text;element.className="message show "+type}
function wireEvents(){
  $("calculate-fixed").addEventListener("click",computeFixed);$("apply-common-current").addEventListener("click",applyCommonCurrent);$("live-v").addEventListener("input",solve);
  ids.forEach(id=>{$("active-"+id).addEventListener("change",()=>{$("nom-i"+id).disabled=$("active-"+id).checked;state.fixed=null;state.nominal=null;state.op=null;$("health-label").textContent="Requiere calibración";$("health-dot").className="health-dot";$("head-current").textContent="— A";$("results-body").innerHTML="";$("res-it").textContent="— A";$("res-ps").textContent="— W";$("res-pe").textContent="— W";$("checks").innerHTML="";nodes.forEach(node=>{$("cable-r"+node).textContent="— Ω";$("res-dv"+node).textContent="— V";if(node>1)$("res-i"+node).textContent="— A"});ids.forEach(branch=>{$("fixed-r"+branch).textContent="—";$("amp-"+branch).textContent="— A"});showMessage("Cambió una rama. Calcule nuevamente las resistencias antes de regular.","error")});$("reo-"+id).addEventListener("input",solve);$("target-"+id).addEventListener("input",solve);$("system-r-"+id).addEventListener("input",solve)});
  $("reset-rheostats").addEventListener("click",()=>{ids.forEach(id=>setRheostat(id,0));solve()});$("assist").addEventListener("click",assistedAdjustment);$("tolerance").addEventListener("input",solve);$("save-case").addEventListener("click",saveCase);$("load-case").addEventListener("click",()=>$("case-file").click());$("case-file").addEventListener("change",event=>{if(event.target.files[0])loadCase(event.target.files[0]);event.target.value=""});$("print-report").addEventListener("click",()=>window.print());
}
function restore(){try{const saved=JSON.parse(localStorage.getItem("anodeflex-6n-12r-2iny-cal-1x6-gama-fixed"));if(saved?.fixed&&saved?.stateNominal){state.fixed=saved.fixed;state.nominal=saved.stateNominal;$("nom-va").value=state.nominal.VA;$("nom-vb").value=state.nominal.VB;$("live-v").value=state.nominal.VA;nodes.forEach(node=>{$("nom-v"+node).value=state.nominal.voltages[node];$("cable-r"+node).textContent=fmt(state.nominal.cables[node],3)+" Ω"});ids.forEach(id=>{$("active-"+id).checked=!state.nominal.active[id];$("nom-i"+id).disabled=!state.nominal.active[id];$("nom-i"+id).value=state.nominal.active[id]?state.nominal.currents[id]:"";$("target-"+id).value=state.nominal.active[id]?state.nominal.currents[id]:"";$("fixed-r"+id).textContent=state.nominal.active[id]?fmt(state.fixed[id],2)+" Ω":"No instalada";$("system-r-"+id).value=state.nominal.active[id]?String(state.fixed[id]):"";["system-r-","target-","reo-"].forEach(prefix=>$(prefix+id).disabled=!state.nominal.active[id])});$("fixed-nodes").textContent=nodeText(state.nominal.voltages);solve();return}}catch{}computeFixed()}

let installPrompt=null;window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install-app").hidden=false});$("install-app").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install-app").hidden=true});
buildBranches();wireEvents();computeFixed();if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
