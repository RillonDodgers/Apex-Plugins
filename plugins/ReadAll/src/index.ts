import { findByStoreName, findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { registerCommand } from "@vendetta/commands";

let GuildStore: any;
let GuildChannelStore: any;
let ActiveJoinedThreadsStore: any;
let ReadStateStore: any;
let FluxDispatcher: any;
let ChannelStore: any;

let readCommandUnregister: (() => void) | null = null;
let readAllCommandUnregister: (() => void) | null = null;
let readServerCommandUnregister: (() => void) | null = null;
let readDMCommandUnregister: (() => void) | null = null;
let lastUsed = 0;
const COOLDOWN_MS = 60000;

const findModule = (patterns: string[], storeName?: string) => {
  if (storeName) {
    try {
      const store = findByStoreName(storeName);
      if (store) return store;
    } catch (e) {}
  }

  for (const pattern of patterns) {
    try {
      const module = findByProps(pattern);
      if (module) return module;
    } catch (e) {
      continue;
    }
  }
  
  return null;
};

const initModules = () => {
  GuildStore = findByStoreName("GuildStore");
  GuildChannelStore = findByStoreName("GuildChannelStore") || findByStoreName("ChannelStore");
  ChannelStore = findByStoreName("ChannelStore");
  ReadStateStore = findByStoreName("ReadStateStore");
  ActiveJoinedThreadsStore = findByStoreName("ActiveJoinedThreadsStore") || findByProps("getActiveJoinedThreadsForGuild");
  FluxDispatcher = findByProps("dispatch", "subscribe") || findByStoreName("Dispatcher");
};

const getDMChannels = () => {
  const dmChannels: any[] = [];
  const channelStore = ChannelStore || GuildChannelStore;
  
  if (!channelStore) return dmChannels;

  if (channelStore.getPrivateChannels) {
    try {
      const privateChannels = channelStore.getPrivateChannels();
      if (privateChannels && typeof privateChannels === 'object') {
        Object.values(privateChannels).forEach((channel: any) => {
          if (channel && channel.id) dmChannels.push(channel);
        });
      }
    } catch (e) {}
  }

  if (dmChannels.length === 0 && channelStore.getSortedPrivateChannels) {
    try {
      const sortedPrivateChannels = channelStore.getSortedPrivateChannels();
      if (Array.isArray(sortedPrivateChannels)) {
        sortedPrivateChannels.forEach((channel: any) => {
          if (channel && channel.id) dmChannels.push(channel);
        });
      }
    } catch (e) {}
  }

  if (dmChannels.length === 0 && channelStore.getChannels) {
    try {
      const meChannels = channelStore.getChannels("@me");
      if (meChannels && meChannels.SELECTABLE) {
        meChannels.SELECTABLE.forEach((c: any) => {
          const channel = c.channel || c;
          if (channel && channel.id) dmChannels.push(channel);
        });
      }
    } catch (e) {}
  }

  if (dmChannels.length === 0 && channelStore.getChannel && ReadStateStore?.getAllReadStates) {
    try {
      const allReadStates = ReadStateStore.getAllReadStates();
      Object.keys(allReadStates).forEach(channelId => {
        try {
          const channel = channelStore.getChannel(channelId);
          if (channel) {
            const isDM = channel.type === 1 || channel.type === 3 || (!channel.guild_id && !channel.guildId);
            if (isDM) dmChannels.push(channel);
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  return dmChannels;
};

const getServerChannels = () => {
  if (!GuildStore || !ReadStateStore) return [];

  const channels: Array<any> = [];
  const guilds = GuildStore.getGuilds();

  Object.values(guilds).forEach((guild: any) => {
    if (!guild?.id) return;

    try {
      let guildChannels = [];
      const channelStore = GuildChannelStore || ChannelStore;
      
      if (channelStore?.getChannels) {
        const channelData = channelStore.getChannels(guild.id);
        if (channelData?.SELECTABLE) guildChannels = guildChannels.concat(channelData.SELECTABLE);
        if (channelData?.VOCAL) guildChannels = guildChannels.concat(channelData.VOCAL);
      }

      if (ActiveJoinedThreadsStore?.getActiveJoinedThreadsForGuild) {
        try {
          const threads = ActiveJoinedThreadsStore.getActiveJoinedThreadsForGuild(guild.id);
          const threadChannels = Object.values(threads).flatMap((threadGroup: any) => Object.values(threadGroup || {}));
          guildChannels = guildChannels.concat(threadChannels);
        } catch (e) {}
      }

      guildChannels.forEach((c: any) => {
        const channel = c?.channel || c;
        if (!channel?.id) return;

        try {
          if (ReadStateStore.hasUnread && ReadStateStore.hasUnread(channel.id)) {
            channels.push({
              channelId: channel.id,
              messageId: ReadStateStore.lastMessageId?.(channel.id) || null,
              readStateType: 0
            });
          }
        } catch (e) {}
      });
    } catch (e) {}
  });

  return channels;
};

const getDMUnreadChannels = () => {
  const channels: Array<any> = [];
  const dmChannels = getDMChannels();
  
  dmChannels.forEach((channel: any) => {
    if (!channel?.id) return;
    
    try {
      let hasUnread = false;
      
      if (ReadStateStore.hasUnread) {
        hasUnread = ReadStateStore.hasUnread(channel.id);
      }
      
      if (!hasUnread && ReadStateStore.getAllReadStates) {
        const allReadStates = ReadStateStore.getAllReadStates();
        const readState = allReadStates[channel.id];
        if (readState) {
          hasUnread = (readState.mentionCount && readState.mentionCount > 0) ||
                     (readState._unreadCount && readState._unreadCount > 0) ||
                     (readState.unreadCount && readState.unreadCount > 0);
        }
      }
      
      if (hasUnread) {
        channels.push({
          channelId: channel.id,
          messageId: ReadStateStore.lastMessageId?.(channel.id) || null,
          readStateType: 0
        });
      }
    } catch (e) {}
  });

  return channels;
};

const bulkAckNotifications = (type: 'all' | 'server' | 'dm' = 'all') => {
  if (!GuildStore || !ReadStateStore || !FluxDispatcher) return false;

  let channels: Array<any> = [];
  let typeLabel = '';

  switch (type) {
    case 'server':
      channels = getServerChannels();
      typeLabel = 'server';
      break;
    case 'dm':
      channels = getDMUnreadChannels();
      typeLabel = 'DM';
      break;
    case 'all':
    default:
      channels = [...getServerChannels(), ...getDMUnreadChannels()];
      typeLabel = '';
      break;
  }

  if (channels.length === 0) {
    const message = type === 'all' 
      ? "No unread notifications found!" 
      : `No unread ${typeLabel} notifications found!`;
    showToast(message, getAssetIDByName("ic_message_edit"));
    return true;
  }

  FluxDispatcher.dispatch({
    type: "BULK_ACK",
    context: "APP",
    channels: channels
  });

  const message = type === 'all'
    ? `Cleared ${channels.length} unread notifications!`
    : `Cleared ${channels.length} unread ${typeLabel} notifications!`;
  
  showToast(message, getAssetIDByName("ic_message_edit"));
  return true;
};

const readMainNotifications = () => {
  const now = Date.now();
  const timeSinceLastUse = now - lastUsed;
  
  if (timeSinceLastUse < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastUse) / 1000);
    showToast(`Please wait ${remainingSeconds}s before using again`, getAssetIDByName("ic_close_16px"));
    return;
  }
  
  lastUsed = now;
  bulkAckNotifications('all');
};

const readAllNotifications = () => {
  const now = Date.now();
  const timeSinceLastUse = now - lastUsed;
  
  if (timeSinceLastUse < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastUse) / 1000);
    showToast(`Please wait ${remainingSeconds}s before using again`, getAssetIDByName("ic_close_16px"));
    return;
  }
  
  lastUsed = now;
  bulkAckNotifications('server');
};

const readServerNotifications = () => {
  const now = Date.now();
  const timeSinceLastUse = now - lastUsed;
  
  if (timeSinceLastUse < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastUse) / 1000);
    showToast(`Please wait ${remainingSeconds}s before using again`, getAssetIDByName("ic_close_16px"));
    return;
  }
  
  lastUsed = now;
  bulkAckNotifications('server');
};

const readDMNotifications = () => {
  const now = Date.now();
  const timeSinceLastUse = now - lastUsed;
  
  if (timeSinceLastUse < COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastUse) / 1000);
    showToast(`Please wait ${remainingSeconds}s before using again`, getAssetIDByName("ic_close_16px"));
    return;
  }
  
  lastUsed = now;
  bulkAckNotifications('dm');
};

export default {
  onLoad: () => {
    initModules();
    
    try {
      readCommandUnregister = registerCommand({
        name: "read",
        description: "Clear all unread notifications",
        applicationId: "-1",
        execute: () => {
          readMainNotifications();
          return;
        }
      });

      readServerCommandUnregister = registerCommand({
        name: "read server",
        description: "Clear server unread notifications only",
        applicationId: "-1",
        execute: () => {
          readServerNotifications();
          return;
        }
      });

      readDMCommandUnregister = registerCommand({
        name: "read dm",
        description: "Clear DM unread notifications only", 
        applicationId: "-1",
        execute: () => {
          readDMNotifications();
          return;
        }
      });
    } catch (e) {}
  },

  onUnload: () => {
    if (readCommandUnregister) {
      try {
        readCommandUnregister();
        readCommandUnregister = null;
      } catch (e) {}
    }
    if (readAllCommandUnregister) {
      try {
        readAllCommandUnregister();
        readAllCommandUnregister = null;
      } catch (e) {}
    }
    if (readServerCommandUnregister) {
      try {
        readServerCommandUnregister();
        readServerCommandUnregister = null;
      } catch (e) {}
    }
    if (readDMCommandUnregister) {
      try {
        readDMCommandUnregister();
        readDMCommandUnregister = null;
      } catch (e) {}
    }
  }
};
