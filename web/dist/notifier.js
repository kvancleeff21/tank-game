export class Notifier {
    constructor(receiver) {
        this.receiver = receiver;
    }
    notify(event) {
        this.receiver.update(event);
    }
}
