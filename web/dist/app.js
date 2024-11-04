import { Game } from "./game.js";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const game = new Game(ctx);
game.run();
