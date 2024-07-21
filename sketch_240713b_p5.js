let modelGeometry;
let vertices = new Map();
let splines = [];
let faces = [];
let modelCenter;
let zNear = -1000;  // Adjust as needed
let zFar = 3000;    // Adjust as needed
let cameraPos;
let angle = 0;      // Angle for rotation

let dragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
let rotationX = 0;
let rotationY = 0;

let scaleFactor = 0.5;  // Default scale

class BSpline {
  constructor() {
    this.controlPoints = [];
  }

  addControlPoint(p) {
    this.controlPoints.push(p);
  }

  drawCurve() {
    if (this.controlPoints.length < 2) {
      return;
    }

    beginShape();
    for (let i = 0; i < this.controlPoints.length; i++) {
      vertex(this.controlPoints[i].x, this.controlPoints[i].y, this.controlPoints[i].z);
    }
    endShape();
  }
}

class Face {
  constructor() {
    this.vertexIndices = [];
  }

  addVertexIndex(index) {
    this.vertexIndices.push(index);
  }

  drawFaces(vertices) {
    beginShape();
    for (let i = 0; i < this.vertexIndices.length; i++) {
      let v = vertices.get(this.vertexIndices[i]);
      vertex(v.x, v.y, v.z);
    }
    endShape(CLOSE);
  }

  drawEdges(vertices) {
    beginShape(LINES);
    for (let i = 0; i < this.vertexIndices.length; i++) {
      let v1 = vertices.get(this.vertexIndices[i]);
      let v2 = vertices.get(this.vertexIndices[(i + 1) % this.vertexIndices.length]);
      vertex(v1.x, v1.y, v1.z);
      vertex(v2.x, v2.y, v2.z);
    }
    endShape();
  }
}

function preload() {
  modelGeometry = loadModel('ForProcessing.obj', true);
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(2);
  smooth(8);
  frameRate(30);
  strokeWeight(0.4);
  
  noLights();

  if (!modelGeometry) {
    console.log("Model could not be loaded. Check the path and file.");
    noLoop();
    return;
  } else {
    console.log("Model loaded successfully.");
  }

  parseOBJFile("ForProcessing_Exploded_1deg.obj");

  calculateModelCenter();

  console.log("Vertices loaded: " + vertices.size);
  console.log("Splines loaded: " + splines.length);
  console.log("Faces loaded: " + faces.length);
}

function draw() {
  background(230);

  ortho(-width / 2, width / 2, height / 2, -height / 2, zNear, zFar);

  // Calculate the camera position based on the rotation angles
  let radius = 500;  // Adjust as needed
  let camX = radius * cos(rotationY) * cos(rotationX);
  let camY = radius * sin(rotationX);
  let camZ = radius * sin(rotationY) * cos(rotationX);

  // Set the camera with a dynamic up vector
  let upX = cos(rotationY) * cos(rotationX + HALF_PI);
  let upY = sin(rotationX + HALF_PI);
  let upZ = sin(rotationY) * cos(rotationX + HALF_PI);

  camera(camX, camY, camZ, 0, 0, 0, upX, upY, upZ);

  // Update the rotation angle for the next frame
  if (!dragging) {
    angle += 0.006;  // Adjust the speed of rotation as needed
    if (angle >= TWO_PI) {
      angle = 0;  // Reset the angle to avoid overflow
    }
    rotationY += 0.006;  // Slow rotation when not dragging
  }

  // Translate to center the model on the canvas and move it up slightly
  translate(-modelCenter.x, -modelCenter.y + 20, -modelCenter.z);

  // Adjust scale based on received scale factor
  scale(scaleFactor);

  // Draw polygonal surfaces
  noStroke();
  fill(230);
  for (let i = 0; i < faces.length; i++) {
    faces[i].drawFaces(vertices);
  }

  // Draw edges of the faces
  stroke(0);
  noFill();
  for (let i = 0; i < faces.length; i++) {
    faces[i].drawEdges(vertices);
  }

  // Draw B-spline curves
  stroke(0, 0, 0);
  noFill();
  for (let i = 0; i < splines.length; i++) {
    splines[i].drawCurve();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  dragging = true;
  previousMouseX = mouseX;
  previousMouseY = mouseY;
}

function mouseDragged() {
  let dx = mouseX - previousMouseX;
  let dy = mouseY - previousMouseY;

  rotationY += dx * 0.01;
  rotationX += dy * 0.01;

  previousMouseX = mouseX;
  previousMouseY = mouseY;
}

function mouseReleased() {
  dragging = false;
}

function mouseWheel(event) {
  scaleFactor += event.delta > 0 ? -0.05 : 0.05;
  scaleFactor = constrain(scaleFactor, 0.1, 2); // Set limits to zoom
}

function touchMoved(event) {
  if (event.touches.length == 2) {
    let dx = event.touches[0].pageX - event.touches[1].pageX;
    let dy = event.touches[0].pageY - event.touches[1].pageY;
    let distance = sqrt(dx * dx + dy * dy);

    if (this.lastDistance) {
      let delta = distance - this.lastDistance;
      scaleFactor += delta > 0 ? 0.01 : -0.01;
      scaleFactor = constrain(scaleFactor, 0.1, 2); // Set limits to zoom
    }

    this.lastDistance = distance;
  }

  return false; // Prevent default touch behavior
}

function touchEnded(event) {
  this.lastDistance = null;
}

function calculateModelCenter() {
  let min = createVector(Infinity, Infinity, Infinity);
  let max = createVector(-Infinity, -Infinity, -Infinity);

  for (let v of vertices.values()) {
    if (v.x < min.x) { min.x = v.x; }
    if (v.y < min.y) { min.y = v.y; }
    if (v.z < min.z) { min.z = v.z; }
    if (v.x > max.x) { max.x = v.x; }
    if (v.y > max.y) { max.y = v.y; }
    if (v.z > max.z) { max.z = v.z; }
  }

  modelCenter = createVector((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
}

function parseOBJFile(filePath) {
  loadStrings(filePath, function(lines) {
    let currentSpline = null;

    for (let line of lines) {
      let parts = line.trim().split(/\s+/);
      if (parts.length == 0) {
        continue;
      }

      switch (parts[0]) {
        case "v":
          let x = parseFloat(parts[1]);
          let y = parseFloat(parts[2]);
          let z = parseFloat(parts[3]);
          let index = vertices.size + 1;  // OBJ files are 1-indexed
          vertices.set(index, createVector(x, y, z));
          break;

        case "cstype":
          if (parts[1] === "bspline") {
            if (currentSpline !== null) {
              splines.push(currentSpline);
            }
            currentSpline = new BSpline();
          }
          break;

        case "curv":
          if (currentSpline !== null) {
            for (let i = 3; i < parts.length; i++) {
              let vertexIndex = parseInt(parts[i]);
              if (vertices.has(vertexIndex)) {
                currentSpline.addControlPoint(vertices.get(vertexIndex));
              }
            }
          }
          break;

        case "f":
          let face = new Face();
          for (let i = 1; i < parts.length; i++) {
            let vertexIndex = parseInt(parts[i].split("/")[0]);
            face.addVertexIndex(vertexIndex);
          }
          faces.push(face);
          break;

        case "end":
          if (currentSpline !== null) {
            splines.push(currentSpline);
            currentSpline = null;
          }
          break;
      }
    }

    if (currentSpline !== null) {
      splines.push(currentSpline);
    }
  });
}
