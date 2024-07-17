/**
 * @author gigatron
 */

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

const connectDB = require("./database");
const Order = require("./orderModel");
const keepAlive = require("./keepAlive");
// const { schedulePost } = require("./scheduledPostsService");

module.exports = createAndSaveOrder;

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminId = process.env.ADMIN_ID;

connectDB();

// Set of busy times
const busyTimes = new Set();

// Function to generate a unique order number
function generateOrderNumber(clientId) {
  const timestamp = Date.now().toString().slice(-6); // Use last 6 digits of current timestamp
  return `${clientId}${timestamp}`;
}

// Function to get channel statistics
async function getChannelStats(channelIdentifier) {
  try {
    let chatResponse;
    if (channelIdentifier.startsWith("@")) {
      const username = channelIdentifier.substring(1);
      chatResponse = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChat`,
        { params: { chat_id: `@${username}` } }
      );
    } else if (channelIdentifier.startsWith("https://t.me/")) {
      const username = channelIdentifier.split("/").pop();
      chatResponse = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChat`,
        { params: { chat_id: `@${username}` } }
      );
    } else {
      chatResponse = await axios.get(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChat`,
        { params: { chat_id: `${channelIdentifier}` } }
      );
    }

    const chat = chatResponse.data.result;

    const countResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChatMembersCount`,
      { params: { chat_id: chat.id } }
    );
    const membersCount = countResponse.data.result;

    console.log(`Канал: ${chat.title}`);
    console.log(`Подписчики: ${membersCount}`);

    return {
      title: chat.title,
      membersCount: membersCount,
      username: chat.username,
    };
  } catch (error) {
    console.error("Ошибка при получении статистики канала:", error);
    return { error: "Ошибка при получении статистики канала." };
  }
}

// Function to send payment link for advertising services
async function sendPaymentLink(ctx, title, description, price, paymentLink) {
  try {
    const photoUrl = "http://localhost:6969/reklama.jpg"; // Replace with your image URL

    // Send message with image and "Pay" button
    await ctx.replyWithPhoto(
      { url: photoUrl },
      {
        caption: `Для размещения рекламы , вам необходимо оплатить ${price} рублей.`,
        reply_markup: {
          inline_keyboard: [[Markup.button.url("Оплатить", paymentLink)]],
        },
      }
    );
  } catch (error) {
    console.error("Ошибка при отправке ссылки на оплату:", error);
    await ctx.reply(
      "Произошла ошибка при отправке ссылки на оплату. Попробуйте позже."
    );
  }
}
async function sendMessageToChannel(message) {
  try {
    await bot.telegram.sendMessage(process.env.STATIC_CHANNEL_ID, message);
  } catch (error) {
    console.error("Ошибка при отправке сообщения в канал:", error);
  }
}
// Bot launch
bot.start(async (ctx) => {
  await ctx.reply(`
•ПРАЙС•

12ч- 225 рублей
24ч- 325 рублей (+ реклама в историю бесплатно)

~могу помочь с оформлением

важно:

ответственность за приход я не несу • всё зависит от вашего шаблона и канала !

основной канал @vernitedengi_8
сотрудничество @gigaproxyyy

`);

  await ctx.reply(
    "Пожалуйста, укажите свой канал для дальнейшего подтверждения:"
  );

  bot.context.waitingForChannelName = true;
});

// const channelIdentifier = "@diehee";

// bot.command("send", async (ctx) => {
//   const postTime = new Date(Date.now() + 60 * 100); // Отправить через 1 минуту
//   const message = "Привет, я Гигатрон";

//   schedulePost(channelIdentifier, postTime, message);

//   ctx.reply(
//     `Сообщение "${message}" будет отправлено в канал ${channelIdentifier} в ${postTime}.`
//   );
// });

async function checkBotPermissions(channelIdentifier) {
  try {
    if (!channelIdentifier.startsWith("@")) {
      channelIdentifier = `@${channelIdentifier}`;
    }
    const chatMember = await bot.telegram.getChatMember(
      channelIdentifier,
      bot.telegram.botInfo.id
    );
    if (["administrator", "member"].includes(chatMember.status)) {
      return true;
    } else {
      console.error(
        "Бот не является участником канала или не имеет прав на отправку сообщений"
      );
      return false;
    }
  } catch (error) {
    console.error("Ошибка при проверке прав бота на канале:", error);
    return false;
  }
}

// Text message handling
bot.on("text", async (ctx) => {
  if (ctx.message.text && bot.context.waitingForChannelName) {
    const channelIdentifier = ctx.message.text.trim();
    bot.context.waitingForChannelName = false;

    const stats = await getChannelStats(channelIdentifier);

    if (stats.error) {
      await ctx.reply(stats.error);
    } else if (stats.membersCount < 1) {
      await ctx.reply(
        "Ваш канал не подходит под параметры (меньше 100 подписчиков). Пожалуйста, вернитесь позже."
      );
    } else {
      // Логирование информации о канале
      console.log(`Канал: ${stats.title}`);
      console.log(`Количество подписчиков: ${stats.membersCount}`);
      if (stats.username) {
        console.log(`Username: @${stats.username}`);
        bot.context.currentOrder = { selectedChannel: `@${stats.username}` }; // Сохраняем юзернейм канала
      } else {
        console.log(`Канал: https://t.me/${channelIdentifier}`);
        bot.context.currentOrder = {
          selectedChannel: `https://t.me/${channelIdentifier}`,
        }; // Сохраняем ссылку на канал
      }

      await ctx.reply("Выберите время, которое вам удобно:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "10:00", callback_data: "time_10:00" },
              { text: "16:00", callback_data: "time_16:00" },
              { text: "19:00", callback_data: "time_19:00" },
            ],
          ],
        },
      });
    }
  } else if (ctx.message.text && bot.context.waitingForPostTemplate) {
    const postTemplate = ctx.message.text.trim();

    bot.context.waitingForPostTemplate = false;
    bot.context.postTemplate = postTemplate;

    // Логика планирования отправки поста на канал
    const selectedTime = bot.context.selectedTime; // Получаем выбранное время

    const postTime = new Date(selectedTime); // Создаём объект времени для планирования
    postTime.setSeconds(0, 0); // Устанавливаем секунды и миллисекунды в 0 для точности

    // Используем setTimeout для планирования отправки сообщения на канал
    const delay = postTime - Date.now(); // Вычисляем время до отправки сообщения

    if (delay > 0) {
      setTimeout(async () => {
        await sendMessageToChannel(postTemplate); // Отправляем сохраненный шаблон поста
        await ctx.reply("Пост успешно отправлен на канал.");
      }, delay);
    } else {
      await sendMessageToChannel(postTemplate); // Если время прошло, отправляем сразу
      await ctx.reply("Пост успешно отправлен на канал.");
    }
  }
});

// Callback actions handling
bot.action(/^time_.+/, async (ctx) => {
  const selectedTime = ctx.callbackQuery.data.split("_")[1];

  await ctx.editMessageReplyMarkup({
    inline_keyboard: [],
  });

  bot.context.selectedTime = selectedTime;
  bot.context.clientId = ctx.from.id; // Save client ID

  await ctx.reply(
    `Вы выбрали время ${selectedTime}. Теперь выберите продолжительность рекламы:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "12 часов",
              callback_data: `duration_12h_${selectedTime}`,
            },
            {
              text: "24 часа",
              callback_data: `duration_24h_${selectedTime}`,
            },
          ],
        ],
      },
    }
  );
});

// Invoice handling and proof of payment request
bot.action(/^duration_.+/, async (ctx) => {
  const actionData = ctx.callbackQuery.data.split("_");
  const duration = actionData[1];
  const selectedTime = actionData[2];

  const orderNumber = generateOrderNumber(ctx.from.id);
  bot.context.duration = duration;
  bot.context.orderNumber = orderNumber;

  let title, description, payload, price, paymentLink;

  if (duration === "12h") {
    title = "GIGATRON";
    description = "Размещение рекламы на 12 часов";
    price = "220";
    paymentLink = "https://yoomoney.ru/to/4100117907658443"; // Replace with your payment link for 12 hours
  } else if (duration === "24h") {
    title = "GIGATRON";
    description = "Размещение рекламы на 24 часа";
    price = "300";
    paymentLink = "https://yoomoney.ru/to/4100117907658443"; // Replace with your payment link for 24 hours
  }

  await sendPaymentLink(ctx, title, description, price, paymentLink);

  await ctx.answerCbQuery();

  // Notify the client about proof of payment request
  try {
    await ctx.reply(
      `Ваш номер заказа: ${orderNumber}. После оплаты за ${duration} в ${selectedTime}, скиньте скриншот об оплате, указав номер заказа в описании`
    );
  } catch (error) {
    console.error("Ошибка уведомления клиента о доказательстве оплаты:", error);
  }
});

// Обработка фото (доказательства оплаты)
bot.on("photo", async (ctx) => {
  if (bot.context.waitingForPostTemplate) {
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    bot.context.waitingForPostTemplate = false;

    await ctx.reply("Шаблон поста успешно получен. Начинаем планирование.");

    // Логика планирования отправки поста на канал
    const selectedTime = bot.context.selectedTime; // Получаем выбранное время
    const selectedChannel = bot.context.currentOrder.selectedChannel; // Получаем выбранный канал

    const postTime = new Date(selectedTime); // Создаём объект времени для планирования
    postTime.setSeconds(0, 0); // Устанавливаем секунды и миллисекунды в 0 для точности

    // Используем setTimeout для планирования отправки сообщения на канал
    setTimeout(async () => {
      await sendMessageToChannel(selectedChannel, postTemplate);
      await ctx.reply("Пост успешно отправлен на канал.");
    }, postTime - Date.now());
  } else {
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id; // Получаем ID последнего отправленного фото
    const selectedTime = bot.context.selectedTime;
    const duration = bot.context.duration;
    const orderNumber = bot.context.orderNumber;
    const channelIdentifier = bot.context.currentOrder?.selectedChannel; // Получаем channelIdentifier из контекста бота

    if (!channelIdentifier) {
      console.error("Не удалось найти выбранный канал для заказа.");
      await ctx.reply(
        "Произошла ошибка: не удалось найти выбранный канал для заказа. Пожалуйста, попробуйте снова."
      );
      return;
    }

    // Отправка фото администратору с кнопками Лайк/Дизлайк
    await ctx.telegram.sendPhoto(adminId, photoId, {
      caption: `Подтвердите оплату за ${duration} в ${selectedTime} для канала ${channelIdentifier} (номер заказа: ${orderNumber}):`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "👍🏻",
              callback_data: `confirm_payment_${orderNumber}`,
            },
            {
              text: "👎🏻",
              callback_data: `reject_payment_${orderNumber}`,
            },
          ],
        ],
      },
    });

    // Уведомление клиента о том, что доказательство оплаты отправлено администратору
    await ctx.reply(
      `Ваше доказательство оплаты успешно отправлено администратору. Ожидайте подтверждения (номер заказа: ${orderNumber}).`
    );

    // Очистка контекста
    bot.context.selectedTime = null;
    bot.context.duration = null;
    bot.context.orderNumber = null;
  }
});

// Функция для создания и сохранения заказа в базе данных
async function createAndSaveOrder(orderData) {
  try {
    // Проверка наличия selectedTime и преобразование в Date, если необходимо
    if (!orderData.selectedTime) {
      throw new Error("selectedTime is required.");
    }

    // Создание нового экземпляра заказа на основе переданных данных
    const newOrder = new Order(orderData);

    // Сохранение заказа в базе данных
    const savedOrder = await newOrder.save();
    return savedOrder;
  } catch (error) {
    throw new Error(`Ошибка при сохранении заказа: ${error.message}`);
  }
}

module.exports = createAndSaveOrder;

async function requestPostTemplate(ctx) {
  try {
    const clientId = bot.context.clientId;

    await bot.telegram.sendMessage(
      clientId,
      "Пожалуйста, отправьте шаблон поста, который вы хотите разместить."
    );

    // Устанавливаем флаг ожидания шаблона поста
    bot.context.waitingForPostTemplate = true;
  } catch (error) {
    console.error("Ошибка при отправке сообщения клиенту:", error);
    await ctx.reply(
      "Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте снова."
    );
  }
}

// Обработка лайка (подтверждение оплаты)
bot.action(/^confirm_payment_.+/, async (ctx) => {
  const actionData = ctx.callbackQuery.data.split("_");
  const orderNumber = actionData[2];

  // Получаем данные из контекста бота
  const clientId = bot.context.clientId;
  const username = ctx.callbackQuery.from.username;
  const selectedTime = bot.context.selectedTime;
  const duration = bot.context.duration;

  const channelIdentifier = bot.context.currentOrder?.selectedChannel; // Получаем channelIdentifier из контекста бота

  if (!channelIdentifier) {
    console.error("Не удалось найти выбранный канал для заказа.");
    await ctx.reply(
      "Произошла ошибка: не удалось найти выбранный канал для заказа. Пожалуйста, попробуйте снова."
    );
    return;
  }

  // Создаем новый объект заказа для сохранения в базе данных
  const orderData = {
    orderNumber: orderNumber,
    clientId: clientId,
    username: `https://t.me/${username}`,
    selectedChannel: channelIdentifier,
    duration: duration === "24h" ? 24 : 12,
    selectedTime: new Date(selectedTime),
    title: "GIGATRON",
    description:
      duration === "24h"
        ? "Размещение рекламы на 24 часа"
        : "Размещение рекламы на 12 часов",
    price: duration === "24h" ? 300 : 220,
    paymentLink: "https://yoomoney.ru/to/4100117907658443",
    paymentConfirmed: true,
    channelMembersCount: 1000,
  };

  try {
    // Сохраняем заказ в базе данных с помощью функции createAndSaveOrder
    const savedOrder = await createAndSaveOrder(orderData);

    // Отправляем уведомление клиенту о подтверждении оплаты
    await ctx.telegram.sendMessage(
      clientId,
      `Оплата подтверждена (номер заказа: ${orderNumber}).`
    );

    await ctx.answerCbQuery("Оплата подтверждена");

    // Обновляем сообщение администратора с кнопками
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [
          {
            text: "Утверждено ✅",
            callback_data: `confirm_success_${orderNumber}`,
          },
        ],
      ],
    });

    // Запрос шаблона поста у клиента
    await requestPostTemplate(ctx);
  } catch (error) {
    console.error(
      "Ошибка при сохранении заказа или отправке уведомления:",
      error
    );
    await ctx.answerCbQuery("Произошла ошибка. Попробуйте еще раз.");
  }
});

// Обработка дизлайка (отказ в оплате)
bot.action(/^reject_payment_.+/, async (ctx) => {
  const actionData = ctx.callbackQuery.data.split("_");
  const orderNumber = actionData[2];

  const clientId = bot.context.clientId; // Получаем идентификатор клиента

  // Логика отказа в оплате (уведомление клиента и т.д.)
  try {
    await ctx.telegram.sendMessage(
      clientId,
      `Оплата отклонена (номер заказа: ${orderNumber}). Пожалуйста, свяжитесь с администратором для уточнения деталей https://t.me/givencchyy.`
    );

    await ctx.answerCbQuery("Оплата отклонена");

    // Обновляем сообщение администратора с кнопками
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [
          {
            text: "Не утверждено ❌",
            callback_data: `reject_failed_${orderNumber}`,
          },
        ],
      ],
    });
  } catch (error) {
    console.error("Ошибка при отказе в оплате:", error);
    await ctx.answerCbQuery("Ошибка при отказе в оплате");
  }
});

// Обработка дизлайка (отказ в оплате)
bot.action(/^reject_payment_.+/, async (ctx) => {
  const actionData = ctx.callbackQuery.data.split("_");
  const orderNumber = actionData[2];

  const clientId = bot.context.clientId; // Получаем идентификатор клиента

  // Логика отказа в оплате (уведомление клиента и т.д.)
  try {
    await ctx.telegram.sendMessage(
      clientId,
      `Оплата отклонена (номер заказа: ${orderNumber}). Пожалуйста, свяжитесь с администратором для уточнения деталей https://t.me/givencchyy.`
    );

    await ctx.answerCbQuery("Оплата отклонена");

    // Удаление сообщения с кнопками администратора
    await ctx.telegram.deleteMessage(
      adminId,
      ctx.callbackQuery.message.message_id
    );
  } catch (error) {
    console.error("Ошибка при отказе в оплате:", error);
    await ctx.answerCbQuery("Ошибка при отказе в оплате");
  }
});

// Запуск бота
bot
  .launch()
  .then(() => {
    console.log("Бот запущен");
  })
  .catch((error) => {
    console.error("Не удалось запустить бота:", error);
  });

const express = require("express");
const path = require("path");

const server = express();
const PORT = process.env.PORT || 3000;

// Обслуживание изображений из папки 'img'
server.use(express.static(path.join(__dirname, "img")));

server.get("/", (req, res) => {
  res.send("I'm alive");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

keepAlive();
