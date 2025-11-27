const express = require('express');
const { program } = require('commander');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();

// --- 1. Налаштування CLI (Argument Parsing) ---
program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

// --- 2. Створення папки кешу ---
const cacheDir = path.resolve(options.cache);
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

// --- 3. Налаштування Swagger (Документація) ---
// Важливо: файл swagger.yaml має бути в корені проекту
try {
    const swaggerDocument = YAML.load('./swagger.yaml');
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    console.error("Помилка завантаження swagger.yaml. Перевірте, чи існує файл.");
}

// --- 4. Налаштування Multer (Завантаження файлів) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, cacheDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 5. Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// "База даних" у пам'яті
let inventory = [];

// --- 6. Маршрути (API Routes) ---

// HTML форми
app.get('/RegisterForm.html', (req, res) => res.sendFile(path.join(__dirname, 'RegisterForm.html')));
app.get('/SearchForm.html', (req, res) => res.sendFile(path.join(__dirname, 'SearchForm.html')));

// API методи
app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;
    if (!inventory_name) return res.status(400).send('Bad Request: inventory_name is required');

    const newItem = {
        id: Date.now().toString(),
        name: inventory_name,
        description: description || '',
        photoFilename: req.file ? req.file.filename : null
    };
    inventory.push(newItem);
    res.status(201).send('Created');
});

app.get('/inventory', (req, res) => {
    const response = inventory.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        photoUrl: item.photoFilename ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    }));
    res.json(response);
});

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

app.put('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');
    const { name, description } = req.body;
    if (name) item.name = name;
    if (description) item.description = description;
    res.status(200).send('Updated');
});

app.delete('/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).send('Not Found');
    inventory.splice(index, 1);
    res.status(200).send('Deleted');
});

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item || !item.photoFilename) return res.status(404).send('Not Found');
    const filePath = path.join(cacheDir, item.photoFilename);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File missing');
    }
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');
    if (req.file) {
        item.photoFilename = req.file.filename;
        res.status(200).send('Photo updated');
    } else {
        res.status(400).send('No photo uploaded');
    }
});

app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    const item = inventory.find(i => i.id === id);
    if (!item) return res.status(404).send('Not Found');
    let resultItem = { ...item };
    if (has_photo === 'on' || has_photo === 'true') {
        const link = item.photoFilename ? ` http://${options.host}:${options.port}/inventory/${item.id}/photo` : ' (No photo)';
        resultItem.description = resultItem.description + link;
    }
    res.json(resultItem);
});

// --- 7. Запуск сервера ---
app.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}`);
    console.log(`Docs available at http://${options.host}:${options.port}/docs`);
});