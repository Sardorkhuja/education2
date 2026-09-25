/**
 * Presentation adapter for the original single-file application.
 * Keep the stable data/sync layer intact. Exact anchors deliberately fail the
 * build on source drift instead of silently shipping a partially patched UI.
 * The deployed module contains no preset course data or import entry points.
 */
import { applyClassTiming } from './class-timing.mjs';
import { applyDetailViews } from './detail-view.mjs';

export function applyPresentation(source, styles, runtime) {
  function once(oldText, newText) {
    const count = source.split(oldText).length - 1;
    if (count !== 1) throw new Error(`Presentation anchor must occur once (${count}): ${oldText.slice(0, 90)}`);
    source = source.replace(oldText, () => newText);
  }
  once('<html lang="en">', '<html lang="en" data-theme="dark">');
  once('<meta name="theme-color" content="#f5f5f7">', '<meta name="theme-color" content="#000000">');
  once('name="apple-mobile-web-app-status-bar-style" content="default"', 'name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
  once("const APP_VERSION = '1.0.1';", "const APP_VERSION = '1.1.3';");
  once("theme:'system',reducedTransparency:false", "theme:'dark',reducedTransparency:false,reducedMotion:false");
  once("dark?'#141416':'#f5f5f7';}", "dark?'#000000':'#f5f5f7';uiMotion.preferences();}");
  const seeds = source.match(/\/\/ ---- seed\.js ----[\s\S]*?(?=\/\/ ---- storage\.js ----)/);
  if (!seeds) throw new Error('Course preset block not found.');
  once(seeds[0], '// Course presets are intentionally excluded. Existing user records are never deleted.\n\n');
  const templates = source.match(/^function openTemplates\(\).*\n/m);
  if (!templates) throw new Error('Course preset editor not found.');
  once(templates[0], '');
  once("    case 'templates':openTemplates();break;\n", '');
  once('renderApp(true);openTemplates();navigator.storage', 'renderApp(true);navigator.storage');
  once('Set up my courses ${icon(\'arrow\',17)}', 'Create my workspace ${icon(\'arrow\',17)}');
  once('No grades or completed tasks are invented.', 'Start with a blank workspace. Add your own courses, one at a time.');
  once('<button class="secondary" data-action="templates">${icon(\'download\',16)} Import templates</button>', '<button class="secondary" data-action="new-course">${icon(\'plus\',16)} Add course</button>');
  once('<button class="text-button" data-action="templates">Course templates</button>', '');
  once('<div class="setting-row"><span>Interface language', '<div class="setting-row"><span>Reduce motion<small>Gentler transitions. System Reduce Motion is always respected.</small></span><button class="secondary" data-action="toggle-motion" aria-pressed="${!!p.reducedMotion}">${p.reducedMotion?\'On\':\'Off\'}</button></div><div class="setting-row"><span>Interface language');
  once("    case 'toggle-transparency':", "    case 'toggle-motion':await setProfilePatch({reducedMotion:!profile().reducedMotion});break;\n    case 'toggle-transparency':");
  const start = source.indexOf('function renderApp(force=false)');
  const end = source.indexOf('function introHTML()', start);
  if (start < 0 || end < 0) throw new Error('Render boundary not found.');
  const render = source.slice(start, end);
  let count = 0;
  const animated = render.replace(/root\.innerHTML=(renderAuth\(\)|renderWelcome\(\)|`[^`]*`);/g, (_, html) => {
    count++; return `uiMotion.render(${html});`;
  });
  if (count !== 4) throw new Error(`Expected four render paths, found ${count}.`);
  once(render, animated);
  once('  dialog.close();modalState=null;return true;', '  uiMotion.closeSheet(dialog);dialog.close();modalState=null;return true;');
  once('  dialog.showModal();afterOpen?.(form);', '  dialog.showModal();uiMotion.openSheet(dialog);afterOpen?.(form);');
  once("form.addEventListener('input',()=>{if(modalState)modalState.dirty=false;});update();input.focus();", "form.addEventListener('input',()=>{if(modalState)modalState.dirty=false;});form.addEventListener('change',()=>{if(modalState)modalState.dirty=false;});update();input.focus();");
  once('clearTimeout(notify.timer);notify.timer=', 'uiMotion.feedback(el,error);clearTimeout(notify.timer);notify.timer=');
  once('</style>', '\n' + styles + '\n</style>');
  once('\nboot();', '\n' + runtime + '\nboot();');
  if (/COURSE_TEMPLATES|instantiateTemplates|openTemplates|data-action="templates"/.test(source)) throw new Error('Unexpected preset entry point in release.');
  return applyDetailViews(applyClassTiming(source));
}
