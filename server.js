require('dotenv').config();
const express = require('express');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuração de segurança
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para aceitar formulários
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100
});
app.use(limiter);

// Banco de dados SQLite
const db = new Database('./banco.db', { verbose: console.log });

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Criação da tabela
db.exec(`
    CREATE TABLE IF NOT EXISTS atendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone TEXT,
        descricao_servico TEXT NOT NULL,
        data_servico TEXT DEFAULT (DATE('now'))
    );
`);

// Middleware de validação
const validateAtendimento = [
    body('nome').trim().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres').escape(),
    body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
    body('descricao_servico').trim().isLength({ min: 5 }).withMessage('Descrição deve ter pelo menos 5 caracteres').escape(),
];

// Rota para cadastrar atendimentos
app.post('/api/atendimentos', validateAtendimento, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { nome, email, telefone, descricao_servico, data_servico } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO atendimentos (nome, email, telefone, descricao_servico, data_servico)
            VALUES (?, ?, ?, ?, COALESCE(?, DATE('now')))
        `);
        const info = stmt.run(nome, email, telefone, descricao_servico, data_servico);
        res.status(201).json({
            id: info.lastInsertRowid,
            nome,
            email,
            telefone,
            descricao_servico,
            data_servico: data_servico || new Date().toISOString().split('T')[0]
        });
    } catch (err) {
        handleDatabaseError(err, res);
    }
});

// Rota para listar atendimentos
app.get('/api/atendimentos', (req, res) => {
    try {
        const atendimentos = db.prepare('SELECT * FROM atendimentos').all();
        res.json(atendimentos);
    } catch (err) {
        handleDatabaseError(err, res);
    }
});

// Manipulação de erros do banco de dados
function handleDatabaseError(err, res) {
    console.error(err);
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Violação de restrição única' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
}

// Servir a página de cadastro
app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

