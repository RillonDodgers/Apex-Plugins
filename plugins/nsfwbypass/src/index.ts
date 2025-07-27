import { findByStoreName, findByProps, findByName } from "@vendetta/metro";
import { after, instead } from "@vendetta/patcher";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { Settings } from "./Settings";

const { Text } = findByProps("Button", "Text", "View");

const NSFWStuff = findByProps("isNSFWInvite");
const UserStore = findByStoreName("UserStore");
const { getChannel } = findByProps("getChannel") || findByName("getChannel", false);

let patches = [];

// Helper function to check if a channel is NSFW
function isNSFWChannel(channelId) {
    if (typeof channelId === "string") {
        const channel = getChannel(channelId);
        return channel?.nsfw === true;
    }
    return channelId?.nsfw === true;
}

// Warning content component
function NSFWWarningContent() {
    return React.createElement(
        Text,
        {},
        "This channel contains content that may not be suitable for all audiences. Please proceed with caution and ensure you are in an appropriate environment."
    );
}

export default {
    onLoad: () => {
        // Initialize default settings
        storage.ageBypass ??= false; // Default to false for password-protected feature
        storage.nsfwBypass ??= true;
        storage.showWarningPopup ??= true;

        // NSFW bypass patches - only if enabled
        if (storage.nsfwBypass) {
            patches.push(instead("handleNSFWGuildInvite", NSFWStuff, () => false));
            patches.push(instead("isNSFWInvite", NSFWStuff, () => false));
            patches.push(instead("shouldNSFWGateGuild", NSFWStuff, () => false));
        }
        
        // Age verification bypass - only if enabled
        if (storage.ageBypass) {
            patches.push(after("getCurrentUser", UserStore, (_, user) => {
                if (user?.hasOwnProperty("nsfwAllowed")) {
                    user.nsfwAllowed = true;
                }
                if (user?.hasOwnProperty("ageVerificationStatus")) {
                    user.ageVerificationStatus = 3; // VERIFIED_ADULT
                }
                return user;
            }));
        }

        // NSFW channel warning - only if enabled
        if (storage.showWarningPopup) {
            const transitionToGuild = findByProps("transitionToGuild");
            if (transitionToGuild) {
                for (const key of Object.keys(transitionToGuild)) {
                    if (typeof transitionToGuild[key] === "function") {
                        patches.push(
                            instead(key, transitionToGuild, (args, orig) => {
                                if (typeof args[0] === "string") {
                                    const pathMatch = args[0].match(/(\d+)$/);
                                    if (pathMatch?.[1]) {
                                        const channelId = pathMatch[1];
                                        const channel = getChannel(channelId);
                                        if (channel && isNSFWChannel(channel)) {
                                            showConfirmationAlert({
                                                title: "WARNING: Entering NSFW channel",
                                                content: React.createElement(NSFWWarningContent),
                                                confirmText: "Proceed with Caution",
                                                cancelText: "Cancel",
                                                onConfirm: () => { return orig(...args); },
                                            });
                                            return {};
                                        }
                                    }
                                }
                                return orig(...args);
                            })
                        );
                    }
                }
            }
        }
    },
    
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        }
        patches = [];
    },

    settings: Settings
};
