import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  // Keep all browser fixtures fictional even when production config uses Google.
  await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.CLASSROOM_CONFIG={mode:"demo"};'}));
});
async function start(page,role='parent_a'){
  await page.goto('/');await expect(page.getByRole('heading',{level:1})).toContainText('平安');
  if(role!=='parent_a')await page.getByLabel('示範身分').selectOption(role);
  await expect(page.getByLabel('示範身分')).toHaveValue(role);
}
async function visit(page,path){await page.goto('/#/'+path);await expect(page.locator('main')).toBeVisible();}
test('families switch their own children; private admin routes stay closed',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  const child=page.getByLabel('選擇孩子');
  await expect(child.locator('option')).toHaveText(['小恩（示範）','小樂（示範）']);
  await child.selectOption('s2');await expect(page.locator('.stat-card').first()).toContainText('36');
  await page.screenshot({path:'test-results/home-desktop.jpg',type:'jpeg',quality:70,fullPage:true});
  await page.getByLabel('示範身分').selectOption('parent_b');
  await expect(page.getByLabel('選擇孩子').locator('option')).toHaveText(['小禾（示範）']);
  await visit(page,'admin/students');await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole('heading',{level:1})).toContainText('平安');expect(errors).toEqual([]);
});
test('teacher attendance and learning appear in family scores',async({page})=>{
  await start(page,'teacher');await visit(page,'admin/attendance');
  await page.getByLabel('選擇點名課程').selectOption('course2');
  const row=page.locator('.roll-row').filter({hasText:'小恩（示範）'});
  await row.getByRole('button',{name:'出席',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('已儲存');
  await row.getByRole('button',{name:'登記金句',exact:true}).click();
  await expect(row.getByRole('button',{name:'金句已完成'})).toBeVisible();
  await page.getByLabel('示範身分').selectOption('parent_a');
  await expect(page.locator('.stat-card').first()).toContainText('38');
  await visit(page,'growth');await expect(page.locator('main')).toContainText('金句背誦');
});
test('published notices reach parents; student import previews before saving',async({page})=>{
  await start(page,'admin');await visit(page,'admin/content');
  await page.getByRole('button',{name:'新增公告',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('標題').fill('測試：本週攜帶彩色筆');
  await dialog.getByLabel('公告內容').fill('請準備六色彩色筆。');
  await dialog.getByLabel('發布給家長').check();
  await dialog.getByRole('button',{name:'儲存',exact:true}).click();await expect(dialog).toHaveCount(0);
  await visit(page,'admin/students');await page.getByRole('button',{name:'讀取雲端學員表'}).click();
  await expect(dialog).toContainText('確認匯入雲端學員');
  await expect(dialog.getByLabel('即將新增或更新的學員')).toHaveValue(/demo_import_01/);
  await dialog.getByRole('button',{name:'儲存',exact:true}).click();
  await expect(page.getByRole('table')).toContainText('示範小禾');
  await page.getByLabel('示範身分').selectOption('parent_a');
  await expect(page.locator('main')).toContainText('測試：本週攜帶彩色筆');
  await expect(page.getByLabel('選擇孩子').locator('option')).toHaveCount(2);
});
test('photo upload, review, publication and family lightbox work',async({page})=>{
  await start(page,'teacher');await visit(page,'admin/albums');
  await page.getByRole('button',{name:'課堂的美好片刻',exact:true}).click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6eQAAAAASUVORK5CYII=','base64');
  await page.locator('input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});
  await expect(page.getByRole('status')).toContainText('已上傳 1 張照片');
  await page.getByRole('button',{name:'編輯與發布'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('已檢查照片內容及家長分享同意').check();
  await dialog.getByLabel('發布給家長（需先有照片）').check();
  await dialog.getByRole('button',{name:'儲存',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.getByLabel('示範身分').selectOption('parent_a');await visit(page,'albums');
  await page.getByRole('button',{name:'課堂的美好片刻',exact:true}).click();
  await page.getByRole('button',{name:'放大 sample.jpg',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'放大照片'}).getByRole('img',{name:'sample.jpg',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('phone views fit and navigation stays usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await start(page);
  await page.screenshot({path:'test-results/home-mobile.jpg',type:'jpeg',quality:70,fullPage:true});
  for(const route of ['schedule','growth','events','albums']){
    await visit(page,route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  }
  await page.getByRole('navigation',{name:'手機導覽'}).getByRole('link',{name:'首頁',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('平安');
  await page.getByLabel('示範身分').selectOption('teacher');
  await page.getByRole('button',{name:'開啟選單'}).click();
  await page.getByRole('button',{name:'進入教員後台'}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('教員工作台');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test('unconfigured Google mode fails closed and never reveals demo records',async({page})=>{
  await page.unroute('**/config.js');
  await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.CLASSROOM_CONFIG={mode:"google",firebase:{},appsScriptUrl:""};'}));
  await page.goto('/');
  await page.getByRole('button',{name:'使用 Google 帳號登入'}).click();
  await expect(page.getByRole('alert')).toContainText('Google 登入尚未完成設定');
  await expect(page.locator('.demo-bar')).toHaveCount(0);
  await expect(page.locator('main')).toHaveCount(0);
  await expect(page.getByLabel('選擇孩子')).toHaveCount(0);
});

test('weekly schedule shows periods, combined classes and duty; season notes respect role and term',async({page})=>{
  await start(page);await visit(page,'schedule');
  await expect(page.locator('.season-card')).toContainText('學習感恩，練習關心身邊的人。');
  await expect(page.locator('.teacher-notes')).toHaveCount(0);
  const courses=page.locator('.course-row');await expect(courses).toHaveCount(6);
  await expect(courses.first().locator('.course-periods li')).toHaveCount(3);
  await expect(courses.first()).toContainText('詩頌／司琴：林教員／陳司琴（示範）');
  await expect(courses.first()).toContainText('值星：周教員（示範）');
  await expect(courses.last().locator('.course-periods li')).toHaveCount(2);
  await expect(courses.last()).toContainText('崇拜／共習');
  await page.getByLabel('搜尋課程').fill('製作感恩小卡');await expect(courses).toHaveCount(5);
  await page.getByLabel('搜尋課程').fill('查無此課程');await expect(page.getByText('沒有符合的課程')).toBeVisible();
  await page.getByLabel('搜尋課程').fill('');
  await page.screenshot({path:'test-results/schedule-desktop.jpg',type:'jpeg',quality:75,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/schedule-mobile.jpg',type:'jpeg',quality:75,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await visit(page,'events');await expect(page.locator('.season-activities')).toContainText('親子共學日（示範）');
  await page.getByLabel('示範身分').selectOption('teacher');await visit(page,'schedule');
  await page.getByText('教員工作提醒',{exact:true}).click();await expect(page.locator('.teacher-notes')).toContainText('教員請事先確認教材與分工。');
  await page.getByLabel('選擇學期').selectOption('term_114_2');await expect(page.locator('.season-card')).toHaveCount(0);
});
