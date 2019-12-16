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
const BULLET_LIFE = 1;
const BULLET_SPEED = 1;

const GUN_SCALE = 0.04;
const DEFAULT_GUN_LERP_RATE = 0.2;
const ADS_SPEED_MULT = 0.7;
const FIRE_RATE = 5;
var MOUSE_SENS = 0.002;
var ENABLE_THIRD_PERSON = false;
var ENABLE_FLASH = false;
const lerpRates = {
	vRot: 0.1
};
const gunPosition = {
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
}
var recoil = 0.1;
var hRecoil = 0.03;
var gunMode = 'hip';
var gui;

var a = 0;
var b = 0;
var c = 0;
var axisH;

function lerp(v0, v1, t) {
	return v0 * (1 - t) + v1 * t
}

function Player(game, camera) {
	this.game = game;
	this.camera = camera;
	this.mesh;
	this.objectLoader = new THREE.OBJLoader();
	this.objectLoader.setPath('./Models/');
	this.mtlLoader = new THREE.MTLLoader();
	this.mtlLoader.setTexturePath('./Models/');
	this.mtlLoader.setPath('./Models/');
	this.gun;
	this.gunGroup;
	this.gunFlash;
	this.bullet;
	this.bullets = [];
	this.flashT = 0;
	this.fireT = 0;
	this.ready = false;
	this.init = function() {
		var geometry = new THREE.CylinderGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_HEIGHT, 10);
		var material = new THREE.MeshLambertMaterial({
			color: 0x515151
		});
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.set(MAP_WIDTH / 2, PLAYER_HEIGHT, MAP_HEIGHT / 2);
		this.mesh.castShadow = true;
		this.mesh.receivesShadow = true;
		this.mesh.velocity = new THREE.Vector3(0, 0, 0);
		this.mesh.lastPos = this.mesh.position.clone();
		collisionMeshList.push(this.mesh);
		scene.add(this.mesh);
		this.loadGun();
		this.cameraY = new THREE.Object3D();
		this.cameraX = new THREE.Object3D();
		this.cameraX.position.set(0, 0, 0);
		this.camera.position.set(0, 0, 0);
		this.cameraX.add(this.camera);
		this.cameraY.add(this.cameraX);
		scene.add(this.cameraY);
		gui = new dat.GUI();
		gui.add(window, 'a', -1, 1);
		gui.add(window, 'b', -1, 1);
		gui.add(window, 'c', -1, 1);
		axisH = new THREE.AxesHelper(1.5);
		scene.add(axisH);

	}
	this.loadGun = function() {
		var self = this;
		self.objectLoader.load(GUN_PATH + '.obj', function(object) {
			var group = new THREE.Group();
			// group.position.set(3, 0.45, 3);
			object.scale.set(GUN_SCALE, GUN_SCALE, GUN_SCALE);
			object.children.forEach(child => {
				child.material.wireframe = true;
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

			var flash = new THREE.PointLight(0xfff799, 0.3, 3);
			flash.position.set(0, 0, -1);
			flash.castShadow = false;
			flash.visible = false;

			self.gun = group;
			self.gunFlash = flash;
			group.add(light, mesh, flash);
			scene.add(group);
			self.cameraX.add(group);
			self.objectLoader.load(BULLET_PATH + '.obj', function(object) {
				object.position.set(0, 0.1, 0);
				object.rotation.set(0, 0, 0);
				object.children[0].material.color.set(0xffd700);
				object.scale.set(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE);
				object.visible = false;
				scene.add(object);
				self.bullet = object;
				self.gun.add(object);
				self.ready = true;
			});
		});
	}
	this.run = function() {
		if (this.ready) {
			this.handleKeys();
			this.move();
			this.moveCamera();
			this.runBullets();
			this.moveGun();
			this.handleShoot();
			if (ENABLE_FLASH) {
				this.flashT--;
				if (this.flashT < 0 && this.gunFlash) {
					this.gunFlash.visible = false;
				}
			}
			this.shoot();
		}
		this.fireT++;
	}
	this.moveGun = function() {
		this.gun.position.set(gunPosition.current.offsetX, gunPosition.current.offsetY, gunPosition.current.offsetZ);
		// this.gun.rotation.set(this.cameraX.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z);
		// this.gun.rotateOnAxis(new THREE.Vector3(1, 0, 0), gunPosition.current.vRot);
		var wanted = gunPosition[gunMode];
		for (var i in gunPosition.current) {
			gunPosition.current[i] = lerp(gunPosition.current[i], wanted[i], lerpRates[i] || DEFAULT_GUN_LERP_RATE);
		}
	}
	this.moveCamera = function() {
		var xDelta = (lastMouseX - mouseX) * MOUSE_SENS
		var yDelta = (lastMouseY - mouseY) * MOUSE_SENS
		this.cameraY.position.set(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z);
		this.cameraY.rotation.y += xDelta;
		this.cameraX.rotation.x += yDelta;
		this.cameraX.rotation.x = Math.max(-Math.PI / 2, Math.min(this.cameraX.rotation.x, Math.PI / 2));
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
			// bullet.collider.translateY(BULLET_SPEED);
			bullet.t++;
			if (bullet.t > BULLET_LIFE) {
				scene.remove(bullet.collider);
				this.bullets.splice(idx, 1);
			}
		});
	}
	this.handleKeys = function() {
		var speed = PLAYER_SPEED * (gunMode == 'ads' ? ADS_SPEED_MULT : 1);
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
		// var rot = new THREE.Euler();
		// rot.setFromRotationMatrix(this.bullet.matrixWorld);

		var col = new THREE.Mesh(
			new THREE.CylinderGeometry(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE * 7, 6), new THREE.MeshBasicMaterial({
				color: 0x00ffff,
				wireframe: true,
				transparent: false,
				opacity: 0
			})
		);
		col.position.set(vector.x, vector.y, vector.z)
		col.rotation.set(this.gun.rotation.x, this.gun.rotation.y, this.gun.rotation.z)

		// col.rotateX(-Math.PI / 2 + this.cameraX.rotation.x);
		// col.rotateZ(this.cameraY.rotation.y);

		col.rotateX(a);
		col.rotateY(b);
		col.rotateZ(c);

		axisH.position.set(col.position.x, col.position.y, col.position.z);
		axisH.rotation.set(col.rotation.x, col.rotation.y, col.rotation.z);

		var newBul = this.bullet.clone();
		newBul.position.set(0, BULLET_SCALE * 2, 0);
		newBul.rotation.set(Math.PI, 0, Math.PI);
		newBul.visible = true;
		col.add(newBul);

		this.bullets.push({
			bullet: newBul,
			collider: col,
			t: 0
		});
		scene.add(col);

		// gunPosition.current.vRot += recoil;
		// gunPosition.current.heightOffset += hRecoil;
		if (ENABLE_FLASH) {
			this.gunFlash.visible = true;
			this.flashT = 2;
		}
		this.fireT = 0;
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
	this.init = async function(camera) {
		// this.socket = io.connect(SERVER);
		// await this.waitForConnection(this.socket);
		// this.setupConnection(this.socket);
		// this.id = this.socket.id;
		this.player = new Player(this, camera);
		this.player.init();
		this.ready = true;
		this.state = 'playing';
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
				this.draw();
				break;
		}
	}
	this.draw = function() {
		// this.player.run();
		// this.socket.emit('game_data', {
		// 	type: 'player_info',
		// 	player: this.player.getData()
		// });
		// if (this.opponent) {
		// 	this.player.draw.call(this.opponent);
		// }
		this.player.run();
	}
	this.click = function(event) {
		if (event.button == 2) {
			gunMode = gunMode == 'hip' ? 'ads' : 'hip';
		}
	}
}