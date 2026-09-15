import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {Domain} from '../src/domain.js';
import {makeDemo} from '../src/demo.js';
import {Schedule} from '../src/schedule.js';
import {scheduleFixture,scheduleOptions} from './schedule-fixture.mjs';
const code=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
const context=(overrides={})=>vm.createContext({Domain,Schedule,console,Date,JSON,Buffer,...overrides});
test('only doGet and authenticated rpc are exposed to google.script.run',()=>{
  const names=[...code.matchAll(/^function (\w+)\(/gm)].map(x=>x[1]);
  assert.deepEqual(names.filter(n=>!n.endsWith('_')),['doGet','rpc']);new vm.Script(code);
});
test('identity verification requires Google validation, matching project and valid current account',()=>{
  let calls=0,status=200;
  const claims={aud:'test-project',iss:'https://securetoken.google.com/test-project',sub:'uid1',exp:Date.now()/1000+3600,auth_time:100};
  let account={localId:'uid1',email:'allowed@example.invalid',emailVerified:true,validSince:'50',providerUserInfo:[{providerId:'google.com'}]};
  const c=context({
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='FIREBASE_PROJECT_ID'?'test-project':'test-api-key'})},
    Utilities:{base64DecodeWebSafe:x=>Buffer.from(x,'base64url'),newBlob:x=>({getDataAsString:()=>x.toString()})},
    UrlFetchApp:{fetch:()=>{calls++;return {getResponseCode:()=>status,getContentText:()=>JSON.stringify({users:[account]})};}}
  });
  vm.runInContext(code,c);
  const token=()=>['header',Buffer.from(JSON.stringify(claims)).toString('base64url'),'signature'].join('.');
  assert.equal(c.verifyIdentity_(token()).uid,'uid1');assert.equal(calls,1);
  status=400;assert.throws(()=>c.verifyIdentity_(token()),/失效/);
  status=200;account.emailVerified=false;assert.throws(()=>c.verifyIdentity_(token()),/驗證/);
  account.emailVerified=true;account.disabled=true;assert.throws(()=>c.verifyIdentity_(token()),/驗證/);
  account.disabled=false;account.validSince='101';assert.throws(()=>c.verifyIdentity_(token()),/驗證/);
  account.validSince='50';claims.aud='foreign-project';const before=calls;
  assert.throws(()=>c.verifyIdentity_(token()),/不屬於/);assert.equal(calls,before);
});
test('one atomic batch preserves physical sheet rows after UID-binding clones',()=>{
  const db=makeDemo(),info={};
  for(const name of Object.keys(Domain.tables)) {
    info[name]={sheetId:Object.keys(info).length,gridProperties:{rowCount:1000}};
    db[name].forEach((row,i)=>Object.defineProperty(row,'_row',{value:i*2+1,enumerable:false}));
  }
  const before=Domain.clone(db),after=Domain.clone(before);
  after.Students[1].name='修正名字';after.Points.push({...after.Points[0],id:'new-point',amount:1});
  after.Audit.push({id:'new-audit',actorId:'teacher',action:'addPoints',at:'now',requestHash:'hash',result:{}});
  const calls=[],c=context({Sheets:{Spreadsheets:{batchUpdate:(request,id)=>calls.push({request,id})}}});
  vm.runInContext(code,c);c.commitData_({id:'book',data:db,info},before,after);
  assert.equal(calls.length,1);assert.equal(calls[0].id,'book');
  const changes=calls[0].request.requests,student=changes.find(x=>x.updateCells?.start.sheetId===info.Students.sheetId);
  assert.equal(student.updateCells.start.rowIndex,3);assert.equal(changes.length,3);
});

test('an ambiguous commit keeps the operation retryable even when Google returns a localized error',()=>{
  const db=makeDemo();db.Users.find(u=>u.id==='teacher').uid='teacher-uid';
  const c=context({
    PropertiesService:{getScriptProperties:()=>({getProperties:()=>({})})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})}
  });
  vm.runInContext(code,c);
  c.verifyIdentity_=()=>({uid:'teacher-uid',email:'teacher@example.invalid'});
  c.loadData_=()=>({db});c.hash_=()=> 'stable-hash';
  c.commitData_=()=>{throw new Error('連線逾時，寫入結果不明');};
  const request={action:'addPoints',payload:{studentIds:['s1'],termId:'term_115_1',amount:2,reason:'測試'},operationId:'operation_timeout_001',idToken:'token'};
  const result=c.rpc(request);
  assert.equal(result.ok,false);assert.equal(result.uncertain,true);
  c.LockService.getScriptLock=()=>({tryLock:()=>false,releaseLock(){}});
  assert.equal(c.rpc(request).uncertain,true);
  c.LockService.getScriptLock=()=>({tryLock:()=>true,releaseLock(){}});
  request.payload.amount=0;
  assert.equal(c.rpc(request).uncertain,false);
});

test('schedule reader fetches merge metadata and raw dates from the specifically configured tab',()=>{
  const fixture=scheduleFixture(),calls=[];
  const sheets=[{properties:{title:'課表',sheetId:42,gridProperties:{columnCount:9,rowCount:1000}},merges:fixture.merges},
    {properties:{title:'Courses',sheetId:43,gridProperties:{columnCount:15,rowCount:1000}}}];
  const c=context({Sheets:{Spreadsheets:{
    get:(id,options)=>{calls.push({id,options});return {sheets};},
    Values:{get:(id,range,options)=>{calls.push({id,range,options});return {values:fixture.values};}}
  }}});
  vm.runInContext(code,c);c.hash_=()=> 'fixture';
  const props={SCHEDULE_SPREADSHEET_ID:'private-source',SCHEDULE_SHEET_NAME:'課表',SCHEDULE_TERM_ID:scheduleOptions.termId,SCHEDULE_CLASS_ID:scheduleOptions.classId};
  const result=c.readSchedule_(props);
  assert.equal(result.Courses.length,3);assert.equal(result.Courses[0].periods[0].label,'詩頌／崇拜');
  assert.equal(calls[0].options.fields,'sheets(properties,merges)');assert.equal(calls[1].range,"'課表'!A1:I1000");
  assert.equal(calls[1].options.dateTimeRenderOption,'SERIAL_NUMBER');
  assert.equal(JSON.stringify(result).includes('private-source'),false);
  assert.throws(()=>c.readSchedule_({...props,SCHEDULE_SHEET_NAME:''}),/唯一/);
  assert.throws(()=>c.readSchedule_({...props,SCHEDULE_TERM_ID:''}),/SCHEDULE_TERM_ID/);
});

test('changing the current term cannot silently move an existing Chinese schedule to the new term',()=>{
  const db=makeDemo();db.Settings.find(s=>s.id==='currentTermId').value='term_future';
  const c=context();vm.runInContext(code,c);
  c.readBook_=()=>({data:db});c.readSchedule_=()=>Schedule.parse(scheduleFixture().values,scheduleFixture().merges,scheduleOptions);
  assert.ok(c.loadData_({}).db.Courses.every(course=>course.termId==='term_115_1'));
  c.readSchedule_=()=>({Courses:[{termId:'missing'}],ScheduleInfo:[]});assert.throws(()=>c.loadData_({}),/學期代碼不存在/);
});

test('restoring a merged schedule preserves its IDs, periods, duty and season details in a new source',()=>{
  const db=makeDemo();Object.assign(db,Schedule.parse(scheduleFixture().values,scheduleFixture().merges,scheduleOptions));
  const props={RESTORE_FILE_ID:'backup',BACKUP_FOLDER_ID:'backups',ROOT_FOLDER_ID:'root',SCHEDULE_SHEET_NAME:'課表'},books=new Map();let sequence=0;
  const c=context({
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperties:values=>Object.assign(props,values),deleteProperty:k=>delete props[k]})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    DriveApp:{getFolderById:()=>({}),getFileById:id=>id==='backup'?{
      getParents:()=>{let done=false;return {hasNext:()=>!done,next:()=>{done=true;return {getId:()=> 'backups'};}};},
      getDescription:()=> 'tjc-classroom-backup-v1',getBlob:()=>({getDataAsString:()=>JSON.stringify({schemaVersion:1,data:db})})
    }:{moveTo(){}}},
    SpreadsheetApp:{create:()=>{const id='new-book-'+(++sequence),sheets=new Map();const book={id,sheets,getId:()=>id,getSheetByName:name=>sheets.get(name)};books.set(id,book);return book;}},
    Sheets:{Spreadsheets:{
      batchUpdate:(request,id)=>{for(const {updateCells:update} of request.requests){const sheet=[...books.get(id).sheets.values()].find(s=>s.sheetId===update.start.sheetId);update.rows.forEach((r,i)=>{sheet.values[update.start.rowIndex+i]=r.values.map(c=>Object.values(c.userEnteredValue)[0]);});}},
      get:id=>({sheets:[...books.get(id).sheets.values()].map(s=>({properties:{title:s.name,sheetId:s.sheetId,gridProperties:{rowCount:1000,columnCount:s.values[0].length}}}))}),
      Values:{
        get:(id,range)=>({values:books.get(id).sheets.get(range.split("'")[1]).values}),
        batchGet:(id,{ranges})=>({valueRanges:ranges.map(range=>({values:books.get(id).sheets.get(range.split("'")[1]).values}))})
      }
    }},console:{log(){},error(){}}
  });
  vm.runInContext(code,c);c.hash_=()=> 'restored';
  c.initBook_=(book,definitions)=>Object.entries(definitions).forEach(([name,fields],index)=>book.sheets.set(name,{name,sheetId:index,values:[fields],getSheetId:()=>index,getMaxRows:()=>1000}));
  c.restoreBackup_();
  assert.equal(props.SCHEDULE_SHEET_NAME,'Courses');assert.equal(props.RESTORE_FILE_ID,undefined);
  const restored=JSON.parse(JSON.stringify(c.readSchedule_(props)));
  assert.deepEqual(restored.Courses,db.Courses);assert.deepEqual(restored.ScheduleInfo,db.ScheduleInfo);
});
