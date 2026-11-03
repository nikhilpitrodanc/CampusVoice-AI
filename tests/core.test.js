import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTicket, ticketLabel, validateIntent } from '../lib/core.js';

test('normalizes category and priority', () => {
  assert.deepEqual(cleanTicket({ category:'unknown', priority:'critical', location:' B204 ', description:' AC stopped working ' }), { category:'other', priority:'medium', location:'B204', description:'AC stopped working', department:'Student Help Desk' });
});
test('requires a real location', () => assert.throws(() => cleanTicket({description:'Broken classroom fan'})));
test('ticket numbering', () => assert.equal(ticketLabel({ ticket_number: 8 }), 'CV-0008'));
test('rejects unsupported intent', () => assert.equal(validateIntent({intent:'delete_everything'}).intent, 'unknown'));
test('identifies Hindi, Gujarati and count requests', () => {
  assert.equal(validateIntent({intent:'count_open',lang:'hi'}).lang,'hi');
  assert.equal(validateIntent({intent:'check_ticket',lang:'gu',ticketNumber:1001}).ticketNumber,1001);
});
test('rejects null ticket number', () => assert.equal(validateIntent({intent:'check_ticket',ticketNumber:null}).ticketNumber,null));
