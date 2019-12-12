const PLAYER_SIZE = 15;
const PLAYER_SPEED = 5;
const TEXT_FADE_AFTER = 1000;
const TEXT_FADE_SPEED = 500;
const SERVER = 'localhost';
var keys = [];
var game;
var scene, camera, renderer;

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

function startGame(name) {
	document.getElementById('main_doc').remove();
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	// var geometry = new THREE.BoxGeometry(1, 1, 1);
	// var material = new THREE.MeshBasicMaterial({
	// 	color: 0x00ff00
	// });
	// cube = new THREE.Mesh(geometry, material);
	// scene.add(cube);

	camera.position.z = 5;

	var div = document.createElement('div');
	div.className = 'overlay';
	div.style.top = -(window.innerHeight - 25) + 'px';
	document.body.appendChild(div);
	// game = new Game(name);
	// game.init();
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

function draw() {
	background(51);
	if (this.game && this.game.ready) {
		this.game.run();
	}
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
	cube.rotation.x += 0.01;
	cube.rotation.y += 0.01;
}

// function keyPressed() {
// 	keys[keyCode] = true;
// }
//
// function keyReleased() {
// 	keys[keyCode] = false;
// }