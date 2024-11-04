import { GameResult, GameState } from "./game-objects.js";
import { Vector } from "./vector.js";
import { DisplayDriver } from "./display-driver.js";
import { Grid } from "./grid.js";
import { UI, UIMode } from "./ui.js";
import { Notifier } from "./notifier.js";
import { GameEventType } from "./game-event.js";
import { WsDriver } from "./ws-driver.js";
import { AudioDriver } from "./audio-driver.js";
const WS_URL = "ws";
const AUDIO_FAIL_MESSAGE = "failed to load audio";
function resultString(result) {
    switch (result) {
        case GameResult.Win:
            return "you won!";
        case GameResult.Draw:
            return "draw";
        case GameResult.Lose:
            return "you lost...";
    }
}
function elementToScreenCoords(elementP) {
    return elementP.mul(window.devicePixelRatio).round();
}
var Layer;
(function (Layer) {
    Layer[Layer["UI"] = 0] = "UI";
    Layer[Layer["Grid"] = 1] = "Grid";
})(Layer || (Layer = {}));
export class Game {
    constructor(ctx) {
        var _a;
        this.grid = null;
        this.isPointerDown = false;
        this.layer = Layer.UI;
        this.freeze = false;
        this.notifier = new Notifier(this);
        this.audioDriver = new AudioDriver(this.notifier);
        this.wsDriver = new WsDriver(WS_URL, this.notifier);
        const canvas = ctx.canvas;
        this.initEventListeners(canvas);
        const inputElement = this.createInputElement();
        (_a = ctx.canvas.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(inputElement, null);
        this.ui = new UI(this.notifier, inputElement);
        this.displayDriver = new DisplayDriver(ctx, null, this.ui);
        window.addEventListener("resize", () => {
            this.resize();
        });
        this.resize();
        this.states = {
            mainMenu: new GameStateMainMenu(this),
            waitingForRoom: new GameStateWaitForRoom(this),
            waitingRoom: new GameStateWaitingRoom(this),
            inGame: new GameStateInGame(this),
        };
        this.state = this.states.mainMenu;
    }
    update(event) {
        this.state.update(event);
    }
    setState(state) {
        this.state = state;
        this.state.onEnter();
    }
    run() {
        this.draw(0);
    }
    initEventListeners(canvas) {
        canvas.addEventListener("pointerdown", (e) => {
            const screenP = elementToScreenCoords(new Vector(e.offsetX, e.offsetY));
            this.handlePointerStart(screenP);
        });
        canvas.addEventListener("pointerup", (e) => {
            const screenP = elementToScreenCoords(new Vector(e.offsetX, e.offsetY));
            this.handlePointerEnd(screenP);
        });
        canvas.addEventListener("pointermove", (e) => {
            const screenP = elementToScreenCoords(new Vector(e.offsetX, e.offsetY));
            this.handlePointerMove(screenP);
        });
        canvas.addEventListener("wheel", (e) => {
            if (e.deltaY > 0) {
                this.handleZoomOut();
                return;
            }
            this.handleZoomIn();
        });
    }
    createInputElement() {
        const e = document.createElement("input");
        e.setAttribute("id", "in-game-input");
        e.setAttribute("type", "text");
        e.setAttribute("placeholder", "code");
        return e;
    }
    initGrid(config) {
        const gameState = new GameState(config);
        this.grid = new Grid(gameState, this.displayDriver, config, this.notifier, this.audioDriver);
        this.displayDriver.gameState = gameState;
        this.displayDriver.reset();
    }
    removeGrid() {
        this.grid = null;
        this.displayDriver.gameState = null;
    }
    handleZoomIn() {
        this.displayDriver.handleZoomIn();
    }
    handleZoomOut() {
        this.displayDriver.handleZoomOut();
    }
    handlePointerStart(p) {
        var _a;
        this.isPointerDown = true;
        this.layer = this.ui.collides(p) ? Layer.UI : Layer.Grid;
        if (this.layer === Layer.UI) {
            this.ui.handlePointerStart(p);
        }
        else {
            (_a = this.grid) === null || _a === void 0 ? void 0 : _a.handlePointerStart(p);
        }
    }
    handlePointerEnd(p) {
        var _a;
        this.isPointerDown = false;
        if (this.layer === Layer.UI) {
            this.ui.handlePointerEnd(p);
        }
        else {
            (_a = this.grid) === null || _a === void 0 ? void 0 : _a.handlePointerEnd(p);
        }
        this.layer = Layer.UI;
    }
    handlePointerMove(p) {
        var _a;
        if (!this.isPointerDown)
            return;
        if (this.layer === Layer.UI) {
            this.ui.handlePointerMove(p);
        }
        else {
            (_a = this.grid) === null || _a === void 0 ? void 0 : _a.handlePointerMove(p);
        }
    }
    draw(curT) {
        var _a, _b;
        this.displayDriver.draw(this.freeze);
        (_a = this.grid) === null || _a === void 0 ? void 0 : _a.setT(curT);
        (_b = this.grid) === null || _b === void 0 ? void 0 : _b.tick();
        requestAnimationFrame((t) => {
            this.draw(t);
        });
    }
    resize() {
        this.displayDriver.resize();
    }
}
class GameStateMainMenu {
    constructor(game) {
        this.str = "main-menu";
        this.game = game;
    }
    onEnter() {
        this.game.audioDriver.setSoundGlobal(false);
    }
    update(event) {
        switch (event.type) {
            case GameEventType.WsOpen:
                this.game.ui.setOnlineGameAvailability(true);
                break;
            case GameEventType.WsClose:
                this.game.freeze = false;
                this.game.ui.setOnlineGameAvailability(false);
                this.game.ui.addModal("connection lost");
                break;
            case GameEventType.ButtonJoinRoom:
                const code = this.game.ui.getRoomCode();
                this.game.wsDriver.sendStartGame(code);
                this.game.freeze = true;
                this.game.setState(this.game.states.waitingForRoom);
                break;
            case GameEventType.AudioLoadFail:
                this.game.ui.addModal(AUDIO_FAIL_MESSAGE);
                break;
            case GameEventType.AudioLoadSuccess:
                this.game.ui.allowUnmute();
                break;
        }
    }
}
class GameStateWaitForRoom {
    constructor(game) {
        this.str = "wait-for-room";
        this.game = game;
    }
    onEnter() {
        this.game.audioDriver.setSoundGlobal(false);
    }
    update(event) {
        switch (event.type) {
            case GameEventType.WsOpen:
                this.game.ui.setOnlineGameAvailability(true);
                break;
            case GameEventType.WsClose:
                this.game.freeze = false;
                this.game.ui.setOnlineGameAvailability(false);
                this.game.ui.addModal("connection lost");
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.RoomJoined:
                this.game.freeze = false;
                this.game.ui.enableMode(UIMode.WaitingRoom);
                this.game.setState(this.game.states.waitingRoom);
                break;
            case GameEventType.RoomDisconnected:
                this.game.freeze = false;
                this.game.ui.addModal("cant join room");
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.AudioLoadFail:
                this.game.ui.addModal(AUDIO_FAIL_MESSAGE);
                break;
            case GameEventType.AudioLoadSuccess:
                this.game.ui.allowUnmute();
                break;
        }
    }
}
class GameStateWaitingRoom {
    constructor(game) {
        this.str = "waiting-room";
        this.game = game;
    }
    onEnter() {
        this.game.audioDriver.setSoundGlobal(false);
    }
    update(event) {
        switch (event.type) {
            case GameEventType.WsOpen:
                this.game.ui.setOnlineGameAvailability(true);
                break;
            case GameEventType.WsClose:
                this.game.ui.setOnlineGameAvailability(false);
                this.game.ui.addModal("connection lost");
                this.game.ui.enableMode(UIMode.Main);
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.StartGame:
                this.game.initGrid(event.config);
                this.game.ui.enableMode(UIMode.InGame);
                this.game.setState(this.game.states.inGame);
                break;
            case GameEventType.RoomDisconnected:
                this.game.ui.addModal("room disconnected");
                this.game.ui.enableMode(UIMode.Main);
                this.game.setState(this.game.states.mainMenu);
                this.game.freeze;
                break;
            case GameEventType.ButtonQuitGame:
                this.game.wsDriver.sendQuitRoom();
                this.game.ui.enableMode(UIMode.Main);
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.AudioLoadFail:
                this.game.ui.addModal(AUDIO_FAIL_MESSAGE);
                break;
            case GameEventType.AudioLoadSuccess:
                this.game.ui.allowUnmute();
                break;
        }
    }
}
class GameStateInGame {
    constructor(game) {
        this.isAnimating = false;
        this.str = "in-game";
        this.modalQueue = [];
        this.gameFinished = false;
        this.counterIncoming = 0;
        this.counterFinished = 0;
        this.game = game;
    }
    onEnter() {
        this.game.audioDriver.setSoundGlobal(true);
        this.isAnimating = false;
        this.modalQueue = [];
        this.gameFinished = false;
        this.counterIncoming = 0;
        this.counterFinished = 0;
        this.game.ui.setSendTurnAvailability(true);
    }
    update(event) {
        var _a;
        switch (event.type) {
            case GameEventType.ReceiveTurnResults:
                this.counterIncoming++;
                (_a = this.game.grid) === null || _a === void 0 ? void 0 : _a.pushResults(event.turnResults);
                this.game.ui.setSendTurnAvailability(false);
                this.isAnimating = true;
                break;
            case GameEventType.GameFinished:
                this.gameFinished = true;
                this.game.ui.setSendTurnAvailability(false);
                if (this.isAnimating) {
                    this.modalQueue.push(resultString(event.result));
                    return;
                }
                this.game.ui.addModal(resultString(event.result));
                break;
            case GameEventType.WsClose:
                this.game.ui.setSendTurnAvailability(false);
                this.game.ui.setOnlineGameAvailability(false);
                this.game.ui.addModal("server disconnected");
                this.game.removeGrid();
                this.game.ui.enableMode(UIMode.Main);
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.RoomDisconnected:
                this.game.ui.setSendTurnAvailability(false);
                if (this.gameFinished) {
                    return;
                }
                if (this.isAnimating) {
                    this.modalQueue.push("room disconnected");
                    return;
                }
                this.game.ui.addModal("room disconnected");
                this.game.removeGrid();
                this.game.ui.enableMode(UIMode.Main);
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.ButtonZoomIn:
                this.game.handleZoomIn();
                break;
            case GameEventType.ButtonZoomOut:
                this.game.handleZoomOut();
                break;
            case GameEventType.ButtonQuitGame:
                if (!this.gameFinished) {
                    this.game.wsDriver.sendQuitRoom();
                }
                this.game.removeGrid();
                this.game.ui.enableMode(UIMode.Main);
                this.game.setState(this.game.states.mainMenu);
                break;
            case GameEventType.ButtonSendTurn:
                if (this.game.grid === null)
                    return;
                this.game.ui.setSendTurnAvailability(false);
                const actions = this.game.grid.getActions();
                this.game.wsDriver.sendActions(actions);
                break;
            case GameEventType.AnimationEnd:
                this.counterFinished++;
                if (this.counterFinished === this.counterIncoming) {
                    this.isAnimating = false;
                    this.game.ui.setSendTurnAvailability(!this.gameFinished);
                    for (const modalText of this.modalQueue) {
                        this.game.ui.addModal(modalText);
                    }
                }
                break;
            case GameEventType.TankManipulation:
                if (!this.gameFinished && !this.isAnimating) {
                    this.game.ui.setSendTurnAvailability(true);
                }
                break;
            case GameEventType.AudioLoadFail:
                this.game.ui.addModal(AUDIO_FAIL_MESSAGE);
                break;
            case GameEventType.AudioLoadSuccess:
                this.game.ui.allowUnmute();
                break;
            case GameEventType.ButtonUnmute:
                this.game.ui.setAudioButton(true);
                this.game.audioDriver.setSoundInGame(true);
                break;
            case GameEventType.ButtonMute:
                this.game.ui.setAudioButton(false);
                this.game.audioDriver.setSoundInGame(false);
                break;
        }
    }
}
