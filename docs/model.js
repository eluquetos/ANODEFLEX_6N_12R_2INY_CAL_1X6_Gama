(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.AnodeflexModel=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const NODES=[1,2,3,4,5,6];
  const IDS=NODES.flatMap(node=>[`${node}1`,`${node}2`]);
  const SIDES={A:{voltage:"VA",nodes:[1, 2, 3] },B:{voltage:"VB",nodes:[4, 5, 6] }};
  const sum=values=>values.reduce((total,value)=>total+value,0);
  const parallel=values=>1/sum(values.map(value=>1/value));
  const positive=value=>Number.isFinite(value)&&value>0;
  const cablesFrom=input=>Object.fromEntries(NODES.map(node=>[node,Number(input[`Rc${node}`])]));
  const validCables=cables=>NODES.every(node=>Number.isFinite(cables[node])&&cables[node]>=0);
  const nodeIds=node=>[`${node}1`,`${node}2`];
  const isActive=(active,id)=>!active||active[id]!==false;

  function dimensionSide(input,side){
    const {voltage:voltageKey,nodes}=SIDES[side],source=Number(input[voltageKey]),currents=input.currents;
    if(!positive(source)||!currents||nodes.some(node=>nodeIds(node).some(id=>isActive(input.active,id)&&!positive(currents[id]))))throw new Error("invalid-input");
    const voltages={},trunks={},fixed={},cables={};let previous=source;
    for(const node of nodes){
      const voltage=Number(input.voltages?.[node]);
      if(!positive(voltage))throw new Error("invalid-input");
      if(voltage>previous){const error=new Error("voltage-rise");error.side=side;error.node=node;throw error}
      trunks[node]=sum(nodes.filter(n=>n>=node).flatMap(nodeIds).map(id=>isActive(input.active,id)?currents[id]:0));
      if(trunks[node]<=0){const error=new Error("cable-undetermined");error.node=node;throw error}
      voltages[node]=voltage;cables[node]=(previous-voltage)/trunks[node];previous=voltage;
      for(const id of nodeIds(node))fixed[id]=isActive(input.active,id)?voltage/currents[id]:null;
    }
    return {source,voltages,trunks,fixed,cables,It:trunks[nodes[0]]||0};
  }

  function dimension(input){
    const a=dimensionSide(input,"A"),b=dimensionSide(input,"B");
    return {VA:a.source,VB:b.source,active:Object.fromEntries(IDS.map(id=>[id,isActive(input.active,id)])),currents:Object.fromEntries(IDS.map(id=>[id,isActive(input.active,id)?input.currents[id]:0])),fixed:{...a.fixed,...b.fixed},voltages:{...a.voltages,...b.voltages},trunks:{...a.trunks,...b.trunks},cables:{...a.cables,...b.cables},sides:{A:a,B:b},It:a.It+b.It};
  }

  function simulate(input){
    const V=Number(input.V),cables=cablesFrom(input),fixed=input.fixed,rheostats=input.rheostats,active=input.active;
    if(!Number.isFinite(V)||V<0||!validCables(cables))throw new Error("invalid-input");
    const branch=Object.fromEntries(IDS.map(id=>[id,isActive(active,id)?Number(fixed[id])+Number(rheostats[id]):null]));
    if(IDS.some(id=>isActive(active,id)&&(!positive(branch[id])||!Number.isFinite(rheostats[id])||rheostats[id]<0)))throw new Error("invalid-resistance");
    const equivalents={},downstreamPaths={};
    for(let node=NODES.length;node>=1;node--){
      const paths=nodeIds(node).filter(id=>isActive(active,id)).map(id=>branch[id]);
      if(node<NODES.length){downstreamPaths[node]=cables[node+1]+equivalents[node+1];paths.push(downstreamPaths[node])}
      equivalents[node]=parallel(paths);
    }
    const Rt=cables[1]+equivalents[1],It=V/Rt,currents={},voltages={},trunks={1:It};
    let incoming=It,voltage=V-incoming*cables[1];
    for(const node of NODES){
      voltages[node]=voltage;
      for(const id of nodeIds(node))currents[id]=isActive(active,id)?voltage/branch[id]:0;
      if(node<NODES.length){incoming=voltage/downstreamPaths[node];trunks[node+1]=incoming;voltage-=incoming*cables[node+1]}
    }
    const pCable=sum(NODES.map(node=>trunks[node]**2*cables[node]));
    const pBranches=sum(IDS.map(id=>currents[id]**2*branch[id]));
    const pSource=V*It;
    return {V,fixed:{...fixed},rheostats:{...rheostats},branch,currents,voltages,trunks,cables,equivalents,downstreamPaths,Rt,It,pCable,pBranches,pSource,pError:pSource-pCable-pBranches};
  }

  function adjust(input){
    const cables=cablesFrom(input),targets=input.targets,maxReo=Number(input.maxReo),active=input.active,activeIds=IDS.filter(id=>isActive(active,id));
    if(!positive(maxReo)||!validCables(cables)||(!activeIds.length||activeIds.some(id=>!positive(targets[id])||!positive(input.fixed[id]))))throw new Error("invalid-target");
    const trunks={},drops={};let drop=0;
    for(const node of NODES){
      trunks[node]=sum(NODES.filter(n=>n>=node).flatMap(nodeIds).map(id=>isActive(active,id)?targets[id]:0));
      drop+=trunks[node]*cables[node];drops[node]=drop;
    }
    const V=Math.max(...activeIds.map(id=>drops[Number(id[0])]+targets[id]*input.fixed[id])),voltages=Object.fromEntries(NODES.map(node=>[node,V-drops[node]]));
    const rheostats=Object.fromEntries(IDS.map(id=>{if(!isActive(active,id))return [id,0];const value=voltages[Number(id[0])]/targets[id]-input.fixed[id];return [id,Math.abs(value)<1e-8?0:value]}));
    const negative=activeIds.filter(id=>rheostats[id]<-1e-8),over=activeIds.filter(id=>rheostats[id]>maxReo+1e-8),zero=activeIds.filter(id=>rheostats[id]===0);
    return {feasible:negative.length===0&&over.length===0,V,voltages,trunks,rheostats,negative,over,zero};
  }

  return {NODES,IDS,SIDES,dimensionSide,dimension,simulate,adjust};
});
