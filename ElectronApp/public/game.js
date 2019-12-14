const PLAYER_SIZE = 0.4;
const PLAYER_HEIGHT = 1.5
const PLAYER_SPEED = 0.02;
const PLAYER_DECL = 0.85;
const PLAYER_MAX_SPEED = 0.2;
const CTRL_ROT_OFFSET = -Math.PI / 2;
const GRAV = -0.01;
const JUMP_FORCE = 1;
const GUN_PATH = 'M4A1'
const GUN_SCALE = 0.04;
const DEFAULT_GUN_LERP_RATE = 0.2;
const ADS_SPEED_MULT = 0.7;
var MOUSE_SENS = 0.002;
var ENABLE_THIRD_PERSON = false;
const lerpRates = {
	vRot: 0.1
};
const gunPosition = {
	hip: {
		offset: -0.6,
		rot: -0.38,
		heightOffset: 0.08,
		vRot: 0,
	},
	ads: {
		offset: -0.5,
		rot: 0,
		heightOffset: 0.18,
		vRot: 0,
	},
	current: {
		offset: -0,
		rot: -0,
		heightOffset: 0,
		vRot: 0,
	}
}
var singleShotRecoil = 0.1;
var gunMode = 'hip';

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

		var self = this;
		self.objectLoader.load(GUN_PATH + '.obj', function(object) {
			self.gun = object;
			object.position.set(3, 0.45, 3);
			object.scale.set(GUN_SCALE, GUN_SCALE, GUN_SCALE);
			object.children.forEach(child => child.material.color.set(0x444444));
			object.children[25].material.color.set(0xff0000);
			scene.add(object);
		});
	}
	this.run = function() {
		this.handleKeys();
		this.move();
		this.moveCamera();
		if (this.gun) {
			this.moveGun();
		}
	}
	this.moveGun = function() {
		this.gun.position.set(
			this.mesh.position.x + Math.sin(this.mesh.rotation.y + gunPosition.current.rot) * gunPosition.current.offset,
			this.mesh.position.y + gunPosition.current.heightOffset,
			this.mesh.position.z + Math.cos(this.mesh.rotation.y + gunPosition.current.rot) * gunPosition.current.offset
		);
		this.gun.rotation.set(this.mesh.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z);
		this.gun.rotateOnAxis(new THREE.Vector3(1, 0, 0), gunPosition.current.vRot);
		var wanted = gunPosition[gunMode];
		for (var i in gunPosition.current) {
			gunPosition.current[i] = lerp(gunPosition.current[i], wanted[i], lerpRates[i] || DEFAULT_GUN_LERP_RATE);
		}
	}
	this.moveCamera = function() {
		if (!ENABLE_THIRD_PERSON) {
			this.camera.position.set(
				this.mesh.position.x,
				this.mesh.position.y + PLAYER_HEIGHT / 4,
				this.mesh.position.z
			);
		} else {
			this.camera.position.set(
				this.mesh.position.x + Math.cos(-this.mesh.rotation.y + Math.PI / 2) * 4,
				this.mesh.position.y + 2.5,
				this.mesh.position.z + Math.sin(-this.mesh.rotation.y + Math.PI / 2) * 4
			);
		}
		this.camera.rotation.set(this.mesh.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z);
	}
	this.move = function() {
		this.mesh.rotation.y += (lastMouseX - mouseX) * MOUSE_SENS;
		this.mesh.velocity.multiplyScalar(PLAYER_DECL);
		while (this.mesh.velocity.length() > PLAYER_MAX_SPEED) {
			this.mesh.velocity.multiplyScalar(0.99);
		}
		this.mesh.velocity.y += GRAV;
		handleMotion(this.mesh);
	}
	this.handleKeys = function() {
		var speed = PLAYER_SIZE * gunMode == 'ads' ? ADS_SPEED_MULT : 1;
		if (k('w')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y - Math.PI / 2 + CTRL_ROT_OFFSET) * PLAYER_SPEED;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y - Math.PI / 2 + CTRL_ROT_OFFSET) * PLAYER_SPEED;
		}
		if (k('s')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y + Math.PI / 2 + CTRL_ROT_OFFSET) * PLAYER_SPEED;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y + Math.PI / 2 + CTRL_ROT_OFFSET) * PLAYER_SPEED;
		}
		if (k('a')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y + CTRL_ROT_OFFSET) * PLAYER_SPEED;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y + CTRL_ROT_OFFSET) * PLAYER_SPEED;
		}
		if (k('d')) {
			this.mesh.velocity.z += Math.cos(this.mesh.rotation.y - CTRL_ROT_OFFSET) * PLAYER_SPEED;
			this.mesh.velocity.x += Math.sin(this.mesh.rotation.y - CTRL_ROT_OFFSET) * PLAYER_SPEED;
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
		if (event.button == 0) {
			gunPosition.current.vRot += singleShotRecoil;
		} else if (event.button == 2) {
			gunMode = gunMode == 'hip' ? 'ads' : 'hip';
		}
	}
}