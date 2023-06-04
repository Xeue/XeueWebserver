declare module 'xeue-webserver';

type doMsgFunc = (message: Object, client: WebSocket.WebSocket) => void;
type doClsFunc = (client: WebSocket.WebSocket) => void

export class Server {
    constructor(
        port: string,
        expressRoutes: Function,
        logger: Object,
        version: string,
        config: Object,
        doMessage: doMsgFunc,
		doClose: doClsFunc
    ) {}


	start() {}

	async handleMessage(
		msgJSON: string,
		socket: WebSocket.WebSocket
	) {}

	handleClose(
		socket: WebSocket.WebSocket
	) {}

	doPing(
		serverWS: WebSocket.Server
	) {}

	makeHeader() {}

	sendTo(
		connection: WebSocket.WebSocket,
		payload: Object
	) {}
}