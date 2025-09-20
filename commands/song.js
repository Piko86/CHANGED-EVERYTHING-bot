const yts = require('yt-search');
const axios = require('axios');

// Store pending song requests per chat
let songReplyState = {};

// Main command: .song <query>
async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, {
                text: "❌ What song do you want to download?\n👉 Example: .song despacito"
            }, { quoted: message });
        }

        // Search YouTube
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { text: "❌ No songs found!" }, { quoted: message });
        }

        const video = videos[0];
        const urlYt = video.url;

        // Send preview with options
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

        // Save state for reply handler
        songReplyState[chatId] = {
            video,
            messageId: previewMsg.key.id,
            timestamp: Date.now()
        };

    } catch (error) {
        console.error("Song command error:", error);
        await sock.sendMessage(chatId, { text: "❌ Error fetching song. Please try again later." }, { quoted: message });
    }
}

// Reply handler (1.1 = audio, 1.2 = document)
async function handleSongReply(sock, chatId, message, userMessage) {
    try {
        const state = songReplyState[chatId];
        if (!state) return false;

        // Check if reply is to the preview message
        const quoted = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (quoted !== state.messageId) return false;

        if (userMessage === "1.1" || userMessage === "1.2") {
            await sock.sendMessage(chatId, { text: "⏳ Processing your request..." }, { quoted: message });

            const urlYt = state.video.url;

            // Izumi API with User-Agent
            const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(urlYt)}&format=mp3`;

            const res = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const data = res.data;
            console.log("Izumi API response:", data); // 🔍 debug log

            // Flexible parsing (accept multiple formats)
            const audioUrl =
                data?.result?.downloadUrl ||
                data?.result?.link ||
                data?.url;

            const title =
                data?.result?.title ||
                data?.title ||
                state.video.title;

            if (!audioUrl) {
                return await sock.sendMessage(chatId, { text: "❌ Failed to fetch audio (invalid API response)." }, { quoted: message });
            }

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

            // Clear state
            delete songReplyState[chatId];
            return true;
        }

        return false;
    } catch (err) {
        console.error("handleSongReply error:", err);
        return false;
    }
}

module.exports = { songCommand, handleSongReply };
