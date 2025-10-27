import { showToast } from "@vendetta/ui/toasts";
import { before } from '@vendetta/patcher';
import { getAssetIDByName } from '@vendetta/ui/assets';
import { findByProps } from "@vendetta/metro";
import { 
  getApiKey,
  getServerUrl,
  updateApiKey,
  updateServerUrl,
  isConfigured
} from "./Settings";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

// Media type detection utilities
const MediaDetection = {
  IMAGE_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  VIDEO_EXTENSIONS: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', 'flv', 'wmv'],
  
  isImageByContentType: (contentType: string): boolean => {
    return contentType?.startsWith('image/') || false;
  },
  
  isVideoByContentType: (contentType: string): boolean => {
    return contentType?.startsWith('video/') || false;
  },
  
  isImageByFilename: (filename: string): boolean => {
    if (!filename) return false;
    const ext = filename.toLowerCase().split('.').pop();
    return MediaDetection.IMAGE_EXTENSIONS.includes(ext || '');
  },
  
  isVideoByFilename: (filename: string): boolean => {
    if (!filename) return false;
    const ext = filename.toLowerCase().split('.').pop();
    return MediaDetection.VIDEO_EXTENSIONS.includes(ext || '');
  },
  
  isMediaAttachment: (attachment: any): boolean => {
    const isImage = MediaDetection.isImageByContentType(attachment.content_type) || 
                   MediaDetection.isImageByFilename(attachment.filename);
    const isVideo = MediaDetection.isVideoByContentType(attachment.content_type) || 
                   MediaDetection.isVideoByFilename(attachment.filename);
    return isImage || isVideo;
  },
  
  isMediaEmbed: (embed: any): boolean => {
    // Check if embed has image or video
    if (embed.image?.url || embed.video?.url || embed.thumbnail?.url) {
      return true;
    }
    
    // Check embed type
    if (embed.type === 'image' || embed.type === 'video' || embed.type === 'gifv') {
      return true;
    }
    
    return false;
  },
  
  extractMediaFromEmbed: (embed: any): Array<{url: string, filename: string}> => {
    const media: Array<{url: string, filename: string}> = [];
    
    // Extract image
    if (embed.image?.url) {
      const url = embed.image.url;
      const filename = MediaDetection.generateFilenameFromUrl(url, 'image');
      media.push({ url, filename });
    }
    
    // Extract video
    if (embed.video?.url) {
      const url = embed.video.url;
      const filename = MediaDetection.generateFilenameFromUrl(url, 'video');
      media.push({ url, filename });
    }
    
    // Extract thumbnail if no other media found
    if (media.length === 0 && embed.thumbnail?.url) {
      const url = embed.thumbnail.url;
      const filename = MediaDetection.generateFilenameFromUrl(url, 'thumbnail');
      media.push({ url, filename });
    }
    
    return media;
  },
  
  generateFilenameFromUrl: (url: string, type: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/');
      const lastSegment = segments[segments.length - 1];
      
      // If the last segment has an extension, use it
      if (lastSegment && lastSegment.includes('.')) {
        return lastSegment;
      }
      
      // Generate filename based on type and timestamp
      const timestamp = Date.now();
      const extensions = {
        image: 'jpg',
        video: 'mp4',
        thumbnail: 'jpg'
      };
      
      return `${type}_${timestamp}.${extensions[type as keyof typeof extensions] || 'jpg'}`;
    } catch (error) {
      // Fallback filename
      const timestamp = Date.now();
      return `${type}_${timestamp}.jpg`;
    }
  }
};

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const ActionSheet = findByProps("ActionSheet")?.ActionSheet;
const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow;
let unpatchActionSheet: any;

const testImmichConnection = (): void => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured!", getAssetIDByName("ic_close_16px"));
    return;
  }

  fetch(`${serverUrl}/api/albums`, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json'
    }
  })
  .then(response => {
    if (response.status === 200 || response.status === 401) {
      showToast("✅ Immich connection successful!", getAssetIDByName("ic_check"));
    } else {
      showToast(`❌ Connection failed: ${response.status}`, getAssetIDByName("ic_close_16px"));
    }
  })
  .catch(error => {
    showToast(`❌ Cannot reach server: ${error.message}`, getAssetIDByName("ic_close_16px"));
  });
};


const uploadToImmich = (fileUrl: string, filename: string): Promise<boolean> => {
  const apiKey = getApiKey();
  const serverUrl = getServerUrl();
  
  if (!apiKey || !serverUrl) {
    showToast("Immich not configured! Please set API key and server URL in settings.", getAssetIDByName("ic_close_16px"));
    return Promise.resolve(false);
  }

  // Create FormData with URI approach (React Native style)
  const formData = new FormData();
  
  // Determine MIME type from filename extension
  const getContentType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      case 'svg':
        return 'image/svg+xml';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'avi':
        return 'video/x-msvideo';
      case 'mkv':
        return 'video/x-matroska';
      case 'webm':
        return 'video/webm';
      default:
        return 'application/octet-stream';
    }
  };

  const contentType = getContentType(filename);
  
  // Use React Native FormData approach with uri/name/type
  formData.append('assetData', {
    uri: fileUrl,
    name: filename,
    type: contentType,
  } as any);

  // Create unique deviceAssetId using filename numbers + timestamp
  const numbersFromFilename = filename.match(/\d+/g)?.join('') || '';
  const uniqueId = `${numbersFromFilename}-${Date.now()}`;
  formData.append('deviceAssetId', uniqueId);
  formData.append('deviceId', 'discord-mobile-v2');

  // Use current time for both created/modified (we don't have original file stats)
  const now = new Date().toISOString();
  formData.append('fileCreatedAt', now);
  formData.append('fileModifiedAt', now);

  
  return fetch(`${serverUrl}/api/assets`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json'
    },
    body: formData
  })
    .then(uploadResponse => {
      if (!uploadResponse.ok) {
        return uploadResponse.text().then(errorText => {
          console.error('[ImmichSave] Upload error response:', errorText);
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        });
      }
      
      return uploadResponse.text().then(() => {
        return true;
      });
    })
    .catch(error => {
      console.error('[ImmichSave] Upload error:', error);
      console.error('[ImmichSave] Error message:', error.message);
      console.error('[ImmichSave] Error type:', error.constructor.name);
      console.error('[ImmichSave] Error stack:', error.stack);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Cannot connect to Immich server. Check your server URL and network connection.';
      } else if (error.message.includes('Upload failed: 401')) {
        errorMessage = 'Invalid API key. Please check your Immich API key in settings.';
      } else if (error.message.includes('Upload failed: 403')) {
        errorMessage = 'Access denied. Check your API key permissions.';
      } else if (error.message.includes('Upload failed: 404')) {
        errorMessage = 'Immich API endpoint not found. Check your server URL.';
      } else if (error.message.includes('Upload failed: 500')) {
        errorMessage = 'Immich server error. Check server logs.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      showToast(`Failed to save: ${errorMessage}`, getAssetIDByName("ic_close_16px"));
      return false;
    });
};

const saveMediaFromMessage = (message: any): void => {
  if (!isConfigured()) {
    showToast("Please configure Immich settings first!", getAssetIDByName("ic_close_16px"));
    return;
  }

  // Collect all media items from attachments and embeds
  const mediaItems: Array<{url: string, filename: string}> = [];

  // Process attachments
  if (message.attachments && message.attachments.length > 0) {
    const mediaAttachments = message.attachments.filter(MediaDetection.isMediaAttachment);
    mediaAttachments.forEach((att: any) => {
      mediaItems.push({
        url: att.url,
        filename: att.filename
      });
    });
  }

  // Process embeds
  if (message.embeds && message.embeds.length > 0) {
    message.embeds.forEach((embed: any) => {
      if (MediaDetection.isMediaEmbed(embed)) {
        const embedMedia = MediaDetection.extractMediaFromEmbed(embed);
        mediaItems.push(...embedMedia);
      }
    });
  }

  if (mediaItems.length === 0) {
    showToast("No media found in this message", getAssetIDByName("ic_close_16px"));
    return;
  }

  showToast(`Uploading ${mediaItems.length} file(s) to Immich...`, getAssetIDByName("ic_upload"));

  let successCount = 0;
  let failCount = 0;
  let completedCount = 0;

  const processMediaItem = (mediaItem: {url: string, filename: string}) => {
    return uploadToImmich(mediaItem.url, mediaItem.filename)
      .then(success => {
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        completedCount++;
        
        if (mediaItems.length > 1) {
          showToast(`Progress: ${completedCount}/${mediaItems.length} files processed`, getAssetIDByName("ic_check"));
        }
        
        if (completedCount === mediaItems.length) {
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} file(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} file(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      })
      .catch(error => {
        failCount++;
        completedCount++;
        
        if (completedCount === mediaItems.length) {
          if (successCount > 0) {
            showToast(`Successfully saved ${successCount} file(s) to Immich!`, getAssetIDByName("ic_check"));
          }
          if (failCount > 0) {
            showToast(`Failed to save ${failCount} file(s)`, getAssetIDByName("ic_close_16px"));
          }
        }
      });
  };

  mediaItems.forEach(mediaItem => {
    processMediaItem(mediaItem);
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
      React.createElement(Forms.FormText, { style: { marginBottom: 10, marginLeft: 10 } }, 
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
      }),
      React.createElement(Forms.FormRow, {
        label: "Test Connection",
        onPress: testImmichConnection
      })
    ),
    
    React.createElement(Forms.FormSection, { title: "Status" },
      React.createElement(Forms.FormText, { style: { marginBottom: 10, marginLeft: 10 } }, 
        isConfigured() ? "✅ Immich is configured and ready to use!" : "❌ Please configure Immich settings above"
      )
    )
  );
};

export default {
   onLoad: () => {
        
        if (ActionSheet) {
          unpatchActionSheet = before("render", ActionSheet, (args) => {
            try {
              const [props] = args;
              
              const message = props.header?.props?.message;
              
              if (!message) {
                return;
              }
              
              // Check for media in attachments
              const hasMediaAttachments = message.attachments?.some(MediaDetection.isMediaAttachment);
              
              // Check for media in embeds
              const hasMediaEmbeds = message.embeds?.some(MediaDetection.isMediaEmbed);

              if (!hasMediaAttachments && !hasMediaEmbeds) {
                return;
              }

              // Find the group that contains media-related actions like "Save Image"
              if (props.children && Array.isArray(props.children) && ActionSheetRow) {
                // Look for the group that contains "Save Image" or similar media actions
                let targetGroupIndex = -1;
                let targetGroup = null;
                
                for (let i = 0; i < props.children.length; i++) {
                  const group = props.children[i];
                  if (group?.props?.children && Array.isArray(group.props.children)) {
                    const hasMediaActions = group.props.children.some((child: any) => 
                      child?.props?.label === "Save Image" || 
                      child?.props?.label === "Save Video" ||
                      child?.props?.label === "Copy Media Link" ||
                      child?.props?.label === "Copy Message Link" ||
                      child?.props?.label === "Copy Message ID"
                    );
                    if (hasMediaActions) {
                      targetGroupIndex = i;
                      targetGroup = group;
                      break;
                    }
                  }
                }
                
                if (targetGroup && targetGroupIndex >= 0) {
                  const hasImmichOption = targetGroup.props.children.some((child: any) => 
                    child?.props?.label === "Save to Immich"
                  );
                  
                  if (!hasImmichOption) {
                    const saveToImmichRow = React.createElement(ActionSheetRow, {
                    key: "save-to-immich",
                    label: "Save to Immich",
                    icon: getAssetIDByName("ic_download"),
                    onPress: () => {
                      try {
                        // Close the ActionSheet first
                        if (LazyActionSheet?.hideActionSheet) {
                          LazyActionSheet.hideActionSheet();
                        }
                        
                        saveMediaFromMessage(message);
                      } catch (e) {
                        console.error("[ImmichSave] Error in Save to Immich handler:", e);
                        showToast(`Failed to save: ${e.message || 'Unknown error'}`, getAssetIDByName("ic_close_16px"));
                      }
                    }
                    });
                    targetGroup.props.children.unshift(saveToImmichRow);
                  }
                }
              }
            } catch (e) {
              console.error("[ImmichSave] ActionSheet patch error:", e);
            }
          });
        }
   },
   onUnload: () => {
     if (unpatchActionSheet) {
       unpatchActionSheet();
     }
   },
   
   settings: SettingsComponent
};
