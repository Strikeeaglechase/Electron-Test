const PLAYER_SIZE = 15;
const PLAYER_SPEED = 5;
var keys = [];
var p5Ready = false;
var game;
var canvas;

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
	return keys[letter.charCodeAt(0)];
}

function Player(game) {
	this.game = game;
	this.pos = new p5.Vector(50, 50);
	this.vel = new p5.Vector(0, 0);
	this.run = function() {
		this.draw();
	}
	this.draw = function() {
		noStroke();
		fill(150);
		ellipse(this.pos.x, this.pos.y, PLAYER_SIZE, PLAYER_SIZE);
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
			this.vel.mult(0.5);
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

function Game() {
	this.socket;
	this.id;
	this.player;
	this.ready = false;
	this.init = async function() {
		this.socket = io.connect(getURL().substring(7, getURL().length - 1))
		await this.initConnection(socket);
		this.id = socket.id;
		this.player = new Player(this);
		this.ready = true;
	}
	this.initConnection = function(socket) {
		return new Promise(function(resolve, reject) {
			socket.on('connect', () => {
				resolve();
				socket.on('event', data => {});
				socket.emit('enter_pool');
			});
		});
	}
}

function startGame() {
	if (!p5Ready) {
		return;
	} else {
		document.getElementById('main_doc').remove();
		canvas = createCanvas(windowWidth, windowHeight);
		var div = document.createElement('div');
		div.className = 'overlay';
		div.style.top = -(canvas.height - 25) + 'px';
		document.body.appendChild(div);
	}
}

function testOverlay(text) {
	var elm = document.createElement('h1');
	elm.innerText = text;
	$('.overlay')[0].appendChild(elm);
	return elm;
}

function setup() {
	p5Ready = true;
}

function draw() {
	background(51);
	// console.log($);
}

function keyPressed() {
	keys[keyCode] = true;
}

function keyReleased() {
	keys[keyCode] = false;
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}