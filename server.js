require('dotenv').config();
require('express-async-errors'); // Captura erros assíncronos automaticamente
const express = require('express');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const hpp = require('hpp');
const xss = require('xss-clean');

const app = express();
const port = process.env.PORT || 3000;

// Validação das variáveis essenciais
const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Variáveis de ambiente faltantes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Configurações de segurança com Helmet e CSP básico
app.set('trust proxy', 1);
app.use(helmet({
  hidePoweredBy: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  }
}));
app.disable('x-powered-by');

// Configuração do CORS
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));

// Limitação do tamanho do corpo e compressão
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(compression());

// Proteções adicionais contra ataques
app.use(hpp());
app.use(xss());

// Registro de requisições com Morgan
app.use(morgan('combined'));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting para mitigar ataques DOS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas requisições. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Configuração do banco de dados usando variáveis de ambiente
// Utilize a URL externa fornecida pelo Render para acesso fora da infraestrutura Render
const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE, DB_PORT, DB_USE_SSL } = process.env;
const poolConfig = {
  host: DB_HOST, // Ex: dpg-culgs7lds78s73bri7j0-a.ohio-postgres.render.com
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: DB_PORT || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  keepAlive: true,
};

if (DB_USE_SSL === 'true') {
  // Para conexões com Render, o SSL é necessário
  // Como o certificado é emitido por autoridade confiável, definimos rejectUnauthorized como false
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

// Inicialização do banco de dados e criação da tabela, se necessário
async function init() {
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
      email VARCHAR(255) NOT NULL UNIQUE,
      telefone VARCHAR(50),
      descricao_servico TEXT NOT NULL,
      data_servico DATE DEFAULT CURRENT_DATE
    )
  `);
}

// Middleware de validação dos dados de atendimento
const validateAtendimento = [
  body('nome')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Nome deve ter pelo menos 3 caracteres')
    .escape(),
  body('email')
    .isEmail()
    .withMessage('E-mail inválido')
    .normalizeEmail(),
  body('telefone')
    .optional()
    .trim()
    .escape(),
  body('descricao_servico')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Descrição deve ter pelo menos 5 caracteres')
    .escape(),
];

// Rota para criar um atendimento
app.post('/api/atendimentos', validateAtendimento, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { nome, email, telefone, descricao_servico, data_servico } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO atendimentos (nome, email, telefone, descricao_servico, data_servico)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE))
       RETURNING *`,
      [nome, email, telefone, descricao_servico, data_servico]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro no banco de dados:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para recuperar atendimentos
app.get('/api/atendimentos', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM atendimentos ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar atendimentos:', err);
    res.status(500).json({ error: 'Erro ao buscar atendimentos' });
  }
});

// Rota para servir a página de cadastro
app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'cadastro.html'));
});

// Rota raiz de verificação
app.get('/', (req, res) => {
  res.send('Servidor funcionando corretamente!');
});

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Encerramento gracioso das conexões ao receber sinais de término
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

// Inicia o servidor e a inicialização do banco de dados
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});

init().catch(err => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
