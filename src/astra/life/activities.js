const lerp=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*Math.max(0,Math.min(1,u)));
const at=(p,y)=>[p[0],y,p[1]];
function route(points,u){const segment=Math.min(points.length-2,Math.floor(u*(points.length-1)));return lerp(points[segment],points[segment+1],u*(points.length-1)-segment);}
/** One coherent batting-practice repetition: pitch → hit → field → return;
 * the batter runs home/first/second/third/home in that order, then resets.
 * It is a practice drill, not a scored regulation baseball simulation. */
export function baseballFrame(interaction,seconds){
 const t=seconds%36,{bases,mound,field}=interaction.game,home=bases[0];
 const spots=Object.fromEntries(interaction.slots.map(s=>[s.role,[...s.position]]));
 let phase='Wind-up',ball=at(mound,1.15+.3*Math.max(0,Math.min(1,(t-1.3)/.7))),batting=false,running=false;
 if(t>=2&&t<2.8){phase='Pitch';ball=lerp(at(mound,1.45),at(home,1), (t-2)/.8);}
 else if(t>=2.8&&t<6){phase='Hit into the outfield';const u=(t-2.8)/3.2;ball=lerp(at(home,1),at(field,.25),u);ball[1]+=Math.sin(Math.PI*u)*4.3;batting=t<3.3;}
 else if(t>=6&&t<7){phase='Field the ball';ball=at(field,.25+(t-6)*.75);}
 else if(t>=7&&t<8.4){phase='Return to the mound';const u=(t-7)/1.4;ball=lerp(at(field,1),at(mound,1.15),u);ball[1]+=Math.sin(Math.PI*u)*1.8;}
 else if(t>=8.4){phase=t<23?'Run the bases':'Reset for the next pitch';ball=at(mound,1.15);}
 if(t>=3&&t<3.3){spots.batter=lerp(spots.batter,home,(t-3)/.3);running=true;}
 if(t>=3.3&&t<23){spots.batter=route([...bases,home],(t-3.3)/19.7);running=true;}
 if(t>=23&&t<24.5)spots.batter=lerp(home,interaction.slots.find(s=>s.role==='batter').position,(t-23)/1.5);
 if(t>=3&&t<6)spots.fielder=lerp(spots.fielder,field,(t-3)/3);
 if(t>=6&&t<8.4)spots.fielder=[...field];
 if(t>=8.4&&t<11)spots.fielder=lerp(field,spots.fielder,(t-8.4)/2.6);
 return {phase,ball,positions:spots,batting,running,pitching:t>=1.3&&t<2.8,fielding:t>=6&&t<7};
}
// A legal, authored opening. Piece movement and turns are shared by both players.
// After the line finishes, the board resets for another opening study.
export const CHESS_LINE=[['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','b5'],['a7','a6'],['b5','a4'],['g8','f6'],['e1','g1'],['f8','e7']];
export function chessFrame(seconds){const turn=Math.floor(seconds/5)%CHESS_LINE.length,u=seconds/5%1;return {turn,side:turn%2?'black':'white',move:CHESS_LINE[turn],progress:Math.min(1,u*2)};}
