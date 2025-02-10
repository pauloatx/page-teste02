require('dotenv').config();

const express = require('express');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Configurar o trust proxy para funcionar corretamente
app.set('trust proxy', 1);

// Middleware de segurança e parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting para evitar abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Verifica se as variáveis de ambiente essenciais estão definidas
const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE, DB_PORT, DB_USE_SSL } = process.env;
if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_DATABASE) {
  console.warn("⚠️ Atenção: Variáveis de ambiente do banco de dados podem estar incorretas.");
}

async function init() {
  const sslOptions = DB_USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    port: DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: sslOptions,
  });

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS atendimentos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      telefone VARCHAR(50),
      descricao_servico TEXT NOT NULL,
      data_servico DATE DEFAULT (CURRENT_DATE)
    )
  `);

  const validateAtendimento = [
    body('nome').trim().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres').escape(),
    body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
    body('descricao_servico').trim().isLength({ min: 5 }).withMessage('Descrição deve ter pelo menos 5 caracteres').escape()
  ];

  app.post('/api/atendimentos', validateAtendimento, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, email, telefone, descricao_servico, data_servico } = req.body;
    try {
      const [result] = await pool.execute(
        `INSERT INTO atendimentos (nome, email, telefone, descricao_servico, data_servico) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_DATE))`,
        [nome, email, telefone, descricao_servico, data_servico]
      );

      res.status(201).json({ id: result.insertId, nome, email, telefone, descricao_servico, data_servico: data_servico || new Date().toISOString().split('T')[0] });
    } catch (err) {
      console.error('Erro no banco de dados:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.get('/api/atendimentos', async (req, res) => {
    try {
      const [atendimentos] = await pool.query('SELECT * FROM atendimentos');
      res.json(atendimentos);
    } catch (err) {
      console.error('Erro ao buscar atendimentos:', err);
      res.status(500).json({ error: 'Erro ao buscar atendimentos' });
    }
  });

  app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro.html'));
  });

  app.get('/', (req, res) => {
    res.send('Servidor funcionando corretamente!');
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Rejeição não tratada:', reason);
  process.exit(1);
});

init().catch(err => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
