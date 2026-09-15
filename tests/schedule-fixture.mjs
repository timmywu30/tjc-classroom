// All names and course content in this fixture are fictional.
export function scheduleFixture() {
  return {
    values: [
      ['測試幼年班・第一季'],
      ['日期','詩頌課\n10:00~10:20','詩頌/司琴','崇拜課\n10:30~11:00','崇拜課教員','共習課\n11:05~11:25','共習課教員','值星','備註'],
      [46270,'合班開學課','','','甲教員','認識同伴','乙教員','丙教員',''],
      [46277,'感恩詩歌','甲教員/乙司琴','學習感恩','丙教員','感恩小卡','丁教員','戊教員','請準時'],
      [46285,'複習詩歌','乙教員/甲司琴','聯合分享','','','丙教員','丁教員',''],
      ['本季目標：學習感恩\n一起關心身邊的人。'],
      ['本季活動：\n家長交流 9／20 15：30～16：00'],
      ['1、教員請確認分工。']
    ],
    merges: [
      {startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:9},
      {startRowIndex:2,endRowIndex:3,startColumnIndex:1,endColumnIndex:4},
      {startRowIndex:4,endRowIndex:5,startColumnIndex:3,endColumnIndex:6},
      ...[5,6,7].map(i=>({startRowIndex:i,endRowIndex:i+1,startColumnIndex:0,endColumnIndex:9}))
    ]
  };
}
export const scheduleOptions={termId:'term_115_1',classId:'children',namespace:'fixture'};
