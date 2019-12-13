const PLAYER_SIZE = 0.4;
const PLAYER_HEIGHT = 1.5
const PLAYER_SPEED = 0.1;
const PLAYER_DECL = 0.95;
const PLAYER_MAX_SPEED = 0.2;
// const PLAYER_MAX_SPEED = Infinity;
const CTRL_ROT_OFFSET = -Math.PI / 2;
const GRAV = -0.01;
const JUMP_FORCE = 1;
var MOUSE_SENS = 0.002;


function Player(game, camera) {
	this.game = game;
	this.camera = camera;
	this.mesh;
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
	}
	this.run = function() {
		this.handleKeys();
		this.move();
		this.moveCamera();
	}
	this.moveCamera = function() {
		this.camera.position.set(
			this.mesh.position.x, //+ Math.cos(-this.mesh.rotation.y + Math.PI / 2) * 4,
			this.mesh.position.y + PLAYER_HEIGHT / 4, //+ 2.5,
			this.mesh.position.z //+ Math.sin(-this.mesh.rotation.y + Math.PI / 2) * 4
		);
		this.camera.rotation.set(this.mesh.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z);
		// var lookPt = this.mesh.position.clone();
		// lookPt.y += 1;
		// this.camera.lookAt(lookPt);
	}
	this.move = function() {
		this.mesh.rotation.y += (lastMouseX - mouseX) * MOUSE_SENS;
		this.mesh.velocity.multiplyScalar(0.90);
		while (this.mesh.velocity.length() > PLAYER_MAX_SPEED) {
			this.mesh.velocity.multiplyScalar(0.99);
		}
		this.mesh.velocity.y += GRAV;
		handleMotion(this.mesh);
	}
	this.handleKeys = function() {
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
}