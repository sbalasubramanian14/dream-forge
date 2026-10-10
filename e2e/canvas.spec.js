import { test, expect } from '@playwright/test';

test('particle canvas assembles, updates, focuses, orbits, pauses, and dissolves',async({page,request})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await request.post('/api/clear',{data:{}});
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Canvas connected');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#title')).toHaveText('A space for your next thought');
  await page.getByRole('combobox',{name:'Choose a construct'}).selectOption('portal');
  await expect(page.getByRole('button',{name:'The doorway',exact:true})).toBeVisible();
  await page.waitForTimeout(2200);
  await page.screenshot({path:'test-results/doorway.png'});
  await page.getByRole('combobox',{name:'Choose a construct'}).selectOption('architecture');
  await expect(page.locator('.label')).toHaveCount(3);
  await expect(page.locator('.edge-label')).toHaveCount(2);
  await page.waitForTimeout(2200);
  await page.screenshot({path:'test-results/architecture.png'});
  await page.getByRole('button',{name:'Database',exact:true}).click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('Database');
  await expect.poll(async()=> (await (await request.get('/api/state')).json()).focus).toBe('database');
  await page.getByRole('button',{name:'Close object details'}).click();
  await expect(page.locator('#detail')).toBeHidden();
  await page.mouse.move(720,360);await page.mouse.down();await page.mouse.move(950,420,{steps:12});await page.mouse.up();
  await page.mouse.wheel(0,-200);
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await expect(page.getByRole('button',{name:'Resume motion',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('combobox',{name:'Choose a construct'}).selectOption('helix');
  await expect(page.getByRole('button',{name:'Double helix',exact:true})).toHaveCount(1);
  await page.screenshot({path:'test-results/helix.png'});
  await page.getByRole('button',{name:'Resume motion',exact:true}).click();
  await page.reload();await expect(page.locator('.label')).toHaveCount(1);
  await page.getByRole('button',{name:'Dissolve',exact:true}).click();
  await expect(page.locator('.label')).toHaveCount(0);
  await expect(page.locator('#title')).toHaveText('A space for your next thought');
  expect(errors).toEqual([]);
});

test('small viewport and reduced motion remain usable',async({page,request})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await request.post('/api/clear',{data:{}});await page.goto('/');
  await expect(page.getByRole('button',{name:'Resume motion'})).toBeVisible();
  await page.getByRole('combobox',{name:'Choose a construct'}).selectOption('portal');
  await expect(page.locator('.label')).toHaveCount(1);
  await page.screenshot({path:'test-results/mobile.png'});
  const label=await page.locator('.label').boundingBox(), caption=await page.locator('.caption').boundingBox();
  expect(label.y+label.height).toBeLessThan(caption.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Dissolve',exact:true}).click();await expect(page.locator('.label')).toHaveCount(0);
});

test('canvas follows window size and refits when resizing or recovering from zoom',async({page,request})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await request.post('/api/clear',{data:{}});await page.goto('/');
  await page.getByRole('combobox',{name:'Choose a construct'}).selectOption('portal');
  for(const viewport of [{width:1280,height:620},{width:1024,height:600},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await expect.poll(()=>page.evaluate(()=>{
      const canvas=document.querySelector('canvas').getBoundingClientRect();
      return {width:canvas.width,height:canvas.height};
    })).toEqual(viewport);
    const label=await page.locator('.label').boundingBox();
    const caption=await page.locator('.caption').boundingBox();
    expect(label.y).toBeGreaterThan(0);
    expect(label.x>=caption.x+caption.width||label.y+label.height<caption.y).toBe(true);
    const nav=await page.locator('nav').boundingBox();
    expect(nav.x+nav.width).toBeLessThanOrEqual(viewport.width);expect(nav.y+nav.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }
  await page.setViewportSize({width:1280,height:620});
  await page.mouse.move(640,230);await page.mouse.wheel(0,-1200);
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect.poll(async()=>{
    const label=await page.locator('.label').boundingBox(),caption=await page.locator('.caption').boundingBox();
    return label.y>0&&(label.x>=caption.x+caption.width||label.y+label.height<caption.y);
  }).toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({path:'test-results/laptop-framing.png'});
});

test('richer constructs and custom geometry remain centered with compact controls',async({page,request})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  for(const [name,label] of [['tree','Branching structure'],['mechanism','Drive gear'],['orbits','Ringed planet'],['rocket','Launch vehicle'],['portal','The doorway']]) {
    await page.getByRole('combobox',{name:'Choose a construct'}).selectOption(name);
    await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
    const box=await page.locator('nav').boundingBox();expect(box.height).toBeLessThan(60);
    if(['tree','rocket','portal'].includes(name)) {
      const anchor=await page.getByRole('button',{name:label,exact:true}).boundingBox();
      expect(Math.abs(anchor.x+anchor.width/2-720)).toBeLessThan(3);
    }
    await page.waitForTimeout(200);await page.screenshot({path:`test-results/${name}-centered.png`});
  }
  const response=await request.post('/api/scene',{data:{title:'Custom construct',objects:[{id:'custom',shape:'pointcloud',label:'Agent geometry',rotation:[0,.7,0],points:[[-2,-1,0],[2,-1,0],[0,2,0],[0,0,1]]}]}});
  expect(response.ok()).toBe(true);await expect(page.getByRole('button',{name:'Agent geometry'})).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});
