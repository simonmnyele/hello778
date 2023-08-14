const axios = require('axios');
var mysql = require('mysql');
const util = require('util');
var conn = require('./database');
const usernames = require('./accounts');
const TelegramBot = require('node-telegram-bot-api');
// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const bot = new TelegramBot('6437077973:AAG3NR2uf7eo3mKV-BvQPXQaHKn2vgCvPCc', { polling: false });
var CronJob = require('cron').CronJob;


var job = new CronJob('*/5 * * * *', function () { //run every hour
    getFollowingsv2();
});
job.start();

async function saveBackLog(parentID) {
    var connection = mysql.createConnection(conn);
    const query = util.promisify(connection.query).bind(connection);

    try {
        // Execute the query
        const sql = `SELECT COUNT(*) AS count FROM userFollowings WHERE parentUser = ${parentID}`;
        let results = await query(sql);
        // Check if the count is greater than 0
        const count = results[0].count;
        const exists = count > 0;

        return exists;
    } catch (error) {
        throw error;
    } finally {
        // Close the database connection
        connection.end();
    }
}

async function checkUserID(userID, parentID) {
    var connection = mysql.createConnection(conn);
    const query = util.promisify(connection.query).bind(connection);

    try {
        // Execute the query
        const sql = `SELECT COUNT(*) AS count FROM userFollowings WHERE followingsID = ${userID} AND parentUser = ${parentID}`;
        let results = await query(sql);
        // Check if the count is greater than 0
        const count = results[0].count;
        const exists = count > 0;

        return exists;
    } catch (error) {
        throw error;
    } finally {
        // Close the database connection
        connection.end();
    }
}

async function saveUser(dataObject) {
    const { parentUser, followingsID, followingsUsername, createdAt } = dataObject;

    var connection = mysql.createConnection(conn);
    const query = util.promisify(connection.query).bind(connection);

    var sql = `INSERT INTO userFollowings(parentUser, followingsID, followingsUsername, createdAt) VALUES ('${parentUser}', '${followingsID}','${followingsUsername}', '${createdAt}')`;
    await query(sql);
    connection.end();
}

const getFollowingsv2 = async () => {
    console.log('Session Started!');
    for (let parent of usernames) {

        const options = {
            method: 'POST',
            url: 'https://twitter154.p.rapidapi.com/user/following',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': 'cbee6594acmshfc7d684a783cf93p11067ejsn6eee5e31660a',
                'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
            },
            data: {
                user_id: parent.id,
                limit: '5'
            }
        };

        try {
            const response = await axios.request(options);
            const userObjects = response.data.results;

            if (userObjects.length == 0) {
                console.log(`No followings for user ${user_id.user}`);
                continue;
            }

            let counter = 0;
            const parentExists = await saveBackLog(parent.id); //If false then save the current data as a reference

            for (let item of userObjects) {
                const exists = await checkUserID(item.user_id, parent.id);

                if (exists == false) {
                    // Add user to database
                    let userData = {
                        parentUser: parent.id,
                        followingsID: item.user_id,
                        followingsUsername: item.username,
                        createdAt: item.creation_date
                    }

                    await saveUser(userData);
                    debugger;
                    if (parentExists == true) { sendNotification(parent.user, item.username); }
                }
                counter++;
                if (counter === 5) {
                    break;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
    console.log('Session Complete!');
}

function sendNotification(parentUsername, username) {
    const message = `${parentUsername} just followed ${username}
${parentUsername}: www.twitter.com/${parentUsername}
${username}: www.twitter.com/${username}`;

    console.log(message);
    debugger;
    const chatId = '809676911'; // Replace with the chat ID of your desired Telegram chat

    bot.sendMessage(chatId, message)
        .then(() => {
            console.log('Notification sent successfully.');
        })
        .catch((error) => {
            console.error('Error sending notification:', error);
        });
}
