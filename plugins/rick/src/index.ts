import { logger } from "@vendetta";
import { findByStoreName } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import Settings from "./Settings";

let unpatch;

// Audio URLs for rickroll (using public CDN links)
const RICKROLL_URLS = [
    "https://www.myinstants.com/media/sounds/rick-roll.mp3",
    "https://audio.jukehost.co.uk/tFkLhbRaHjQGx7UHwsQMEe3eTfQNK5H4", // Backup URL
];

// Play rickroll audio
const playRickroll = () => {
    try {
        // Try multiple URLs in case one fails
        const audio = new Audio();
        let urlIndex = 0;
        
        const tryNextUrl = () => {
            if (urlIndex >= RICKROLL_URLS.length) {
                logger.log("All rickroll URLs failed, playing local beep");
                // Fallback: create a simple beep sound
                const context = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = context.createOscillator();
                const gainNode = context.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(context.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, context.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1);
                
                oscillator.start(context.currentTime);
                oscillator.stop(context.currentTime + 1);
                return;
            }
            
            audio.src = RICKROLL_URLS[urlIndex];
            audio.volume = 0.7;
            audio.play().catch(() => {
                urlIndex++;
                tryNextUrl();
            });
        };
        
        audio.addEventListener('error', () => {
            urlIndex++;
            tryNextUrl();
        });
        
        tryNextUrl();
        
        logger.log("🎵 Never gonna give you up! 🎵");
    } catch (error) {
        logger.log("Failed to rickroll:", error);
    }
};

// Check if message contains rickroll command
const checkForRickroll = (message) => {
    const content = message.content?.toLowerCase() || "";
    return content.includes("/rick") || content.includes("/rickroll");
};

export default {
    onLoad: () => {
        logger.log("🎵 Rickroll Plugin Loaded! Type /rick to rickroll! 🎵");
        
        try {
            // Find the message store
            const MessageStore = findByStoreName("MessageStore");
            
            if (MessageStore) {
                // Patch message sending
                unpatch = before("sendMessage", MessageStore, (args) => {
                    const [channelId, message] = args;
                    
                    if (checkForRickroll(message)) {
                        // Play rickroll sound
                        setTimeout(() => {
                            playRickroll();
                        }, 100);
                        
                        // Replace the message content with rickroll text
                        message.content = "🎵 **RICKROLLED!** 🎵\n*Never gonna give you up, never gonna let you down!* 🕺💃";
                        
                        logger.log("Rickroll activated! 🎵");
                    }
                });
                
                logger.log("Successfully patched message sending for rickroll detection!");
            } else {
                logger.log("Could not find MessageStore - rickroll might not work properly");
            }
        } catch (error) {
            logger.log("Error setting up rickroll plugin:", error);
        }
    },
    
    onUnload: () => {
        logger.log("🎵 Rickroll Plugin Unloaded - No more rickrolls! 🎵");
        
        // Remove patches
        if (unpatch) {
            unpatch();
            unpatch = null;
        }
    },
    
    settings: Settings,
};
