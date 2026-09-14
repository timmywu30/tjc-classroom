import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Domain} from '../src/domain.js';
import {makeDemo} from '../src/demo.js';
let sequence=0;
const meta=()=>({id:'operation_test_'+(++sequence),now:'2026-09-14T00:00:00Z'});
const run=(db,action,payload,who='teacher',operation=meta())=>Domain.execute(db,who,action,payload,operation);
const add={studentIds:['s1'],termId:'term_115_1',amount:7,reason:'測試主動幫助同學'};
test('families cannot receive other children, drafts, credentials or private Drive IDs',()=>{
  const db=makeDemo();db.Users[0].uid='private-auth-uid';
  db.Announcements.push({id:'secret',classId:'children',title:'教員草稿',published:false});
  db.Albums.push({id:'published',classId:'children',published:true});
  db.Photos.push({id:'p1',albumId:'published',fileId:'private-drive-id',active:true,mime:'image/jpeg'});
  db.Photos.push({id:'p2',albumId:'album1',fileId:'draft-drive-id',active:true});
  const a=Domain.project(db,'parent_a'),b=Domain.project(db,'parent_b');
  assert.deepEqual(a.Students.map(s=>s.id),['s1','s2']);assert.deepEqual(b.Students.map(s=>s.id),['s3']);
  assert.ok(a.Points.every(p=>['s1','s2'].includes(p.studentId)));
  assert.ok(a.Attendance.every(p=>['s1','s2'].includes(p.studentId)));
  assert.deepEqual(a.Photos.map(p=>p.id),['p1']);
  assert.equal(a.Announcements.some(n=>n.id==='secret'),false);
  assert.equal(a.Users.length,0);assert.equal(a.Guardians.length,0);
  assert.ok(!JSON.stringify(a).includes('private-'));
  db.Guardians[0].active=false;assert.deepEqual(Domain.project(db,'parent_a').Students.map(s=>s.id),['s2']);
});
test('parent writes, cross-class changes and teacher role escalation are denied',()=>{
  const db=makeDemo();
  assert.throws(()=>run(db,'addPoints',add,'parent_a'),/查看權限/);
  db.Students[0].classId='other';assert.throws(()=>run(db,'addPoints',add),/管理權限/);
  assert.throws(()=>run(db,'saveSettings',{attendancePoints:100}),/班負責/);
  assert.throws(()=>run(db,'saveUser',{}),/班負責/);
});
test('operation replay cannot duplicate points or be reused for another payload or actor',()=>{
  const operation=meta(),first=run(makeDemo(),'addPoints',add,'teacher',operation);
  const again=run(first.db,'addPoints',add,'teacher',operation);
  assert.equal(again.replayed,true);assert.equal(Domain.points(again.db,'s1','term_115_1'),37);
  assert.equal(again.db.Points.length,first.db.Points.length);
  assert.throws(()=>run(first.db,'addPoints',{...add,amount:8},'teacher',operation),/操作編號/);
  assert.throws(()=>run(first.db,'addPoints',add,'admin',operation),/操作編號/);
});
test('attendance corrections append only deltas; repeated marks do not add points',()=>{
  const original=makeDemo(),present={courseId:'course2',records:[{studentId:'s1',status:'present'}]};
  const first=run(original,'attendance',present).db,second=run(first,'attendance',present).db;
  assert.equal(Domain.points(second,'s1','term_115_1'),35);
  const corrected=run(second,'attendance',{...present,records:[{studentId:'s1',status:'absent'}]}).db;
  assert.equal(Domain.points(corrected,'s1','term_115_1'),30);
  assert.deepEqual(corrected.Points.slice(-2).map(x=>x.amount),[5,-5]);
  assert.equal(original.Attendance.some(x=>x.courseId==='course2'),false);
});
test('changed scoring rules preserve unchanged attendance credit',()=>{
  let db=run(makeDemo(),'attendance',{courseId:'course2',records:[{studentId:'s1',status:'present'}]}).db;
  db=run(db,'saveSettings',{attendancePoints:10},'admin').db;
  db=run(db,'attendance',{courseId:'course2',records:[{studentId:'s1',status:'present'}]}).db;
  assert.equal(Domain.points(db,'s1','term_115_1'),35);
});
test('learning retracts credit; locked sessions and archived terms reject changes',()=>{
  let db=run(makeDemo(),'learning',{courseId:'course2',records:[{studentId:'s1',completed:true}]}).db;
  db=run(db,'learning',{courseId:'course2',records:[{studentId:'s1',completed:true}]}).db;
  assert.equal(Domain.points(db,'s1','term_115_1'),33);
  db=run(db,'learning',{courseId:'course2',records:[{studentId:'s1',completed:false}]}).db;
  assert.equal(Domain.points(db,'s1','term_115_1'),30);
  db=run(db,'lockSession',{courseId:'course2',locked:true}).db;
  assert.throws(()=>run(db,'attendance',{courseId:'course2',records:[{studentId:'s1',status:'present'}]}),/解除鎖定/);
  assert.throws(()=>run(db,'lockSession',{courseId:'course2',locked:false}),/班負責/);
  db=run(db,'lockSession',{courseId:'course2',locked:false},'admin').db;db.Terms[0].archived=true;
  assert.throws(()=>run(db,'addPoints',add),/封存/);
});
test('invalid batch leaves the original DB intact',()=>{
  const db=makeDemo(),original=JSON.stringify(db);
  assert.throws(()=>run(db,'attendance',{courseId:'course2',records:[{studentId:'s1',status:'present'},{studentId:'missing',status:'present'}]}),/學員/);
  assert.equal(JSON.stringify(db),original);
  assert.throws(()=>run(db,'addPoints',{...add,studentIds:['s1','s1']}),/重複/);
});
test('manual reversal preserves history and can happen only once',()=>{
  const first=run(makeDemo(),'addPoints',add).db,point=first.Points.at(-1);
  const reversed=run(first,'reversePoints',{id:point.id,reason:'誤登'}).db;
  assert.equal(Domain.points(reversed,'s1','term_115_1'),30);
  assert.ok(reversed.Points.some(p=>p.id===point.id));
  assert.throws(()=>run(reversed,'reversePoints',{id:point.id,reason:'再試'}),/已撤銷/);
  assert.throws(()=>run(first,'reversePoints',{id:'att_course0:s1',reason:'誤登'}),/原始登記/);
});
test('publishing requires photos and review; hiding a photo returns the album to draft',()=>{
  let db=makeDemo(),album=db.Albums[0];
  assert.throws(()=>run(db,'saveAlbum',{...album,published:true,reviewed:true}),/上傳照片/);
  db=run(db,'addPhoto',{albumId:'album1',fileId:'file1',name:'test.jpg',mime:'image/jpeg'}).db;
  assert.throws(()=>run(db,'saveAlbum',{...album,published:true,reviewed:false}),/分享同意/);
  db=run(db,'saveAlbum',{...album,published:true,reviewed:true}).db;
  assert.equal(Domain.project(db,'parent_a').Photos.length,1);
  assert.throws(()=>run(db,'addPhoto',{albumId:'album1',fileId:'file2',name:'second.jpg',mime:'image/jpeg'}),/草稿/);
  db=run(db,'hidePhoto',{id:db.Photos[0].id}).db;
  assert.equal(Domain.project(db,'parent_a').Photos.length,0);
  assert.equal(db.Albums[0].published,false);assert.equal(db.Albums[0].reviewed,false);
});
test('parent accounts require a child; admins cannot disable themselves',()=>{
  const db=makeDemo(),user={name:'測試家長',email:'example@example.invalid',role:'parent',classIds:['children'],active:true,studentIds:[]};
  assert.throws(()=>run(db,'saveUser',user,'admin'),/綁定/);
  assert.throws(()=>run(db,'saveUser',{...db.Users[3],active:false},'admin'),/自己/);
  const result=run(db,'saveUser',{...user,studentIds:['s1']},'admin');
  assert.deepEqual(Domain.project(result.db,result.result.id).Students.map(x=>x.id),['s1']);
});
test('imports update stable IDs and validate the entire scope before saving',()=>{
  const record={id:'source_01',name:'匯入示範',grade:'一年級',classId:'children',active:true,photoConsent:false};
  let db=run(makeDemo(),'importStudents',{records:[record]},'admin').db;
  db=run(db,'importStudents',{records:[{...record,name:'更新示範'}]},'admin').db;
  assert.equal(db.Students.length,5);assert.equal(db.Students.at(-1).name,'更新示範');
  assert.throws(()=>run(db,'importStudents',{records:[record]},'teacher'),/班負責/);
  assert.throws(()=>run(db,'importStudents',{records:[record,{...record,id:'source_02',classId:'other'}]},'admin'),/權限/);
  assert.equal(db.Students.length,5);
});
test('CSV export neutralizes formulas and escapes delimiters',()=>{
  const csv=Domain.csv([['=HYPERLINK("bad")','+123',' @SUM(1)','a,b','a"b','\n=bad']]);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"a,b"'));assert.ok(csv.includes('"a""b"'));assert.ok(csv.includes('"\' @SUM(1)"'));
});
test('Apps Script domain is the exact tested business logic',()=>{
  assert.equal(readFileSync(new URL('../apps-script/Domain.gs',import.meta.url),'utf8'),readFileSync(new URL('../src/domain.js',import.meta.url),'utf8').replace('export const Domain','var Domain'));
});
