const EventEmitter = require('events');
const express = require('express');
const http = require('http');
const {WebSocketServer} = require('ws');

class Server extends EventEmitter {
	constructor(
		version = "1.0.0",
		serverName = "WebServer"
	) {
		super()
		this.version = version;
		this.serverName = serverName;
		this.serverWS;
		this.serverHTTP;
		const loadTime = new Date().getTime();
		this.serverID =`S_${loadTime}_${version}`;
		this.router
	}

	start(port) {
		const expressApp = express();
		const serverWS = new WebSocketServer({noServer: true});
		const serverHTTP = http.createServer(expressApp);
		this.router = expressApp
	
		// this.expressRoutes(expressApp);
	
		serverHTTP.listen(port);
	
		serverHTTP.on('upgrade', (request, socket, head) => {
			this.emit('log', 'D', 'Upgrade request received');
			this.emit('log')
			serverWS.handleUpgrade(request, socket, head, socket => {
				serverWS.emit('connection', socket, request);
			});
		});
	
		// Main websocket server functionality
		serverWS.on('connection', async socket => {
			this.emit('log', 'D', 'New client connected');
			socket.pingStatus = 'alive';
			socket.on('message', async (msgJSON)=>{
				await this.handleMessage(msgJSON, socket);
			});
			socket.on('close', ()=>{
				this.handleClose(socket);
			});
		});
	
		serverWS.on('error', error => {
			this.emit('log', 'E', 'Server failed to start or crashed, please check the port is not in use', error);
			process.exit(1);
		});
	
		serverWS.sendToAll = payload => {
			serverWS.clients.forEach(client => {
				this.sendTo(client, payload);
			});
		}

		this.serverWS = serverWS;
		this.serverHTTP = serverHTTP;

		setInterval(()=>{this.doPing(serverWS)}, 5 * 1000);
		return [serverHTTP, serverWS];
	}

	async handleMessage(msgJSON, socket) {
		let msgObj = {};
		try {
			msgObj = JSON.parse(msgJSON);
			if (msgObj.payload.command !== 'ping' && msgObj.payload.command !== 'pong') {
				this.emit('log', 'A', 'Received', msgObj);
			}
			const payload = msgObj.payload;
			const header = msgObj.header;
			if (typeof payload.source == 'undefined') {
				payload.source = 'default';
			}
			switch (payload.command) {
			case 'disconnect':
				this.emit('log', 'D', `${payload.data.ID} Connection closed`);
				break;
			case 'pong':
				socket.pingStatus = 'alive';
				break;
			case 'ping':
				socket.pingStatus = 'alive';
				this.sendTo(socket, {
					'module': 'core',
					'command': 'pong'
				});
				break;
			case 'error':
				this.emit('log', 'E', `Device ${header.fromID} has entered an error state`);
				this.emit('log', 'E', `Message: ${payload.error}`);
				break;
			default:
				this.emit('message', msgObj, socket)
			}
		} catch (e) {
			try {
				msgObj = JSON.parse(msgJSON);
				if (msgObj.payload.command !== 'ping' && msgObj.payload.command !== 'pong') {
					this.emit('log', 'A', 'Received', msgObj)
				}
				if (typeof msgObj.type == 'undefined') {
					this.emit('log', 'E', 'Server error', e)
				} else {
					this.emit('log', 'E', 'A device is using an invalid JSON format');
				}
			} catch (e2) {
				this.emit('log', 'E', 'Invalid JSON', e)
				this.emit('log', 'A', 'Received: '+msgJSON);
			}
		}
	}

	handleClose(socket) {
		try {
			const oldId = JSON.parse(JSON.stringify(socket.ID));
			this.emit('log', 'D', `${oldId} Connection closed`);
			socket.connected = false;
			this.emit('exit', socket);
		} catch (e) {
			this.emit('log', 'E', 'Could not end connection cleanly');
		}
	}

	doPing(serverWS) {
		this.emit('log', 'P', 'Doing client pings');
		let alive = 0;
		let dead = 0;
		serverWS.clients.forEach(client => {
			if (client.readyState !== 1) return;
			switch (client.pingStatus) {
			case 'alive':
				alive++;
				this.sendTo(client, {'module': 'core', 'command': 'ping'});
				client.pingStatus = 'pending';
				break;
			case 'pending':
				client.pingStatus = 'dead';
				break;
			default:
				dead++;
				break;
			}
		});
		this.emit('log', 'P', `Dead: ${dead}, Alive: ${alive}`);
	}

	makeHeader() {
		const header = {};
		header.fromID = this.serverID;
		header.timestamp = new Date().getTime();
		header.version = this.version;
		header.type = 'Server';
		header.active = true;
		header.messageID = header.timestamp;
		header.recipients = [];
		header.system = this.serverName;
		return header;
	}

	sendTo(connection, payload) {
		connection.send(JSON.stringify({
			'header': this.makeHeader(),
			'payload': payload
		}));
	}

	sendToAll(payload) {
		this.serverWS.sendToAll(payload);
	}

	sendToFiltered(filterFunction, payload) {
		this.serverWS.clients.forEach(client => {
			if (filterFunction(client)) this.sendTo(client, payload);
		});
	}

}

module.exports.Server = Server;