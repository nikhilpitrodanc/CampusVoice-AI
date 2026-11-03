import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/process.js';

function invoke(body) {
  const res = { statusCode:200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  return Promise.resolve(handler({method:'POST',headers:{},body},res)).then(()=>res);
}

test('spoken complaint creates a real API insert and replies with saved ticket ID', async () => {
  const oldFetch = global.fetch;
  const oldEnv = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, SUPABASE_URL:process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.GEMINI_API_KEY='test-key';process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-db-key';
  const calls=[];
  global.fetch = async (url,options) => {
    calls.push({url,options});
    if(url.includes('generativelanguage')) return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({intent:'create_ticket',lang:'en',ticket:{category:'maintenance',location:'B204',priority:'high',description:'The classroom AC is broken'},reply:''})}]}}]})};
    return {ok:true,json:async()=>[{id:'abc',ticket_number:1001,department:'Facilities',location:'B204',priority:'high'}]};
  };
  try {
    const response=await invoke({text:'AC is broken in B204 and I have an exam today'});
    assert.equal(response.statusCode,201);
    assert.equal(response.payload.ok,true);
    assert.match(response.payload.reply,/CV-1001/);
    assert.equal(calls.length,2);
    const savedBody=JSON.parse(calls[1].options.body);
    assert.equal(savedBody.department,'Facilities');
    assert.equal(savedBody.raw_text,'AC is broken in B204 and I have an exam today');
    assert.equal(calls[1].options.headers.Authorization,'Bearer test-db-key');
  } finally {
    global.fetch=oldFetch;
    for(const [key,value] of Object.entries(oldEnv)) if(value===undefined) delete process.env[key]; else process.env[key]=value;
  }
});

test('without access code, a configured guarded endpoint rejects requests', async () => {
  const previous=process.env.DEMO_ACCESS_CODE;
  process.env.DEMO_ACCESS_CODE='demo-secret';
  try { const response=await invoke({text:'Create a ticket'});assert.equal(response.statusCode,401); }
  finally { if(previous===undefined)delete process.env.DEMO_ACCESS_CODE;else process.env.DEMO_ACCESS_CODE=previous; }
});
