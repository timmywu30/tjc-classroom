import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {Domain} from '../src/domain.js';
import {makeDemo} from '../src/demo.js';
const code=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
const context=(overrides={})=>vm.createContext({Domain,console,Date,JSON,Buffer,...overrides});
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
