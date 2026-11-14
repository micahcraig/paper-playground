import { describe, expect, it } from 'vitest'
import { PAPERSCRIPT_URL, buildSrcdoc, escapeScript, scriptJson } from './srcdoc'

const LIB = 'window.paper = { fake: true };'

describe('escapeScript', () => {
  it('stops text from closing the script element', () => {
    expect(escapeScript('var s = "</script>";')).toBe('var s = "<\\/script>";')
    expect(escapeScript('"</SCRIPT >"')).toBe('"<\\/SCRIPT >"')
  })

  it('neutralises HTML comment openers', () => {
    expect(escapeScript('a <!-- b')).toBe('a <\\!-- b')
  })

  it('keeps the line count', () => {
    const code = 'a\n"</script>"\nb'
    expect(escapeScript(code).split('\n')).toHaveLength(3)
  })
})

describe('scriptJson', () => {
  it('round-trips through JSON.parse', () => {
    const value = { code: '</script><!-- \u2028 \u2029 "quoted"' }
    expect(JSON.parse(scriptJson(value))).toEqual(value)
  })

  it('contains no raw < or line separators', () => {
    const json = scriptJson('</script> \u2028\u2029')
    expect(json).not.toMatch(/[<\u2028\u2029]/)
  })
})

describe('buildSrcdoc in JavaScript mode', () => {
  const files = [
    { name: 'a.js', code: 'var first = 1;\nvar second = 2;' },
    { name: 'b.js', code: 'console.log(first + second);' },
  ]
  const { html, lineMap } = buildSrcdoc({ runId: 'run-1', mode: 'javascript', files, libraries: [LIB] })
  const lines = html.split('\n')

  it('maps each file to the srcdoc line where it starts', () => {
    expect(lineMap.map((segment) => segment.file)).toEqual(['a.js', 'b.js'])
    for (const [index, segment] of lineMap.entries()) {
      const fileLines = files[index].code.split('\n')
      expect(segment.lineCount).toBe(fileLines.length)
      // Line numbers are 1-based, array indexes 0-based.
      expect(lines.slice(segment.startLine - 1, segment.startLine - 1 + segment.lineCount)).toEqual(fileLines)
    }
  })

  it('puts each file in its own script, after the libraries and setup', () => {
    const libAt = html.indexOf(LIB)
    const setupAt = html.indexOf("paper.setup('canvas')")
    const firstAt = html.indexOf(files[0].code)
    const secondAt = html.indexOf(files[1].code)
    expect(libAt).toBeGreaterThan(-1)
    expect(libAt).toBeLessThan(setupAt)
    expect(setupAt).toBeLessThan(firstAt)
    expect(firstAt).toBeLessThan(secondAt)
    expect(html.match(/<script>\n/g)).toHaveLength(2)
  })

  it('reports ran only after the last file', () => {
    expect(html.lastIndexOf('__pp.ran()')).toBeGreaterThan(html.indexOf(files[1].code))
  })

  it('embeds the run id', () => {
    expect(html).toContain('var RUN_ID = "run-1";')
  })

  it('escapes user code that contains a closing script tag', () => {
    const built = buildSrcdoc({
      runId: 'r',
      mode: 'javascript',
      files: [{ name: 'x.js', code: 'var tag = "</script>";' }],
      libraries: [],
    })
    expect(built.html).toContain('var tag = "<\\/script>";')
  })
})

describe('buildSrcdoc without Paper.js', () => {
  const build = () =>
    buildSrcdoc({ runId: 'r', mode: 'javascript', files: [{ name: 'p5.js', code: 'function setup() {}' }], libraries: ['window.p5 = 1;'], paper: false })

  it('neither sets up Paper.js nor adds its canvas', () => {
    const { html } = build()
    expect(html).not.toContain('paper.setup')
    expect(html).not.toContain('paper.install')
    expect(html).not.toContain('id="canvas"')
    expect(html).toContain('__pp.ready()')
    expect(html).toContain('function setup() {}')
  })

  it('still maps lines after the libraries', () => {
    const { html, lineMap } = build()
    expect(html.split('\n')[lineMap[0].startLine - 1]).toBe('function setup() {}')
  })

  it('refuses PaperScript, which needs Paper.js', () => {
    expect(() => buildSrcdoc({ runId: 'r', mode: 'paperscript', files: [], libraries: [], paper: false })).toThrow('PaperScript needs Paper.js')
  })
})

describe('buildSrcdoc in PaperScript mode', () => {
  const files = [
    { name: 'palette.js', code: "var colors = ['#7aa2f7'];\n" },
    { name: 'ripple.js', code: 'var c = new Path.Circle(view.center, 40);\nc.strokeColor = colors[0];' },
  ]
  const { html, lineMap } = buildSrcdoc({ runId: 'run-2', mode: 'paperscript', files, libraries: [LIB] })

  it('joins the files into one source and maps lines within it', () => {
    const match = html.match(/scope\.execute\((".*?"), \{/)
    expect(match).not.toBeNull()
    const source: string = JSON.parse(match![1])
    const sourceLines = source.split('\n')
    for (const [index, segment] of lineMap.entries()) {
      const fileLines = files[index].code.split('\n')
      expect(segment.file).toBe(files[index].name)
      expect(sourceLines.slice(segment.startLine - 1, segment.startLine - 1 + segment.lineCount)).toEqual(fileLines)
    }
  })

  it('names the compiled source so stack frames can be found', () => {
    expect(html).toContain(`{ url: "${PAPERSCRIPT_URL}" }`)
  })

  it('does not inline the source as raw script text', () => {
    expect(html).not.toContain('new Path.Circle(view.center, 40);\n')
  })
})
