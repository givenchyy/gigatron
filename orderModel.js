const mongoose = require("mongoose");

// Определение схемы для заказа
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true },
  clientId: { type: Number, required: true },
  username: { type: String }, // Добавленное поле для сохранения username
  channel: { type: String }, // Добавленное поле для сохранения username
  duration: { type: Number, required: true },
  selectedTime: { type: Date, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  paymentLink: { type: String, required: true },
  paymentConfirmed: { type: Boolean, default: false },
  channelMembersCount: { type: Number, required: true },
  // channelTitle: { type: String } // Если нужно добавить название канала
});

// Создание модели заказа
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
