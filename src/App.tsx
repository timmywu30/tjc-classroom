import React, {useEffect,useRef,useState} from 'react';
import {Home,BookOpen,CalendarDays,Images,Star,Users,ClipboardCheck,Plus,ChevronRight,Menu,X,LogOut,Settings,ExternalLink,Copy,Download,RefreshCw,ShieldCheck,ArrowLeft,Upload,Lock,Unlock,Trash2,Edit3,Bell,Heart,Sun,Clock,MapPin,CheckCircle2} from 'lucide-react';
import {Domain} from './domain.js';
import * as api from './service';

const statusLabels:any={present:'出席',late:'遲到',leave:'請假',absent:'缺席'};
const roleLabels:any={parent:'家長',teacher:'教員',admin:'班負責'};
const frontNav=[['home','首頁',Home],['schedule','課表',CalendarDays],['albums','課堂相簿',Images],['events','近期活動',Heart],['growth','我的學習',Star]];
const adminNav=[['admin','管理總覽',Home],['admin/attendance','點名與金句',ClipboardCheck],['admin/points','積分管理',Star],['admin/students','學員管理',Users],['admin/content','公告與活動',Bell],['admin/albums','相簿管理',Images],['admin/people','帳號與家長',ShieldCheck],['admin/settings','學期與設定',Settings]];
const route=()=>location.hash.replace(/^#\/?/,'')||'home';
const go=(path:string)=>{location.hash='/'+path;};
const taipeiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateText=(date:string)=>{try{return new Intl.DateTimeFormat('zh-TW',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Taipei'}).format(new Date(date+'T12:00:00+08:00'));}catch{return date;}};
const timeText=(date:string)=>{try{return new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei'}).format(new Date(date));}catch{return date;}};
const s=(data:any,key:string,fall:any='')=>Domain.setting(data,key,fall);
function Empty({icon:Icon=BookOpen,title,children}:any){return <div className="empty"><span className="empty-icon"><Icon size={30}/></span><h3>{title}</h3>{children&&<p>{children}</p>}</div>;}
function Pill({children,tone='green'}:any){return <span className={'pill '+tone}>{children}</span>;}
function Heading({eyebrow,title,children,actions}:any){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children&&<p>{children}</p>}</div>{actions&&<div className="heading-actions">{actions}</div>}</div>;}
function Dialog({dialog,busy,onClose,onSave}:any){
  const [values,setValues]=useState(dialog.initial||{}),ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();return ()=>previous?.focus();},[]);
  function key(e:React.KeyboardEvent){
    if(e.key==='Escape'&&!busy)onClose();
    if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select');if(!nodes?.length)return;
      const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref} onKeyDown={key}>
      <div className="modal-head"><div><h2 id="dialog-title">{dialog.title}</h2>{dialog.note&&<p>{dialog.note}</p>}</div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="關閉"><X/></button></div>
      <form onSubmit={e=>{e.preventDefault();onSave(values);}}>
        <div className="form-grid">{dialog.fields.map((field:any)=>{
          const id='field-'+field.key,val=values[field.key]??'';
          if(field.type==='checkbox')return <label key={id} className="check-field full"><input type="checkbox" checked={!!val} onChange={e=>setValues({...values,[field.key]:e.target.checked})}/><span>{field.label}</span></label>;
          if(field.type==='multi')return <fieldset className="full choice-field" key={id}><legend>{field.label}</legend>{field.options.map((option:any)=><label key={option.value}><input type="checkbox" checked={(val||[]).includes(option.value)} onChange={e=>setValues({...values,[field.key]:e.target.checked?[...(val||[]),option.value]:(val||[]).filter((x:any)=>x!==option.value)})}/>{option.label}</label>)}</fieldset>;
          return <label key={id} htmlFor={id} className={field.full?'full':''}><span>{field.label}{field.required&&<b className="required"> *</b>}</span>
            {field.type==='textarea'?<textarea id={id} rows={field.rows||4} readOnly={field.readOnly} maxLength={field.max||6000} required={field.required} value={val} onChange={e=>setValues({...values,[field.key]:e.target.value})}/>:
             field.type==='select'?<select id={id} value={val} required={field.required} onChange={e=>setValues({...values,[field.key]:e.target.value})}>{field.options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:
             <input id={id} type={field.type||'text'} value={val} maxLength={field.max||200} min={field.min} max={field.maxNumber} readOnly={field.readOnly} required={field.required} placeholder={field.placeholder} onChange={e=>setValues({...values,[field.key]:e.target.value})}/>}
             {field.help&&<small>{field.help}</small>}
          </label>;
        })}</div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>取消</button><button type="submit" className="button primary" disabled={busy}>{busy?'儲存中…':'儲存'}</button></div>
      </form>
    </div>
  </div>;
}
function Photo({photo,onClick,actorId}:any){
  const [src,setSrc]=useState(''),[error,setError]=useState(false);
  useEffect(()=>{let mounted=true;setSrc('');setError(false);api.photoData(photo.id).then(value=>{if(mounted)setSrc(value);}).catch(()=>{if(mounted)setError(true);});return()=>{mounted=false;};},[photo.id,actorId]);
  return <button className="photo" onClick={()=>src&&onClick({src,name:photo.name})} disabled={!src} aria-label={'放大 '+photo.name}>
    {src?<img src={src} alt={photo.name} loading="lazy"/>:<span>{error?'照片暫時無法載入':'載入照片…'}</span>}
  </button>;
}
export function App(){
  const [data,setData]=useState<any>(null),[page,setPage]=useState(route()),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [logged,setLogged]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState(''),[menu,setMenu]=useState(false);
  const [childId,setChildId]=useState(''),[termId,setTermId]=useState(''),[search,setSearch]=useState(''),[courseId,setCourseId]=useState('');
  const [photoPage,setPhotoPage]=useState(0),[albumId,setAlbumId]=useState(''),[lightbox,setLightbox]=useState<any>(null),[dialog,setDialog]=useState<any>(null),[system,setSystem]=useState<any>(null);
  const [contentTab,setContentTab]=useState('announcements'),[selected,setSelected]=useState<string[]>([]),[uploadStatus,setUploadStatus]=useState('');
  const uploadRef=useRef<HTMLInputElement>(null),toastTimer=useRef<any>(null);
  const notify=(message:string)=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),5500);};
  const refresh=async()=>{setError('');try{const next=await api.snapshot();setData(next);setLogged(true);}catch(e:any){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{api.currentLogin().then(ok=>{setLogged(ok);if(ok)refresh();else setLoading(false);});const listener=()=>{setPage(route());setMenu(false);setSearch('');setAlbumId('');};window.addEventListener('hashchange',listener);return()=>{window.removeEventListener('hashchange',listener);clearTimeout(toastTimer.current);};},[]);
  useEffect(()=>{if(data){if(!data.Students.some((x:any)=>x.id===childId))setChildId(data.Students[0]?.id||'');if(!termId)setTermId(s(data,'currentTermId'));if(!Domain.staff(data.actor)&&page.startsWith('admin'))go('home');}},[data,page]);
  useEffect(()=>{setPhotoPage(0);},[albumId]);
  useEffect(()=>{if(!lightbox)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setLightbox(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[lightbox]);
  async function perform(action:string,payload:any,close=true) {
    if(busy)return false;setBusy(true);
    try {setData(await api.mutate(action,payload));if(close)setDialog(null);notify('已儲存');return true;}
    catch(e:any){notify(e.message);return false;}finally{setBusy(false);}
  }
  async function changeRole(id:string){api.selectDemo(id);setSelected([]);setChildId('');setCourseId('');setAlbumId('');setData(null);setLoading(true);await refresh();go('home');}
  const showDialog=(title:string,action:string,fields:any[],initial:any,transform?:any,note?:string)=>setDialog({title,action,fields,initial,transform,note});
  async function signIn(){setBusy(true);setError('');try{await api.login();setLogged(true);await refresh();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  async function signOut(){await api.logout();setData(null);setLogged(false);setError('');setLightbox(null);setDialog(null);}
  if(!data)return <div className="login-wrap"><div className="login-card"><span className="brand-symbol"><Star fill="currentColor"/></span><p className="eyebrow">真耶穌教會・宗教教育</p><h1>幼年班，一起成長。</h1><p>課表、課堂回憶，還有每一次小小的進步。</p>{loading?<div className="loading"><RefreshCw className="spin"/>正在載入班級資料…</div>:<>{error&&<div className="error-box" role="alert">{error}</div>}<button className="button primary wide" onClick={logged?refresh:signIn} disabled={busy}>{logged?'重新連接班級資料':'使用 Google 帳號登入'}</button>{logged&&<button className="text-button" onClick={signOut}>更換 Google 帳號</button>}<small>帳號需由班負責開通並綁定孩子。</small></>}</div></div>;

  const isStaff=Domain.staff(data.actor),isAdmin=data.actor.role==='admin',adminPage=page.startsWith('admin');
  const child=data.Students.find((x:any)=>x.id===childId);
  const currentTerm=s(data,'currentTermId'),term=termId||currentTerm;
  const termName=data.Terms.find((x:any)=>x.id===term)?.name||'學期';
  const activeStudents=data.Students.filter((x:any)=>x.active);
  const currentCourses=data.Courses.filter((x:any)=>x.termId===term).sort((a:any,b:any)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
  const upcoming=currentCourses.find((x:any)=>x.date>=taipeiToday()&&x.status!=='cancelled');
  const activeCourse=currentCourses.find((x:any)=>x.id===courseId)||upcoming||currentCourses[currentCourses.length-1];
  const points=child?Domain.points(data,child.id,term):0;
  const childAttendance=child?data.Attendance.filter((x:any)=>x.studentId===child.id&&x.termId===term):[];
  const completed=child?data.Learning.filter((x:any)=>x.studentId===child.id&&x.termId===term&&x.completed).length:0;
  const notices=data.Announcements.filter((x:any)=>x.published).sort((a:any,b:any)=>Number(b.pinned)-Number(a.pinned)||b.at.localeCompare(a.at));
  const classId=data.actor.classIds[0]||'children';
  const classField={key:'classId',label:'班級代碼',type:'select',options:data.actor.classIds.map((c:string)=>({value:c,label:c==='children'?s(data,'className'):c}))};
  const chosenAlbum=data.Albums.find((x:any)=>x.id===albumId);
  function termSelect(){return <select className="compact-select" aria-label="選擇學期" value={term} onChange={e=>{setTermId(e.target.value);setCourseId('');}}>{data.Terms.map((t:any)=><option key={t.id} value={t.id}>{t.name}{t.archived?'（已封存）':''}</option>)}</select>;}
  function childSelect(){return data.Students.length>0?<select className="compact-select" aria-label="選擇孩子" value={childId} onChange={e=>setChildId(e.target.value)}>{data.Students.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select>:null;}
  async function importStudents(){
    setBusy(true);
    try{
      const result=await api.previewStudentImport(),records=result.records;
      showDialog('確認匯入雲端學員','importStudents',[
        {key:'preview',label:'即將新增或更新的學員',type:'textarea',full:true,readOnly:true,rows:10,max:30000}
      ],{records,preview:records.map((x:any)=>(data.Students.some((y:any)=>y.id===x.id)?'更新':'新增')+'｜'+x.id+'｜'+x.name+'｜'+x.grade+'｜照片同意：'+(x.photoConsent?'是':'否')).join('\n')},
      (v:any)=>({records:v.records}),'依固定 id 更新；不會刪除來源表以外的學員。請先核對姓名與照片分享同意。');
    }catch(e:any){notify(e.message);}finally{setBusy(false);}
  }
  async function retryWrite(){setBusy(true);try{setData(await api.retryPendingWrite());setDialog(null);notify('上次操作已確認儲存');}catch(e:any){notify(e.message);}finally{setBusy(false);}}
  function editStudent(row?:any){showDialog(row?'編輯學員':'新增學員','saveStudent',[
    {key:'name',label:'學員姓名',required:true,max:60},{key:'grade',label:'年級',type:'select',options:['一年級','二年級','三年級','四年級','其他'].map(x=>({value:x,label:x}))},classField,
    {key:'active',label:'在班學員',type:'checkbox'},{key:'photoConsent',label:'已取得照片分享同意',type:'checkbox'}
  ],row||{name:'',grade:'一年級',classId,active:true,photoConsent:false});}
  function editContent(kind:string,row?:any) {
    if(kind==='announcements')showDialog(row?'編輯公告':'新增公告','saveAnnouncement',[
      {key:'title',label:'標題',required:true,full:true,max:100},{key:'body',label:'公告內容',type:'textarea',required:true,full:true},classField,
      {key:'pinned',label:'置頂公告',type:'checkbox'},{key:'published',label:'發布給家長',type:'checkbox'}
    ],row||{classId,title:'',body:'',published:false,pinned:false});
    else showDialog(row?'編輯活動':'新增活動','saveEvent',[
      {key:'title',label:'活動名稱',required:true,full:true,max:100},{key:'date',label:'日期',type:'date',required:true},{key:'time',label:'時間',placeholder:'例如 10:00–12:00'},
      {key:'location',label:'地點',full:true},{key:'body',label:'活動說明與準備事項',type:'textarea',full:true},{key:'url',label:'報名或附件連結',type:'url',full:true},classField,
      {key:'published',label:'發布給家長',type:'checkbox'}
    ],row||{classId,title:'',date:taipeiToday(),time:'',location:'',body:'',url:'',published:false});
  }
  function editAlbum(row?:any){showDialog(row?'編輯相簿':'建立相簿','saveAlbum',[
    {key:'title',label:'相簿名稱',required:true,max:100},{key:'date',label:'拍攝日期',type:'date',required:true},
    {key:'description',label:'相簿說明',type:'textarea',full:true,max:2000},classField,
    ...(row?[{key:'coverId',label:'相簿封面',type:'select',options:[{value:'',label:'使用第一張照片'},...data.Photos.filter((p:any)=>p.albumId===row.id).map((p:any)=>({value:p.id,label:p.name}))]}]:[]),
    {key:'reviewed',label:'已檢查照片內容及家長分享同意',type:'checkbox'},
    ...(row?[{key:'published',label:'發布給家長（需先有照片）',type:'checkbox'}]:[])
  ],row||{classId,title:'',date:taipeiToday(),description:'',published:false,reviewed:false,coverId:''});}
  function editUser(row?:any){showDialog(row?'編輯帳號與家長關聯':'開通帳號','saveUser',[
    {key:'name',label:'顯示名稱',required:true,max:60},{key:'email',label:'Google 登入 Email',type:'email',required:true,readOnly:!!row?.hasLogin,max:254},
    {key:'role',label:'身分',type:'select',options:[{value:'parent',label:'家長'},{value:'teacher',label:'教員'},{value:'admin',label:'班負責'}]},
    {key:'classIds',label:'授權班級',type:'multi',options:data.actor.classIds.map((c:string)=>({value:c,label:c==='children'?s(data,'className'):c}))},
    {key:'studentIds',label:'綁定孩子（家長身分必填）',type:'multi',options:data.Students.map((x:any)=>({value:x.id,label:x.name}))},
    {key:'active',label:'啟用帳號',type:'checkbox'}
  ],row?{...row,studentIds:data.Guardians.filter((g:any)=>g.active&&g.userId===row.id).map((g:any)=>g.studentId)}:{name:'',email:'',role:'parent',classIds:[classId],studentIds:[],active:true},undefined,'請填家長或教員實際用來登入的 Google 帳號。');}
  function addPoints(){
    showDialog('登記積分','addPoints',[
      {key:'studentIds',label:'選擇學員',type:'multi',options:activeStudents.map((x:any)=>({value:x.id,label:x.name}))},
      {key:'amount',label:'調整分數',type:'number',required:true,min:-100,maxNumber:100},
      {key:'reason',label:'加分或調整原因',required:true,full:true,placeholder:'例如：主動協助同學整理教室'}
    ],{studentIds:selected,amount:1,reason:'',termId:term});
  }
  function exportScores(){
    api.download('幼年班-'+term+'-積分.csv',Domain.csv([['學員','年級','學期','累積分數','出席次數','金句完成'],...data.Students.map((x:any)=>[x.name,x.grade,termName,Domain.points(data,x.id,term),data.Attendance.filter((a:any)=>a.studentId===x.id&&a.termId===term&&['present','late'].includes(a.status)).length,data.Learning.filter((a:any)=>a.studentId===x.id&&a.termId===term&&a.completed).length])]),'text/csv;charset=utf-8');
  }
  async function copyReminder(){
    if(!upcoming){notify('目前沒有接下來的課程');return;}
    const text=['平安，'+s(data,'className')+'上課提醒','日期：'+dateText(upcoming.date),'時間：'+upcoming.startTime+'–'+upcoming.endTime,'課程：'+upcoming.title,'經文：'+upcoming.scripture,'攜帶物品：'+upcoming.materials,upcoming.notes].filter(Boolean).join('\n');
    try{await navigator.clipboard.writeText(text);notify('上課提醒已複製');}catch{showDialog('上課提醒','', [{key:'text',label:'請選取並複製',type:'textarea',full:true,rows:10}],{text});}
  }
  function courseCard(c:any){return <article key={c.id} className={'course-row '+(c.status==='cancelled'?'cancelled':'')}>
    <div className="date-tile"><span>{c.date.slice(5,7)} 月</span><b>{c.date.slice(8,10)}</b></div>
    <div className="course-main"><div className="course-title"><h3>{c.title}</h3>{c.status==='cancelled'&&<Pill tone="gray">停課</Pill>}</div><p>{c.scripture}</p><div className="meta-line"><span><Clock size={15}/>{c.startTime}–{c.endTime}</span><span><Users size={15}/>{c.teacher}</span></div>
    <details><summary>課程內容與準備事項</summary><dl><dt>本週金句</dt><dd>{c.verse||'教員尚未填寫'}</dd><dt>詩歌</dt><dd>{c.song||'尚未安排'}</dd><dt>攜帶物品</dt><dd>{c.materials||'無特別要求'}</dd>{c.notes&&<><dt>備註</dt><dd>{c.notes}</dd></>}</dl>{c.resourceUrl&&<a href={c.resourceUrl} target="_blank" rel="noreferrer" className="text-link">開啟教材 <ExternalLink size={14}/></a>}</details></div>
  </article>;}
  function albumsView(admin:boolean){
    if(chosenAlbum){const photos=data.Photos.filter((p:any)=>p.albumId===chosenAlbum.id);return <>
      <button className="text-button back-button" onClick={()=>setAlbumId('')}><ArrowLeft size={17}/>返回相簿</button>
      <Heading eyebrow={dateText(chosenAlbum.date)} title={chosenAlbum.title} actions={admin?<><button className="button secondary" onClick={()=>editAlbum(chosenAlbum)}><Edit3 size={16}/>編輯與發布</button><button className="button primary" disabled={busy||chosenAlbum.published} onClick={()=>uploadRef.current?.click()}><Upload size={16}/>上傳照片</button></>:null}>{chosenAlbum.description}</Heading>
      {admin&&<div className="info-line"><Pill tone={chosenAlbum.published?'green':'gold'}>{chosenAlbum.published?'家長可見':'草稿・僅教員可見'}</Pill><span>{chosenAlbum.published?'要加入照片，請先在編輯中取消發布。':'上傳完成後，請檢查照片並發布。'}</span></div>}
      {uploadStatus&&<div className="info-box" role="status">{uploadStatus}</div>}
      {!photos.length?<Empty icon={Images} title="準備收藏這一天的回憶">{admin?'按「上傳照片」加入課堂精選照片。':'教員正在整理照片。'}</Empty>:<div className="photo-grid">{photos.slice(photoPage*12,(photoPage+1)*12).map((p:any)=><div className="photo-item" key={p.id}><Photo photo={p} actorId={data.actor.id} onClick={setLightbox}/>{admin&&<div className="photo-caption"><span>{p.name}</span><button className="icon-button danger" aria-label={'移除 '+p.name} disabled={busy} onClick={()=>{if(confirm('將這張照片從相簿移除？相簿會回到草稿，Drive 原檔會保留。'))perform('hidePhoto',{id:p.id});}}><Trash2 size={16}/></button></div>}</div>)}</div>}
      {photos.length>12&&<div className="pagination"><button className="button secondary" disabled={photoPage===0} onClick={()=>setPhotoPage(n=>n-1)}>上一頁</button><span>第 {photoPage+1} / {Math.ceil(photos.length/12)} 頁 · 共 {photos.length} 張</span><button className="button secondary" disabled={(photoPage+1)*12>=photos.length} onClick={()=>setPhotoPage(n=>n+1)}>下一頁</button></div>}
      <input hidden ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async e=>{
        const files=Array.from(e.target.files||[]) as File[];e.target.value='';if(!files.length)return;if(files.length>10){notify('每次最多上傳 10 張照片');return;}
        setBusy(true);let done=0;try{for(const file of files){setUploadStatus('上傳 '+(done+1)+' / '+files.length+'：'+file.name);setData(await api.uploadPhoto(chosenAlbum.id,file));done++;}notify('已上傳 '+done+' 張照片');}catch(err:any){notify('已完成 '+done+' 張；'+err.message);}finally{setBusy(false);setUploadStatus('');}
      }}/>
    </>;}
    const albums=data.Albums.filter((a:any)=>admin||a.published).sort((a:any,b:any)=>b.date.localeCompare(a.date));
    return <><Heading eyebrow={admin?'教員管理':'我們一起的時光'} title={admin?'相簿管理':'課堂相簿'} actions={admin?<button className="button primary" onClick={()=>editAlbum()}><Plus size={17}/>建立相簿</button>:null}>按日期收藏孩子們的學習與成長。</Heading>
    {!albums.length?<Empty icon={Images} title="還沒有已發布的相簿">教員整理好照片後，就會出現在這裡。</Empty>:<div className="album-grid">{albums.map((album:any)=>{
      const photos=data.Photos.filter((p:any)=>p.albumId===album.id),cover=photos.find((p:any)=>p.id===album.coverId)||photos[0];
      return <article className="album-card" key={album.id}><div className="album-cover">{cover?<Photo photo={cover} actorId={data.actor.id} onClick={()=>setAlbumId(album.id)}/>:<button className="album-empty" onClick={()=>setAlbumId(album.id)} aria-label={'查看 '+album.title}><Images size={44}/><span>尚未加入照片</span></button>}</div><div className="album-body"><div className="between"><span className="muted">{dateText(album.date)}</span>{admin&&<Pill tone={album.published?'green':'gold'}>{album.published?'已發布':'草稿'}</Pill>}</div><h3><button className="link-heading" onClick={()=>setAlbumId(album.id)}>{album.title}</button></h3><div className="between"><span>{photos.length} 張照片</span><button className="text-button" onClick={()=>setAlbumId(album.id)}>查看相簿 <ChevronRight size={15}/></button></div></div></article>;
    })}</div>}</>;
  }
  let content:React.ReactNode;
  if(page==='home')content=<>
    <Heading eyebrow={s(data,'churchName')+'・'+s(data,'className')} title={'平安，'+data.actor.name.replace('（示範）','')+'。'} actions={childSelect()}>一起陪伴孩子，累積每一次成長。</Heading>
    <div className="home-top"><section className="next-class panel"><div className="between"><span className="eyebrow">下一次上課</span><Pill tone="light">安息日課程</Pill></div>{upcoming?<><div className="next-date">{dateText(upcoming.date)}<span>{upcoming.startTime}–{upcoming.endTime}</span></div><h2>{upcoming.title}</h2><p>{upcoming.scripture}</p><div className="prepare"><BookOpen size={21}/><div><small>記得帶上</small><strong>{upcoming.materials||'聖經與學習的心'}</strong></div></div><button className="button cream" onClick={()=>go('schedule')}>查看完整課表 <ChevronRight size={17}/></button></>:<Empty title="下一次課程尚未公布">教員更新課表後會顯示在這裡。</Empty>}</section>
    <section className="verse-card panel"><span className="eyebrow">本週金句</span><BookOpen size={28}/><blockquote>{upcoming?.verse||'本週金句尚未公布。'}</blockquote><p>{upcoming?.scripture}</p><div className="verse-bottom"><Heart size={16}/><span>邀請家長陪孩子一起讀一遍。</span></div></section></div>
    {child&&<div className="stat-grid"><div className="stat-card"><span className="stat-icon amber"><Star/></span><div><span>本學期積分</span><strong>{points}<small> 分</small></strong></div><button className="icon-button" aria-label="查看積分明細" onClick={()=>go('growth')}><ChevronRight/></button></div><div className="stat-card"><span className="stat-icon green"><ClipboardCheck/></span><div><span>已出席課程</span><strong>{childAttendance.filter((a:any)=>['present','late'].includes(a.status)).length}<small> 次</small></strong></div></div><div className="stat-card"><span className="stat-icon blue"><BookOpen/></span><div><span>完成金句</span><strong>{completed}<small> 次</small></strong></div></div></div>}
    <div className="section-title"><h2>班級小公告</h2><span className="muted">給每一位家長的提醒</span></div>
    <div className="notice-list">{notices.length?notices.map((n:any)=><article className="notice-card" key={n.id}><span className="notice-icon"><Bell size={20}/></span><div><div className="between"><h3>{n.title}</h3>{n.pinned&&<Pill tone="gold">置頂</Pill>}</div><p>{n.body}</p><small>{timeText(n.at)}</small></div></article>):<Empty icon={Bell} title="目前沒有新公告"/>}</div>
  </>;
  else if(page==='schedule')content=<><Heading eyebrow="每個安息日，一起學習" title="班級課表" actions={termSelect()}>課程與準備事項，以教員最新更新為準。</Heading><div className="toolbar"><input className="search" aria-label="搜尋課程" placeholder="搜尋課程、經文或教員…" value={search} onChange={e=>setSearch(e.target.value)}/>{isStaff&&<button className="button secondary" onClick={copyReminder}><Copy size={16}/>複製下次上課提醒</button>}</div><div className="course-list">{currentCourses.filter((c:any)=>(c.title+c.scripture+c.teacher).includes(search)).map(courseCard)}{!currentCourses.length&&<Empty icon={CalendarDays} title="這個學期尚未建立課表"/>}</div></>;
  else if(page==='albums'||page==='admin/albums')content=albumsView(page==='admin/albums');
  else if(page==='events')content=<><Heading eyebrow="一起參與，一起留下回憶" title="近期活動"/><div className="events-grid">{data.Events.filter((e:any)=>e.published).sort((a:any,b:any)=>a.date.localeCompare(b.date)).map((e:any)=><article className="event-card" key={e.id}><div className="event-top"><CalendarDays size={26}/><Pill tone={e.date<taipeiToday()?'gray':'green'}>{e.date<taipeiToday()?'活動已結束':'活動預告'}</Pill></div><h2>{e.title}</h2><p className="meta-line"><CalendarDays size={16}/>{dateText(e.date)}　{e.time}</p><p className="meta-line"><MapPin size={16}/>{e.location||'地點待公布'}</p><p className="event-body">{e.body}</p>{e.url&&<a className="button secondary" href={e.url} target="_blank" rel="noreferrer">報名或查看附件 <ExternalLink size={16}/></a>}</article>)}</div>{!data.Events.some((e:any)=>e.published)&&<Empty icon={Heart} title="近期活動準備中"/>}</>;
  else if(page==='growth')content=<><Heading eyebrow="每一步，都值得被看見" title="我的學習紀錄" actions={<>{childSelect()}{termSelect()}</>}/>{child?<><section className="growth-hero panel"><div><span className="eyebrow">{child.name}・{child.grade}</span><h2>小小努力，慢慢長大。</h2><p>{termName}</p><div className="progress-track"><span style={{width:Math.max(0,Math.min(100,points))+'%'}}/></div><small>{points>=100?'已達成 100 分里程碑！':'距離 100 分里程碑還有 '+Math.max(0,100-points)+' 分'}</small></div><div className="score-seal"><Star size={24} fill="currentColor"/><strong>{points}</strong><span>本學期積分</span></div></section><div className="stat-grid two"><div className="mini-stat"><ClipboardCheck/><strong>{childAttendance.filter((x:any)=>['present','late'].includes(x.status)).length}</strong><span>次出席</span></div><div className="mini-stat"><BookOpen/><strong>{completed}</strong><span>次金句完成</span></div></div><div className="section-title"><h2>積分明細</h2><Pill tone="gray">每一筆進步都有紀錄</Pill></div><div className="ledger">{data.Points.filter((x:any)=>x.studentId===childId&&x.termId===term).sort((a:any,b:any)=>b.at.localeCompare(a.at)).map((p:any)=><div className="ledger-row" key={p.id}><span className="ledger-icon"><Star size={18}/></span><div><strong>{p.reason}</strong><small>{timeText(p.at)}</small></div><b className={p.amount<0?'negative':'positive'}>{p.amount>0?'+':''}{p.amount}</b></div>)}</div><div className="section-title"><h2>出席紀錄</h2></div><div className="attendance-history">{childAttendance.map((a:any)=><div key={a.id}><span>{data.Courses.find((c:any)=>c.id===a.courseId)?.title||'歷史課程'}</span><Pill tone={['present','late'].includes(a.status)?'green':'gray'}>{statusLabels[a.status]}</Pill></div>)}</div></>:<Empty icon={Users} title="尚未綁定孩子">請將登入 Email 告知班負責，完成親子綁定後即可查看。</Empty>}</>;

  else if(isStaff&&page==='admin')content=<><Heading eyebrow="今天也一起陪伴孩子" title="教員工作台" actions={<button className="button primary" onClick={()=>go('admin/attendance')}><ClipboardCheck size={17}/>開始點名</button>}/>
    <div className="stat-grid"><div className="stat-card"><span className="stat-icon green"><Users/></span><div><span>在班學員</span><strong>{activeStudents.length}<small> 位</small></strong></div></div><div className="stat-card"><span className="stat-icon amber"><Images/></span><div><span>待發布相簿</span><strong>{data.Albums.filter((a:any)=>!a.published).length}<small> 本</small></strong></div></div><div className="stat-card"><span className="stat-icon blue"><CalendarDays/></span><div><span>本學期課程</span><strong>{currentCourses.length}<small> 堂</small></strong></div></div></div>
    <div className="admin-grid"><section className="panel white"><div className="section-title"><h2>下一次課程</h2><button className="text-button" onClick={()=>go('schedule')}>完整課表 <ChevronRight size={16}/></button></div>{upcoming?courseCard(upcoming):<Empty title="課表待更新"/>}<button className="button secondary" onClick={copyReminder}><Copy size={16}/>複製上課提醒</button></section><section className="panel white"><h2>常用管理</h2>{[['admin/students','整理學員名單',Users],['admin/points','登記學習積分',Star],['admin/albums','整理上課照片',Images],['admin/content','發布公告與活動',Bell]].map(([path,label,Icon]:any)=><button className="quick-action" key={path} onClick={()=>go(path)}><Icon size={21}/><span>{label}</span><ChevronRight size={17}/></button>)}</section></div>
    <div className="info-box"><ShieldCheck size={19}/><span>{api.isDemo?'目前是示範資料。切換不同家長，可檢查各自看到的孩子；示範修改只保留在這個瀏覽器。':'資料修改後會寫入 Google 試算表。相簿發布與積分調整都會留下操作紀錄。'}</span></div></>;
  else if(isStaff&&page==='admin/attendance'){
    const c=activeCourse,roster=c?activeStudents.filter((x:any)=>x.classId===c.classId):[],locked=c&&data.Sessions.some((x:any)=>x.courseId===c.id&&x.locked);
    const unmarked=roster.filter((student:any)=>!data.Attendance.some((a:any)=>a.courseId===c?.id&&a.studentId===student.id));
    const editable=!!c&&!locked&&c.status!=='cancelled'&&!data.Terms.find((t:any)=>t.id===c.termId)?.archived;
    content=<><Heading eyebrow="每一位孩子，都被記得" title="點名與金句" actions={termSelect()}/>
    <div className="toolbar"><select className="course-select" aria-label="選擇點名課程" value={c?.id||''} onChange={e=>setCourseId(e.target.value)}>{currentCourses.map((c:any)=><option key={c.id} value={c.id}>{c.date}　{c.title}{c.status==='cancelled'?'（停課）':''}</option>)}</select>{c&&<button className="button secondary" disabled={busy||(!isAdmin&&locked)||c.status==='cancelled'} onClick={()=>perform('lockSession',{courseId:c.id,locked:!locked},false)}>{locked?<Unlock size={16}/>:<Lock size={16}/>} {locked?'解除鎖定':'結束登記'}</button>}</div>
    {c?<><div className="between attendance-summary"><span>{roster.length} 位學員・{unmarked.length} 位尚未點名 {locked&&<Pill tone="gold">登記已鎖定</Pill>}</span><button className="button primary" disabled={busy||!editable||!unmarked.length} onClick={()=>perform('attendance',{courseId:c.id,records:unmarked.map((s:any)=>({studentId:s.id,status:'present'}))},false)}>未點名者設為出席</button></div>
    <div className="roll-list">{roster.map((student:any)=>{const mark=data.Attendance.find((a:any)=>a.studentId===student.id&&a.courseId===c.id),learning=data.Learning.find((a:any)=>a.studentId===student.id&&a.courseId===c.id);return <div className="roll-row" key={student.id}><div className="student-name"><span className="avatar">{student.name[0]}</span><div><strong>{student.name}</strong><small>{student.grade}</small></div></div><div className="status-buttons" role="group" aria-label={student.name+'的出席狀態'}>{Object.entries(statusLabels).map(([value,label]:any)=><button key={value} className={mark?.status===value?'chosen '+value:''} aria-pressed={mark?.status===value} disabled={busy||!editable} onClick={()=>perform('attendance',{courseId:c.id,records:[{studentId:student.id,status:value}]},false)}>{label}</button>)}</div><button className={'verse-toggle '+(learning?.completed?'checked':'')} aria-pressed={!!learning?.completed} disabled={busy||!editable} onClick={()=>perform('learning',{courseId:c.id,records:[{studentId:student.id,completed:!learning?.completed}]},false)}><CheckCircle2 size={18}/>{learning?.completed?'金句已完成':'登記金句'}</button></div>;})}</div><p className="help-text">修改出席或金句狀態時，系統會同步調整對應積分。同一狀態重複提交不會再次加分。</p></>:<Empty icon={ClipboardCheck} title="請先建立本學期課表">班負責可從「學期與設定」開啟 Google 課表。</Empty>}</>;
  }
  else if(isStaff&&page==='admin/points')content=<><Heading eyebrow="鼓勵每一次用心" title="積分管理" actions={<>{termSelect()}<button className="button primary" onClick={addPoints}><Plus size={17}/>登記積分</button></>}/>
    <div className="toolbar"><span className="muted">已選 {selected.length} 位學員</span><button className="button secondary" onClick={exportScores}><Download size={16}/>匯出本學期紀錄</button></div>
    <div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="選取全部學員" checked={activeStudents.length>0&&selected.length===activeStudents.length} onChange={e=>setSelected(e.target.checked?activeStudents.map((x:any)=>x.id):[])}/></th><th>學員</th><th>年級</th><th>累積積分</th><th>出席次數</th></tr></thead><tbody>{activeStudents.map((x:any)=><tr key={x.id}><td><input type="checkbox" aria-label={'選取 '+x.name} checked={selected.includes(x.id)} onChange={e=>setSelected(e.target.checked?[...selected,x.id]:selected.filter(id=>id!==x.id))}/></td><td><strong>{x.name}</strong></td><td>{x.grade}</td><td><span className="points-value"><Star size={16}/>{Domain.points(data,x.id,term)}</span></td><td>{data.Attendance.filter((a:any)=>a.studentId===x.id&&a.termId===term&&['present','late'].includes(a.status)).length}</td></tr>)}</tbody></table></div>
    <div className="section-title"><h2>最近積分紀錄</h2></div><div className="ledger">{data.Points.filter((p:any)=>p.termId===term).slice(-40).reverse().map((p:any)=><div className="ledger-row" key={p.id}><div><strong>{data.Students.find((x:any)=>x.id===p.studentId)?.name}・{p.reason}</strong><small>{timeText(p.at)}</small></div><b className={p.amount<0?'negative':'positive'}>{p.amount>0?'+':''}{p.amount}</b>{p.kind==='manual'&&(isAdmin||p.by===data.actor.id)&&!data.Points.some((q:any)=>q.reversesId===p.id)&&<button className="text-button danger" onClick={()=>showDialog('撤銷積分','reversePoints',[{key:'reason',label:'撤銷原因',required:true,full:true}],{id:p.id,reason:''})}>撤銷</button>}</div>)}</div></>;
  else if(isStaff&&page==='admin/students')content=<><Heading eyebrow="認識每一位孩子" title="學員管理" actions={<>{isAdmin&&<button className="button secondary" disabled={busy} onClick={importStudents}><Download size={17}/>讀取雲端學員表</button>}<button className="button primary" onClick={()=>editStudent()}><Plus size={17}/>新增學員</button></>}/>
    <div className="toolbar"><input className="search" aria-label="搜尋學員" placeholder="搜尋學員姓名…" value={search} onChange={e=>setSearch(e.target.value)}/><span className="muted">在班 {activeStudents.length} 位</span></div>
    <div className="table-wrap"><table><thead><tr><th>學員</th><th>年級</th><th>狀態</th><th>照片分享同意</th><th>操作</th></tr></thead><tbody>{data.Students.filter((x:any)=>x.name.includes(search)).map((x:any)=><tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.grade}</td><td><Pill tone={x.active?'green':'gray'}>{x.active?'在班':'已停用'}</Pill></td><td>{x.photoConsent?<span className="positive">已同意</span>:<span className="negative">尚未同意</span>}</td><td><button className="button small secondary" onClick={()=>editStudent(x)}><Edit3 size={15}/>編輯</button></td></tr>)}</tbody></table></div>{!data.Students.length&&<Empty icon={Users} title="新增第一位學員">建立名單後，即可替家長綁定孩子。</Empty>}</>;
  else if(isStaff&&page==='admin/content') {
    const items=contentTab==='announcements'?data.Announcements:data.Events;
    content=<><Heading eyebrow="把重要消息帶給家長" title="公告與活動" actions={<button className="button primary" onClick={()=>editContent(contentTab)}><Plus size={17}/>{contentTab==='announcements'?'新增公告':'新增活動'}</button>}/>
    <div className="tabs"><button className={contentTab==='announcements'?'active':''} onClick={()=>setContentTab('announcements')}>班級公告</button><button className={contentTab==='events'?'active':''} onClick={()=>setContentTab('events')}>活動管理</button></div>
    <div className="content-list">{items.map((item:any)=><article className="content-card" key={item.id}><div><div className="info-line"><Pill tone={item.published?'green':'gold'}>{item.published?'已發布':'草稿'}</Pill>{item.pinned&&<Pill tone="gold">置頂</Pill>}{item.date&&<span className="muted">{dateText(item.date)}</span>}</div><h3>{item.title}</h3><p>{item.body}</p></div><button className="button small secondary" onClick={()=>editContent(contentTab,item)}><Edit3 size={16}/>編輯</button></article>)}</div>{!items.length&&<Empty icon={Bell} title="目前沒有內容"/>}</>;
  }
  else if(isAdmin&&page==='admin/people')content=<><Heading eyebrow="每個帳號，都有自己的範圍" title="帳號與家長關聯" actions={<button className="button primary" onClick={()=>editUser()}><Plus size={17}/>開通帳號</button>}/>
    <div className="info-box"><ShieldCheck size={19}/><span>先登記家長的 Google Email，再綁定孩子。家長登入後只能查看自己的孩子；教員可同時綁定自己的孩子。</span></div>
    <div className="table-wrap"><table><thead><tr><th>姓名／Email</th><th>身分</th><th>綁定孩子</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.Users.map((u:any)=><tr key={u.id}><td><strong>{u.name}</strong><small className="block muted">{u.email}</small></td><td>{roleLabels[u.role]}</td><td>{data.Guardians.filter((g:any)=>g.active&&g.userId===u.id).map((g:any)=>data.Students.find((x:any)=>x.id===g.studentId)?.name).filter(Boolean).join('、')||'—'}</td><td><Pill tone={u.active?'green':'gray'}>{u.active?'啟用':'停用'}</Pill></td><td><button className="button small secondary" onClick={()=>editUser(u)}>編輯</button></td></tr>)}</tbody></table></div></>;
  else if(isAdmin&&page==='admin/settings')content=<><Heading eyebrow="讓每一學期順利接續" title="學期與設定"/>
    <div className="settings-grid"><section className="panel white"><div className="section-title"><h2>班級與積分規則</h2><button className="text-button" onClick={()=>showDialog('編輯班級設定','saveSettings',[
      {key:'churchName',label:'教會名稱',required:true},{key:'className',label:'班級名稱',required:true},
      {key:'currentTermId',label:'目前學期',type:'select',options:data.Terms.filter((t:any)=>!t.archived).map((t:any)=>({value:t.id,label:t.name}))},
      {key:'attendancePoints',label:'出席加分',type:'number',min:0,maxNumber:100},{key:'latePoints',label:'遲到加分',type:'number',min:0,maxNumber:100},{key:'versePoints',label:'金句完成加分',type:'number',min:0,maxNumber:100}
    ],Object.fromEntries(data.Settings.map((x:any)=>[x.id,x.value])))}>編輯 <Edit3 size={15}/></button></div><dl className="settings-list"><dt>教會</dt><dd>{s(data,'churchName')}</dd><dt>班級</dt><dd>{s(data,'className')}</dd><dt>出席</dt><dd>＋{s(data,'attendancePoints')} 分</dd><dt>遲到</dt><dd>＋{s(data,'latePoints')} 分</dd><dt>金句完成</dt><dd>＋{s(data,'versePoints')} 分</dd></dl><p className="help-text">規則變更適用於之後的新登記，既有紀錄保留原分數。</p></section>
    <section className="panel white"><div className="section-title"><h2>學期管理</h2><button className="text-button" onClick={()=>showDialog('新增學期','saveTerm',[{key:'name',label:'學期名稱',required:true,full:true}],{name:'',archived:false})}><Plus size={16}/>新增</button></div>{data.Terms.map((t:any)=><div className="term-row" key={t.id}><div><strong>{t.name}</strong><small>{t.id}</small></div>{t.id===currentTerm?<Pill>目前學期</Pill>:<button className="text-button" disabled={busy} onClick={()=>perform('saveTerm',{...t,archived:!t.archived},false)}>{t.archived?'解除封存':'封存'}</button>}</div>)}<p className="help-text">先新增並切換目前學期，再封存舊學期。舊紀錄會保留。</p></section>
    <section className="panel white"><h2>Google 雲端資料</h2>{api.isDemo?<><p>正式使用前，請完成 Google 登入、Apps Script 與資料夾初始化。</p><a className="button secondary" href="https://github.com/timmywu30/tjc-classroom/blob/main/docs/SETUP.md" target="_blank" rel="noreferrer">開啟設定教學 <ExternalLink size={16}/></a></>:system?<div className="cloud-links">{[['scheduleUrl','開啟 Google 課表'],['spreadsheetUrl','開啟班級資料'],['driveUrl','開啟照片資料夾'],['backupUrl','開啟每日備份']].map(([key,label])=><a key={key} href={system[key]} target="_blank" rel="noreferrer">{label}<ExternalLink size={16}/></a>)}</div>:<button className="button secondary" onClick={async()=>{try{setSystem(await api.systemInfo());}catch(e:any){notify(e.message);}}}>讀取雲端資料連結</button>}</section>
    <section className="panel white"><h2>匯出與備份</h2><p>正式系統初始化後會建立每日文字資料備份；照片原檔保留在 Drive。</p><div className="button-stack"><button className="button secondary" onClick={exportScores}><Download size={16}/>匯出學期 CSV</button><button className="button secondary" onClick={async()=>{try{api.download('tjc-classroom-backup.json',JSON.stringify(await api.exportBackup(),null,2),'application/json');notify('已匯出資料');}catch(e:any){notify(e.message);}}}><Download size={16}/>下載資料備份</button>{api.isDemo&&<button className="text-button danger" onClick={()=>{if(confirm('清除這個瀏覽器的示範修改，恢復預設資料？')){api.resetDemo();refresh();notify('已重設示範資料');}}}>重設示範資料</button>}</div></section></div>
    <div className="section-title"><h2>最近管理操作</h2></div><div className="audit-list">{data.Audit.slice(0,15).map((a:any)=><div key={a.id}><span>{data.Users.find((u:any)=>u.id===a.actorId)?.name||'教員'}・{({attendance:'更新點名',learning:'更新金句',addPoints:'登記積分',saveStudent:'更新學員',importStudents:'匯入學員',saveUser:'更新帳號',saveAlbum:'更新相簿',uploadPhoto:'上傳照片',addPhoto:'加入照片',hidePhoto:'移除照片',saveAnnouncement:'更新公告',saveEvent:'更新活動',saveSettings:'更新設定',saveTerm:'更新學期',reversePoints:'撤銷積分',lockSession:'調整登記鎖定'} as any)[a.action]||a.action}</span><small>{timeText(a.at)}</small></div>)}</div></>;
  else content=<Empty title="找不到這個頁面">請從選單選擇要查看的內容。</Empty>;
  const nav=adminPage?adminNav.filter(([path])=>isAdmin||!['admin/people','admin/settings'].includes(path as string)):frontNav;
  const pageTitle=[...frontNav,...adminNav].find(([path])=>path===page)?.[1]||'幼年班';
  return <div className="app-shell">
    {menu&&<div className="sidebar-shade" onClick={()=>setMenu(false)}/>}
    <aside className={'sidebar '+(menu?'open':'')}><a className="brand" href="#/home"><span className="brand-symbol"><Star fill="currentColor" size={25}/></span><div><strong>{s(data,'className')}</strong><small>一起成長的日常</small></div></a><div className="sidebar-label">{adminPage?'教員管理':'家長與學員'}</div><nav>{nav.map(([path,label,Icon]:any)=><a key={path} href={'#/'+path} className={page===path?'active':''} aria-current={page===path?'page':undefined}><Icon size={21}/><span>{label}</span>{page===path&&<span className="nav-indicator"/>}</a>)}</nav>{isStaff&&<button className="switch-workspace" onClick={()=>go(adminPage?'home':'admin')}>{adminPage?<Home size={19}/>:<ShieldCheck size={19}/>}<span>{adminPage?'返回家長前台':'進入教員後台'}</span><ChevronRight size={16}/></button>}<div className="sidebar-bottom"><span className="tiny-star"><Star size={18}/></span><p>在愛裡學習，<br/>在信仰裡成長。</p><small>{s(data,'churchName')}<br/>宗教教育・{s(data,'className')}</small></div></aside>
    <div className="workspace"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-only" aria-label="開啟選單" onClick={()=>setMenu(true)}><Menu/></button><span>{adminPage?'教員管理':'班級日常'}</span><ChevronRight size={14}/><strong>{pageTitle as string}</strong></div><div className="topbar-right"><button className="icon-button" onClick={refresh} disabled={busy} aria-label="重新整理資料"><RefreshCw size={18} className={busy?'spin':''}/></button><span className="user-pill"><span className="avatar small-avatar">{data.actor.name[0]}</span><span>{data.actor.name}<small>{roleLabels[data.actor.role]}</small></span></span>{!api.isDemo&&<button className="icon-button" onClick={signOut} disabled={busy} aria-label="登出"><LogOut size={18}/></button>}</div></header>
    {api.isDemo&&<div className="demo-bar"><span><span className="demo-dot"/>示範模式 · 所有資料皆為虛構</span><label>體驗身分 <select aria-label="示範身分" disabled={busy} value={data.actor.id} onChange={e=>changeRole(e.target.value)}><option value="parent_a">小恩的家長（兩位孩子）</option><option value="parent_b">小禾的家長</option><option value="teacher">教員</option><option value="admin">班負責</option></select></label></div>}
    <main id="main-content">{api.hasPendingWrite()&&<div className="info-box" role="alert"><p>有一筆儲存結果尚未確認。重試會沿用原操作編號，避免重複登記。</p><button className="button secondary" disabled={busy} onClick={retryWrite}>重試上次儲存</button></div>}{error&&<div className="error-box" role="alert">{error}<button className="text-button" onClick={refresh}>重試</button></div>}{content}<footer className="footer"><span>{s(data,'churchName')}・{s(data,'className')}</span><span>{api.isDemo?'示範內容・請勿輸入真實個資':'班級資料依教員發布為準'}</span></footer></main>
    {!adminPage&&<nav className="bottom-nav" aria-label="手機導覽">{frontNav.map(([path,label,Icon]:any)=><a key={path} className={page===path?'active':''} href={'#/'+path}><Icon size={20}/><span>{label}</span></a>)}</nav>}</div>
    {dialog&&<Dialog key={dialog.title+JSON.stringify(dialog.initial)} dialog={dialog} busy={busy} onClose={()=>!busy&&setDialog(null)} onSave={(values:any)=>{if(!dialog.action){setDialog(null);return;}perform(dialog.action,dialog.transform?dialog.transform(values):values);}}/>}
    {lightbox&&<div className="lightbox" role="dialog" aria-modal="true" aria-label="放大照片" onClick={()=>setLightbox(null)}><button className="icon-button" onClick={()=>setLightbox(null)} aria-label="關閉照片"><X/></button><img src={lightbox.src} alt={lightbox.name}/><p>{lightbox.name}</p></div>}
    {toast&&<div className="toast" role="status"><CheckCircle2 size={19}/><span>{toast}</span><button aria-label="關閉通知" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div>;
}
