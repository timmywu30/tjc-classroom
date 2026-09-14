/**
 * Only doGet and rpc are public. Every setup/storage helper ends in "_"
 * so google.script.run cannot invoke it.
 * Configure Script Properties and run setup_ manually before deployment.
 */
function doGet(e) {
  var props=PropertiesService.getScriptProperties();
  var origins=(props.getProperty('ALLOWED_ORIGINS')||'').split(',').map(function(x){return x.trim();}).filter(Boolean);
  if(!origins.length)return HtmlService.createHtmlOutput('請先設定 ALLOWED_ORIGINS');
  var nonce=String(e&&e.parameter&&e.parameter.nonce||'');
  if(!/^[a-zA-Z0-9-]{20,100}$/.test(nonce))return HtmlService.createHtmlOutput('這是班級資料服務，請由班級網站開啟。');
  var page=HtmlService.createTemplateFromFile('Bridge');
  page.originsJson=JSON.stringify(origins).replace(/</g,'\\u003c');
  page.nonceJson=JSON.stringify(nonce);
  return page.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function rpc(request) {
  var lock,orphan=null;
  try {
    if(!request||typeof request.action!=='string')throw new Error('請求格式不正確');
    var allowed=['bootstrap','systemInfo','getPhoto','exportData','uploadPhoto','previewStudentImport','importStudents','saveStudent','attendance','learning','lockSession','addPoints','reversePoints','saveAnnouncement','saveEvent','saveAlbum','hidePhoto','saveUser','saveTerm','saveSettings'];
    if(allowed.indexOf(request.action)<0)throw new Error('不支援的操作');
    var identity=verifyIdentity_(request.idToken);
    lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw new Error('其他教員正在儲存，請稍後再試');
    var props=PropertiesService.getScriptProperties().getProperties(),loaded=loadData_(props),db=loaded.db;
    var user=db.Users.find(function(x){return x.uid===identity.uid;});
    if(!user) {
      user=db.Users.find(function(x){return !x.uid&&x.email.toLowerCase()===identity.email.toLowerCase()&&x.active;});
      if(!user)throw new Error('這個 Google 帳號尚未開通，請將登入 Email 告知班負責');
      var next=Domain.clone(db);next.Users.find(function(x){return x.id===user.id;}).uid=identity.uid;
      commitData_(loaded,db,next);db=next;user=db.Users.find(function(x){return x.id===user.id;});
    }
    if(!user.active)throw new Error('帳號已停用，請聯絡班負責');
    if(request.action==='bootstrap')return {ok:true,data:{snapshot:Domain.project(db,user.id)}};
    if(request.action==='systemInfo') {
      if(user.role!=='admin')throw new Error('需要班負責權限');
      return {ok:true,data:{spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+props.DATA_SPREADSHEET_ID+'/edit',scheduleUrl:'https://docs.google.com/spreadsheets/d/'+props.SCHEDULE_SPREADSHEET_ID+'/edit',driveUrl:'https://drive.google.com/drive/folders/'+props.PHOTO_FOLDER_ID,backupUrl:'https://drive.google.com/drive/folders/'+props.BACKUP_FOLDER_ID,timezone:'Asia/Taipei'}};
    }
    if(request.action==='exportData') {
      if(user.role!=='admin')throw new Error('需要班負責權限');
      return {ok:true,data:{schemaVersion:1,exportedAt:new Date().toISOString(),data:db}};
    }
    var payload=request.payload||{};
    if(request.action==='previewStudentImport') {
      if(user.role!=='admin')throw new Error('需要班負責權限');
      if(!props.STUDENT_SOURCE_SPREADSHEET_ID)throw new Error('請先由系統管理員設定 STUDENT_SOURCE_SPREADSHEET_ID，來源分頁須為 Students');
      var records=readBook_(props.STUDENT_SOURCE_SPREADSHEET_ID,{Students:Domain.tables.Students}).data.Students;
      Domain.execute(db,user.id,'importStudents',{records:records},{id:Utilities.getUuid(),now:new Date().toISOString()});
      return {ok:true,data:{records:records}};
    }
    if(request.action==='getPhoto') {
      var visible=Domain.project(db,user.id).Photos.some(function(x){return x.id===payload.id;});
      if(!visible)throw new Error('沒有照片存取權限');
      var photo=db.Photos.find(function(x){return x.id===payload.id;});
      lock.releaseLock();lock=null;
      var blob=DriveApp.getFileById(photo.fileId).getBlob();
      if(blob.getBytes().length>1100000)throw new Error('照片過大');
      return {ok:true,data:{mime:photo.mime,base64:Utilities.base64Encode(blob.getBytes())}};
    }
    if(!Domain.staff(user))throw new Error('家長帳號只有查看權限');
    var operationId=String(request.operationId||'');
    if(!/^[a-zA-Z0-9_-]{12,100}$/.test(operationId))throw new Error('操作編號不正確');
    var hash=hash_(JSON.stringify({action:request.action,payload:payload}));
    var previous=db.Audit.find(function(x){return x.id===operationId;});
    if(previous) {
      if(previous.actorId!==user.id||previous.action!==request.action||previous.requestHash!==hash)throw new Error('操作編號已被其他請求使用');
      return {ok:true,data:{snapshot:Domain.project(db,user.id),result:previous.result,replayed:true}};
    }
    var action=request.action,originalAction=action;
    if(action==='uploadPhoto') {
      var album=db.Albums.find(function(x){return x.id===payload.albumId;});
      if(!album||!Domain.canClass(db,user,album.classId))throw new Error('沒有這個相簿的管理權限');
      if(album.published)throw new Error('請先將相簿改為草稿再上傳');
      if(payload.mime!=='image/jpeg'||typeof payload.base64!=='string'||payload.base64.length>1400000||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload.base64))throw new Error('照片格式或大小不正確');
      var bytes=Utilities.base64Decode(payload.base64);
      if(bytes.length<4||bytes.length>1100000||(bytes[0]&255)!==255||(bytes[1]&255)!==216||(bytes[bytes.length-2]&255)!==255||(bytes[bytes.length-1]&255)!==217)throw new Error('只接受有效 JPEG 照片');
      var name=String(payload.name||'photo.jpg').replace(/[\/\\\u0000-\u001f]/g,'_').slice(0,140);
      orphan=DriveApp.getFolderById(props.PHOTO_FOLDER_ID).createFile(Utilities.newBlob(bytes,'image/jpeg',name));
      // The folder must stay restricted. The app never creates public Drive links.
      payload={albumId:album.id,fileId:orphan.getId(),name:name,mime:'image/jpeg'};
      action='addPhoto';
    }
    var change=Domain.execute(db,user.id,action,payload,{id:operationId,hash:hash,now:new Date().toISOString()});
    // Preserve the externally requested action for idempotent upload retries.
    change.db.Audit[change.db.Audit.length-1].action=originalAction;
    commitData_(loaded,db,change.db);orphan=null;
    return {ok:true,data:{snapshot:Domain.project(change.db,user.id),result:change.result}};
  } catch(error) {
    // A Drive upload and Sheets batch are not one transaction. An ambiguous Sheets
    // timeout can have committed the photo index: keep the file for reconciliation.
    // Unindexed files may be reviewed in Drive by the owner; never trash blindly.
    return {ok:false,error:publicError_(error),uncertain:!(/^[\u3400-\u9fff]/.test(String(error&&error.message||'')))};
  } finally {if(lock)lock.releaseLock();}
}
function publicError_(error) {
  var message=String(error&&error.message||'操作失敗');
  if(/^[\u3400-\u9fff]/.test(message))return message.slice(0,250);
  console.error('Classroom operation failed; inspect Apps Script execution details.');
  return 'Google 服務暫時無法完成操作。請先重新整理核對紀錄，再使用重試功能。';
}
function hash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(n){return ('0'+((n+256)%256).toString(16)).slice(-2);}).join('');
}
function verifyIdentity_(token) {
  if(typeof token!=='string'||token.length>8000)throw new Error('登入憑證不正確，請重新登入');
  var props=PropertiesService.getScriptProperties(),project=props.getProperty('FIREBASE_PROJECT_ID'),key=props.getProperty('FIREBASE_WEB_API_KEY');
  if(!project||!key)throw new Error('Google 登入服務尚未完成設定');
  var pieces=token.split('.');if(pieces.length!==3)throw new Error('登入憑證不正確');
  var claims;
  try{claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pieces[1])).getDataAsString());}catch(e){throw new Error('登入憑證不正確');}
  if(claims.aud!==project||claims.iss!=='https://securetoken.google.com/'+project||!claims.sub||claims.exp<=Date.now()/1000)throw new Error('登入憑證已失效或不屬於本系統');
  // Online validation is performed by Google's Auth REST API, not by decoding alone.
  var response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(key),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('登入憑證已失效，請重新登入');
  var account=(JSON.parse(response.getContentText()).users||[])[0];
  if(!account||account.disabled||!account.emailVerified||account.localId!==claims.sub||!account.providerUserInfo?.some(function(x){return x.providerId==='google.com';})||Number(account.validSince||0)>Number(claims.auth_time||0))throw new Error('Google 帳號驗證未通過');
  return {uid:account.localId,email:account.email};
}
function decodeCell_(key,value) {
  if(key==='classIds'||key==='result') {try{return value?JSON.parse(String(value)):key==='classIds'?[]:{};}catch(e){throw new Error('班級資料中的 JSON 欄位格式不正確');}}
  if(['active','photoConsent','archived','locked','completed','published','pinned','reviewed'].indexOf(key)>=0)return value===true||String(value).toLowerCase()==='true';
  if(['amount','credit'].indexOf(key)>=0)return Number(value||0);
  return value==null?'':String(value);
}
function readBook_(bookId,definitions) {
  if(!bookId)throw new Error('尚未設定試算表，請先執行 setup_');
  var meta=Sheets.Spreadsheets.get(bookId,{fields:'sheets.properties'});
  var info={},ranges=[];
  Object.keys(definitions).forEach(function(name){
    var sheet=meta.sheets.find(function(s){return s.properties.title===name;});
    if(!sheet)throw new Error('試算表缺少分頁：'+name);
    info[name]=sheet.properties;
    ranges.push("'"+name+"'!A1:"+column_(definitions[name].length)+sheet.properties.gridProperties.rowCount);
  });
  var results=Sheets.Spreadsheets.Values.batchGet(bookId,{ranges:ranges,valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}).valueRanges||[];
  var data={};
  Object.keys(definitions).forEach(function(name,idx){
    var rows=results[idx]?.values||[],fields=definitions[name];
    if(JSON.stringify(rows[0]||[])!==JSON.stringify(fields))throw new Error('分頁 '+name+' 的第一列欄位已變更，請依範本恢復');
    var seen={};data[name]=[];
    rows.slice(1).forEach(function(values,n){
      if(values.every(function(v){return v===''||v==null;}))return;
      if(!values[0])throw new Error(name+' 第 '+(n+2)+' 列缺少 id');
      var row={};fields.forEach(function(key,i){
        var v=values[i];
        if(name==='Courses'&&key==='date'&&typeof v==='number')v=new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10);
        if(name==='Courses'&&['startTime','endTime'].indexOf(key)>=0&&typeof v==='number'){var minutes=Math.round(v*1440);v=('0'+Math.floor(minutes/60)).slice(-2)+':'+('0'+minutes%60).slice(-2);}
        row[key]=decodeCell_(key,v);
      });
      if(seen[row.id])throw new Error(name+' 有重複 id：'+row.id);seen[row.id]=true;
      Object.defineProperty(row,'_row',{value:n+1,enumerable:false});data[name].push(row);
    });
  });
  return {id:bookId,data:data,info:info};
}
function loadData_(props) {
  var loaded=readBook_(props.DATA_SPREADSHEET_ID,Domain.tables);
  var schedule=readBook_(props.SCHEDULE_SPREADSHEET_ID,{Courses:Domain.courseFields});
  loaded.db=loaded.data;loaded.db.Courses=schedule.data.Courses;
  return loaded;
}
function column_(n){var s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function cell_(value) {
  if(typeof value==='boolean')return {userEnteredValue:{boolValue:value}};
  if(typeof value==='number')return {userEnteredValue:{numberValue:value}};
  return {userEnteredValue:{stringValue:typeof value==='object'?JSON.stringify(value):String(value==null?'':value)}};
}
function commitData_(loaded,before,after) {
  var requests=[];
  Object.keys(Domain.tables).forEach(function(name){
    var props=loaded.info[name],fields=Domain.tables[name];
    var originals=before[name],physical=loaded.data[name],next=after[name],last=Math.max(0,...physical.map(function(x){return x._row==null?physical.indexOf(x)+1:x._row;}));
    var appended=0,updates=[];
    next.forEach(function(row){
      var old=originals.find(function(x){return x.id===row.id;});
      if(old&&JSON.stringify(old)===JSON.stringify(row))return;
      var position=physical.find(function(x){return x.id===row.id;});
      var rowIndex=old?(position._row==null?physical.indexOf(position)+1:position._row):last+(++appended);
      updates.push({updateCells:{start:{sheetId:props.sheetId,rowIndex:rowIndex,columnIndex:0},rows:[{values:fields.map(function(key){return cell_(row[key]);})}],fields:'userEnteredValue'}});
    });
    var need=last+appended+1-props.gridProperties.rowCount;
    if(need>0)requests.push({appendDimension:{sheetId:props.sheetId,dimension:'ROWS',length:Math.max(need,100)}});
    requests=requests.concat(updates);
  });
  // All attendance, points, learning and idempotency/audit rows commit atomically
  // in ONE Sheets batchUpdate against the same spreadsheet.
  if(requests.length)Sheets.Spreadsheets.batchUpdate({requests:requests},loaded.id);
}
function setup_() {
  var props=PropertiesService.getScriptProperties();
  var email=(props.getProperty('ADMIN_EMAIL')||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('請先在指令碼屬性設定 ADMIN_EMAIL');
  var folderId=props.getProperty('ROOT_FOLDER_ID');
  if(!folderId){folderId=DriveApp.createFolder('幼年班管理系統').getId();props.setProperty('ROOT_FOLDER_ID',folderId);}
  var root=DriveApp.getFolderById(folderId);
  ['PHOTO_FOLDER_ID','BACKUP_FOLDER_ID'].forEach(function(key){if(!props.getProperty(key))props.setProperty(key,root.createFolder(key==='PHOTO_FOLDER_ID'?'課堂照片':'資料備份').getId());});
  if(!props.getProperty('DATA_SPREADSHEET_ID')) {
    var data=SpreadsheetApp.create('幼年班｜班級資料（限管理員）');
    DriveApp.getFileById(data.getId()).moveTo(root);initBook_(data,Domain.tables);
    var adminId=Utilities.getUuid();
    data.getSheetByName('Users').appendRow([adminId,'',email,'班負責','admin','["children"]',true]);
    data.getSheetByName('Terms').appendRow(['term_115_1','115 學年度・上學期',false]);
    data.getSheetByName('Settings').getRange(2,1,6,2).setValues([['churchName','真耶穌教會'],['className','幼年班'],['currentTermId','term_115_1'],['attendancePoints',5],['latePoints',3],['versePoints',3]]);
    props.setProperty('DATA_SPREADSHEET_ID',data.getId());
  }
  if(!props.getProperty('SCHEDULE_SPREADSHEET_ID')) {
    var schedule=SpreadsheetApp.create('幼年班｜課表');
    DriveApp.getFileById(schedule.getId()).moveTo(root);initBook_(schedule,{Courses:Domain.courseFields});
    var notes=['固定且不重複的課程編號，例如 1151-01','學期代碼，初始值 term_115_1','班級代碼，初始值 children','日期 YYYY-MM-DD','開始時間 HH:mm','結束時間 HH:mm','課程主題','經文範圍','完整金句','詩歌','教員','需攜帶物品','備註','normal 或 cancelled','教材 HTTPS 連結'];
    schedule.getSheetByName('Courses').getRange(1,1,1,notes.length).setNotes([notes]);
    props.setProperty('SCHEDULE_SPREADSHEET_ID',schedule.getId());
  }
  if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='dailyBackup_';}))ScriptApp.newTrigger('dailyBackup_').timeBased().everyDays(1).atHour(2).inTimezone('Asia/Taipei').create();
  console.log('初始化完成。請到執行記錄查看以下資料連結。');
  console.log('班級資料：https://docs.google.com/spreadsheets/d/'+props.getProperty('DATA_SPREADSHEET_ID')+'/edit');
  console.log('課表：https://docs.google.com/spreadsheets/d/'+props.getProperty('SCHEDULE_SPREADSHEET_ID')+'/edit');
}
function initBook_(book,definitions) {
  book.setSpreadsheetTimeZone('Asia/Taipei');
  Object.keys(definitions).forEach(function(name){
    var sheet=book.getSheetByName(name)||book.insertSheet(name),fields=definitions[name];
    sheet.getRange(1,1,1,fields.length).setValues([fields]).setBackground('#256553').setFontColor('#ffffff').setFontWeight('bold').setNotes([fields.map(function(key){return key==='id'?'固定識別碼，請勿重複或修改。':'系統欄位：'+key;})]);
    sheet.setFrozenRows(1);sheet.setColumnWidths(1,fields.length,150);
    sheet.getRange(1,1,sheet.getMaxRows(),fields.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    if(name!=='Courses')sheet.getRange(2,1,sheet.getMaxRows()-1,fields.length).setNumberFormat('@');
  });
  book.getSheets().forEach(function(sheet){if(!definitions[sheet.getName()]&&sheet.getLastRow()===0&&book.getSheets().length>1)book.deleteSheet(sheet);});
}
function dailyBackup_() {
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    var props=PropertiesService.getScriptProperties().getProperties(),db=loadData_(props).db;
    var folder=DriveApp.getFolderById(props.BACKUP_FOLDER_ID);
    var name='tjc-data-'+Utilities.formatDate(new Date(),'Asia/Taipei','yyyy-MM-dd-HHmmss')+'.json';
    var file=folder.createFile(name,JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),data:db}),MimeType.PLAIN_TEXT);
    file.setDescription('tjc-classroom-backup-v1');
    var files=folder.getFiles(),cutoff=Date.now()-30*86400000;
    while(files.hasNext()){var old=files.next();if(old.getDescription()==='tjc-classroom-backup-v1'&&old.getDateCreated().getTime()<cutoff)old.setTrashed(true);}
  } finally {lock.releaseLock();}
}
function restoreBackup_() {
  var props=PropertiesService.getScriptProperties(),fileId=props.getProperty('RESTORE_FILE_ID');
  if(!fileId)throw new Error('請先設定 RESTORE_FILE_ID，完成後移除此屬性');
  var file=DriveApp.getFileById(fileId),parents=file.getParents(),owned=false;
  while(parents.hasNext())if(parents.next().getId()===props.getProperty('BACKUP_FOLDER_ID'))owned=true;
  if(!owned||file.getDescription()!=='tjc-classroom-backup-v1')throw new Error('只能還原本系統備份資料夾內的備份');
  var backup=JSON.parse(file.getBlob().getDataAsString());
  if(backup.schemaVersion!==1||!backup.data)throw new Error('備份格式不正確');
  Object.keys(Domain.tables).concat(['Courses']).forEach(function(key){if(!Array.isArray(backup.data[key]))throw new Error('備份缺少資料表：'+key);});
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    var root=DriveApp.getFolderById(props.getProperty('ROOT_FOLDER_ID'));
    var data=SpreadsheetApp.create('幼年班｜還原資料 '+new Date().toISOString()),schedule=SpreadsheetApp.create('幼年班｜還原課表 '+new Date().toISOString());
    DriveApp.getFileById(data.getId()).moveTo(root);DriveApp.getFileById(schedule.getId()).moveTo(root);
    initBook_(data,Domain.tables);initBook_(schedule,{Courses:Domain.courseFields});
    Object.keys(Domain.tables).concat(['Courses']).forEach(function(name){
      var book=name==='Courses'?schedule:data,fields=name==='Courses'?Domain.courseFields:Domain.tables[name],rows=backup.data[name];
      if(rows.length){var sheet=book.getSheetByName(name);if(sheet.getMaxRows()<rows.length+1)sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+1-sheet.getMaxRows());
        Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{start:{sheetId:sheet.getSheetId(),rowIndex:1,columnIndex:0},rows:rows.map(function(row){return {values:fields.map(function(key){return cell_(row[key]);})};}),fields:'userEnteredValue'}}]},book.getId());}
    });
    props.setProperties({DATA_SPREADSHEET_ID:data.getId(),SCHEDULE_SPREADSHEET_ID:schedule.getId()});props.deleteProperty('RESTORE_FILE_ID');
    console.log('已切換到還原後的資料。舊資料與課表仍保留在 Drive。');
  } finally {lock.releaseLock();}
}
