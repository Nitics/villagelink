// End-to-end test of the built app against the in-memory Supabase stand-in.
// 1) npm run build:e2e   2) serve dist-e2e on :4173   3) node tests/e2e.mjs
import { chromium } from 'playwright';

const URL = process.env.APP_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS ?? 'tests/shots/';
const results = [];
const errors = [];
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|fonts/.test(m.text())) errors.push('console: ' + m.text()); });

const body = async () => (await page.innerText('body')).toLowerCase();
const has = async (t) => (await body()).includes(t.toLowerCase());
const wait = (ms = 350) => page.waitForTimeout(ms);
const tap = async (sel) => { await page.click(sel); await wait(); };
const tapText = async (text, scope = 'body') => { await page.locator(scope).getByText(text, { exact: true }).first().click(); await wait(); };
const go = async (hash) => { await page.goto(URL + '#' + hash); await wait(700); };
const signIn = async (email) => {
  await go('/profile');
  if (await has('sign out')) { await tapText('Sign out'); await wait(500); }
  await tapText('Sign in or create an account');
  await page.fill('#a_email', email); await page.fill('#a_pass', 'password123');
  await page.click('.sheet button[type=submit]'); await wait(800);
};

try {
  // ---- Visitor ----
  await go('/');
  check('Home loads businesses', await has('what’s open near me right now?') && await has('expected open'));
  await page.screenshot({ path: SHOTS + 'r1_home.png', fullPage: true });
  await go('/services');
  check('Services lists all 3', await has('OneStop Tuck Shop') && await has('Praxoz') && await has('Mangweni Clinic'));
  await tapText('OneStop Tuck Shop');
  await page.locator('.sheet').getByRole('button', { name: /^Order/ }).click(); await wait();
  check('Order asks visitor to sign in', await has('sign in before sending your order'));

  // ---- Customer ----
  await page.locator('.sheet .banner button').click(); await wait();
  check('Sign-in explains why', await has('sign in to send your order to the shop'));
  await page.fill('#a_email', 'cust@test.co.za'); await page.fill('#a_pass', 'wrongpass1'); await page.click('.sheet button[type=submit]'); await wait();
  check('Wrong password message', await has('wrong email or password'));
  await page.fill('#a_pass', 'password123'); await page.click('.sheet button[type=submit]'); await wait(900);
  await go('/profile');
  check('Customer signed in', await has('customer') && await has('sign out'));
  check('Customer has no manage gear', (await page.locator('a[href="#/manage"]').count()) === 0);

  await go('/services'); await tapText('OneStop Tuck Shop');
  await page.locator('.sheet').getByRole('button', { name: /^Order/ }).click(); await wait();
  await tap('button[aria-label="More White bread"]'); await tap('button[aria-label="More White bread"]');
  check('Cart total R36', await has('R36'));
  await page.fill('#o_name', 'Thandi'); await page.fill('#o_phone', '072 111 2222');
  await page.click('.sheet button[type=submit]'); await wait(1000);
  check('Order shown in My orders', await has('sent to shop') && await has('2 × White bread'));
  await page.screenshot({ path: SHOTS + 'r2_orders.png', fullPage: true });
  await tapText('Cancel order'); await wait(700);
  check('Customer cancels order', await has('cancelled'));

  await go('/services'); await tapText('OneStop Tuck Shop');
  await page.locator('.sheet').getByRole('button', { name: /^Order/ }).click(); await wait();
  await tap('button[aria-label="More White bread"]');
  await page.selectOption('#o_method', 'delivery');
  await page.click('.sheet button[type=submit]'); await wait();
  check('Delivery without address refused, choices kept', await has('add a delivery address') && (await page.inputValue('#o_method')) === 'delivery');
  await page.fill('#o_addr', 'House 214'); await page.click('.sheet button[type=submit]'); await wait(1000);
  check('Delivery order sent', await has('delivery to house 214'));

  await go('/market?tab=listings'); await tapText('Sell something or offer a service');
  await page.fill('#lt', 'Fresh mangoes'); await page.fill('#lp', '30'); await page.fill('#ls', 'Thandi'); await page.fill('#lph', '072 111 2222');
  await page.click('.sheet button[type=submit]'); await wait(900);
  check('Listing posted', await has('Fresh mangoes'));

  await go('/study'); await tapText('Create');
  await page.fill('#gt', 'Algebra'); await page.fill('#gw', 'Library'); await page.fill('#gn', 'Thu 15:00');
  await page.click('.sheet button[type=submit]'); await wait(900);
  check('Study group created and joined', await has('Algebra') && await has('Joined') && await has('1 learner'));

  await go('/services'); await tapText('Mangweni Clinic'); await tapText('I saw it open'); await wait(600);
  check('Resident report shown', await has('a resident reported it'));
  await page.keyboard.press('Escape'); await wait();

  await go('/ask');
  await page.fill('#askInput', 'Which fuel stations are open now?'); await page.click('form.composer button[type=submit]'); await wait(800);
  check('Assistant answers in local mode', await has('[local] answer to: which fuel stations are open now?'));
  await tapText('Homework help');
  await page.fill('#askInput', 'Explain Pythagoras'); await page.keyboard.press('Enter'); await wait(800);
  check('Assistant answers in homework mode', await has('[school] answer to: explain pythagoras'));

  await go('/profile'); await tapText('List my business or upgrade');
  await page.fill('#pr_b', 'Thandi Bakes'); await page.fill('#pr_n', 'Thandi'); await page.fill('#pr_ph', '072 111 2222');
  await page.click('.sheet button[type=submit]'); await wait(800);
  check('Customer requests a business plan', await has('thandi bakes'));

  // ---- Shop owner ----
  await signIn('owner@test.co.za');
  await go('/profile');
  check('Owner sees their shop', await has('owner of onestop tuck shop'));
  await go('/manage');
  check('Owner sees My business with the delivery order', await has('my business') && await has('house 214') && !(await has('import a list')));
  await page.screenshot({ path: SHOTS + 'r3_owner.png', fullPage: true });
  await page.locator('.card', { hasText: 'House 214' }).getByRole('button', { name: 'Accepted' }).click(); await wait(800);
  check('Owner accepts order', (await page.locator('.card', { hasText: 'House 214' }).innerText()).toLowerCase().includes('accepted'));
  await page.locator('main button.card', { hasText: 'OneStop Tuck Shop' }).click(); await wait();
  check('Owner edit form is limited', (await page.locator('#b_name').count()) === 0 && (await page.locator('#b_plan').count()) === 0);
  await page.fill('#b_hours', 'Mo-Su 06:00-21:00'); await page.click('.sheet form button[type=submit]'); await wait(800);
  check('Owner hours saved', (await page.evaluate(() => window.__fake.db.businesses[0].opening_hours)) === 'Mo-Su 06:00-21:00');
  await page.fill('#pp_n', 'Maize meal 10 kg'); await page.fill('#pp_p', '115');
  await page.locator('.sheet').getByRole('button', { name: 'Add product' }).click(); await wait(800);
  check('Owner adds product, form clears', await has('Maize meal 10 kg') && (await page.inputValue('#pp_n')) === '');
  await page.keyboard.press('Escape'); await wait();
  await go('/services'); await tapText('OneStop Tuck Shop');
  await page.fill('#confNote', 'Fresh bread in'); await tapText('Confirm open now'); await wait(800);
  check('Owner confirms open', await has('confirmed open') && await has('fresh bread in'));
  await page.keyboard.press('Escape'); await wait();
  await tapText('Praxoz');
  check('Owner gets no tools on another business', !(await has('confirm open now')));
  await page.keyboard.press('Escape'); await wait();

  // ---- Staff ----
  await signIn('staff@test.co.za');
  await go('/manage');
  check('Staff sees all orders', await has('manage villagelink') && await has('house 214') && !(await has('people')));
  await page.locator('.chips').getByText('Businesses', { exact: true }).click(); await wait();
  await tapText('Import a list');
  await page.fill('#csvText', 'name,category,type_label,town,opening_hours,hours_checked,sells_online\nPraxoz,fuel,24-hour fuel station,Malelane,24/7,2026-10-19,true\nTonga Butchery,butcher,Butcher,Tonga,"Mo-Sa 07:00-18:00; Su off",2026-10-19,false\nNomsa Salon,service,Hair salon,Naas,Mo-Sa 08:00-17:00,2026-10-19,false\nBad Row,cafe,,Nowhere,sometimes,,');
  await page.locator('.sheet').getByRole('button', { name: 'Import' }).click(); await wait(1200);
  check('Import: 3 new, 1 updated, problems listed', await has('imported 3 new and updated 1') && await has('unknown category'));
  check('Import stored rows', (await page.evaluate(() => window.__fake.db.businesses.length)) === 6 && (await page.evaluate(() => window.__fake.db.businesses.find((b) => b.name === 'Praxoz').sells_online)) === true);
  await page.keyboard.press('Escape'); await wait();
  await page.locator('main button.card', { hasText: 'Mangweni Clinic' }).click(); await wait();
  check('Staff edit form is full', (await page.locator('#b_plan').count()) === 1);
  await page.selectOption('#b_town', 'Mangweni'); await page.click('.sheet form button[type=submit]'); await wait(800);
  check('Staff moves clinic to Mangweni', (await page.evaluate(() => window.__fake.db.businesses.find((b) => b.id === 'b3').town)) === 'Mangweni');
  await page.screenshot({ path: SHOTS + 'r4_staff.png', fullPage: true });

  // ---- Super user ----
  const tabTo = async (name) => { await page.locator('.chips').getByText(name, { exact: true }).click(); await wait(500); };
  await signIn('admin@test.co.za');
  await go('/profile');
  check('Super user label on profile', await has('villagelink super user'));
  await go('/manage');
  check('Super user screen has People and Towns', await has('super user') && (await page.locator('.chips').innerText()).includes('People') && (await page.locator('.chips').innerText()).includes('Towns'));

  // people
  await tabTo('People');
  check('People lists every account', (await page.locator('main button.card').count()) === 4);
  await page.locator('main button.card', { hasText: 'cust@test.co.za' }).click(); await wait(600);
  await page.selectOption('#pa_r', 'staff'); await page.fill('#pa_n', 'Thandi M');
  await page.locator('.sheet').getByRole('button', { name: 'Save account' }).click(); await wait(800);
  check('Super user promotes a customer to staff', (await page.evaluate(() => window.__fake.db.profiles.find((p) => p.id === 'u-cust').role)) === 'staff');
  await page.selectOption('#pa_link', 'b2'); await page.locator('.sheet').getByRole('button', { name: 'Link', exact: true }).click(); await wait(800);
  check('Super user links an owner to a business', (await page.evaluate(() => window.__fake.db.business_members.some((m) => m.user_id === 'u-cust' && m.business_id === 'b2'))) && (await page.locator('.sheet').innerText()).includes('Praxoz'));
  await page.locator('.sheet').getByRole('button', { name: 'Remove access' }).click(); await wait(200);
  await page.locator('.sheet').getByRole('button', { name: 'Tap again to remove access' }).click(); await wait(900);
  check('Remove access: back to customer, unlinked', (await page.evaluate(() => window.__fake.db.profiles.find((p) => p.id === 'u-cust').role)) === 'customer'
    && !(await page.evaluate(() => window.__fake.db.business_members.some((m) => m.user_id === 'u-cust'))));
  await page.keyboard.press('Escape'); await wait();
  await page.locator('main button.card', { hasText: 'admin@test.co.za' }).click(); await wait(600);
  check('Super user can’t change own role', await page.isDisabled('#pa_r') && !(await page.locator('.sheet').innerText()).includes('Remove access'));
  await page.keyboard.press('Escape'); await wait();

  // towns
  await tabTo('Towns');
  await page.fill('#town_new', 'Magudu'); await page.locator('main').getByRole('button', { name: 'Add' }).click(); await wait(700);
  check('Super user adds a town', await has('magudu'));
  await page.locator('.card', { hasText: 'Magudu' }).getByRole('button', { name: 'Rename' }).click(); await wait();
  await page.fill('#town_Magudu', 'Magudu Village'); await page.getByRole('button', { name: 'Save name' }).click(); await wait(700);
  check('Super user renames a town', await has('magudu village'));
  await page.getByRole('button', { name: 'Remove Magudu Village' }).click(); await wait(700);
  check('Super user removes an unused town', (await page.locator('main .card', { hasText: 'Magudu Village' }).count()) === 0 && (await page.evaluate(() => !window.__fake.db.towns.some((t) => t.name.startsWith('Magudu')))));
  await page.getByRole('button', { name: 'Remove Malelane' }).click(); await wait(400);
  check('Town with businesses can’t be removed', await has('to another town first'));

  // orders
  await tabTo('Orders');
  const before = await page.evaluate(() => window.__fake.db.orders.length);
  await page.locator('.card', { hasText: 'House 214' }).getByRole('button', { name: 'Delete order' }).click(); await wait(200);
  await page.locator('.card', { hasText: 'House 214' }).getByRole('button', { name: 'Tap again to delete for good' }).click(); await wait(800);
  check('Super user deletes an order', (await page.evaluate(() => window.__fake.db.orders.length)) === before - 1);

  // listings
  await tabTo('Listings');
  await page.locator('main button.card', { hasText: 'Fresh mangoes' }).click(); await wait();
  await page.fill('#el_p', '35'); await page.uncheck('#el_a');
  await page.locator('.sheet').getByRole('button', { name: 'Save listing' }).click(); await wait(800);
  check('Super user edits and hides a listing', (await has('hidden')) && (await page.evaluate(() => { const l = window.__fake.db.listings.find((x) => x.title === 'Fresh mangoes'); return l.price === 35 && l.is_active === false; })));
  await go('/market?tab=listings');
  check('Hidden listing is gone from the market', !(await has('fresh mangoes')));

  // study groups
  await go('/manage?tab=groups');
  await page.locator('main button.card', { hasText: 'Algebra' }).click(); await wait();
  await page.fill('#eg_t', 'Algebra revision'); await page.locator('.sheet').getByRole('button', { name: 'Save study group' }).click(); await wait(800);
  check('Super user edits a study group', await has('algebra revision'));
  await page.locator('main button.card', { hasText: 'Algebra revision' }).click(); await wait();
  await page.locator('.sheet').getByRole('button', { name: 'Delete study group' }).click(); await wait(200);
  await page.locator('.sheet').getByRole('button', { name: 'Tap again to delete for good' }).click(); await wait(800);
  check('Super user deletes a study group', !(await has('algebra revision')));

  // plan requests
  await tabTo('Plan requests');
  await page.locator('.card', { hasText: 'Thandi Bakes' }).getByRole('button', { name: 'Delete request' }).click(); await wait(200);
  await page.locator('.card', { hasText: 'Thandi Bakes' }).getByRole('button', { name: 'Tap again to delete for good' }).click(); await wait(800);
  check('Super user deletes a plan request', !(await has('thandi bakes')));

  // businesses and products
  await tabTo('Businesses');
  await page.locator('main button.card', { hasText: 'OneStop Tuck Shop' }).click(); await wait();
  await page.getByRole('button', { name: 'Edit White bread' }).click(); await wait();
  await page.fill('#pe_p_p1', '20'); await page.getByRole('button', { name: 'Save product' }).click(); await wait(800);
  check('Super user edits a product price', (await page.evaluate(() => window.__fake.db.products.find((p) => p.id === 'p1').price)) === 20);
  await page.keyboard.press('Escape'); await wait();
  await page.locator('main button.card', { hasText: 'Praxoz' }).click(); await wait();
  await page.uncheck('#b_active'); await page.click('.sheet form button[type=submit]'); await wait(800);
  await page.keyboard.press('Escape'); await wait();
  check('Hidden business is marked in Manage', (await page.locator('main button.card', { hasText: 'Praxoz' }).innerText()).toLowerCase().includes('hidden'));
  await go('/services');
  check('Hidden business is gone from Services', !(await has('praxoz')));

  // resident reports
  await tapText('Mangweni Clinic');
  await page.getByRole('button', { name: 'Remove resident reports' }).click(); await wait(800);
  check('Super user removes resident reports', !(await page.locator('.sheet').innerText()).toLowerCase().includes('a resident reported it'));
  await page.keyboard.press('Escape'); await wait();
  await page.screenshot({ path: SHOTS + 'r6_superuser.png', fullPage: true });

  // ---- No signal ----
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push('pageerror (offline): ' + e.message));
  await p2.addInitScript(() => { window.__offline = true; });
  await p2.goto(URL + '#/services'); await p2.waitForTimeout(900);
  const t2 = (await p2.innerText('body')).toLowerCase();
  check('Offline: saved businesses shown with notice', t2.includes('no signal') && t2.includes('onestop tuck shop'));
  await p2.screenshot({ path: SHOTS + 'r5_offline.png' });
} catch (e) {
  results.push('STOPPED: ' + String(e.message).split('\n')[0]);
  await page.screenshot({ path: SHOTS + 'r_error.png', fullPage: true });
}
await browser.close();
console.log(results.join('\n'));
console.log('\nErrors:', errors.length ? errors.join('\n') : 'none');
process.exit(results.every((r) => r.startsWith('PASS')) && !errors.length ? 0 : 1);
