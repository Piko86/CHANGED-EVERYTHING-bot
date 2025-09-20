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

        console.log(`🔍 Searching for: ${searchQuery}`);

        // Search for the song
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { text: "❌ No songs found!" });
        }

        const video = videos[0]; // first result
        const urlYt = video.url;

        console.log(`✅ Found: ${video.title} by ${video.author.name}`);

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

        console.log(`💾 Saved state for chat: ${chatId}`);

    } catch (error) {
        console.error("Song command error:", error);
        console.error("Error details:", error.message);
        await sock.sendMessage(chatId, { text: "❌ Error fetching song. Please try again later." });
    }
}

// Reply handler
async function handleSongReply(sock, chatId, message, userMessage) {
    try {
        const state = songReplyState[chatId];
        if (!state) {
            console.log(`❌ No state found for chat: ${chatId}`);
            return false;
        }

        const quoted = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (quoted !== state.messageId) {
            console.log(`❌ Message ID mismatch. Expected: ${state.messageId}, Got: ${quoted}`);
            return false; // not replying to song preview
        }

        if (userMessage === "1.1" || userMessage === "1.2") {
            console.log(`🎵 Processing ${userMessage === "1.1" ? "audio" : "document"} request for: ${state.video.title}`);
            
            await sock.sendMessage(chatId, { text: "⏳ Processing your request..." }, { quoted: message });

            const urlYt = state.video.url;
            
            try {
                console.log(`🌐 Fetching download URL for: ${urlYt}`);
                const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`, {
                    timeout: 30000 // 30 second timeout
                });
                
                const data = res.data;
                console.log("API Response:", data);

                if (!data?.status || !data?.result?.downloadUrl) {
                    console.error("Invalid API response:", data);
                    return await sock.sendMessage(chatId, { text: "❌ Failed to fetch audio. The download service might be temporarily unavailable." });
                }

                const audioUrl = data.result.downloadUrl;
                const title = data.result.title || state.video.title;

                console.log(`📥 Downloading: ${title}`);

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

                console.log(`✅ Successfully sent ${userMessage === "1.1" ? "audio" : "document"}: ${title}`);
                delete songReplyState[chatId]; // clear state after use
                return true;

            } catch (downloadError) {
                console.error("Download API error:", downloadError);
                await sock.sendMessage(chatId, { text: "❌ Failed to download audio. The service might be down or the video might be unavailable for download." });
                delete songReplyState[chatId]; // clear state even on error
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error("handleSongReply error:", err);
        console.error("Error details:", err.message);
        return false;
    }
}

// Clean up old states (call this periodically)
function cleanupOldStates() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    Object.keys(songReplyState).forEach(chatId => {
        if (now - songReplyState[chatId].timestamp > maxAge) {
            delete songReplyState[chatId];
            console.log(`🧹 Cleaned up old state for chat: ${chatId}`);
        }
    });
}

// Run cleanup every 5 minutes
setInterval(cleanupOldStates, 5 * 60 * 1000);

module.exports = { songCommand, handleSongReply, cleanupOldStates }; 
