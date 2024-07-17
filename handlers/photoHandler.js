const { bot } = require("./bot"); // Подключение вашего бота (предполагается, что у вас есть файл bot.js)

async function sendPhotoToChannel(channel, photoId, caption, keyboard) {
  try {
    await bot.telegram.sendPhoto(channel, photoId, {
      caption: caption,
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
    console.log(`Фото успешно отправлено на канал ${channel}`);
  } catch (error) {
    console.error(`Ошибка при отправке фото на канал ${channel}:`, error);
    throw error;
  }
}

module.exports = {
  sendPhotoToChannel,
};
