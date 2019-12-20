const PLAYER_SIZE = 0.25;
const PLAYER_HEIGHT = 1
const PLAYER_SPEED = 0.02;
const PLAYER_STRAFE_SPEED_MULT = 0.7;
const PLAYER_DECL = 0.85;
const PLAYER_MAX_SPEED = 0.2;
const CAM_HIGHT_OFFSET = 0.25
const CTRL_ROT_OFFSET = -Math.PI / 2;
const GRAV = -0.01;
const JUMP_FORCE = 1;
const BULLET_SCALE = 0.015;
const BULLET_LIFE = 200;
const BULLET_SPEED = 1;
const BULLET_DMG = 5;
const BULLET_SIM_STEP = 2;
const GUN_SCALE = 0.04;
const DEFAULT_GUN_LERP_RATE = 0.2;
const ADS_SPEED_MULT = 0.7;
const FIRE_RATE = 5;
const OPACITY_PER_BULLET = 0.166;
const OPACITY_RESET_RATE = 0.016;
var ENABLE_AXIS_HELPER = false;
var ENABLE_GUI = false;
var MOUSE_SENS = 0.002;
var ENABLE_THIRD_PERSON = false;
var ENABLE_FLASH = false;
var HIT_FADE_RATE = 0.1;

const lerpRates = {
	vRot: 0.0646
};
var recoil = 0.0382;
var hRecoil = 0.02; //0.03;

var gui, stats2;
var a = 0;
var b = 0;
var c = 0;
var axisH;
var waitingForConnectionMsg, loader, assets;

function lerp(v0, v1, t) {
	return v0 * (1 - t) + v1 * t
}

function isInBounds(pos) {
	return !(pos.x < 0 || pos.y < 0 || pos.z < 0 || pos.x > MAP_WIDTH || pos.z > MAP_HEIGHT || pos.y > 20);
}

function Player(game, camera) {
	this.game = game;
	this.camera = camera;
	this.isLocalPlayer = !!camera;
	this.mesh;
	this.meshBB;
	this.gun;
	this.gunGroup;
	this.gunFlash;
	this.raycaster;
	this.gunOffset = {
		hip: {
			offsetX: 0.21,
			offsetY: -0.28,
			offsetZ: -0.42,
			vRot: 0,
		},
		ads: {
			offsetX: 0,
			offsetY: -0.18,
			offsetZ: -0.42,
			vRot: 0,
		},
		current: {
			offsetX: 0.21,
			offsetY: -0.18,
			offsetZ: -0.42,
			vRot: 0,
		}
	};
	this.gunMode = 'hip';
	this.hitOverlay;
	this.bullet;
	this.bullets = [];
	this.hp = 100;
	this.flashT = 0;
	this.fireT = 0;
	this.gunshotSound;
	this.ready = false;
	this.init = async function() {
		var geometry = new THREE.CylinderGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_HEIGHT, 10);
		var material = new THREE.MeshLambertMaterial({
			color: 0xB68642
		});
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.set(MAP_WIDTH / 2, PLAYER_HEIGHT, MAP_HEIGHT / 2);
		if (this.isLocalPlayer) {
			this.mesh.name = 'me';
			stats2 = new Stats();
			stats2.showPanel(1);
			stats2.domElement.style.cssText = 'position:absolute;top:0px;left:80px;';
			document.body.appendChild(stats2.dom);
		} else {
			this.mesh.name = 'opponent';
		}
		this.mesh.castShadow = true;
		this.mesh.receivesShadow = true;
		this.mesh.velocity = new THREE.Vector3(0, 0, 0);
		this.mesh.lastPos = this.mesh.position.clone();
		this.meshBB = new THREE.Box3();
		this.meshBB.name = this.isLocalPlayer ? 'me' : 'opponent';
		bulletColliders.push(this.meshBB);
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
		this.loadGun();
		if (this.camera) {
			if (ENABLE_GUI && !gui) {
				gui = new dat.GUI();
				gui.add(window, 'BULLET_SIM_STEP', 0, 20, 1);
				gui.add(window, 'BULLET_SPEED', 0, 2, 0.01);
				gui.add(window, 'c', -1, 1);
			}
		}
	}
	this.loadGun = function() {
		var object = assets.objects.gun.clone();
		var group = new THREE.Group();
		object.scale.set(GUN_SCALE, GUN_SCALE, GUN_SCALE);
		object.children.forEach(child => {
			// child.material.wireframe = true;
			child.material.color.set(0x444444);
		});
		object.castShadow = true;
		var redical = object.children[25];
		redical.material = new THREE.MeshBasicMaterial({
			color: 0xff0000
		})
		var intLight = new THREE.PointLight(0x00ffff, 0.5, 0.2);
		intLight.position.set(0, 0.18, 0.15);
		group.add(object, intLight);

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

		var object = assets.objects.bullet.clone();
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
	this.runLaser = function() {
		var ray = this.gun.children.find(child => child.name == 'laser');
		var orig = this.gun.children.find(child => child.name == 'laserEmitter').position.clone();
		var pt2 = this.gun.children.find(child => child.name == 'laserEmitter2').position.clone();
		var worldOrig = orig.clone().applyMatrix4(ray.matrixWorld);
		pt2.applyMatrix4(ray.matrixWorld);

		var dir = pt2.sub(worldOrig).normalize();
		this.raycaster.set(worldOrig, dir);
		var hitable = mapGroup.children.concat([floor, this.game.opponent.mesh]);
		var intersects = this.raycaster.intersectObjects(hitable);
		var d = 10000;
		if (intersects.length > 0) {
			d = intersects[0].distance;
		}
		var localDir = new THREE.Vector3(0, 0, -1).multiplyScalar(d);
		var endPt = orig.clone().add(localDir);
		this.ray.geometry.vertices[0] = orig;
		this.ray.geometry.vertices[1] = endPt;
		this.ray.geometry.verticesNeedUpdate = true;
	}
	this.run = function() {
		if (this.ready) {
			this.move();
			this.runBullets();
			this.moveGun();
			this.moveCamera();
			this.runLaser();
			if (this.isLocalPlayer) {
				this.handleKeys();
				this.handleShoot();
				this.checkDeath();
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
			this.meshBB.setFromObject(this.mesh);
		}
		this.fireT++;
	}
	this.checkDeath = function() {
		if (this.hp < 0) {
			textOverlay('You have died', true);
			this.hp = 100;
			this.game.socket.emit('game_data', {
				type: 'death'
			});
			this.game.end();
		}
	}
	this.moveGun = function() {
		this.gun.position.set(this.gunOffset.current.offsetX, this.gunOffset.current.offsetY, this.gunOffset.current.offsetZ);
		this.gun.rotation.x = this.gunOffset.current.vRot;
		var wanted = this.gunOffset[this.gunMode];
		for (var i in this.gunOffset.current) {
			this.gunOffset.current[i] = lerp(this.gunOffset.current[i], wanted[i], lerpRates[i] || DEFAULT_GUN_LERP_RATE);
		}
	}
	this.moveCamera = function() {
		if (this.isLocalPlayer) {
			var xDelta = (lastMouseX - mouseX) * MOUSE_SENS
			var yDelta = (lastMouseY - mouseY) * MOUSE_SENS
			this.cameraY.rotation.y += xDelta;
			this.cameraX.rotation.x += yDelta;
			this.cameraX.rotation.x = Math.max(-Math.PI / 2, Math.min(this.cameraX.rotation.x, Math.PI / 2));
		}
		if (!ENABLE_THIRD_PERSON) {
			this.cameraY.position.set(
				this.mesh.position.x,
				this.mesh.position.y + PLAYER_HEIGHT / 4 + CAM_HIGHT_OFFSET,
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
		stats2.begin();
		for (var i = 0; i < BULLET_SIM_STEP; i++) {
			this.bullets.forEach((bullet, idx) => {
				bullet.mover.translateY(BULLET_SPEED / BULLET_SIM_STEP);
				bullet.t += 1 / BULLET_SIM_STEP;
				var col = '';
				bulletColliders.forEach(collider => {
					if (collider.containsPoint(bullet.mover.position)) {
						col = collider.name;
					}
				});
				if (bullet.t > BULLET_LIFE || col || !isInBounds(bullet.mover.position)) {
					if (col == 'me') {
						this.hit();
					}
					scene.remove(bullet.mover);
					this.bullets.splice(idx, 1);
				}
			});
		}
		stats2.end();
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
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y + CTRL_ROT_OFFSET) * speed * PLAYER_STRAFE_SPEED_MULT;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y + CTRL_ROT_OFFSET) * speed * PLAYER_STRAFE_SPEED_MULT;
		}
		if (k('d')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y - CTRL_ROT_OFFSET) * speed * PLAYER_STRAFE_SPEED_MULT;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y - CTRL_ROT_OFFSET) * speed * PLAYER_STRAFE_SPEED_MULT;
		}
	}
	this.handleShoot = function() {
		if (isMousePressed && this.fireT > FIRE_RATE) {
			this.shoot();
		}
	}
	this.shoot = function() {
		var mover = new THREE.Object3D();
		mover.position.setFromMatrixPosition(this.bullet.matrixWorld);
		mover.rotation.setFromRotationMatrix(this.gun.matrixWorld);

		mover.rotateX(-Math.PI / 2)
		mover.translateY(0.5);

		if (ENABLE_AXIS_HELPER) {
			axisH.position.set(col.position.x, col.position.y, col.position.z);
			axisH.rotation.set(col.rotation.x, col.rotation.y, col.rotation.z);
		}

		var newBul = this.bullet.clone();
		newBul.position.set(0, -BULLET_SCALE * 2, 0);
		newBul.rotation.set(Math.PI, 0, Math.PI);
		newBul.visible = true;
		mover.add(newBul);

		this.bullets.push({
			mover: mover,
			t: 0
		});
		scene.add(mover);

		this.gunOffset.current.offsetY += hRecoil;
		this.gunOffset.current.vRot += recoil;
		if (ENABLE_FLASH) {
			this.gunFlash.visible = true;
			this.flashT = 2;
		}
		this.game.socket.emit('game_data', {
			type: 'new_bullet',
			bullet: {
				position: {
					x: mover.position.x,
					y: mover.position.y,
					z: mover.position.z
				},
				rotation: {
					x: mover.rotation.x,
					y: mover.rotation.y,
					z: mover.rotation.z
				}
			}
		});
		this.fireT = 0;
	}
	this.hit = function() {
		this.hitOverlay.material.opacity = Math.max(0, this.hitOverlay.material.opacity);
		this.hitOverlay.material.opacity += OPACITY_PER_BULLET;
		this.hp -= BULLET_DMG;
		this.game.socket.emit('game_data', {
			type: 'hit'
		});
	}
	this.spawnOpponetBullet = function(bullet) {
		var mover = new THREE.Object3D();
		mover.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
		mover.rotation.set(bullet.rotation.x, bullet.rotation.y, bullet.rotation.z);
		var newBul = this.bullet.clone();
		newBul.position.set(0, -BULLET_SCALE * 2, 0);
		newBul.rotation.set(Math.PI, 0, Math.PI);
		newBul.visible = true;
		mover.add(newBul);

		this.bullets.push({
			mover: mover,
			t: 0
		});

		scene.add(mover);
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
	this.hitSound;
	this.listener;
	this.hitmarker = document.getElementById('hitmarker');
	this.init = async function(camera) {
		this.socket = io.connect(SERVER);
		await this.waitForConnection(this.socket);
		this.setupConnection(this.socket);
		this.id = this.socket.id;
		this.player = new Player(this, camera);
		this.player.init();
		this.opponent = new Player(this);
		this.opponent.init();
		this.ready = true;
		this.listener = new THREE.AudioListener();
		this.hitSound = new THREE.Audio(this.listener);
		this.hitSound.setBuffer(assets.sounds.hit);
		this.hitSound.setLoop(false);
		this.hitSound.setVolume(0.3);
		camera.add(this.listener);
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
			} else if (data.type == 'new_bullet') {
				this.player.spawnOpponetBullet(data.bullet);
			} else if (data.type == 'death') {
				textOverlay('You win!', true);
				this.end();
			} else if (data.type == 'hit') {
				this.hitmarker.style.opacity = 1;
				if (this.hitSound.isPlaying) {
					this.hitSound.stop();
				}
				this.hitSound.play();
			}
		});
		setInterval(() => {
			socket.emit('get_user_count');
		}, 1000);
	}
	this.waitForConnection = function(socket) {
		waitingForConnectionMsg = textOverlay('Waiting for connection...', false);
		return new Promise(function(resolve, reject) {
			socket.on('connect', () => {
				waitingForConnectionMsg.remove();
				resolve();
			});
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
	this.end = function() {
		this.state = 'waiting';
		this.socket.emit('enter_pool', this.username);
	}
	this.draw = function() {
		if (this.player.ready) {
			this.socket.emit('game_data', {
				type: 'player_info',
				player: this.player.getData()
			});
			this.player.run();
			this.opponent.run();
			if (this.hitmarker.style.opacity > 0) {
				this.hitmarker.style.opacity -= HIT_FADE_RATE;
			}
		}
	}
	this.click = function(event) {
		if (event.button == 2) {
			this.player.gunMode = this.player.gunMode == 'hip' ? 'ads' : 'hip';
		}
	}
}