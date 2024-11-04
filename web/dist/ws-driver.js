import { GameEventType } from "./game-event.js";
import { Vector } from "./vector.js";
function vectorReviver(key, value) {
    if (typeof value === "object" && "x" in value && "y" in value) {
        return new Vector(value.x, value.y);
    }
    return value;
}
var ServerMessageType;
(function (ServerMessageType) {
    ServerMessageType[ServerMessageType["StartGame"] = 1] = "StartGame";
    ServerMessageType[ServerMessageType["TurnResults"] = 2] = "TurnResults";
    ServerMessageType[ServerMessageType["RoomJoined"] = 3] = "RoomJoined";
    ServerMessageType[ServerMessageType["RoomDisconnected"] = 4] = "RoomDisconnected";
    ServerMessageType[ServerMessageType["GameFinished"] = 5] = "GameFinished";
})(ServerMessageType || (ServerMessageType = {}));
var ClientMessageType;
(function (ClientMessageType) {
    ClientMessageType[ClientMessageType["JoinRoom"] = 1] = "JoinRoom";
    ClientMessageType[ClientMessageType["SendTurn"] = 2] = "SendTurn";
    ClientMessageType[ClientMessageType["QuitRoom"] = 3] = "QuitRoom";
})(ClientMessageType || (ClientMessageType = {}));
export class WsDriver {
    constructor(url, notifier) {
        this.open = false;
        this.notifier = notifier;
        this.conn = new WebSocket(url);
        this.conn.onopen = () => this.handleOpen();
        this.conn.onclose = () => this.handleClose();
        this.conn.onmessage = (e) => this.handleMessage(e);
    }
    send(msg) {
        if (!this.open) {
            return;
        }
        this.conn.send(JSON.stringify(msg));
    }
    sendStartGame(code) {
        const msg = {
            type: ClientMessageType.JoinRoom,
            roomCode: code,
        };
        this.send(msg);
    }
    sendActions(actions) {
        const msg = {
            type: ClientMessageType.SendTurn,
            actions: actions,
        };
        this.send(msg);
    }
    sendQuitRoom() {
        const msg = {
            type: ClientMessageType.QuitRoom,
        };
        this.send(msg);
    }
    handleOpen() {
        this.open = true;
        this.notifier.notify({ type: GameEventType.WsOpen });
    }
    handleClose() {
        this.open = false;
        this.notifier.notify({ type: GameEventType.WsClose });
    }
    handleMessage(e) {
        const msg = JSON.parse(e.data, vectorReviver);
        switch (msg.type) {
            case ServerMessageType.StartGame:
                this.notifier.notify({
                    type: GameEventType.StartGame,
                    config: msg.config,
                });
                break;
            case ServerMessageType.TurnResults:
                this.notifier.notify({
                    type: GameEventType.ReceiveTurnResults,
                    turnResults: msg.turnResults,
                });
                break;
            case ServerMessageType.RoomJoined:
                this.notifier.notify({
                    type: GameEventType.RoomJoined,
                });
                break;
            case ServerMessageType.RoomDisconnected:
                this.notifier.notify({
                    type: GameEventType.RoomDisconnected,
                });
                break;
            case ServerMessageType.GameFinished:
                this.notifier.notify({
                    type: GameEventType.GameFinished,
                    result: msg.result,
                });
                break;
        }
    }
}
