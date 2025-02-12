require('dotenv').config();
require('express-async-errors');
const express = require('express');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { Pool } = require('pg');
const path = require('path');
const morgan = require('morgan');
const hpp = require('hpp');
const xss = require('xss-clean');

const app = express();
const port = process.env.PORT || 3000;

// Verificar se todas as variáveis de ambiente estão definidas
const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Variáveis de ambiente faltantes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Configuração de segurança
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(compression());
app.use(hpp());
app.use(xss());
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas requisições. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Configuração do banco de dados
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false,
  },
};
const pool = new Pool(poolConfig);

async function initDB() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Conexão com o banco estabelecida!');
  } catch (err) {
    console.error('Erro ao conectar no banco:', err);
    process.exit(1);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS atendimentos (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      telefone VARCHAR(50),
      descricao_servico TEXT NOT NULL,
      data_servico DATE DEFAULT CURRENT_DATE
    )
  `);
}

// Validação de atendimentos
const validateAtendimento = [
  body('nome').trim().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres').escape(),
  body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
  body('telefone').optional().trim().escape(),
  body('descricao_servico').trim().isLength({ min: 5 }).withMessage('Descrição deve ter pelo menos 5 caracteres').escape(),
];

// Rotas
app.post('/api/atendimentos', validateAtendimento, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { nome, email, telefone, descricao_servico, data_servico } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO atendimentos (nome, email, telefone, descricao_servico, data_servico)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE)) RETURNING *`,
      [nome, email, telefone, descricao_servico, data_servico]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro no banco de dados:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/atendimentos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM atendimentos ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar atendimentos:', err);
    res.status(500).json({ error: 'Erro ao buscar atendimentos' });
  }
});

app.get('/', (req, res) => res.send('Servidor funcionando corretamente!'));

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Encerramento gracioso
const gracefulShutdown = async () => {
  console.log('Encerrando servidor...');
  await pool.end();
  console.log('Conexões fechadas.');
  process.exit(0);
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Rejeição não tratada:', reason);
  process.exit(1);
});

// Inicializa o banco e inicia o servidor
app.listen(port, '0.0.0.0', async () => {
  console.log(`Servidor rodando na porta ${port}`);
  await initDB();
});
