import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {additionalIntakeServices} from '../lib/intake-service-selection.mjs';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db=new PGlite();
const buyer='00000000-0000-0000-0000-000000000001';
const request='00000000-0000-0000-0000-000000000002';
const read=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema app_private;
    create function auth.uid() returns uuid language sql stable as $$select '${buyer}'::uuid$$;
    create function app_private.has_role(text) returns boolean language sql stable as $$select $1='buyer'$$;
    create function app_private.has_admin_permission(text) returns boolean language sql stable as $$select false$$;
    create table profiles(id uuid primary key);insert into profiles values('${buyer}');
    create table service_categories(id uuid primary key,name text,slug text,description text,icon_key text,sort_order int,active boolean,updated_at timestamptz);
    create table services(id uuid primary key,category_id uuid,name text,slug text,description text,pricing_unit text,risk_level text,active boolean,updated_at timestamptz);
    create table booking_requests(id uuid primary key,buyer_id uuid,service_id uuid);
    insert into booking_requests values('${request}','${buyer}',null);
    create function app_private.create_care_request(jsonb) returns jsonb language sql as $$select jsonb_build_object('request_id','${request}')$$;
  `);
  for(const services of Object.values(additionalIntakeServices))for(const s of services)await db.query('insert into services(id,name,active) values($1,$2,true)',[s.serviceId,s.name]);
  await db.exec(await read('20260824163431_care_category_intake_templates.sql'));
  await db.exec(`insert into booking_request_intake_answers values('${request}','${buyer}','adult_care','companion','{"qa":"old answer"}','{}',now())`);
  const before=(await db.query('select * from booking_request_intake_answers')).rows;
  const migration=await read('20261006050000_preserve_clinical_request_services.sql');
  await db.exec(migration);
  await check('historical adult-care answers remain unchanged',async()=>assert.deepEqual((await db.query('select * from booking_request_intake_answers')).rows,before));
  await check('category label matches public Home healthcare without changing the key',async()=>assert.equal((await db.query("select name from care_intake_categories where code='adult_care'")).rows[0].name,'Home healthcare'));
  for(const [category,services] of Object.entries(additionalIntakeServices))for(const service of services){
    await check(service.name+' mapping matches the UI and attaches via guarded public wrapper',async()=>{
      const rows=(await db.query('select * from care_intake_subcategories where service_id=$1',[service.serviceId])).rows;
      assert.equal(rows.length,1);assert.equal(rows[0].code,service.code);assert.equal(rows[0].category_code,category);assert.equal(rows[0].active,true);
      await db.exec('delete from booking_request_intake_answers;set role authenticated');
      await db.query('select public.create_care_request($1)',[JSON.stringify({service_id:service.serviceId,category_code:category,subcategory_code:service.code})]);
      await db.exec('reset role');
      const saved=(await db.query('select category_code,subcategory_code from booking_request_intake_answers')).rows[0];
      assert.deepEqual(saved,{category_code:category,subcategory_code:service.code});
    });
  }
  await check('nursing cannot be submitted as companion care',async()=>{
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.create_care_request($1)',[JSON.stringify({service_id:additionalIntakeServices.adult_care[0].serviceId,category_code:'adult_care',subcategory_code:'companion'})]),/invalid_care_category_service/);
    await db.exec('reset role');
  });
  await check('reapplying migration preserves all mappings and administrative deactivation',async()=>{
    await db.exec("update care_intake_subcategories set active=false where code='home_nursing'");
    await db.exec(migration);
    assert.equal((await db.query('select count(*)::int n from care_intake_subcategories')).rows[0].n,30);
    assert.equal((await db.query("select active from care_intake_subcategories where code='home_nursing'")).rows[0].active,false);
  });
  await check('anonymous catalogue cannot mutate service mappings',async()=>{
    await db.exec('set role anon');
    await assert.rejects(db.exec("update care_intake_subcategories set service_id='21000000-0000-0000-0000-000000000002' where code='companion'"),/permission denied/);
    await db.exec('reset role');
  });
  console.log(`${checks} intake-service SQL checks passed; isolated PostgreSQL fixture, not connected UI coverage.`);
}catch(error){console.error(error);process.exitCode=1;}finally{await db.close();}
