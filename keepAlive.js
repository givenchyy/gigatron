const express = require("express");
const path = require("path");

const server = express();

server.use(express.static(path.join(__dirname, "img")));

function keepAlive() {
  server.listen(6969, () => {
    console.log("Server is online!");
  });
}

module.exports = keepAlive;
