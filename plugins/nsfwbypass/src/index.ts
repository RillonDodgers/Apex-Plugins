import { findByStoreName, findByProps } from "@vendetta/metro";
import { after, instead } from "@vendetta/patcher";

const NSFWStuff = findByProps("isNSFWInvite");
const UserStore = findByStoreName("UserStore");

let patches = [];

export default {
    onLoad: () => {
        patches.push(instead("handleNSFWGuildInvite", NSFWStuff, () => false));
        patches.push(instead("isNSFWInvite", NSFWStuff, () => false));
        patches.push(instead("shouldNSFWGateGuild", NSFWStuff, () => false));
        
        // User store patch to modify nsfwAllowed property
        patches.push(after("getCurrentUser", UserStore, (_, user) => {
            if (user?.hasOwnProperty("nsfwAllowed")) {
                user.nsfwAllowed = true;
            }
            if (user?.hasOwnProperty("ageVerificationStatus")) {
                user.ageVerificationStatus = 3; // VERIFIED_ADULT
            }
            return user;
        }));
    },
    
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        }
        patches = [];
    }
};
