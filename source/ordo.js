
/* BEGIN SCRIPTORIUM ORDO 1962 — which Mass belongs to a given date under the 1962 rubrics (simplified). */
(() => {
  'use strict';
  const DAY = 864e5;
  const dn = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);          // day number, free of time zones
  const dow = t => ((t + 4) % 7 + 7) % 7;                                    // 0 = Sunday
  const ymd = t => { const d = new Date(t * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  const nth = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function easter(y) {   // Gregorian computus
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return dn(y, month, day);
  }
  const sundayBefore = t => t - (dow(t) || 7);                              // the Sunday strictly before t

  // The temporal day: { title (as in the day list), cls (1–4), sunday, feria (true when it borrows a Sunday's Mass), of }
  function temporal(t) {
    const [y, m, d] = ymd(t), w = dow(t), E = easter(y);
    const christmas = dn(y, 12, 25), adv4 = sundayBefore(christmas), adv1 = adv4 - 21;
    const feria = (sundayTitle, cls, note) => ({ title: `${WEEKDAY[w]} after the ${sundayTitle.replace(/^(\d\w\w) Sunday of (\w+)$/, '$1 Sunday of $2')}`.replace('after the Ascension', 'after the Ascension').replace(/after the (Septuagesima|Sexagesima|Quinquagesima|Holy Family|Low Sunday|Ascension)/, 'after $1'), mass: sundayTitle, cls, feria: true, note: note || `The Mass of the preceding Sunday, ${sundayTitle}, is said on ferias.` });
    // Advent and Christmas Eve
    if (t >= adv1 && t < christmas) {
      if (m === 12 && d === 24) return { title: 'Christmas Eve', cls: 1 };
      const week = Math.floor((t - adv1) / 7) + 1, sun = `${nth(week)} Sunday of Advent`;
      if (w === 0) return { title: sun, cls: 1, sunday: true };
      if (week === 3 && [3, 5, 6].includes(w)) return { title: `Ember ${WEEKDAY[w]} of Advent`, cls: 2 };
      return feria(sun, m === 12 && d >= 17 ? 2 : 3);
    }
    if (m === 12 && d >= 25) {
      if (d === 25) return { title: 'Christmas Day', cls: 1 };
      const sunday = [26, 27, 28, 29, 30, 31].find(x => dow(dn(y, 12, x)) === 0);
      const octaveSunday = sunday && sunday >= 29 ? sunday : sunday ? 30 : null;   // a Sunday on 26–28 Dec moves to the 30th
      if (d === octaveSunday) return { title: 'Sunday within the Octave of Christmas', cls: 2, sunday: w === 0 };
      if (d === 29) return { title: 'Fifth Day within the Octave of Christmas', cls: 2 };
      return { title: `${d} December (within the Octave of Christmas)`, cls: 2, octave: true };
    }
    if (m === 1 && d <= 13) {
      if (d === 1) return { title: 'Octave Day of Christmas', cls: 1 };
      const holyName = [2, 3, 4, 5].find(x => dow(dn(y, 1, x)) === 0) || 2;
      if (d === holyName) return { title: 'Holy Name of Jesus', cls: 2, sunday: w === 0 };
      if (d <= 5) return { title: 'Weekdays 2–5 January', cls: 4 };
      if (d === 6) return { title: 'Epiphany', cls: 1 };
      const holyFamily = [7, 8, 9, 10, 11, 12, 13].find(x => dow(dn(y, 1, x)) === 0);
      if (d === holyFamily) return { title: 'Holy Family', cls: 2, sunday: true };
      if (d === 13) return { title: 'Baptism of Our Lord', cls: 2 };
      return { title: d < holyFamily ? 'Weekdays 7–12 January' : 'Weekdays 7–12 January after the Holy Family', cls: 2 };
    }
    // After Epiphany, to Septuagesima
    const septuagesima = E - 63;
    if (t < septuagesima) {
      const holyFamily = dn(y, 1, [7, 8, 9, 10, 11, 12, 13].find(x => dow(dn(y, 1, x)) === 0));
      const n = Math.floor((t - holyFamily) / 7) + 1, sun = n === 1 ? 'Holy Family' : `${nth(n)} Sunday after Epiphany`;
      return w === 0 ? { title: sun, cls: 2, sunday: true } : feria(sun, 4);
    }
    // Septuagesima to Ash Wednesday
    if (t < E - 46) {
      const k = Math.floor((t - septuagesima) / 7), sun = ['Septuagesima', 'Sexagesima', 'Quinquagesima'][k];
      return w === 0 ? { title: sun, cls: 2, sunday: true } : feria(sun, 4);
    }
    if (t < E - 42) return { title: t === E - 46 ? 'Ash Wednesday' : `${WEEKDAY[w]} after Ash Wednesday`, cls: t === E - 46 ? 1 : 3 };
    // Lent
    if (t < E - 14) {
      const week = Math.floor((t - (E - 42)) / 7) + 1;
      if (w === 0) return { title: `${nth(week)} Sunday of Lent`, cls: 1, sunday: true };
      if (week === 1 && [3, 5, 6].includes(w)) return { title: `Ember ${WEEKDAY[w]} of Lent`, cls: 2 };
      return { title: `${WEEKDAY[w]} of the ${nth(week)} week of Lent`, cls: 3 };
    }
    if (t < E - 7) return w === 0 ? { title: 'Passion Sunday', cls: 1, sunday: true } : { title: `${WEEKDAY[w]} in Passion Week`, cls: 3 };
    if (t < E) return { title: ['Palm Sunday', 'Monday in Holy Week', 'Tuesday in Holy Week', 'Wednesday in Holy Week', 'Maundy Thursday', 'Good Friday', 'Easter Vigil'][t - (E - 7)], cls: 1, sunday: w === 0 };
    // Eastertide
    if (t < E + 7) return { title: t === E ? 'Easter Sunday' : `Easter ${WEEKDAY[w]}`, cls: 1, sunday: w === 0 };
    if (t === E + 7) return { title: 'Low Sunday', cls: 1, sunday: true };
    if (t < E + 36) {
      const n = Math.floor((t - E) / 7), sun = n === 1 ? 'Low Sunday' : `${nth(n)} Sunday after Easter`;
      return w === 0 ? { title: sun, cls: 2, sunday: true } : feria(sun, 4);
    }
    if (t === E + 36) return { title: 'Rogation Days', cls: 2, note: 'Rogation Monday.' };
    if (t === E + 37) return { title: 'Rogation Days', cls: 4, note: 'Rogation Tuesday.', feria: true, mass: '5th Sunday after Easter' };
    if (t === E + 38) return { title: 'Vigil of Ascension', cls: 2 };
    if (t === E + 39) return { title: 'Ascension', cls: 1 };
    if (t < E + 49) {
      if (t === E + 48) return { title: 'Vigil of Pentecost', cls: 1 };
      return w === 0 ? { title: 'Sunday after Ascension', cls: 2, sunday: true } : feria(t < E + 42 ? 'Ascension' : 'Sunday after Ascension', 4, t < E + 42 ? 'The Mass of the Ascension is said on these ferias.' : undefined);
    }
    if (t < E + 56) return { title: ['Pentecost', 'Pentecost Monday', 'Pentecost Tuesday', 'Ember Wednesday of Pentecost', 'Pentecost Thursday', 'Ember Friday of Pentecost', 'Ember Saturday of Pentecost'][t - (E + 49)], cls: 1, sunday: w === 0 };
    // Time after Pentecost
    if (t === E + 56) return { title: 'Trinity Sunday', cls: 1, sunday: true };
    if (t === E + 60) return { title: 'Corpus Christi', cls: 1 };
    if (t === E + 68) return { title: 'Sacred Heart of Jesus', cls: 1 };
    const nextAdvent = sundayBefore(dn(y, 12, 25)) - 21;
    const lastSunday = nextAdvent - 7, n = Math.floor((t - (E + 49)) / 7);
    const lastN = Math.floor((lastSunday - (E + 49)) / 7);
    const sept = (() => { const first = [1, 2, 3, 4, 5, 6, 7].find(x => dow(dn(y, 9, x)) === 0); return dn(y, 9, first + 14); })();
    if (t === sept + 3 || t === sept + 5 || t === sept + 6) return { title: `Ember ${WEEKDAY[w]} of September`, cls: 2 };
    const octoberLast = (() => { for (let x = 31; ; x--) if (dow(dn(y, 10, x)) === 0) return dn(y, 10, x); })();
    if (t === octoberLast) return { title: 'Christ the King', cls: 1, sunday: true };
    const sundayName = k => {
      if (k === 1) return '1st Sunday after Pentecost';
      if (E + 49 + 7 * k === lastSunday) return 'Last Sunday after Pentecost';
      if (k >= 24) return `${nth(7 - (lastN - k))} Sunday after Epiphany`;   // the Sundays left over after Epiphany are resumed here
      return `${nth(k)} Sunday after Pentecost`;
    };
    if (w === 0) return { title: sundayName(n), cls: 2, sunday: true };
    return feria(n === 1 ? '1st Sunday after Pentecost' : sundayName(n), 4, n === 1 ? 'In 1962 the Mass of the 1st Sunday after Pentecost is said on these ferias.' : undefined);
  }

  // Feasts for a date (St. Matthias moves to 25 February in a leap year).
  function feastsOn(days, y, m, d) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return days.filter(x => x.cycle === 'sanctoral').filter(x => {
      let [mm, dd] = x.sort;
      if (leap && mm === 2 && dd >= 24 && /Matthias/.test(x.title)) dd += 1;
      return mm === m && dd === d;
    });
  }
  const LORD = /Transfiguration|Holy Cross|Candlemas|Precious Blood|Holy Name/;

  // Decide the Mass of the day and the commemorations (simplified 1962 table of precedence).
  function forDate(data, date) {
    const t = dn(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const [y, m, d] = ymd(t);
    const temp = temporal(t), byTitle = new Map(data.days.filter(x => x.cycle === 'temporal').map(x => [x.title, x]));
    temp.day = byTitle.get(temp.mass || temp.title) || null;
    const all = feastsOn(data.days, y, m, d);
    const feasts = all.filter(f => !f.local).map(f => ({ day: f, cls: f.class || 3 })).sort((a, b) => a.cls - b.cls);
    const local = all.filter(f => f.local).map(f => ({ title: f.title, day: f }));
    let celebrated = { kind: 'temporal', ...temp }, commemorations = [], note = '';
    const top = feasts[0];
    if (top) {
      const sunday = temp.sunday;
      let feastWins;
      if (temp.cls === 1) feastWins = false;
      else if (sunday) feastWins = top.cls === 1 || (top.cls === 2 && LORD.test(top.day.title));
      else if (temp.cls === 2) feastWins = top.cls <= 2;
      else if (temp.cls === 3) feastWins = top.cls <= 2;
      else feastWins = top.cls <= 3;
      if (temp.octave) feastWins = top.cls <= 2;
      if (feastWins) {
        celebrated = { kind: 'feast', title: top.day.title, day: top.day, cls: top.cls };
        commemorations = [...(temp.cls <= 3 && !temp.octave ? [{ title: temp.feria ? `${temp.mass} (feria)` : temp.title, day: temp.day }] : []), ...feasts.slice(1).filter(f => f.cls <= 3).map(f => ({ title: f.day.title, day: f.day }))];
      } else {
        // No commemorations on I class days; on Sundays only feasts of the II class.
        commemorations = temp.cls === 1 ? [] : feasts.filter(f => temp.sunday ? f.cls <= 2 : f.cls <= 3 || temp.cls === 4).map(f => ({ title: f.day.title, day: f.day }));
        if (temp.cls === 1 && top.cls <= 2) note = (note ? note + ' ' : '') + `${top.day.title} gives way to the ${temp.title}${top.cls === 1 ? ' and is transferred' : ''}.`;
        if (temp.cls === 3 && top.cls === 3) note = (note ? note + ' ' : '') + `In ${/Lent|Passion/.test(temp.title) ? 'Lent' : 'Advent'} the feria takes precedence; ${top.day.title} is commemorated.`;
      }
    }
    if (celebrated.kind === 'temporal' && temp.note) note = temp.note + (note ? ' ' + note : '');
    return { local, date: t, label: `${WEEKDAY[dow(t)]} ${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`,
      temporal: temp, feasts, celebrated, commemorations, note,
      className: ['', 'I class', 'II class', 'III class', 'IV class'][celebrated.cls] || '' };
  }
  window.ScriptoriumOrdo = { forDate, temporal: t => temporal(t), easter, dn };
})();
/* END SCRIPTORIUM ORDO 1962 */
