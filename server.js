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

// Configura o trust proxy para ambientes que usam proxy reverso
app.set('trust proxy', 1);

// Middlewares para segurança, CORS e parsing de corpo da requisição
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do rate limiting para prevenir abusos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo de 100 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Recupera as variáveis de ambiente para conexão com o banco
const { DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE, DB_PORT, DB_USE_SSL } = process.env;
if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_DATABASE) {
  console.warn("⚠️ Atenção: Variáveis de ambiente do banco de dados não estão definidas corretamente.");
}

async function init() {
  // Configuração do pool de conexões
  const poolConfig = {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    port: DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  // Se DB_USE_SSL estiver definido como 'true', ativa a conexão via SSL usando o certificado
  if (DB_USE_SSL === 'true') {
    poolConfig.ssl = {
      ca: fs.readFileSync(path.join(__dirname, 'rds-combined-ca-bundle.pem'))
    };
  }

  const pool = mysql.createPool(poolConfig);

  // Testa a conexão com o banco de dados
  try {
    const conn = await pool.getConnection();
    console.log('Conexão com o banco de dados estabelecida com sucesso!');
    conn.release();
  } catch (err) {
    console.error('Erro ao conectar no banco:', err);
    process.exit(1);
  }

  // Cria a tabela "atendimentos" caso ela não exista
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

  // Middleware de validação para o endpoint de criação de atendimentos
  const validateAtendimento = [
    body('nome').trim().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres').escape(),
    body('email').isEmail().withMessage('E-mail inválido').normalizeEmail(),
    body('descricao_servico').trim().isLength({ min: 5 }).withMessage('Descrição deve ter pelo menos 5 caracteres').escape()
  ];

  // Endpoint para inserir um atendimento
  app.post('/api/atendimentos', validateAtendimento, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { nome, email, telefone, descricao_servico, data_servico } = req.body;
    try {
      const [result] = await pool.execute(
        `INSERT INTO atendimentos (nome, email, telefone, descricao_servico, data_servico)
         VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_DATE))`,
        [nome, email, telefone, descricao_servico, data_servico]
      );
      res.status(201).json({
        id: result.insertId,
        nome,
        email,
        telefone,
        descricao_servico,
        data_servico: data_servico || new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error('Erro no banco de dados:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Endpoint para recuperar todos os atendimentos
  app.get('/api/atendimentos', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM atendimentos');
      res.json(rows);
    } catch (err) {
      console.error('Erro ao buscar atendimentos:', err);
      res.status(500).json({ error: 'Erro ao buscar atendimentos' });
    }
  });

  // Rota para servir uma página de cadastro (arquivo HTML)
  app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro.html'));
  });

  // Rota raiz
  app.get('/', (req, res) => {
    res.send('Servidor funcionando corretamente!');
  });

  // Inicia o servidor na porta definida
  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

// Tratamento de exceções e rejeições não tratadas
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
