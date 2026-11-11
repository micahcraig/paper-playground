import type { SketchMode } from '../runner/protocol'

export interface Template {
  id: string
  label: string
  description: string
  /** Default name for a project made from it. */
  projectName: string
  mode: SketchMode
  files: { name: string; code: string }[]
}

/** The starter project created on first launch. */
export const STARTER_TEMPLATE_ID = 'ripple'

export const TEMPLATES: Template[] = [
  {
    id: 'ripple',
    label: 'Ripple',
    description: 'The starter sketch: rotating rings and touch drawing',
    projectName: 'ripple',
    mode: 'paperscript',
    files: [
      {
        name: 'ripple.js',
        code: `// ripple.js · PaperScript
var colors = palette(); // defined in palette.js
var group = new Group();

for (var i = 0; i < 6; i++) {
  var ring = new Path.Circle({
    center: view.center,
    radius: 40 + i * 32,
    strokeColor: colors[i % 4],
    strokeWidth: 3
  });
  group.addChild(ring);
}
console.log('rings: ' + group.children.length);

// Point arithmetic only works in PaperScript.
var dot = new Path.Circle(view.center + [200, 0], 8);
dot.fillColor = '#c0caf5';

function onFrame(event) {
  group.rotate(0.4);
  dot.position = view.center + new Point({ length: 200, angle: event.count });
}

function onResize(event) {
  group.position = view.center;
}

// Drag on the preview to draw.
var path;
function onMouseDown(event) {
  path = new Path({ strokeColor: '#ff9e64', strokeWidth: 4, strokeCap: 'round' });
  path.add(event.point);
}

function onMouseDrag(event) {
  path.add(event.point);
}

function onMouseUp(event) {
  path.simplify();
}
`,
      },
      {
        name: 'palette.js',
        code: `// palette.js · shared colours
// Files share one scope. Function declarations are hoisted,
// so ripple.js can call palette() before this tab runs.
function palette() {
  return ['#7aa2f7', '#bb9af7', '#7dcfff', '#ff9e64'];
}
`,
      },
    ],
  },
  {
    id: 'blank-paperscript',
    label: 'Blank PaperScript',
    description: 'One file, Point arithmetic and onMouse handlers',
    projectName: 'sketch',
    mode: 'paperscript',
    files: [{ name: 'sketch.js', code: `// sketch.js · PaperScript
var circle = new Path.Circle(view.center, 60);
circle.fillColor = '#7aa2f7';

function onMouseDrag(event) {
  circle.position = event.point;
}
` }],
  },
  {
    id: 'blank-javascript',
    label: 'Blank JavaScript',
    description: 'One file, plain JavaScript with paper on window',
    projectName: 'sketch',
    mode: 'javascript',
    files: [{ name: 'sketch.js', code: `// sketch.js · plain JavaScript (paper is installed on window)
var circle = new Path.Circle({ center: view.center, radius: 60, fillColor: '#7aa2f7' });

view.onMouseDrag = function (event) {
  circle.position = event.point;
};
` }],
  },
  {
    id: 'ripple-plain',
    label: 'Ripple in plain JavaScript',
    description: 'The ripple without PaperScript',
    projectName: 'ripple-plain',
    mode: 'javascript',
    files: [{ name: 'ripple-plain.js', code: `// ripple-plain.js · plain JavaScript (paper is installed on window)
var colors = ['#7aa2f7', '#bb9af7', '#7dcfff', '#ff9e64'];
var group = new Group();

for (var i = 0; i < 6; i++) {
  group.addChild(new Path.Circle({
    center: view.center,
    radius: 40 + i * 32,
    strokeColor: colors[i % 4],
    strokeWidth: 3
  }));
}
console.log('rings: ' + group.children.length);

var dot = new Path.Circle({ center: view.center, radius: 8, fillColor: '#c0caf5' });

view.onFrame = function (event) {
  group.rotate(0.4);
  dot.position = view.center.add(new Point({ length: 200, angle: event.count }));
};

view.onResize = function () {
  group.position = view.center;
};
` }],
  },
  {
    id: 'runtime-error',
    label: 'Runtime error demo',
    description: 'Throws when you tap the preview',
    projectName: 'broken',
    mode: 'paperscript',
    files: [{ name: 'broken.js', code: `// broken.js · tap the preview to throw from line 7
var circle = new Path.Circle(view.center, 60);
circle.fillColor = '#ff9e64';
console.log('tap the preview');

function onMouseDown(event) {
  circle.scale(undefinedScale);
}
` }],
  },
  {
    id: 'syntax-error',
    label: 'Syntax error demo',
    description: 'Shows how syntax errors are reported',
    projectName: 'typo',
    mode: 'javascript',
    files: [{ name: 'typo.js', code: `// typo.js · missing a closing bracket on line 2
var colors = ['#7aa2f7', '#bb9af7';
console.log('never runs');
` }],
  },
]

export function getTemplate(id: string): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]
}
