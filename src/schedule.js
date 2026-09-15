// Pure reader shared by Apps Script and tests. Source spreadsheets are never changed.
export const Schedule = (() => {
  const extensions = ['periods', 'dutyTeacher'];
  const infoFields = ['id', 'termId', 'classId', 'title', 'goal', 'activities', 'teacherNotes'];
  const str = value => value == null ? '' : String(value).trim();
  const clean = value => str(value).replace(/[：]/g, ':').replace(/[／]/g, '/').replace(/[～–—]/g, '~');
  const ensure = (ok, message) => { if (!ok) throw new Error(message); };
  const empty = row => row.every(value => !str(value));
  function date(value) {
    if (typeof value === 'number') {
      ensure(Number.isFinite(value) && value > 0 && value < 2958466, '日期數值不正確');
      value = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
    }
    const match = clean(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    ensure(match, '日期需為試算表日期儲存格或完整 YYYY-MM-DD，不能只有月日');
    const iso = match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
    const parsed = new Date(iso + 'T12:00:00Z');
    ensure(!isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso, '日期不存在');
    return iso;
  }
  function time(value) {
    if (typeof value === 'number') {
      ensure(value >= 0 && value < 1, '時間數值不正確');
      const minutes = Math.round(value * 1440);
      value = Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0');
    }
    const match = clean(value).match(/^(\d{1,2}):(\d{2})$/);
    ensure(match && +match[1] < 24 && +match[2] < 60, '時間需為 HH:mm');
    return match[1].padStart(2, '0') + ':' + match[2];
  }
  function periods(value) {
    if (!value) return [];
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { throw new Error('periods 必須是 JSON 陣列'); }
    }
    ensure(Array.isArray(value) && value.length <= 12, 'periods 格式不正確');
    return value.map(item => {
      ensure(item && typeof item === 'object', '課程時段格式不正確');
      const result = {};
      ['label', 'title', 'teacher', 'teacherLabel'].forEach(key => { result[key] = str(item[key]); });
      ensure(result.label, '課程時段缺少名稱');
      result.startTime = time(item.startTime); result.endTime = time(item.endTime);
      ensure(result.startTime < result.endTime, '課程結束時間須晚於開始時間');
      return result;
    });
  }
  function canonical(values, fields) {
    ensure(Array.isArray(fields), '課表欄位定義遺失');
    const header = values[0].map(str), extras = header.slice(fields.length);
    ensure(JSON.stringify(header.slice(0, fields.length)) === JSON.stringify(fields) &&
      extras.every(key => extensions.includes(key)) && new Set(header).size === header.length,
    'Courses 第一列欄位已變更，請依範本恢復');
    const seen = new Set();
    const courses = values.slice(1).flatMap((values, index) => {
      if (empty(values)) return [];
      const course = {};
      header.forEach((key, column) => { course[key] = key === 'periods' ? periods(values[column]) : str(values[column]); });
      ensure(course.id && !seen.has(course.id), 'Courses 第 ' + (index + 2) + ' 列缺少或重複 id'); seen.add(course.id);
      ensure(course.termId && course.classId, 'Courses 缺少學期或班級代碼');
      course.date = date(values[header.indexOf('date')]);
      course.startTime = time(values[header.indexOf('startTime')]); course.endTime = time(values[header.indexOf('endTime')]);
      ensure(course.startTime < course.endTime, '課程結束時間須晚於開始時間');
      ensure(['normal', 'cancelled'].includes(course.status), '課程狀態需為 normal 或 cancelled');
      ensure(!course.resourceUrl || /^https:\/\/[^\s]+$/i.test(course.resourceUrl), '教材連結必須以 https:// 開頭');
      return [course];
    });
    return {Courses: courses, ScheduleInfo: []};
  }
  function parse(values, merges = [], options = {}, fields) {
    ensure(Array.isArray(values) && values.length, '課表沒有內容');
    if (str(values[0]?.[0]) === 'id') return canonical(values, fields);
    ensure(options.termId && options.classId && options.namespace,
      '中文課表需設定 SCHEDULE_TERM_ID、SCHEDULE_CLASS_ID 與來源識別');
    const headerIndex = values.findIndex(row => row.some(cell => str(cell) === '日期'));
    ensure(headerIndex >= 0, '找不到中文課表的「日期」表頭');
    const header = values[headerIndex].map(clean);
    const column = label => header.findIndex(cell => cell === label);
    const dateColumn = column('日期'), dutyColumn = column('值星'), notesColumn = column('備註'), idColumn = column('課程ID');
    const definitions = [
      {label: '詩頌', heading: '詩頌課', teacher: '詩頌/司琴', teacherLabel: '詩頌／司琴'},
      {label: '崇拜', heading: '崇拜課', teacher: '崇拜課教員', teacherLabel: '教員'},
      {label: '共習', heading: '共習課', teacher: '共習課教員', teacherLabel: '教員'}
    ].map(definition => {
      const col = header.findIndex(cell => cell.startsWith(definition.heading) && /\d/.test(cell));
      const match = header[col]?.match(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/);
      ensure(col >= 0 && match && column(definition.teacher) >= 0, '找不到「' + definition.heading + '」時間或教員表頭');
      const startTime = time(match[1]), endTime = time(match[2]);
      ensure(startTime < endTime, '課表時段的結束時間須晚於開始時間');
      return {...definition, col, teacherCol: column(definition.teacher), startTime, endTime};
    });
    ensure(definitions.every((item, i) => !i || definitions[i - 1].endTime <= item.startTime), '課表時段重疊');
    const footerWidth = Math.max(dateColumn, dutyColumn, notesColumn, ...definitions.map(item => item.teacherCol)) + 1;
    const info = {id: options.namespace, termId: options.termId, classId: options.classId,
      title: values.slice(0, headerIndex).flat().map(str).filter(Boolean).join('\n'), goal: '', activities: '', teacherNotes: ''};
    const seen = new Set(), courses = [];
    values.slice(headerIndex + 1).forEach((row, offset) => {
      if (empty(row)) return;
      const rowIndex = headerIndex + 1 + offset, first = clean(row[dateColumn]);
      if (/^本季目標\s*:/.test(first)) { info.goal += (info.goal ? '\n' : '') + str(row[dateColumn]).replace(/^本季目標\s*[:：]\s*/, ''); return; }
      if (/^本季活動\s*:/.test(first)) { info.activities += (info.activities ? '\n' : '') + str(row[dateColumn]).replace(/^本季活動\s*[:：]\s*/, ''); return; }
      const footer = merges.some(m => (m.startRowIndex || 0) === rowIndex && (m.startColumnIndex || 0) === dateColumn && m.endColumnIndex >= footerWidth);
      if (footer && row.filter(cell => str(cell)).length === 1 && !/^\d{4}[-/]/.test(first) && typeof row[dateColumn] !== 'number') {
        info.teacherNotes += (info.teacherNotes ? '\n' : '') + str(row[dateColumn]); return;
      }
      let courseDate;
      try { courseDate = date(row[dateColumn]); } catch (error) { throw new Error('課表第 ' + (rowIndex + 1) + ' 列：' + error.message); }
      const explicitId = idColumn >= 0 ? str(row[idColumn]) : '';
      const id = explicitId || 'sheet_' + options.namespace + '_' + courseDate;
      ensure(!seen.has(id), '課表有重複日期或課程 ID：' + courseDate + '；同日多次聚會請填不同課程ID'); seen.add(id);
      const groups = [];
      definitions.forEach(definition => {
        const merge = merges.find(m => rowIndex >= (m.startRowIndex || 0) && rowIndex < m.endRowIndex && definition.col >= (m.startColumnIndex || 0) && definition.col < m.endColumnIndex);
        if (merge) ensure(merge.endRowIndex === rowIndex + 1 && (merge.startRowIndex || 0) === rowIndex, '課程第 ' + (rowIndex + 1) + ' 列不支援跨日期的直向合併');
        const anchor = merge ? (merge.startColumnIndex || 0) : definition.col;
        let group = groups.find(item => item.anchor === anchor);
        if (!group) { group = {anchor, members: []}; groups.push(group); }
        group.members.push(definition);
      });
      const coursePeriods = groups.map(group => {
        const first = group.members[0], last = group.members[group.members.length - 1];
        return {label: group.members.map(item => item.label).join('／'), title: str(row[group.anchor]),
          startTime: first.startTime, endTime: last.endTime, teacher: str(row[last.teacherCol]),
          teacherLabel: group.members.length > 1 ? '教員' : first.teacherLabel};
      });
      const worship = coursePeriods.find(item => item.label.includes('崇拜'));
      const music = coursePeriods.find(item => item.label === '詩頌');
      courses.push({id, termId: options.termId, classId: options.classId, date: courseDate,
        startTime: definitions[0].startTime, endTime: definitions[definitions.length - 1].endTime,
        title: worship?.title || coursePeriods.find(item => item.title)?.title || '課程待安排',
        scripture: '', verse: '', song: music?.title || '',
        teacher: [...new Set(coursePeriods.map(item => item.teacher).filter(Boolean))].join('、'),
        materials: '', notes: notesColumn >= 0 ? str(row[notesColumn]) : '', status: 'normal', resourceUrl: '',
        periods: coursePeriods, dutyTeacher: dutyColumn >= 0 ? str(row[dutyColumn]) : ''});
    });
    return {Courses: courses, ScheduleInfo: [info]};
  }
  function searchText(course) {
    return [course.title, course.scripture, course.teacher, course.dutyTeacher,
      ...(course.periods || []).flatMap(item => [item.label, item.title, item.teacher])].filter(Boolean).join(' ');
  }
  function reminder(course, className, formattedDate) {
    const lines = ['平安，' + className + '上課提醒', '日期：' + formattedDate, '時間：' + course.startTime + '–' + course.endTime];
    if (course.periods?.length) course.periods.forEach(item => lines.push(item.label + ' ' + item.startTime + '–' + item.endTime + '｜' + (item.title || '尚未安排') + (item.teacher ? '（' + item.teacherLabel + '：' + item.teacher + '）' : '')));
    else lines.push('課程：' + course.title);
    if (course.dutyTeacher) lines.push('值星：' + course.dutyTeacher);
    if (course.scripture) lines.push('經文：' + course.scripture);
    if (course.materials) lines.push('攜帶物品：' + course.materials);
    if (course.notes) lines.push(course.notes);
    return lines.join('\n');
  }
  return {extensions, infoFields, parse, date, time, periods, searchText, reminder};
})();
