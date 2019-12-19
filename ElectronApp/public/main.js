const TEXT_FADE_AFTER = 1000;
const TEXT_FADE_SPEED = 500;
// const SERVER = 'http://localhost:8000';
const SERVER = 'http://10.72.61.253:8000'
const MAP_CUBE_SIZE = 1;
const MAP_WIDTH = map[0].length * MAP_CUBE_SIZE;
const MAP_HEIGHT = map.length * MAP_CUBE_SIZE;
const SIM_STEP = 1;
var ENABLE_LIGHTS = true;

var keys = [];
var game;
var scene, camera, renderer, floor, mapGroup;
var collisionMeshList = [];
var bulletColliders = [];
var mouseX = 0;
var mouseY = 0;
var lastMouseX = 0;
var lastMouseY = 0;
var isMousePressed = false;
var stats;
var lights = [];
var colliders = [];

Element.prototype.remove = function() {
	this.parentElement.removeChild(this);
}
NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
	for (var i = this.length - 1; i >= 0; i--) {
		if (this[i] && this[i].parentElement) {
			this[i].parentElement.removeChild(this[i]);
		}
	}
}

function k(letter) {
	return keys[letter.toUpperCase().charCodeAt(0)];
}

function loadMap(map) {
	console.log('Loading map');
	var geometry = new THREE.BoxGeometry(MAP_CUBE_SIZE, MAP_CUBE_SIZE * 4, MAP_CUBE_SIZE, 3, 3, 3);
	var material = new THREE.MeshLambertMaterial({
		color: 0x515151
	});
	var mapG = new THREE.Group();
	for (var i = 0; i < map.length; i++) {
		for (var j = 0; j < map[i].length; j++) {
			if (map[i][j] == 'w') {
				cube = new THREE.Mesh(geometry, material.clone());
				cube.position.set(j * MAP_CUBE_SIZE, 0, i * MAP_CUBE_SIZE);
				cube.castShadow = true;
				cube.receivesShadow = true;
				collisionMeshList.push(cube);
				mapG.add(cube);
				var box3 = new THREE.Box3();
				box3.setFromObject(cube);
				bulletColliders.push(box3);
			}
		}
	}
	mapG.position.set(0, 0, 0);
	mapG.name = 'map';
	scene.add(mapG);
	mapGroup = mapG;
}

function checkColl(mesh, meshList, ignoredUUID) {
	var originPoint = mesh.position.clone();
	if (ignoredUUID) {
		meshList = meshList.filter(m => m.uuid != mesh.uuid && !ignoredUUID.some(uid => m.uuid == uid));
	} else {
		meshList = meshList.filter(m => m.uuid != mesh.uuid);
	}
	for (var vertexIndex = 0; vertexIndex < mesh.geometry.vertices.length; vertexIndex++) {
		var localVertex = mesh.geometry.vertices[vertexIndex].clone();
		var globalVertex = localVertex.applyMatrix4(mesh.matrix);
		var directionVector = globalVertex.sub(mesh.position);
		var ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
		var collisionResults = ray.intersectObjects(meshList);
		if (collisionResults.length > 0 && collisionResults[0].distance < directionVector.length()) {
			return collisionResults;
		}
	}
	return false;
}

function initMouseHook() {
	var canvas = renderer.domElement;
	canvas.onclick = function() {
		canvas.requestPointerLock();
	}

	function updatePosition(e) {
		mouseX += e.movementX;
		mouseY += e.movementY;
	}

	function lockChangeAlert() {
		if (document.pointerLockElement === canvas ||
			document.mozPointerLockElement === canvas) {
			document.addEventListener("mousemove", updatePosition, false);
		} else {
			document.removeEventListener("mousemove", updatePosition, false);
		}
	}
	document.addEventListener('pointerlockchange', lockChangeAlert, false);
}

class ColorGUIHelper {
	constructor(object, prop) {
		this.object = object;
		this.prop = prop;
	}
	get value() {
		return `#${this.object[this.prop].getHexString()}`;
	}
	set value(hexString) {
		this.object[this.prop].set(hexString);
	}
}

function createLargeGlowElm(mesh) {
	var group = new THREE.Group();

	var glowMesh = new THREEx.GeometricGlowMesh(mesh);
	test = glowMesh;
	glowMesh.outsideMesh.material.uniforms.coeficient.value = 0.01;
	glowMesh.outsideMesh.material.uniforms.power.value = 3;
	glowMesh.insideMesh.material.uniforms.glowColor.value = mesh.material.color;
	glowMesh.outsideMesh.material.uniforms.glowColor.value = mesh.material.color;
	mesh.add(glowMesh.object3d);
	group.add(mesh);

	var light = new THREE.PointLight(mesh.material.color, 1, 4);
	light.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
	group.add(light);
	return group;
}

function createGlowElm(mesh) {
	var group = new THREE.Group();
	group.add(mesh);
	var light = new THREE.PointLight(mesh.material.color, 1, 4);
	light.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
	group.add(light);
	return group;
}

function loadLights() {
	var ambiantLight = new THREE.AmbientLight(0xffffff, 0.4);
	var spotLight = new THREE.SpotLight(0xffffff, 0.3);
	spotLight.position.set(MAP_WIDTH / 2, 20, MAP_HEIGHT / 2);
	spotLight.castShadow = true;
	lights.push(ambiantLight, spotLight);
	scene.add(ambiantLight, spotLight);
}

function initScene() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	floor = new THREE.Mesh(
		new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT, 16, 16),
		new THREE.MeshLambertMaterial({
			color: 0x515151,
			wireframe: false
		})
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.set(MAP_WIDTH / 2 - MAP_CUBE_SIZE / 2, -MAP_CUBE_SIZE / 2, MAP_HEIGHT / 2 - MAP_CUBE_SIZE / 2);
	floor.receivesShadow = true;
	floor.name = 'floor';
	if (ENABLE_LIGHTS) {
		loadLights();
	}

	collisionMeshList.push(floor);
	scene.add(floor);
}

function startGame(name) {
	document.getElementById('main_doc').remove();
	initScene();
	loadMap(map);
	camera.position.set(0, 5, 15);
	initMouseHook();

	var div = document.createElement('div');
	div.className = 'overlay';
	div.style.top = -(window.innerHeight - 25) + 'px';
	document.body.appendChild(div);

	game = new Game( /*name*/ 'name');
	game.init(camera);
	stats = new Stats();
	stats.showPanel(0);
	document.body.appendChild(stats.dom);
	animate();
}

function fadeElm(elm) {
	$(elm).animate({
		opacity: 0,
		top: "-=20px"
	}, TEXT_FADE_SPEED, "linear", () => elm.remove());
}

function textOverlay(text, doFade) {
	var elm = document.createElement('h2');
	elm.innerText = text;
	elm.style.position = 'relative'
	$('.overlay')[0].appendChild(elm);
	if (doFade) {
		setTimeout(fadeElm.bind(null, elm), TEXT_FADE_AFTER);
	}
	return elm;
}

function handleMotion(mesh) {
	if (mesh.velocity.length == 0) {
		return;
	}
	var tempRot = mesh.rotation.clone();
	mesh.rotation.set(0, 0, 0);
	mesh.updateMatrix();
	if (checkColl(mesh, collisionMeshList)) {
		mesh.position.x = mesh.lastPos.x;
		mesh.position.y = mesh.lastPos.y;
		mesh.position.z = mesh.lastPos.z;
	} else {
		mesh.lastPos = mesh.position.clone();
	}
	mesh.updateMatrix();
	mesh.rotation.set(tempRot.x, tempRot.y, tempRot.z);
	var collider = colliders[mesh.uuid];
	if (!collider) {
		var material = new THREE.MeshBasicMaterial({
			opacity: 0,
			transparent: true
		});
		var geometry = mesh.geometry.clone();
		collider = {
			x: new THREE.Mesh(geometry, material),
			y: new THREE.Mesh(geometry, material),
			z: new THREE.Mesh(geometry, material)
		}
		scene.add(collider.x, collider.y, collider.z);
		colliders[mesh.uuid] = collider;
	}
	var ret = '';
	for (var i = 0; i < SIM_STEP; i++) {
		var vel = mesh.velocity.clone().multiplyScalar(1 / SIM_STEP);
		for (var axis in collider) {
			var clone = collider[axis];
			clone.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
			clone.position[axis] += vel[axis] * 2.1;
			var col = checkColl(clone, collisionMeshList, [mesh.uuid]);
			if (col) {
				vel[axis] = 0;
				// console.log(col.map(f => f.faceIndex));
				if (col[0].object.name) {
					ret = col.name;
				}
			}
		}
		mesh.position.add(vel);
	}
	return ret;
}

function animate() {
	requestAnimationFrame(animate);
	stats.begin();
	if (game) {
		game.run();
	}
	if (ENABLE_LIGHTS && !lights.length) {
		loadLights()
	} else if (!ENABLE_LIGHTS && lights.length) {
		lights.forEach(light => scene.remove(light));
		lights = [];
	}
	renderer.render(scene, camera);
	lastMouseX = mouseX;
	lastMouseY = mouseY;
	stats.end();
}

function handleResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function keyPressed(event) {
	keys[event.keyCode] = true;
}

function keyReleased(event) {
	keys[event.keyCode] = false;
}

function onMouseDown(event) {
	if (event.button == 0) {
		isMousePressed = true;
	}
}

function onMouseUp(event) {
	if (event.button == 0) {
		isMousePressed = false;
	}
	this.game.click(event);
}
window.addEventListener('keydown', keyPressed);
window.addEventListener('keyup', keyReleased);
window.addEventListener("mousedown", onMouseDown);
window.addEventListener("mouseup", onMouseUp);
window.addEventListener('resize', handleResize);
window.onload = startGame;