export const Domain = (() => {
  const tables = {
    Settings: ['id','value'],
    Terms: ['id','name','archived'],
    Students: ['id','name','grade','classId','active','photoConsent'],
    Users: ['id','uid','email','name','role','classIds','active'],
    Guardians: ['id','userId','studentId','active'],
    Sessions: ['id','courseId','locked'],
    Attendance: ['id','courseId','termId','classId','studentId','status','credit','by','at'],
    Points: ['id','termId','classId','studentId','amount','reason','kind','sourceId','reversesId','by','at'],
    Learning: ['id','courseId','termId','classId','studentId','completed','credit','by','at'],
    Announcements: ['id','classId','title','body','published','pinned','at'],
    Events: ['id','classId','title','date','time','location','body','url','published'],
    Albums: ['id','classId','title','date','description','published','reviewed','coverId'],
    Photos: ['id','albumId','fileId','name','mime','active','at'],
    Audit: ['id','actorId','action','at','requestHash','result']
  };
  const courseFields=['id','termId','classId','date','startTime','endTime','title','scripture','verse','song','teacher','materials','notes','status','resourceUrl'];
  const clone = x => JSON.parse(JSON.stringify(x));
  function fail(message) { throw new Error(message); }
  function ensure(ok,message) { if(!ok) fail(message); }
  function text(value,max=500,required=false) {
    ensure(typeof value==='string','欄位格式不正確');
    const s=value.trim(); ensure(s.length<=max && (!required||s.length>0),'請填寫必填欄位，並確認文字長度'); return s;
  }
  function date(value) { const s=text(value,10,true); ensure(/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s,'日期格式不正確'); return s; }
  function url(value) { const s=text(value||'',2000); ensure(!s || /^https:\/\/[^\s]+$/i.test(s),'連結必須以 https:// 開頭'); return s; }
  const staff = actor => actor && (actor.role==='admin'||actor.role==='teacher');
  const setting = (db,id,fallback='') => { const r=db.Settings.find(x=>x.id===id); return r?r.value:fallback; };
  const classes = (db,actor) => actor.role==='parent'
    ? [...new Set(db.Students.filter(s=>db.Guardians.some(g=>g.active&&g.userId===actor.id&&g.studentId===s.id)).map(s=>s.classId))]
    : actor.classIds;
  const canClass = (db,actor,id) => Array.isArray(classes(db,actor))&&classes(db,actor).includes(id);
  const ownStudent = (db,actor,s) => !!s && (staff(actor)?canClass(db,actor,s.classId):db.Guardians.some(g=>g.active&&g.userId===actor.id&&g.studentId===s.id));
  function actor(db,id) { const a=db.Users.find(x=>x.id===id&&x.active); ensure(a,'帳號尚未開通或已停用，請聯絡班負責'); return a; }
  function project(db,actorId) {
    const a=actor(db,actorId), isStaff=staff(a);
    const students=db.Students.filter(s=>ownStudent(db,a,s));
    const ids=new Set(students.map(x=>x.id));
    const albums=db.Albums.filter(x=>canClass(db,a,x.classId)&&(isStaff||x.published));
    const albumIds=new Set(albums.map(x=>x.id));
    const courses=db.Courses.filter(x=>canClass(db,a,x.classId));
    const courseIds=new Set(courses.map(x=>x.id));
    const result={
      actor:{id:a.id,name:a.name,role:a.role,email:a.email,classIds:classes(db,a)},
      Settings:clone(db.Settings),Terms:clone(db.Terms),Students:clone(students),
      Courses:clone(courses),Sessions:clone(db.Sessions.filter(x=>courseIds.has(x.courseId))),
      ScheduleInfo:(db.ScheduleInfo||[]).filter(x=>canClass(db,a,x.classId)).map(x=>({
        id:x.id,termId:x.termId,classId:x.classId,title:x.title,goal:x.goal,activities:x.activities,
        ...(isStaff?{teacherNotes:x.teacherNotes}:{})
      })),
      Attendance:clone(db.Attendance.filter(x=>ids.has(x.studentId)&&canClass(db,a,x.classId))),
      Learning:clone(db.Learning.filter(x=>ids.has(x.studentId)&&canClass(db,a,x.classId))),
      Points:clone(db.Points.filter(x=>ids.has(x.studentId)&&canClass(db,a,x.classId))),
      Announcements:clone(db.Announcements.filter(x=>canClass(db,a,x.classId)&&(isStaff||x.published))),
      Events:clone(db.Events.filter(x=>canClass(db,a,x.classId)&&(isStaff||x.published))),
      Albums:clone(albums),
      Photos:db.Photos.filter(x=>x.active&&albumIds.has(x.albumId)).map(x=>({id:x.id,albumId:x.albumId,name:x.name,mime:x.mime,at:x.at,active:true})),
      Users:a.role==='admin'?db.Users.map(({uid,...u})=>({...clone(u),hasLogin:!!uid})):[],
      Guardians:a.role==='admin'?clone(db.Guardians):[],
      Audit:a.role==='admin'?db.Audit.slice(-100).reverse().map(x=>({id:x.id,actorId:x.actorId,action:x.action,at:x.at})):[]
    };
    return result;
  }
  function execute(original,actorId,action,payload,meta) {
    const db=clone(original),a=actor(db,actorId),p=payload||{};
    ensure(staff(a),'家長帳號只有查看權限');
    ensure(meta&&typeof meta.id==='string'&&/^[a-zA-Z0-9_-]{12,100}$/.test(meta.id),'操作編號不正確');
    const fingerprint=meta.hash||JSON.stringify({action,payload:p});
    const previous=db.Audit.find(x=>x.id===meta.id);
    if(previous) { ensure(previous.actorId===a.id&&previous.action===action&&previous.requestHash===fingerprint,'操作編號已被其他請求使用'); return {db,result:clone(previous.result),replayed:true}; }
    let seq=0; const id=prefix=>prefix+'_'+meta.id+'_'+(++seq),now=meta.now;
    const byId=(table,key)=>db[table].find(x=>x.id===key);
    const put=(table,row)=>{const i=db[table].findIndex(x=>x.id===row.id);if(i<0)db[table].push(row);else db[table][i]=row;return row;};
    const admin=()=>ensure(a.role==='admin','這個操作需要班負責權限');
    const classCheck=c=>ensure(canClass(db,a,c),'你沒有這個班級的管理權限');
    const studentCheck=sid=>{const s=byId('Students',sid);ensure(s&&s.active,'找不到在班學員');classCheck(s.classId);return s;};
    const termCheck=tid=>{const t=byId('Terms',tid);ensure(t&&!t.archived,'學期不存在或已封存');return t;};
    const courseCheck=cid=>{const c=db.Courses.find(x=>x.id===cid);ensure(c,'找不到課程');classCheck(c.classId);termCheck(c.termId);ensure(c.status!=='cancelled','停課課程不能點名或登記學習');return c;};
    const addPoint=(s,tid,amount,reason,kind,sourceId='',reversesId='')=>{
      if(amount===0)return;
      db.Points.push({id:id('point'),termId:tid,classId:s.classId,studentId:s.id,amount,reason,kind,sourceId,reversesId,by:a.id,at:now});
    };
    let result={message:'已儲存'};
    if(action==='saveStudent') {
      const old=p.id?byId('Students',p.id):null; if(p.id)ensure(old,'找不到學員');
      if(old)classCheck(old.classId); const classId=text(p.classId,100,true); classCheck(classId);
      if(old&&old.classId!==classId)admin();
      const row={id:old?old.id:id('student'),name:text(p.name,60,true),grade:text(p.grade,30,true),classId,active:p.active!==false,photoConsent:p.photoConsent===true};
      put('Students',row);result.id=row.id;
     } else if(action==='importStudents') {
      admin();
      ensure(Array.isArray(p.records)&&p.records.length>0&&p.records.length<=100,'每次請匯入 1–100 位學員');
      ensure(new Set(p.records.map(x=>x.id)).size===p.records.length,'匯入名單有重複 id');
      for(const record of p.records) {
        const key=text(record.id,100,true);ensure(/^[a-zA-Z0-9_-]+$/.test(key),'學員 id 只接受英文字母、數字、底線與連字號');
        const old=byId('Students',key),classId=text(record.classId,100,true);
        if(old)classCheck(old.classId);classCheck(classId);
        ensure(typeof record.active==='boolean'&&typeof record.photoConsent==='boolean','在班與照片同意欄位須為 TRUE 或 FALSE');
        put('Students',{id:key,name:text(record.name,60,true),grade:text(record.grade,30,true),classId,active:record.active,photoConsent:record.photoConsent});
      }
      result.count=p.records.length;
    } else if(action==='attendance'||action==='learning') {
      const c=courseCheck(p.courseId);ensure(!db.Sessions.some(x=>x.courseId===c.id&&x.locked),'這堂課已結束登記，請班負責先解除鎖定');
      ensure(Array.isArray(p.records)&&p.records.length>0&&p.records.length<=100,'請選擇 1–100 位學員');
      ensure(new Set(p.records.map(x=>x.studentId)).size===p.records.length,'學員不能重複');
      for(const r of p.records) {
        const s=studentCheck(r.studentId);ensure(s.classId===c.classId,'學員與課程班級不同');
        const key=c.id+':'+s.id,table=action==='attendance'?'Attendance':'Learning',old=byId(table,key);
        if(action==='attendance') {
          ensure(['present','late','leave','absent'].includes(r.status),'點名狀態不正確');
          const rate=r.status==='present'?Number(setting(db,'attendancePoints',5)):r.status==='late'?Number(setting(db,'latePoints',3)):0;
          const credit=old&&old.status===r.status?old.credit:rate;
          addPoint(s,c.termId,credit-(old?old.credit:0),'出席登記：'+c.title,'attendance',key);
          put(table,{id:key,courseId:c.id,termId:c.termId,classId:c.classId,studentId:s.id,status:r.status,credit,by:a.id,at:now});
        } else {
          ensure(typeof r.completed==='boolean','完成狀態不正確');
          const credit=old&&old.completed===r.completed?old.credit:r.completed?Number(setting(db,'versePoints',3)):0;
          addPoint(s,c.termId,credit-(old?old.credit:0),'金句背誦：'+c.title,'learning',key);
          put(table,{id:key,courseId:c.id,termId:c.termId,classId:c.classId,studentId:s.id,completed:r.completed,credit,by:a.id,at:now});
        }
      }
    } else if(action==='lockSession') {
      const c=courseCheck(p.courseId);if(p.locked===false)admin();
      put('Sessions',{id:c.id,courseId:c.id,locked:p.locked!==false});
    } else if(action==='addPoints') {
      const amount=Number(p.amount);ensure(Number.isInteger(amount)&&amount!==0&&Math.abs(amount)<=100,'每次調整須為 -100 到 100 的非零整數');
      const reason=text(p.reason,200,true);termCheck(p.termId);
      ensure(Array.isArray(p.studentIds)&&p.studentIds.length>0&&p.studentIds.length<=100,'請選擇學員');
      ensure(new Set(p.studentIds).size===p.studentIds.length,'學員不能重複');
      for(const sid of p.studentIds)addPoint(studentCheck(sid),p.termId,amount,reason,'manual');
    } else if(action==='reversePoints') {
      const row=byId('Points',p.id);ensure(row&&row.kind==='manual','僅能撤銷手動積分；出席與金句請修改原始登記');
      classCheck(row.classId);termCheck(row.termId);
      ensure(a.role==='admin'||row.by===a.id,'只能撤銷自己的登記');
      ensure(!db.Points.some(x=>x.reversesId===row.id),'這筆積分已撤銷');
      const s=byId('Students',row.studentId);ensure(s,'找不到學員');
      addPoint({...s,classId:row.classId},row.termId,-row.amount,'撤銷：'+text(p.reason,150,true),'reversal','',row.id);
    } else if(action==='saveAnnouncement'||action==='saveEvent'||action==='saveAlbum') {
      const table=action==='saveAnnouncement'?'Announcements':action==='saveEvent'?'Events':'Albums';
      const old=p.id?byId(table,p.id):null;if(p.id)ensure(old,'找不到資料');if(old)classCheck(old.classId);
      const classId=text(p.classId,100,true);classCheck(classId);
      let row={id:old?old.id:id(table.toLowerCase()),classId,title:text(p.title,100,true),published:p.published===true};
      if(table==='Announcements')row={...row,body:text(p.body,6000,true),pinned:p.pinned===true,at:old?old.at:now};
      if(table==='Events')row={...row,date:date(p.date),time:text(p.time||'',50),location:text(p.location||'',200),body:text(p.body||'',6000),url:url(p.url),published:p.published===true};
      if(table==='Albums') {
        const reviewed=p.reviewed===true;
        ensure(!row.published||reviewed,'發布前請確認照片分享同意');
        ensure(!row.published||db.Photos.some(x=>x.albumId===row.id&&x.active),'請先上傳照片再發布');
        const coverId=text(p.coverId||'',150);
        ensure(!coverId||db.Photos.some(x=>x.id===coverId&&x.albumId===row.id&&x.active),'封面不在這個相簿內');
        row={...row,date:date(p.date),description:text(p.description||'',2000),reviewed,coverId};
      }
      put(table,row);result.id=row.id;
    } else if(action==='addPhoto') {
      const album=byId('Albums',p.albumId);ensure(album,'找不到相簿');classCheck(album.classId);
      ensure(!album.published,'請先將相簿改為草稿再上傳新照片');
      ensure(['image/jpeg','image/png','image/webp'].includes(p.mime),'照片格式不支援');
      const row={id:id('photo'),albumId:album.id,fileId:text(p.fileId,300,true),name:text(p.name,150,true),mime:p.mime,active:true,at:now};
      put('Photos',row);put('Albums',{...album,reviewed:false});result.id=row.id;
    } else if(action==='hidePhoto') {
      const photo=byId('Photos',p.id);ensure(photo,'找不到照片');const album=byId('Albums',photo.albumId);ensure(album,'找不到相簿');classCheck(album.classId);
      put('Photos',{...photo,active:false});
      put('Albums',{...album,published:false,reviewed:false,coverId:album.coverId===photo.id?'':album.coverId});
    } else if(action==='saveUser') {
      admin();const old=p.id?byId('Users',p.id):null;if(p.id)ensure(old,'找不到帳號');
      const email=text(p.email,254,true).toLowerCase();ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Email 格式不正確');
      ensure(!db.Users.some(x=>x.email===email&&x.id!==(old&&old.id)),'這個 Email 已登記');
      if(old&&old.uid)ensure(email===old.email,'已綁定登入身分的 Email 不可直接修改');
      ensure(['admin','teacher','parent'].includes(p.role),'角色不正確');
      const classIds=Array.isArray(p.classIds)?[...new Set(p.classIds.map(x=>text(x,100,true)))]:[];
      ensure(classIds.length>0&&classIds.length<=20,'請設定班級範圍');classIds.forEach(classCheck);
      ensure(!old||old.id!==a.id||(p.active!==false&&p.role==='admin'),'不能停用或降級自己的管理員帳號');
      const row={id:old?old.id:id('user'),uid:old?old.uid:'',email,name:text(p.name,60,true),role:p.role,classIds,active:p.active!==false};
      put('Users',row);
      for(const g of db.Guardians.filter(x=>x.userId===row.id))put('Guardians',{...g,active:false});
      const studentIds=Array.isArray(p.studentIds)?[...new Set(p.studentIds)]:[];
      ensure(studentIds.length<=30,'綁定學員數量過多');ensure(p.role!=='parent'||studentIds.length>0,'家長帳號至少需綁定一位孩子');
      for(const sid of studentIds) {const s=byId('Students',sid);ensure(s&&canClass(db,a,s.classId),'找不到可綁定的學員');put('Guardians',{id:row.id+':'+sid,userId:row.id,studentId:sid,active:true});}
      result.id=row.id;
    } else if(action==='saveTerm') {
      admin();const old=p.id?byId('Terms',p.id):null;if(p.id)ensure(old,'找不到學期');
      const row={id:old?old.id:id('term'),name:text(p.name,40,true),archived:p.archived===true};
      ensure(!(row.archived&&row.id===setting(db,'currentTermId')),'請先切換目前學期，再封存舊學期');
      put('Terms',row);result.id=row.id;
    } else if(action==='saveSettings') {
      admin();
      for(const key of ['churchName','className','currentTermId','attendancePoints','latePoints','versePoints']) {
        if(!(key in p))continue;let value=p[key];
        if(key.endsWith('Points')) {value=Number(value);ensure(Number.isInteger(value)&&value>=0&&value<=100,'積分規則須為 0–100 的整數');}
        else value=text(value,100,true);
        if(key==='currentTermId')termCheck(value);put('Settings',{id:key,value});
      }
    } else fail('不支援的操作');
    db.Audit.push({id:meta.id,actorId:a.id,action,at:now,requestHash:fingerprint,result});
    return {db,result,replayed:false};
  }
  function points(db,studentId,termId) {return db.Points.filter(x=>x.studentId===studentId&&x.termId===termId).reduce((n,x)=>n+Number(x.amount),0);}
  function csv(rows) {
    const cell=x=>{let v=String(x==null?'':x);if(/^[\s]*[=+\-@]/.test(v)||/^[\t\r\n]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
    return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
  }
  return {tables,courseFields,clone,setting,staff,classes,canClass,ownStudent,actor,project,execute,points,csv};
})();
