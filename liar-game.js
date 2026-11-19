// Liar game extension for the existing Discord-card-bot Worker.
// Host starts/advances; each player's clue is ephemeral. Existing card routes are untouched.
const LIAR_WORDS = {
  "음식":["김치","피자","라면","초밥","햄버거","떡볶이","치킨","만두","카레","삼겹살","냉면","비빔밥"],
  "동물":["고양이","강아지","토끼","사자","펭귄","기린","코끼리","돌고래","여우","판다","거북이","호랑이"],
  "장소":["학교","병원","공항","도서관","편의점","영화관","놀이공원","식당","은행","박물관","지하철역","미용실"],
  "물건":["우산","의자","연필","거울","시계","키보드","안경","가방","휴지","선풍기","모니터","책상"],
  "직업":["의사","교사","소방관","요리사","경찰","개발자","배우","화가","농부","파일럿","기자","간호사"],
  "취미":["독서","낚시","축구","등산","수영","그림","사진","요리","캠핑","바둑","노래","게임"]
};
const liarPick = a => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
const liarId = (s,act,arg) => ["l",act,s.id,s.round,...(arg===undefined?[]:[arg])].join("|");
const liarBtn = (s,label,act,style=2,arg) => b(label,liarId(s,act,arg),style);
const liarMention = id => "<@"+id+">";
const liarLimit = 30*60*1000;
const LIAR_TALK_MS = 60_000;
const LIAR_LOBBY_MS = 60_000;
const LIAR_TICK_MS = 5_000;
function liarCountdown(s,now=Date.now()){
  const left=Math.max(0,Math.min(60,Math.ceil(((s.phase==="lobby"?s.lobbyUntil:s.talkUntil)-now)/1000)));
  const filled=Math.ceil(left/5);
  const deadline=s.phase==="lobby"?s.lobbyUntil:s.talkUntil;
  return "**⏱️ 종료 <t:"+Math.ceil(deadline/1000)+":R>**\n"+String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0")+" · "+"🟩".repeat(filled)+"⬛".repeat(12-filled);
}
function liarNextTick(deadline,now=Date.now()){
  const start=deadline-LIAR_TALK_MS;
  return Math.min(deadline,start+(Math.floor(Math.max(0,now-start)/LIAR_TICK_MS)+1)*LIAR_TICK_MS);
}
function liarDeadline(s,now=Date.now()){return s.phase==="talk"&&Number.isFinite(s.talkUntil)&&now>=s.talkUntil;}
function liarLobbyDeadline(s,now=Date.now()){return s.phase==="lobby"&&Number.isFinite(s.lobbyUntil)&&now>=s.lobbyUntil;}
function liarOpenLobby(s){
  s.phase="lobby";s.lobbyUntil=Date.now()+LIAR_LOBBY_MS;s.lobbyAuto=null;s.closeReason=null;
}
function liarExpireLobby(s){
  if(!liarLobbyDeadline(s))return false;
  s.lobbyAuto=s.lobbyUntil;
  if(s.players.length>=3)liarInitRound(s);
  else{s.phase="closed";s.closeReason="참가 인원이 3명 미만이어서 모집이 종료되었습니다.";}
  return true;
}
async function liarArm(env,s,kind,token){
  const deadline=kind==="lobby"?s.lobbyUntil:s.talkUntil;
  const name=s.id+":"+s.round+(kind==="lobby"?":lobby":"");
  await env.LIAR_TIMER.getByName(name).arm({id:s.id,round:s.round,deadline,kind,token});
}
async function liarTryArm(env,s,kind,token){
  try{await liarArm(env,s,kind,token);}
  catch{console.warn("liar_timer_schedule_failed",kind);}
}
const liarNorm = value => String(value??"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();
function liarInitRound(s) {
  const old=s.word;
  s.category=liarPick(Object.keys(LIAR_WORDS));
  s.word=liarPick(LIAR_WORDS[s.category].filter(w=>w!==old));
  s.liar=liarPick(s.players).id;
  s.votes={}; s.suspect=null; s.winner=null; s.reason=""; s.phase="talk"; s.talkUntil=Date.now()+LIAR_TALK_MS;
}
function liarBoard(s) {
  let t="**🎭 라이어 게임** · "+s.round+"라운드\n";
  const p=s.players.map(x=>(x.id===s.host?"👑 ":"• ")+liarMention(x.id)).join("\n");
  const close=liarBtn(s,"종료","close",4),refresh=liarBtn(s,"새로고침","refresh");
  if(s.phase==="closed")return [t+(s.closeReason||"게임이 종료되었습니다."),[]];
  if(s.phase==="lobby")return [t+"**참가 대기 ("+s.players.length+"/8명)**\n"+p+(s.lobbyUntil?"\n\n"+liarCountdown(s)+"\n60초 후 3명 이상이면 자동 시작합니다. 인원이 부족하면 모집이 종료됩니다.":"\n\n3명 이상 참가하면 방장이 시작할 수 있습니다.")+"\n방장은 먼저 시작할 수 있습니다.",rows([liarBtn(s,"참가","join",3),liarBtn(s,"나가기","leave"),liarBtn(s,"시작","start",1),close,refresh])];
  if(s.phase==="talk")return [t+"주제: **"+s.category+"**\n\n"+p+"\n\n각자 [내 제시어]를 눌러 확인한 뒤 음성 채널에서 한 번씩 설명하세요. 설명 시간은 60초입니다."+(s.talkUntil?"\n\n"+liarCountdown(s)+"\n투표 시작 예정: <t:"+Math.ceil(s.talkUntil/1000)+":T>":"") ,rows([liarBtn(s,"내 제시어","role",1),liarBtn(s,"조기 투표","voting",3),close,refresh])];
  if(s.phase==="vote"){
    const buttons=s.players.map((x,j)=>liarBtn(s,(j+1)+". "+x.name.slice(0,55),"vote",1,x.id));
    return [t+"**라이어 투표** · "+Object.keys(s.votes).length+"/"+s.players.length+"명\n"+s.players.map((x,j)=>(j+1)+". "+liarMention(x.id)+(s.votes[x.id]?" ✅":"")).join("\n")+"\n\n자신을 제외한 한 사람을 선택하세요. 득표 결과는 모두 투표한 뒤 공개합니다.",rows(buttons.slice(0,5),buttons.slice(5),[liarBtn(s,"내 제시어","role"),close,refresh])];
  }
  if(s.phase==="guess")return [t+"라이어 "+liarMention(s.liar)+"가 지목되었습니다!\n주제: **"+s.category+"**\n라이어는 제시어를 한 번 추측할 수 있습니다.",rows([liarBtn(s,"정답 입력","guess",1),close,refresh])];
  const tally=s.players.map(x=>liarMention(x.id)+" : "+Object.values(s.votes).filter(v=>v===x.id).length+"표").join("\n");
  return [t+"**"+(s.winner==="liar"?"라이어 승리":"시민 승리")+"**\n라이어: "+liarMention(s.liar)+"\n제시어: **"+s.word+"**\n"+s.reason+"\n\n"+tally,rows([liarBtn(s,"다시 하기","again",3),close,refresh])];
}
function liarFinishVote(s){
  const count=s.players.map(x=>({id:x.id,n:Object.values(s.votes).filter(v=>v===x.id).length})).sort((x,y)=>y.n-x.n);
  if(count[0].n===count[1].n){s.phase="ended";s.winner="liar";s.reason="최다 득표 동률로 라이어 검거 실패.";return;}
  s.suspect=count[0].id;
  if(s.suspect===s.liar){s.phase="guess";return;}
  s.phase="ended";s.winner="liar";s.reason="시민 "+liarMention(s.suspect)+"를 잘못 지목했습니다.";
}
function liarTransition(s,act,u,arg){
  const member=s.players.some(x=>x.id===u.id),host=s.host===u.id;
  if(act==="close"){if(!host)return "방장만 종료할 수 있습니다.";s.phase="closed";return;}
  if(act==="join"){
    if(s.phase!=="lobby")return "이미 시작한 게임입니다.";
    if(member)return "이미 참가했습니다.";
    if(s.players.length>=8)return "정원이 가득 찼습니다.";
    s.players.push(u);return;
  }
  if(!member)return "참가자만 이용할 수 있습니다.";
  if(act==="leave"){if(s.phase!=="lobby"||host)return "방장은 종료 버튼을 사용하세요. 참가 취소는 시작 전만 가능합니다.";s.players=s.players.filter(x=>x.id!==u.id);return;}
  if(act==="start"||act==="again"){
    if(!host)return "방장만 시작할 수 있습니다.";
    if(s.phase!==(act==="start"?"lobby":"ended"))return "현재 시작할 수 없습니다.";
    if(s.players.length<3)return "최소 3명이 필요합니다.";
    if(act==="again"){s.round++;liarOpenLobby(s);s.talkUntil=null;s.votes={};s.liar=null;s.suspect=null;s.winner=null;return;}
    liarInitRound(s);return;
  }
  if(act==="voting"){
    if(!host||s.phase!=="talk")return "방장만 설명 단계에서 투표를 시작할 수 있습니다.";
    s.phase="vote";return;
  }
  if(act==="vote"){
    if(s.phase!=="vote")return "투표 시간이 아닙니다.";
    if(s.votes[u.id])return "이미 투표했습니다.";
    if(arg===u.id||!s.players.some(x=>x.id===arg))return "자신을 제외한 참가자를 선택하세요.";
    s.votes[u.id]=arg;
    if(Object.keys(s.votes).length===s.players.length)liarFinishVote(s);
    return;
  }
  if(act==="answer"){
    if(s.phase!=="guess"||u.id!==s.liar)return "지목된 라이어만 정답을 입력할 수 있습니다.";
    const answer=liarNorm(arg);if(!answer||answer.length>100)return "정답을 입력하세요.";
    s.winner=answer===liarNorm(s.word)?"liar":"citizen";
    s.reason=s.winner==="liar"?"라이어가 제시어를 맞혔습니다.":"라이어가 제시어를 맞히지 못했습니다.";
    s.phase="ended";return;
  }
  return "지원하지 않는 행동입니다.";
}
async function liarAction(i,env){
  const [prefix,act,id,round,arg]=String(i.data?.custom_id||"").split("|"),u=who(i),ch=key(i);
  if(prefix!=="l"||!/^\d{15,22}$/.test(u.id)||!ch)return err("잘못된 게임 요청입니다.");
  if(act==="new"){
    const s={id:crypto.randomUUID(),channel:ch,game:"liar",host:u.id,players:[u],round:1,phase:"lobby",votes:{},expires:Date.now()+liarLimit,message:i.message?.id||null};
    liarOpenLobby(s);
    await env.DB.prepare("INSERT INTO card_rooms (id,channel_id,game,state_json,version,updated_at) VALUES (?,?,?,?,0,?)").bind(s.id,ch,"liar",JSON.stringify(s),Date.now()).run();
    await liarTryArm(env,s,"lobby",i.token);
    return edit(...liarBoard(s));
  }
  if(!id||!/^\d+$/.test(round))return err("잘못된 게임 버튼입니다.");
  for(let attempt=0;attempt<3;attempt++){
    const row=await env.DB.prepare("SELECT id,channel_id,state_json,version FROM card_rooms WHERE id=? AND game='liar'").bind(id).first();
    if(!row||row.channel_id!==ch)return err("게임방을 찾을 수 없습니다.");
    const s=JSON.parse(row.state_json);
    if(s.message&&i.message?.id&&s.message!==i.message.id)return err("원래 게임 메시지를 사용하세요.");
    if(s.expires<Date.now())return err("게임방이 만료되었습니다. /게임시작으로 새 방을 여세요.");
    if(liarLobbyDeadline(s)){
      liarExpireLobby(s);
      const q=await env.DB.prepare("UPDATE card_rooms SET state_json=?,version=version+1,updated_at=? WHERE id=? AND version=? AND game='liar'").bind(JSON.stringify(s),Date.now(),id,row.version).run();
      if(q.meta?.changes!==1)continue;
      if(s.phase==="talk")await liarTryArm(env,s,"talk",i.token);
      return edit(...liarBoard(s));
    }
    if(liarDeadline(s)){
      s.phase="vote";
      const q=await env.DB.prepare("UPDATE card_rooms SET state_json=?,version=version+1,updated_at=? WHERE id=? AND version=? AND game='liar'").bind(JSON.stringify(s),Date.now(),id,row.version).run();
      if(q.meta?.changes!==1)continue;
      if(act!=="role")return edit(...liarBoard(s));
    }
    if(act==="refresh")return edit(...liarBoard(s));
    if(s.round!==Number(round)||s.phase==="closed")return err("이전 라운드 버튼입니다. 새로고침하세요.");
    if(act==="role"){
      if(!s.players.some(x=>x.id===u.id)||!["talk","vote"].includes(s.phase))return err("현재 제시어를 확인할 수 없습니다.");
      return reply("🔒 **"+(s.liar===u.id?"당신은 라이어입니다!":"제시어: "+s.word)+"**\n주제: "+s.category,[],true);
    }
    if(act==="guess"){
      if(s.phase!=="guess"||s.liar!==u.id)return err("지목된 라이어만 정답을 입력할 수 있습니다.");
      return Response.json({type:9,data:{custom_id:liarId(s,"answer"),title:"라이어의 마지막 추측",components:[{type:1,components:[{type:4,custom_id:"answer",label:"제시어",style:1,required:true,max_length:100}]}]}});
    }
    if(act==="answer"&&i.type!==5)return err("정답 입력창을 이용하세요.");
    const value=act==="answer"?i.data.components?.[0]?.components?.[0]?.value:arg;
    const error=liarTransition(s,act,u,value);
    if(error)return err(error);
    s.expires=Date.now()+liarLimit;
    const q=await env.DB.prepare("UPDATE card_rooms SET state_json=?,version=version+1,updated_at=? WHERE id=? AND version=? AND game='liar'").bind(JSON.stringify(s),Date.now(),id,row.version).run();
    if(q.meta?.changes===1){
      if(act==="start")await liarTryArm(env,s,"talk",i.token);
      if(act==="again")await liarTryArm(env,s,"lobby",i.token);
      return edit(...liarBoard(s));
    }
  }
  return err("다른 행동이 동시에 처리되었습니다. 다시 시도하세요.");
}

 
// Separate durable alarm per lobby and discussion. D1 remains the source of truth.
// The Discord interaction token is retained only until delivery or expiry.

async function liarPublish(env,job,state,content,buttons,request=fetch){
  const api="https://discord.com/api/v10",body=JSON.stringify(payloadText(content,buttons));
  const paths=[];
  if(job.token&&env.DISCORD_APPLICATION_ID){
    const base=api+"/webhooks/"+encodeURIComponent(env.DISCORD_APPLICATION_ID)+"/"+encodeURIComponent(job.token)+"/messages/";
    paths.push({via:"original",url:base+"@original",headers:{}});
    if(state.message)paths.push({via:"webhook_message",url:base+encodeURIComponent(state.message),headers:{}});
  }
  if(env.DISCORD_TOKEN&&state.channel&&state.message)paths.push({via:"bot",url:api+"/channels/"+encodeURIComponent(state.channel)+"/messages/"+encodeURIComponent(state.message),headers:{Authorization:"Bot "+env.DISCORD_TOKEN}});
  let last={ok:false,status:503};
  for(const p of paths){
    try{
      const r=await request(p.url,{method:"PATCH",headers:{"Content-Type":"application/json",...p.headers},body});
      last=r;
      if(r.ok)return r;
      const detail=await r.clone().json().catch(()=>({}));
      console.warn("liar_publish_failed",p.via,r.status,Number(detail.code)||0);
      if(r.status===429)return r;
    }catch{console.warn("liar_publish_network",p.via);}
  }
  return last;
}

export class LiarTimer extends DurableObject {
  async arm(job){
    if(!job?.token||!Number.isFinite(job.deadline))throw Error("invalid timer");
    await this.ctx.storage.put("job",job);
    await this.ctx.storage.setAlarm(liarNextTick(job.deadline));
  }
  async lobbyAlarm(job){
    const clear=()=>this.ctx.storage.delete("job"),db=this.env.DB;
    if(Date.now()>job.deadline+12*60_000){await clear();return;}
    let current=null;
    for(let n=0;n<4;n++){
      const row=await db.prepare("SELECT state_json,version FROM card_rooms WHERE id=? AND game='liar'").bind(job.id).first();
      if(!row){await clear();return;}
      const s=JSON.parse(row.state_json);
      if(s.round!==job.round||s.lobbyUntil!==job.deadline||s.expires<Date.now()){await clear();return;}
      if(s.phase==="lobby"&&liarExpireLobby(s)){
        const q=await db.prepare("UPDATE card_rooms SET state_json=?,version=version+1,updated_at=? WHERE id=? AND version=? AND game='liar'").bind(JSON.stringify(s),Date.now(),job.id,row.version).run();
        if(q.meta?.changes!==1)continue;
      }
      current=s;break;
    }
    if(!current)throw Error("lobby timer state contention");
    const latest=await db.prepare("SELECT state_json FROM card_rooms WHERE id=? AND game='liar'").bind(job.id).first();
    if(!latest){await clear();return;}
    const s=JSON.parse(latest.state_json);
    if(s.round!==job.round||s.lobbyUntil!==job.deadline){await clear();return;}
    const ticking=s.phase==="lobby";
    const auto=s.lobbyAuto===job.deadline;
    if(!ticking&&(!auto||!["talk","closed"].includes(s.phase))){await clear();return;}
    if(ticking)await this.ctx.storage.setAlarm(liarNextTick(job.deadline));
    if(!ticking&&s.phase==="talk")await liarArm(this.env,s,"talk",job.token);
    const [content,buttons]=liarBoard(s);
    let response;
    try{response=await liarPublish(this.env,job,s,content,buttons);}
    catch{if(ticking)return;throw Error("lobby board delivery failed");}
    if(response.status===429||response.status>=500){if(ticking)return;throw Error("lobby board delivery retry");}
    if(!response.ok)console.warn("liar_lobby_board_status",response.status);
    if(!ticking)await clear();
  }
  async alarm(){
    const job=await this.ctx.storage.get("job");
    if(!job)return;
    if(job.kind==="lobby")return this.lobbyAlarm(job);
    const clear=()=>this.ctx.storage.delete("job");
    if(Date.now()>job.deadline+12*60_000){await clear();return;}
    const db=this.env.DB;
    let state=null;
    for(let n=0;n<4;n++){
      const row=await db.prepare("SELECT state_json,version FROM card_rooms WHERE id=? AND game='liar'").bind(job.id).first();
      if(!row){await clear();return;}
      const s=JSON.parse(row.state_json);
      if(s.round!==job.round||s.talkUntil!==job.deadline||s.expires<Date.now()||s.phase==="closed"){await clear();return;}
      if(s.phase==="talk"&&Date.now()>=job.deadline){
        s.phase="vote";
        const q=await db.prepare("UPDATE card_rooms SET state_json=?,version=version+1,updated_at=? WHERE id=? AND version=? AND game='liar'").bind(JSON.stringify(s),Date.now(),job.id,row.version).run();
        if(q.meta?.changes!==1)continue;
      }
      state=s;break;
    }
    if(!state)throw Error("timer state contention");
    const latest=await db.prepare("SELECT state_json FROM card_rooms WHERE id=? AND game='liar'").bind(job.id).first();
    if(!latest){await clear();return;}
    state=JSON.parse(latest.state_json);
    if(state.round!==job.round||state.phase==="closed"||state.talkUntil!==job.deadline){await clear();return;}
    // An early vote or a finished round needs no more countdown updates.
    if(state.phase!=="talk"&&Date.now()<job.deadline){await clear();return;}
    const ticking=state.phase==="talk";
    // Schedule the next tick before the network call, including the final deadline.
    if(ticking)await this.ctx.storage.setAlarm(liarNextTick(job.deadline));
    const [content,buttons]=liarBoard(state);
    let response;
    try{response=await liarPublish(this.env,job,state,content,buttons);}
    catch{if(ticking)return;throw Error("timer board delivery failed");}
    if(response.status===429||response.status>=500){
      if(ticking)return; // Next scheduled tick retries without a burst of edits.
      throw Error("timer board delivery retry");
    }
    if(!response.ok)console.warn("liar_timer_board_status",response.status);
    if(!ticking)await clear();
  }
}
