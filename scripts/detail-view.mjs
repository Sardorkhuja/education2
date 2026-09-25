/** Read-only detail surfaces. Editing is always an explicit action. */
export function detailRow(glyph, label, value, extra = '') {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="detail-row">${icon(glyph,18)}<div><span class="detail-label">${e(label)}</span><div class="detail-value">${e(value)}</div>${extra}</div></div>`;
}

export function openItemDetails(id) {
  const record = store.envelope(id);
  if (!record || !['assessment','task'].includes(record.kind)) return;
  const item = record.data;
  const c = courseById(item.courseId);
  const mode = modeData(item,c);
  const isAssessment = record.kind === 'assessment';
  let effectiveGrade = item.grade;
  if (isAssessment && item.aggregation === 'average') {
    effectiveGrade = courseGrade(c,assessments(),tasks()).parts.find(part => part.id === item.id)?.effectiveGrade ?? null;
  }
  const linked = !isAssessment && item.componentId ? assessments().find(a => a.id === item.componentId) : null;
  const formatValue = mode.mode === 'in-person' ? 'On campus' : mode.label;
  const chips = [
    statusBadge(item),
    badge(item.type || (isAssessment ? 'Assessment' : 'Task'),'neutral'),
    item.required ? badge('Required','neutral') : '',
    item.review || item.due?.value && !item.due?.confirmed ? badge('Needs review','warn','alert') : ''
  ].filter(Boolean).join('');
  const body = `<div class="detail-view ${colorOf(c)}">
    <div class="detail-summary">
      ${courseLabel(c)}
      <div class="detail-chips">${chips}</div>
    </div>
    <div class="detail-list">
      ${detailRow('calendar','Date',dateLabel(item.due))}
      ${isAssessment ? detailRow('chart','Weight',item.weight === null || item.weight === undefined ? 'Not set' : item.weight + '%') : ''}
      ${detailRow('star','Grade',hasGrade(effectiveGrade) ? round(effectiveGrade) + ' / 10' : 'Not graded yet')}
      ${linked ? detailRow('link','Grading component',linked.title + (linked.weight !== null && linked.weight !== undefined ? ` · ${linked.weight}%` : '')) : ''}
      ${detailRow(mode.icon,'Format',formatValue)}
      ${mode.location ? detailRow('pin','Location',mode.location) : ''}
      ${isAssessment && item.aggregation === 'average' ? detailRow('chart','Calculation','Average of linked task grades') : ''}
      ${isAssessment && item.expectedCount ? detailRow('list','Expected activities',String(item.expectedCount)) : ''}
      ${item.priority && item.priority !== 'normal' ? detailRow('flag','Priority',item.priority[0].toUpperCase()+item.priority.slice(1)) : ''}
    </div>
    ${mode.url ? `<div class="detail-actions">${externalLink(mode.url,'Join online','video')}</div>` : ''}
    <section class="detail-note"><span class="detail-label">Notes</span><p>${e(item.notes || 'No notes added.')}</p></section>
    ${item.source ? `<details class="detail-source"><summary>Source &amp; provenance</summary><p>${e(item.source)}</p></details>` : ''}
  </div>`;
  openModal({
    title:item.title || (isAssessment ? 'Assessment' : 'Task'),
    subtitle:c?.name || 'Course',
    body,
    wide:true,
    footer:`<button type="button" class="secondary detail-edit-button" data-action="edit-item" data-id="${e(item.id)}">${icon('edit',14)} Edit</button>`
  });
}

export function openOccurrence(id,date) {
  const record = store.envelope(id);
  if (!record || record.kind !== 'class') return;
  const s = record.data;
  const exception = s.exceptions?.[date];
  const item = {...s,...exception};
  const c = courseById(s.courseId);
  const mode = modeData(item,c);
  const timing = classTimingDetails(item);
  const timeText = timing.start ? timing.start + (timing.end ? ' – ' + timing.end : '') : timing.end ? 'Ends ' + timing.end : 'Time to confirm';
  const formatValue = mode.mode === 'in-person' ? 'On campus' : mode.label;
  const chips = [
    badge(item.title || 'Class','neutral'),
    timing.duration ? badge(timing.duration,'blue','clock') : '',
    exception ? badge('Changed for this date','neutral') : '',
    item.cancelled ? badge('Cancelled','danger','alert') : ''
  ].filter(Boolean).join('');
  const body = `<div class="detail-view ${colorOf(c)}">
    <div class="detail-summary">
      ${courseLabel(c)}
      <div class="detail-class-time">${e(timeText)}</div>
      <div class="detail-chips">${chips}</div>
    </div>
    <div class="detail-list">
      ${detailRow('clock','Time',timeText,timing.duration ? `<span class="detail-secondary">${e(timing.duration)}</span>` : '')}
      ${detailRow(mode.icon,'Format',formatValue)}
      ${mode.location ? detailRow('pin','Location',mode.location) : ''}
    </div>
    ${mode.url ? `<div class="detail-actions">${externalLink(mode.url,'Join online','video')}</div>` : ''}
    <section class="detail-note"><span class="detail-label">Notes</span><p>${e(item.notes || 'No notes for this class.')}</p></section>
  </div>`;
  const editThis = `<button type="button" class="secondary detail-edit-button" data-action="edit-occurrence" data-date="${e(date)}" data-id="${e(s.id)}">${icon('edit',14)} Edit</button>`;
  const editSeries = `<button type="button" class="text-button" data-action="edit-class" data-id="${e(s.id)}">${icon('calendar',14)} Edit series</button>`;
  openModal({
    title:c?.shortName || c?.name || 'Class',
    subtitle:formatDate(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),
    body,
    footer:editThis + editSeries
  });
}

export const detailViewStyles = `
.detail-view { display:grid; gap:18px; }
.detail-summary { display:grid; gap:11px; padding:2px 0 4px; }
.detail-summary .course-label { font-size:12px; }
.detail-class-time { font-size:30px; line-height:1.05; letter-spacing:-1px; font-weight:650;
  font-variant-numeric:tabular-nums; color:var(--text); }
.detail-chips { display:flex; flex-wrap:wrap; gap:7px; }
.detail-list { border-top:1px solid var(--line); }
.detail-row { display:grid; grid-template-columns:28px minmax(0,1fr); gap:10px; align-items:start;
  padding:15px 0; border-bottom:1px solid var(--line); }
.detail-row>.icon { color:var(--muted); margin-top:3px; }
.detail-label { display:block; font-size:10px; line-height:1.35; color:var(--muted); text-transform:uppercase;
  letter-spacing:.65px; font-weight:600; }
.detail-value { margin-top:4px; font-size:14px; line-height:1.5; color:var(--text); overflow-wrap:anywhere; }
.detail-secondary { display:block; margin-top:3px; color:var(--accent,var(--blue)); font-size:11px;
  font-variant-numeric:tabular-nums; }
.detail-actions { display:flex; align-items:center; gap:10px; min-height:36px; }
.detail-actions .text-link { min-height:36px; padding:7px 10px; border-radius:18px; background:var(--blue-soft); }
.detail-note { padding:15px 16px; border-radius:14px; background:var(--surface-2); }
.detail-note p { margin-top:7px; color:var(--muted); font-size:13px; line-height:1.65; white-space:pre-line; overflow-wrap:anywhere; }
.detail-source { border-top:1px solid var(--line); padding-top:6px; }
.detail-source p { padding:4px 0 0 24px; color:var(--muted); font-size:12px; line-height:1.65; white-space:pre-line; overflow-wrap:anywhere; }
.detail-edit-button { min-height:38px; padding:8px 14px; }
@media(max-width:700px) {
  .detail-view { gap:16px; }
  .detail-class-time { font-size:28px; }
  .detail-row { padding:14px 0; grid-template-columns:26px minmax(0,1fr); gap:9px; }
  .detail-value { font-size:15px; }
  .detail-note p { font-size:14px; }
  .sheet-footer>div:has(.detail-edit-button) { display:flex; gap:4px; flex-wrap:wrap; }
  .detail-edit-button { min-height:42px; }
}
`;

export function applyDetailViews(source) {
  function once(before, after) {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`Detail-view anchor must occur once (${count}): ${before.slice(0, 90)}`);
    source = source.replace(before, () => after);
  }
  const literalEditActions = (source.match(/data-action="edit-item"/g) || []).length;
  if (literalEditActions !== 6) throw new Error(`Expected six direct item-open actions, found ${literalEditActions}.`);
  source = source.replaceAll('data-action="edit-item"', 'data-action="view-item"');
  once(`data-action="${isDeadline?'edit-item':'occurrence'}"`, `data-action="${isDeadline?'view-item':'occurrence'}"`);
  // Rename the existing editor before injecting the new read-only occurrence viewer.
  once('function openOccurrence(id,date){', 'function editOccurrence(id,date){');
  once('function openItem(', `${detailRow.toString()}\n${openItemDetails.toString()}\n${openOccurrence.toString()}\nfunction openItem(`);
  once("if(r.data.status==='graded'){openItem(id);return;}", "if(r.data.status==='graded'){openItemDetails(id);return;}");
  once("    case 'edit-item':openItem(id);break;\n", "    case 'view-item':openItemDetails(id);break;\n    case 'edit-item':openItem(id);break;\n");
  once("    case 'occurrence':openOccurrence(id,button.dataset.date);break;\n", "    case 'occurrence':openOccurrence(id,button.dataset.date);break;\n    case 'edit-occurrence':editOccurrence(id,button.dataset.date);break;\n");
  once("if(itemKind(id)==='course')chooseView('course',id);else openItem(id);break;", "if(itemKind(id)==='course')chooseView('course',id);else openItemDetails(id);break;");
  once('</style>', `${detailViewStyles}\n</style>`);
  return source;
}
