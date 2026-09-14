import { Domain } from './domain.js';
export function makeDemo() {
  const db={};for(const key of Object.keys(Domain.tables))db[key]=[];
  db.Settings=[['churchName','真耶穌教會'],['className','幼年班'],['currentTermId','term_115_1'],['attendancePoints',5],['latePoints',3],['versePoints',3]].map(([id,value])=>({id,value}));
  db.Terms=[{id:'term_115_1',name:'115 學年度・上學期',archived:false},{id:'term_114_2',name:'114 學年度・下學期',archived:true}];
  db.Students=[
    {id:'s1',name:'小恩（示範）',grade:'一年級',classId:'children',active:true,photoConsent:true},
    {id:'s2',name:'小樂（示範）',grade:'三年級',classId:'children',active:true,photoConsent:true},
    {id:'s3',name:'小禾（示範）',grade:'二年級',classId:'children',active:true,photoConsent:false},
    {id:'s4',name:'小光（示範）',grade:'四年級',classId:'children',active:true,photoConsent:true}
  ];
  db.Users=[
    {id:'parent_a',uid:'',email:'parent-a@example.invalid',name:'小恩的家長',role:'parent',classIds:['children'],active:true},
    {id:'parent_b',uid:'',email:'parent-b@example.invalid',name:'小禾的家長',role:'parent',classIds:['children'],active:true},
    {id:'teacher',uid:'',email:'teacher@example.invalid',name:'林教員（示範）',role:'teacher',classIds:['children'],active:true},
    {id:'admin',uid:'',email:'admin@example.invalid',name:'班負責（示範）',role:'admin',classIds:['children'],active:true}
  ];
  db.Guardians=[{id:'ga1',userId:'parent_a',studentId:'s1',active:true},{id:'ga2',userId:'parent_a',studentId:'s2',active:true},{id:'gb',userId:'parent_b',studentId:'s3',active:true}];
  const today=new Date(Date.now()+8*3600000);const day=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
  const offset=(6-day.getUTCDay()+7)%7;day.setUTCDate(day.getUTCDate()+offset);
  const titles=['感謝神的看顧','學習彼此相愛','把神的話放在心裡','成為願意幫助人的孩子','一起學習禱告','珍惜身旁的同伴'];
  const scriptures=['詩篇 23:1','約翰福音 13:34','詩篇 119:11','加拉太書 6:2','帖撒羅尼迦前書 5:17','箴言 17:17'];
  db.Courses=titles.map((title,i)=>{const d=new Date(day);d.setUTCDate(d.getUTCDate()+(i-2)*7);return {id:'course'+i,termId:'term_115_1',classId:'children',date:d.toISOString().slice(0,10),startTime:'10:00',endTime:'11:30',title,scripture:scriptures[i],verse:i===2?'我將你的話藏在心裡，免得我得罪你。':'本週金句請依教員指定內容複習。',song:'由當週教員安排',teacher:'林教員、陳教員（示範）',materials:'聖經、筆、筆記本',notes:'示範課程，請以教員發布的正式課表為準。',status:'normal',resourceUrl:''};});
  for(let i=0;i<4;i++) {
    const s=db.Students[i];
    db.Points.push({id:'seed'+i,termId:'term_115_1',classId:'children',studentId:s.id,amount:20+i*6,reason:'學習參與（示範紀錄）',kind:'manual',sourceId:'',reversesId:'',by:'teacher',at:db.Courses[0].date+'T03:30:00Z'});
    for(const c of db.Courses.slice(0,2)) {
      const key=c.id+':'+s.id;
      db.Attendance.push({id:key,courseId:c.id,termId:c.termId,classId:'children',studentId:s.id,status:'present',credit:5,by:'teacher',at:c.date+'T02:00:00Z'});
      db.Points.push({id:'att_'+key,termId:c.termId,classId:'children',studentId:s.id,amount:5,reason:'出席登記：'+c.title,kind:'attendance',sourceId:key,reversesId:'',by:'teacher',at:c.date+'T02:00:00Z'});
    }
  }
  db.Announcements=[
    {id:'notice1',classId:'children',title:'上課前的小提醒',body:'請陪孩子預備聖經、筆與筆記本，並在上課前抵達教室。謝謝家長一起陪伴孩子學習。',published:true,pinned:true,at:db.Courses[1].date+'T01:00:00Z'},
    {id:'notice2',classId:'children',title:'一起留下學習的回憶',body:'相簿會由教員整理後發布。這裡的帳號、學員與課程都是示範資料。',published:true,pinned:false,at:db.Courses[0].date+'T01:00:00Z'}
  ];
  db.Events=[{id:'event1',classId:'children',title:'親子共學日（示範）',date:db.Courses[4].date,time:'10:00–12:00',location:'教會教室',body:'一起複習這學期的課程，分享孩子的小小進步。活動內容與時間請以正式公告為準。',url:'',published:true}];
  db.Albums=[{id:'album1',classId:'children',title:'課堂的美好片刻',date:db.Courses[1].date,description:'可以切換到教員身分，試著加入一張照片。',published:false,reviewed:false,coverId:''}];
  return db;
}
