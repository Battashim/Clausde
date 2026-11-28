,
{id:"funino",name:"Funino 3v3",pos:["all","att","mid"],theme:"Game intelligence",n:"6 (3 v 3) per pitch",area:"32 × 25 m",time:"20–30 min",age:"U6 – U12",
 coerver:"Ball mastery and 1v1 moves happen naturally: few players, many touches.",ekkono:"Perception-decision: two goals to attack means a real choice every attack.",
 fab:"Switching the play and finding the free side, learned by playing.",
 fixes:["scan","movement","att1v1","talk"],
 fun:"It's a real match every minute. Goal = 1. Goal after switching to the other goal = 2. Rotate one player every 3 minutes so nobody waits long.",
 setup:"3 v 3, no goalkeepers. Two mini-goals on each end line, far apart. A shooting zone about 6 m from each end line (shorter for the youngest). Based on Horst Wein's Funino.",
 how:["Each team attacks the two goals on the opposite end line.","Goals only count when the shot is taken inside the shooting zone.","Restart with a dribble-in from your own end line after a goal or when the ball goes out.","Every 3 minutes one player per team swaps out and does 20 ball-mastery touches."],
 points:["Look up: which goal is less defended?","Make the pitch big: one wide, one deep, one supporting","Defenders: protect the goal nearest the ball, then shift together","Celebrate the decision, not only the goal"],
 prog:["Easier: 3 v 2, or bigger goals","Harder: 2 touches max in the shooting zone","Harder: a goal counts only after all 3 players touched the ball"],
 view:{w:32,h:25},marks:[{t:"zone",x:26,y:0,w:6,h:25,lab:"ZONE"},{t:"zone",x:0,y:0,w:6,h:25},{t:"line",x1:6,y1:0,x2:6,y2:25},{t:"line",x1:26,y1:0,x2:26,y2:25},{t:"goal",x:32,y:4,w:3,v:"right"},{t:"goal",x:32,y:21,w:3,v:"right"},{t:"goal",x:-.9,y:4,w:3,v:"right"},{t:"goal",x:-.9,y:21,w:3,v:"right"}],
 cast:[{id:"a1",t:"a",l:"",x:8,y:8},{id:"a2",t:"a",l:"",x:12,y:17},{id:"a3",t:"a",l:"",x:15,y:12},{id:"b1",t:"b",l:"",x:22,y:8},{id:"b2",t:"b",l:"",x:24,y:17},{id:"b3",t:"b",l:"",x:20,y:13}],ball:"a1",focus:["a1","a2","a3"],
 frames:[
  {d:1.2,cap:"Red attacks the two goals on the right. Blue shifts to protect the top goal, where the ball is.",m:{a1:[11,7],b1:[24,6],b2:[25,11],b3:[20,9]}},
  {d:1,cap:"Look up: the top goal is blocked, so the bottom goal is open.",b:"a3",m:{a3:[16,12],b3:[19,11]}},
  {d:1.2,cap:"Switch the play to the open side.",b:"a2",m:{a2:[21,19],b2:[25,14]}},
  {d:1,cap:"Dribble into the shooting zone. Goals only count from inside it.",m:{a2:[27.5,20],b2:[27,16.5]}},
  {d:.8,cap:"Goal! Nobody said 'switch it'. The two goals taught them to look for the free side.",b:[32.8,21]}
 ]}
