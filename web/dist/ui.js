import { GameEventType } from "./game-event.js";
import { Vector } from "./vector.js";
export var ButtonState;
(function (ButtonState) {
    ButtonState[ButtonState["Normal"] = 0] = "Normal";
    ButtonState[ButtonState["Pressed"] = 1] = "Pressed";
    ButtonState[ButtonState["Inactive"] = 2] = "Inactive";
    ButtonState[ButtonState["Invisible"] = 3] = "Invisible";
})(ButtonState || (ButtonState = {}));
function boxCollision(area, p) {
    const end = area.start.add(area.size);
    if (p.x >= area.start.x &&
        p.y >= area.start.y &&
        p.x <= end.x &&
        p.y <= end.y) {
        return true;
    }
    return false;
}
class Modal {
    constructor(fontSizeMultiplier = 1) {
        this.state = ButtonState.Normal;
        this.crossArea = newArea(0, 0, 0, 0);
        this.crossStrokeWidth = 0;
        this.area = newArea(0, 0, 0, 0);
        this.text = "";
        this.baseFontSize = 0;
        this.fontSizeMultiplier = fontSizeMultiplier;
    }
    collides(p) {
        return boxCollision(this.crossArea, p);
    }
    resize() {
        this.crossStrokeWidth = Math.floor(this.baseFontSize * 0.22);
        const length = Math.floor(Math.min(this.area.size.x, this.area.size.y) * 0.08);
        const size = new Vector(length, length);
        const startX = this.area.start.x + this.area.size.x - 2 * length;
        const startY = this.area.start.y + 1 * length;
        const start = new Vector(startX, startY);
        this.crossArea = { start: start, size: size };
    }
    getEvent() {
        return { type: GameEventType.NoneEvent };
    }
}
class StandardButton {
    constructor(text, eventType, fontSizeMultiplier) {
        this.state = ButtonState.Normal;
        this.area = newArea(0, 0, 0, 0);
        this.text = text;
        this.baseFontSize = 0;
        if (fontSizeMultiplier !== undefined) {
            this.fontSizeMultiplier = fontSizeMultiplier;
        }
        this.event = { type: eventType };
    }
    collides(p) {
        return boxCollision(this.area, p);
    }
    getEvent() {
        return this.event;
    }
    resize() {
        // only needed for text input
    }
}
class TextInput {
    constructor(element, fontSizeMultiplier) {
        this.area = newArea(0, 0, 0, 0);
        this.state = ButtonState.Invisible;
        this.baseFontSize = 0;
        if (fontSizeMultiplier !== undefined) {
            this.fontSizeMultiplier = fontSizeMultiplier;
        }
        element.maxLength = 5;
        element.style.fontFamily = "monospace";
        this.element = element;
    }
    hide() {
        this.element.style.display = "none";
        this.element.value = "";
    }
    show() {
        this.element.style.display = "";
    }
    collides(p) {
        const end = this.area.start.add(this.area.size);
        if (p.x >= this.area.start.x &&
            p.y >= this.area.start.y &&
            p.x <= end.x &&
            p.y <= end.y) {
            return true;
        }
        return false;
    }
    getEvent() {
        return { type: GameEventType.NoneEvent };
    }
    resize() {
        const mul = 1 / window.devicePixelRatio;
        const start = this.area.start.mul(mul).round();
        const size = this.area.size.mul(mul).round();
        const borderWidth = this.area.size.y * 0.08 * mul;
        this.element.style.left = `${start.x}px`;
        this.element.style.top = `${start.y}px`;
        this.element.style.width = `${size.x}px`;
        this.element.style.height = `${size.y}px`;
        this.element.style.fontSize = `${this.baseFontSize * mul}px`;
        this.element.style.borderBottom = `${borderWidth}px solid white`;
    }
}
function newArea(startX, startY, sizeX, sizeY) {
    return { start: new Vector(startX, startY), size: new Vector(sizeX, sizeY) };
}
function applyAspectRatio(aspectRatio, space, min = false) {
    if (space.y === 0) {
        return new Vector(0, 0);
    }
    const spaceAspectRatio = space.x / space.y;
    if (spaceAspectRatio <= aspectRatio) {
        const x = space.x;
        const y = space.x / aspectRatio;
        return new Vector(x, y);
    }
    if (min) {
        return new Vector(space.x, space.y);
    }
    const y = space.y;
    const x = y * aspectRatio;
    return new Vector(x, y);
}
var Align;
(function (Align) {
    Align[Align["Start"] = 0] = "Start";
    Align[Align["Center"] = 1] = "Center";
    Align[Align["End"] = 2] = "End";
})(Align || (Align = {}));
class Panel {
    constructor(horizontal, vertical) {
        this.buttons = [];
        this.horizontal = { sizing: horizontal, buttonAreas: [] };
        this.vertical = { sizing: vertical, buttonAreas: [] };
        this.area = newArea(0, 0, 0, 0);
    }
    attachButton(button, horArea, verArea) {
        this.horizontal.buttonAreas.push(horArea);
        this.vertical.buttonAreas.push(verArea);
        this.buttons.push(button);
    }
    resize(available) {
        if (available.y === 0) {
            this.area = newArea(0, 0, 0, 0);
            return;
        }
        const aspectRatio = available.x / available.y;
        const panel = aspectRatio >= 1 ? this.horizontal : this.vertical;
        const afterMax = new Vector(available.x * panel.sizing.maxWidth, available.y * panel.sizing.maxHeight);
        let size = afterMax;
        if (panel.sizing.aspectRatio !== undefined) {
            size = applyAspectRatio(panel.sizing.aspectRatio, afterMax);
        }
        else if (panel.sizing.minAspectRatio) {
            size = applyAspectRatio(panel.sizing.minAspectRatio, afterMax, true);
        }
        this.area = newArea(0, 0, size.x, size.y);
        const leftover = available.sub(size);
        if (panel.sizing.align === Align.End) {
            this.area.start = leftover;
        }
        if (panel.sizing.align === Align.Center) {
            this.area.start = leftover.mul(0.5);
        }
        const buffer = panel.sizing.buff * Math.min(size.x, size.y);
        const cellSize = new Vector((size.x - (panel.sizing.grid.x + 1) * buffer) / panel.sizing.grid.x, (size.y - (panel.sizing.grid.y + 1) * buffer) / panel.sizing.grid.y);
        const fontSize = ((size.x / panel.sizing.grid.x) * panel.sizing.baseFontSize) / 100;
        for (const [i, area] of panel.buttonAreas.entries()) {
            const buttonSize = area.size
                .matmul(cellSize)
                .add(area.size.sub(new Vector(1, 1)).mul(buffer))
                .floor();
            const buttonStart = this.area.start
                .add(area.start.matmul(cellSize))
                .add(area.start.add(new Vector(1, 1)).mul(buffer))
                .round();
            const button = this.buttons[i];
            button.area = { start: buttonStart, size: buttonSize };
            button.baseFontSize = fontSize;
            if (button.fontSizeMultiplier !== undefined) {
                button.baseFontSize *= button.fontSizeMultiplier;
            }
            button.baseFontSize = Math.round(button.baseFontSize);
            button.resize();
        }
    }
}
export var UIMode;
(function (UIMode) {
    UIMode[UIMode["Main"] = 0] = "Main";
    UIMode[UIMode["WaitingRoom"] = 1] = "WaitingRoom";
    UIMode[UIMode["InGame"] = 2] = "InGame";
})(UIMode || (UIMode = {}));
export class UI {
    constructor(notifier, inputElement) {
        this.buttons = new Map();
        this.curButtons = [];
        this.modalTextQueue = [];
        this.notifier = notifier;
        const inGameMenuPanel = new Panel({
            maxWidth: 0.27,
            maxHeight: 1,
            buff: 0.04,
            baseFontSize: 24,
            aspectRatio: 1 / 3,
            grid: new Vector(2, 8),
        }, {
            maxWidth: 1,
            maxHeight: 0.25,
            buff: 0.05,
            baseFontSize: 12,
            minAspectRatio: 3.0,
            grid: new Vector(3, 2),
        });
        const mainMenuPanel = new Panel({
            maxWidth: 1,
            maxHeight: 0.88,
            buff: 0.04,
            baseFontSize: 20,
            aspectRatio: 5 / 6,
            align: Align.Center,
            grid: new Vector(4, 6),
        }, {
            maxWidth: 0.8,
            maxHeight: 0.88,
            buff: 0.05,
            baseFontSize: 20,
            aspectRatio: 5 / 6,
            align: Align.Center,
            grid: new Vector(4, 6),
        });
        const modalPanel = new Panel({
            maxWidth: 0.8,
            maxHeight: 0.88,
            buff: 0.04,
            baseFontSize: 20,
            minAspectRatio: 1 / 3,
            align: Align.Center,
            grid: new Vector(4, 8),
        }, {
            maxWidth: 0.8,
            maxHeight: 0.88,
            buff: 0.05,
            baseFontSize: 20,
            minAspectRatio: 1 / 3,
            align: Align.Center,
            grid: new Vector(4, 8),
        });
        this.panels = [inGameMenuPanel, mainMenuPanel, modalPanel];
        const buttonSendTurn = new StandardButton("send turn", GameEventType.ButtonSendTurn);
        const buttonQuitGame = new StandardButton("quit game", GameEventType.ButtonQuitGame);
        const buttonZoomIn = new StandardButton("+", GameEventType.ButtonZoomIn, 1.5);
        const buttonZoomOut = new StandardButton("-", GameEventType.ButtonZoomOut, 1.5);
        const buttonUnmute = new StandardButton("unmute", GameEventType.ButtonUnmute);
        const buttonMute = new StandardButton("mute", GameEventType.ButtonMute);
        inGameMenuPanel.attachButton(buttonSendTurn, newArea(0, 0, 2, 1), newArea(0, 0, 1, 1));
        inGameMenuPanel.attachButton(buttonQuitGame, newArea(0, 1, 2, 1), newArea(0, 1, 1, 1));
        inGameMenuPanel.attachButton(buttonZoomIn, newArea(0, 2, 2, 1), newArea(1, 0, 1, 1));
        inGameMenuPanel.attachButton(buttonZoomOut, newArea(0, 3, 2, 1), newArea(1, 1, 1, 1));
        inGameMenuPanel.attachButton(buttonUnmute, newArea(0, 4, 2, 1), newArea(2, 0, 1, 1));
        inGameMenuPanel.attachButton(buttonMute, newArea(0, 4, 2, 1), newArea(2, 0, 1, 1));
        const inGameButtons = [
            buttonSendTurn,
            buttonQuitGame,
            buttonZoomIn,
            buttonZoomOut,
            buttonUnmute,
            buttonMute,
        ];
        buttonMute.state = ButtonState.Invisible;
        buttonUnmute.state = ButtonState.Inactive;
        this.buttons.set(UIMode.InGame, inGameButtons);
        const buttonInputRoomCode = new TextInput(inputElement);
        mainMenuPanel.attachButton(buttonInputRoomCode, newArea(1, 1, 2, 1), newArea(1, 1, 2, 1));
        const buttonJoinRoom = new StandardButton("join room", GameEventType.ButtonJoinRoom);
        mainMenuPanel.attachButton(buttonJoinRoom, newArea(1, 2, 2, 1), newArea(1, 2, 2, 1));
        this.buttons.set(UIMode.Main, [buttonJoinRoom, buttonInputRoomCode]);
        const buttonQuitRoom = new StandardButton("quit room", GameEventType.ButtonQuitGame);
        mainMenuPanel.attachButton(buttonQuitRoom, newArea(1, 2, 2, 1), newArea(1, 2, 2, 1));
        this.buttons.set(UIMode.WaitingRoom, [buttonQuitRoom]);
        this.curButtons = this.buttons.get(UIMode.Main) || [];
        buttonJoinRoom.state = ButtonState.Inactive;
        this.specialButtons = {
            joinRoom: buttonJoinRoom,
            textInput: buttonInputRoomCode,
            sendTurn: buttonSendTurn,
            mute: buttonMute,
            unmute: buttonUnmute,
        };
        this.modal = new Modal();
        modalPanel.attachButton(this.modal, newArea(0, 0, 4, 8), newArea(0, 0, 4, 8));
    }
    setAudioButton(mute) {
        this.specialButtons.mute.state = ButtonState.Invisible;
        this.specialButtons.unmute.state = ButtonState.Invisible;
        if (mute) {
            this.specialButtons.mute.state = ButtonState.Normal;
        }
        else {
            this.specialButtons.unmute.state = ButtonState.Normal;
        }
    }
    allowUnmute() {
        if (this.specialButtons.unmute.state === ButtonState.Inactive) {
            this.specialButtons.unmute.state = ButtonState.Normal;
        }
    }
    hasModal() {
        if (this.modalTextQueue.length > 0) {
            return true;
        }
        return false;
    }
    getModal() {
        if (this.hasModal()) {
            return this.modal;
        }
        return null;
    }
    addModal(text) {
        this.modalTextQueue.push(text);
        if (this.modalTextQueue.length === 1) {
            this.modal.text = text;
        }
    }
    removeModal() {
        this.modalTextQueue.shift();
        if (this.hasModal()) {
            this.modal.text = this.modalTextQueue[0];
        }
    }
    enableMode(mode) {
        this.resetCurrent();
        this.curButtons = this.buttons.get(mode) || [];
        for (const button of this.curButtons) {
            if (button === this.specialButtons.textInput) {
                this.specialButtons.textInput.show();
            }
        }
    }
    resize(space) {
        for (const panel of this.panels) {
            panel.resize(space);
        }
    }
    handlePointerStart(p) {
        if (this.hasModal())
            return;
        this.mark(p, ButtonState.Pressed);
    }
    handlePointerMove(p) {
        if (this.hasModal())
            return;
        this.mark(p, ButtonState.Pressed);
    }
    handlePointerEnd(p) {
        if (this.hasModal()) {
            if (this.modal.collides(p)) {
                this.removeModal();
            }
            return;
        }
        for (const button of this.curButtons) {
            if (button.collides(p) &&
                button.state !== ButtonState.Inactive &&
                button.state !== ButtonState.Invisible) {
                this.notifier.notify(button.getEvent());
                break;
            }
        }
        this.mark(p, ButtonState.Normal);
    }
    collides(p) {
        if (this.hasModal())
            return true;
        for (const button of this.curButtons) {
            if (button.collides(p)) {
                return true;
            }
        }
        return false;
    }
    setOnlineGameAvailability(available) {
        this.specialButtons.joinRoom.state = available
            ? ButtonState.Normal
            : ButtonState.Inactive;
    }
    setSendTurnAvailability(available) {
        this.specialButtons.sendTurn.state = available
            ? ButtonState.Normal
            : ButtonState.Inactive;
    }
    getRoomCode() {
        return this.specialButtons.textInput.element.value.toUpperCase();
    }
    mark(p, state) {
        for (const button of this.curButtons) {
            if (button.state === ButtonState.Inactive ||
                button.state === ButtonState.Invisible)
                continue;
            button.state = ButtonState.Normal;
            if (button.collides(p)) {
                button.state = state;
            }
        }
    }
    resetCurrent() {
        for (const button of this.curButtons) {
            if (button === this.specialButtons.textInput) {
                this.specialButtons.textInput.hide();
            }
            if (button.state === ButtonState.Inactive ||
                button.state === ButtonState.Invisible)
                continue;
            button.state = ButtonState.Normal;
        }
    }
}
