require("dotenv").config()

const fs = require("fs");
const Discord = require("discord.js")
const bot = new Discord.Client()
bot.stats = require(process.env.STATS_FILE_PATH)

const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const interval = 60;

bot.on("ready", () => {
    console.log(`Logged in as ${bot.user.tag}!`)
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
    bot.users.cache.map(users => users).filter(user => user.presence.status !== "offline" && !user.bot).forEach(user => {
        const id = user.presence.member.id;

        // Creation de l'utilisateur dans la BDD
        if (bot.stats[id] === undefined) {
            bot.stats[id] = { "name": user.presence.member.displayName, "activities": {} }
        } 

        // Check de la présence
        userStats = bot.stats[id];
        if (userStats[user.presence.status] === undefined) {
            userStats[user.presence.status] = 0;
        } else {
            userStats[user.presence.status] += interval;
        }

        // Check de l'activité
        userStatActivities = userStats["activities"];
        user.presence.activities.forEach(activity => {
            if (userStatActivities[activity.name] === undefined) {
                userStatActivities[activity.name] = 0;
            } else {
                userStatActivities[activity.name] += interval;
            }
        });
    });

    fs.writeFile(process.env.STATS_FILE_PATH, JSON.stringify(bot.stats, null, 4), err => {
        if (err) throw err;
    });
}

function displayMultipleMembers(channel, members) {
    members.forEach(m => {
        displayMemberDetails(channel, m);
    })
}

function displayMemberDetails(channel, member) {
    output = member.displayName + ' a joint le ' + member.joinedAt.toLocaleDateString('fr-FR', options);
    channel.send(output);
}

bot.on("message", msg => {
    if (msg.content.startsWith('!stats') && !msg.author.bot) {
        stats = bot.stats[msg.member.id];

        firstParam = msg.content.split(' ')[1];
        if (firstParam && firstParam.length === 18) {
            if (bot.stats.hasOwnProperty(firstParam)) {
                stats = bot.stats[firstParam];
            }
        } else if (firstParam === "global") {
            allStats(msg.channel);
            return;
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
    if (msg.content.startsWith('bot') && !msg.author.bot) {
        params = msg.content.split(' ');
        params.shift();

        if (params) {
            if (params[0] === "channels") {
                for (let [id, chan] of msg.guild.channels.cache) {
                    if (chan.type !== 'voice') { continue; }
                    reply = chan.name + ' créé le ' + chan.createdAt;
                    msg.channel.send(reply);
                }
            }
            if (params[0] === "users") {
                membersSorted = msg.guild.members.cache.map((member, id) => member).slice().sort((a, b) => b.joinedAt - a.joinedAt)

                if (params.length === 1) {
                    msg.channel.send(`Il y a ${membersSorted.length} membres sur le serveur`);
                    displayMultipleMembers(msg.channel, membersSorted);
                } else {
                    switch (params[1]) {
                        case "help":
                            output = 'bot users last : envoie le dernier membre ajouté' +
                                '\nbot users first : envoie le premier membre ajouté' +
                                '\nbot users me : envoie toi connard' +
                                '\nbot users <mentions> : envoie tout les membres mentionnés' +
                                '\nbot users : envoie tout les membres';
                            msg.channel.send(output);
                            break;
                        case "first":
                            displayMemberDetails(msg.channel, membersSorted[membersSorted.length - 1]);
                            break;
                        case "last":
                            displayMemberDetails(msg.channel, membersSorted[0]);
                            break;
                        case "me":
                            displayMemberDetails(msg.channel, membersSorted.filter(m => m.user.id === msg.author.id)[0]);
                            break;
                        default:
                            if (msg.mentions.members.size) {
                                membs = msg.mentions.members.map((member, id) => member).slice().sort((a, b) => b.joinedAt - a.joinedAt)
                                displayMultipleMembers(msg.channel, membs);
                            } else {
                                msg.channel.send('comprend po. Essaye \'bot users help\' pour voir...');
                            }
                    }
                }
            }
        }
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

function allStats(channel) {
    statsGames = {};
    statsActivities = {};
    statsPresence = {};
    for (const user in bot.stats) {
        if (bot.stats.hasOwnProperty(user)) {
            const userid = bot.stats[user];
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