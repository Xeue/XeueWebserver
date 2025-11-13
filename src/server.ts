import EventEmitter from 'events';
import express, { Express } from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

export class Server extends EventEmitter {
    version: string
    serverName: string
    serverID: string
    serverWS: WebSocket.Server
    serverHTTP: http.Server
    router: Express
    clients: Map<WebSocket, ClientInfo>
    constructor(
        version = "1.0.0",
        serverName = "WebServer"
    ) {
        super()
        this.version = version;
        this.serverName = serverName;
        const loadTime = new Date().getTime();
        this.serverID = `S_${loadTime}_${version}`;
        const expressApp = express();
        this.serverWS = new WebSocketServer({ noServer: true });
        this.serverHTTP = http.createServer(expressApp);
        this.router = expressApp
        this.serverHTTP.on('upgrade', (request, socket, head) => {
            this.emit('log', 'D', 'Upgrade request received');
            this.serverWS.handleUpgrade(request, socket, head, socket => {
                this.serverWS.emit('connection', socket, request);
            });
        });
        this.clients = new Map

        // Main websocket server functionality
        this.serverWS.on('connection', async socket => {
            this.emit('log', 'D', 'New client connected');
            this.clients.set(socket, {
                pingStatus: 'alive',
                connected: true,
            })
            socket.on('message', async (msgJSON) => {
                await this.handleMessage(msgJSON, socket);
            });
            socket.on('close', () => {
                this.handleClose(socket);
            });
        });

        this.serverWS.on('error', error => {
            this.emit('log', 'E', 'Server failed to start or crashed, please check the port is not in use', error);
            process.exit(1);
        });

        setInterval(() => { this.doPing() }, 5 * 1000);
    }

    start(port: number) {
        this.serverHTTP.listen(port);
        return [this.serverHTTP, this.serverWS];
    }

    async handleMessage(msgJSON: any, client: WebSocket) {
        // let msgObj: Message = {};
        try {
            const message = JSON.parse(msgJSON) as Message;
            if (message.payload.command !== 'ping' && message.payload.command !== 'pong') {
                this.emit('log', 'A', 'Received', message);
            }
            const payload = message.payload;
            const header = message.header;
            if (typeof payload.source == 'undefined') {
                payload.source = 'default';
            }
            const clientInfo = this.clients.get(client)
            if (!clientInfo) throw new Error("Unknown socket")
            switch (payload.command) {
                case 'disconnect':
                    this.emit('log', 'D', `${payload.data.ID} Connection closed`);
                    break;
                case 'pong':
                    clientInfo.pingStatus = 'alive';
                    this.clients.set(client, clientInfo)
                    break;
                case 'ping':
                    clientInfo.pingStatus = 'alive';
                    this.clients.set(client, clientInfo)
                    this.sendTo(client, {
                        'module': 'core',
                        'command': 'pong'
                    });
                    break;
                case 'error':
                    this.emit('log', 'E', `Device ${header.fromID} has entered an error state`);
                    this.emit('log', 'E', `Message: ${payload.error}`);
                    break;
                default:
                    this.emit('message', message, client)
            }
        } catch (e) {
            try {
                const message = JSON.parse(msgJSON) as Message;
                if (message.payload.command !== 'ping' && message.payload.command !== 'pong') {
                    this.emit('log', 'A', 'Received', message)
                }
                if (typeof message.type == 'undefined') {
                    this.emit('log', 'E', 'Server error', e)
                } else {
                    this.emit('log', 'E', 'A device is using an invalid JSON format');
                }
            } catch (e2) {
                this.emit('log', 'E', 'Invalid JSON', e)
                this.emit('log', 'A', 'Received: ' + msgJSON);
            }
        }
    }

    handleClose(client: WebSocket) {
        try {
            this.emit('log', 'D', `Connection closed`);
            this.clients.delete(client)
            this.emit('exit', client);
        } catch (e) {
            this.emit('log', 'E', 'Could not end connection cleanly');
        }
    }

    doPing() {
        this.emit('log', 'P', 'Doing client pings');
        let alive = 0;
        let dead = 0;
        this.serverWS.clients.forEach(client => {
            const clientInfo = this.clients.get(client)
            if (!clientInfo) return
            if (client.readyState !== 1) return;
            switch (clientInfo.pingStatus) {
                case 'alive':
                    alive++;
                    this.sendTo(client, { 'module': 'core', 'command': 'ping' });
                    clientInfo.pingStatus = 'pending';
                    this.clients.set(client, clientInfo)
                    break;
                case 'pending':
                    clientInfo.pingStatus = 'dead';
                    this.clients.set(client, clientInfo)
                    break;
                default:
                    dead++;
                    break;
            }
        });
        this.emit('log', 'P', `Dead: ${dead}, Alive: ${alive}`);
    }

    makeHeader(): Header {
        const timestamp = new Date().getTime();
        return {
            fromID: this.serverID,
            timestamp: timestamp,
            version: this.version,
            type: 'Server',
            active: true,
            messageID: timestamp,
            recipients: [],
            system: this.serverName,
        };
    }

    sendTo(client: WebSocket, payload: Payload) {
        client.send(JSON.stringify({
            'header': this.makeHeader(),
            'payload': payload
        }));
    }

    sendToAll(payload: Payload) {
        this.serverWS.clients.forEach(client => {
            this.sendTo(client, payload);
        });
    }

    sendToFiltered(filterFunction: (client: WebSocket) => boolean, payload: Payload) {
        this.serverWS.clients.forEach(client => {
            if (filterFunction(client)) this.sendTo(client, payload);
        });
    }

}

export type Header = {
    fromID: string;
    timestamp: number;
    version: string;
    type: 'Server' | 'Client';
    active: boolean;
    messageID: number;
    recipients: string[];
    system: string;
}

type ClientInfo = {
    pingStatus?: 'alive' | 'pending' | 'dead'
    connected: boolean
}

export type Message = {
    header: Header,
    payload: Payload,
    type?: string
}

export type Payload = {
    command: string,
    module: string,
    data?: any,
    source?: string,
    error?: string
}