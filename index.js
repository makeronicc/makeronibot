const Discord = require("discord.js");
const http = require("http");
const schedule = require('node-schedule');

const BOT_TOKEN = process.env.BOT_TOKEN;
const client = new Discord.Client();
let discordReady = false;

client.login(BOT_TOKEN);

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
 
const adapter = new FileSync('db.json')
const db = low(adapter)
const offset = Number(process.env.TIME_OFFSET) || 0;
const ZoomLink = process.env.ZOOMLINK

console.log("Time offset should follow")
console.log(process.env.TIME_OFFSET)
console.log(`Time offset is ${offset}`)

db.defaults({ projects: {}, users: [], channels: [] }).write()

let guild;

const channels = {
    sandbox: '756834681298747424',
    general: '730415016716533934'
}

client.on("message", function (message) {
  const timeTaken = Date.now() - message.createdTimestamp;
  let content = message.content;

  guild = { name: message.guild.name, id: message.guild.id };

  if (message.author.bot) return;

  if (content === "!help") {
    message.reply('Well I can do a lot of things - you just gotta work em out for yourself ✊')
  }

  if (content === "!ping") message.reply(`Pong! This message had a latency of ${timeTaken}ms.`);
  if (content === "!channel get id") message.reply(message.channel.id);
  if (content === "!minutes") getMinutes().then(links => message.reply(`Here's a list of all the links posted today: ${links.join(', ')}`));
  if (content === "!project") {
      message.reply(`Use !project [description] to set the project you are working on, !project-finished to mark it as finished and !projects to view all the other projects people are working on.`)
  }
  if (content === "!projects") {
    getProjects().then(projects => {
        message.channel.send(projects.map(proj => `${proj.nickname} ${proj.finished ? 'was' : 'is'} working on: ${proj.project}`).join('\n'))
    }).catch(console.log)
  }
  if (content === "!project-finished") {
      db.get('projects').find({user: message.author.id, current: true}).assign({finished: true, current: false, finishedAt: message.createdTimestamp}).write();
      message.channel.send(`Great job ${message.author} onto the next project!`)
  }
  if (content.startsWith('!project ')) {
    const project = content.replace('!project ', '')
    db.get('projects').find({user: message.author.id, current: true}).assign({finished: true, current: false, finishedAt: message.createdTimestamp}).write();
    db.get('projects').push({
        user: message.author.id,
        project: project,
        finished: false,
        current: true,
        createdAt: message.createdTimestamp
    }).write();
    message.reply(`you are now working on: ${project}`)
  }
  if (content.startsWith('!zoom set')) {
      if(message.author.username === "codepope" || message.author.username === "101stArrow") {
        const zoomLink = content.replace('!zoom set ', '')
        db.set('zoomLink', zoomLink).write()
        message.reply(`The new Zoom link is: ${zoomLink}`)
      } else {
        message.reply("Sorry, you can't set the Zoom link. If you think this is wrong ask Dj or Eric")
      }
  }
});

const getMessages = limit => {
    return client.channels.fetch(channels.general).then(channel => {
        return channel.messages.fetch({ limit: limit || 10 })
        .then(messages => messages.map(msg => {
            return {
                id: msg.id,
                content: msg.content,
                author: {
                    username: msg.author.username,
                    id: msg.author.id,
                    bot: msg.author.bot
                },
                channel: msg.channel.id,
                deleted: msg.deleted,
                timestamp: msg.createdTimestamp
            }
        }))
        .then(messages => messages.sort(function(x, y){
            return x.timestamp - y.timestamp;
        }))
        .catch(console.error);
    }).catch(err => console.log(err))
}

const getMinutes = () => {
    let start = new Date();
    start.setHours(12);
    start.setMinutes(0);
    start.setSeconds(0);

    let end = new Date();
    end.setHours(18);
    end.setMinutes(0);
    end.setSeconds(0);

    return getMessages(30).then(messages => messages.filter(msg => msg.timestamp > start && msg.timestamp < end && msg.author.bot === false && msg.content.startsWith('http'))).then(messages => {
        return messages.map(msg => msg.content);
    })
}

const getMembers = () => {
    return client.guilds.fetch(db.get('guild').value()).then(guild => {
        return guild.members.fetch().then(members => {
          return members.map(member => {
                return {
                    joined: member.joinedTimestamp,
                    nickname: member.nickname || member.user.username,
                    user: member.user,
                    deleted: member.deleted,
                    lastMsg: member.lastMessageID,
                    lastMsgChannel: member.lastMessageChannelID,
                    roles: member._roles
                }
            })
      })
  })
}

const getProjects = () => {
    return getMembers().then(members => {
        return db.get('projects').value().map(proj => {
            proj.nickname = members.filter(m => m.user.id === proj.user)[0].nickname;
            return proj
        });
    })
}

client.on("ready", () => {
  console.log("We're up!")
});

client.on('guildMemberAdd', member => {
  const channel = member.guild.channels.cache.find(ch => ch.name === 'general');
  if (!channel) return;
  channel.send(`Welcome to Makeroni, ${member}`);
});


const openDoors = schedule.scheduleJob(`0 ${12+offset} * * 6`, date => {
    client.channels.fetch(channels.general).then(channel => {
      channel.send(`Open Doors! Come and join us on Zoom at: ${ZoomLink}`);
    }).catch(err => console.log(err))
})

const reminderMessage = schedule.scheduleJob(`0 ${13+offset}-${15+offset} * * 6`, date => {
    getMessages(1).then(messages => {
      if(messages[0].author.username !== "Makeronibot") {
        client.channels.fetch(channels.general).then(channel => {
            channel.send(`Come along, join us on Zoom at: ${ZoomLink}`);
        }).catch(err => console.log(err))
      }
    })
})

const server = http.createServer((function(request,response){
    response.writeHead(200, {"Content-Type" : "text/plain"}); 
    response.end("OK");
    getProjects().then(items => {
        console.log(items);
    }).catch(console.log)
}));
server.listen(8080);