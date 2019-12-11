var express, app, server, io;
var players = [];

function len(namedArr) {
	Object.getOwnPropertyNames(namedArr).length - 1;
}

function initServer(ip, port) {
	io = require("socket.io")();
	initSocketIO();
	server = io.listen(8000);
	console.log('Server started');
}

function initSocketIO() {
	io.on('connection', function(socket) {
		console.log('Got me a connection');
		players[socket.id] = {
			id: socket.id,
			conn: socket,
			otherId: undefined,
			state: 'none'
		}
		socket.on('enter_pool', () => {
			players[socket.id].state = 'waiting';
		});
		socket.on('get_user_count', () => {
			socket.emit('user_count', len(players));
		});
	});
}
initServer('localhost', 8000);