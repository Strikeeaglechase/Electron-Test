const PLAYER_SIZE = 0.4;
const PLAYER_HEIGHT = 1.5
const PLAYER_SPEED = 0.02;
const PLAYER_DECL = 0.85;
const PLAYER_MAX_SPEED = 0.2;
const CTRL_ROT_OFFSET = -Math.PI / 2;
const GRAV = -0.01;
const JUMP_FORCE = 1;
const GUN_PATH = 'M4A1';
const BULLET_PATH = '50bmg_bullet';
const SHELL_PATH = '50bmg_shell';
const BULLET_SCALE = 0.015;
const BULLET_LIFE = 200;
const BULLET_SPEED = 1;
const BULLET_DMG = 5;
const GUN_SCALE = 0.04;
const DEFAULT_GUN_LERP_RATE = 0.2;
const ADS_SPEED_MULT = 0.7;
const FIRE_RATE = 5;
var OPACITY_PER_BULLET = 0.166;
var OPACITY_RESET_RATE = 0.016;
var ENABLE_AXIS_HELPER = false;
var MOUSE_SENS = 0.002;
var ENABLE_THIRD_PERSON = false;
var ENABLE_FLASH = false;

var objectLoader;
var loadDone = false;
var loadingObjects = 0;
var objects = {};

const lerpRates = {};
var recoil = 0.1;
var hRecoil = 0.03;
var gui;

var a = 0;
var b = 0;
var c = 0;
var axisH;

function load(name, path) {
	loadingObjects++;
	self.objectLoader.load(path + '.obj', function(object) {
		objects[name] = object;
		loadingObjects--;
		loadDone = loadingObjects == 0;
	});
}

function loadObjects() {
	objectLoader = new THREE.OBJLoader();
	objectLoader.setPath('./Models/');
	load('bullet', BULLET_PATH);
	load('gun', GUN_PATH);
}

function lerp(v0, v1, t) {
	return v0 * (1 - t) + v1 * t
}

function isInBounds(pos) {
	return !(pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x > MAP_WIDTH || pos.z > MAP_HEIGHT || pos.y > 20);
}

function waitFor(obj, varName) {
	return new Promise(resolve => {
		var interv = setInterval(() => {
			if (window[varName]) {
				clearInterval(interv);
				resolve();
			}
		});
	});
}

var gui;
var a = 0;
var b = 0;
var c = 0;

function Player(game, camera) {
	this.game = game;
	this.camera = camera;
	this.isLocalPlayer = !!camera;
	this.mesh;
	this.gun;
	this.gunGroup;
	this.gunFlash;
	this.raycaster;
	this.gunOffset = {
		hip: {
			offsetX: 0.21,
			offsetY: -0.28,
			offsetZ: -0.42,
		},
		ads: {
			offsetX: 0,
			offsetY: -0.18,
			offsetZ: -0.42,
		},
		current: {
			offsetX: 0.21,
			offsetY: -0.18,
			offsetZ: -0.42,
		}
	};
	this.gunMode = 'hip';
	this.hitOverlay;
	this.bullet;
	this.bullets = [];
	this.hp = 100;
	this.flashT = 0;
	this.fireT = 0;
	this.ready = false;
	this.init = async function() {
		var geometry = new THREE.CylinderGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_HEIGHT, 10);
		var material = new THREE.MeshLambertMaterial({
			color: 0x515151
		});
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.set(MAP_WIDTH / 2, PLAYER_HEIGHT, MAP_HEIGHT / 2);
		if (!this.isLocalPlayer) {
			this.mesh.position.z += 2;
		}
		this.mesh.castShadow = true;
		this.mesh.receivesShadow = true;
		this.mesh.velocity = new THREE.Vector3(0, 0, 0);
		this.mesh.lastPos = this.mesh.position.clone();
		collisionMeshList.push(this.mesh);
		scene.add(this.mesh);
		this.cameraY = new THREE.Object3D();
		this.cameraX = new THREE.Object3D();
		this.cameraX.position.set(0, 0, 0);
		if (camera) {
			this.hitOverlay = new THREE.Mesh(
				new THREE.PlaneGeometry(0.3, 0.3),
				new THREE.MeshBasicMaterial({
					color: 0xff0000,
					transparent: true,
					opacity: 0
				})
			);
			scene.add(this.hitOverlay);
			this.hitOverlay.position.set(0, 0, -0.1);
			this.camera.position.set(0, 0, 0);
			this.cameraX.add(this.hitOverlay);
			this.cameraX.add(this.camera);
		}
		this.cameraY.add(this.cameraX);
		scene.add(this.cameraY);
		await waitFor(this, 'loadDone');
		this.loadGun();
		if (this.camera) {
			gui = new dat.GUI();
			gui.add(window, 'a', 0, 0.2);
			gui.add(window, 'b', 0, 0.2);
			gui.add(window, 'c', -1, 1);
		}
	}
	this.loadGun = function() {
		var object = objects.gun.clone();
		var group = new THREE.Group();
		object.scale.set(GUN_SCALE, GUN_SCALE, GUN_SCALE);
		object.children.forEach(child => {
			// child.material.wireframe = true;
			child.material.color.set(0x444444);
		});
		object.children[25].material.color.set(0xff0000);
		group.add(object);

		var light = new THREE.SpotLight(0xffffff, 1);
		light.position.set(0, 0, -0.1);
		light.angle = 0.6;
		light.penumbra = 1;
		var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({
			opacity: 0,
			transparent: true
		}));
		mesh.position.set(0, 0, -0.5);
		light.target = mesh;

		var vec = new THREE.Vector3(0, 0, -1);
		var orig = new THREE.Object3D();
		orig.position.set(0.068, 0.093, -0.15);
		orig.name = 'laserEmitter';
		var orig2 = new THREE.Object3D();
		orig2.position.set(0.068, 0.093, -0.2);
		orig2.name = 'laserEmitter2';
		this.raycaster = new THREE.Raycaster();
		var material = new THREE.LineBasicMaterial({
			// transparent: true,
			// opacity: 0,
			color: 0x0000ff
		});
		var geometry = new THREE.Geometry();
		geometry.vertices.push(
			orig.position.clone(),
			orig.position.clone().add(vec.clone().multiplyScalar(1000))
		);
		this.ray = new THREE.Line(geometry, material);
		this.ray.name = 'laser';
		this.ray.geometry.dynamic = true
		group.add(this.ray, orig, orig2);

		var flash = new THREE.PointLight(0xfff799, 0.3, 3);
		flash.position.set(0, 0, -1);
		flash.castShadow = false;
		flash.visible = false;

		this.gun = group;
		this.gunFlash = flash;
		group.add(light, mesh, flash);
		scene.add(group);
		this.cameraX.add(group);

		var object = objects.bullet.clone();
		object.position.set(0, 0.1, 0);
		object.rotation.set(0, 0, 0);
		object.children[0].material.color.set(0xffd700);
		object.scale.set(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE);
		object.visible = false;
		scene.add(object);
		this.bullet = object;
		this.gun.add(object);
		this.ready = true;
	}
	this.run = function() {
		if (this.ready) {
			this.move();
			this.runBullets();
			this.moveGun();
			this.moveCamera();
			if (this.isLocalPlayer) {
				this.handleKeys();
				this.handleShoot();
				var ray = this.gun.children.find(child => child.name == 'laser');
				var orig = this.gun.children.find(child => child.name == 'laserEmitter').position.clone();
				var pt2 = this.gun.children.find(child => child.name == 'laserEmitter2').position.clone();
				orig.applyMatrix4(ray.matrixWorld);
				pt2.applyMatrix4(ray.matrixWorld);

				var dir = pt2.sub(orig).normalize();
				this.raycaster.set(orig, dir);

				var intersects = this.raycaster.intersectObjects(mapGroup.children);
				var d = 10000;
				if (intersects.length > 0) {
					d = intersects[0].distance;
				}
				this.ray.geometry.vertices[0] = this.raycaster.ray.origin;
				this.ray.geometry.vertices[1] = this.raycaster.ray.origin.clone().add(dir.multiplyScalar(d));
				this.ray.geometry.verticesNeedUpdate = true;
				// scene.remove(this.ray);
				// var material = new THREE.LineBasicMaterial({
				// 	color: 0x0000ff
				// });
				// var geometry = new THREE.Geometry();
				// geometry.vertices.push(
				// 	this.raycaster.ray.origin,
				// 	this.raycaster.ray.origin.clone().add(dir.multiplyScalar(d))
				// );
				// this.ray = new THREE.Line(geometry, material);
				// scene.add(this.ray);

				this.hitOverlay.material.opacity -= OPACITY_RESET_RATE;
			}
			if (ENABLE_FLASH) {
				this.flashT--;
				if (this.flashT < 0 && this.gunFlash) {
					this.gunFlash.visible = false;
				}
			}
			if (ENABLE_AXIS_HELPER && !axisH) {
				axisH = new THREE.AxesHelper(1.5);
				scene.add(axisH);
			}
		}
		this.fireT++;
	}
	this.moveGun = function() {
		this.gun.position.set(this.gunOffset.current.offsetX, this.gunOffset.current.offsetY, this.gunOffset.current.offsetZ);
		var wanted = this.gunOffset[this.gunMode];
		for (var i in this.gunOffset.current) {
			this.gunOffset.current[i] = lerp(this.gunOffset.current[i], wanted[i], lerpRates[i] || DEFAULT_GUN_LERP_RATE);
		}
	}
	this.moveCamera = function() {
		if (this.isLocalPlayer) {
			var xDelta = (lastMouseX - mouseX) * MOUSE_SENS
			var yDelta = (lastMouseY - mouseY) * MOUSE_SENS
			this.cameraY.position.set(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z);
			this.cameraY.rotation.y += xDelta;
			this.cameraX.rotation.x += yDelta;
			this.cameraX.rotation.x = Math.max(-Math.PI / 2, Math.min(this.cameraX.rotation.x, Math.PI / 2));
		}
		if (!ENABLE_THIRD_PERSON) {
			this.cameraY.position.set(
				this.mesh.position.x,
				this.mesh.position.y + PLAYER_HEIGHT / 4,
				this.mesh.position.z
			);
		} else {
			this.cameraY.position.set(
				this.mesh.position.x, //+ Math.cos(-this.mesh.rotation.y + Math.PI / 2) * 4,
				this.mesh.position.y + 2.5,
				this.mesh.position.z //+ Math.sin(-this.mesh.rotation.y + Math.PI / 2) * 4
			);
		}
		this.mesh.rotation.y = this.cameraY.rotation.y;
		this.mesh.updateMatrix();
	}
	this.move = function() {
		this.mesh.velocity.multiplyScalar(PLAYER_DECL);
		while (this.mesh.velocity.length() > PLAYER_MAX_SPEED) {
			this.mesh.velocity.multiplyScalar(0.99);
		}
		this.mesh.velocity.y += GRAV;
		handleMotion(this.mesh);
	}
	this.runBullets = function() {
		this.bullets.forEach((bullet, idx) => {
			bullet.collider.translateY(BULLET_SPEED);
			bullet.t++;
			var col = checkColl(bullet.collider, collisionMeshList)
			if (bullet.t > BULLET_LIFE || col || !isInBounds(bullet.collider.position)) {
				scene.remove(bullet.collider);
				this.bullets.splice(idx, 1);
			}
		});
	}
	this.handleKeys = function() {
		var speed = PLAYER_SPEED * (this.gunMode == 'ads' ? ADS_SPEED_MULT : 1);
		if (k('w')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y - Math.PI / 2 + CTRL_ROT_OFFSET) * speed;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y - Math.PI / 2 + CTRL_ROT_OFFSET) * speed;
		}
		if (k('s')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y + Math.PI / 2 + CTRL_ROT_OFFSET) * speed;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y + Math.PI / 2 + CTRL_ROT_OFFSET) * speed;
		}
		if (k('a')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y + CTRL_ROT_OFFSET) * speed;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y + CTRL_ROT_OFFSET) * speed;
		}
		if (k('d')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y - CTRL_ROT_OFFSET) * speed;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y - CTRL_ROT_OFFSET) * speed;
		}
	}
	this.handleShoot = function() {
		if (isMousePressed && this.fireT > FIRE_RATE) {
			this.shoot();
		}
	}
	this.shoot = function() {
		scene.updateMatrixWorld();
		var vector = new THREE.Vector3();
		vector.setFromMatrixPosition(this.bullet.matrixWorld);
		var col = new THREE.Mesh(
			new THREE.CylinderGeometry(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE * 7, 6), new THREE.MeshBasicMaterial({
				color: 0x00ffff,
				wireframe: true,
				transparent: true,
				opacity: 0
			})
		);
		col.position.set(vector.x, vector.y, vector.z)
		col.rotation.set(this.gun.rotation.x, this.gun.rotation.y, this.gun.rotation.z)

		col.rotateY(this.cameraY.rotation.y + Math.PI);
		col.rotateX(Math.PI / 2 - this.cameraX.rotation.x);
		col.translateY(0.49);

		if (ENABLE_AXIS_HELPER) {
			axisH.position.set(col.position.x, col.position.y, col.position.z);
			axisH.rotation.set(col.rotation.x, col.rotation.y, col.rotation.z);
		}

		var newBul = this.bullet.clone();
		newBul.position.set(0, -BULLET_SCALE * 2, 0);
		newBul.rotation.set(Math.PI, 0, Math.PI);
		newBul.visible = true;
		col.add(newBul);

		this.bullets.push({
			bullet: newBul,
			collider: col,
			t: 0
		});
		scene.add(col);

		this.gunOffset.current.offsetY += hRecoil;
		if (ENABLE_FLASH) {
			this.gunFlash.visible = true;
			this.flashT = 2;
		}
		this.fireT = 0;
	}
	this.hit = function() {
		this.hitOverlay.material.opacity = Math.max(0, this.hitOverlay.material.opacity);
		this.hitOverlay.material.opacity += OPACITY_PER_BULLET;
		this.hp -= BULLET_DMG;
	}
	this.spawn = function(sp) {
		var pt = {
			x: 0,
			z: 0
		}
		map.forEach((row, i) => {
			row.split('').forEach((letter, j) => {
				if (letter == sp) {
					pt.x = j;
					pt.z = i;
				}
			});
		});
		this.mesh.position.x = (pt.x) * MAP_CUBE_SIZE;
		this.mesh.position.z = (pt.z) * MAP_CUBE_SIZE;
		this.mesh.lastPos = this.mesh.position.clone();
	}
	this.getData = function() {
		return {
			id: this.game.id,
			position: {
				x: this.mesh.position.x,
				y: this.mesh.position.y,
				z: this.mesh.position.z
			},
			velocity: {
				x: this.mesh.velocity.x,
				y: this.mesh.velocity.y,
				z: this.mesh.velocity.z
			},
			rotation: {
				x: this.mesh.rotation.x,
				y: this.mesh.rotation.y,
				z: this.mesh.rotation.z
			},
			offset: this.gunOffset.current,
			gunMode: this.gunMode,
			cXRot: this.cameraX.rotation.x,
			cYRot: this.cameraY.rotation.y
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
	this.init = async function(camera) {
		this.socket = io.connect(SERVER);
		loadObjects();
		await this.waitForConnection(this.socket);
		this.setupConnection(this.socket);
		this.id = this.socket.id;
		this.player = new Player(this, camera);
		this.player.init();
		this.opponent = new Player(this);
		this.opponent.init();
		this.opponent.mesh.position.set(2, 2, 2);
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
			if (this.userCountMsg) {
				this.userCountMsg.remove();
				this.userCountMsg = undefined;
			}
			textOverlay('Fighting: ' + data.name, true);
			this.player.spawn(data.sp);
		});
		socket.on('other_disconnected', () => {
			this.state = 'waiting';
			socket.emit('enter_pool', this.username);
			textOverlay('Your opponent disconnected', true);
		});
		socket.on('game_data', data => {
			if (data.type == 'player_info' && this.opponent) {
				this.opponent.mesh.position.x = data.player.position.x;
				this.opponent.mesh.position.y = data.player.position.y;
				this.opponent.mesh.position.z = data.player.position.z;
				this.opponent.mesh.rotation.x = data.player.rotation.x;
				this.opponent.mesh.rotation.y = data.player.rotation.y;
				this.opponent.mesh.rotation.z = data.player.rotation.z;
				this.opponent.mesh.velocity.x = data.player.velocity.x;
				this.opponent.mesh.velocity.y = data.player.velocity.y;
				this.opponent.mesh.velocity.z = data.player.velocity.z;
				this.opponent.gunOffset.current = data.player.offset;
				this.opponent.gunMode = data.player.gunMode;
				this.opponent.cameraX.rotation.x = data.player.cXRot;
				this.opponent.cameraY.rotation.y = data.player.cYRot;
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
				this.draw();
				break;
		}
	}
	this.draw = function() {
		if (this.player.ready) {
			this.socket.emit('game_data', {
				type: 'player_info',
				player: this.player.getData()
			});
			this.player.run();
			this.opponent.run();
		}
	}
	this.click = function(event) {
		if (event.button == 2) {
			this.player.gunMode = this.player.gunMode == 'hip' ? 'ads' : 'hip';
		}
	}
}