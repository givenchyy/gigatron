const mongoose = require("mongoose");
require("dotenv").config(); // Подключение dotenv

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Подключение к базе данных успешно установлено.");
  } catch (error) {
    console.error("Ошибка подключения к базе данных:", error);
  }
}

module.exports = connectDB;
