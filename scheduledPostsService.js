const schedule = require("node-schedule");
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Функция для планирования публикации
function schedulePost(channelIdentifier, postTime, message) {
  const job = schedule.scheduleJob(postTime, async () => {
    try {
      await bot.telegram.sendMessage(channelIdentifier, message, {
        parse_mode: "HTML",
      });
      console.log(`Пост успешно отправлен в канал ${channelIdentifier}`);
    } catch (error) {
      console.error(
        `Ошибка при отправке поста в канал ${channelIdentifier}:`,
        error
      );
    }
  });

  return job;
}

module.exports = { schedulePost };
