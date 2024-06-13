/**
 * @author gigatron
 */

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminId = process.env.ADMIN_ID;

const busyTimes = new Map();

async function getChannelStats(channelName) {
  try {
    const chatResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChat`,
      {
        params: { chat_id: `@${channelName}` },
      }
    );
    const chat = chatResponse.data.result;

    const countResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChatMembersCount`,
      {
        params: { chat_id: `@${channelName}` },
      }
    );
    const membersCount = countResponse.data.result;

    console.log(`Channel: ${chat.title}`);
    console.log(`Subscribers: ${membersCount}`);

    return {
      title: chat.title,
      membersCount: membersCount,
      username: chat.username,
    };
  } catch (error) {
    console.error("Error getting channel stats:", error);
    return { error: "Ошибка при получении статистики канала." };
  }
}

bot.start(async (ctx) => {
  await ctx.reply(`
🧿•ПРАЙС•
 
🌟12ч- 200 рублей 
🌟24ч- 250 рублей  (+ реклама в историю бесплатно)
закреп • подгон - 20 рублей 
~могу помочь с оформлением✝️

🪓важно:
• вп, делаю от ~ 100 просмотров за час (600 подписчиков) + похожий контент 
• иногда делаю исключение🌟
ответственность за приход я не несу • всё зависит от вашего шаблона и канала !

🌟для пожертвований: 2202205023402230~ сбер
по всем вопросам в личку @Vernitedengi_00

⏩основной канал (https://t.me/vernitedengi_8) ⏩
`);
  await ctx.reply(
    "Пожалуйста, укажите название канала для получения аналитики:"
  );

  bot.context.waitingForChannelName = true;
});

bot.on("text", async (ctx) => {
  if (ctx.message.text && bot.context.waitingForChannelName) {
    const channelName = ctx.message.text.trim();

    bot.context.waitingForChannelName = false;

    const stats = await getChannelStats(channelName);

    if (stats.error) {
      await ctx.reply(stats.error);
    } else if (stats.membersCount < 600) {
      await ctx.reply(
        "Ваш канал не подходит под параметры (меньше 500 подписчиков). Пожалуйста, вернитесь позже."
      );
    } else {
      let statsMessage = `Канал: ${stats.title}\nКоличество подписчиков: ${stats.membersCount}`;

      if (stats.username) {
        statsMessage += `\nUsername: @${stats.username}`;
      } else {
        statsMessage += `\nКанал: https://t.me/${channelName}`;
      }

      await bot.telegram.sendMessage(adminId, statsMessage);

      const message = await ctx.reply("Выберите время, которое вам удобно:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "9:30", callback_data: "9:30" },
              { text: "12:40", callback_data: "12:40" },
              { text: "21:35", callback_data: "21:35" },
            ],
          ],
        },
      });

      bot.context.messageId = message.message_id;
    }
  }
});

bot.on("callback_query", async (ctx) => {
  const requestedTime = ctx.callbackQuery.data;

  if (busyTimes.has(requestedTime)) {
    await ctx.reply(
      `Время ${requestedTime} уже занято. Выберите другое время.`
    );
  } else {
    busyTimes.set(requestedTime, true);

    if (bot.context.messageId) {
      await ctx.deleteMessage(bot.context.messageId);
    }

    await ctx.reply(
      `Вы выбрали время ${requestedTime}. Ожидайте подтверждение от администрации.`
    );

    const selectedTimeMessage = `Пользователь @${ctx.from.username} выбрал время ${requestedTime}.`;

    await bot.telegram.sendMessage(adminId, selectedTimeMessage);
  }
});

bot
  .launch()
  .then(() => {
    console.log("Bot started");
  })
  .catch((error) => {
    console.error("Failed to start bot:", error);
  });
