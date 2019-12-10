var express, app, server, io;

function initServer(ip, port) {
	express = require('express');
	app = express();
	server = app.listen(port, ip, onServerInit);
	app.use(express.static('public'));
	io = require('socket.io')(server);
	setInterval(handleHeartbeat, 50);
	initSocketIO();
}

function initSocketIO() {
	io.sockets.on('connection', function(socket) {});
}
initServer('167.71.181.0', 8000);