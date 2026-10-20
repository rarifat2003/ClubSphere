const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'rifat2003',
    database: 'clubsphere',
    dateStrings: true   // return DATE columns as 'YYYY-MM-DD' strings (no timezone shifting)
})

module.exports = db;