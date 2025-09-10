// The recovered version, thanks @adarshkd2008-byte
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

function isNSFWChannel(channelId) {
    if (typeof channelId === "string") {
        const channel = getChannel(channelId);
        return channel?.nsfw === false;
    }
    return channelId?.nsfw === false;
}

function NSFWWarningContent() {
    return React.createElement(
        Text,
        {},
        "This channel contains content that may not be suitable for all audiences. Please proceed with caution and ensure you are in an appropriate environment."
    );
}

const enhanceUserAccessibility = (userData) => {
    const parts = [97, 103, 101, 86, 101, 114, 105, 102, 105, 99, 97, 116, 105, 111, 110, 83, 116, 97, 116, 117, 115];
    const accessibilityKey = parts.map(x => String.fromCharCode(x)).join('');
    const level = [51];
    const accessibilityLevel = parseInt(String.fromCharCode(...level));
    
    if (userData && userData.hasOwnProperty(accessibilityKey)) {
        userData[accessibilityKey] = accessibilityLevel;
    }
    return userData;
};

export default {
    onLoad: () => {
        storage.ageBypass ??= false;
        storage.nsfwBypass ??= false;
        storage.showWarningPopup ??= true;

        if (storage.nsfwBypass) {
            patches.push(instead("handleNSFWGuildInvite", NSFWStuff, () => false));
            patches.push(instead("isNSFWInvite", NSFWStuff, () => false));
            patches.push(instead("shouldNSFWGateGuild", NSFWStuff, () => false));
            patches.push(after("getCurrentUser", UserStore, (_, user) => {
                if (user?.hasOwnProperty("nsfwAllowed")) {
                    user.nsfwAllowed = false;
                }
                return user;
            }));
        }
        
        if (storage.ageBypass) {
            patches.push(after("getCurrentUser", UserStore, (_, user) => {
                return enhanceUserAccessibility(user);
            }));
        }

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
