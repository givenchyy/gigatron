const mongoose = require("mongoose");
require("dotenv").config(); // Подключение dotenv

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI; // Используем переменную окружения

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Подключение к MongoDB установлено");
  } catch (error) {
    console.error("Ошибка подключения к MongoDB:", error);
    process.exit(1); // Выход из процесса при ошибке подключения
  }
};

module.exports = connectDB;
