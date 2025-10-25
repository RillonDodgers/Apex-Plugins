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

let ChannelStore: any;
let MessageStore: any;
let patches: any[] = [];

const initModules = () => {
  ChannelStore = findByStoreName("ChannelStore");
  MessageStore = findByStoreName("MessageStore");
};

const uploadToImmich = async (imageUrl: string, filename: string): Promise<boolean> => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured! Please set API key and server URL in settings.", getAssetIDByName("ic_close_16px"));
    return false;
  }

  try {
    // First, download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const blob = await response.blob();
    const formData = new FormData();
    
    // Use the official Immich API format
    formData.append('assetData', blob, filename);
    formData.append('deviceAssetId', `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    formData.append('deviceId', 'vendetta-discord');
    formData.append('fileCreatedAt', new Date().toISOString());
    formData.append('fileModifiedAt', new Date().toISOString());
    
    // Upload to Immich using the official endpoint
    const uploadResponse = await fetch(`${serverUrl}/api/asset/upload`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Immich upload error:', error);
    showToast(`Upload failed: ${error.message}`, getAssetIDByName("ic_close_16px"));
    return false;
  }
};


const saveImagesFromMessage = async (message: any): Promise<void> => {
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

  for (const attachment of imageAttachments) {
    const success = await uploadToImmich(attachment.url, attachment.filename);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  if (successCount > 0) {
    showToast(`Successfully saved ${successCount} image(s) to Immich!`, getAssetIDByName("ic_check"));
  }
  if (failCount > 0) {
    showToast(`Failed to save ${failCount} image(s)`, getAssetIDByName("ic_close_16px"));
  }
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
    
    // Add context menu patch for message long press
    const contextMenuUnpatch = before("render", findByProps("ScrollView").View, (args) => {
      try {
        // Find the message context menu
        let messageMenu = findInReactTree(args, (r) => r.key === ".$MessageOverflow");
        if (!messageMenu || !messageMenu.props || messageMenu.props.sheetKey !== "MessageOverflow") return;
        
        const props = messageMenu.props.content.props;
        if (!props.options || props.options.some((option: any) => option?.label === "Save to Immich")) return;
        
        // Get the message from the context
        const message = messageMenu.props.message;
        if (!message || !message.attachments || message.attachments.length === 0) return;
        
        // Check if message has image attachments
        const hasImages = message.attachments.some((att: any) => 
          att.content_type?.startsWith('image/') || 
          /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.filename)
        );
        
        if (!hasImages) return;
        
        // Add the "Save to Immich" option
        props.options.unshift({
          label: "Save to Immich",
          onPress: () => {
            try {
              saveImagesFromMessage(message);
              props.hideActionSheet();
            } catch (e) {
              console.error("Error saving to Immich:", e);
              showToast("Failed to save images to Immich", getAssetIDByName("ic_close_16px"));
            }
          },
        });
      } catch (e) {
        console.error("Context menu patch error:", e);
      }
    });
    
    patches.push(contextMenuUnpatch);
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
