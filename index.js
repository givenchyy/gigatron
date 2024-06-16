/*
@author gigatron
*/

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminId = process.env.ADMIN_ID;

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
        { params: { chat_id: `@${channelIdentifier}` } }
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
    const photoUrl =
      "https://media.discordapp.net/attachments/1249077842042421371/1251188794414207139/photo_2024-04-03_23-40-37.jpg?ex=666efd5e&is=666dabde&hm=54f60933d9ed083e8ac4f27f20591c02c34c50798049d4d2dc19d4ea6b6a13bf&=&format=webp&width=798&height=411"; // Replace with your image URL

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

// Bot launch
bot.start(async (ctx) => {
  await ctx.reply(`
•ПРАЙС•

12ч- 220 рублей 
24ч- 300 рублей (+ реклама в историю бесплатно)

закреп • подгон - 20 рублей 
~могу помочь с оформлением

важно:

ответственность за приход я не несу • всё зависит от вашего шаблона и канала !

по всем вопросам в личку @Vernitedengi_00
<< основной канал (https://t.me/vernitedengi_8) >>
  `);

  await ctx.reply(
    "Пожалуйста, укажите название канала для получения аналитики:"
  );

  bot.context.waitingForChannelName = true;
});

// Text message handling
bot.on("text", async (ctx) => {
  if (ctx.message.text && bot.context.waitingForChannelName) {
    const channelIdentifier = ctx.message.text.trim();

    bot.context.waitingForChannelName = false;

    const stats = await getChannelStats(channelIdentifier);

    if (stats.error) {
      await ctx.reply(stats.error);
    } else if (stats.membersCount < 600) {
      await ctx.reply(
        "Ваш канал не подходит под параметры (меньше 600 подписчиков). Пожалуйста, вернитесь позже."
      );
    } else {
      let statsMessage = `Канал: ${stats.title}\nКоличество подписчиков: ${stats.membersCount}`;

      if (stats.username) {
        statsMessage += `\nUsername: @${stats.username}`;
      } else {
        statsMessage += `\nКанал: https://t.me/${channelIdentifier}`;
      }

      const message = await ctx.reply("Выберите время, которое вам удобно:", {
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

      bot.context.messageId = message.message_id;
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
  const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id; // Получаем ID последнего отправленного фото
  const selectedTime = bot.context.selectedTime;
  const duration = bot.context.duration;
  const orderNumber = bot.context.orderNumber;

  // Отправка фото администратору с кнопками Лайк/Дизлайк
  await ctx.telegram.sendPhoto(adminId, photoId, {
    caption: `Подтвердите оплату за ${duration} в ${selectedTime} (номер заказа: ${orderNumber}):`,
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
});

// Обработка лайка (подтверждение оплаты)
bot.action(/^confirm_payment_.+/, async (ctx) => {
  const actionData = ctx.callbackQuery.data.split("_");
  const orderNumber = actionData[2];

  const clientId = bot.context.clientId; // Получаем идентификатор клиента

  // Логика подтверждения оплаты (обновление базы данных, уведомление клиента и т.д.)
  try {
    await ctx.telegram.sendMessage(
      clientId,
      `Оплата подтверждена (номер заказа: ${orderNumber}).`
    );

    await ctx.answerCbQuery("Оплата подтверждена");

    // Удаление сообщения с кнопками администратора
    await ctx.telegram.deleteMessage(
      adminId,
      ctx.callbackQuery.message.message_id
    );
  } catch (error) {
    console.error("Ошибка при подтверждении оплаты:", error);
    await ctx.answerCbQuery("Ошибка при подтверждении оплаты");
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
