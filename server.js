const express = require('express');
const mysql = require('mysql');
const { check, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const validateForm = [
    check('firstName').notEmpty().withMessage('First name is required.'),
    check('email').isEmail().withMessage('Invalid email format.'),
];

app.post('/submit', validateForm, (req, res) => {
  const { firstName, lastName, pronouns, lodge, email, discord, comments } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const sql = 'INSERT INTO userData (firstName, lastName, pronouns, lodge, email, discord, comments) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const values = [firstName, lastName, pronouns, lodge, email, discord, comments];

  pool.query(sql, values, (error, results) => {
    if (error) {
      console.error('Error inserting data:', error);
      res.status(500).send({ error: 'Error inserting data' });
    } else {
      console.log('Data inserted successfully: ', results);
      res.send({ message: 'Data submitted successfully!' });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
