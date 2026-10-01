// End-to-end API test. Requires a running backend and its database:
//   BASE=http://localhost:3001 DATABASE_URL=postgres://... node test/api.e2e.mjs
import { existsSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');
const BASE = process.env.BASE ?? `http://localhost:${process.env.PORT ?? 3001}`;
const ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const sql = async (text, params = []) => (await db.query(text, params)).rows;

// Dates are relative to the current month so the test can run at any time.
const pad = (n) => String(n).padStart(2, '0');
const monthOf = (offset) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { y: first.getFullYear(), m: first.getMonth() + 1, days: new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate() };
};
const M0 = monthOf(0);
const M1 = monthOf(1);
const MP = monthOf(-1);
const dateIn = (month, d) => `${month.y}-${pad(month.m)}-${pad(d)}`;
const round2 = (v) => Math.round(v * 100) / 100;
const share = (distributable, ratio, month) => round2((distributable * ratio) / 100 / month.days);

let cookie = '';
let failures = 0;
async function call(method, path, body, { raw = false } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie();
  if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  if (raw) return res;
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}
function check(name, cond, extra) {
  if (cond) console.log('  ok  ', name);
  else {
    failures++;
    console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : '');
  }
}
async function signUp(prefix) {
  cookie = '';
  const user = `${prefix}_${Date.now().toString(36)}`;
  const r = await call('POST', '/api/auth/sign-up/email', { email: `${user}@example.com`, password: 'password123', name: user, username: user });
  return { user, r };
}


console.log('auth');
const { user, r: signUpResult } = await signUp('tester');
let r = signUpResult;
check('sign up', r.status === 200, r);
r = await call('GET', '/api/user');
check('me', r.status === 200 && r.data.userName === user && r.data.accountIds.length === 0, r);
await call('POST', '/api/auth/sign-out', {});
r = await call('GET', '/api/user');
check('signed out -> 401', r.status === 401, r);
r = await call('POST', '/api/auth/sign-in/username', { username: user, password: 'password123' });
check('sign in with username', r.status === 200, r);

console.log('setup');
r = await call('GET', '/api/currencies');
check('currencies', r.data.length === 2, r);
r = await call('POST', '/api/accounts', { name: 'Main', currencyCode: 'HUF' });
check('create account', r.status === 201, r);
const accountId = r.data.id;
r = await call('POST', '/api/incomes', { accountId, name: 'Salary', amount: 320000 });
check('income', r.status === 201, r);
const incomeId = r.data.id;
r = await call('POST', '/api/fixed-expenses', { accountId, name: 'Rent', amount: 10000 });
check('fixed expense', r.status === 201, r);
r = await call('POST', '/api/plans', { accountId, name: 'Default' });
const planId = r.data.id;
r = await call('POST', `/api/pockets/${planId}`, { name: 'Food', ration: 50 });
const foodId = r.data.id;
r = await call('POST', `/api/pockets/${planId}`, { name: 'Fun', ration: 50 });
const funId = r.data.id;
r = await call('POST', `/api/pockets/${planId}`, { name: 'Too much', ration: 10 });
check('ratio > 100 rejected', r.status === 400 && r.data.error === 'ratio_exceed_limit', r);
r = await call('POST', `/api/plans/${planId}/activate`, { from: dateIn(M0, 1) });
check('activate plan', r.status === 204, r);
r = await call('GET', `/api/plans/${accountId}/effective?date=${dateIn(M0, 15)}`);
check('effective plan', r.data.plan?.id === planId && r.data.plan.isCurrent && r.data.plan.pockets.length === 2, r);

console.log('daily budget');
const s0 = share(310000, 50, M0);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 1)}`);
check('day 1 starts with the daily share', r.data.startAmount === s0 && r.data.isStarted, r.data);
r = await call('POST', '/api/expenditures', { items: [{ pocketId: foodId, name: 'Groceries', price: 1000, date: dateIn(M0, 1), description: 'weekly' }] });
check('add expenditure', r.status === 201, r);
const expId = r.data.ids[0];
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 1)}`);
check('day 1 end of day', r.data.eodAmount === round2(s0 - 1000) && r.data.expenditures[0].name === 'Groceries', r.data);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 3)}`);
check('day 3 carries over', r.data.startAmount === round2(3 * s0 - 1000), r.data);
r = await call('PUT', `/api/expenditures/${expId}`, { name: 'Groceries', price: 2000, description: null });
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 3)}`);
check('edit cascades', r.data.startAmount === round2(3 * s0 - 2000), r.data);

console.log('income change');
r = await call('PUT', `/api/incomes/${incomeId}`, { amount: 630000 });
check('update income', r.status === 204, r);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 1)}`);
const s0b = share(620000, 50, M0);
check('income change recalculates', r.data.relativeBudget === s0b && r.data.eodAmount === round2(s0b - 2000), r.data);
r = await call('PUT', `/api/incomes/${incomeId}`, { amount: 941000, from: dateIn(M1, 1) });
r = await call('GET', `/api/incomes/${accountId}`);
check('scheduled change visible as upcoming', r.data[0].amount === 630000 && r.data[0].upcoming?.amount === 941000, r.data);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M1, 1)}`);
check('next month uses the scheduled income', r.data.relativeBudget === share(931000, 50, M1), r.data);
r = await call('PUT', `/api/incomes/${incomeId}`, { amount: 1, from: dateIn(MP, 1) });
check('past month rejected', r.status === 400 && r.data.error === 'cannot_change_past_months', r);

console.log('pocket versioning');
r = await call('PUT', `/api/pockets/${foodId}`, { ration: 60, from: dateIn(M1, 1) });
check('ratio change rejected when total > 100', r.status === 400, r);
r = await call('PUT', `/api/pockets/${funId}`, { ration: 40, from: dateIn(M1, 1) });
check('fun -> 40% from nov', r.status === 204, r);
r = await call('PUT', `/api/pockets/${foodId}`, { ration: 60, from: dateIn(M1, 1), name: 'Food & Drinks' });
check('food -> 60% from nov', r.status === 204, r);
r = await call('GET', `/api/plans/${accountId}/effective?date=${dateIn(M1, 10)}`);
const novFood = r.data.plan.pockets.find((p) => p.lineageId === foodId);
check('nov version differs, renamed', novFood && novFood.id !== foodId && novFood.ration === 60 && novFood.name === 'Food & Drinks', r.data);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M1, 1)}`);
check('next month DE moved to the new version', r.data.pocket.id === novFood.id && r.data.relativeBudget === share(931000, 60, M1), r.data);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 1)}`);
check('current month keeps the old version', r.data.pocket.id === foodId && r.data.relativeBudget === s0b, r.data);
r = await call('GET', `/api/daily-expenses/${foodId}/time-series?from=${dateIn(M0, 1)}&to=${dateIn(M1, M1.days)}`);
check('time series across versions', r.data.length === 1 && r.data[0].price === 2000, r.data);

console.log('expenses list');
r = await call('POST', '/api/expenditures', { items: [
  { pocketId: funId, name: 'Cinema', price: 3000, date: dateIn(M0, 2) },
  { pocketId: funId, name: 'Concert', price: 9000, date: dateIn(M0, 5), description: 'Rock band' },
] });
check('bulk add', r.status === 201 && r.data.ids.length === 2, r);
r = await call('GET', `/api/expenditures?accountId=${accountId}&page=1&pageSize=2`);
check('paged list', r.data.total === 3 && r.data.items.length === 2 && r.data.items[0].name === 'Concert', r.data);
r = await call('GET', `/api/expenditures?accountId=${accountId}&search=rock`);
check('search in encrypted description', r.data.total === 1 && r.data.items[0].name === 'Concert', r.data);
r = await call('GET', `/api/expenditures?accountId=${accountId}&pocketName=Fun&from=${dateIn(M0, 3)}`);
check('pocket + date filter', r.data.total === 1, r.data);
const stored = await sql(`SELECT encode("nameEnc", 'escape') AS name FROM expenditures e JOIN daily_expenses de ON de.id = e."dailyExpenseId" JOIN pockets p ON p.id = de."pocketId" JOIN division_plans dp ON dp.id = p."planId" WHERE dp."accountId" = $1`, [accountId]);
check('names encrypted at rest', stored.length === 3 && stored.every((row) => !/Groceries|Cinema|Concert/.test(row.name)), stored);

console.log('wishlists');
r = await call('POST', '/api/wishlists', { accountId, name: 'Bike', targetAmount: 50000, targetDate: '2027-03-01', mode: 'manual', affectedDailyExpenseIds: [] });
const bikeId = r.data.id;
check('create manual wishlist', r.status === 201 && r.data.status === 'inactive', r);
r = await call('POST', `/api/wishlists/${bikeId}/move`, { pocketId: funId, name: 'Save', amount: 1000, date: dateIn(M0, 1) });
check('move to inactive rejected', r.status === 400 && r.data.error === 'wishlist_inactive', r);
await call('POST', `/api/wishlists/${bikeId}/activate`);
await call('GET', `/api/daily-expenses/${funId}?date=${dateIn(M0, 1)}`);
r = await call('POST', `/api/wishlists/${bikeId}/move`, { pocketId: funId, name: 'Save', amount: 1000, date: dateIn(M0, 1) });
check('move money', r.status === 201, r);
r = await call('GET', `/api/wishlists/${bikeId}`);
check('progress 1000 + estimate', r.data.currentAmount === 1000 && r.data.estimatedFinishDate, r.data);
r = await call('GET', `/api/daily-expenses/${funId}/in-range?from=${dateIn(M0, 10)}&to=${dateIn(M0, 12)}`);
check('in-range days', r.data.length === 3, r.data);
r = await call('POST', '/api/wishlists', { accountId, name: 'Trip', targetAmount: 100000, targetDate: '2027-03-01', mode: 'automatic', affectedDailyExpenseIds: r.data.map((d) => d.id) });
check('create automatic wishlist', r.status === 201 && r.data.affectedDailyExpenses.length === 3, r);

console.log('pocket delete');
r = await call('DELETE', `/api/pockets/${funId}?targetPocketId=${foodId}`);
check('delete fun pocket (merge into food)', r.status === 204, r);
r = await call('GET', `/api/plans/${accountId}/effective?date=${dateIn(M0, 15)}`);
check('only food left at 100%', r.data.plan.pockets.length === 1 && r.data.plan.pockets[0].ration === 100, r.data);
r = await call('GET', `/api/daily-expenses/${foodId}?date=${dateIn(M0, 5)}`);
check('concert merged into food day', r.data.expenditures.some((e) => e.name === 'Concert'), r.data);

console.log('export');
const res = await call('POST', '/api/expenditures/export', { accountId, format: 'CSV', from: dateIn(M0, 1), to: dateIn(M1, M1.days), categoryIds: [], pocketIds: [foodId] }, { raw: true });
const csv = await res.text();
check('csv export', res.status === 200 && csv.includes('Concert') && csv.split('\n').length === 5, csv);
const xres = await call('POST', '/api/expenditures/export', { accountId, format: 'EXCEL', from: dateIn(M0, 1), to: dateIn(M1, M1.days), categoryIds: [], pocketIds: [] }, { raw: true });
const buf = Buffer.from(await xres.arrayBuffer());
check('excel export', xres.status === 200 && buf.subarray(0, 2).toString() === 'PK', xres.status);

console.log('user settings');
r = await call('PUT', '/api/user/api-key', { password: 'wrong', apiKey: 'abc' });
check('api key wrong password', r.status === 400, r);
r = await call('PUT', '/api/user/api-key', { password: 'password123', apiKey: 'secret-key' });
check('api key saved', r.status === 204, r);
r = await call('POST', '/api/user/api-key/reveal', { password: 'password123' });
check('api key revealed', r.data.apiKey === 'secret-key', r);
r = await call('PUT', '/api/user/preferences', { theme: 'dark', language: 'hu' });
r = await call('GET', '/api/user');
check('prefs saved', r.data.theme === 'dark' && r.data.language === 'hu' && r.data.hasApiKey, r.data);
r = await call('PUT', '/api/user/password', { currentPassword: 'password123', newPassword: 'password456' });
check('change password', r.status === 204, r);

console.log('cleanup');
r = await call('DELETE', `/api/accounts/${accountId}`);
check('delete account with history', r.status === 204, r);


console.log('automatic wishlist sweep');
await signUp('sweep');
const acc = (await call('POST', '/api/accounts', { name: 'A', currencyCode: 'EUR' })).data.id;
await call('POST', '/api/incomes', { accountId: acc, name: 'Pay', amount: 3000 });
const plan = (await call('POST', '/api/plans', { accountId: acc, name: 'P' })).data.id;
const pocket = (await call('POST', `/api/pockets/${plan}`, { name: 'All', ration: 100 })).data.id;
await call('POST', `/api/plans/${plan}/activate`, { from: dateIn(M0, 1) });
// Backdate the plan to the previous month so it has finished days.
await sql(`UPDATE division_plans SET "activeFrom"='${dateIn(MP, 1)}' WHERE id='${plan}'`);
await sql(`UPDATE incomes SET "activeFrom"='${dateIn(MP, 1)}' WHERE "accountId"='${acc}'`);
await sql(`UPDATE pockets SET "activeFrom"='${dateIn(MP, 1)}' WHERE id='${pocket}'`);
const sp = share(3000, 100, MP);
const linkedDay = MP.days - 1;
r = await call('GET', `/api/daily-expenses/${pocket}?date=${dateIn(MP, linkedDay)}`);
check('previous month share', r.data.relativeBudget === sp, r.data);
await call('POST', '/api/expenditures', { items: [{ pocketId: pocket, name: 'Lunch', price: 30, date: dateIn(MP, linkedDay) }] });
let remaining = 0;
for (let d = 1; d <= linkedDay; d++) remaining = round2(round2(sp + remaining) - (d === linkedDay ? 30 : 0));
const wl = (await call('POST', '/api/wishlists', { accountId: acc, name: 'Trip', targetAmount: 5000, targetDate: '2027-01-01', mode: 'automatic', affectedDailyExpenseIds: [] })).data.id;
await call('POST', `/api/wishlists/${wl}/activate`);
const [{ id: dayId }] = await sql(`SELECT id FROM daily_expenses WHERE "pocketId"='${pocket}' AND date='${dateIn(MP, linkedDay)}'`);
await sql(`UPDATE daily_expenses SET "wishlistId"='${wl}' WHERE id='${dayId}'`);
r = await call('GET', `/api/daily-expenses/${pocket}?date=${dateIn(MP, MP.days)}`);
check('sweep moved the remaining money, next day starts without carry-over', r.data.startAmount === sp, r.data);
r = await call('GET', `/api/wishlists/${wl}`);
check('wishlist received the remaining money', r.data.currentAmount === remaining, { ...r.data, expected: remaining });
r = await call('GET', `/api/wishlists`);
r = await call('GET', `/api/wishlists/${wl}`);
check('swept only once', r.data.currentAmount === remaining, r.data);
await call('DELETE', `/api/accounts/${acc}`);

await db.end();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
