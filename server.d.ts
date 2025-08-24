declare module 'xeue-webserver';
import type http from "http"
import type WebSocket from "ws"
import type express from 'express';
import type EventEmitter from 'events';

export class Server extends EventEmitter {
    constructor(
        expressRoutes: (expressApp: express.Express) => void,
        version: string,
		serverName: string,
    )


	start(port: number): [http.Server, WebSocket.Server]

	handleMessage(
		msgJSON: string,
		socket: WebSocket.WebSocket
	): Promise<void>

	handleClose(
		socket: WebSocket.WebSocket
	): void

	doPing(
		serverWS: WebSocket.Server
	):void

	makeHeader(): {
		fromID: string;
		timestamp: number;
		version: string;
		type: string;
		active: boolean;
		messageID: number;
		recipients: any[];
		system: any;
	}

	sendTo(
		connection: WebSocket.WebSocket,
		payload: Object
	): void

	sendToAll(
		payload: Object
	): void

	sendToFiltered(
		filterFunction: Function,
		payload: Object
	): void
}