let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");
canvas.style.width = window.innerWidth + "px";
canvas.style.height = window.innerHeight + "px";
let canvasDivision = 3;
if (ctx.roundRect === undefined) ctx.roundRect = ctx.rect;

let [cos, sin] = [Math.cos.bind(Math), Math.sin.bind(Math)];

let gameState = "menu";

let enemyVel = null, playerVel = null, rollSpeed = null, pitchSpeed = null, enemyRollSpeed = null, enemyPitchSpeed = null, aimAssistRange = null, playerRadius = null, hp = null, enemyHP = null, pain = null, gravity = null, jumpSpeed = null, step = null, accelFactor = null, FOV = null, trueFOV = null, cameraDistance = null, bloom = null, weaponTraits = null, aimFactor = null, gun = null, recoil = null, shotCooldown = null, sway = null, reloading = null, reloadTime = null, enemyBloom = null, enemyShotChance = null, hitShot = null, enemyDamage = null, frameBounds = null, showCrosshair = null, showAmmo = null, showHP = null, showFPS = null, showHits = null, mouseMovement = null, equipTimer = null;
let bulletVel = null;
let mapBoundaries = null;
let gameActive = false;

let player = null, enemy = null, map = null, fire = null, pistol = null, smg = null, shotgun = null, sniper = null;

function resetValues() {
  enemyVel = 1.5; playerVel = [0, 0, 0]; rollSpeed = 0.1; pitchSpeed = 0.04; enemyRollSpeed = 0.07; enemyPitchSpeed = 0.035; aimAssistRange = Math.PI/24; bulletVel = 5; playerRadius = 1.5; hp = 100; enemyHP = 100; pain = 0; showCrosshair = true; showAmmo = true; showHP = true; showFPS = true; showHits = true;
  jumpSpeed = 1.5; gravity = .4, step = 0.1; accelFactor = 1.2; trueFOV = FOV = [/*Math.PI/1.7*/2.012742, Math.PI/2.2]; cameraDistance = 0; bloom = Math.PI/10; aimFactor = 0; recoil = 0; shotCooldown = 0; sway = 0; reloading = false; reloadTime = 0; enemyBloom = Math.PI/25; enemyShotChance = .1; enemyDamage = 10; frameBounds = [11, 14]; mouseMovement = [0, 0]; equipTimer = 0;
  hitShot = {state: 1, frames: 0};
  shapes = []; bullets = []; enemies = []; lasers = [];
  player = copyShape(playerTemplate); player.move([0, 2, 4]); if (cameraDistance > 0) shapes.push(player); 
  map = copyShape(mapTemplate); shapes.push(map);
  for (let i = 0; i < map.polys.length; i++) {
    let poly = map.polys[i];
    if (poly.mtl === "EnemySpawn") {
      if (Math.random() < .7) spawnEnemy(center(poly));
      map.polys.splice(i, 1);
      i -= 1;
    }
  }
  
  fire = copyShape(fireTemplate);
  pistol = copyShape(pistolTemplate); pistol.viewmodel = true; shapes.push(pistol); 
  smg = copyShape(smgTemplate); smg.viewmodel = true; 
  shotgun = copyShape(shotgunTemplate); shotgun.viewmodel = true; 
  sniper = copyShape(sniperTemplate); sniper.viewmodel = true; 
  gun = pistol;
  weaponTraits = new Map();
  weaponTraits.set(pistol, {
    name: "Pistool",
    automatic: false,
    runningBloom: 1.5,
    defaultBloom: Math.PI/50,
    normalPos: [-1.2, -.5, 2.5],
    aimPos: [0, -.24, 2],
    recoil: 1,
    damage: 20,
    cooldown: 2,
    slot: 1,
    ammo: 20,
    totalAmmo: 20,
    reloadTime: 40,
  });
  weaponTraits.set(smg, {
    name: "SMG",
    automatic: true,
    runningBloom: .5,
    defaultBloom: Math.PI/120,
    normalPos: [-2, -1, 3],
    aimPos: [0, -.79, 2.5],
    recoil: .5,
    damage: 12,
    cooldown: 2,
    fovFactor: .5,
    slot: 2,
    ammo: 30,
    totalAmmo: 30,
    reloadTime: 40,
  });
  weaponTraits.set(shotgun, {
    name: "Pump",
    automatic: true,
    runningBloom: 0.2,
    defaultBloom: 0*Math.PI/70,
    normalPos: [-3, -1.5, 11],
    aimPos: [0, -.9, 6],
    recoil: 10,
    damage: 15,
    cooldown: 15,
    shots: 7,
    spread: Math.PI/30,
    slot: 3,
    ammo: 8,
    totalAmmo: 8,
    reloadTime: 20,
    reloadPerShot: true,
  });
  weaponTraits.set(sniper, {
    name: "Sniper",
    automatic: false,
    runningBloom: 3,
    defaultBloom: 0*Math.PI/200,
    normalPos: [-3, -2, 7],
    aimPos: [0, -1.57, 8],
    recoil: 5,
    damage: 70,
    cooldown: 30,
    fovFactor: .22,
    slot: 4,
    ammo: 1,
    totalAmmo: 1,
    reloadTime: 60,
  });
  //enemy.update(Math.PI, "yaw");
  //shapes.push(enemy);
  mapBoundaries = [Math.max(...map.polys.map(poly => Math.max(...poly.map(pt => pt[0])))), 
  Math.min(...map.polys.map(poly => Math.min(...poly.map(pt => pt[0])))),
  Math.max(...map.polys.map(poly => Math.max(...poly.map(pt => pt[2])))),
  Math.min(...map.polys.map(poly => Math.min(...poly.map(pt => pt[2])))),
  Math.max(...map.polys.map(poly => Math.max(...poly.map(pt => pt[1]))))];
  gameActive = true;
  camAngle = [0, 0];
}

function mapWhilePreserve(list, fn) {
  for (let i = 0; i < list.length; i++) {
    list[i] = fn(list[i]);
  }
  return list;
}
function interpolateDepth(d1, d2, distAlong, fullDist) {
  return (d2-d1)*(distAlong/fullDist)+d1;
}

//the following functions use a custom rasterizer and a zbuffer for rendering, see the following:
//https://en.wikipedia.org/wiki/Z-buffering
//http://www.sunshine2k.de/coding/java/TriangleRasterization/TriangleRasterization.html
//https://stackoverflow.com/a/8290734/15938577
function drawPixel(canvasData, depthBuffer, x, y, r, g, b, depth, viewmodelBuffer, viewmodel=false) {
  if (x < 0 || x >= canvas.width || y < 0 || y > canvas.height) return;
  var index = (x + y * canvas.width) * 4;  
  if ((((!viewmodel)||viewmodelBuffer[index]) && (depthBuffer[index] !== undefined && depthBuffer[index] < depth)) || (viewmodelBuffer[index]===true && !viewmodel) || depth < 0) return;
  depthBuffer[index] = depth;
  if (viewmodel) viewmodelBuffer[index] = true;
  let fogIncrease = 3*Math.sqrt(Math.min(depth, 500));
  canvasData.data[index + 0] = Math.min(r + fogIncrease, 255);
  canvasData.data[index + 1] = Math.min(g + fogIncrease, 255);
  canvasData.data[index + 2] = Math.min(b + fogIncrease, 255);
  canvasData.data[index + 3] = 255;
}
function drawTopTri(p1, p2, p3, canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel=false) {
  let slope1 = (p2[0]-p1[0])/(p2[1]-p1[1]);
  let slope2 = (p3[0]-p1[0])/(p3[1]-p1[1]);
  let switched = slope1 > slope2;
  if (switched) [slope1, slope2] = [slope2, slope1];
  let curXs = [p1[0], p1[0]];
  let depths = [p1.depth, p1.depth];
  if (p1[1] < 0) curXs = [curXs[0]+slope1*-p1[1], curXs[1]+slope2*-p1[1]];
  for (let y = Math.max(0, (p1[1])); y <= Math.min(canvas.height, p2[1]); y++) {
    if (y >= 0 && y <= canvas.height) {
      for (let x = Math.max(Math.floor(curXs[0]), 0); x <= Math.min(curXs[1], canvas.width); x++) {
        drawPixel(canvasData, depthBuffer, Math.round(x), Math.floor(y), mtl[0], mtl[1], mtl[2], 
          1/(curXs[1] === curXs[0] ? depths[0] : interpolateDepth(depths[0], depths[1], x-curXs[0], curXs[1]-curXs[0])), viewmodelBuffer, viewmodel
        );
      }
      depths = [interpolateDepth(p1.depth, p2.depth, y - (p1[1]), p2[1]-(p1[1])), 
        interpolateDepth(p1.depth, p3.depth, y - (p1[1]), p3[1]-(p1[1]))];
      if (switched) depths = [depths[1], depths[0]];
    }
    curXs[0] += slope1;
    curXs[1] += slope2;
  }
}

function drawBottomTri(p1, p2, p3, canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel=false) {
  let slope1 = (p2[0]-p1[0])/(p2[1]-p1[1]);
  let slope2 = (p3[0]-p1[0])/(p3[1]-p1[1]);
  let switched = slope1 < slope2;
  if (switched) [slope1, slope2] = [slope2, slope1];
  let curXs = [p1[0], p1[0]];
  let depths = [p1.depth, p1.depth];
  if (p1[1] < 0) curXs = [curXs[0]+slope1*-p1[1], curXs[1]+slope2*-p1[1]];
  for (let y = Math.max((p1[1]), 0); y >= Math.max(0, p2[1]); y--) {
    if (y >= 0 && y <= canvas.height) {
      if (curXs[1]-curXs[0]>=2) {
        for (let x = Math.max((curXs[0]), 0); x <= Math.min(curXs[1], canvas.width); x++) {
          drawPixel(canvasData, depthBuffer, Math.round(x), Math.round(y), mtl[0], mtl[1], mtl[2], 
            1/(curXs[1] === curXs[0] ? depths[0] : interpolateDepth(depths[0], depths[1], x-curXs[0], curXs[1]-curXs[0])), viewmodelBuffer, viewmodel
          );
        }
      }
      depths = [interpolateDepth(p1.depth, p2.depth, y - (p1[1]), p2[1]-(p1[1])), 
        interpolateDepth(p1.depth, p3.depth, y - (p1[1]), p3[1]-(p1[1]))];
      if (switched) depths = [depths[1], depths[0]];
    }
    curXs[0] -= slope1;
    curXs[1] -= slope2; 
  }
}
function drawTri(p1, p2, p3, canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel=false) {
  let pts = [p1, p2, p3].map(pt => mapWhilePreserve(pt, Math.round));
  if (pts.some(pt => pt.some(n => Number.isNaN(n)||!Number.isFinite(n)))) return;
  let ptOutsideList = [];
  for (let pt of pts) {
    let outside = [];
    if (pt[0] < 0) outside.push(1);
    if (pt[0] > canvas.width) outside.push(2);
    if (pt[1] < 0) outside.push(3);
    if (pt[1] > canvas.height) outside.push(4);
    ptOutsideList.push(outside)
  }
  if (ptOutsideList.every(outside => outside.length > 0) && ptOutsideList.every(outside => outside.every(location => ptOutsideList.every(list => list.includes(location))))) return;
  pts.sort((a, b) => a[1]-b[1]);
  if (pts[1][1] === pts[2][1]) {drawTopTri(pts[0], pts[1], pts[2], canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel);return;}
  if (pts[0][1] === pts[1][1]) {drawBottomTri(pts[2], pts[1], pts[0], canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel);return;}
  let p4 = [pts[0][0] + ((pts[1][1] - pts[0][1]) / (pts[2][1] - pts[0][1])) * (pts[2][0] - pts[0][0]), pts[1][1]];
  p4.depth = interpolateDepth(pts[0].depth, pts[2].depth, p4[1]-pts[0][1], pts[2][1]-pts[0][1]);
  drawTopTri(pts[0], pts[1], p4, canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel);
  drawBottomTri(pts[2], p4, pts[1], canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel);
}
function drawPoly(pts, canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel=false) {
  for (let i = 0; i < pts.length-2; i++) {
    drawTri(pts[0], pts[i+1], pts[i+2], canvasData, depthBuffer, mtl, viewmodelBuffer, viewmodel);
  }
}


class matrix {
  constructor(list) {
    this.list = list;
    this.dim = [this.list.length, this.list[0].length];
  }
  multiply(other) {
    if (other.dim[0] !== this.dim[1]) return false;
    let newMatrix = matrix.dimensions(this.dim[0], other.dim[1]);
    for (let i = 0; i < this.dim[0]; i++) {
      for (let j = 0; j < other.dim[1]; j++) {
      	newMatrix.list[i][j] = this.list[i].map((el, idx) => el*other.list[idx][j]).reduce((a, b)=>a+b);
      }
    }
    return newMatrix;
  }
  static from(list) {return new matrix(list);}
  static dimensions(r, c) {
    let list = [];
    for (let i = 0; i < r; i++) {
      list.push((new Array(c)).fill(0));
    }
    return new matrix(list);
  }
  static identity(n) {
    let list = [];
    for (let i = 0; i < n; i++) {
      list.push([]);
      for (let j = 0; j < n; j++) {
        if (i === j) list.at(-1).push(1);
        else list.at(-1).push(0);
      }
    }
    return new matrix(list);
  }
}

//a custom class for 3d objects that allows movement and rotation
class Shape {
  constructor(polys) {
    this.polys = polys;
    this.offset = [0, 0, 0];
    this.rotate = [0, 0, 0];
    this.speed = 0;
    this.rotatedPolys = null;
  }
  move(offset) {
    this.offset = this.offset.map((el, idx) => el+offset[idx]);
    this.polys = this.polys.map(poly => {
      let newPoly = poly.map(pt => pt.map((el, idx) => Number(el)+offset[idx]));
      newPoly.mtl = poly.mtl;
      newPoly.cross = poly.cross;
      return newPoly;
    });
    if (this.rotatedPolys !== null) {
      this.rotatedPolys = this.rotatedPolys.map(poly => {
        let newPoly = poly.map(pt => pt.map((el, idx) => Number(el)+offset[idx]));
        newPoly.mtl = poly.mtl;
        newPoly.cross = poly.cross;
        return newPoly;
      });
    }
  }
  moveInDirection(dist) {
    this.move(times(vecFromAngle(this.rotate), dist));
  }
  turn(direction) {
    this.rotate = this.rotate.map((n, idx) => n + direction[idx]);
    direction = this.rotate;
    let rotationX = matrix.from([[Math.cos(direction[2]), -Math.sin(direction[2]), 0], [Math.sin(direction[2]), Math.cos(direction[2]), 0], [0, 0, 1]]);
    let rotationY = matrix.from([[Math.cos(direction[0]), 0, Math.sin(-direction[0])], [0, 1, 0], [Math.sin(direction[0]), 0, Math.cos(direction[0])]]);
    let rotationZ = matrix.from([[1, 0, 0], [0, Math.cos(-direction[1]), -Math.sin(-direction[1])], [0, Math.sin(-direction[1]), Math.cos(-direction[1])]]);
    let fullRotation = rotationY.multiply(rotationZ).multiply(rotationX);
    
    this.rotatedPolys = this.polys.map(poly => {
      let pts = poly.map(pt => [[pt[0]-this.offset[0]], [pt[1]-this.offset[1]], [pt[2]-this.offset[2]]]);
      pts = pts.map(pt => (fullRotation.multiply(matrix.from(pt)).list));
      pts = pts.map(pt => [[Number(pt[0][0]+this.offset[0])], [Number(pt[1][0]+this.offset[1])], [Number(pt[2][0]+this.offset[2])]]);
      let newPoly = pts;
      newPoly.mtl = poly.mtl;
      return newPoly;
    });
    this.updateCrossProducts(true);
  }
  resetTurn() {
    this.rotatedPolys = null;
    this.rotate = [0, 0, 0];
  }
  updateCrossProducts(rotated=false) {
    for (let poly of rotated ? this.rotatedPolys : this.polys) {
      poly.cross = crossPoly(poly);
    }
  }
  
}

//a lot of utility functions that were created out of necessity
function crossProduct(vec1, vec2) {
  return (matrix.from([[0, -vec1[2], vec1[1]], [vec1[2], 0, -vec1[0]], [-vec1[1], vec1[0], 0]])).multiply(matrix.from([[vec2[0]], [vec2[1]], [vec2[2]]]));
}
function crossPoly(pts) {
  return unit(crossProduct([pts[1][0]-pts[0][0], pts[1][1]-pts[0][1], pts[1][2]-pts[0][2]], [pts[2][0]-pts[1][0], pts[2][1]-pts[1][1], pts[2][2]-pts[1][2]]).list.flat());
}
function dotProduct(vec1, vec2) {
  return vec1.reduce((a, b, idx) => a+b*vec2[idx], 0);
}
function plus(pt1, pt2) {
  return pt1.map((n, idx) => n+pt2[idx]);
}
function minus(pt1, pt2) {
  return pt1.map((n, idx) => n-pt2[idx]);
}
function times(pt1, x) {
  return pt1.map((n) => n*x);
}
function angleBetween(pt1, center, pt2) {
  return Math.acos(dotProduct(unit(minus(pt1, center)), unit(minus(pt2, center))))
}
function center(list) {
  return list.reduce((a, b) => a.map((el, idx) => el+b[idx]/list.length), [0,0,0]);
}
function unit(list) {
  let dist = list.reduce((a, b) => a+b**2, 0)**0.5;
  if (dist === 0) return list;
  return list.map(n => n/dist);
}
function distance(pt1, pt2) {
  if (pt2 === undefined) pt2 = [];
  return Math.sqrt(pt1.map((n, idx) => (n-(pt2[idx]||0))**2).reduce((a, b) => a+b));
}
function vecFromAngle(angle) {
  return [-Math.sin(angle[0])*Math.cos(angle[1]), Math.sin(angle[1]), Math.cos(angle[0])*Math.cos(angle[1])];
}
function deviate(angle, bloom) {
  let bloomAngle = Math.random()*2*Math.PI, bloomWidth = (Math.random()-.5)*bloom;
  return [angle[0] + Math.cos(bloomAngle)*bloomWidth/(Math.abs(Math.cos(camAngle[1]))),
    angle[1] + Math.sin(bloomAngle)*bloomWidth];
}
function leadAim(initPos, targetPos, speed, targetVel) {
  let collisionPos = targetPos, time = null;
  for (let i = 0; i < 5; i++) {
    time = Math.sqrt(collisionPos.map((n, idx) => (n-initPos[idx])**2).reduce((a, b) => a+b))/speed;
    collisionPos = targetPos.map((n, idx) => n+targetVel[idx]*time);
  }
  return [unit(collisionPos.map((n, idx) => n-initPos[idx])), collisionPos];
}
function distInDir(dirVec, init, pt) {
  if (init === null) init = [0, 0, 0];
  return dotProduct(unit(dirVec), pt.map((n, idx) => n-init[idx]));
}
//this function is the basis for all of the bullet and physics collisions - detect flat circle/3d tri collision
//assuming the circle and triangle are coplanar
//3 steps: 1, check if the point is within the triangle. 2, check if the radius is outside the triangle but the circle touches a vertex. 3, check if the radius is outside the triangle but the circle touches an edge
function ptHitsTri(pt, radius, tri, data) {
  if (data === undefined) data = {};
  let centroid = center(tri);
  let dist = Math.max(...tri.map(pt => distance(pt, centroid)));
  if (dist+radius < distance(pt, centroid)) return false;
  let firstpoint = tri.reduce((a, b) => angleBetween(a, centroid, pt) < angleBetween(b, centroid, pt) ? a : b);
  let previous = tri.at(tri.indexOf(firstpoint)-1);
  if (Math.abs(angleBetween(previous, centroid, firstpoint) - (angleBetween(previous, centroid, pt)+angleBetween(pt, centroid, firstpoint))) < 0.001) {
    secondpoint = previous;
  } else {
    secondpoint = tri.at(tri.indexOf(firstpoint)+1-tri.length);
  }
  let expectedDistance = Math.sin(angleBetween(centroid, firstpoint, secondpoint))*distance(centroid, firstpoint) / Math.sin(Math.PI-angleBetween(firstpoint, centroid, pt)-angleBetween(centroid, firstpoint, secondpoint));
  if (distance(centroid, pt) <= expectedDistance) {
    return data["vec"] ? times(data["poly"].cross, distInDir(data["poly"].cross, center(data["poly"]), data["sphereCenter"]) > 0 ? step : -step) : true;
  }
  if (radius === 0) return false;
  let distAlongSide = dotProduct(unit(minus(secondpoint, firstpoint)), minus(pt, firstpoint));
  if (distAlongSide < 0) {
    if (distance(firstpoint, pt) <= radius) return data["vec"] ? times(minus(data["sphereCenter"], firstpoint), step) : true;
  }
  let expectedOuterDistance = distance(firstpoint, pt) * Math.sin(angleBetween(pt, firstpoint, secondpoint));
  let distanceAlong = distance(firstpoint, pt) * Math.cos(angleBetween(pt, firstpoint, secondpoint))
  if (expectedOuterDistance <= radius) {
    return data["vec"] ? times(minus(data["sphereCenter"], plus(firstpoint, times(unit(minus(secondpoint, firstpoint)), distanceAlong))), step) : true;
  }
  return false;
}
//convert a sphere into a coplanar circle and check for collision
function sphereHitsPoly(sphereCenter, radius, poly, vec=false) {
  let trueCentroid = center(poly);
  let verticalDist = distInDir(poly.cross, trueCentroid, sphereCenter);
  if (Math.abs(verticalDist) < radius) {
    let crossSection = radius*Math.cos(Math.asin(Math.abs(verticalDist/radius)));
    if (poly.some(pt => distance(trueCentroid, pt) >= distance(trueCentroid, sphereCenter)-crossSection)) {
      return ptHitsTri(minus(sphereCenter, poly.cross.map(n => n*verticalDist)), crossSection, poly, {vec, sphereCenter, radius, poly});
    }
  }
  return false;
}
//find the angle against the cross product of the poly, find the distance along the ray that it should collide (the intersection between the polygon's plane and the ray), and check if the intersection lies on the polygon
function rayHitsPoly(start, poly, vector, maxDistance=Infinity) {
  vector = unit(vector);
  let centroid = center(poly);
  let dist = distInDir(poly.cross, centroid, start);
  let normal = dist < 0 ? poly.cross : times(poly.cross, -1);
  let angle = Math.acos(dotProduct(vector, normal));
  if (angle >= Math.PI/2) {return false;}
  let distance = Math.abs(dist)/Math.cos(angle);
  if (distance > maxDistance) return false;
  let potentialCollision = plus(start, times(vector, distance));
  if (ptHitsTri(potentialCollision, 0, poly)) {
    return {collision: potentialCollision, distance: distance};
  }
  return false;
}
//find if a line of sight is unblocked
function lineOfSight(start, shapes, end) {
  let vec = minus(end, start);
  let dist = distance(vec);
  for (let shape of shapes) {
    for (let poly of shape.rotatedPolys || shape.polys) {
      let collision = rayHitsPoly(start, poly, vec, dist);
      if (collision) return false;
    }
  }
  return true;
}
//shoot a ray through a set of polygons and if it hits some, find the closest hit
function findRaycast(start, shapes, vector) {
  let closest = null;
  for (let shape of shapes) {
    for (let poly of shape.rotatedPolys || shape.polys) {
      let collision = rayHitsPoly(start, poly, vector);
      if (collision && (closest === null || collision.distance < closest.distance)) {
        closest = collision;
        closest.poly = poly;
        closest.shape = shape;
      }
    }
  }
  return closest;
}

let camFollow = null;

let points = [];

let shapes = [];

function circle(x, y, radius) {
  ctx.arc(x, y, radius, 0, Math.PI*2);
  ctx.fill();
  ctx.closePath();
}

let camAngle = [0, 0], camPos = [0, 0, 0];

//convert a 3D coordinate into a 2D screen space coordinate, based on the FOV
function project(point) {
  return [-point[0]/(point[2])*Math.tan(Math.PI/2-FOV[0]/2)/2*canvas.width+canvas.width/2, -point[1]/Math.abs(point[2])*Math.tan(Math.PI/2-FOV[1]/2)/2*canvas.height+canvas.height/2];
}
function clear(canvas) {
	let ctx = canvas.getContext("2d");
	ctx.beginPath();
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.closePath();
}

//keep track of the last frame tick to monitor FPS
let lastTime = performance.now();

setInterval(function() {
  if (gameState === "playing" && !isLoading) {
    //if we were just playing and now we are not, we have just paused
    if (keys["p"] || document.pointerLockElement === null || !document.hasFocus()) gameState = "justPaused";
  }
  if (gameState === "playing" && !isLoading) {
    //dynamically maintain the resolution
    canvas.width = window.innerWidth/canvasDivision;
    canvas.height = window.innerHeight/canvasDivision;
    let cameraSpeed = 1;
    camFollow = player;
    if (camFollow === null) {} else if (hp > 0) {
      camPos[0] = camFollow.offset[0] + Math.sin(camAngle[0]) * cameraDistance * Math.cos(camAngle[1]);
      camPos[1] = camFollow.offset[1] - Math.sin(camAngle[1]) * cameraDistance + cameraDistance/5 + .3;
      camPos[2] = camFollow.offset[2] - Math.cos(camAngle[0]) * cameraDistance * Math.cos(camAngle[1]);
      player.turn([camAngle[0]-player.rotate[0], 0, 0]);

      //acceleration and movement from key inputs
      let accelVec = [0, 0];
      if (keys["w"]) accelVec = plus(accelVec, [-Math.sin(camAngle[0]), Math.cos(camAngle[0])]);
      if (keys["s"]) accelVec = plus(accelVec, [Math.sin(camAngle[0]), -Math.cos(camAngle[0])]);
      if (keys["a"]) accelVec = plus(accelVec, [Math.cos(camAngle[0]), Math.sin(camAngle[0])]);
      if (keys["d"]) accelVec = plus(accelVec, [-Math.cos(camAngle[0]), -Math.sin(camAngle[0])]);
      let horizVel = times(plus([playerVel[0], playerVel[2]], times(unit(accelVec), accelFactor*(keys["shift"]||aimFactor > 0 ? .3 : 1))), .5);
      playerVel = [horizVel[0], playerVel[1], horizVel[1]];
      let speed = distance([horizVel[0], Math.max(Math.abs(playerVel[1])-.2, 0), horizVel[1]]);
      sway += speed;
      //2x detailed physics - check horizontal movement first then vertical
      let physicsSteps = 2;
      for (let i = 0; i < physicsSteps; i++) {
        player.move([playerVel[0]/physicsSteps, 0, playerVel[2]/physicsSteps]);
        for (let poly of map.polys) {
          let collides = sphereHitsPoly(player.offset, playerRadius, poly, true);
          if (collides !== false) {
            while (sphereHitsPoly(player.offset, playerRadius, poly)) {
              player.move(collides);
              playerVel = [playerVel[0]+collides[0], playerVel[1], playerVel[2]+collides[2]];
            }
          }
        }
        player.move([0, playerVel[1]/physicsSteps, 0]);
        let hitGround = false;
        if (playerVel[1] !== 0) {
          for (let poly of map.polys) {
            let collides = sphereHitsPoly(player.offset, playerRadius, poly)
            if (collides !== false) {
              if (playerVel[1] < 0) {
                if (-playerVel[1] > 3) {
                  hp -= -playerVel[1]*4;
                  pain += .3;
                }
                hitGround = true;
              }
              while (sphereHitsPoly(player.offset, playerRadius, poly)) {
                player.move([0, playerVel[1] <= 0 ? step : -step, 0]);
              }
              playerVel[1] = 0;
              break;
            }
          }
        }
        if (hitGround && keys[" "]) {
          playerVel[1] += jumpSpeed;
        } else {
          playerVel[1] -= gravity/physicsSteps;
        }
        

        if (keys["r"] && weaponTraits.get(gun).ammo !== weaponTraits.get(gun).totalAmmo && !reloading) {
          reloading = true;
          reloadTime = weaponTraits.get(gun).reloadPerShot ? 
            weaponTraits.get(gun).reloadTime * (weaponTraits.get(gun).totalAmmo-weaponTraits.get(gun).ammo) : weaponTraits.get(gun).reloadTime;
        }

        weaponTraits.forEach((traits, otherGun) => {
          if (!reloading && keys[traits.slot.toString()] && otherGun !== gun) {
            if (shapes.includes(gun)) shapes.splice(shapes.indexOf(gun), 1);
            shapes.push(otherGun);
            gun = otherGun;
            shotCooldown = 10;
            equipTimer = shotCooldown;
            aimFactor = 0;
          }
        });

        //manipulate bloom/spread level and position of viewmodel based on current movement and recoil
        let idealBloom = Math.min(distance([playerVel[0], Math.max(0, Math.abs(playerVel[1])-gravity/2)*3, playerVel[2]])/5 * weaponTraits.get(gun).runningBloom + weaponTraits.get(gun).defaultBloom * (aimFactor === 1 ? 0.5 : 1), Math.PI/6);
        bloom += (idealBloom-bloom)*.7 + recoil*Math.PI/150;
        if (equipTimer === 0 && !reloading && (keys["q"] || rightMouseDown)) aimFactor = Math.min(aimFactor+1/6, 1);
        else aimFactor = Math.max(aimFactor-0.2, 0);
        gun.move(minus(weaponTraits.get(gun).normalPos.map((n, idx) => n+(weaponTraits.get(gun).aimPos[idx]-n)*aimFactor), gun.offset));
        gun.move([0, 0, -recoil/3]);
        gun.move([Math.sin(sway/5)*speed/7, Math.cos(sway/2.5)*-speed/10, 0])
        gun.turn(minus([0, recoil/30, 0], gun.rotate));
        gun.turn([(mouseMovement[0]*0.1+gun.rotate[0])*0.5, (-mouseMovement[1]*0.1+gun.rotate[1])*0.5, 0]);
        gun.move([0, -equipTimer/1.5, 0]);
        gun.turn([0, -equipTimer/20, 0]);
        if (reloading) {
          //reload animation (drop gun down then back up)
          gun.move([0, 15*weaponTraits.get(gun).normalPos[1]*Math.sin(reloadTime/(weaponTraits.get(gun).reloadPerShot ? 
          weaponTraits.get(gun).reloadTime * (weaponTraits.get(gun).totalAmmo-weaponTraits.get(gun).ammo) : weaponTraits.get(gun).reloadTime)*Math.PI), 0]);
          reloadTime -= 1;
          if (reloadTime <= 0) {
            weaponTraits.get(gun).ammo = weaponTraits.get(gun).totalAmmo;
            reloading = false;
          }
        }
        //if we are aiming, change the FOV and smoothly interpolate in between
        FOV = FOV.map((n, idx) => trueFOV[idx]*(weaponTraits.get(gun).fovFactor === undefined ? (1-aimFactor/5) : 
          1-(1-weaponTraits.get(gun).fovFactor)*aimFactor));
        recoil = Math.max((recoil-1)*.7, 0);
        
        shotCooldown = Math.max(shotCooldown-1, 0);
        equipTimer = Math.max(equipTimer-1, 0);

        //spawn a shot - first, calculate the shot angle based on camera angle and spread. then check map for ray collisions
        function spawnShot(startPos, angle, laserStartPos, damage, target) {
          if (target === undefined) target = [map];
          let shotVec = vecFromAngle(angle);
          let hit = findRaycast(startPos, target, shotVec);
          laserBeam(laserStartPos, hit ? hit.collision : plus(startPos, times(shotVec, 300)));
          if (hit !== null) {
            if (hit.shape === map) {
              let bulletHole = copyShape(bulletHoleTemplate);
              bulletHole.timer = 50;
              bulletHoles.push(bulletHole);
              bulletHole.move(minus(hit.collision, bulletHole.offset));
              let cross = hit.poly.cross;
              bulletHole.turn([Math.atan2(cross[2], cross[0])+Math.PI/2, Math.PI/2-Math.atan2(cross[1], Math.sqrt(cross[0]**2+cross[2]**2)), 0]);
              bulletHole.move(times(cross, distInDir(cross, startPos, center(hit.poly)) < 0 ? .16 : -.16));
              shapes.push(bulletHole);
            } else if (enemies.includes(hit.shape)) {
              if (damage !== undefined) {
                if (hit.poly.mtl === "Head") damage *= 2;
                hit.shape.health -= damage;
              }
              hitShot = (hit.shape.health === undefined || hit.shape.health) > 0 ? {state: 1, frames: 5} : {state: 2, frames: 10};
              if (hit.poly.mtl === "Head") hitShot.headshot = true; else hitShot.headshot = false;
            } else if (hit.shape === player) {
              if (damage !== undefined) {hp -= damage; pain += .2;}
            }
          }
        }
        
        //when we click, spawn a shot and change camera angle as well as viewmodel
        if (mouseDown && shotCooldown === 0 && weaponTraits.get(gun).ammo > 0 && !reloading) {
          if (!weaponTraits.get(gun).automatic) mouseDown = false;
          shotCooldown += weaponTraits.get(gun).cooldown;
          recoil += weaponTraits.get(gun).recoil*(.75+Math.random()/2);
          let shotAngle = deviate(camAngle, bloom);
          let barrelTip = [gun.offset[0], -gun.offset[1], Math.max(...gun.polys.map(poly => Math.max(...poly.map(pt => pt[2]))))];
          let barrelDist = 1;//distance(barrelTip);
          let barrelAngle = [Math.atan2(barrelTip[2], barrelTip[0])-Math.PI/2, Math.atan2(barrelTip[2], barrelTip[1])-Math.PI/2];
          let realGunPos = plus(camPos, times(vecFromAngle(camAngle.map((n, idx) => n+barrelAngle[idx])), barrelDist));
          camAngle = [camAngle[0] + (Math.random()-.5)/100, Math.min(Math.PI/2, camAngle[1]+recoil/80*(aimFactor === 1 ? .7 : 1))];
          weaponTraits.get(gun).ammo -= 1;
          if (weaponTraits.get(gun).shots === undefined) spawnShot(camPos, shotAngle, realGunPos, weaponTraits.get(gun).damage, [map, ...enemies]);
          else {
            for (let i = 0; i < weaponTraits.get(gun).shots; i++) {
              let newShot = deviate(shotAngle, weaponTraits.get(gun).spread);
              spawnShot(camPos, newShot, realGunPos, weaponTraits.get(gun).damage, [map, ...enemies]);
            }
          }
        }
      }
    }

    //update enemy list, bullet hole list, and bullet tracer list
    if (gameActive) {
        for (let i = 0; i < enemies.length; i++) {
        let enemy = enemies[i];
        if (enemy.health <= 0) {
          enemies.splice(i, 1);
          if (shapes.includes(enemy)) shapes.splice(shapes.indexOf(enemy), 1);
          i--;
          continue;
        }
        let angle = (Math.atan2(camPos[2]-enemy.offset[2], camPos[0]-enemy.offset[0])-Math.PI/2) - enemy.rotate[0];
        angle = Math.min(Math.abs(angle), Math.abs(Math.PI*2-angle)) === Math.abs(angle) ? angle : angle-Math.PI*2;
        enemy.turn([angle * .1, 0, 0]);
        if (Math.random() < enemyShotChance && lineOfSight(enemy.offset, [map], camPos)) {
          spawnShot(enemy.offset, deviate([enemy.rotate[0], -Math.atan2(distance([camPos[0], camPos[2]], [enemy.offset[0], enemy.offset[2]]), camPos[1]-enemy.offset[1])+Math.PI/2, enemy.rotate[1]], enemyBloom), enemy.offset, enemyDamage, [map, player]);
        }
      }
    }
    for (let i = 0; i < bulletHoles.length; i++) {
      let bulletHole = bulletHoles[i];
      if (bulletHole.timer <= 0) {
        bulletHoles.splice(i, 1);
        if (shapes.includes(bulletHole)) shapes.splice(shapes.indexOf(bulletHole), 1);
        i -= 1;
      }
      bulletHole.timer -= 1;
    }
    for (let i = 0; i < laserBeams.length; i++) {
      let laserBeam = laserBeams[i];
      if (laserBeam.timer <= 0) {
        laserBeams.splice(i, 1);
        if (shapes.includes(laserBeam)) shapes.splice(shapes.indexOf(laserBeam), 1);
        i -= 1;
      }
      laserBeam.timer -= 1;
    }

    //camera rotation matrices - see https://en.wikipedia.org/wiki/Rotation_matrix
    let yaw = matrix.from([[Math.cos(camAngle[0]), -Math.sin(camAngle[0]), 0], [Math.sin(camAngle[0]), Math.cos(camAngle[0]), 0], [0, 0, 1]]);
    let roll = matrix.from([[1, 0, 0], [0, Math.cos(camAngle[1]), -Math.sin(camAngle[1])], [0, Math.sin(camAngle[1]), Math.cos(camAngle[1])]]);
    let pitch = matrix.from([[Math.cos(camAngle[0]), 0, Math.sin(camAngle[0])], [0, 1, 0], [-Math.sin(camAngle[0]), 0, Math.cos(camAngle[0])]]);
    let transformCamera = roll.multiply(pitch);
    points = []

    //convert each shape into a list of transformed polygons
    let renderList = [];
    for (let shape of shapes) {
      let transformCache = new Map();
      for (let poly of (shape.rotatedPolys === null ? shape.polys : shape.rotatedPolys)) {
        let pts = poly.map(pt => [[pt[0]], [pt[1]], [pt[2]]]);

        let cross = poly.cross; if (shape.viewmodel) cross = unit(plus(times(vecFromAngle(camAngle), .4), cross));
        let dot = dotProduct(cross, unit([.5, -1, .5]));

        let cameraDot = dotProduct(cross, unit([pts[1][0]-camPos[0], pts[1][1]-camPos[1], pts[1][2]-camPos[2]]));
        if (!shape.viewmodel) {
          pts = pts.map(pt => {
            let str = JSON.stringify(pt);
            if (transformCache.has(str)) {
              return transformCache.get(str)
            } else {
              let transformed = transformCamera.multiply(matrix.from([[pt[0]-camPos[0]], [pt[1]-camPos[1]], [pt[2]-camPos[2]]])).list;
              transformCache.set(str, transformed);
              return transformed;
            }
          });
        }
        //clip polygons that pass partially behind the camera
        if (pts.some(pt => pt[2] < 0)) {
          pts = pts.map(pt => pt.map(arr=>arr[0]))
          let usable = pts.filter(pt => pt[2] > 0);
          if (usable.length >= 1) {
            let threshold = .08;
            let idx = pts.indexOf(usable[0]);
            let newPts = [];
            
            while (pts[idx%pts.length][2] > 0) {
              newPts.push(pts[idx%pts.length]);
              idx++;
            }
            let [last, curr] = [pts[(idx-1)%pts.length].map(Number), pts[idx%pts.length].map(Number)]
            let ratio = (threshold-curr[2])/(last[2]-curr[2]);
            let newPt = [curr[0]+ratio*(last[0]-curr[0]),curr[1]+ratio*(last[1]-curr[1]),threshold];

            while (pts[idx%pts.length][2] <= 0) idx++;
            if (!newPts.includes(pts[idx%pts.length])) lastPt = pts[idx%pts.length];
            [last, curr] = [pts[(idx-1)%pts.length].map(Number), pts[idx%pts.length].map(Number)];
            ratio = (threshold-curr[2])/(last[2]-curr[2]);
            newPts.push(newPt);
            newPts.push([curr[0]+ratio*(last[0]-curr[0]),curr[1]+ratio*(last[1]-curr[1]),threshold]);
            while (pts[idx%(pts.length)] != newPts[0]) {
              newPts.push(pts[idx%(pts.length)])
              idx++;
            }
            pts = newPts.map(pt => pt.map(n => [n]));
          } else continue;
        }
        let centroid = center(pts);
        
        if (!shape.viewmodel && cameraDot > 0) dot = -dot;
        let rgb = null;
        if (poly.mtl in materials) rgb = materials[poly.mtl];
        else rgb = [128, 128, 128];
        rgb = rgb.map(n => n*(1-dot/2.5));
        pts.mtl = rgb;
        pts.meanZ = Math.sqrt((centroid[0])**2+(centroid[1])**2+(centroid[2])**2);
        pts.viewmodel = shape.viewmodel === true;
        renderList.push(pts);
      }
    }

    //render each polygon
    renderList.sort((a, b) => b.meanZ-a.meanZ);
    var canvasData = ctx.createImageData(canvas.width, canvas.height);
    let depthBuffer = Object.create(null);
    let viewmodelBuffer = Object.create(null);
    for (let pts of renderList) {
      drawPoly(pts.map(pt => {let newPt = project(pt); newPt.depth = 1/pt[2][0];  return newPt;}), canvasData, depthBuffer, pts.mtl, viewmodelBuffer, pts.viewmodel);
    }
    //draw sky (solid color)
    for (let i = 0; i < canvasData.height; i++) {
      for (let j = 0; j < canvasData.width; j++) {
        let index = (j + i * canvas.width) * 4;
        if (depthBuffer[index] === undefined) {
          canvasData.data[index] = 135;
          canvasData.data[index+1] = 206;
          canvasData.data[index+2] = 235;
          canvasData.data[index+3] = 255;
        }  
      }
    }
    ctx.putImageData(canvasData, 0, 0);

    //UI elements including crosshair, ammo, and health
    let difference = performance.now()-lastTime;
    lastTime = performance.now();
    let fps = 1000/difference;
    if (showFPS) drawText(ctx, "FPS: " + Math.round(fps), canvas.width-114/canvasDivision, canvas.height-24/canvasDivision, 30/canvasDivision, "black", "left");
    
    ctx.fillStyle = "rgba(0, 0, 0, .5)";
    ctx.strokeStyle = `rgba(0, 0, 0, ${1-aimFactor/1})`;
    let totalBloom = Math.max(bloom + (weaponTraits.get(gun).spread || 0), Math.PI/500);
    let bloomX = project([-Math.cos(Math.PI/2-totalBloom/2), 0, Math.sin(Math.PI/2-totalBloom/2)])[0]-canvas.width/2, 
      bloomY = project([0, -Math.cos(Math.PI/2-totalBloom/2), Math.sin(Math.PI/2-totalBloom/2)])[1]-canvas.height/2;
    if (gameActive && showCrosshair) ctx.ellipse(canvas.width/2, canvas.height/2, bloomX, bloomY, 0, 0, Math.PI*2);
    ctx.stroke();
    let hpColor = `rgb(${Math.min((100-hp)*255/50, 255)}, ${Math.min(hp*255/50, 255)}, 0)`;
    ctx.beginPath();
    ctx.fillStyle = "black";
    if (showHP) {
      ctx.strokeWidth = 5;
      ctx.roundRect(canvas.width-143/canvasDivision, 17/canvasDivision, 126/canvasDivision, 26/canvasDivision, 13/canvasDivision);
      ctx.fill();
      ctx.closePath();
      ctx.beginPath();
      ctx.fillStyle = hpColor;
      ctx.roundRect(canvas.width-140/canvasDivision, 20/canvasDivision, Math.max(120*hp/100/canvasDivision, 2), 20/canvasDivision, 10/canvasDivision);
      ctx.fill();
    }
    if (showAmmo) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.roundRect(0, canvas.height-250/canvasDivision, 300/canvasDivision, 170/canvasDivision, 5);
      ctx.fill();
      ctx.textAlign = "center";
      drawText(ctx, weaponTraits.get(gun).name, 150/canvasDivision, canvas.height-200/canvasDivision, 50/canvasDivision, "white");
      drawText(ctx, reloading ? "Reloading" : `${weaponTraits.get(gun).ammo}/${weaponTraits.get(gun).totalAmmo}`, 150/canvasDivision, canvas.height-130/canvasDivision, 50/canvasDivision, (reloading || weaponTraits.get(gun).ammo === 0) ? "red" : "white");
    }
    if (hitShot.frames > 0 && showHits) {
      if (hitShot.state === 1) ctx.drawImage(hitMarker, canvas.width/2+100/canvasDivision, canvas.height/2-50/canvasDivision, 100/canvasDivision, 100/canvasDivision);
      else ctx.drawImage(skullIcon, canvas.width/2+100/canvasDivision, canvas.height/2-50/canvasDivision, 100/canvasDivision, 100/canvasDivision);
      if (hitShot.headshot) ctx.drawImage(headshot, canvas.width/2+225/canvasDivision, canvas.height/2-50/canvasDivision, 100/canvasDivision, 100/canvasDivision);
    } else hitShot.headshot = false;
    hitShot.frames -= 1;
    pain = gameActive ? Math.min(pain, .4) : pain;
    ctx.fillStyle = pain >= 0 ? `rgba(255, 0, 0, ${pain})` : `rgba(0, 255, 0, ${-pain})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
		
    pain = gameActive ? Math.max(pain-0.05, 0) : pain;

    //check for game over
    if (gameActive) {
      if (hp <= 0) {
        gameActive = false; resume.visible = false;
        pain = .4;
        shapes.splice(shapes.indexOf(gun), 1);
      }
      if (enemies.length === 0) {
        gameActive = false; resume.visible = false;
        pain = 0;
      }
    } else {
      if (hp <= 0) {
        pain += 0.01;
        accelFactor = 0;
        ctx.globalAlpha = Math.min(pain, .8);
        drawText(ctx, "You Died!", canvas.width/2, 50/canvasDivision, 50/canvasDivision, "black", "center", "Georgia");
        ctx.globalAlpha = 1;
        if (pain >= 1) {gameState = "menu"; document.exitPointerLock();}
      }
      if (enemies.length <= 0) {
        pain -= 0.02;
        ctx.globalAlpha = -Math.max(pain, -.8);
        drawText(ctx, "Gehaald!", canvas.width/2, 50/canvasDivision, 50/canvasDivision, "black", "center", "Georgia");
        accelFactor *= .95;
        ctx.globalAlpha = 1;
        if (pain <= -1) {gameState = "menu"; document.exitPointerLock();}
      }
    }
    //maintain a specific framerate by changing resolution
    if (fps < frameBounds[0]) canvasDivision += 0.25;
    if (fps > frameBounds[1]) canvasDivision -= 0.25;
  }
  canvas.style.cursor = "auto";
  if (gameState === "paused") {
    //if mouse down while paused, resume
    if (mouseDown) {
      (async function() {
        await canvas.requestPointerLock();
        if (document.pointerLockElement === canvas) {
          gameState = "playing";
          mouseDown = false;
        }
      })();
    }
  }
  if (gameState === "justPaused") {
    //pause screen
    document.exitPointerLock();
    gameState = "paused";
    ctx.fillStyle = "rgba(175, 175, 175, 0.8)";
    ctx.beginPath();
    ctx.roundRect(canvas.width/2-300/canvasDivision, canvas.height/2-200/canvasDivision, 600/canvasDivision, 215/canvasDivision, 5);
    ctx.fill();
    drawText(ctx, "Pauze.", canvas.width/2, canvas.height/2-140/canvasDivision, 60/canvasDivision, "black", "center", "Helvetica");
    drawText(ctx, "Klik ergens om door te gaan.", canvas.width/2, canvas.height/2-80/canvasDivision, 40/canvasDivision, "black", "center", "Helvetica");
    drawText(ctx, "M voor het menu.", canvas.width/2, canvas.height/2-30/canvasDivision, 40/canvasDivision, "black", "center", "Helvetica");
  }
  if ((gameState === "playing" || gameState === "paused") && keys["m"]) {
    //return to menu if m is pressed
    gameState = "menu";
    document.exitPointerLock();
  }
  if (gameState === "menu" || gameState === "credits" || gameState === "instructions") {
    //draw and handle buttons
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    clear(canvas);
    ctx.fillStyle = "lightblue";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState === "menu") {
      let [width, height] = [getComputedStyle(canvas).width.replace("px", ""), getComputedStyle(canvas).height.replace("px", "")].map(Number);
      ctx.drawImage(thumbnail, width/2-(width+50)/2-(mouseX-50)/2, height/2 - (height+50)/2-(mouseY-50)/2, width+50, height+50);
      ctx.drawImage(logo, canvas.width/2-logo.width*.65, 30, logo.width, logo.height);
    }
    let hitButton = false;
    for (let button of Button.buttons) {
      if (button.visible && button.props.targetScreen === gameState) {
        button.draw();
        if (mouseDown && button.isHovering(mouseX, mouseY)) {
          button.props.event();
          hitButton = true;
        }
      }
    }
    if (!hitButton) mouseDown = false;
  }
  
  if (gameState === "credits") {
    drawText(ctx, "Credits", canvas.width/2, 30, 40, "black", "center", "Helvetica");
    drawText(ctx, "Valley Terrain door Zsky [CC-BY] (https://creativecommons.org/licenses/by/3.0/)", canvas.width/2, 70, 20, "black", "center", "Trebuchet MS");
    drawText(ctx, "via Poly Pizza (https://poly.pizza/m/u78ByZHYB2); modified", canvas.width/2, 92, 20, "black", "center", "Trebuchet MS");
  }
  if (gameState === "instructies") {
    drawText(ctx, "Instructies", canvas.width/2, 30, 40, "black", "center", "Helvetica");
    drawText(ctx, "WASD/spatie om te bewegen, muis om te schieten, nummers om guns te kiezen, q/RMK om te richten, shift om te lopen, en r voor reload", canvas.width/2, 70, 20, "black", "center", "Trebuchet MS");
  }
}, 30);

//object lists and spawn functions for bullet holes, tracers, and enemies
let bulletHoles = [];

let enemies = [];
function spawnEnemy(pos) {
  let enemy = copyShape(enemyTemplate);
  enemy.move(minus(pos, enemy.offset));
  let enemyHeight = Math.min(...map.polys.map(poly => Math.min(...poly.map(pt => pt[1]))));
  enemy.move([0, -enemyHeight/2, 0]);
  enemy.health = 100;
  enemies.push(enemy);
  shapes.push(enemy);
}

let bullets = [];
function spawnShot(from, target=false) {
  let shot = copyShape(bullet);
  shot.update(from.rotate[0], "yaw");
  shot.update(-from.rotate[1], "pitch");
  shot.move(from.offset.map((n, idx) => n-shot.offset[idx]));
  shot.moveInDirection(2+Math.random()-.5);
  shot.distance = 0;
  shapes.push(shot);
  bullets.push(shot);
  if (target && enemy !== null) {
    let lead = leadAim(player.offset, enemy.offset, bulletVel, [enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]].map(n=>n*enemyVel));
    let currentAim = [player.localFrame.roll[1], player.localFrame.roll[2], player.localFrame.roll[0]];
    if (Math.acos(dotProduct(unit(lead[1].map((n, idx) => n-player.offset[idx])), currentAim)) < aimAssistRange) {
      shot.localFrame.roll = [lead[0][2], lead[0][0], lead[0][1]];
    }
  }
  shot.localFrame.roll = unit(shot.localFrame.roll.map(n => n+(Math.random()-0.5)*0.05));
}

let laserBeams = [];
function laserBeam(pos1, pos2) {
  let width = .03;
  let laser = new Shape([[[pos1[0], pos1[1]+width, pos1[2]], [pos1[0], pos1[1]-width, pos1[2]], [pos2[0], pos2[1]-width, pos2[2]], [pos2[0], pos2[1]+width, pos2[2]]]]);
  for (let poly of laser.polys) {
    poly.mtl = "Bullet";
  }
  laser.updateCrossProducts();
  laser.timer = 1;
  laserBeams.push(laser);
  shapes.push(laser);
}


canvas.addEventListener("mousemove", function(e) {
  if (gameState === "playing") {
    let factor = FOV[0] / trueFOV[0];
    camAngle[0] += e.movementX/200 * factor;
    camAngle[1] = Math.max(Math.min(camAngle[1]-e.movementY/200*factor, Math.PI/2), -Math.PI/2);
    mouseMovement = [e.movementX/200, e.movementY/200];
  } else {
    let bd = canvas.getBoundingClientRect();
    let mousePos = [(e.clientX - bd.left)*canvas.width/Number(getComputedStyle(canvas).width.replace("px", "")), (e.clientY - bd.top)*canvas.height/Number(getComputedStyle(canvas).height.replace("px", ""))];
    mouseX = mousePos[0]/canvas.width*100; mouseY = mousePos[1]/canvas.height*100;
  }
});
canvas.addEventListener("mousedown", function(e) {
  if (e.button !== 0) {
    e.preventDefault(); e.stopPropagation();
    if (e.button === 2) {
      rightMouseDown = true;
    }return;
  }
  mouseDown = true;
});
canvas.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("mouseup", function(e) {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) rightMouseDown = false;
});

//menu buttons
class Button {
	static buttons = [];
	constructor(left, top, width, height, fill, text, targetScreen, event=function(){}) {
		this.props = {left, top, width, height, fill, text, targetScreen, event};
		Button.buttons.push(this);
		this.visible = true;
	}
	isHovering(x, y) {
		return this.visible && x >= this.props.left && x <= this.props.left + this.props.width && y >= this.props.top && y <= this.props.top + this.props.height;
	}
	draw() {
		ctx.beginPath();
		ctx.fillStyle = this.isHovering(mouseX, mouseY) ? "grey" : this.props.fill;
		ctx.roundRect(this.props.left*canvas.width/100, this.props.top*canvas.height/100, this.props.width*canvas.width/100, this.props.height*canvas.height/100, 3);
		ctx.fill();
		ctx.textAlign = "center";
		ctx.textBaseline = 'middle';
		drawText(ctx, this.props.text.value, (this.props.left+this.props.width/2)*canvas.width/100, 
      (this.props.top+this.props.height/2)*canvas.height/100, this.props.text.size, "black", "center", this.props.text.font);
		ctx.textBaseline = 'alphabetic';
		if (this.isHovering(mouseX, mouseY)) canvas.style.cursor = ("pointer");
	}
}
let play = new Button(40, 72.5, 15, 10, "rgb(150, 150, 150)", {value:"Begin", font:"Google Sans, monospace", size:20}, "menu", async function() {
  await canvas.requestPointerLock();
  if (document.pointerLockElement === canvas) {
    resetValues();
    gameState = "playing";
    resume.visible = true;
    mouseDown = false;
  }
});
let resume = new Button(40, 60, 15, 10, "rgb(150, 150, 150)", {value:"Ga door", font:"Google Sans, monospace", size:20}, "menu", async function() {
  await canvas.requestPointerLock();
  if (document.pointerLockElement === canvas) {
    gameState = "playing";
    mouseDown = false;
  }
});
resume.visible = false;
let credits = new Button(51.5, 85, 15, 10, "rgb(150, 150, 150)", {value:"Credits", font:"Google Sans, monospace", size:20}, "menu", function() {
  gameState = "credits";
  mouseDown = false;
});

let backhome = new Button(42.5, 70, 15, 10, "rgb(150, 150, 150)", {value:"Home", font:"Google Sans, monospace", size:20}, "credits", function() {
  gameState = "menu";
  mouseDown = false;
});
let backhome2 = new Button(42.5, 70, 15, 10, "rgb(150, 150, 150)", {value:"Home", font:"Google Sans", size:20}, "instructions", function() {
  gameState = "menu";
  mouseDown = false;
});

let thumbnail = new Image();
thumbnail.src = "assets/thumb_blurred.png";
let logo = new Image();
logo.src = "assets/logo.png";
let hitMarker = new Image();
hitMarker.src = "assets/crosshair.svg";
let skullIcon = new Image();
skullIcon.src = "assets/skull_icon.png";
let headshot = new Image();
headshot.src = "assets/headshot.png";

function drawText(ctx, text, x, y, size=10, color="black", align="center", font="Arial") {
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.font = size + "px " + font;
  ctx.fillText(text, x, y);
}

//unused obj file loader
let fileInput = document.querySelector("input[type=file]");
if (fileInput !== null) {
  fileInput.addEventListener("input", async function(e) {
    let fileType = this.files[0].name.match(/\.(\w+)$/)[1];
    let reader = new FileReader();
    reader.readAsText(this.files[0])
    reader.onload = () => {
      if (fileType === "obj") shapes.push(processObj(reader.result));
      else if (fileType === "mtl") processMtl(reader.result);
    }
  });
}
//create a clone of a shape that is not tied to the old one
function copyShape(shape) {
  let newShape = new Shape([]);
  for (let poly of shape.polys) {
    let newPoly = poly.map(pt => pt.map(n=>n));
    newPoly.mtl = poly.mtl;
    newShape.polys.push(newPoly);
  }
  newShape.updateCrossProducts();
  return newShape;
}

//parsing obj and mtl files to create objects
function processObj(text) {
  let vertices = text.match(/\nv (.+?) (.+?) (.+)/g);
  vertices = vertices.map(vertex => vertex.match(/ ([-\.\d]+)/g).map(Number));
  let shape = new Shape([]);
  let materialSections = text.match(/(usemtl .+)(\n|\r)+((?!usemtl).+?(\n|\r)?)+/g) || [text];
  for (let materialSection of materialSections) {
    let mtl = materialSection.match(/usemtl (.+)(\n|\r)/)?.[1];
    let polys = materialSection.match(/(\n|\r)f (\d+\/\d+\/\d+ ?)+/g);

    for (let poly of polys) {
      let pts = poly.match(/ \d+/g).map(pt => vertices[Number(pt)-1].map(n=>n));
      pts.mtl = mtl;
      shape.polys.push(pts);
    }
  }
  shape.offset = center(shape.polys.map(center))
  shape.updateCrossProducts();
  return shape;
}
let materials = {};
function processMtl(text) {
  let mtls = text.match(/[\n^]*newmtl ((.+)\n)+/g);
  for (let material of mtls) {
    let name = material.match(/[\n^] *newmtl (.+)\n/)[1];
    let color = material.match(/\n *Kd ((\d\.?\d*[ \n]){3})/)[1].split(" ").map(n=>256*Number(n));
    materials[name] = color;
  }
}


let keys = {};
let mouseDown = false, rightMouseDown = false;
let mouseX = 0, mouseY = 0;
function deShift(key) {
  if ("!@#$%^&*()".includes(key)) {
    return "1234567890"["!@#$%^&*()".indexOf(key)];
  }
  return key;
}
document.addEventListener("keydown", function(e) {
	keys[deShift(e.key.toLowerCase())] = true;
});
document.addEventListener("keyup", function(e) {
	delete keys[deShift(e.key.toLowerCase())];
});

//load all objects and materials
["bullet", "player", "desertmap", "enemy", "fire", "bullethole", "pistol", "smg", "shotgun", "sniper"].forEach(name => {
  fetch("assets/" + name + ".mtl").then(res => res.text()).then(mtl => {
    processMtl(mtl);
  });
});

let playerTemplate = null, mapTemplate = null, bullet = null, enemyTemplate = null, fireTemplate = null, bulletHoleTemplate = null, pistolTemplate = null, smgTemplate = null, shotgunTemplate = null, sniperTemplate = null;
Object.defineProperty(window, "isLoading", {
  get() {return [playerTemplate, mapTemplate, bullet, enemyTemplate, fireTemplate, bulletHoleTemplate, pistolTemplate, shotgunTemplate, sniperTemplate].some(template => template === null);},
});

fetch("assets/player.obj").then(res => res.text()).then(obj => {
  playerTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/bullet.obj").then(res => res.text()).then(obj => {
  bullet = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/bullethole.obj").then(res => res.text()).then(obj => {
  bulletHoleTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/desertmap.obj").then(res => res.text()).then(obj => {
  mapTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/enemy.obj").then(res => res.text()).then(obj => {
  enemyTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/fire.obj").then(res => res.text()).then(obj => {
  fireTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/pistol.obj").then(res => res.text()).then(obj => {
  pistolTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/smg.obj").then(res => res.text()).then(obj => {
  smgTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/shotgun.obj").then(res => res.text()).then(obj => {
  shotgunTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("assets/sniper.obj").then(res => res.text()).then(obj => {
  sniperTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
