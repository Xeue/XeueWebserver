const express = require('express');
const {logs} = require('xeue-logs');
const {config} = require('xeue-config');
const http = require('http');
const {WebSocketServer} = require('ws');

class Server {
	constructor(
		port,
		expressRoutes,
		logger = logs,
		version = "1.0.0",
		config = config,
		doMessage = ()=>{},
		doClose = ()=>{}
	) {
		this.logger = logger;
		this.port = port;
		this.expressRoutes = expressRoutes;
		this.doMessage = doMessage;
		this.doClose = doClose;
		this.version = version;
		this.config = config;
		this.serverWS;
		this.serverHTTP;
		const loadTime = new Date().getTime();
		this.serverID =`S_${loadTime}_${version}`;
	}

	start() {
		const expressApp = express();
		const serverWS = new WebSocketServer({noServer: true});
		const serverHTTP = http.createServer(expressApp);
	
		this.expressRoutes(expressApp);
	
		serverHTTP.listen(this.port);
	
		serverHTTP.on('upgrade', (request, socket, head) => {
			this.logger.log('Upgrade request received', 'D');
			serverWS.handleUpgrade(request, socket, head, socket => {
				serverWS.emit('connection', socket, request);
			});
		});
	
		// Main websocket server functionality
		serverWS.on('connection', async socket => {
			this.logger.log('New client connected', 'D');
			socket.pingStatus = 'alive';
			socket.on('message', async (msgJSON)=>{
				await this.handleMessage(msgJSON, socket);
			});
			socket.on('close', ()=>{
				this.handleClose(socket);
			});
		});
	
		serverWS.on('error', error => {
			this.logger.log('Server failed to start or crashed, please check the port is not in use', 'E');
			this.logger.error("Error", error)
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
				this.logger.object('Received', msgObj, 'A');
			}
			const payload = msgObj.payload;
			const header = msgObj.header;
			if (typeof payload.source == 'undefined') {
				payload.source = 'default';
			}
			switch (payload.command) {
			case 'disconnect':
				this.logger.log(`${this.logger.r}${payload.data.ID}${this.logger.reset} Connection closed`, 'D');
				break;
			case 'pong':
				socket.pingStatus = 'alive';
				break;
			case 'ping':
				socket.pingStatus = 'alive';
				this.sendTo(socket, {
					'command': 'pong'
				});
				break;
			case 'error':
				this.logger.log(`Device ${header.fromID} has entered an error state`, 'E');
				this.logger.log(`Message: ${payload.error}`, 'E');
				break;
			default:
				this.doMessage(msgObj, socket);
			}
		} catch (e) {
			try {
				msgObj = JSON.parse(msgJSON);
				if (msgObj.payload.command !== 'ping' && msgObj.payload.command !== 'pong') {
					this.logger.object('Received', msgObj, 'A');
				}
				if (typeof msgObj.type == 'undefined') {
					this.logger.object('Server error', e, 'E');
				} else {
					this.logger.log('A device is using an invalid JSON format', 'E');
				}
			} catch (e2) {
				this.logger.object('Invalid JSON', e, 'E');
				this.logger.log('Received: '+msgJSON, 'A');
			}
		}
	}

	handleClose(socket) {
		try {
			const oldId = JSON.parse(JSON.stringify(socket.ID));
			this.logger.log(`${this.logger.r}${oldId}${this.logger.reset} Connection closed`, 'D');
			socket.connected = false;
			this.doClose(socket)
		} catch (e) {
			this.logger.log('Could not end connection cleanly','E');
		}
	}

	doPing(serverWS) {
		if (config.get('printPings')) this.logger.log('Doing client pings', 'A');
		let alive = 0;
		let dead = 0;
		serverWS.clients.forEach(client => {
			if (client.readyState !== 1) return;
			switch (client.pingStatus) {
			case 'alive':
				alive++;
				this.sendTo(client, {'command': 'ping'});
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
		if (config.get('printPings')) this.logger.log(`Alive: ${alive}, Dead: ${dead}`, 'A');
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
		header.system = config.get('systemName');
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
}

module.exports.Server = Server;