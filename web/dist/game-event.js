export var GameEventType;
(function (GameEventType) {
    // ws events
    GameEventType[GameEventType["StartGame"] = 0] = "StartGame";
    GameEventType[GameEventType["ReceiveTurnResults"] = 1] = "ReceiveTurnResults";
    GameEventType[GameEventType["GameFinished"] = 2] = "GameFinished";
    // ws type only
    GameEventType[GameEventType["WsOpen"] = 3] = "WsOpen";
    GameEventType[GameEventType["WsClose"] = 4] = "WsClose";
    GameEventType[GameEventType["RoomJoined"] = 5] = "RoomJoined";
    GameEventType[GameEventType["RoomDisconnected"] = 6] = "RoomDisconnected";
    // type only
    GameEventType[GameEventType["NoneEvent"] = 7] = "NoneEvent";
    GameEventType[GameEventType["ButtonZoomIn"] = 8] = "ButtonZoomIn";
    GameEventType[GameEventType["ButtonZoomOut"] = 9] = "ButtonZoomOut";
    GameEventType[GameEventType["ButtonJoinRoom"] = 10] = "ButtonJoinRoom";
    GameEventType[GameEventType["ButtonSendTurn"] = 11] = "ButtonSendTurn";
    GameEventType[GameEventType["ButtonQuitGame"] = 12] = "ButtonQuitGame";
    GameEventType[GameEventType["ButtonUnmute"] = 13] = "ButtonUnmute";
    GameEventType[GameEventType["ButtonMute"] = 14] = "ButtonMute";
    GameEventType[GameEventType["AnimationEnd"] = 15] = "AnimationEnd";
    GameEventType[GameEventType["TankManipulation"] = 16] = "TankManipulation";
    GameEventType[GameEventType["AudioLoadFail"] = 17] = "AudioLoadFail";
    GameEventType[GameEventType["AudioLoadSuccess"] = 18] = "AudioLoadSuccess";
})(GameEventType || (GameEventType = {}));
