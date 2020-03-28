require("dotenv").config()

const fs = require("fs");
const Discord = require("discord.js")
const bot = new Discord.Client()
bot.stats = require(process.env.STATS_FILE_PATH)
bot.daily = require(process.env.DAILY_FILE_PATH)

const interval = 60;

untrackedActivity = ["Custom Status", "Spotify", "Call of Duty: Modern Warfare"];

bot.on("ready", () => {
    console.log(`Logged in as ${bot.user.tag} (bot)!`)
    bot.user.setPresence({
        activity: {
            name: 'Plague INC.',
            type: 'PLAYING'
        },
        status: 'online'
    })

    scan();
    setInterval(scan, interval * 1000);
})

async function scan() {
    var date = new Date();
    console.log(date);
    console.log(date.getHours(), date.getMinutes());
    if(date.getHours() === 14 && date.getMinutes() === 14){
        console.log('[file] Reseting daily...')
        fs.writeFile(process.env.DAILY_FILE_PATH, JSON.stringify({}, null, 4), err => {
            if (err) throw err;
            console.log('[file] ... DONE')
            console.log(bot.daily);
        });
    }

    bot.users.cache.map(users => users).filter(user => user.presence.status !== "offline" && !user.bot).forEach(user => {
        if (!user.presence.member) { 
            console.log('there is a problem with the following user', user);
        } else {
            const id = user.presence.member.id;

            // Creation de l'utilisateur dans la BDD
            if (bot.stats[id] === undefined) {
                bot.stats[id] = { "name": user.presence.member.displayName, "activities": {} }
            }
            
            if (bot.daily[id] === undefined) {
                bot.daily[id] = { "name": user.presence.member.displayName, "activities": {} }
            }

            // Check de la présence
            userStats = bot.stats[id];
            if (userStats[user.presence.status] === undefined) {
                userStats[user.presence.status] = 0;
            } else {
                userStats[user.presence.status] += interval;
            }

            userStatsDaily = bot.daily[id];
            if (userStatsDaily[user.presence.status] === undefined) {
                userStatsDaily[user.presence.status] = 0;
            } else {
                userStatsDaily[user.presence.status] += interval;
            }
            
            // Check de l'activité
            userStatActivities = userStats["activities"];
            user.presence.activities.filter(activity => !untrackedActivity.includes(activity.name)).forEach(activity => {
                if (userStatActivities[activity.name] === undefined) {
                    userStatActivities[activity.name] = 0;
                } else {
                    userStatActivities[activity.name] += interval;
                    }
            });
            
            userStatActivitiesDaily = userStatsDaily["activities"];
            user.presence.activities.filter(activity => !untrackedActivity.includes(activity.name)).forEach(activity => {
                if (userStatActivitiesDaily[activity.name] === undefined) {
                    userStatActivitiesDaily[activity.name] = 0;
                } else {
                    userStatActivitiesDaily[activity.name] += interval;
                }
            });
            console.log(`Saving ${user.presence.member.displayName} DONE`);
        }
    });

    console.log('[file] Saving global ...');
    fs.writeFile(process.env.STATS_FILE_PATH, JSON.stringify(bot.stats, null, 4), err => {
        if (err) throw err;
        console.log('[file] ... DONE')
    });

    console.log('[file] Saving daily ...');
    fs.writeFile(process.env.DAILY_FILE_PATH, JSON.stringify(bot.daily, null, 4), err => {
        if (err) throw err;
        console.log('[file] ... DONE')
    });
}

bot.on("message", msg => {
    if (msg.content.startsWith('!stats') && !msg.author.bot) {
        stats = bot.stats[msg.member.id];

        msgSplit = msg.content.split(' ');
        firstParam = msgSplit[1];
        secondParam = msgSplit[2];
        if (firstParam && firstParam.length === 18) {
            if (bot.stats.hasOwnProperty(firstParam)) {
                stats = bot.stats[firstParam];
            }
        } else if (firstParam === "global") {
            allStats(msg.channel, secondParam === "daily");
            return;
        } else if (firstParam === "daily") {
            stats = bot.daily[msg.member.id];
        }
        
        msg.channel.send(new Discord.MessageEmbed()
            .setTitle(`${stats["name"]}`)
            .addField('Présence',presence(stats))
            .addField('Activité',activity(stats))
            .setColor("RANDOM")
            .setFooter("provided by Le Voisin")
            .setTimestamp()
        )
    }
})

function toTime(value) {
    return value.toString().toHHMMSS();
}

function presence(stats) {
    summary = ''
    if (stats["online"] !== undefined) summary += `Connecté - ${toTime(stats["online"])}\n`;
    if (stats["dnd"] !== undefined) summary += `Ne pas déranger - ${toTime(stats["dnd"])}\n`;
    if (stats["idle"] !== undefined) summary += `Absent - ${toTime(stats["idle"])}\n`;

    return summary;
}

function activity(stats) {
    summary = ''
    activities = stats["activities"]
    for (const activity in activities) {
        if (activities.hasOwnProperty(activity)) {
            const element = activities[activity];
            summary += `${activity} - ${toTime(element)}\n`
        }
    }
    return summary === '' ? 'Aucune activité enregistré' : summary;
}

function allStats(channel, daily) {
    stats = bot.stats;
    statsGames = {};
    statsActivities = {};
    statsPresence = {};

    if (daily) {
        stats = bot.daily
    }

    for (const user in stats) {
        if (stats.hasOwnProperty(user)) {
            const userid = stats[user];
            const name = userid["name"];
            const activities = userid["activities"];
            timePlayed = 0;
            timePresence = 0;
            for (const game in activities) {
                if (activities.hasOwnProperty(game)) {
                    if (game !== "Custom Status") {
                        const value = activities[game];
                        timePlayed += value;
                        if (!statsGames[game]) {
                            statsGames[game] = value;
                        } else {
                            statsGames[game] += value;
                        }
                    }
                }
            }
            if (userid["online"] !== undefined) timePresence += userid["online"];
            if (userid["dnd"] !== undefined) timePresence += userid["dnd"];
            if (userid["idle"] !== undefined) timePresence += userid["idle"];
        
            statsPresence[name] = timePresence;
            statsActivities[name] = timePlayed;
        }
    }

    presences = Object.entries(statsPresence).sort(function(a,b){return b[1] - a[1]});
    activities = Object.entries(statsActivities).sort(function(a,b){return b[1] - a[1]});
    games = Object.entries(statsGames).sort(function(a,b){return b[1] - a[1]});
    n = 10;

    sP = '';
    presences.slice(0,n).forEach(pres => {
        sP += `${pres[0]} - ${toTime(pres[1])}\n`;
    });

    sA = '';
    activities.slice(0,n).forEach(activity => {
        sA += `${activity[0]} - ${toTime(activity[1])}\n`;
    });

    sG = '';
    games.slice(0,n).forEach(game => {
        sG += `${game[0]} - ${toTime(game[1])}\n`;
    });

    channel.send(new Discord.MessageEmbed()
            .setTitle('TOP 10')
            .addField('Présence',sP)
            .addField('Activité cumulé',sA)
            .addField('Jeux',sG)
            .setColor("RANDOM")
            .setFooter("provided by Le Voisin")
            .setTimestamp()
        )
}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+'h'+minutes+'m';
}

bot.login(process.env.BOT_TOKEN)
