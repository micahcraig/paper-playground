import type { SketchMode } from './protocol'
import type { SketchFile } from './srcdoc'

export interface Sample {
  id: string
  label: string
  mode: SketchMode
  files: SketchFile[]
}

/** Hardcoded sketches for the M1 runner spike; M4 replaces them with saved projects. */
export const SAMPLES: Sample[] = [
  {
    id: 'paperscript',
    label: 'PaperScript',
    mode: 'paperscript',
    files: [
      {
        name: 'ripple.js',
        code: `// ripple.js · PaperScript
var colors = ['#7aa2f7', '#bb9af7', '#7dcfff', '#ff9e64'];
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
    ],
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    mode: 'javascript',
    files: [
      {
        name: 'ripple-plain.js',
        code: `// ripple-plain.js · plain JavaScript (paper is installed on window)
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
`,
      },
    ],
  },
  {
    id: 'runtime-error',
    label: 'Runtime error',
    mode: 'paperscript',
    files: [
      {
        name: 'broken.js',
        code: `// broken.js · tap the preview to throw from line 7
var circle = new Path.Circle(view.center, 60);
circle.fillColor = '#ff9e64';
console.log('tap the preview');

function onMouseDown(event) {
  circle.scale(undefinedScale);
}
`,
      },
    ],
  },
  {
    id: 'syntax-error',
    label: 'Syntax error',
    mode: 'javascript',
    files: [
      {
        name: 'typo.js',
        code: `// typo.js · missing a closing bracket on line 2
var colors = ['#7aa2f7', '#bb9af7';
console.log('never runs');
`,
      },
    ],
  },
]
