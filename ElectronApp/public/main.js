const PLAYER_SIZE = 15;
const PLAYER_SPEED = 5;
const TEXT_FADE_AFTER = 1000;
const TEXT_FADE_SPEED = 500;
const SERVER = 'localhost';
const MAP_CUBE_SIZE = 1;
const MAP_WIDTH = map[0].length * MAP_CUBE_SIZE;
const MAP_HEIGHT = map.length * MAP_CUBE_SIZE;
var MOUSE_SENS = 0.001;
var keys = [];
var game;
var scene, camera, renderer, light, ambiantLight;
var mapMesh = [];
var floor;
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

function Player(game) {
	this.game = game;
	this.pos = new p5.Vector(50, 50);
	this.vel = new p5.Vector(0, 0);
	this.ellipse = two.makeCircle(this.pos.x, this.pos.y, PLAYER_SIZE);
	this.ellipse.noStroke();
	this.ellipse.fill = color(150);
	this.run = function() {
		this.draw();
		this.handleKeys();
		this.pos.add(this.vel);
	}
	this.draw = function() {
		noStroke();
		fill(150);
		if (!this.pos) {
			return;
		}
	}
	this.handleKeys = function() {
		if (k('w')) {
			this.vel.y = -PLAYER_SPEED;
		} else if (k('s')) {
			this.vel.y = PLAYER_SPEED;
		} else {
			this.vel.y = 0;
		}
		if (k('a')) {
			this.vel.x = -PLAYER_SPEED;
		} else if (k('d')) {
			this.vel.x = PLAYER_SPEED;
		} else {
			this.vel.x = 0;
		}
		if (this.vel.x && this.vel.y) {
			this.vel.mult(0.8);
		}
	}
	this.getData = function() {
		return {
			id: this.game.id,
			pos: {
				x: this.pos.x,
				y: this.pos.y
			},
			vel: {
				x: this.vel.x,
				y: this.vel.y
			}
		}
	}
}

function Game(username) {
	this.socket;
	this.id;
	this.player;
	this.opponent;
	this.ready = false;
	this.userCount = 0;
	this.state = 'none';
	this.userCountMsg = undefined;
	this.username = username;
	this.init = async function() {
		this.socket = io.connect(SERVER);
		await this.waitForConnection(this.socket);
		this.setupConnection(this.socket);
		this.id = this.socket.id;
		this.player = new Player(this);
		this.ready = true;
		this.state = 'waiting';
	}
	this.setupConnection = function(socket) {
		socket.emit('enter_pool', this.username);
		socket.on('user_count', data => {
			this.userCount = data;
		});
		socket.on('start', data => {
			this.state = 'playing';
			this.userCountMsg.remove();
			this.userCountMsg = undefined;
			textOverlay('Fighting: ' + data, true);
		});
		socket.on('other_disconnected', () => {
			this.state = 'waiting';
			socket.emit('enter_pool', this.username);
			textOverlay('Your opponent disconnected', true);
			this.opponent = {};
		});
		socket.on('game_data', data => {
			if (data.type == 'player_info') {
				this.opponent = data.player;
			}
		});
		setInterval(() => {
			socket.emit('get_user_count');
		}, 1000);
	}
	this.waitForConnection = function(socket) {
		return new Promise(function(resolve, reject) {
			socket.on('connect', resolve);
		});
	}
	this.run = function() {
		switch (this.state) {
			case 'waiting':
				if (!this.userCountMsg) {
					this.userCountMsg = textOverlay('Current users: ' + this.userCount);
				}
				this.userCountMsg.innerText = 'Waiting for opponent\nCurrent users: ' + this.userCount;
				break;
			case 'playing':
				this.player.run();
				this.socket.emit('game_data', {
					type: 'player_info',
					player: this.player.getData()
				});
				if (this.opponent) {
					this.player.draw.call(this.opponent);
				}
				break;
		}
	}
}

function loadMap(map) {
	var geometry = new THREE.BoxGeometry(1, 1, 1);
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
				scene.add(cube);
			}
		}
	}
}

function checkColl(mesh, meshList) {
	for (var vertexIndex = 0; vertexIndex < mesh.geometry.vertices.length; vertexIndex++) {
		var localVertex = mesh.geometry.vertices[vertexIndex].clone();
		var globalVertex = localVertex.applyMatrix4(mesh.matrix);
		var directionVector = globalVertex.sub(mesh.position);

		var ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
		var collisionResults = ray.intersectObjects(meshList);
		if (collisionResults.length > 0 && collisionResults[0].distance < directionVector.length()) {
			return true;
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
	loadMap(map);
	camera.position.set(0, 5, 15);
	initMouseHook();
	var div = document.createElement('div');
	div.className = 'overlay';
	div.style.top = -(window.innerHeight - 25) + 'px';
	document.body.appendChild(div);
	// game = new Game(name);
	// game.init();
	floor = new THREE.Mesh(
		new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
		new THREE.MeshBasicMaterial({
			color: 0xAAAAAA
		})
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.set(MAP_WIDTH / 2 - MAP_CUBE_SIZE / 2, 0, MAP_HEIGHT / 2 - MAP_CUBE_SIZE / 2);
	floor.receivesShadow = true;
	light = new THREE.PointLight(0xffffff, 1, 0);
	light.position.set(MAP_WIDTH / 2, 1.5, MAP_HEIGHT / 2);
	light.castShadow = true;
	ambiantLight = new THREE.AmbientLight(0xffffff, 0.2);
	scene.add(light, floor, ambiantLight);

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

// function draw() {
// 	background(51);
// 	if (this.game && this.game.ready) {
// 		this.game.run();
// 	}
// }

function animate() {
	requestAnimationFrame(animate);
	camera.rotation.y += (lastMouseX - mouseX) * MOUSE_SENS;
	// camera.rotation.x += (lastMouseY - mouseY) * MOUSE_SENS;
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