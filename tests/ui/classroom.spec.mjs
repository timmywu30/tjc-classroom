import {test,expect} from '@playwright/test';
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
