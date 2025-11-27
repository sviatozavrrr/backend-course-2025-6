const express = require('express');
const { program } = require('commander');
const multer = require('multer'); // Для роботи з файлами
const path = require('path');
const fs = require('fs');

const app = express();

// --- ЧАСТИНА 1: Налаштування CLI ---
program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

// Створення папки кешу
const cacheDir = path.resolve(options.cache);
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

// --- НАЛАШТУВАННЯ MULTER (для завантаження фото) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, cacheDir); // Зберігаємо у папку кешу
    },
    filename: function (req, file, cb) {
        // Генеруємо унікальне ім'я файлу: timestamp + оригінальне розширення
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(express.json()); // Для JSON запитів
app.use(express.urlencoded({ extended: true })); // Для даних форм (x-www-form-urlencoded)

// Наша "База даних" у пам'яті
let inventory = [];

// --- ЧАСТИНА 2: API ---

// 1. Віддача HTML форм
app.get('/RegisterForm.html', (req, res) => res.sendFile(path.join(__dirname, 'RegisterForm.html')));
app.get('/SearchForm.html', (req, res) => res.sendFile(path.join(__dirname, 'SearchForm.html')));

// 2. POST /register
app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).send('Bad Request: inventory_name is required');
    }

    const newItem = {
        id: Date.now().toString(), // Генеруємо ID
        name: inventory_name,
        description: description || '',
        photoFilename: req.file ? req.file.filename : null
    };

    inventory.push(newItem);
    res.status(201).send('Created');
});

// 3. GET /inventory (Список усіх речей)
app.get('/inventory', (req, res) => {
    const response = inventory.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        photoUrl: item.photoFilename ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    }));
    res.json(response);
});

// 4. GET /inventory/:ID (Конкретна річ)
app.get('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    res.json({
        id: item.id,
        name: item.name,
        description: item.description,
        photoUrl: item.photoFilename ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    });
});

// 5. GET /inventory/:ID/photo (Отримати фото)
app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item || !item.photoFilename) return res.status(404).send('Not Found');

    const filePath = path.join(cacheDir, item.photoFilename);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File missing on server');
    }
});

// 6. PUT /inventory/:ID (Оновлення даних)
app.put('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    const { name, description } = req.body;
    if (name) item.name = name;
    if (description) item.description = description;

    res.status(200).send('Updated');
});

// 7. PUT /inventory/:ID/photo (Оновлення фото)
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');
    
    if (req.file) {
        // Тут можна додати видалення старого файлу, але для лаби це не обов'язково
        item.photoFilename = req.file.filename;
        res.status(200).send('Photo updated');
    } else {
        res.status(400).send('No photo uploaded');
    }
});

// 8. DELETE /inventory/:ID (Видалення)
app.delete('/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).send('Not Found');

    inventory.splice(index, 1);
    res.status(200).send('Deleted');
});

// 9. POST /search (Пошук)
app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    const item = inventory.find(i => i.id === id);

    if (!item) return res.status(404).send('Not Found');

    // Клонуємо об'єкт, щоб не змінювати оригінал у базі
    let resultItem = { ...item };

    // Логіка галочки "has_photo"
    if (has_photo === 'on' || has_photo === 'true') {
        const link = item.photoFilename ? ` http://${options.host}:${options.port}/inventory/${item.id}/photo` : ' (No photo)';
        resultItem.description = resultItem.description + link;
    }

    res.json(resultItem);
});

// --- ЗАПУСК ---
app.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}`);
});