const yts = require('yt-search');
const axios = require('axios');

let songReplyState = {}; // store pending song requests

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: "❌ What song do you want to download?\n👉 Example: .song despacito" });
        }

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { text: "❌ No songs found!" });
        }

        const video = videos[0]; // first result
        const urlYt = video.url;

        // Send preview with choices
        const previewMsg = await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🍄 *KsmD SonG DownloadeR* 🍄

🎵 *TITLE:* ${video.title}
⏱ *DURATION:* ${video.timestamp}
👀 *VIEWS:* ${video.views}
📅 *RELEASED:* ${video.ago}
👤 *AUTHOR:* ${video.author.name}
🔗 *URL:* ${urlYt}

🛑 *Reply With Your Choice:*
*1.1* 🎵 AUDIO TYPE
*1.2* 📂 DOCUMENT TYPE

⚡ Powered by KnightBot`
        }, { quoted: message });

        // Save state for reply handling
        songReplyState[chatId] = {
            video,
            messageId: previewMsg.key.id,
            timestamp: Date.now()
        };

    } catch (error) {
        console.error("Song command error:", error);
        await sock.sendMessage(chatId, { text: "❌ Error fetching song. Please try again later." });
    }
}

// Reply handler
async function handleSongReply(sock, chatId, message, userMessage) {
    try {
        const state = songReplyState[chatId];
        if (!state) return false;

        const quoted = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (quoted !== state.messageId) return false; // not replying to song preview

        if (userMessage === "1.1" || userMessage === "1.2") {
            await sock.sendMessage(chatId, { text: "⏳ Processing your request..." }, { quoted: message });

            const urlYt = state.video.url;
            const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
            const data = res.data;

            if (!data?.status || !data?.result?.downloadUrl) {
                return await sock.sendMessage(chatId, { text: "❌ Failed to fetch audio. Try again later." });
            }

            const audioUrl = data.result.downloadUrl;
            const title = data.result.title;

            if (userMessage === "1.1") {
                // Send as audio
                await sock.sendMessage(chatId, {
                    audio: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`
                }, { quoted: message });
            } else {
                // Send as document
                await sock.sendMessage(chatId, {
                    document: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`
                }, { quoted: message });
            }

            delete songReplyState[chatId]; // clear state after use
            return true;
        }
        return false;
    } catch (err) {
        console.error("handleSongReply error:", err);
        return false;
    }
}

module.exports = { songCommand, handleSongReply };
