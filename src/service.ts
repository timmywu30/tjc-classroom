import { Domain } from './domain.js';
import { makeDemo } from './demo.js';

declare global { interface Window { CLASSROOM_CONFIG?: any } }
export const config=window.CLASSROOM_CONFIG||{mode:'demo'};
if(!['demo','google'].includes(config.mode))throw new Error('config.js 的 mode 必須為 demo 或 google');
export const isDemo=config.mode==='demo';
const KEY='tjc-classroom-demo-v1';
let demoId=sessionStorage.getItem('tjc-demo-role')||'parent_a';
let pack:any;
try {pack=JSON.parse(localStorage.getItem(KEY)||'null');if(!pack?.db?.Users)pack=null;}catch{pack=null;}
if(!pack)pack={db:makeDemo(),media:{}};
let auth:any;
async function getAuthClient(){
  if(auth)return auth;
  if(!config.firebase?.apiKey||!config.firebase?.projectId||!config.firebase?.authDomain)throw new Error('Google 登入尚未完成設定，請聯絡班負責');
  const [{initializeApp},{getAuth,setPersistence,browserSessionPersistence}]=await Promise.all([import('firebase/app'),import('firebase/auth')]);
  auth=getAuth(initializeApp(config.firebase));await setPersistence(auth,browserSessionPersistence);await auth.authStateReady();return auth;
}
let bridgePromise:Promise<any>|null=null;
let bridgeFrame:HTMLIFrameElement|null=null;
const waiting=new Map<string,any>();
function isGoogleOrigin(origin:string) {
  try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.googleusercontent.com'||/^[a-z0-9-]+-script\.googleusercontent\.com$/.test(u.hostname));}catch{return false;}
}
function connectBridge():Promise<any> {
  if(bridgePromise)return bridgePromise;
  bridgePromise=new Promise((resolve,reject)=>{
    const endpoint=String(config.appsScriptUrl||'');
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){reject(new Error('Apps Script 網址尚未設定'));return;}
    const nonce=crypto.randomUUID();
    const iframe=document.createElement('iframe');bridgeFrame=iframe;iframe.hidden=true;iframe.title='班級資料連線';
    const timeout=setTimeout(()=>{cleanup();iframe.remove();bridgePromise=null;reject(new Error('無法連接班級資料，請確認 Apps Script 已部署為「任何人」可存取，並使用 Safari 或 Chrome 開啟'));},25000);
    const onMessage=(e:MessageEvent)=>{
      if(e.data?.type!=='tjc:ready'||e.data?.nonce!==nonce||!isGoogleOrigin(e.origin)||!e.source)return;
      cleanup();const source=e.source as Window,origin=e.origin;
      const receive=(event:MessageEvent)=>{
        if(event.source!==source||event.origin!==origin||event.data?.type!=='tjc:result'||event.data?.nonce!==nonce)return;
        const item=waiting.get(event.data.id);if(!item)return;clearTimeout(item.timer);waiting.delete(event.data.id);
        const response=event.data.response;
        if(response?.ok)item.resolve(response.data);else item.reject(Object.assign(new Error(response?.error||'資料操作失敗'),{uncertain:response?.uncertain===true}));
      };
      window.addEventListener('message',receive);
      resolve({source,origin,nonce,receive});
    };
    const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('message',onMessage);};
    window.addEventListener('message',onMessage);
    iframe.src=endpoint+'?nonce='+encodeURIComponent(nonce);document.body.appendChild(iframe);
  });
  bridgePromise.catch(()=>{bridgePromise=null;});return bridgePromise;
}
async function rpc(action:string,payload:any={},operationId?:string){
  const a=await getAuthClient();if(!a.currentUser)throw new Error('請先使用 Google 帳號登入');
  const token=await a.currentUser.getIdToken();const b=await connectBridge();
  const id=crypto.randomUUID();
  return new Promise<any>((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('連線逾時，操作結果尚未確認。請使用「重試上次儲存」，相同操作不會重複加分。'));},65000);
    waiting.set(id,{resolve,reject,timer});
    b.source.postMessage({type:'tjc:request',nonce:b.nonce,id,request:{action,payload,idToken:token,operationId}},b.origin);
  });
}
export async function snapshot(){
  if(isDemo)return Domain.project(pack.db,demoId);
  const data=await rpc('bootstrap');return data.snapshot;
}
export async function currentLogin(){
  if(isDemo)return true;
  try{return !!(await getAuthClient()).currentUser;}catch{return false;}
}
export async function login(){
  const a=await getAuthClient();const {signInWithPopup,GoogleAuthProvider}=await import('firebase/auth');await signInWithPopup(a,new GoogleAuthProvider());
}
export async function logout(){
  if(!isDemo){const {signOut}=await import('firebase/auth');await signOut(await getAuthClient());}
  if(bridgePromise){try{const b=await bridgePromise;window.removeEventListener('message',b.receive);}catch{}}
  bridgeFrame?.remove();bridgeFrame=null;bridgePromise=null;
  for(const item of waiting.values()){clearTimeout(item.timer);item.reject(new Error('已登出'));}waiting.clear();
}
export function selectDemo(id:string){if(!isDemo)return;demoId=id;sessionStorage.setItem('tjc-demo-role',id);}
export function resetDemo(){if(!isDemo)return;pack={db:makeDemo(),media:{}};localStorage.removeItem(KEY);}
function save(next:any){localStorage.setItem(KEY,JSON.stringify(next));pack=next;}
const PENDING_KEY='tjc-pending-write-v1';
let pending:any=null;
try{pending=JSON.parse(sessionStorage.getItem(PENDING_KEY)||'null');}catch{}
export function hasPendingWrite(){return !isDemo&&!!pending;}
async function finishPending(){
  const a=await getAuthClient();
  if(!pending||pending.uid!==a.currentUser?.uid)throw new Error('上次操作屬於另一個 Google 帳號，請改用原帳號重試');
  try {
    const response=await rpc(pending.action,pending.payload,pending.id);
    sessionStorage.removeItem(PENDING_KEY);pending=null;return response.snapshot;
  } catch(error:any) {
    if(error.uncertain===false){sessionStorage.removeItem(PENDING_KEY);pending=null;}
    throw error;
  }
}
async function write(action:string,payload:any){
  if(pending)throw new Error('有一筆操作尚未確認，請先使用「重試上次儲存」');
  const a=await getAuthClient();if(!a.currentUser)throw new Error('請重新登入');
  const operation={id:crypto.randomUUID(),action,payload,uid:a.currentUser.uid};
  // Persist BEFORE sending; a reload can safely retry the same operation ID.
  sessionStorage.setItem(PENDING_KEY,JSON.stringify(operation));pending=operation;
  return finishPending();
}
export async function retryPendingWrite(){return finishPending();}
export async function previewStudentImport(){
  if(isDemo)return {records:[{id:'demo_import_01',name:'示範小禾',grade:'一年級',classId:'children',active:true,photoConsent:false}]};
  return rpc('previewStudentImport');
}
export async function mutate(action:string,payload:any){
  const op=crypto.randomUUID();
  if(!isDemo)return write(action,payload);
  const next=Domain.execute(pack.db,demoId,action,payload,{id:op,now:new Date().toISOString()});
  save({...pack,db:next.db});return Domain.project(next.db,demoId);
}
export async function uploadPhoto(albumId:string,file:File) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('請選擇 JPG、PNG 或 WebP 照片；HEIC 請先轉為 JPG');
  if(file.size>20*1024*1024)throw new Error('原始照片請小於 20 MB');
  const image=new Image();const source=URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('無法讀取照片'));image.src=source;});
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    let data=canvas.toDataURL('image/jpeg',0.8);if(data.length>1400000)data=canvas.toDataURL('image/jpeg',0.6);
    const base64=data.split(',')[1];if(base64.length>1400000)throw new Error('照片壓縮後仍過大，請先縮小再上傳');
    const name=file.name.replace(/\.[^.]+$/,'')+'.jpg';
    if(!isDemo)return write('uploadPhoto',{albumId,name,mime:'image/jpeg',base64});
    const fileId=crypto.randomUUID(),next=Domain.execute(pack.db,demoId,'addPhoto',{albumId,fileId,name,mime:'image/jpeg'},{id:crypto.randomUUID(),now:new Date().toISOString()});
    save({db:next.db,media:{...pack.media,[fileId]:data}});return Domain.project(next.db,demoId);
  } finally {URL.revokeObjectURL(source);}
}
let photoRequests=0;
const photoQueue:Array<()=>void>=[];
async function photoSlot(){
  if(photoRequests>=2)await new Promise<void>(resolve=>photoQueue.push(resolve));
  else photoRequests++;
}
function releasePhotoSlot(){const next=photoQueue.shift();if(next)next();else photoRequests--;}
export async function photoData(id:string) {
  if(!isDemo){await photoSlot();try{const r=await rpc('getPhoto',{id});return 'data:'+r.mime+';base64,'+r.base64;}finally{releasePhotoSlot();}}
  const visible=Domain.project(pack.db,demoId).Photos.some(p=>p.id===id);if(!visible)throw new Error('沒有照片存取權限');
  const photo=pack.db.Photos.find(p=>p.id===id);return pack.media[photo.fileId]||'';
}
export async function systemInfo(){if(isDemo)return {demo:true};return rpc('systemInfo');}
export async function exportBackup(){if(isDemo)return Domain.clone(pack.db);return rpc('exportData');}
export function download(name:string,content:string,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
