declare module 'xeue-webserver';

export class Server {
    constructor(
        port: string,
        expressRoutes: Function,
        logger: Object,
        version: string,
        config: Object,
        doMessage: Function,
		doClose: Function
    ) {}

	start() {}

	async handleMessage(
		msgJSON: string,
		socket: Object
	) {}

	handleClose(
		socket:Object
	) {}

	doPing() {}

	makeHeader() {}

	sendData(
		connection: Object,
		payload: Object
	) {}

	sendAllData(
		payload: Object
	) {}
}