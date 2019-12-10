var keys = [];
var p5Ready = false;
var game;

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

function Game() {
	this.socket = io.connect(getURL().substring(7, getURL().length - 1));
	this.player = new Player();
	this.initConnection(socket);
	this.initConnection = function(socket) {
		socket.on('connect', () => {
			socket.on('event', data => {});
		});
	}
}

function startGame() {
	if (!p5Ready) {
		return;
	} else {
		document.getElementById('main_doc').remove();
		createCanvas(windowWidth, windowHeight);
	}
}

function setup() {
	p5Ready = true;
}

function draw() {
	background(51);
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