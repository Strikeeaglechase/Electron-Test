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