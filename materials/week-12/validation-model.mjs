export function initialState(number=1){const seats=number===3?1:2;return {number,actor:number===2?'arta':'dritoni',payload:{requestId:'K-42'},server:{seats,version:1,requests:{'K-42':{passenger:'arta',status:'pending'},'K-43':{passenger:'lira',status:'pending'}}},views:{arta:{seats,status:'pending'},lira:{seats,status:'pending'}},response:null,log:[]};}
// Teaching model: actor represents a trusted simulated session, not a field in the request body.
export function attempt(input,actor,payload,{failWrite=false}={}){
 const server=structuredClone(input);
 const done=(status,message,repeated=false)=>({server,response:{status,message,repeated}});
 if(!actor||!['dritoni','arta','lira','other-driver'].includes(actor))return done(401,'Hyr në llogari për ta kryer veprimin.');
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.requestId!=='string'||!/^K-[1-9]\d*$/.test(payload.requestId))return done(400,'ID-ja e kërkesës nuk ka format të vlefshëm.');
 if(actor!=='dritoni')return done(403,'Vetëm shoferi pronar mund ta pranojë këtë kërkesë.');
 const request=server.requests[payload.requestId];
 if(!request)return done(404,'Kërkesa nuk u gjet.');
 if(request.status==='accepted')return done(200,'Ky pranim është ruajtur më parë. Vendet nuk u ndryshuan.',true);
 if(server.seats<1)return done(409,'Nuk ka më vende të lira. Kërkesa nuk u konfirmua.');
 if(failWrite)return done(503,'Ruajtja dështoi. As vendet, as kërkesa nuk u ndryshuan.');
 server.seats--;request.status='accepted';server.version++;
 return done(200,'Pranimi u ruajt dhe vendet u përditësuan.');
}
export function transition(input,event){
 const state=structuredClone(input);
 function submit(id,actor=state.actor,payload={requestId:id}){
  const result=attempt(state.server,actor,payload,{failWrite:!!event.failWrite});state.server=result.server;state.response=result.response;
  state.log.push({requestId:typeof payload?.requestId==='string'?payload.requestId:'?',status:result.response.status,repeated:result.response.repeated});
 }
 if(event.type==='submit')submit(state.payload.requestId,state.actor,event.payload??state.payload);
 if(event.type==='race')for(const id of event.order??['K-42','K-43'])submit(id,'dritoni');
 if(event.type==='sync')for(const name of ['arta','lira']){
  if(event.role&&event.role!==name)continue;
  const id=name==='arta'?'K-42':'K-43';state.views[name]={seats:state.server.seats,status:state.server.requests[id].status};
 }
 if(event.type==='probe'){
  const probes={passenger:{actor:'arta',id:'K-42'},anonymous:{actor:null,id:'K-42'},invalid:{actor:'dritoni',id:''},other:{actor:'other-driver',id:'K-42'}};
  const p=probes[event.value]??probes.passenger;state.actor=p.actor;state.payload={requestId:p.id};state.response=null;
 }
 return state;
}
