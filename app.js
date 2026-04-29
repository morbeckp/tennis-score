let match=null,snapshots=[],pendingPointWinner=null,lastPointType=null;
const pointMap=["0","15","30","40"];
const typeLabels={ace:"Ace",service_winner:"Service Winner",winner:"Winner",forced_error:"Erro forçado",unforced_error:"Erro não forçado",double_fault:"Dupla falta",unclassified:"Sem classificar"};
const typeCausedBy={ace:"winner",service_winner:"winner",winner:"winner",forced_error:"loser",unforced_error:"loser",double_fault:"loser",unclassified:"unknown"};

window.addEventListener("load",()=>{
 registerServiceWorker();
 const saved=localStorage.getItem("tennisMatchLandscape");
 if(saved){match=JSON.parse(saved);showMatchScreen();updateUI();}
});

function registerServiceWorker(){if("serviceWorker" in navigator){navigator.serviceWorker.register("service-worker.js").catch(()=>{});}}
function startMatch(){
 const player0=document.getElementById("p1").value.trim()||"Jogador 1";
 const player1=document.getElementById("p2").value.trim()||"Jogador 2";
 const firstServer=Number(document.getElementById("firstServer").value);
 match={
  players:[player0,player1],
  config:{advantage:document.getElementById("advantage").value==="true",gamesPerSet:Number(document.getElementById("gamesPerSet").value),setsToWin:Number(document.getElementById("setsToWin").value),firstServer},
  meta:{startedAt:new Date().toISOString(),finishedAt:null},
  score:{points:[0,0],games:[0,0],sets:[0,0],currentServer:firstServer,matchOver:false,currentSetNumber:1,currentGameNumberInSet:1},
  currentGame:{pointSequence:[],classifiedPoints:[],hadDeuce:false},
  stats:{pointsWon:[0,0],gamesWon:[0,0],breaks:[0,0],deuces:0,noAdGames:0,aces:[0,0],serviceWinners:[0,0],winners:[0,0],forcedErrors:[0,0],unforcedErrors:[0,0],doubleFaults:[0,0],servePointsWon:[0,0],receivePointsWon:[0,0]},
  setsHistory:[],gamesHistory:[]
 };
 snapshots=[];save();showMatchScreen();updateUI();
}
function showMatchScreen(){
 document.getElementById("setupScreen").classList.add("hidden");
 document.getElementById("matchScreen").classList.remove("hidden");
}
function openPointOverlay(winner){
 if(!match||match.score.matchOver)return;
 pendingPointWinner=winner;
 const loser=winner===0?1:0,server=match.score.currentServer;
 overlayTitle.innerText=`Ponto para ${match.players[winner]}`;
 overlayContext.innerText=`Sacador: ${match.players[server]}`;
 const buttons=validPointTypes(winner,loser,server);
 classificationButtons.innerHTML="";
 buttons.forEach(item=>{
  const btn=document.createElement("button");
  btn.innerText=item.label;btn.className=item.className;btn.onclick=()=>classifyPoint(item.type);
  classificationButtons.appendChild(btn);
 });
 repeatLastBtn.disabled=!lastPointType;
 document.getElementById("pointOverlay").classList.remove("hidden");
}
function closePointOverlay(){
 pendingPointWinner=null;
 document.getElementById("pointOverlay").classList.add("hidden");
}
function validPointTypes(winner,loser,server){
 const types=[];
 if(winner===server){
  types.push({type:"ace",label:"Ace",className:"serve"});
  types.push({type:"service_winner",label:"Service Winner",className:"serve"});
 }
 types.push({type:"winner",label:"Winner",className:"offense"});
 types.push({type:"forced_error",label:`Erro forçado de ${match.players[loser]}`,className:"error"});
 types.push({type:"unforced_error",label:`Erro não forçado de ${match.players[loser]}`,className:"error"});
 if(loser===server)types.push({type:"double_fault",label:`Dupla falta de ${match.players[loser]}`,className:"serve"});
 return types;
}
function classifyPoint(type){
 if(pendingPointWinner===null)return;
 if(type==="__repeat__"){if(!lastPointType)return;type=lastPointType;}
 const winner=pendingPointWinner;closePointOverlay();awardPoint(winner,type);
}
function awardPoint(winner,type){
 snapshot();
 const loser=winner===0?1:0,server=match.score.currentServer,causedBy=inferCausedBy(type,winner,loser);
 const pointEvent={winner,loser,server,type,causedBy,timestamp:new Date().toISOString()};
 match.score.points[winner]++;match.stats.pointsWon[winner]++;
 if(winner===server)match.stats.servePointsWon[winner]++;else match.stats.receivePointsWon[winner]++;
 applyPointTypeStats(type,winner,loser,causedBy);
 match.currentGame.pointSequence.push(winner);match.currentGame.classifiedPoints.push(pointEvent);
 if(match.score.points[0]>=3&&match.score.points[1]>=3)match.currentGame.hadDeuce=true;
 if(type!=="unclassified")lastPointType=type;
 const p=match.score.points[winner],o=match.score.points[loser];
 if(p>=3&&o>=3&&!match.config.advantage){match.stats.noAdGames++;winGame(winner,true);return;}
 if(p>=4&&p-o>=2){winGame(winner,false);return;}
 if(p>=4&&o<3){winGame(winner,false);return;}
 save();updateUI();
}
function inferCausedBy(type,winner,loser){const rule=typeCausedBy[type]||"unknown";if(rule==="winner")return winner;if(rule==="loser")return loser;return null;}
function applyPointTypeStats(type,winner,loser,causedBy){
 if(type==="ace")match.stats.aces[winner]++;
 if(type==="service_winner")match.stats.serviceWinners[winner]++;
 if(type==="winner")match.stats.winners[winner]++;
 if(type==="double_fault")match.stats.doubleFaults[loser]++;
 if(type==="forced_error"&&causedBy!==null)match.stats.forcedErrors[causedBy]++;
 if(type==="unforced_error"&&causedBy!==null)match.stats.unforcedErrors[causedBy]++;
}
function winGame(winner,endedByNoAd){
 const loser=winner===0?1:0,wasBreak=match.score.currentServer!==winner;
 if(match.currentGame.hadDeuce)match.stats.deuces++;
 if(wasBreak)match.stats.breaks[winner]++;
 const game={setNumber:match.score.currentSetNumber,gameNumber:match.score.currentGameNumberInSet,globalGameNumber:match.gamesHistory.length+1,server:match.score.currentServer,winner,pointsWon:[...match.score.points],displayScore:buildGameScoreText(match.score.points,endedByNoAd),hadDeuce:match.currentGame.hadDeuce,endedByNoAd,wasBreak,pointSequence:[...match.currentGame.pointSequence],classifiedPoints:[...match.currentGame.classifiedPoints]};
 match.gamesHistory.push(game);
 match.score.games[winner]++;match.stats.gamesWon[winner]++;
 match.score.points=[0,0];match.currentGame={pointSequence:[],classifiedPoints:[],hadDeuce:false};
 match.score.currentServer=match.score.currentServer===0?1:0;
 if(match.score.games[winner]>=match.config.gamesPerSet&&match.score.games[winner]-match.score.games[loser]>=2){winSet(winner);}else{match.score.currentGameNumberInSet++;}
 save();updateUI();
}
function winSet(winner){
 match.setsHistory.push({number:match.score.currentSetNumber,winner,games:[...match.score.games],gamesHistory:match.gamesHistory.filter(g=>g.setNumber===match.score.currentSetNumber)});
 match.score.sets[winner]++;
 if(match.score.sets[winner]>=match.config.setsToWin){match.score.matchOver=true;match.meta.finishedAt=new Date().toISOString();return;}
 match.score.games=[0,0];match.score.currentSetNumber++;match.score.currentGameNumberInSet=1;
}
function buildGameScoreText(points,endedByNoAd){if(endedByNoAd)return"40-40, ponto decisivo No-Ad";return`${displayPoint(points[0])}-${displayPoint(points[1])}`;}
function displayPoint(value){return value<=3?pointMap[value]:"40";}
function readablePointDisplay(){
 const a=match.score.points[0],b=match.score.points[1];
 if(a>=3&&b>=3){if(a===b)return["40","40"];if(match.config.advantage)return a>b?["AD","40"]:["40","AD"];}
 return[displayPoint(a),displayPoint(b)];
}
function updateUI(){
 if(!match)return;
 name0.innerText=match.players[0];name1.innerText=match.players[1];
 const pts=readablePointDisplay();
 [0,1].forEach(i=>{
  document.getElementById(`centralPoint${i}`).innerText=pts[i];
  document.getElementById(`games${i}`).innerText=match.score.games[i];
  document.getElementById(`sets${i}`).innerText=match.score.sets[i];
 });
 serverBadge0.innerText=match.score.currentServer===0?"🎾 SACANDO":"";
 serverBadge1.innerText=match.score.currentServer===1?"🎾 SACANDO":"";
 playerCard0.classList.toggle("serving",match.score.currentServer===0);
 playerCard1.classList.toggle("serving",match.score.currentServer===1);
 serverInfo.innerText=`Sacando: ${match.players[match.score.currentServer]}`;
 setInfo.innerText=`Set ${match.score.currentSetNumber} · Game ${match.score.currentGameNumberInSet}`;
 ruleInfo.innerText=`${match.config.advantage?"Com vantagem":"Sem vantagem / No-Ad"} · ${match.config.gamesPerSet} games por set`;
 matchStatus.innerText=match.score.matchOver?`Partida encerrada · Vencedor: ${winnerName()}`:"Partida em andamento";
 renderGamesHistory();
}
function renderGamesHistory(){
 gamesHistory.innerHTML="";
 if(match.gamesHistory.length===0){gamesHistory.innerHTML='<div class="game-row">Nenhum game finalizado.</div>';return;}
 match.gamesHistory.slice(-8).reverse().forEach(game=>{
  const div=document.createElement("div");div.className="game-row";
  div.innerText=`S${game.setNumber} G${game.gameNumber}: ${match.players[game.winner]} ${game.displayScore} · Sacador: ${match.players[game.server]}${game.wasBreak?" · Quebra":""}`;
  gamesHistory.appendChild(div);
 });
}
function snapshot(){snapshots.push(JSON.stringify(match));if(snapshots.length>300)snapshots.shift();}
function undo(){if(snapshots.length===0)return;match=JSON.parse(snapshots.pop());save();updateUI();}
function newMatch(){
 if(!confirm("Encerrar a partida atual e iniciar uma nova?"))return;
 localStorage.removeItem("tennisMatchLandscape");
 match=null;
 snapshots=[];
 pendingPointWinner=null;
 lastPointType=null;
 document.getElementById("pointOverlay").classList.add("hidden");
 document.getElementById("matchScreen").classList.add("hidden");
 document.getElementById("setupScreen").classList.remove("hidden");
}
function winnerName(){if(match.score.sets[0]>match.score.sets[1])return match.players[0];if(match.score.sets[1]>match.score.sets[0])return match.players[1];return"-";}
function generateReport(){
 if(!match)return"Nenhuma partida registrada.";
 const started=new Date(match.meta.startedAt).toLocaleString("pt-BR");
 const finished=match.meta.finishedAt?new Date(match.meta.finishedAt).toLocaleString("pt-BR"):"partida em andamento";
 let t="PARTIDA DE TÊNIS\n\n";
 t+=`Início: ${started}\nFim: ${finished}\n\n`;
 t+=`Jogadores:\n${match.players[0]} x ${match.players[1]}\n\n`;
 t+="Configuração:\n";
 t+=`- Regra de vantagem: ${match.config.advantage?"com vantagem":"sem vantagem / No-Ad"}\n`;
 t+=`- Games por set: ${match.config.gamesPerSet}\n- Sets para vencer: ${match.config.setsToWin}\n- Sacador inicial: ${match.players[match.config.firstServer]}\n\n`;
 t+="Resultado:\n";
 t+=`- Sets: ${match.players[0]} ${match.score.sets[0]} x ${match.score.sets[1]} ${match.players[1]}\n`;
 t+=`- Games do set atual: ${match.score.games[0]} x ${match.score.games[1]}\n`;
 if(match.score.matchOver)t+=`- Vencedor: ${winnerName()}\n`;
 t+="\nResumo:\n";
 t+=`- Pontos vencidos: ${match.players[0]} ${match.stats.pointsWon[0]} | ${match.players[1]} ${match.stats.pointsWon[1]}\n`;
 t+=`- Games vencidos: ${match.players[0]} ${match.stats.gamesWon[0]} | ${match.players[1]} ${match.stats.gamesWon[1]}\n`;
 t+=`- Deuces: ${match.stats.deuces}\n- Games decididos em No-Ad: ${match.stats.noAdGames}\n`;
 t+=`- Quebras de saque: ${match.players[0]} ${match.stats.breaks[0]} | ${match.players[1]} ${match.stats.breaks[1]}\n`;
 t+=`- Aces: ${match.players[0]} ${match.stats.aces[0]} | ${match.players[1]} ${match.stats.aces[1]}\n`;
 t+=`- Service winners: ${match.players[0]} ${match.stats.serviceWinners[0]} | ${match.players[1]} ${match.stats.serviceWinners[1]}\n`;
 t+=`- Winners: ${match.players[0]} ${match.stats.winners[0]} | ${match.players[1]} ${match.stats.winners[1]}\n`;
 t+=`- Erros forçados: ${match.players[0]} ${match.stats.forcedErrors[0]} | ${match.players[1]} ${match.stats.forcedErrors[1]}\n`;
 t+=`- Erros não forçados: ${match.players[0]} ${match.stats.unforcedErrors[0]} | ${match.players[1]} ${match.stats.unforcedErrors[1]}\n`;
 t+=`- Duplas faltas: ${match.players[0]} ${match.stats.doubleFaults[0]} | ${match.players[1]} ${match.stats.doubleFaults[1]}\n\n`;
 t+="Detalhamento dos games:\n";
 if(match.gamesHistory.length===0)t+="Nenhum game finalizado.\n";
 else{
  let currentSet=null;
  match.gamesHistory.forEach(game=>{
   if(currentSet!==game.setNumber){currentSet=game.setNumber;t+=`\nSet ${currentSet}\n`;}
   t+=`${game.gameNumber}. ${match.players[game.winner]} venceu por ${game.displayScore} | Sacador: ${match.players[game.server]}`;
   if(game.wasBreak)t+=" | Quebra de saque";
   if(game.hadDeuce)t+=" | Houve deuce";
   if(game.endedByNoAd)t+=" | Decidido em No-Ad";
   t+="\n";
   const pt=game.classifiedPoints.map((p,idx)=>`${idx+1}) ${match.players[p.winner]} - ${typeLabels[p.type]||p.type}`).join("; ");
   t+=`   Pontos: ${pt}\n`;
  });
 }
 return t;
}
async function copyStats(){
 const report=generateReport();
 try{await navigator.clipboard.writeText(report);alert("Estatísticas copiadas.");}
 catch(e){fallbackCopy(report);}
}
function fallbackCopy(text){
 const area=document.createElement("textarea");
 area.value=text;area.style.position="fixed";area.style.opacity="0";
 document.body.appendChild(area);area.focus();area.select();document.execCommand("copy");document.body.removeChild(area);
 alert("Estatísticas copiadas.");
}
function save(){localStorage.setItem("tennisMatchLandscape",JSON.stringify(match));}
