// commands/song.js
const axios = require('axios');
const yts = require('yt-search');

let songReplyState = {}; // store state for reply handling

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

        // Save state for reply
        const senderId = message.key.participant || message.key.remoteJid;
        songReplyState[senderId] = {
            url: video.url,
            title: video.title,
            thumbnail: video.thumbnail
        };

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
        console.error('Song command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch song.' }, { quoted: message });
    }
}

// Reply handler
async function handleSongReply(sock, chatId, message, userMessage, senderId) {
    try {
        const state = songReplyState[senderId];
        if (!state) return false; // no active song state

        if (userMessage === '1.1') {
            // Send as Audio
            const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(state.url)}&format=mp3`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            if (!res.data?.result?.download) throw new Error('API failed');

            await sock.sendMessage(chatId, {
                audio: { url: res.data.result.download },
                mimetype: 'audio/mpeg',
                fileName: `${state.title}.mp3`
            }, { quoted: message });

            delete songReplyState[senderId]; // clear state
            return true;
        }

        if (userMessage === '1.2') {
            // Send as Document
            const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(state.url)}&format=mp3`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            if (!res.data?.result?.download) throw new Error('API failed');

            await sock.sendMessage(chatId, {
                document: { url: res.data.result.download },
                mimetype: 'audio/mpeg',
                fileName: `${state.title}.mp3`
            }, { quoted: message });

            delete songReplyState[senderId]; // clear state
            return true;
        }

        return false;
    } catch (e) {
        console.error("Song reply error:", e);
        await sock.sendMessage(chatId, { text: '❌ Error processing your choice.' }, { quoted: message });
        return true;
    }
}

module.exports = { songCommand, handleSongReply };
