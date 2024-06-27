const express = require('express');
const mysql = require('mysql');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path');
const swal = require('sweetalert');
const redis = require('ioredis');
const RedisStore = require('connect-redis').default;
const modRewrite = require ( 'connect-modrewrite' );
const moment = require('moment');

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
