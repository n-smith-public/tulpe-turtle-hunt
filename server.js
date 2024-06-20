const express = require('express');
const mysql = require('mysql');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path');
const swal = require('sweetalert');
const redis = require('ioredis');
const RedisStore = require('connect-redis').default;

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

const redisClient = redis.createClient({
    host: process.env.DB_CACHE_ENDPOINT,
    port: 19549,
    password: process.env.DB_CACHE_PASSWORD
})

redisClient.on('error', (err) => {
    console.error('Redis error: ', err);
})

redisClient.on('connect', function() {
    console.log('Connected to Redis.');
})

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: [ 'profile', 'email' ],
},
(accessToken, refreshToken, profile, done) => {
    console.log('Google Strategy callback performed successfully.');
    done(null, profile);
}));

passport.serializeUser((user,done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(express.static(path.join(__dirname)));
app.use('/CSS', express.static(path.join(__dirname + '/CSS')));
app.use('/Media', express.static(path.join(__dirname + '/Media')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
})

app.get('/submit', (req, res) => {
    res.sendFile(path.join(__dirname, 'submit.html'));
})

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/google');
};

app.get('/auth/google',
    passport.authenticate('google', { scope: [ 'profile', 'email' ] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.sendFile(path.join(__dirname, 'submit.html'));
    }
);

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

app.get('/auth/status', (req, res) => {
    res.send({ loggedIn: req.isAuthenticated() });
});

app.get('/keep-active', (req, res) => {
    res.status(200).send('Server active');
})

app.get('/test-db', (req, res) => {
    pool.query('SELECT 1', (error, results) => {
        if (error) {
            console.error('A database connection error occured: ', error);
            return res.status(500).send('Database connection error.');
        }
        res.send('Database connection successful.');
    })
})

const pool = mysql.createPool({
  connectionLimit: 60000,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.PORT || 3306,
});

app.get('/userData/count', async (req, res) => {
    try {
        const query = 'SELECT COUNT(*) AS count FROM userData';
        pool.query(query, (err, rows) => {
            if (err) {
                console.error('Error executing query: ', err);
                return res.status(500).json({ error: 'Error executing query' });
            }

            if (!rows || rows.length === 0) {
                throw new Error('No rows found in userData relation.');
            }

            const count = rows[0].count;
            res.json({ count });
        })
    } catch (err) {
        console.error('Error fetching row count: ', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/submit-data', [
    body('firstName').notEmpty().withMessage('First name is required field.'),
    body('email').isEmail().withMessage('A valid email address is required.')
], (req, res) => {
    const { firstName, lastName, pronouns, lodge, email, discord, comments } = req.body;

    /*if (!req.isAuthenticated()) {
        res.status(400).send('Unauthorized.');
        return;
    }*/

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation of responses failed.', 
            errors: errors.array().map(err => err.msg) 
        });
    }

    const sql = 'INSERT INTO userData (firstName, lastName, pronouns, lodge, email, discord, comments) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [firstName, lastName, pronouns, lodge, email, discord, comments];

    pool.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error inserting data:', error);
            return res.status(500).send({ error: 'Error inserting data' });
        }
        console.log('Data inserted successfully: ', results);
        res.status(200).json({ message: 'Data submitted successfully!' });
    });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
