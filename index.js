const Discord = require("discord.js");
const http = require("http");
const schedule = require('node-schedule');
const Airtable = require('airtable')

const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const db = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base('appFwOylDMCbtHYSw');

const init = async () => {
    const guilds = await client.guilds.fetch()
    guilds.map(async (resolvable, key, collection) => {
        await updateGuild(key)
    })
}

const shallowEqual = async (object1, object2) => {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
      return false;
    }
    return await Promise.all(keys1.map((key) => {
      if (object1[key] !== object2[key]) {
        return false;
      }
      return true
    }))
}

const fetchItemById = (dbname, key, query) => {
    return new Promise((resolve, reject) => {
        db(dbname).select({ filterByFormula: `${key} = ${query}` }).firstPage((err, records) => {
            if (err) {
                reject(err)
            } else {
                if (records.length == 1) {
                    const id = records[0].id,
                        object = records[0].fields;

                    return resolve([id, object])
                } 
                if (records.length == 0) {
                    return reject(`${key} not found in ${dbname}`)
                }
            }
        })
    })
}

const putItemById = (dbname, key, object) => {
    return new Promise((resolve, reject) => {
        db(dbname).update([{ id: key, fields: object }], (err, records) => {
            if (err) reject(err)
            else resolve(records)
        })
    })
}

const createItem = async (dbname, object) => {
    try {
        return await db(dbname).create([{ fields: object }])
    } catch (err) {
        console.log(err)
    }
}

const updateGuild = async (key) => {
    const [id, object] = await fetchItemById('Guilds', 'Id', key)
    const original = Object.assign({}, object);

    const guild = client.guilds.cache.get(key)

    object.Members = guild.memberCount
    
    if(!(await shallowEqual(object, original))) {
        console.log(`Guild needs updating`)
        await putItemById('Guilds', id, object)
    }

    await updateEvents(guild)
}

const updateEvents = async guild => {
    const events = await guild.scheduledEvents.fetch()
    await events.map(async (event, key) => {
        console.log('Looking for:', key)
        try {
            const [id, object] = await fetchItemById('Events', 'Id', key)
            const original = Object.assign({}, object);
            console.log(`Found: ${id}`)

            if (object["Interested Members"] !== event.userCount) {
                object["Interested Members"] = event.userCount
            }

            if(!(await shallowEqual(object, original))) {
                console.log(`Event needs updating`)
                await putItemById('Events', id, object)
            }

            console.log('Completed:', key)

        } catch (error) {
            console.log(error)
            console.log('Cannot find, creating')
            const transformed = {
                Id: event.id,
                Name: event.name,
                Description: event.description,
                Start: event.scheduledStartTimestamp,
                End: event.scheduledEndTimestamp,
                "Interested Members": event.userCount
            }
            console.log(error)
            await createItem('Events', transformed)
        }
    })
}

const updateMembers = async guild => {
    
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await init();
});

client.on('interactionCreate', interaction => {
    console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered an interaction.`);
});

client.on('guildScheduledEventCreate', event => {
    console.log(event);
});

client.login(process.env.BOT_TOKEN);