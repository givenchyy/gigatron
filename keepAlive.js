const express = require("express");

const server = express();

function keepAlive() {
  server.listen(6969, () => {
    console.log("Server is online!");
  });
}

module.exports = keepAlive;
