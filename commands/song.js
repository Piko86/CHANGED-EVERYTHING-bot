const yts = require('yt-search');
const axios = 'axios';

// Store pending song requests with a timeout
let songReplyState = {};

// Clean up old requests every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const chatId in songReplyState) {
        // Remove requests older than 5 minutes
        if (now - songReplyState[chatId].timestamp > 300000) {
            delete songReplyState[chatId];
        }
    }
}, 300000);


async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) return; // Ignore empty messages
        
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { text: "❌ What song do you want to download?\n👉 Example: .song despacito" });
        }

        // 1. SEARCH FOR THE SONG
        // This is a common point of failure.
        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            return await sock.sendMessage(chatId, { text: `❌ No songs found for "${searchQuery}"!` });
        }

        const video = videos[0]; // Get the first result
        const urlYt = video.url;

        // Ensure thumbnail exists before trying to send it
        if (!video.thumbnail) {
            console.error("Video found, but thumbnail is missing:", video);
            return await sock.sendMessage(chatId, { text: "❌ Found the song, but couldn't get its preview image. Please try another song." });
        }

        // 2. SEND PREVIEW MESSAGE
        const previewMsg = await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🍄 *KsmD SonG DownloadeR* 🍄

🎵 *TITLE:* ${video.title}
⏱ *DURATION:* ${video.timestamp}
👀 *VIEWS:* ${video.views.toLocaleString()}
📅 *RELEASED:* ${video.ago}
👤 *AUTHOR:* ${video.author.name}
🔗 *URL:* ${urlYt}

🛑 *Reply With Your Choice:*
*1.1* 🎵 AUDIO (sends as a voice note)
*1.2* 📂 DOCUMENT (sends as a file)

⚡ Powered by KnightBot`
        }, { quoted: message });

        // Save state for reply handling
        songReplyState[chatId] = {
            video,
            messageId: previewMsg.key.id,
            timestamp: Date.now() // For cleanup
        };

    } catch (error) {
        // **IMPROVED ERROR LOGGING**
        // This will now tell you exactly what failed.
        console.error("❌ Song Command Error:", error.message || error);
        await sock.sendMessage(chatId, { text: "❌ An unexpected error occurred while searching for the song. The service might be down." });
    }
}


// Reply handler
async function handleSongReply(sock, chatId, message, userMessage) {
    const state = songReplyState[chatId];
    // Check if there is a pending request and if the new message is a reply to our preview
    if (!state || message.message?.extendedTextMessage?.contextInfo?.stanzaId !== state.messageId) {
        return false;
    }

    try {
        if (userMessage === "1.1" || userMessage === "1.2") {
            await sock.sendMessage(chatId, { text: "⏳ Processing your request... Please wait." }, { quoted: message });

            const urlYt = state.video.url;
            
            // **API CALL WITH ERROR HANDLING**
            // This is another common point of failure.
            let data;
            try {
                const res = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
                data = res.data;
            } catch (apiError) {
                console.error("API download error:", apiError.message);
                await sock.sendMessage(chatId, { text: "❌ The download service failed. It might be temporarily offline. Please try again later." });
                delete songReplyState[chatId]; // Clean up state
                return true; // Handled the reply
            }


            if (!data?.status || !data?.result?.downloadUrl) {
                return await sock.sendMessage(chatId, { text: "❌ Failed to get a download link from the service. Try again later." });
            }

            const audioUrl = data.result.downloadUrl;
            const title = state.video.title.replace(/[<>:"/\\|?*]+/g, ''); // Sanitize filename


            if (userMessage === "1.1") {
                // Send as playable audio
                await sock.sendMessage(chatId, {
                    audio: { url: audioUrl },
                    mimetype: "audio/mpeg",
                }, { quoted: message });
            } else {
                // Send as a document/file
                await sock.sendMessage(chatId, {
                    document: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`
                }, { quoted: message });
            }

            delete songReplyState[chatId]; // Clear state after successful download
            return true; // Indicate that the reply was handled
        }
        return false; // Not the reply we were looking for
    } catch (err) {
        console.error("handleSongReply error:", err);
        // Clean up the state on error
        if (songReplyState[chatId]) {
            delete songReplyState[chatId];
        }
        await sock.sendMessage(chatId, { text: "❌ Something went wrong while sending the file." });
        return true; // We tried to handle it
    }
}

module.exports = { songCommand, handleSongReply };
