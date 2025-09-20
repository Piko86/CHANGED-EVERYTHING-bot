// commands/song.js
const axios = require('axios');
const yts = require('yt-search');

let songReplyState = {}; // store state for reply handling

// 🔹 Stage 1: User runs `.song <name or link>`
async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            video = { url: text };
        } else {
            const search = await yts(text);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        const senderId = message.key.participant || message.key.remoteJid;

        // Save state for reply
        songReplyState[senderId] = {
            url: video.url,
            title: video.title,
            thumbnail: video.thumbnail
        };

        console.log("✅ Saved song state for:", senderId, songReplyState[senderId]);

        // Send info card with options
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🍄 *KsmD SonG DownloadeR* 🍄\n\n` +
                     `🎵 *TITLE:* ${video.title}\n` +
                     `⏱ *DURATION:* ${video.timestamp}\n` +
                     `👀 *VIEWS:* ${video.views}\n` +
                     `📅 *RELEASED:* ${video.ago}\n` +
                     `👤 *AUTHOR:* ${video.author?.name}\n` +
                     `🔗 *URL:* ${video.url}\n\n` +
                     `▫️ Reply With YoUr ChoiCe:\n` +
                     `1.1 AUDIO TYPE 🎵\n` +
                     `1.2 DOCUMENT TYPE 📂\n\n` +
                     `⚡ Powered by KnightBot`
        }, { quoted: message });

    } catch (err) {
        console.error('❌ Song command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch song.' }, { quoted: message });
    }
}

// 🔹 Stage 2: User replies (1.1 or 1.2)
async function handleSongReply(sock, chatId, message, userMessage, senderId) {
    try {
        console.log("👉 Song reply handler triggered:", { senderId, userMessage });

        const state = songReplyState[senderId];
        if (!state) {
            console.log("⚠️ No state found for sender:", senderId);
            return false; // not a song reply
        }

        // User selected AUDIO
        if (userMessage === '1.1') {
            console.log("🎵 User chose AUDIO for:", state.url);
            const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(state.url)}&format=mp3`;

            console.log("📡 Fetching from API:", apiUrl);
            const res = await axios.get(apiUrl, { timeout: 30000 });

            if (!res.data?.result?.download) {
                console.log("⚠️ API response invalid:", res.data);
                throw new Error('API failed (no download link)');
            }

            console.log("✅ API returned download link:", res.data.result.download);

            await sock.sendMessage(chatId, {
                audio: { url: res.data.result.download },
                mimetype: 'audio/mpeg',
                fileName: `${state.title}.mp3`
            }, { quoted: message });

            delete songReplyState[senderId];
            return true;
        }

        // User selected DOCUMENT
        if (userMessage === '1.2') {
            console.log("📂 User chose DOCUMENT for:", state.url);
            const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(state.url)}&format=mp3`;

            console.log("📡 Fetching from API:", apiUrl);
            const res = await axios.get(apiUrl, { timeout: 30000 });

            if (!res.data?.result?.download) {
                console.log("⚠️ API response invalid:", res.data);
                throw new Error('API failed (no download link)');
            }

            console.log("✅ API returned download link:", res.data.result.download);

            await sock.sendMessage(chatId, {
                document: { url: res.data.result.download },
                mimetype: 'audio/mpeg',
                fileName: `${state.title}.mp3`
            }, { quoted: message });

            delete songReplyState[senderId];
            return true;
        }

        console.log("⚠️ Invalid reply received:", userMessage);
        return false;

    } catch (e) {
        console.error("❌ Song reply error:", e);
        await sock.sendMessage(chatId, { text: '❌ Error processing your choice.' }, { quoted: message });
        return true;
    }
}

module.exports = { songCommand, handleSongReply };
