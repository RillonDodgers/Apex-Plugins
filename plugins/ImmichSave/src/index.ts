import { findByStoreName, findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { 
  getApiKey,
  getServerUrl,
  updateApiKey,
  updateServerUrl,
  isConfigured
} from "./Settings";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { before } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
// import { showActionSheet } from "@vendetta/ui"; // This might not be available

let ChannelStore: any;
let MessageStore: any;
let patches: any[] = [];

const initModules = () => {
  ChannelStore = findByStoreName("ChannelStore");
  MessageStore = findByStoreName("MessageStore");
};

const uploadToImmich = (imageUrl: string, filename: string): Promise<boolean> => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured! Please set API key and server URL in settings.", getAssetIDByName("ic_close_16px"));
    return Promise.resolve(false);
  }

  return fetch(imageUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      const formData = new FormData();
      
      // Use the official Immich API format
      formData.append('assetData', blob, filename);
      formData.append('deviceAssetId', `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      formData.append('deviceId', 'vendetta-discord');
      formData.append('fileCreatedAt', new Date().toISOString());
      formData.append('fileModifiedAt', new Date().toISOString());
      
      // Upload to Immich using the official endpoint
      return fetch(`${serverUrl}/api/asset/upload`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
        },
        body: formData
      });
    })
    .then(uploadResponse => {
      if (!uploadResponse.ok) {
        return uploadResponse.text().then(errorText => {
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        });
      }
      return true;
    })
    .catch(error => {
      console.error('Immich upload error:', error);
      showToast(`Upload failed: ${error.message}`, getAssetIDByName("ic_close_16px"));
      return false;
    });
};


const saveImagesFromMessage = (message: any): void => {
  if (!isConfigured()) {
    showToast("Please configure Immich settings first!", getAssetIDByName("ic_close_16px"));
    return;
  }

  const attachments = message.attachments;
  if (!attachments || attachments.length === 0) {
    showToast("No images found in this message", getAssetIDByName("ic_close_16px"));
    return;
  }

  const imageAttachments = attachments.filter((att: any) => 
    att.content_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.filename)
  );

  if (imageAttachments.length === 0) {
    showToast("No image attachments found", getAssetIDByName("ic_close_16px"));
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let completedCount = 0;

  const processAttachment = (attachment: any) => {
    return uploadToImmich(attachment.url, attachment.filename)
      .then(success => {
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        completedCount++;
        
        // Check if all attachments have been processed
        if (completedCount === imageAttachments.length) {
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} image(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} image(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      })
      .catch(error => {
        failCount++;
        completedCount++;
        console.error("Error processing attachment:", error);
        
        if (completedCount === imageAttachments.length) {
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} image(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} image(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      });
  };

  // Process all attachments
  imageAttachments.forEach(attachment => {
    processAttachment(attachment);
  });
};


const SettingsComponent = () => {
  const [apiKey, setApiKey] = React.useState(getApiKey());
  const [serverUrl, setServerUrl] = React.useState(getServerUrl());

  const handleSaveApiKey = () => {
    updateApiKey(apiKey);
    showToast("API Key saved!", getAssetIDByName("ic_check"));
  };

  const handleSaveServerUrl = () => {
    updateServerUrl(serverUrl);
    showToast("Server URL saved!", getAssetIDByName("ic_check"));
  };

  return React.createElement(React.Fragment, null,
    React.createElement(Forms.FormSection, { title: "Immich Configuration" },
      React.createElement(Forms.FormText, { style: { marginBottom: 10 } }, 
        "Configure your Immich server connection:"
      ),
      React.createElement(Forms.FormInput, {
        placeholder: "Enter your Immich API Key",
        value: apiKey,
        onChange: setApiKey,
        secureTextEntry: true
      }),
      React.createElement(Forms.FormRow, {
        label: "Save API Key",
        onPress: handleSaveApiKey
      }),
      React.createElement(Forms.FormInput, {
        placeholder: "Enter Immich Server URL (e.g., https://immich.example.com)",
        value: serverUrl,
        onChange: setServerUrl
      }),
      React.createElement(Forms.FormRow, {
        label: "Save Server URL",
        onPress: handleSaveServerUrl
      })
    ),
    
    React.createElement(Forms.FormSection, { title: "Status" },
      React.createElement(Forms.FormText, { style: { marginBottom: 10 } }, 
        isConfigured() ? "✅ Immich is configured and ready to use!" : "❌ Please configure Immich settings above"
      )
    )
  );
};

export default {
  onLoad: () => {
    initModules();
    
    // Focus on ActionSheet patching for media links - much more reliable approach
    try {
      const ActionSheet = findByProps("ActionSheet")?.ActionSheet;
      if (ActionSheet) {
        console.log("Found ActionSheet component - patching for media links");
        const actionSheetUnpatch = before("render", ActionSheet, (args) => {
          try {
            const [props] = args;
            
            // Debug: Log all ActionSheet renders to understand the structure
            console.log("ActionSheet render:", {
              sheetKey: props.sheetKey,
              hasMessage: !!props.message,
              hasContent: !!props.content,
              hasOptions: !!props.options,
              optionsCount: props.options?.length || 0,
              allProps: Object.keys(props)
            });
            
            // Try to find message context menus - be more flexible with sheetKey matching
            const validSheetKeys = ["MessageOverflow", "MessageActions", "MessageContextMenu", "MessageMenu"];
            const isMessageContextMenu = validSheetKeys.includes(props.sheetKey) || 
                                       props.sheetKey?.includes("Message") || 
                                       props.sheetKey?.includes("Overflow");
            
            if (!isMessageContextMenu) {
              console.log(`Skipping ActionSheet with sheetKey: ${props.sheetKey}`);
              return;
            }
            
            console.log(`Processing ActionSheet with sheetKey: ${props.sheetKey}`);
            
            // Get the message from props or context - try multiple possible locations
            const message = props.message || props.content?.props?.message || props.data?.message;
            console.log("Message search:", {
              propsMessage: !!props.message,
              contentMessage: !!props.content?.props?.message,
              dataMessage: !!props.data?.message,
              foundMessage: !!message
            });
            
            if (!message || !message.attachments || message.attachments.length === 0) {
              console.log("No message or attachments found");
              return;
            }
            
            console.log("Message found with attachments:", message.attachments.length);
            
            // Check if message has image attachments
            const hasImages = message.attachments.some((att: any) => 
              att.content_type?.startsWith('image/') || 
              /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.filename)
            );
            
            if (!hasImages) {
              console.log("No image attachments found");
              return;
            }
            
            console.log("Found image attachments, adding Save to Immich option");
            
            // Add the "Save to Immich" option
            if (props.options && !props.options.some((option: any) => option?.label === "Save to Immich")) {
              props.options.unshift({
                label: "Save to Immich",
                icon: getAssetIDByName("ic_download"),
                onPress: () => {
                  try {
                    console.log("Save to Immich pressed!");
                    saveImagesFromMessage(message);
                    props.hideActionSheet?.();
                  } catch (e) {
                    console.error("Error saving to Immich:", e);
                    showToast("Failed to save images to Immich", getAssetIDByName("ic_close_16px"));
                  }
                },
              });
              console.log("Added Save to Immich option to ActionSheet");
            }
          } catch (e) {
            console.error("ActionSheet patch error:", e);
          }
        });
        patches.push(actionSheetUnpatch);
      } else {
        console.warn("Could not find ActionSheet component");
      }
    } catch (e) {
      console.error("Error setting up ActionSheet patch:", e);
    }
  },

  onUnload: () => {
    patches.forEach(unpatch => {
      try {
        unpatch();
      } catch (e) {
        console.error("Error unpatching:", e);
      }
    });
    patches = [];
  },

  settings: SettingsComponent
};
