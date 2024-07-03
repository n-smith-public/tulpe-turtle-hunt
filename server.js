const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path');
const redis = require('ioredis');
const RedisStore = require('connect-redis').default;
const modRewrite = require ( 'connect-modrewrite' );
const moment = require('moment');
const nodemailer = require( 'nodemailer' );
const crypto = require( 'crypto' );
const fs = require( 'fs' );
const { promisify } = require('util');
const consoleStamp = require('console-stamp');

consoleStamp(console, {
    format: ':date(yyyy.mm.dd HH:MM:ss.l)',
    include: ['log', 'info', 'warn', 'error', 'debug'],
    colors: {
        stamp: 'yellow',
        label: 'white'
    },
    metadata: 'green'
});

// Define custom label colors using chalk
const labelColors = {
    log: '[LOG]',
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    debug: '[DEBUG]'
};

// Override console methods with chalk colors
overrideConsoleWithColors();

async function overrideConsoleWithColors() {
    const chalk = await import('chalk').then(mod => mod.default);

    console.log = applyLabelColor(console.log, labelColors.log, chalk.blueBright);
    console.info = applyLabelColor(console.info, labelColors.info, chalk.green);
    console.warn = applyLabelColor(console.warn, labelColors.warn, chalk.yellow);
    console.error = applyLabelColor(console.error, labelColors.error, chalk.red);
    console.debug = applyLabelColor(console.debug, labelColors.debug, chalk.cyan);
}

function applyLabelColor(method, label, colorFunc) {
    return (...args) => method(colorFunc(`${label} ${args.join(' ')}`));
}


const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

const redisClient = redis.createClient({
    host: process.env.DB_CACHE_ENDPOINT,
    port: 19549,
    password: process.env.DB_CACHE_PASSWORD,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            return true;
        }
    },
    connectTimeout: 30000
})

redisClient.on('error', (err) => {
    console.error('Redis error: ', err);
    console.error(err.stack);
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

const ConfEmail = process.env.CONFIRMATION_EMAIL;
const ConfPass = process.env.CONFIRMATION_PASSWORD;
const transporter = nodemailer.createTransport({
    service: 'Zoho',
    port: 465,
    secure: true,
    auth: {
        user: ConfEmail,
        pass: ConfPass
    },
    tls: {
        rejectUnAuthorized: true
    }
});

let confirmationCode = '';
let expiration = 0;

const generateConfCode = () => {
    confirmationCode = crypto.randomBytes(8).toString('hex');
    expiration = moment().add(5, 'minutes').valueOf();
    return { code: confirmationCode, expiration };
}

app.post('/send-confirmation-code', async (req, res) => {
    try {
        const { code, expiration } = generateConfCode();

        const emailTemplate = fs.readFileSync(path.join(__dirname, 'confirmationCode.html'), 'utf8');
        const emailContent = emailTemplate.replace('{{confirmationCode}}', code);

        await transporter.sendMail({
            from: 'Tulpe Turtle Hunt <greenbueller@greenbueller.com>',
            to: 'pennygaming10@gmail.com',
            subject: 'Confirmation Code for Data Purge',
            html: emailContent,
            text: 'Your confirmation code is: ', code
        });
        res.status(200).json({ message: 'Confirmation code sent successfully.' });
    } catch(error) {
        console.error('Error sending confirmation code: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/verify-confirmation-code', async (req, res) => {
    const { code } = req.body;

    if (code !== confirmationCode) {
        return res.status(403).json({ error: 'Incorrect confirmation code' });
    }

    const currentTimestamp = moment().valueOf();
    if (currentTimestamp > expiration) {
        return res.status(400).json({ error: 'Confirmation code has expired.' });
    }
    try {
        await promisify(pool.query).bind(pool)("DELETE FROM userData WHERE firstName <> 'Sample' AND lastName <> 'Data';");
        confirmationCode = '';
        res.status(200),json({ message: 'Data deleted successfully. '});
    } catch(error) {
        console.error('Error deleting data: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.use(modRewrite([
    '^/$ /index.html [L]',
    '^/submit$ /submit.html [L]',
    '^/about$ /about.html [L]',
    '^/queries$ /data.html [L]'
]));

app.use(express.static(path.join(__dirname)));
app.use('/CSS', express.static(path.join(__dirname + '/CSS')));
app.use('/Media', express.static(path.join(__dirname + '/Media')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
})

app.get('/submit', (req, res) => {
    res.sendFile(path.join(__dirname, 'submit.html'));
})

const correctPassword = process.env.QUERY_PASSWORD;
const maxAttempts = 5;
const attemptWindow = 300;
const lockoutTime = 3600;
const getAttemptsKey = (ip) => 'attempts:${ip}';
const getLockoutKey = (ip) => 'lockout:${ip}';

app.post('/verify-password', async (req, res) => {
    const { password } = req.body;
    const ip = req.ip;

    const lockoutKey = getLockoutKey(ip);
    const attemptsKey = getAttemptsKey(ip);

    try {
        const isLockedOut = await redisClient.get(lockoutKey);
        if (isLockedOut) {
            return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
        }

        if (password === correctPassword) {
            await redisClient.del(attemptsKey);
            res.redirect('/queries');
        } else {
            const attempts = await redisClient.incr(attemptsKey);
            if (attempts === 1) {
                await redisClient.expire(attemptsKey, attemptWindow);
            }

            if (attempts >= maxAttempts) {
                await redisClient.set(lockoutKey, '1', 'EX', lockoutTime);
                await redisClient.del(attemptsKey);
                return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
            } else {
                return res.status(401).json({ error: 'Incorrect password' });
            }
        }
    } catch (error) {
        console.error('Error validating password: ', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

if (process.env.NODE_ENV === 'development') {
    app.post('/reset-attempts', async (req, res) => {
        const ip = req.body.ip;
    
        try {
            // Reset attempts logic here
            await redisClient.del(`attempts:${ip}`);
            console.log(`Attempts reset successfully for IP: ${ip}`);
            res.status(200).json({ message: 'Attempts reset successfully.' });
        } catch (error) {
            console.error('Error resetting attempts: ', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}

app.get('/lockout-status', async (req, res) => {
    const ip = req.ip;
    const lockoutKey = getLockoutKey(ip);

    try {
        // Force fetch from Redis without cache
        redisClient.get(lockoutKey, (err, isLockedOut) => {
            if (err) {
                console.error('Error checking lockout status:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json({ lockedOut: !!isLockedOut });
        });
    } catch (error) {
        console.error('Error checking lockout status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


const pool = mysql.createPool({
  connectionLimit: 60000,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.PORT || 3306,
});

const validateSQLCall = (value) => {
    const sqlRegex =/(\bdrop\b|\bdelete\b|\btruncate\b|\binsert\b|\bupdate\b|\bselect\b|\bunion\b|\bwhere\b|\bfrom\b|\blike\b|\binto\b|\bexec\b|\bcreate\b|\bprocedure\b|\bexecute\b)/i;
    if (sqlRegex.test(value)) {
        console.error('SQL injection attempt found: ', value);
        const error = new Error('Input contained restricted keywords.');
        error.status = 406;
        throw error;
    }
    return true;
}

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
    body('firstName').isLength({ max: 40 }).notEmpty().withMessage('First name is required field and must be less than 40 characters.').custom(validateSQLCall),
    body('lastName').optional({ checkFalsy: true }).isLength({ max: 40 }).withMessage('Last name must be less than 40 characters.').custom(validateSQLCall),
    body('pronouns').optional({ checkFalsy: true }).isLength({ max: 40 }).withMessage('Pronouns must be less than 15 characters').custom(validateSQLCall),
    body('lodge').optional({ checkFalsy: true }).isLength({ max: 40 }).withMessage('Lodge must be less than 40 characters').custom(validateSQLCall),
    body('email').optional({ checkFalsy: true  }).isEmail().withMessage('Email address must be of a valid form.')
        .isLength({ max: 50 }).withMessage('Email must be less than 50 characters').custom(validateSQLCall),
    body('discord').optional({ checkFalsy: true }).isLength({ max: 32 }).withMessage('Discord username must be less than 32 characters').custom(validateSQLCall),
    body('comments').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Comments must be less than 1,000 characters.').custom(validateSQLCall),
    body('deviceType').isIn(['Android', 'Computer', 'iOS', 'Other']).withMessage('Device type must be either mobile or computer.')
], (req, res) => {
    try {
        const { deviceType, firstName, lastName, pronouns, lodge, email, discord, comments } = req.body;

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

        const sql = 'INSERT INTO userData (deviceType, firstName, lastName, pronouns, lodge, email, discord, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        const values = [deviceType, firstName, lastName, pronouns, lodge, email, discord, comments];

        pool.query(sql, values, (error, results) => {
            if (error) {
                console.error('Error inserting data:', error);
                return res.status(500).send({ error: 'Error inserting data' });
            }
            console.log('Data inserted successfully: ', results);
            res.status(200).json({ message: 'Data submitted successfully!' });
        });
    } catch (err) {
        console.error('Error processing request: ', err.message);
        if (err.message === 'Input contained restricted keywords.') {
            res.status(406).json({ error: 'Invalid data entry, attempted SQL injection possible.'});
        } else {
            res.status(500).json({ error: 'Internal server error.'});
        }
    }
});

app.get('/query-device-data', (req, res) => {
    const query = `
        SELECT deviceType AS 'Device Data', count(deviceType) AS 'Count'
        FROM userData
        WHERE deviceType IS NOT NULL AND deviceType != ''
        GROUP BY deviceType
        `;
    
        pool.query(query, (error, results) => {
            if (error) {
                res.status(500).send(error);
                return;
            }
            res.json(results);
        });
});

app.get('/query-lodge-data', (req, res) => {
    pool.query(
        'SELECT lodge AS \'Lodge\', count(lodge) AS \'Count\' FROM userData WHERE lodge IS NOT NULL AND lodge != \'\' GROUP BY lodge',
        (error, results) => {
            if (error) {
                console.error('Error fetching lodge data:', error);
                res.status(500).json({ error: 'Failed to fetch lodge data' });
                return;
            }
            res.json(results);
        }
    );
});

app.get('/query-pronouns-data', (req, res) => {
    pool.query(
        'SELECT pronouns AS \'Pronouns\', count(pronouns) AS \'Count\' FROM userData WHERE pronouns IS NOT NULL AND pronouns != \'\' GROUP BY pronouns',
        (error, results) => {
            if (error) {
                console.error('Error fetching pronouns data:', error);
                res.status(500).json({ error: 'Failed to fetch pronouns data' });
                return;
            }
            res.json(results);
        }
    );
});

app.get('/query-people-count-by-date', (req, res) => {
    const query = `
        SELECT creation_date AS Date, COUNT(*) AS Count
        FROM userData
        GROUP BY creation_date
        ORDER BY creation_date
    `;
    
    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching people count by date:', error);
            res.status(500).json({ error: 'Failed to fetch people count by date' });
            return;
        }

        // Calculate cumulative counts
        let cumulativeCount = 0;
        const dataWithCumulative = results.map(entry => {
            cumulativeCount += entry.Count;
            return {
                Date: moment(entry.Date).format('YYYY-MM-DD'), // Format date if needed
                
                Count: cumulativeCount
            };
        });

        res.json(dataWithCumulative);
    });
});

app.get('/query-all-user-data', (req, res) => {
    const query = `
        SELECT 
            userID AS 'User ID', 
            DATE_FORMAT(creation_date, '%Y-%m-%d, %H:%i') AS 'Creation Date', 
            deviceType AS 'Device Type', 
            firstName AS 'First Name', 
            lastName AS 'Last Name', 
            pronouns AS 'Pronouns', 
            lodge AS 'Lodge', 
            email AS 'Email', 
            discord AS 'Discord', 
            comments AS 'Comments'
        FROM userData
        ORDER BY creation_date;
    `;

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching user data: ', error);
            res.status(500).json({ error: 'Failed to fetch user data. '});
            return;
        }
        res.json(results);
    })
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
