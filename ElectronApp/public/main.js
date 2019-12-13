const TEXT_FADE_AFTER = 1000;
const TEXT_FADE_SPEED = 500;
const SERVER = 'localhost';
const MAP_CUBE_SIZE = 1;
const MAP_WIDTH = map[0].length * MAP_CUBE_SIZE;
const MAP_HEIGHT = map.length * MAP_CUBE_SIZE;
const SIM_STEP = 1;

var keys = [];
var game;
var scene, camera, renderer, light, ambiantLight, floor, tempBox;
var collisionMeshList = [];
var colliders = {};
var mouseX = 0;
var mouseY = 0;
var lastMouseX = 0;
var lastMouseY = 0;

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
	var geometry = new THREE.BoxGeometry(MAP_CUBE_SIZE, MAP_CUBE_SIZE * 1.5, MAP_CUBE_SIZE);
	var material = new THREE.MeshLambertMaterial({
		color: 0x515151
	});
	for (var i = 0; i < map.length; i++) {
		for (var j = 0; j < map[i].length; j++) {
			if (map[i][j] == 'w') {
				cube = new THREE.Mesh(geometry, material);
				cube.position.set(j * MAP_CUBE_SIZE, 0, i * MAP_CUBE_SIZE);
				cube.castShadow = true;
				cube.receivesShadow = true;
				collisionMeshList.push(cube);
				scene.add(cube);
			}
		}
	}
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

function startGame(name) {
	document.getElementById('main_doc').remove();
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	// scene.fog = new THREE.Fog(0xffffff, 1, 25);
	loadMap(map);
	camera.position.set(0, 5, 15);
	initMouseHook();
	var div = document.createElement('div');
	div.className = 'overlay';
	div.style.top = -(window.innerHeight - 25) + 'px';
	document.body.appendChild(div);
	game = new Game(name);
	game.init(camera);
	floor = new THREE.Mesh(
		new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
		new THREE.MeshLambertMaterial({
			color: 0x515151
		})
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.set(MAP_WIDTH / 2 - MAP_CUBE_SIZE / 2, -MAP_CUBE_SIZE / 2, MAP_HEIGHT / 2 - MAP_CUBE_SIZE / 2);
	floor.receivesShadow = true;
	floor.name = 'floor';
	// light = new THREE.PointLight(0xff0000, 4, 4);
	// light.position.set(7.5, 0.3, 1.5);
	// light.castShadow = true;

	ambiantLight = new THREE.AmbientLight(0xffffff, 0.4);

	var spotLight = new THREE.SpotLight(0xffffff, 1);
	spotLight.position.set(MAP_WIDTH / 2, 20, MAP_HEIGHT / 2);
	spotLight.castShadow = true;

	collisionMeshList.push(floor);
	scene.add(light, floor, ambiantLight, spotLight);

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
		console.log('Revert to pre-move');
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
		// var material = mesh.material.clone();
		// material.wireframe = true;
		// material.color.set(0x00ff00);
		var material = undefined;
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

var camRot = 0;

function animate() {
	requestAnimationFrame(animate);
	if (game) {
		game.run();
	}
	renderer.render(scene, camera);
	lastMouseX = mouseX;
	lastMouseY = mouseY;
}

function keyPressed(event) {
	keys[event.keyCode] = true;
}

function keyReleased(event) {
	keys[event.keyCode] = false;
}
window.addEventListener('keydown', keyPressed);
window.addEventListener('keyup', keyReleased);
window.onload = startGame;