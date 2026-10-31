import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHistoryCsv } from '../src/history/validate.ts';
import { ValidationError } from '../../contracts/model.ts';
const header = 'label,visits,orders,revenue_dong,voucher_spend_dong';
const parse = (rows: string) => validateHistoryCsv({ csv: `${header}\n${rows}` });

test('CSV aggregate import preserves explicit zero and marks user-reported observational evidence', () => {
  const history = parse('11.11,1000,100,29900000,2000000\nControl,0,0,0,0');
  assert.equal(history.source, 'user_reported');
  assert.equal(history.campaigns.length, 2);
  assert.deepEqual(history.campaigns[1], {
    label: 'Control',
    visits: 0,
    orders: 0,
    revenue_dong: 0,
    voucher_spend_dong: 0,
  });
});
test('CSV accepts BOM, CRLF, quoted commas and escaped quotes', () => {
  const history = validateHistoryCsv({
    csv: `\uFEFF${header}\r\n"Sale, ""A""",100,10,2000000,50000\r\n`,
  });
  assert.equal(history.campaigns[0]!.label, 'Sale, "A"');
});
test('CSV rejects missing cells, empty fields, malformed quoting and wrong headers', () => {
  for (const csv of [
    header,
    `${header}\nSale,100,,200,0`,
    `${header}\nSale,100,10,200`,
    `${header}\n"Unclosed,100,10,200,0`,
    `${header}\n\nSale,100,10,200,0`,
    `${header}\nSale,100,10,200,0,extra`,
    `${header.replace('visits', 'visitors')}\nSale,100,10,200,0`,
  ])
    assert.throws(() => validateHistoryCsv({ csv }), ValidationError, csv);
});
test('CSV rejects duplicate labels with whitespace, Unicode or case variation', () => {
  assert.throws(() => parse('Sale,100,10,200,0\n sale ,100,10,200,0'), /duplicate/);
  assert.throws(() => parse('Đợt,100,10,200,0\nĐợt,100,10,200,0'), /duplicate/);
});
test('CSV validates integer units, safe bounds and visits/orders consistency', () => {
  for (const row of [
    'Sale,10,11,200,0',
    'Sale,-1,0,0,0',
    'Sale,1.5,0,0,0',
    'Sale,1e3,0,0,0',
    'Sale,01,0,0,0',
    'Sale,100,10,9007199254740993,0',
    'Sale,100000001,1,0,0',
    'Sale,100,10,1000000000001,0',
    'Sale,100,10, 200,0',
  ])
    assert.throws(() => parse(row), ValidationError, row);
});
test('CSV row/byte bounds and unsafe labels fail before context reaches a model', () => {
  assert.throws(
    () => parse(Array.from({ length: 21 }, (_, i) => `Sale${i},100,10,200,0`).join('\n')),
    ValidationError,
  );
  assert.throws(
    () => validateHistoryCsv({ csv: `${header}\n${'đ'.repeat(17000)},1,1,1,0` }),
    ValidationError,
  );
  for (const label of ['', '=SUM(A1)', '+cmd', '@cmd', '-1', 'A\u0000B'])
    assert.throws(() => parse(`${label},100,10,200,0`), ValidationError, label);
  for (const body of [null, [], {}, 'csv', { csv: '', other: 1 }, { csv: 42 }])
    assert.throws(() => validateHistoryCsv(body), ValidationError);
});
test('shipped CSV template is only a header, with no synthetic performance evidence', () => {
  const csv = readFileSync(new URL('../../data/history-template.csv', import.meta.url), 'utf8');
  assert.equal(csv.trim(), header);
  assert.throws(() => validateHistoryCsv({ csv }), ValidationError);
});
