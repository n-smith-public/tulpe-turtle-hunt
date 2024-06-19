const express = require('express');
const mysql = require('mysql');
const { check } = require('express-validator');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.post('/submit', (req, res) => {
  const { data } = req.body;
  pool.query('INSERT INTO your_table (column_name) VALUES (?)', [data], (error, results) => {
    if (error) {
      console.error('Error inserting data:', error);
      res.status(500).send({ error: 'Error inserting data' });
    } else {
      res.send({ message: 'Data submitted successfully!' });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
