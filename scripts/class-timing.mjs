/** Display-only class timing. Never changes saved times, records or deadlines. */
export function classTimingDetails(item = {}) {
  const valid = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const start = valid(item.time) ? item.time : '';
  const end = valid(item.endTime) ? item.endTime : '';
  const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  // The class editor supports same-day sessions. Do not guess a next-day end.
  const difference = start && end ? toMinutes(end) - toMinutes(start) : 0;
  const minutes = difference > 0 ? difference : null;
  const hours = minutes === null ? 0 : Math.floor(minutes / 60);
  const remainder = minutes === null ? 0 : minutes % 60;
  const duration = [hours ? `${hours}h` : '', remainder ? `${remainder}m` : ''].filter(Boolean).join(' ');
  const spoken = [hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
    remainder ? `${remainder} ${remainder === 1 ? 'minute' : 'minutes'}` : ''].filter(Boolean).join(' ');
  return { start, end, minutes, duration, spoken };
}

export function classTimingHTML(item, agenda = false) {
  const { start, end, duration, spoken } = classTimingDetails(item);
  // Only strictly validated HH:MM strings and derived numbers reach this markup.
  const time = value => `<time datetime="${value}">${value}</time>`;
  const durationText = duration ? `<span aria-hidden="true">${duration}</span><span class="sr-only">Duration: ${spoken}</span>` : '';
  if (agenda) {
    return `<div class="agenda-time">${start ? time(start) : 'Time TBC'}${end ? `<small><span class="sr-only">Ends at </span>${time(end)}</small>` : ''}${duration ? `<small class="agenda-duration" title="Duration: ${spoken}">${durationText}</small>` : ''}</div>`;
  }
  const range = start ? `${time(start)}${end ? `<span class="class-time-end"><span aria-hidden="true">\u2013</span><span class="sr-only"> to </span>${time(end)}</span>` : ''}`
    : end ? `Ends ${time(end)}` : 'Time to confirm';
  return `<span class="event-time class-timing"><span class="class-time-range">${range}</span>${duration ? `<span class="class-duration" title="Duration: ${spoken}">${durationText}</span>` : ''}</span>`;
}

export const classTimingStyles = `
/* Start/end stay together when space permits; duration aligns to the right.
   Allow wrapping in narrow week columns instead of clipping either time. */
.calendar-event .class-timing {
  display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between;
  gap:2px 6px; font-size:10px; line-height:1.4; font-variant-numeric:tabular-nums;
}
.class-time-range { display:inline-flex; flex-wrap:wrap; min-width:0; max-width:100%; }
.class-time-range time, .class-time-end { white-space:nowrap; }
.class-duration {
  margin-inline-start:auto; white-space:nowrap; font-size:9px; font-weight:500;
}
.agenda-time .agenda-duration {
  color:var(--accent, var(--muted)); font-weight:500; white-space:nowrap;
}
`;

export function applyClassTiming(source) {
  function once(before, after) {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`Class timing anchor must occur once (${count}): ${before.slice(0, 70)}`);
    source = source.replace(before, () => after);
  }
  once('function renderCalendarEvent(', `${classTimingDetails.toString()}\n${classTimingHTML.toString()}\nfunction renderCalendarEvent(`);
  once('<span class="event-time">${isDeadline?e(item.due?.time||\'Deadline\'):e(item.time||\'Time to confirm\')}</span>',
    '${isDeadline?`<span class="event-time">${e(item.due?.time||\'Deadline\')}</span>`:classTimingHTML(item)}');
  once('<div class="agenda-time">${e(item.category===\'class\'?(item.time||\'Time TBC\'):(item.due.time||\'Due today\'))}<small>${e(item.category===\'class\'?(item.endTime||\'\'):item.due.confirmed?\'Deadline\':\'Tentative\')}</small></div>',
    '${item.category===\'class\'?classTimingHTML(item,true):`<div class="agenda-time">${e(item.due.time||\'Due today\')}<small>${e(item.due.confirmed?\'Deadline\':\'Tentative\')}</small></div>`}');
  once('</style>', `${classTimingStyles}\n</style>`);
  return source;
}
