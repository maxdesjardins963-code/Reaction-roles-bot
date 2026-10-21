require("dotenv").config();
const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

// ───────────── CONFIG ─────────────
// emoji -> nom du rôle (pas sensible à la casse)
const ROLES = [
  { emoji: "📢", role: "Announcement Ping", label: "Announcements" },
  { emoji: "📘", role: "Facebook ping", label: "Facebook" },
  { emoji: "📸", role: "Instagram Ping", label: "Instagram" },
  { emoji: "🎵", role: "Tiktok Ping", label: "TikTok" },
  { emoji: "🎬", role: "Youtube Ping", label: "YouTube" },
  { emoji: "❓", role: "Question of the day Ping", label: "Question of the day" },
];
const FOOTER = "reaction-roles-v1"; // sert à reconnaître le message (pas besoin de base de données)
// ──────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

const findRole = (guild, name) =>
  guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());

// ───── Commande /setup ─────
const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Post the message to pick your pings")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .toJSON();

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) {
    await guild.roles.fetch();
    await guild.commands.set([setupCommand]).catch(console.error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "setup") return;

  const guild = interaction.guild;
  await guild.roles.fetch();

  const missing = ROLES.filter((r) => !findRole(guild, r.role)).map((r) => r.role);
  if (missing.length) {
    return interaction.reply({
      content: `Oops, I can't find these roles: **${missing.join(", ")}**. Check the spelling then run /setup again 🙏`,
      ephemeral: true,
    });
  }

  const description =
    "Hey! 👋 Pick the notifications you want by reacting below.\n" +
    "You can change your mind anytime: remove your reaction and the role goes away.\n\n" +
    ROLES.map((r) => `${r.emoji}  →  **${r.label}**`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🔔 Your pings, your choice")
    .setDescription(description)
    .setColor(0x4f9d9d)
    .setFooter({ text: FOOTER });

  await interaction.reply({ content: "Posting it right now! ✨", ephemeral: true });
  const msg = await interaction.channel.send({ embeds: [embed] });
  for (const r of ROLES) await msg.react(r.emoji);
});

// ───── Gestion des réactions ─────
async function handleReaction(reaction, user, add) {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
  } catch {
    return;
  }

  const msg = reaction.message;
  if (msg.author?.id !== client.user.id) return;
  if (msg.embeds[0]?.footer?.text !== FOOTER) return;

  const entry = ROLES.find((r) => r.emoji === reaction.emoji.name);
  if (!entry) {
    if (add) await reaction.users.remove(user.id).catch(() => {});
    return;
  }

  const guild = msg.guild;
  const role = findRole(guild, entry.role);
  if (!role) return;

  try {
    const member = await guild.members.fetch(user.id);
    if (add) await member.roles.add(role);
    else await member.roles.remove(role);
  } catch (err) {
    console.error("Role error :", err.message);
  }
}

client.on("messageReactionAdd", (r, u) => handleReaction(r, u, true));
client.on("messageReactionRemove", (r, u) => handleReaction(r, u, false));

// ───── Mini serveur web (Render Web Service) ─────
http
  .createServer((_, res) => res.end("Bot is online 🚀"))
  .listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);
