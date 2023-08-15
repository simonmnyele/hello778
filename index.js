const axios = require('axios');
var mysql = require('mysql');
const util = require('util');
var conn = require('./database');
const usernames = require('./accounts');
const TelegramBot = require('node-telegram-bot-api');
// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const bot = new TelegramBot('6437077973:AAG3NR2uf7eo3mKV-BvQPXQaHKn2vgCvPCc', { polling: false });
var CronJob = require('cron').CronJob;
const xkey = 'cbee6594acmshfc7d684a783cf93p11067ejsn6eee5e31660a';
let isRunning = false;

var job = new CronJob('*/5 * * * *', function () { //run every hour
    if (isRunning == false) { getFollowingsv2() };
});
job.start();

async function getAllData(query, parentID) {
    try {
        // Execute the query
        const sql = `SELECT * FROM userFollowings WHERE parentUser = ${parentID}`;
        let results = await query(sql);
        let databaseItems = [];
        for (let item of results) {
            let userData = {
                user_id: item.followingsID,
                username: item.followingsUsername,
            }
            databaseItems.push(userData);
        }
        return databaseItems;

    } catch (error) {
        throw error;
    }
}

async function saveBackLog(query, parentID) {
    try {
        // Execute the query
        const sql = `SELECT 1 FROM userFollowings WHERE parentUser = ${parentID} LIMIT 1`;
        let results = await query(sql);
        const exists = results.length > 0;
        return exists;
    } catch (error) {
        throw error;
    }
}

async function checkUserID(query, userID, parentID) {
    try {
        // Execute the query
        const sql = `SELECT 1 FROM userFollowings WHERE followingsID = ${userID} AND parentUser = ${parentID} LIMIT 1`;
        let results = await query(sql);
        const exists = results.length > 0;
        return exists;
    } catch (error) {
        throw error;
    }
}

async function saveUser(query, dataObject) {
    const { parentUser, followingsID, followingsUsername, createdAt } = dataObject;
    var sql = `INSERT INTO userFollowings(parentUser, followingsID, followingsUsername, createdAt) VALUES ('${parentUser}', '${followingsID}','${followingsUsername}', '${createdAt}')`;
    await query(sql);
}

const getFollowingsv2 = async () => {
    console.log('Session Started!');

    var connection = mysql.createConnection(conn);
    const query = util.promisify(connection.query).bind(connection);

    isRunning = true;
    for (let parent of usernames) {
        const followingCount = await getFollowingsCount(parent.user, parent.id);
        if (followingCount == 0) { continue; }

        let completeFollowings = [];
        const options = {
            method: 'POST',
            url: 'https://twitter154.p.rapidapi.com/user/following',
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': xkey,
                'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
            },
            data: {
                user_id: parent.id,
                limit: '100'
            }
        };

        try {
            const response = await axios.request(options);
            let userObjects = response.data.results;
            let continuation_token = response.data.continuation_token;

            if (userObjects.length == 0) {
                console.log(`No followings for user ${user_id.user}`);
                continue;
            }

            for (let item of userObjects) {
                completeFollowings.push(item);
            }

            if (continuation_token.startsWith('0|')) {
                console.log('End of followings');
            }
            else if (followingCount < 500 || parent.user == 'flopstofreedom') {
                console.log('More Followings');
                while (1) {
                    if (continuation_token.startsWith('0|')) { break; }
                    await delay(1000);
                    const options = {
                        method: 'GET',
                        url: 'https://twitter154.p.rapidapi.com/user/following/continuation',
                        params: {
                            user_id: parent.id,
                            continuation_token,
                            limit: '100'
                        },
                        headers: {
                            'X-RapidAPI-Key': xkey,
                            'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
                        }
                    };

                    try {
                        const response = await axios.request(options);
                        userObjects = response.data.results;
                        continuation_token = response.data.continuation_token;
                        for (let item of userObjects) {
                            completeFollowings.push(item);
                        }
                    } catch (error) {
                        console.error(error);
                        break;
                    }
                }
            }


            const parentExists = await saveBackLog(query, parent.id); //If false then save the current data as a reference
            console.log(`${parent.id} exists: ${parentExists}`);

            if (parentExists == false) {
                //save the items to database and skip parent
                for (let item of completeFollowings) {
                    let userData = {
                        parentUser: parent.id,
                        followingsID: item.user_id,
                        followingsUsername: item.username,
                        createdAt: item.creation_date
                    }
                    await saveUser(query, userData);
                }
                continue;
            }
            else {
                const databaseItems = await getAllData(query, parent.id);
                const newitems = findMissingObjects(databaseItems, completeFollowings);

                for (let item of newitems) {
                    //const exists = await checkUserID(query, item.user_id, parent.id);
                    // Add user to database
                    let userData = {
                        parentUser: parent.id,
                        followingsID: item.user_id,
                        followingsUsername: item.username,
                        createdAt: item.creation_date
                    }

                    await saveUser(query, userData);
                    sendNotification(parent.user, item.username);
                }
            }


        } catch (error) {
            console.error(error);
        }
    }
    isRunning = false;
    connection.end();
    console.log('Session Complete!');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendNotification(parentUsername, username) {
    const message = `${parentUsername} just followed ${username}
${parentUsername}: www.twitter.com/${parentUsername}
${username}: www.twitter.com/${username}`;

    const chatId = '809676911'; // Replace with the chat ID of your desired Telegram chat

    bot.sendMessage(chatId, message)
        .then(() => {
            console.log('Notification sent successfully.');
        })
        .catch((error) => {
            console.error('Error sending notification:', error);
        });
}

async function getFollowingsCount(username, id) {

    const options = {
        method: 'GET',
        url: 'https://twitter154.p.rapidapi.com/user/details',
        params: {
            username: username,
            user_id: id
        },
        headers: {
            'X-RapidAPI-Key': xkey,
            'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        return response.data.following_count;
    } catch (error) {
        console.error(error);
        return 0;
    }
}

function findMissingObjects(array1, array2) {
    return array2.filter(item2 => {
        return !array1.some(item1 =>
            item1.user_id === item2.user_id
        );
    });
}
