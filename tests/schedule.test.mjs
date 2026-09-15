import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Schedule} from '../src/schedule.js';
import {Domain} from '../src/domain.js';
import {makeDemo} from '../src/demo.js';
import {scheduleFixture,scheduleOptions} from './schedule-fixture.mjs';
const parse=fixture=>Schedule.parse(fixture.values,fixture.merges,scheduleOptions,Domain.courseFields);

test('weekly grid keeps horizontal merged periods, their full times and assigned teachers',()=>{
  const {Courses:c,ScheduleInfo:[info]}=parse(scheduleFixture());
  assert.equal(c.length,3);assert.deepEqual(c.map(c=>c.date),['2026-09-05','2026-09-12','2026-09-20']);
  assert.deepEqual(c[0].periods,[
    {label:'詩頌／崇拜',title:'合班開學課',startTime:'10:00',endTime:'11:00',teacher:'甲教員',teacherLabel:'教員'},
    {label:'共習',title:'認識同伴',startTime:'11:05',endTime:'11:25',teacher:'乙教員',teacherLabel:'教員'}
  ]);
  assert.equal(c[1].periods.length,3);assert.equal(c[1].periods[0].teacherLabel,'詩頌／司琴');
  assert.equal(c[1].dutyTeacher,'戊教員');assert.equal(c[1].notes,'請準時');
  assert.equal(c[2].periods[1].label,'崇拜／共習');assert.equal(c[2].periods[1].endTime,'11:25');
  assert.equal(c[2].periods[1].teacher,'丙教員');assert.equal(new Date(c[2].date).getUTCDay(),0);
  assert.equal(info.goal,'學習感恩\n一起關心身邊的人。');
  assert.equal(info.activities,'家長交流 9／20 15：30～16：00');assert.equal(info.teacherNotes,'1、教員請確認分工。');
  assert.equal(c[0].song,'');assert.equal(c[1].scripture,'');assert.equal(c[1].verse,'');assert.equal(c[1].materials,'');
});

test('blank rows and title edits keep course IDs stable; duplicates and ambiguous dates fail',()=>{
  const fixture=scheduleFixture(),original=parse(fixture);
  fixture.values.splice(2,0,[]);fixture.merges=fixture.merges.map(m=>m.startRowIndex>=2?{...m,startRowIndex:m.startRowIndex+1,endRowIndex:m.endRowIndex+1}:m);
  fixture.values[3][1]='修訂主題';
  assert.deepEqual(parse(fixture).Courses.map(c=>c.id),original.Courses.map(c=>c.id));
  fixture.values[4][0]=fixture.values[3][0];assert.throws(()=>parse(fixture),/重複日期/);
  const ambiguous=scheduleFixture();ambiguous.values[3][0]='9/12';assert.throws(()=>parse(ambiguous),/第 4 列.*完整 YYYY-MM-DD/);
  assert.throws(()=>Schedule.date('2026-02-30'),/不存在/);
  assert.throws(()=>Schedule.parse(ambiguous.values,ambiguous.merges,{}),/SCHEDULE_TERM_ID/);
});

test('explicit IDs support same-day separate gatherings; cross-date merges and invalid times fail',()=>{
  const fixture=scheduleFixture();fixture.values[1].push('課程ID');fixture.values[2][9]='gathering-1';fixture.values[3][9]='gathering-2';fixture.values[3][0]=fixture.values[2][0];
  assert.deepEqual(parse(fixture).Courses.slice(0,2).map(c=>c.id),['gathering-1','gathering-2']);
  const vertical=scheduleFixture();vertical.merges[1].endRowIndex=4;assert.throws(()=>parse(vertical),/跨日期/);
  const invalid=scheduleFixture();invalid.values[1][1]='詩頌課\n10:00~09:00';assert.throws(()=>parse(invalid),/結束時間/);
});

test('canonical courses remain compatible and extended backup fields round-trip without data loss',()=>{
  const course=makeDemo().Courses[0],fields=Domain.courseFields;
  const base=Schedule.parse([fields,fields.map(k=>course[k])],[],{},fields).Courses[0];
  assert.equal(base.id,course.id);assert.equal(base.title,course.title);assert.equal(base.date,course.date);
  const fixture=parse(scheduleFixture()),extended=fields.concat(Schedule.extensions);
  const rows=[extended,...fixture.Courses.map(c=>extended.map(k=>typeof c[k]==='object'?JSON.stringify(c[k]):c[k]))];
  assert.deepEqual(Schedule.parse(rows,[],{},fields).Courses,fixture.Courses);
  rows[1][extended.indexOf('periods')]='{"invalid":true}';assert.throws(()=>Schedule.parse(rows,[],{},fields),/periods/);
});

test('season details are class-scoped and teacher instructions never reach parent payloads',()=>{
  const db=makeDemo(),info=parse(scheduleFixture()).ScheduleInfo[0];
  db.ScheduleInfo=[info,{...info,id:'other-season',classId:'other',title:'其他班私人資訊'}];
  const parent=Domain.project(db,'parent_a'),teacher=Domain.project(db,'teacher');
  assert.equal(parent.ScheduleInfo.length,1);assert.equal(parent.ScheduleInfo[0].goal,info.goal);
  assert.equal(Object.hasOwn(parent.ScheduleInfo[0],'teacherNotes'),false);
  assert.equal(teacher.ScheduleInfo.length,1);assert.equal(teacher.ScheduleInfo[0].teacherNotes,info.teacherNotes);
  assert.equal(JSON.stringify(parent).includes('其他班私人資訊'),false);
});

test('three teaching periods share one attendance event and repeat attendance cannot triple points',()=>{
  const db=makeDemo();Object.assign(db,parse(scheduleFixture()));
  const courseId=db.Courses[1].id,payload={courseId,records:[{studentId:'s1',status:'present'}]};
  const before=Domain.points(db,'s1','term_115_1');
  const first=Domain.execute(db,'teacher','attendance',payload,{id:'schedule_test_first',now:'2026-09-12T02:00:00Z'}).db;
  const second=Domain.execute(first,'teacher','attendance',payload,{id:'schedule_test_second',now:'2026-09-12T02:01:00Z'}).db;
  assert.equal(second.Attendance.filter(a=>a.courseId===courseId&&a.studentId==='s1').length,1);
  assert.equal(Domain.points(second,'s1','term_115_1')-before,5);
});

test('reminders include periods and duty without inventing absent fields; search covers practice topics',()=>{
  const c=parse(scheduleFixture()).Courses[1],text=Schedule.reminder(c,'幼年班','9月12日（週六）');
  assert.match(text,/詩頌 10:00–10:20/);assert.match(text,/共習 11:05–11:25｜感恩小卡/);assert.match(text,/值星：戊教員/);
  assert.equal(text.includes('經文：'),false);assert.equal(text.includes('攜帶物品：'),false);
  assert.match(Schedule.searchText(c),/感恩小卡/);assert.match(Schedule.searchText(c),/戊教員/);
});

test('Apps Script uses the exact tested schedule parser',()=>{
  const source=readFileSync(new URL('../src/schedule.js',import.meta.url),'utf8').replace('export const Schedule','var Schedule');
  assert.equal(readFileSync(new URL('../apps-script/Schedule.gs',import.meta.url),'utf8'),source);
});
