var express, app, server, io;
var players = [];

function len(namedArr) {
	return Object.getOwnPropertyNames(namedArr).length - 1;
}

function initServer(ip, port) {
	io = require("socket.io")();
	initSocketIO();
	server = io.listen(8000);
	console.log('Server started');
}

function initSocketIO() {
	io.on('connection', function(socket) {
		console.log('New client connection');
		players[socket.id] = {
			id: socket.id,
			conn: socket,
			other: undefined,
			state: 'none',
			name: ''
		}
		socket.on('enter_pool', data => {
			players[socket.id].state = 'waiting';
			players[socket.id].name = data;
		});
		socket.on('get_user_count', () => {
			socket.emit('user_count', len(players));
		});
		socket.on('disconnect', () => {
			delete players[socket.id];
			console.log('Client disconnect');
		});
	});
}

function idxOf(arr, id) {
	var idx = 0;
	arr.forEach((val, i) => {
		if (val.id == id) {
			idx = i
		}
	})
	return idx;
}

function run() {
	var avalPlayers = [];
	for (var i in players) {
		if (players[i].conn.disconnected) {
			delete players[i];
		} else if (players[i].state == 'waiting') {
			avalPlayers.push(players[i]);
		}
	}
	while (avalPlayers.length > 1) {
		var idx1 = Math.floor(Math.random() * avalPlayers.length);
		var idx2 = Math.floor(Math.random() * avalPlayers.length);
		while (idx1 == idx2) {
			idx2 = Math.floor(Math.random() * avalPlayers.length);
		}
		var p1 = avalPlayers[idx1];
		var p2 = avalPlayers[idx2];
		p1.other = p2;
		p2.other = p1;
		p1.state = 'playing';
		p2.state = 'playing';
		p1.conn.emit('start', p2.name);
		p2.conn.emit('start', p1.name);
		avalPlayers.splice(idxOf(avalPlayers, p1.id), 1);
		avalPlayers.splice(idxOf(avalPlayers, p2.id), 1);
	}
}


initServer('localhost', 8000);
setInterval(run, 1000 / 60);