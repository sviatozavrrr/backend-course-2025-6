const express = require('express');
const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Ініціалізація Express
const app = express();

// --- 1. Налаштування параметрів командного рядка ---
program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

// --- 2. Логіка роботи з кешем (створення папки) ---
// Перетворюємо відносний шлях (наприклад, "./my-cache") в абсолютний
const cacheDir = path.resolve(options.cache);

// Перевіряємо, чи існує папка. Якщо ні — створюємо.
if (!fs.existsSync(cacheDir)) {
    try {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`Створено директорію для кешу: ${cacheDir}`);
    } catch (err) {
        console.error(`Помилка при створенні директорії: ${err.message}`);
        process.exit(1);
    }
} else {
    console.log(`Використовується існуюча директорія кешу: ${cacheDir}`);
}

// --- 3. Запуск сервера ---
// Express під капотом використовує модуль http, як і вимагається в завданні
app.listen(options.port, options.host, () => {
    console.log(`Сервер запущено на http://${options.host}:${options.port}`);
});