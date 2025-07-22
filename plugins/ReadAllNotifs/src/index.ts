import { findByStoreName, findByProps, findByName } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { React } from "@vendetta/metro/common";
import { registerCommand } from "@vendetta/commands";
import { after, before } from "@vendetta/patcher";

let GuildStore: any;
let GuildChannelStore: any;
let ActiveJoinedThreadsStore: any;
let ReadStateStore: any;
let FluxDispatcher: any;
let GuildActions: any;
let ChannelStore: any;
let UserStore: any;

let patches: Array<() => void> = [];
let commandUnregister: (() => void) | null = null;

const findModule = (patterns: string[], storeName?: string) => {
  if (storeName) {
    try {
      const store = findByStoreName(storeName);
      if (store) return store;
    } catch (e) {
      console.log(`Store ${storeName} not found, trying props...`);
    }
  }

  for (const pattern of patterns) {
    try {
      const module = findByProps(pattern);
      if (module) {
        console.log(`Found module with ${pattern}:`, Object.keys(module).filter(k => 
          typeof module[k] === 'function' && k.toLowerCase().includes(pattern.toLowerCase())
        ));
        return module;
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
};

const initModules = () => {
  try {
    console.log("[DEVBUILD] ReadAllNotifications: Starting module search...");
    
    GuildStore = findByStoreName("GuildStore");
    GuildChannelStore = findByStoreName("GuildChannelStore") || findByStoreName("ChannelStore");
    ChannelStore = findByStoreName("ChannelStore"); // Try both
    ReadStateStore = findByStoreName("ReadStateStore");
    UserStore = findByStoreName("UserStore");
    
    ActiveJoinedThreadsStore = findByStoreName("ActiveJoinedThreadsStore") || 
                              findByProps("getActiveJoinedThreadsForGuild");
    
    FluxDispatcher = findByProps("dispatch", "subscribe") || findByStoreName("Dispatcher");
    
    GuildActions = findModule(["markGuildAsRead", "ackGuild", "markAsRead"]);

    if (GuildChannelStore) {
      console.log("GuildChannelStore methods:", Object.keys(GuildChannelStore));
    }
    if (ChannelStore) {
      console.log("ChannelStore methods:", Object.keys(ChannelStore));
    }

    const results = {
      GuildStore: !!GuildStore,
      GuildChannelStore: !!GuildChannelStore,
      ChannelStore: !!ChannelStore,
      ActiveJoinedThreadsStore: !!ActiveJoinedThreadsStore,
      ReadStateStore: !!ReadStateStore,
      FluxDispatcher: !!FluxDispatcher,
      GuildActions: !!GuildActions,
      UserStore: !!UserStore
    };
    
    console.log("Module search results:", results);
    return results;
    
  } catch (error) {
    console.error("ReadAllNotifications: Failed during module initialization", error);
    return {};
  }
};

const getDMChannels = () => {
  const dmChannels: any[] = [];
  console.log("Enhanced DM Channel Detection");

  try {
    const channelStore = ChannelStore || GuildChannelStore;
    
    if (channelStore) {
      console.log("Available channel store methods:", Object.keys(channelStore));
      
      if (channelStore.getPrivateChannels) {
        try {
          const privateChannels = channelStore.getPrivateChannels();
          console.log("getPrivateChannels result:", privateChannels);
          
          if (privateChannels && typeof privateChannels === 'object') {
            Object.values(privateChannels).forEach((channel: any) => {
              if (channel && channel.id) {
                console.log(`Found private channel: ${channel.id}, type: ${channel.type}`);
                dmChannels.push(channel);
              }
            });
          }
        } catch (e) {
          console.log("getPrivateChannels failed:", e);
        }
      }

      if (dmChannels.length === 0 && channelStore.getSortedPrivateChannels) {
        try {
          const sortedPrivateChannels = channelStore.getSortedPrivateChannels();
          console.log("getSortedPrivateChannels result:", sortedPrivateChannels);
          
          if (Array.isArray(sortedPrivateChannels)) {
            sortedPrivateChannels.forEach((channel: any) => {
              if (channel && channel.id) {
                console.log(`Found sorted private channel: ${channel.id}, type: ${channel.type}`);
                dmChannels.push(channel);
              }
            });
          }
        } catch (e) {
          console.log("getSortedPrivateChannels failed:", e);
        }
      }

      if (dmChannels.length === 0 && channelStore.getChannels) {
        try {
          const meChannels = channelStore.getChannels("@me");
          console.log("getChannels('@me') result:", meChannels);
          
          if (meChannels && meChannels.SELECTABLE) {
            meChannels.SELECTABLE.forEach((c: any) => {
              const channel = c.channel || c;
              if (channel && channel.id) {
                console.log(`Found @me channel: ${channel.id}, type: ${channel.type}`);
                dmChannels.push(channel);
              }
            });
          }
        } catch (e) {
          console.log("getChannels('@me') failed:", e);
        }
      }

      if (dmChannels.length === 0) {
        try {
          const allChannelMethods = Object.keys(channelStore).filter(key => 
            key.toLowerCase().includes('channel') && 
            typeof channelStore[key] === 'function' &&
            !key.includes('get')
          );
          
          console.log("Trying channel methods:", allChannelMethods);

          if (channelStore.getChannel && ReadStateStore?.getAllReadStates) {
            const allReadStates = ReadStateStore.getAllReadStates();
            console.log(`Checking ${Object.keys(allReadStates).length} channels from read states`);
            
            Object.keys(allReadStates).forEach(channelId => {
              try {
                const channel = channelStore.getChannel(channelId);
                if (channel) {
                  const isDM = channel.type === 1 || channel.type === 3 || 
                              (!channel.guild_id && !channel.guildId);
                  
                  if (isDM) {
                    console.log(`Found DM from read states: ${channel.id}, type: ${channel.type}`);
                    dmChannels.push(channel);
                  }
                }
              } catch (e) {
              }
            });
          }
        } catch (e) {
          console.log("All channels iteration failed:", e);
        }
      }
    }

    console.log(`DM Detection complete: Found ${dmChannels.length} DM channels`);
    return dmChannels;

  } catch (error) {
    console.error("Error in DM channel detection:", error);
    return [];
  }
};

const bulkAckNotifications = () => {
  try {
    if (!GuildStore || !ReadStateStore || !FluxDispatcher) {
      console.log("Required modules not available for bulk ack");
      return false;
    }

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
            const threadChannels = Object.values(threads)
              .flatMap((threadGroup: any) => Object.values(threadGroup || {}));
            guildChannels = guildChannels.concat(threadChannels);
          } catch (e) {
            console.log(`Could not get threads for guild ${guild.id}`);
          }
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
          } catch (e) {
            console.log(`Error checking unread state for channel ${channel.id}`);
          }
        });
      } catch (e) {
        console.log(`Error processing guild ${guild.id}:`, e);
      }
    });

    console.log("=== Processing DM Channels ===");
    const dmChannels = getDMChannels();
    let dmChannelsProcessed = 0;
    
    dmChannels.forEach((channel: any) => {
      if (!channel?.id) return;
      
      try {
        console.log(`Checking DM channel ${channel.id} for unread messages...`);
        
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
          console.log(`✓ DM channel ${channel.id} has unread messages`);
          channels.push({
            channelId: channel.id,
            messageId: ReadStateStore.lastMessageId?.(channel.id) || null,
            readStateType: 0
          });
          dmChannelsProcessed++;
        } else {
          console.log(`- DM channel ${channel.id} has no unread messages`);
        }
      } catch (e) {
        console.log(`Error processing DM channel ${channel.id}:`, e);
      }
    });
    
    console.log(`DM Processing complete: Found ${dmChannels.length} DMs, processed ${dmChannelsProcessed} unread DMs`);

    if (channels.length === 0) {
      showToast("No unread notifications found!", getAssetIDByName("ic_message_edit"));
      return true;
    }

    // Dispatch bulk acknowledgment
    console.log(`Dispatching BULK_ACK for ${channels.length} channels (${dmChannelsProcessed} DMs)`);
    
    FluxDispatcher.dispatch({
      type: "BULK_ACK",
      context: "APP",
      channels: channels
    });

    console.log(`Bulk acknowledged ${channels.length} channels (including ${dmChannelsProcessed} DMs)`);
    showToast(`Cleared ${channels.length} unread notifications (${dmChannelsProcessed} DMs)!`, getAssetIDByName("ic_message_edit"));
    return true;

  } catch (error) {
    console.error("Bulk ack failed:", error);
    return false;
  }
};

const guildActionsMethod = async () => {
  try {
    if (!GuildStore || !GuildActions) {
      return false;
    }

    const guilds = GuildStore.getGuilds();
    const guildIds = Object.keys(guilds);
    let successCount = 0;

    for (const guildId of guildIds) {
      try {
        if (GuildActions.markGuildAsRead) {
          await GuildActions.markGuildAsRead(guildId);
          successCount++;
        } else if (GuildActions.ackGuild) {
          await GuildActions.ackGuild(guildId);
          successCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (e) {
        console.log(`Failed to ack guild ${guildId}:`, e);
      }
    }

    if (successCount > 0) {
      showToast(`Cleared notifications from ${successCount}/${guildIds.length} servers!`, getAssetIDByName("ic_message_edit"));
      return true;
    }
    return false;
  } catch (error) {
    console.error("Guild actions method failed:", error);
    return false;
  }
};

const readAllNotifications = async () => {
  try {
    console.log("ReadAllNotifications: Starting notification clear...");

    const bulkSuccess = bulkAckNotifications();
    if (bulkSuccess) {
      return;
    }

    console.log("Bulk ack failed, trying guild actions method...");
    const guildSuccess = await guildActionsMethod();
    if (guildSuccess) {
      return;
    }

    console.log("All methods failed, showing error");
    showToast("Could not clear notifications - check console for details", getAssetIDByName("ic_close_16px"));

  } catch (error) {
    console.error("ReadAllNotifications: Error in readAllNotifications", error);
    showToast("Failed to clear notifications", getAssetIDByName("ic_close_16px"));
  }
};

      try {
        if (ReadStateStore.hasUnread) {
          const hasUnread = ReadStateStore.hasUnread(channel.id);
          console.log("hasUnread():", hasUnread);
        }
        
        if (ReadStateStore.getMentionCount) {
          const mentions = ReadStateStore.getMentionCount(channel.id);
          console.log("getMentionCount():", mentions);
        }
        
        if (ReadStateStore.getUnreadCount) {
          const unread = ReadStateStore.getUnreadCount(channel.id);
          console.log("getUnreadCount():", unread);
        }
        
        if (ReadStateStore.getAllReadStates) {
          const allStates = ReadStateStore.getAllReadStates();
          const readState = allStates[channel.id];
          if (readState) {
            console.log("ReadState object:", {
              mentionCount: readState.mentionCount,
              _unreadCount: readState._unreadCount,
              unreadCount: readState.unreadCount,
              lastMessageId: readState.lastMessageId,
              ackMessageId: readState.ackMessageId
            });
          } else {
            console.log("No read state found for this channel");
          }
        }
      } catch (e) {
        console.log("Error checking unread state:", e);
      }
    });
  }

  if (ReadStateStore?.getAllReadStates) {
    try {
      const allReadStates = ReadStateStore.getAllReadStates();
      const unreadChannels = Object.entries(allReadStates).filter(([channelId, readState]: [string, any]) => {
        return readState && (
          (readState.mentionCount && readState.mentionCount > 0) ||
          (readState._unreadCount && readState._unreadCount > 0) ||
          (readState.unreadCount && readState.unreadCount > 0)
        );
      });
      
      console.log(`\n=== All Unread Channels (${unreadChannels.length}) ===`);
      unreadChannels.forEach(([channelId, readState]: [string, any]) => {
        console.log(`Channel ${channelId}:`, {
          mentions: readState.mentionCount,
          unread: readState._unreadCount || readState.unreadCount,
          type: "Unknown - need to fetch channel info"
        });
      });
    } catch (e) {
      console.log("Error getting all read states:", e);
    }
  }
  
  console.log("\nAvailable functions: readAllNotifications(), debugReadAll()");
};

const registerGlobalFunctions = () => {
  try {
    (window as any).readAllNotifications = readAllNotifications;
    (window as any).debugReadAll = debugInfo;
    (window as any).getDMChannels = getDMChannels;
    
    console.log("ReadAllNotifications: Global functions registered");
    return true;
  } catch (error) {
    console.error("Failed to register global functions:", error);
    return false;
  }
};

export default {
  onLoad: () => {
    console.log("ReadAllNotifications: Plugin loading...");
    
    try {
      const modules = initModules();
      
      registerGlobalFunctions();
      
      try {
        commandUnregister = registerCommand({
          name: "readall",
          description: "Clear all unread notifications",
          applicationId: "-1",
          execute: (args, ctx) => {
            readAllNotifications();
            return;
          }
        });
        console.log("ReadAllNotifications: Command registered");
      } catch (e) {
        console.log("Failed to register command:", e);
      }

      if (modules.FluxDispatcher && modules.GuildStore && modules.ReadStateStore) {
        showToast("ReadAll Enhanced loaded! Use /readall or readAllNotifications()", getAssetIDByName("ic_message_edit"));
      } else if (modules.GuildStore) {
        showToast("ReadAll partially loaded - some features may not work", getAssetIDByName("ic_message_edit"));
      } else {
        showToast("ReadAll failed to load essential modules", getAssetIDByName("ic_close_16px"));
      }


    } catch (error) {
      console.error("ReadAllNotifications: Failed to load:", error);
      showToast("❌ ReadAll plugin failed to load", getAssetIDByName("ic_close_16px"));
    }
  },

  onUnload: () => {
    try {
      patches.forEach(unpatch => {
        try {
          unpatch();
        } catch (e) {
          console.log("Failed to remove patch:", e);
        }
      });
      patches = [];

      if (commandUnregister) {
        try {
          commandUnregister();
          commandUnregister = null;
        } catch (e) {
          console.log("Failed to unregister command:", e);
        }
      }

      delete (window as any).readAllNotifications;
      delete (window as any).debugReadAll;
      delete (window as any).getDMChannels;

      console.log("ReadAllNotifications: Plugin unloaded");
    } catch (error) {
      console.error("Error during plugin unload:", error);
    }
  }
};
