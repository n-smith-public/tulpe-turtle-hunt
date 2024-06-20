const express = require('express');
const mysql = require('mysql');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const { check, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path');
const Redis = require('ioredis');
const RedisStore = require('connect-redis').default;

const app = express();
const port = process.env.PORT || 3000;
const redisHost = process.env.DB_CACHE_ENDPOINT;
const redisPort = 19549;
const redisPassword = process.env.DB_CACHE_PASSWORD;

const redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
});

redisClient.on('connect', function() {
    console.log('Connected to Redis');
});

redisClient.on('error', function(err) {
    console.error('Redis connection error: ', err);
});

module.exports = redisClient;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        httpOnly: false,
        maxAge: 24 * 60 * 60 * 1000,
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

const validateForm = [
    check('firstName').notEmpty().withMessage('First name is required.'),
    check('email').isEmail().withMessage('Invalid email format.'),
];

app.post('/submit-data', validateForm, (req, res) => {
    const { firstName, lastName, pronouns, lodge, email, discord, comments } = req.body;

    if (!req.isAuthenticated()) {
        res.status(400).send('Unauthorized.');
        return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const sql = 'INSERT INTO userData (firstName, lastName, pronouns, lodge, email, discord, comments) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [firstName, lastName, pronouns, lodge, email, discord, comments];

    pool.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error inserting data:', error);
            return res.status(500).send({ error: 'Error inserting data' });
        }
        console.log('Data inserted successfully: ', results);
        res.send({ message: 'Data submitted successfully!' });
    });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
