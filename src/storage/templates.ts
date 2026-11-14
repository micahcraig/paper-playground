import type { LibraryId } from '../libs/registry'
import type { SketchMode } from '../runner/protocol'

export interface Template {
  id: string
  label: string
  description: string
  /** Default name for a project made from it. */
  projectName: string
  mode: SketchMode
  libraries: LibraryId[]
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
    libraries: ['paper'],
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
    libraries: ['paper'],
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
    libraries: ['paper'],
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
    libraries: ['paper'],
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
    id: 'p5',
    label: 'p5.js sketch',
    description: 'setup() and draw() with p5.js, no Paper.js',
    projectName: 'p5 sketch',
    mode: 'javascript',
    libraries: ['p5'],
    files: [{ name: 'sketch.js', code: `// sketch.js · p5.js in global mode (setup and draw are found on window)
const colors = ['#7aa2f7', '#bb9af7', '#7dcfff', '#ff9e64'];
let angle = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noFill();
  strokeWeight(3);
  console.log(\`p5 canvas: \${width} x \${height}\`);
}

function draw() {
  clear();
  translate(width / 2, height / 2);
  rotate(angle);
  for (let i = 0; i < 6; i++) {
    stroke(colors[i % colors.length]);
    const size = 40 + i * 48;
    rect(-size / 2, -size / 2, size, size, 8);
  }
  angle += 0.01;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
` }],
  },
  {
    id: 'three',
    label: 'Three.js scene',
    description: 'A lit, spinning cube with WebGL',
    projectName: 'three scene',
    mode: 'javascript',
    libraries: ['three'],
    files: [{ name: 'scene.js', code: `// scene.js · Three.js (THREE is a global)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 1.6, 1.6),
  new THREE.MeshStandardMaterial({ color: '#7aa2f7' }),
);
scene.add(cube);
scene.add(new THREE.AmbientLight('#ffffff', 0.5));
const light = new THREE.DirectionalLight('#ffffff', 2.5);
light.position.set(2, 3, 4);
scene.add(light);

renderer.setAnimationLoop(() => {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.013;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

console.log(\`three r\${THREE.REVISION}\`);
` }],
  },
  {
    id: 'd3',
    label: 'd3 chart',
    description: 'A bar chart drawn as SVG',
    projectName: 'd3 chart',
    mode: 'javascript',
    libraries: ['d3'],
    files: [{ name: 'chart.js', code: `// chart.js · d3 (d3 is a global)
const data = [4, 8, 15, 16, 23, 42];
const colors = ['#7aa2f7', '#bb9af7', '#7dcfff', '#ff9e64'];
const width = innerWidth;
const height = innerHeight;

const svg = d3.select('body').append('svg').attr('width', width).attr('height', height);
const x = d3.scaleBand().domain(d3.range(data.length)).range([24, width - 24]).padding(0.2);
const y = d3.scaleLinear().domain([0, d3.max(data)]).range([height - 24, 24]);

svg
  .selectAll('rect')
  .data(data)
  .join('rect')
  .attr('x', (_, i) => x(i))
  .attr('y', (d) => y(d))
  .attr('width', x.bandwidth())
  .attr('height', (d) => y(0) - y(d))
  .attr('rx', 6)
  .attr('fill', (_, i) => colors[i % colors.length]);

console.log(\`bars: \${data.length}\`);
` }],
  },
  {
    id: 'runtime-error',
    label: 'Runtime error demo',
    description: 'Throws when you tap the preview',
    projectName: 'broken',
    mode: 'paperscript',
    libraries: ['paper'],
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
    libraries: ['paper'],
    files: [{ name: 'typo.js', code: `// typo.js · missing a closing bracket on line 2
var colors = ['#7aa2f7', '#bb9af7';
console.log('never runs');
` }],
  },
]

export function getTemplate(id: string): Template {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]
}
