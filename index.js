import http from "http";
import express from "express";
import ws from "websocket";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const app = express();
app.get("/", (req, res) => res.sendFile(path.join(__dirname + "/index.html")));
app.listen(3000, () => console.log("Listening on http port 3000"));

const httpServer = http.createServer().listen(8080, function () {
  console.log(new Date() + " Server is listening on port 8080");
});
const wsServer = new ws.server({ httpServer: httpServer });
const clients = new Map();
const games = new Map();

wsServer.on("request", (req) => {
  const conn = req.accept(null, req.origin);

  const clientId = guid();
  clients.set(clientId, conn);
  const payLoad = {
    method: "connect",
    clientId: clientId,
  };
  conn.send(JSON.stringify(payLoad));

  conn.on("close", () => {
    //TODO: remove the player from game
    console.log("closed::");
  });

  conn.on("message", (message) => {
    const result = JSON.parse(message.utf8Data);

    switch (result.method) {
      case "create": {
        const gameId = guid();
        games.set(gameId, {
          id: gameId,
          balls: 20,
          clients: [],
        });

        const payLoad = { method: "create", game: games.get(gameId) };
        /** @type {ws.connection} */
        const c = clients.get(result.clientId);
        c.send(JSON.stringify(payLoad));
        console.log("Payload send to create a game");
        break;
      }
      case "join": {
        //curr client conn
        const c = clients.get(result.clientId);
        if (!games.has(result.gameId)) {
          c.send(
            JSON.stringify({
              method: "error",
              msg: "no game exits with the given client id",
            })
          );
          return;
        }

        // curr game details
        const currGame = games.get(result.gameId);
        if (currGame.clients.length >= 3) {
          c.send(
            JSON.stringify({
              method: "error",
              msg: "already full",
            })
          );
          return;
        }

        const color = { 0: "Red", 1: "Green", 2: "Blue" }[
          currGame.clients.length
        ];
        currGame.clients.push({
          clientId: result.clientId,
          color: color,
        });

        // if (currGame.clients.length === 3) updateGameState();
        const payLoad = {
          method: "join",
          game: currGame,
        };

        currGame.clients.forEach((e) => {
          const client = clients.get(e.clientId);
          client.send(JSON.stringify(payLoad));
        });

        break;
      }
      case "play": {
        const currGame = games.get(result.gameId);
        const color = result.color;
        const ballId = result.ballId;
        let state = currGame.state;
        if (!state) state = {};

        state[ballId] = color;
        currGame.state = state;

        const payLoad = {
          method: "update",
          game: currGame,
        };
        currGame.clients.forEach((e) => {
          const client = clients.get(e.clientId);
          client.send(JSON.stringify(payLoad));
        });

        break;
      }
      default: {
        console.log(result);
      }
    }
  });
});

// suitable to fps types games not chance based games
function updateGameState() {
  games.forEach((v) => {
    const payLoad = {
      method: "update",
      game: v,
    };
    v.clients.forEach((e) => {
      const client = clients.get(e.clientId);
      client.send(JSON.stringify(payLoad));
    });
  });

  setTimeout(updateGameState, 500);
}

function S4() {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

// then to call it, plus stitch in '4' in the third group
const guid = () =>
  (
    S4() +
    S4() +
    "-" +
    S4() +
    "-4" +
    S4().substr(0, 3) +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  ).toLowerCase();
