import type { SketchMode } from './protocol'

export interface SketchFile {
  name: string
  code: string
}

export interface BuildOptions {
  runId: string
  mode: SketchMode
  files: SketchFile[]
  /** Library source text, in load order. Inlined because sandboxed iframes cannot load blob URLs. */
  libraries: string[]
}

/** Where one file's first line sits in the runner's line coordinates. */
export interface LineSegment {
  file: string
  startLine: number
  lineCount: number
}

export interface BuiltSrcdoc {
  html: string
  lineMap: LineSegment[]
}

/** The sourceURL Paper.js gives compiled PaperScript, so stack frames can be found. */
export const PAPERSCRIPT_URL = 'paperscript-sketch'

/** Stops text from closing the <script> element it is inlined into. */
export function escapeScript(source: string): string {
  return source.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')
}

/** JSON that is safe to place inside an inline <script>. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function countLines(text: string): number {
  let lines = 1
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++
  return lines
}

const LOG_LIMIT = 1000
const ARG_LIMIT = 2000

/**
 * Runs first inside the iframe: forwards console calls and uncaught errors to
 * the app, and exposes the hooks the later scripts call. ES5 on purpose.
 */
function bootstrap(runId: string): string {
  return `(function () {
  var RUN_ID = ${scriptJson(runId)};
  var LOG_LIMIT = ${LOG_LIMIT}, ARG_LIMIT = ${ARG_LIMIT};
  var logged = 0, errored = false;
  function post(message) {
    message.runId = RUN_ID;
    try { parent.postMessage(message, '*'); } catch (e) {}
  }
  function format(value) {
    var text;
    if (typeof value === 'string') text = value;
    else if (value instanceof Error) text = value.name + ': ' + value.message;
    else if (typeof value === 'function') text = 'function ' + (value.name || 'anonymous') + '()';
    else if (value === null || typeof value !== 'object') text = String(value);
    else if (!Array.isArray(value) && typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      try { text = String(value); } catch (e) { text = Object.prototype.toString.call(value); }
    } else {
      try {
        var seen = [];
        text = JSON.stringify(value, function (key, item) {
          if (typeof item === 'function') return 'function';
          if (typeof item === 'object' && item !== null) {
            if (seen.indexOf(item) !== -1) return '[Circular]';
            seen.push(item);
          }
          return item;
        });
      } catch (e) { text = Object.prototype.toString.call(value); }
    }
    return text.length > ARG_LIMIT ? text.slice(0, ARG_LIMIT) + '…' : text;
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      if (original) original.apply(console, arguments);
      logged++;
      if (logged > LOG_LIMIT) {
        if (logged === LOG_LIMIT + 1) post({ type: 'log', level: 'warn', args: ['Console limit reached (' + LOG_LIMIT + ' messages); later output is dropped.'] });
        return;
      }
      post({ type: 'log', level: level, args: Array.prototype.map.call(arguments, format) });
    };
  });
  function report(error, message, line, column) {
    errored = true;
    var text = message || (error && error.name ? error.name + ': ' + error.message : String(error));
    post({
      type: 'error',
      message: String(text).replace(/^Uncaught /, ''),
      line: typeof line === 'number' && line > 0 ? line : null,
      column: typeof column === 'number' && column > 0 ? column : null,
      stack: error && error.stack ? String(error.stack) : null
    });
  }
  window.addEventListener('error', function (event) {
    report(event.error, event.message, event.lineno, event.colno);
  });
  // Paper.js listens to touch and mouse events unless the user agent says
  // "mobile", so on a desktop-mode user agent one tap would fire handlers twice.
  // Cancelling touchstart stops the browser sending the emulated mouse events.
  document.addEventListener('touchstart', function (event) {
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    report(reason, 'Unhandled promise rejection: ' + format(reason), null, null);
  });
  window.__pp = {
    ready: function () { post({ type: 'ready' }); },
    ran: function () { if (!errored) post({ type: 'ran' }); },
    report: function (error) { report(error, null, null, null); }
  };
})();`
}

const HEAD = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%;touch-action:none}</style>
`

/** Builds the runner document for one run. */
export function buildSrcdoc({ runId, mode, files, libraries }: BuildOptions): BuiltSrcdoc {
  let html = HEAD
  html += `<script>${bootstrap(runId)}</script>\n`
  for (const library of libraries) html += `<script>${escapeScript(library)}</script>\n`
  html += `</head>\n<body>\n<canvas id="canvas" data-paper-resize="true"></canvas>\n`

  const lineMap: LineSegment[] = []

  if (mode === 'javascript') {
    // Each file is its own classic script, so its top-level declarations are shared
    // and a syntax error in one file is reported with a line inside that file.
    html += `<script>paper.install(window); paper.setup('canvas'); __pp.ready();</script>\n`
    for (const file of files) {
      html += '<script>\n'
      lineMap.push({ file: file.name, startLine: countLines(html), lineCount: countLines(file.code) })
      html += `${escapeScript(file.code)}\n</script>\n`
    }
    html += `<script>__pp.ran();</script>\n`
  } else {
    // PaperScript is compiled by Paper.js, so the files are joined into one source
    // and lines are counted in that source.
    let source = ''
    for (const file of files) {
      if (source) source += '\n'
      lineMap.push({ file: file.name, startLine: countLines(source), lineCount: countLines(file.code) })
      source += file.code
    }
    html += `<script>
__pp.ready();
try {
  var scope = new paper.PaperScope();
  scope.setup('canvas');
  scope.execute(${scriptJson(source)}, { url: ${scriptJson(PAPERSCRIPT_URL)} });
  __pp.ran();
} catch (error) {
  __pp.report(error);
}
</script>\n`
  }

  html += '</body>\n</html>\n'
  return { html, lineMap }
}
